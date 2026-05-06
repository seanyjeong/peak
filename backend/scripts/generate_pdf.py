#!/usr/bin/env python3
"""P-EAK Student PDF Report Generator
Playwright + Chart.js for high-quality PDF output.
Reads JSON from stdin, outputs PDF to --output path.
"""

import sys
import json
import argparse
from datetime import datetime
from playwright.sync_api import sync_playwright


GRADE_COLORS = {"A": "#22c55e", "B": "#3b82f6", "C": "#f59e0b", "D": "#f97316", "F": "#ef4444"}
GAUGE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"]
TREND_LABELS = {"up": "↑ 상승", "down": "↓ 하락", "stable": "→ 유지", "need_more": "데이터 부족"}


def generate_html(data: dict) -> str:
    student = data["student"]
    stats = data["stats"]
    record_types = data["recordTypes"]
    records = data.get("records", [])
    academy_score_avgs = data.get("academyScoreAverages", {})
    academy_name = data.get("academyName", "체대입시 학원")
    today = datetime.now().strftime("%Y년 %m월 %d일")

    grade = stats.get("grade", "F")
    grade_color = GRADE_COLORS.get(grade, "#6b7280")
    trend_label = TREND_LABELS.get(stats.get("overallTrend", "stable"), "→ 유지")
    gender_label = "남" if student.get("gender") == "M" else "여"

    # Build types with data
    types_with_data = []
    for rt in record_types:
        rt_id = str(rt["id"])
        if rt_id in stats.get("scores", {}):
            types_with_data.append({
                "id": rt["id"],
                "name": rt.get("short_name") or rt["name"],
                "fullName": rt["name"],
                "unit": rt["unit"],
                "score": stats["scores"].get(rt_id, 0),
                "latest": stats["latests"].get(rt_id, {}).get("value", "-"),
                "best": stats["bests"].get(rt_id, {}).get("value", "-"),
                "trend": stats["trends"].get(rt_id, "stable"),
                "academyAvg": float(academy_score_avgs.get(rt_id, 0))
            })

    # Gauge charts HTML
    gauge_html = ""
    for i, t in enumerate(types_with_data[:6]):
        color = GAUGE_COLORS[i % len(GAUGE_COLORS)]
        gauge_html += f"""
        <div class="gauge-item">
            <canvas id="gauge{i}" width="100" height="100"></canvas>
            <div class="gauge-label">{t['name']}</div>
            <div class="gauge-score">{t['score']}점</div>
        </div>"""

    # Gauge JS
    gauge_js = ""
    for i, t in enumerate(types_with_data[:6]):
        color = GAUGE_COLORS[i % len(GAUGE_COLORS)]
        score = t["score"]
        gauge_js += f"""
        new Chart(document.getElementById('gauge{i}'), {{
            type: 'doughnut',
            data: {{
                datasets: [{{
                    data: [{score}, {100 - score}],
                    backgroundColor: ['{color}', '#e5e7eb'],
                    borderWidth: 0
                }}]
            }},
            options: {{
                cutout: '72%',
                responsive: false,
                plugins: {{ legend: {{ display: false }}, tooltip: {{ enabled: false }} }},
                animation: false
            }}
        }});"""

    # Bar chart data (student vs academy)
    bar_labels = json.dumps([t["name"] for t in types_with_data[:8]])
    bar_student = json.dumps([t["score"] for t in types_with_data[:8]])
    bar_academy = json.dumps([round(t["academyAvg"], 1) for t in types_with_data[:8]])

    # Radar chart data
    radar_labels = json.dumps([t["name"] for t in types_with_data[:5]])
    radar_student = json.dumps([t["score"] for t in types_with_data[:5]])
    radar_academy = json.dumps([round(t["academyAvg"], 1) for t in types_with_data[:5]])

    # Recent records table
    records_html = ""
    type_headers = ""
    for t in types_with_data[:6]:
        type_headers += f"<th>{t['name']}</th>"

    shown_records = records[:4] if len(records) > 4 else records
    for rec in shown_records:
        date_str = rec.get("measured_at", "")[:10]
        if date_str:
            try:
                dt = datetime.fromisoformat(date_str)
                date_str = f"{dt.month}.{dt.day}"
            except Exception:
                pass
        rec_map = {}
        for r in rec.get("records", []):
            rec_map[r["record_type_id"]] = f'{r["value"]}{r.get("unit", "")}'

        cells = ""
        for t in types_with_data[:6]:
            val = rec_map.get(t["id"], "-")
            cells += f"<td>{val}</td>"
        records_html += f"<tr><td class='date-cell'>{date_str}</td>{cells}</tr>"

    # Summary cards
    total = stats.get("totalScore", 0)
    max_score = stats.get("maxPossibleScore", 0)
    pct = stats.get("percentage", 0)
    rec_count = stats.get("recordCount", 0)
    types_count = stats.get("typesWithRecords", 0)

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap');

* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
    font-family: 'Noto Sans KR', -apple-system, sans-serif;
    background: #ffffff;
    color: #1f2937;
    padding: 20px 28px;
    width: 1120px;
}}

.header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 3px solid #1e3a5f;
}}
.header-left h1 {{
    font-size: 20px;
    color: #1e3a5f;
    font-weight: 700;
}}
.header-left .subtitle {{
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
}}
.header-right {{
    text-align: right;
}}
.header-right .date {{
    font-size: 10px;
    color: #9ca3af;
}}
.student-info {{
    font-size: 13px;
    color: #374151;
    font-weight: 500;
    margin-top: 2px;
}}

.cards {{
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
}}
.card {{
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 12px;
    text-align: center;
}}
.card-title {{
    font-size: 10px;
    color: #6b7280;
    font-weight: 500;
    margin-bottom: 2px;
}}
.card-value {{
    font-size: 24px;
    font-weight: 700;
}}
.card-sub {{
    font-size: 10px;
    color: #9ca3af;
    margin-top: 1px;
}}
.grade-badge {{
    display: inline-block;
    font-size: 28px;
    font-weight: 700;
    color: {grade_color};
}}
.trend-up {{ color: #22c55e; }}
.trend-down {{ color: #ef4444; }}
.trend-stable {{ color: #6b7280; }}

.section-title {{
    font-size: 12px;
    font-weight: 600;
    color: #1e3a5f;
    margin-bottom: 6px;
    padding-left: 8px;
    border-left: 3px solid #3b82f6;
}}

.gauges {{
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 10px;
    padding: 8px 0;
    background: #f8fafc;
    border-radius: 8px;
}}
.gauge-item {{
    text-align: center;
    width: 100px;
}}
.gauge-label {{
    font-size: 10px;
    color: #6b7280;
    margin-top: 2px;
}}
.gauge-score {{
    font-size: 12px;
    font-weight: 600;
    color: #374151;
}}

.charts-row {{
    display: flex;
    gap: 12px;
    margin-bottom: 10px;
}}
.chart-box {{
    background: #f8fafc;
    border-radius: 8px;
    padding: 10px;
    overflow: hidden;
}}
.chart-box-bar {{
    width: 600px;
    height: 200px;
}}
.chart-box-radar {{
    width: 440px;
    height: 200px;
}}

.records-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
}}
.records-table th {{
    background: #1e3a5f;
    color: white;
    padding: 5px 8px;
    text-align: center;
    font-weight: 500;
    font-size: 10px;
}}
.records-table td {{
    padding: 4px 8px;
    text-align: center;
    border-bottom: 1px solid #e5e7eb;
}}
.records-table tr:nth-child(even) {{
    background: #f8fafc;
}}
.date-cell {{
    font-weight: 500;
    color: #374151;
}}

.footer {{
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #9ca3af;
}}
</style>
</head>
<body>

<div class="header">
    <div class="header-left">
        <h1>{academy_name}</h1>
        <div class="subtitle">실기 성적표</div>
    </div>
    <div class="header-right">
        <div class="date">{today}</div>
        <div class="student-info">{student.get('name', '')} · {gender_label} · {student.get('school', '')} · {student.get('grade', '')}학년</div>
    </div>
</div>

<div class="cards">
    <div class="card">
        <div class="card-title">총점</div>
        <div class="card-value" style="color: #1e3a5f;">{total}<span style="font-size:14px;color:#9ca3af;">/{max_score}</span></div>
        <div class="card-sub">{pct}%</div>
    </div>
    <div class="card">
        <div class="card-title">등급</div>
        <div class="grade-badge">{grade}</div>
    </div>
    <div class="card">
        <div class="card-title">추세</div>
        <div class="card-value trend-{'up' if stats.get('overallTrend') == 'up' else 'down' if stats.get('overallTrend') == 'down' else 'stable'}" style="font-size:22px;">{trend_label}</div>
    </div>
    <div class="card">
        <div class="card-title">기록</div>
        <div class="card-value" style="color: #1e3a5f; font-size:22px;">{types_count}종목</div>
        <div class="card-sub">총 {rec_count}회 측정</div>
    </div>
</div>

<div class="section-title">종목별 달성률</div>
<div class="gauges">
    {gauge_html}
</div>

<div class="charts-row">
    <div class="chart-box chart-box-bar">
        <div class="section-title">학원 비교</div>
        <canvas id="barChart" width="570" height="160"></canvas>
    </div>
    <div class="chart-box chart-box-radar">
        <div class="section-title">능력치</div>
        <canvas id="radarChart" width="420" height="160"></canvas>
    </div>
</div>

<div class="section-title">최근 기록</div>
<table class="records-table">
    <thead>
        <tr>
            <th>날짜</th>
            {type_headers}
        </tr>
    </thead>
    <tbody>
        {records_html}
    </tbody>
</table>

<div class="footer">
    <span>P-EAK 실기훈련관리시스템</span>
    <span>{academy_name} · {today}</span>
</div>

<script>
// Bar Chart - Student vs Academy
new Chart(document.getElementById('barChart'), {{
    type: 'bar',
    data: {{
        labels: {bar_labels},
        datasets: [
            {{
                label: '{student.get("name", "")}',
                data: {bar_student},
                backgroundColor: '#3b82f6',
                borderRadius: 4,
                barPercentage: 0.4
            }},
            {{
                label: '학원 평균',
                data: {bar_academy},
                backgroundColor: '#cbd5e1',
                borderRadius: 4,
                barPercentage: 0.4
            }}
        ]
    }},
    options: {{
        indexAxis: 'y',
        responsive: false,
        animation: false,
        scales: {{
            x: {{ max: 100, grid: {{ color: '#f1f5f9' }}, ticks: {{ font: {{ size: 9 }} }} }},
            y: {{ grid: {{ display: false }}, ticks: {{ font: {{ size: 10 }} }} }}
        }},
        plugins: {{
            legend: {{ position: 'bottom', labels: {{ font: {{ size: 9 }}, boxWidth: 12 }} }}
        }}
    }}
}});

// Radar Chart
new Chart(document.getElementById('radarChart'), {{
    type: 'radar',
    data: {{
        labels: {radar_labels},
        datasets: [
            {{
                label: '{student.get("name", "")}',
                data: {radar_student},
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderWidth: 2,
                pointRadius: 3
            }},
            {{
                label: '학원 평균',
                data: {radar_academy},
                borderColor: '#94a3b8',
                backgroundColor: 'rgba(148, 163, 184, 0.1)',
                borderWidth: 1,
                pointRadius: 2
            }}
        ]
    }},
    options: {{
        responsive: false,
        animation: false,
        scales: {{
            r: {{ min: 0, max: 100, ticks: {{ stepSize: 20, font: {{ size: 8 }} }}, pointLabels: {{ font: {{ size: 9 }} }} }}
        }},
        plugins: {{
            legend: {{ position: 'bottom', labels: {{ font: {{ size: 9 }}, boxWidth: 12 }} }}
        }}
    }}
}});

// Gauge Charts
{gauge_js}

window._chartsReady = true;
</script>

</body>
</html>"""
    return html


def generate_pdf(html: str, output_path: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1120, "height": 800})
        page.set_content(html, wait_until="networkidle")
        try:
            page.wait_for_function("window._chartsReady === true", timeout=15000)
        except Exception:
            # Charts may not have loaded (CDN issue), proceed anyway
            page.wait_for_timeout(3000)
        page.pdf(
            path=output_path,
            format="A4",
            landscape=True,
            print_background=True,
            margin={"top": "8mm", "right": "8mm", "bottom": "8mm", "left": "8mm"}
        )
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="P-EAK Student PDF Generator")
    parser.add_argument("--output", required=True, help="Output PDF file path")
    args = parser.parse_args()

    data = json.load(sys.stdin)
    html = generate_html(data)
    generate_pdf(html, args.output)
    print(args.output)
