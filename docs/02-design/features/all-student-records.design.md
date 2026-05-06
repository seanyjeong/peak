# Design: 전체 학생 기록 관리 페이지

> **Feature**: all-student-records
> **Plan**: [all-student-records.plan.md](../../01-plan/features/all-student-records.plan.md)
> **Created**: 2026-02-25

---

## 1. 라우트 & 진입점

### 페이지 경로
- **URL**: `/students/records`
- **파일**: `src/app/(pc)/students/records/page.tsx`

### 진입 버튼
- **위치**: 학생관리 페이지 (`/students`) 헤더 영역, 새로고침 버튼 왼쪽
- **형태**: `<Link>` 버튼, 아이콘 `TableProperties` (lucide-react)
- **텍스트**: "전체 기록"

---

## 2. 데이터 흐름

### API 호출 (페이지 로드 시 병렬)

```
Promise.all([
  GET /peak/students          → students[]
  GET /peak/record-types      → recordTypes[] (active=true)
  GET /peak/records/latest    → latestRecords[]
])
```

### 클라이언트 데이터 조합

```typescript
// latestRecords를 Map으로 변환
// key: `${student_id}-${record_type_id}` → value: number
const recordMap = new Map<string, number>();
latestRecords.forEach(r => {
  recordMap.set(`${r.student_id}-${r.record_type_id}`, r.value);
});

// 테이블 행 생성
const rows = students.map(s => ({
  ...s,
  records: recordTypes.reduce((acc, rt) => {
    acc[rt.id] = recordMap.get(`${s.id}-${rt.id}`) ?? null;
    return acc;
  }, {} as Record<number, number | null>)
}));
```

---

## 3. 컴포넌트 구조

```
AllStudentRecordsPage
├── Header (← 뒤로가기 + 제목 + 학생수 카운트)
├── FilterBar
│   ├── SearchInput (이름/학교 통합 검색)
│   ├── GradeSelect (학년 드롭다운)
│   └── StatusFilters (상태 버튼 그룹)
└── RecordsTable
    ├── <thead> - 고정 컬럼(#, 이름, 학교, 학년) + 동적 종목 컬럼
    │   └── SortableHeader (종목명 + ▲▼ 아이콘, 클릭으로 정렬)
    └── <tbody> - 학생 행
        ├── 고정 정보: 번호, 이름+상태배지, 학교, 학년
        └── 동적 기록: 종목별 값 (단위 포함) 또는 "-"
```

---

## 4. 필터링 설계

### 4-1. 검색 (통합 텍스트)

```typescript
// 하나의 입력창으로 이름 + 학교 동시 검색
const matchesSearch = !searchTerm ||
  student.name.includes(searchTerm) ||
  (student.school && student.school.includes(searchTerm));
```

### 4-2. 학년 필터

```typescript
// 드롭다운: 전체, 고1, 고2, 고3, 중3, 기타
// students에서 unique grade 값 추출하여 동적 생성
const grades = [...new Set(students.map(s => s.grade).filter(Boolean))];
const matchesGrade = !gradeFilter || student.grade === gradeFilter;
```

### 4-3. 상태 필터

```typescript
// 기존 useStudentList.ts 패턴 재사용
const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '재원' },
  { key: 'pending', label: '미등록' },
  { key: 'trial', label: '체험' },
  { key: 'injury', label: '부상' },
  { key: 'paused', label: '휴원' },
  { key: 'inactive', label: '퇴원' },
];

// trial은 is_trial 플래그, 나머지는 status 필드
const matchesStatus = statusFilter === 'all' ||
  (statusFilter === 'trial' ? student.is_trial :
   statusFilter === 'active' ? (student.status === 'active' && !student.is_trial) :
   student.status === statusFilter);
```

---

## 5. 정렬 설계

### 종목별 정렬

```typescript
interface SortConfig {
  recordTypeId: number | null;  // null이면 기본(이름순)
  order: 'asc' | 'desc';
}

// 컬럼 헤더 클릭 로직
function handleSort(recordTypeId: number, direction: 'higher' | 'lower') {
  if (sort.recordTypeId === recordTypeId) {
    // 같은 컬럼 재클릭: 토글
    setSort({ recordTypeId, order: sort.order === 'asc' ? 'desc' : 'asc' });
  } else {
    // 새 컬럼: direction 기반 기본 정렬
    // higher(멀리뛰기): desc(높은순) 먼저
    // lower(달리기): asc(낮은순) 먼저
    setSort({
      recordTypeId,
      order: direction === 'higher' ? 'desc' : 'asc'
    });
  }
}

// 정렬 비교
function sortRows(a, b) {
  if (!sort.recordTypeId) return a.name.localeCompare(b.name);
  const va = a.records[sort.recordTypeId];
  const vb = b.records[sort.recordTypeId];
  // null 값은 항상 뒤로
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return sort.order === 'asc' ? va - vb : vb - va;
}
```

---

## 6. UI 상세

### 테이블 스타일

```
좌측 고정 컬럼 (sticky):
  #(40px) | 이름(120px) | 학교(100px) | 학년(60px)

동적 종목 컬럼 (가로 스크롤):
  종목1(100px) | 종목2(100px) | ...

- 좌측 4개 컬럼: sticky left, bg-white/dark:bg-slate-950
- 종목 컬럼: overflow-x-auto 스크롤
- 헤더: sticky top, bg-gray-50/dark:bg-slate-900
- 행 hover: bg-gray-50/dark:bg-slate-800
```

### 상태 배지 (기존 STATUS_MAP 재사용)

| 상태 | 라벨 | 색상 |
|------|------|------|
| active | 재원 | green |
| pending | 미등록 | amber |
| trial | 체험 | purple |
| injury | 부상 | red |
| paused | 휴원 | yellow |
| inactive | 퇴원 | slate |

### 기록값 표시

```
값 있을 때: "12.5s" / "4.2m" / "250cm" (값 + unit)
값 없을 때: "-" (text-gray-300)
```

### 하단 요약

```
총 45명 (재원 30 / 체험 8 / 미등록 7)
→ 필터 적용 후 현재 보이는 학생 수 기준
```

---

## 7. 파일 구현 목록

| # | 파일 | 유형 | 설명 |
|---|------|------|------|
| 1 | `backend/routes/records.js` | 수정 | `/latest` 엔드포인트 전체 학생 지원 확인 |
| 2 | `src/lib/api/records.ts` | 수정 | `fetchLatestRecords()` 함수 추가 |
| 3 | `src/app/(pc)/students/records/page.tsx` | 신규 | 메인 페이지 컴포넌트 |
| 4 | `src/app/(pc)/students/page.tsx` | 수정 | "전체 기록" 진입 버튼 추가 |

### 구현 순서
1. API 확인/수정 (backend) → 2. API 클라이언트 (frontend) → 3. 페이지 구현 → 4. 진입 버튼

---

## 8. 접근 권한

- `verifyToken` 미들웨어로 로그인 필수
- 프론트에서 role 체크: admin, owner만 접근 가능
- staff는 학생관리 페이지 자체가 제한되므로 자연스럽게 차단
