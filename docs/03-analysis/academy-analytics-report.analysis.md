# Gap Analysis: academy-analytics-report

> **Date**: 2026-03-22
> **Match Rate**: 92%
> **Status**: PASS (>= 90%)

## Score Summary

| Category | Score |
|----------|:-----:|
| Plan FR (10 items) | 100% |
| Plan NFR (4 items) | 75% |
| Design Backend | 94% |
| Design Frontend | 86% |
| Design Sidebar + Route | 100% |
| Architecture | 100% |
| **Overall** | **92%** |

## Minor Gaps (Low Impact)

| # | Gap | Impact |
|---|-----|--------|
| 1 | `academy_id` query param override 미구현 (기본값만 사용) | Low - 현재 단일 학원 용도 |
| 2 | 차트 높이 350 → 300 | Low - 시각적 |
| 3 | XAxis angle -30 미적용 | Low - 종목명 짧아서 겹침 없음 |
| 4 | Recharts Legend → 커스텀 LegendDot | Low - 기능 동일 |

## Enhancements (Design에 없으나 구현됨)

- 4번째 KPI "상승 추세" 카드 추가
- 아코디언 UI (하락 기본 펼침, 나머지 접힘)
- 종목별 avgSlope / avgTrend 계산
- 전체 학생 overallTrend 요약

## Conclusion

Design 의도대로 잘 구현됨. 중간에 변경된 요구사항(종목별 트렌드, 탭 통합)도 정확히 반영.
