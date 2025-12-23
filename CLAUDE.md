# CLAUDE.md - P-EAK (피크)

## 프로젝트 개요

**P-EAK** = **P**hysical **E**xcellence **A**chievement **K**eeper
체육 성과 기록 관리 시스템

### 이름 의미
- **Physical** = 체육, 신체
- **Excellence** = 탁월함, 우수함
- **Achievement** = 성과, 기록
- **Keeper** = 관리자, 기록 보관자

### Peak (피크) 의미
- **정점, 최고점** - 기록의 정점을 향해
- **산봉우리** - 목표를 향한 도전
- "피크 컨디션" - 최상의 상태
- "피크를 찍다" - 최고 기록 달성

### P-ACA 자매 시스템
| 시스템 | 발음 | 역할 |
|--------|------|------|
| P-ACA | 파카 | 학원 종합관리 |
| P-EAK | 피크 | 실기 훈련관리 |

> "**파카**로 학원 관리, **피크**로 기록 정점!"

---

## 현재 버전: v3.0.0

## 버전 정책

**⚠️ 중요: 커밋/푸시 전 반드시 버전 업데이트!**

| 자리 | 의미 | 예시 |
|------|------|------|
| **첫째 (Major)** | 큰 기능 추가 | 새 페이지, 새 시스템 |
| **둘째 (Minor)** | 기존 기능에 소규모 추가 | 탭 추가, 필터 추가 |
| **셋째 (Patch)** | 버그 수정 | 에러 수정, UI 수정 |

**버전 업데이트 위치**:
- `package.json` → `"version": "x.x.x"`
- `src/app/(pc)/layout.tsx` → `const APP_VERSION = 'vx.x.x'`
- `src/app/tablet/layout.tsx` → `const APP_VERSION = 'vx.x.x'` (태블릿)
- `src/app/mobile/layout.tsx` → `const APP_VERSION = 'vx.x.x'` (모바일)

---

## 기술 스택

- **프론트**: Next.js 16 + React 19 + TailwindCSS 4 + dnd-kit
- **백엔드**: Express.js 5 + MySQL (mysql2)
- **인증**: JWT (P-ACA 연동)
- **차트**: Recharts
- **배포**: Vercel (프론트) + systemd (백엔드)

---

## 백엔드 인프라

### 서비스 구조
```
인터넷 → chejump.com/peak/* → Caddy → localhost:8330 (peak.service)
```

### Caddy 설정 (/etc/caddy/Caddyfile)
```
chejump.com {
    handle /peak/* {
        reverse_proxy localhost:8330
    }
    handle {
        reverse_proxy localhost:8320  # P-ACA
    }
}
```

### systemd 서비스
| 항목 | 값 |
|------|-----|
| 서비스 파일 | `/etc/systemd/system/peak.service` |
| 백엔드 코드 | `/home/sean/ilsanmaxtraining/backend/peak.js` |
| 포트 | 8330 |
| 로그 | `journalctl -u peak` |

### 서버 명령어
```bash
# 백엔드 재시작 (비밀번호 자동 입력)
echo 'q141171616!' | sudo -S systemctl restart peak

# 로그 실시간 확인
echo 'q141171616!' | sudo -S journalctl -u peak -f

# 상태 확인
systemctl status peak

# Caddy 재시작 (설정 변경 시)
echo 'q141171616!' | sudo -S systemctl restart caddy
```

### sudo 팁 (안 될 때)
```bash
# -k 옵션으로 캐시 초기화
echo 'q141171616!' | sudo -S -k systemctl restart peak

# 여러 명령 연속 실행
echo 'q141171616!' | sudo -S sh -c "systemctl stop peak && systemctl start peak"
```

**⚠️ 주의**: 백엔드 코드 수정 후 반드시 `sudo systemctl restart peak` 실행!

---

## 핵심 기술 구현

### 1. P-ACA 동기화 (반 배치)
**파일**: `backend/routes/assignments.js`

```javascript
// POST /peak/assignments/sync
// 기존 배치(trainer_id) 유지하면서 P-ACA 학생 동기화
// - 새 학생: INSERT (trainer_id = NULL)
// - 기존 학생: trainer_id 유지
// - 취소된 학생: DELETE
```

**로직**:
1. 기존 배치를 `student_id + time_slot`로 맵핑
2. P-ACA에서 학생 목록 조회
3. 기존에 있으면 `trainer_id` 유지, 없으면 새로 추가
4. P-ACA에 없는 학생은 삭제

### 2. 기록 측정 UPSERT
**파일**: `backend/routes/records.js`

```javascript
// POST /peak/records/batch
// 하루에 한 종목당 최고 기록만 저장
// direction: 'higher' → 높을수록 좋음 (멀리뛰기)
// direction: 'lower' → 낮을수록 좋음 (달리기)
```

**로직**:
1. 같은 날짜, 학생, 종목 기록 조회
2. `direction`에 따라 비교
3. 더 좋은 기록이면 UPDATE, 아니면 무시

### 3. 드래그앤드롭 (반 배치)
**파일**: `src/app/(pc)/assignments/page.tsx`

```javascript
// dnd-kit 사용
// collisionDetection: pointerWithin (정확한 마우스 위치 감지)
// closestCorners는 가로 배열에서 부정확함
```

### 4. 시간대 설정 (P-ACA 연동)
**파일**: `backend/routes/assignments.js`

```sql
-- P-ACA academy_settings에서 시간대 조회
SELECT morning_class_time, afternoon_class_time, evening_class_time
FROM academy_settings WHERE academy_id = 2
```

**응답에 포함**:
```json
{
  "timeSlots": {
    "morning": "09:30-12:00",
    "afternoon": "14:00-18:00",
    "evening": "18:30-21:00"
  }
}
```

### 5. 역할 표시명
```javascript
// 모든 페이지에서 동일하게 사용
const getRoleDisplayName = (role, position) => {
  if (position) return position;  // position 우선
  switch (role) {
    case 'owner': return '원장';
    case 'admin': return '관리자';
    case 'staff': return '강사';
    default: return '강사';
  }
};
```

### 6. 원장 반배치 상시 표시 (v1.9.0)
**파일**: `backend/routes/assignments.js`

```javascript
// P-ACA에서 원장 조회 (users 테이블, role='owner')
const [owners] = await pacaPool.query(`
  SELECT id, name FROM users
  WHERE academy_id = ? AND role = 'owner' AND deleted_at IS NULL
`, [ACADEMY_ID]);

// 원장을 모든 시간대에 추가 (음수 ID로 구분)
owners.forEach(owner => {
  ['morning', 'afternoon', 'evening'].forEach(slot => {
    instructorsBySlot[slot].push({
      id: -owner.id,  // user_id 2 → -2 (강사와 구분)
      name: decrypt(owner.name),
      isOwner: true
    });
  });
});
```

**왜 음수 ID?**
- 원장은 P-ACA `instructors` 테이블에 없음 (월급 계산 대상 아님)
- `users` 테이블의 `id`를 음수로 변환해 강사와 구분
- 프론트에서 `trainer_id < 0`이면 원장으로 처리 가능

### 7. 체험수업 trial_dates 연동 (v1.9.0)
**파일**: `backend/routes/assignments.js`

```javascript
// P-ACA에서 trial_dates 조회
SELECT s.*, ps.trial_dates
FROM students s
JOIN paca.students ps ON s.paca_student_id = ps.id

// trial_total 계산: trial_dates 배열 길이 사용
let trialTotal = 0;
if (ps.is_trial) {
  const trialDates = JSON.parse(ps.trial_dates || '[]');
  trialTotal = trialDates.length || 2;  // 기본값 2
}

// INSERT 시에만 trial_total 설정, UPDATE 시에는 trial_remaining만
INSERT ... trial_total = ?, trial_remaining = ?
UPDATE ... trial_remaining = ?  // trial_total 유지
```

**표기 방식**:
- `trial_total - trial_remaining` = 완료 횟수
- 예: trial_total=2, trial_remaining=1 → "체험 1/2"

---

## DB 스키마

### peak DB
```sql
-- 학생
students (
  id, paca_student_id, name, gender, school, grade,
  is_trial, trial_total, trial_remaining, status
)

-- 종목 관리
record_types (
  id, name, short_name, unit, direction, is_active, display_order
)
-- direction: 'higher' (높을수록 좋음) / 'lower' (낮을수록 좋음)

-- 배점표
score_tables (
  id, record_type_id, max_score, min_score, score_step, value_step,
  male_perfect, female_perfect
)
score_ranges (
  id, score_table_id, score, male_min, male_max, female_min, female_max
)

-- 학생 기록
student_records (
  id, student_id, record_type_id, value, measured_at
)
-- UNIQUE KEY (student_id, record_type_id, measured_at) 하루 한 기록

-- 수업 기록
training_logs (
  id, date, student_id, trainer_id, condition_score, notes
)

-- 반 배치
daily_assignments (
  id, date, time_slot, student_id, trainer_id, class_id,
  paca_attendance_id, status, order_num
)
-- UNIQUE KEY uk_date_slot_student (date, time_slot, student_id)

-- 반별 강사 배치 (v2.0.0)
class_instructors (
  id, date, time_slot, class_num, instructor_id,
  is_main, order_num, created_at
)
-- UNIQUE KEY uk_slot_class_instructor (date, time_slot, class_num, instructor_id)

-- 운동 관리
exercises (id, name, tags JSON, default_sets, default_reps, description)
exercise_tags (id, tag_id, label, color, display_order, is_active)
exercise_packs (id, name, description, version, author)
exercise_pack_items (id, pack_id, exercise_id, display_order)

-- 수업 계획
daily_plans (
  id, date, time_slot, instructor_id, trainer_id,
  focus_areas, exercises JSON, notes
)
```

### P-ACA 연동 테이블 (paca DB)
```sql
-- 강사 스케줄
instructor_schedules (instructor_id, work_date, time_slot, academy_id)

-- 출근 체크
instructor_attendance (instructor_id, check_in_time, work_date, academy_id)

-- 강사 정보
instructors (id, name, user_id, academy_id)
-- name은 암호화됨 → decrypt() 필요

-- 학원 설정 (시간대 등)
academy_settings (
  academy_id, morning_class_time, afternoon_class_time, evening_class_time, ...
)
```

---

## API 엔드포인트

### 인증
| Method | Path | 설명 |
|--------|------|------|
| POST | `/peak/auth/login` | P-ACA 로그인 |

### 반 배치
| Method | Path | 설명 |
|--------|------|------|
| GET | `/peak/assignments?date=YYYY-MM-DD` | 반 배치 (v2.0.0: 반 중심 구조) |
| POST | `/peak/assignments/sync` | P-ACA 동기화 |
| PUT | `/peak/assignments/:id` | 학생 배치 변경 (class_id 지정) |
| POST | `/peak/assignments/instructor` | 강사 배치 (v2.0.0) |

### 기록 측정
| Method | Path | 설명 |
|--------|------|------|
| GET | `/peak/records/by-date?date=&student_ids=` | 날짜별 기록 조회 |
| POST | `/peak/records/batch` | 기록 일괄 저장 (UPSERT) |

### 수업 기록
| Method | Path | 설명 |
|--------|------|------|
| GET | `/peak/training?date=` | 수업 기록 조회 |
| PUT | `/peak/training/:id` | 컨디션/메모 저장 |

### 종목/배점표
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/peak/record-types` | 종목 CRUD |
| GET/POST | `/peak/score-tables` | 배점표 CRUD |

### 학생 프로필/통계
| Method | Path | 설명 |
|--------|------|------|
| GET | `/peak/students/:id/stats` | 학생 종합 통계 (점수, 추세 등) |
| GET | `/peak/students/:id/records` | 학생 전체 기록 (날짜별) |
| GET | `/peak/stats/academy-average` | 학원평균 (남/녀 분리) |

### 운동/팩
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/peak/exercises` | 운동 CRUD |
| GET/POST | `/peak/exercise-tags` | 태그 CRUD (admin) |
| GET/POST | `/peak/exercise-packs` | 팩 CRUD |
| GET | `/peak/exercise-packs/:id/export` | 팩 JSON 내보내기 |
| POST | `/peak/exercise-packs/import` | 팩 JSON 가져오기 |

---

## 버전 히스토리

### v3.0.0 (2025-12-23)
- **코드 품질 대규모 개선** (6단계 개선 계획 완료)
  - Phase 1: 테스트 인프라 구축 (Jest + React Testing Library)
  - Phase 2: UI 컴포넌트 라이브러리 (`src/components/ui/`)
  - Phase 3: 페이지 컴포넌트 분리 (exercises, records, students)
  - Phase 4: 에러 핸들링 시스템 (ErrorBoundary, useToast, Toast)
  - Phase 5: 백엔드 로깅 시스템 (Winston + Daily Rotate)
  - Phase 6: 문서화 (README.md, docs/API.md)
- **새 테스트 인프라**
  - Jest 설정 (`jest.config.js`, `jest.setup.js`)
  - 88개 테스트 케이스 작성
  - 테스트 유틸리티 (`src/test-utils/`)
- **새 UI 컴포넌트**
  - Button, Badge, Card, Input, Modal, Select, Spinner, Tabs
  - ErrorBoundary (에러 경계)
  - ToasterProvider (react-hot-toast)
- **에러 핸들링 개선**
  - `src/lib/constants/errors.ts` (에러 메시지 상수)
  - API 클라이언트 에러 처리 강화 (타임아웃, 오프라인 감지)
  - useToast 훅 (성공/에러/로딩 토스트)
- **백엔드 로깅**
  - Winston 로거 (`backend/utils/logger.js`)
  - 요청 로깅 미들웨어 (`backend/middleware/requestLogger.js`)
  - 일별 로그 파일 로테이션 (combined: 14일, error: 30일)
- **버그 수정**
  - 기록 측정 종목 선택 시 시간대 리셋 버그 (PC/태블릿/모바일)

### v2.0.0 (2025-12-23)
- **반 배치 시스템 전면 개편**
  - 강사 컬럼 → 반(Class) 중심 구조로 변경
  - 학생 + 강사 모두 드래그앤드롭 지원
  - 한 반에 여러 강사 배치 가능 (주강사 + 보조강사)
  - 자동 반 생성/삭제 (강사 드롭 시 생성, 빈 반 자동 삭제)
- **컴팩트 UI**
  - 학생 카드 1줄로 압축 (체험 표시 유지)
  - 강사는 칩 형태로 표시 (★ = 주강사)
  - 반 컬럼 너비 축소 (w-48)
- **새 DB 테이블**: `class_instructors` (반별 강사 배치)
- **새 API**: `POST /peak/assignments/instructor` (강사 배치)
- **PC, 태블릿 동시 적용**

### v1.9.0 (2025-12-23)
- **체험수업 연동 개선**
  - P-ACA `trial_dates` 배열 기반 총 횟수 계산
  - 표기: "체험 1/2" (완료/전체)
  - 모바일 페이지에 체험수업 배지 추가
- **원장 반배치 상시 표시**
  - 스케줄 등록 없이도 모든 시간대에 표시
  - 음수 ID 방식 (user_id 2 → trainer_id -2)
  - 강사와 구분하여 월급 계산 영향 없음
- **모바일 버그 수정**
  - API URL 중복 수정 (`/peak/peak` → `/peak`)
  - middleware 재활성화 (디바이스 자동 감지)

### v1.8.1 (2025-12-22)
- **모바일 버전 (강사용)** 구현
  - 3개 핵심 페이지: 기록측정, 수업계획, 수업기록
  - 스마트폰 (~400px) 최적화 UI
  - 하단 탭바 (3개)
  - 바텀시트 폼, 아코디언 UI
  - middleware.ts 모바일 감지 추가

### v1.8.0 (2025-12-22)
- **태블릿 버전 전면 구현** (아이뮤즈 L11, 11인치)
  - 10개 페이지 모두 태블릿 최적화
  - 세로/가로 모드 완전 지원 (OrientationContext)
  - 터치 친화적 UI (min-h-12, 큰 버튼, 풀스크린 모달)
  - 드래그앤드롭 터치 최적화 (TouchSensor, delay: 150ms)
  - middleware.ts로 디바이스 자동 감지 및 리다이렉트

### v1.7.x (2025-12-22)
- **v1.7.7**: 메뉴 구조 개선
  - 설정 → 실기측정설정 (측정종목 + 배점표만)
  - 운동 관리 별도 페이지 (`/exercises`)
  - 수업계획에서 운동 관리 버튼 추가
- **v1.7.6**: 추세 계산 개선 (5개 기록 + 처음↔마지막 가중치)
- **v1.7.5**: 차트 개선 (Y축 자동범위, 성별분리 평균, 종합평가 수정)
- **v1.7.4**: 종합평가 선택 종목 기준, 툴팁 한글화
- **v1.7.3**: 막대그래프 정규화, 기록없음 처리
- **v1.7.0**: **학생 프로필 페이지** (FM 스타일 대시보드)
  - 종목별 원형 게이지 (최대 6개, 종목 선택 가능)
  - 기록 추이 선 그래프 (Y축 자동범위, lower 종목 반전)
  - 학원평균 vs 학생 막대그래프 (성별 분리 평균)
  - 능력치 레이더 차트 (5각형)
  - 종합평가 (선택 종목 기준, 기록없는 종목 제외)
  - 추세 아이콘 (최근 5개 기록 기준, 부족시 "기록 부족")
- **CSV 기록 임포트**: `temp/import_records.py`

### v1.6.0 (2025-12-21)
- **용어 통일**: '코치' → '강사' 전체 변경
- **대시보드 시간대**: P-ACA 설정 연동 (하드코딩 제거)
- **드래그앤드롭**: `pointerWithin` 충돌감지로 정확도 개선
- **P-ACA 동기화**: 기존 배치(trainer_id) 유지하면서 동기화

### v1.5.x (2025-12-20)
- **v1.5.0**: 기록측정 UPSERT (하루 최고기록만 저장)
- **v1.5.1**: 반 배치 날짜 선택 기능
- **v1.5.2**: daily_assignments unique key 수정 (date, time_slot, student_id)

### v1.2.0 (2025-12-20)
- 학생 기록 그래프 UI (Recharts)
- 종목별 버튼 → 그래프 표시

### v1.1.x (2025-12-20)
- v1.1.0: 팩 불러오기 (운동 목록 교체)
- v1.1.1: 배점표 버그 수정
- v1.1.2: 기록측정/수업기록 시간대 탭
- v1.1.3: 기록측정 자동저장
- v1.1.4: 종목 줄임말 시스템

### v1.0.0 (2025-12-20)
- 태그/팩 동적 관리
- 학생 관리 개선 (탭별 인원수)

---

## 권한 체계

| 기능 | staff (강사) | owner (원장) | admin (시스템) |
|------|-------------|--------------|----------------|
| 설정 메뉴 | ❌ | ✅ | ✅ |
| 운동/팩 관리 | ❌ | ✅ | ✅ |
| **태그 관리** | ❌ | ❌ | ✅ |
| 수업 계획 (자기) | ✅ | ✅ | ✅ |
| 수업 계획 (전체) | ❌ | ✅ | ✅ |
| 기록 측정 (자기 반) | ✅ | ✅ | ✅ |
| 기록 측정 (전체) | ❌ | ✅ | ✅ |

---

## 개발 명령어

```bash
# 프론트 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# 백엔드 재시작
echo 'q141171616!' | sudo -S systemctl restart peak

# DB 접속
mysql -u paca -pq141171616! peak

# 로그 확인
echo 'q141171616!' | sudo -S journalctl -u peak -f
```

---

## 로그인 정보

- **이메일**: sean8320@naver.com
- **비밀번호**: q141171616!
- **역할**: admin (시스템 관리자)

---

## 태블릿 버전 (v1.8.0)

### 타겟 디바이스
- **아이뮤즈 L11** (11인치)
- 해상도: 2000×1200 (가로) / 1200×2000 (세로)
- 대상: 강사용 (PC와 동일 기능)

### 라우팅 구조
```
/src/app/
├── (pc)/                    # PC 버전 (기존, 루트 경로)
└── tablet/                  # 태블릿 버전 (/tablet/...)
    ├── layout.tsx           # 세로/가로 반응형 레이아웃
    ├── dashboard/page.tsx
    ├── attendance/page.tsx
    ├── assignments/page.tsx
    ├── plans/page.tsx
    ├── training/page.tsx
    ├── records/page.tsx
    ├── students/page.tsx
    ├── students/[id]/page.tsx
    ├── exercises/page.tsx
    └── settings/page.tsx
```

### 디바이스 감지 (middleware.ts)
```javascript
// User-Agent 기반 감지
// iPad, Android tablet, IMUZ → /tablet/...
// 그 외 → / (PC)
```

### 레이아웃 설계

**세로 모드 (1200×2000)**
- 상단 헤더 (h-16): 로고, 타이틀, 프로필
- 메인 콘텐츠: 스크롤
- 하단 탭바 (h-20): 대시보드, 반배치, 수업기록, 기록측정, 더보기

**가로 모드 (2000×1200)**
- 좌측 사이드바 (w-20): 축소형 네비게이션
- 상단 헤더 (h-14): 페이지 제목, 프로필
- 메인 콘텐츠: 넓은 영역

### 핵심 구현

**1. Orientation Context**
```javascript
// layout.tsx
const OrientationContext = createContext<'portrait' | 'landscape'>('portrait');
export const useOrientation = () => useContext(OrientationContext);
```

**2. 드래그앤드롭 터치 최적화**
```javascript
// TouchSensor with activation constraints
const sensors = useSensors(
  useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 5 }
  }),
  useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  })
);
```

**3. 터치 친화적 UI 가이드**
- 모든 버튼/터치 요소: `min-h-12` (48px)
- 입력 필드: `text-lg` 이상
- 모달: 풀스크린 (`inset-0`)
- 드래그 요소: `touch-action: none`

### 페이지별 특징

| 페이지 | 세로 모드 | 가로 모드 |
|--------|-----------|-----------|
| 대시보드 | 1컬럼 카드 | 2컬럼 그리드 |
| 반 배치 | 2컬럼 그리드 | 가로 스크롤 |
| 수업 기록 | 1컬럼 카드 | 2컬럼 그리드 |
| 기록 측정 | 1컬럼 카드 | 테이블형 |
| 학생 프로필 | 세로 스크롤 | 2컬럼 (정보+차트) |

---

## TODO

### 완료
- [x] 학생 프로필 페이지 (FM 스타일 대시보드)
- [x] 학생 기록에 점수 자동 계산 연동
- [x] 태블릿 버전 (v1.8.0) - 10개 페이지 전체
- [x] **모바일 버전 (강사용)** - 기록측정, 수업계획, 수업기록 (v1.8.1)
- [x] 체험수업 P-ACA 연동 (trial_dates 기반) (v1.9.0)
- [x] 원장 반배치 상시 표시 (v1.9.0)

### 우선순위 높음
- [ ] 학생 이름 클릭 → 프로필 페이지 연동 (각 페이지에서)
- [ ] 수업 기록 체크리스트 UI (계획된 운동 체크)

### 추가 기능
- [ ] 학생용 모바일 앱
- [ ] 부상 관리
- [ ] 알림 시스템
- [ ] 통계/분석 대시보드
