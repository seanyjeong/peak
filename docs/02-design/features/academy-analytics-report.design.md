# Design: 학원 분석 리포트

> **Feature**: academy-analytics-report
> **Plan**: [academy-analytics-report.plan.md](../../01-plan/features/academy-analytics-report.plan.md)
> **Created**: 2026-03-22
> **Status**: Draft

---

## 1. 설계 개요

학원 전체 학생의 실기 기록을 종합 분석하여 **종목별 남/여 평균**, **순위**, **트렌드(상승/유지/하락)** 를 시각화하는 데이터 리포트 페이지.
PDF 다운로드를 지원하며, 순수 통계 계산 기반으로 구현한다.

### 설계 원칙
- 기존 프로젝트 패턴(TailwindCSS v4, Recharts, apiClient) 그대로 따름
- 단일 API 엔드포인트로 모든 데이터 제공 (프론트 요청 1회)
- 화면 = PDF (html2canvas + jsPDF, 별도 레이아웃 없음)

---

## 2. 백엔드 API 설계

### 2.1 엔드포인트

```
GET /peak/analytics/report?academy_id={academyId}
```

| 항목 | 값 |
|------|-----|
| **파일** | `backend/routes/analytics.js` (신규) |
| **인증** | `verifyToken` 미들웨어 |
| **권한** | `admin`, `owner` only |
| **academy_id** | 쿼리 파라미터 (기본값: `req.user.academyId`) |

### 2.2 응답 구조

```typescript
interface AnalyticsReportResponse {
  summary: {
    totalRecords: number;      // 전체 기록 수
    totalStudents: number;     // 기록 보유 학생 수
    academyName: string;       // 학원명
    reportDate: string;        // YYYY-MM-DD
  };

  // 섹션 1: 종목별 남/여 평균
  eventAverages: Array<{
    recordTypeId: number;
    recordTypeName: string;
    shortName: string;
    unit: string;
    direction: 'higher' | 'lower';
    maleAvg: number | null;    // 남자 평균 (소수점 1자리)
    femaleAvg: number | null;  // 여자 평균
    totalAvg: number;          // 전체 평균
    maleCount: number;         // 남자 인원
    femaleCount: number;       // 여자 인원
  }>;

  // 섹션 2: 종목별 순위 (Top 10)
  rankings: Array<{
    recordTypeId: number;
    recordTypeName: string;
    unit: string;
    direction: 'higher' | 'lower';
    male: Array<{
      rank: number;
      studentId: number;
      studentName: string;
      value: number;
      measuredAt: string;
    }>;
    female: Array<{
      rank: number;
      studentId: number;
      studentName: string;
      value: number;
      measuredAt: string;
    }>;
  }>;

  // 섹션 3: 트렌드 분석
  trends: {
    improving: TrendStudent[];   // 📈 상승
    maintaining: TrendStudent[]; // ➡️ 유지
    declining: TrendStudent[];   // 📉 하락
  };

  // 섹션 4: 데이터 부족 안내
  insufficientData: Array<{
    studentId: number;
    studentName: string;
    gender: 'M' | 'F';
    events: Array<{
      recordTypeName: string;
      recordCount: number;
    }>;
  }>;
}

interface TrendStudent {
  studentId: number;
  studentName: string;
  gender: 'M' | 'F';
  overallTrend: 'improving' | 'maintaining' | 'declining';
  improvingCount: number;
  maintainingCount: number;
  decliningCount: number;
  events: Array<{
    recordTypeName: string;
    trend: 'improving' | 'maintaining' | 'declining';
    slope: number;             // 선형회귀 기울기
    latestValue: number;
    unit: string;
    recentValues: number[];    // 최근 5개 기록값
  }>;
}
```

### 2.3 트렌드 분석 알고리즘

ET 서버 실제 분석 데이터(2026-03-12) 기반으로 검증된 알고리즘:

```javascript
/**
 * 선형회귀 기울기 계산
 * @param values - 최근 5개 기록 (시간순 정렬)
 * @returns slope 값
 */
function calculateSlope(values) {
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * 트렌드 판정
 * @param slope - 기울기
 * @param direction - 'higher' | 'lower'
 * @returns 'improving' | 'maintaining' | 'declining'
 */
function classifyTrend(slope, direction) {
  const THRESHOLD = 0.5;  // ET 서버 분석과 동일한 기준

  if (direction === 'higher') {
    if (slope > THRESHOLD) return 'improving';
    if (slope < -THRESHOLD) return 'declining';
  } else {  // lower is better (달리기)
    if (slope < -THRESHOLD) return 'improving';
    if (slope > THRESHOLD) return 'declining';
  }
  return 'maintaining';
}

/**
 * 학생별 종합 추세 판정
 * (향상 종목 수 - 하락 종목 수) / 전체 종목 수
 */
function classifyOverallTrend(improvingCount, decliningCount, totalCount) {
  const score = (improvingCount - decliningCount) / totalCount;
  if (score > 0.15) return 'improving';
  if (score < -0.15) return 'declining';
  return 'maintaining';
}
```

**실 데이터 검증 결과** (2026-03-12, 44명):
| 그룹 | 인원 |
|------|------|
| 상승세 | 13명 |
| 보합 | 18명 |
| 하락세 | 13명 |

### 2.4 SQL 쿼리 설계

#### 요약 정보
```sql
-- 총 기록 수 & 학생 수
SELECT
  COUNT(*) as totalRecords,
  COUNT(DISTINCT sr.student_id) as totalStudents
FROM student_records sr
JOIN students s ON sr.student_id = s.id AND s.academy_id = ?
JOIN paca.students ps ON s.paca_student_id = ps.id
WHERE ps.status = 'active';
```

#### 종목별 남/여 평균 (최신 기록 기준)
```sql
-- 학생별 종목별 최신 기록 → 평균 계산
SELECT
  rt.id as record_type_id,
  rt.name,
  rt.short_name,
  rt.unit,
  rt.direction,
  s.gender,
  AVG(sr.value) as avg_value,
  COUNT(DISTINCT sr.student_id) as student_count
FROM student_records sr
INNER JOIN (
  SELECT student_id, record_type_id, MAX(measured_at) as max_date
  FROM student_records
  GROUP BY student_id, record_type_id
) latest ON sr.student_id = latest.student_id
  AND sr.record_type_id = latest.record_type_id
  AND sr.measured_at = latest.max_date
JOIN students s ON sr.student_id = s.id AND s.academy_id = ?
JOIN paca.students ps ON s.paca_student_id = ps.id
JOIN record_types rt ON sr.record_type_id = rt.id AND rt.is_active = 1
WHERE ps.status = 'active'
GROUP BY rt.id, s.gender
ORDER BY rt.display_order, s.gender;
```

#### 종목별 순위 (Top 10)
```sql
-- 기존 stats.js의 leaderboard 쿼리 패턴 재활용
-- direction에 따라 ASC/DESC 정렬
SELECT
  sr.student_id,
  COALESCE(ps.name, '(이름없음)') as student_name,
  s.gender,
  sr.value,
  sr.measured_at
FROM student_records sr
INNER JOIN (
  SELECT student_id, MAX(measured_at) as max_date
  FROM student_records
  WHERE record_type_id = ?
  GROUP BY student_id
) latest ON sr.student_id = latest.student_id AND sr.measured_at = latest.max_date
JOIN students s ON sr.student_id = s.id AND s.academy_id = ?
JOIN paca.students ps ON s.paca_student_id = ps.id
WHERE sr.record_type_id = ? AND ps.status = 'active' AND s.gender = ?
ORDER BY sr.value {DESC|ASC}  -- direction 기반
LIMIT 10;
```

#### 트렌드 분석용 (최근 5개 기록)
```sql
-- 학생별 종목별 최근 5개 기록
SELECT
  sr.student_id,
  sr.record_type_id,
  sr.value,
  sr.measured_at
FROM student_records sr
JOIN students s ON sr.student_id = s.id AND s.academy_id = ?
JOIN paca.students ps ON s.paca_student_id = ps.id
WHERE ps.status = 'active'
ORDER BY sr.student_id, sr.record_type_id, sr.measured_at DESC;
-- 애플리케이션 레벨에서 student_id + record_type_id 그룹별 최근 5개 슬라이스
```

### 2.5 라우트 등록

```javascript
// backend/peak.js
const analyticsRoutes = require('./routes/analytics');
app.use('/peak/analytics', verifyToken, analyticsRoutes);
```

### 2.6 최소 기록 조건 (FR-08)

```javascript
// 학원 전체 기록 200개 미만 → 403 응답
if (totalRecords < 200) {
  return res.status(403).json({
    error: 'INSUFFICIENT_DATA',
    message: '리포트 생성을 위해 최소 200개의 기록이 필요합니다.',
    currentCount: totalRecords
  });
}
```

---

## 3. 프론트엔드 설계

### 3.1 페이지 구조

```
src/app/(pc)/analytics/
└── page.tsx          # 메인 리포트 페이지 ('use client')
```

### 3.2 사이드메뉴 추가

**파일**: `src/app/(pc)/layout.tsx`

```typescript
// navigation 배열에 추가 (학생 관리 아래, 실기측정설정 위)
{ name: '분석 리포트', href: '/analytics', icon: BarChart3, adminOnly: true }
```

- `BarChart3`는 `lucide-react`에서 import (기존 프로젝트에서 사용 중)
- `adminOnly: true` → admin/owner만 표시

### 3.3 컴포넌트 구조

단일 `page.tsx` 내에서 섹션별로 구분 (세로 스크롤 리포트):

```
AnalyticsReportPage (세로 무한 스크롤)
├── 헤더 (학원명, 생성일, 요약 KPI 4개)
├── 섹션 1: 종목별 남/여 평균
│   ├── BarChart (Recharts - 그룹 바차트)
│   └── 테이블 (종목, 남평균, 여평균, 전체평균)
├── 섹션 2: 종목별 상세 (순위 + 트렌드 통합)
│   ├── 종목 탭 (버튼 그룹) ← 클릭하면 해당 종목 표시
│   ├── 선택 종목 순위: 남자 Top 10 / 여자 Top 10 (나란히)
│   └── 선택 종목 트렌드: 상승/유지/하락 학생 명단
│       ├── 📈 상승 (N명) — 학생명, 기울기, 최근값
│       ├── ➡️ 유지 (N명) — 학생명 나열
│       └── 📉 하락 (N명) — 학생명, 기울기, 최근값 (강조)
├── 섹션 3: 데이터 부족 안내
│   └── ⚠️ 기록 5개 미만 학생 테이블
└── PDF 다운로드 버튼 (우상단 고정)
```

> **핵심 변경**: 종목 탭 하나로 순위 + 트렌드를 통합.
> 코치가 "제자리멀리뛰기 하락 학생이 누구?"를 바로 확인 가능.

### 3.4 UI 세부 설계

#### 헤더 영역
```
┌─────────────────────────────────────────────────────┐
│  📊 [학원명] 분석 리포트            [📥 PDF 다운로드] │
│  생성일: 2026-03-22                                  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ 총 기록  │  │ 분석 학생│  │ 분석 종목│           │
│  │  2,081   │  │   48명   │  │   7개    │           │
│  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────┘
```

KPI 카드 스타일 (기존 패턴):
```
bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4
```
- 라벨: `text-slate-500 dark:text-slate-400 text-xs font-medium`
- 숫자: `text-2xl font-bold text-slate-900 dark:text-white`

#### 섹션 1: 종목별 남/여 평균 차트

Recharts `BarChart` (수직):
```typescript
<ResponsiveContainer width="100%" height={350}>
  <BarChart data={eventAverages} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
    <XAxis
      dataKey="shortName"
      tick={{ fill: '#64748b', fontSize: 11 }}
      angle={-30}
      textAnchor="end"
    />
    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
    <Tooltip contentStyle={tooltipStyle} />
    <Legend />
    <Bar dataKey="maleAvg" name="남자 평균" fill="#4666FF" radius={[4,4,0,0]} />
    <Bar dataKey="femaleAvg" name="여자 평균" fill="#FE5A1D" radius={[4,4,0,0]} />
  </BarChart>
</ResponsiveContainer>
```

차트 아래 테이블:
| 종목 | 단위 | 남자 평균 | 여자 평균 | 전체 평균 | 남(명) | 여(명) |
|------|------|-----------|-----------|-----------|--------|--------|

테이블 스타일: `text-sm`, 헤더 `bg-slate-50 dark:bg-slate-700/50`

#### 섹션 2: 종목별 상세 (순위 + 트렌드 통합)

> **종목 탭을 누르면 해당 종목의 순위 + 트렌드가 한 번에 표시**
> 종목 목록은 API에서 `record_types` (is_active=1) 기반 동적 생성 — 하드코딩 금지!

종목 탭 (API 응답 기반 동적 렌더링):
```typescript
// 종목 탭은 eventAverages 데이터에서 동적 생성
{data.eventAverages.map(event => (
  <button key={event.recordTypeId}
    className={selectedEvent === event.recordTypeId
      ? 'bg-brand-orange text-white'
      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}
    onClick={() => setSelectedEvent(event.recordTypeId)}>
    {event.shortName || event.recordTypeName}
  </button>
))}
```

**종목 선택 시 표시 내용**:

```
[종목 탭: 동적 생성 — API record_types 기반]

┌── 선택 종목: 제자리멀리뛰기 ──────────────────────┐
│                                                    │
│  [평균추세 ↓ 하락]   ↑5  →20  ↓20                  │
│                                                    │
│  ┌──── 순위 ────────────────────────────────────┐ │
│  │ 🏅 남자 Top 10        │ 🏅 여자 Top 10       │ │
│  │ 1  백지민  291cm      │ 1  유가은  237cm     │ │
│  │ 2  여민석  284cm      │ 2  최혜은  225cm     │ │
│  │ ...                   │ ...                  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌── 📉 하락 (20명) ─── border-l-4 red ─────────┐ │
│  │ 고준희 (여)    기울기 -1.60    210cm           │ │
│  │ 오예은 (여)    기울기 -36.50   20cm            │ │
│  │ 서명지 (여)    기울기 -2.70    200cm           │ │
│  │ ...                                           │ │
│  └───────────────────────────────────────────────┘ │
│                                                    │
│  ┌── 📈 상승 (5명) ─── border-l-4 green ────────┐ │
│  │ 임현수, 이호근, 권동욱, 유가은, 김태양         │ │
│  └───────────────────────────────────────────────┘ │
│                                                    │
│  ┌── ➡️ 유지 (20명) ─── border-l-4 slate ───────┐ │
│  │ 백지민, 윤지언, 김수연 외 17명                 │ │
│  └───────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

- 하락 그룹이 **최상단** (코칭 우선순위)
- 하락: `border-l-4 border-red-500`, 학생별 기울기+최근값 상세 표시
- 상승: `border-l-4 border-green-500`, 학생명만 나열
- 유지: `border-l-4 border-slate-400`, 학생명만 나열 (접기 가능)

#### 섹션 4: 데이터 부족 안내
```
⚠️ 다음 학생은 종목별 기록 5개 미만으로 트렌드 분석에서 제외되었습니다.
┌──────────────────────────────────────┐
│ 학생명 | 종목 | 현재 기록 수          │
│ 홍길동 | 좌전굴 | 3개                 │
│ ...                                   │
└──────────────────────────────────────┘
```

### 3.5 색상 팔레트

| 용도 | 색상 | 코드 |
|------|------|------|
| 남자 | Brand Blue | `#4666FF` |
| 여자 | Brand Orange | `#FE5A1D` |
| 전체 평균 | Slate | `#94a3b8` |
| 상승 트렌드 | Green | `#22c55e` |
| 유지 트렌드 | Slate | `#64748b` |
| 하락 트렌드 | Red | `#ef4444` |

### 3.6 PDF 다운로드

```typescript
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

async function downloadPDF() {
  const element = document.getElementById('analytics-report');
  const canvas = await html2canvas(element, {
    scale: 2,           // 고해상도
    useCORS: true,
    backgroundColor: '#ffffff',  // 항상 라이트 모드로 출력
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF('p', 'mm', 'a4');

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  // 세로 연속 출력 (자동 페이지 나눔)
  let position = 0;
  const pageHeight = pdf.internal.pageSize.getHeight();

  while (position < pdfHeight) {
    if (position > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, -position, pdfWidth, pdfHeight);
    position += pageHeight;
  }

  pdf.save(`분석리포트_${new Date().toISOString().split('T')[0]}.pdf`);
}
```

**PDF 주의사항**:
- Recharts SVG → html2canvas가 자동 처리
- 다크모드에서도 PDF는 라이트 모드로 출력 (`backgroundColor: '#ffffff'`)
- 스케일 2배로 선명도 확보

### 3.7 데이터 로딩 패턴

```typescript
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { authAPI } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';

export default function AnalyticsReportPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const user = authAPI.getCurrentUser();
    if (!user || !['admin', 'owner'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }

    apiClient.get('/analytics/report')
      .then(res => setData(res.data))
      .catch(err => {
        if (err.response?.data?.error === 'INSUFFICIENT_DATA') {
          setError(`기록이 부족합니다 (${err.response.data.currentCount}/200)`);
        } else {
          setError('리포트를 불러올 수 없습니다.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ... 렌더링
}
```

### 3.8 로딩 상태

`animate-shimmer` 스켈레톤 사용 (기존 프로젝트 패턴):
- KPI 카드 3개 스켈레톤
- 차트 영역 직사각형 스켈레톤
- 테이블 행 스켈레톤

---

## 4. 파일 변경 목록

### 신규 파일
| 파일 | 설명 |
|------|------|
| `backend/routes/analytics.js` | 분석 리포트 API |
| `src/app/(pc)/analytics/page.tsx` | 리포트 페이지 |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `backend/peak.js` | analytics 라우트 등록 |
| `src/app/(pc)/layout.tsx` | 사이드메뉴에 '분석 리포트' 추가 |

### 변경 없음 (재활용)
| 파일 | 이유 |
|------|------|
| `backend/utils/encryption.js` | 이름 복호화에 기존 함수 사용 |
| `src/lib/api/client.ts` | 기존 apiClient 그대로 사용 |
| `src/lib/api/auth.ts` | 권한 체크에 기존 함수 사용 |

---

## 5. 구현 순서

| 순서 | 작업 | 의존성 |
|------|------|--------|
| 1 | `backend/routes/analytics.js` - API 구현 | 없음 |
| 2 | `backend/peak.js` - 라우트 등록 | 1 |
| 3 | API 테스트 (curl) | 2 |
| 4 | `src/app/(pc)/layout.tsx` - 메뉴 추가 | 없음 |
| 5 | `src/app/(pc)/analytics/page.tsx` - 페이지 구현 | 1, 4 |
| 6 | PDF 다운로드 기능 | 5 |
| 7 | 통합 테스트 | 전체 |

---

## 6. 성능 고려사항

### NFR-02: 100명 이상 3초 이내
- **단일 API 호출**: 프론트에서 1번만 요청
- **서브쿼리 최적화**: 최신 기록 조회에 `MAX(measured_at)` 서브쿼리 활용
- **인덱스 활용**: `student_records(student_id, record_type_id, measured_at)` UNIQUE KEY
- **트렌드 계산**: 서버사이드에서 처리 (프론트 부담 없음)

### NFR-03: PDF 5MB 이하
- `html2canvas` JPEG 품질 0.95 (PNG 대비 ~60% 용량)
- 스케일 2배 (4배로 올리면 용량 급증)

---

## 7. 에러 처리

| 상황 | 처리 |
|------|------|
| 기록 200개 미만 | 403 + 안내 메시지 (현재 기록 수 표시) |
| 비인가 접근 (staff) | 프론트에서 `/dashboard`로 리다이렉트 |
| API 오류 | 에러 카드 표시 + 재시도 버튼 |
| 특정 종목 기록 없음 | 해당 종목 차트에서 제외, 테이블에 '-' 표시 |
| 남/여 한쪽만 있는 경우 | 있는 성별만 표시, 없는 쪽은 null |

---

## 8. 제외 범위 (v2 이후)

| 기능 | 이유 |
|------|------|
| AI 코칭 코멘트 | 비용, v1은 순수 데이터 분석 |
| 기간별 필터 | v1은 전체 기간 |
| 개별 학생 리포트 PDF | 기존 `/students/[id]` 페이지로 대체 |
| 학부모용 공유 링크 | 인증/보안 설계 필요 |
| 태블릿/모바일 대응 | PC 전용 (admin/owner만 사용) |
