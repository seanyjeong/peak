#!/usr/bin/env python3
"""Smoke test for the Peak student PDF generator."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def sample_payload() -> dict:
    return {
        "academyName": "맥스체대입시",
        "student": {"name": "김서연", "gender": "F", "school": "백마고", "grade": "2"},
        "stats": {
            "totalScore": 286,
            "maxPossibleScore": 300,
            "percentage": 95.3,
            "grade": "A",
            "overallTrend": "up",
            "recordCount": 18,
            "typesWithRecords": 3,
            "scores": {"1": 98, "2": 96, "3": 92},
            "latests": {"1": {"value": 236}, "2": {"value": 9.8}, "3": {"value": 9.1}},
            "bests": {"1": {"value": 236}, "2": {"value": 9.8}, "3": {"value": 9.1}},
            "trends": {"1": "up", "2": "up", "3": "stable"},
        },
        "recordTypes": [
            {"id": 1, "name": "제자리멀리뛰기", "short_name": "멀리", "unit": "cm", "direction": "higher"},
            {"id": 2, "name": "왕복달리기", "short_name": "왕복", "unit": "초", "direction": "lower"},
            {"id": 3, "name": "메디신볼던지기", "short_name": "메디신", "unit": "m", "direction": "higher"},
        ],
        "records": [
            {
                "measured_at": "2026-06-20",
                "records": [
                    {"record_type_id": 1, "value": 236, "unit": "cm"},
                    {"record_type_id": 2, "value": 9.8, "unit": "초"},
                    {"record_type_id": 3, "value": 9.1, "unit": "m"},
                ],
            }
        ],
        "academyScoreAverages": {"1": 88, "2": 84, "3": 82},
    }


def main() -> int:
    script_path = Path(__file__).with_name("generate_pdf.py")
    with tempfile.TemporaryDirectory() as tmp_dir:
        output_path = Path(tmp_dir) / "student-report.pdf"
        result = subprocess.run(
            [sys.executable, str(script_path), "--output", str(output_path)],
            input=json.dumps(sample_payload(), ensure_ascii=False),
            text=True,
            capture_output=True,
            timeout=45,
            check=False,
        )
        if result.returncode != 0:
            sys.stderr.write(result.stderr)
            return result.returncode
        if not output_path.exists() or output_path.stat().st_size < 1024:
            sys.stderr.write("PDF smoke failed: output file is missing or too small\n")
            return 1
        page_count = count_pdf_pages(output_path)
        if page_count != 1:
            sys.stderr.write(f"PDF smoke failed: expected 1 page, got {page_count}\n")
            return 1
    print("PDF generator smoke passed")
    return 0


def count_pdf_pages(path: Path) -> int:
    raw = path.read_bytes()
    return len(re.findall(rb"/Type\s*/Page(?!s)", raw))


if __name__ == "__main__":
    raise SystemExit(main())
