# P-EAK (피크)

> **P**hysical **E**xcellence **A**chievement **K**eeper
> 체대입시 실기 훈련관리 시스템

**Version**: v4.3.9 | **Port**: 8330

---

## Quick Reference

### Commands
```bash
# 개발
npm run dev

# 빌드 & 배포
npm run build && git add -A && git commit -m "..." && git push

# 백엔드 재시작
echo 'q141171616!' | sudo -S systemctl restart peak

# 로그 확인
echo 'q141171616!' | sudo -S journalctl -u peak -f

# DB 접속
mysql -u paca -pq141171616! peak
```

### 버전 업데이트 위치
- `package.json` → `"version"`
- `src/app/(pc)/layout.tsx` → `APP_VERSION`
- `src/app/tablet/layout.tsx` → `APP_VERSION`
- `src/app/mobile/layout.tsx` → `APP_VERSION`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  Next.js 16 + React 19 + TailwindCSS 4 + Recharts          │
├─────────────────────────────────────────────────────────────┤
│  PC (/)  │  Tablet (/tablet)  │  Mobile (/mobile)          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Backend                                │
│  Express.js 5 + MySQL (mysql2) + JWT                       │
│  Caddy → localhost:8330 (peak.service)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Database                               │
│  peak (메인) ←→ paca (P-ACA 연동)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
ilsanmaxtraining/
├── src/
│   ├── app/
│   │   ├── (pc)/           # PC 버전 (기본)
│   │   ├── tablet/         # 태블릿 버전
│   │   ├── mobile/         # 모바일 버전 (강사용)
│   │   └── login/
│   ├── components/
│   │   ├── ui/             # 공통 UI 컴포넌트
│   │   └── students/       # 학생 관련 컴포넌트
│   └── lib/
│       └── api/            # API 클라이언트
├── backend/
│   ├── peak.js             # 메인 서버
│   ├── routes/             # API 라우트 (20개)
│   ├── middleware/
│   └── utils/
│       └── encryption.js   # P-ACA 암호화 처리
└── docs/
    ├── API.md              # API 명세서
    └── DATABASE.md         # DB 스키마
```

---

## Core Features

| 기능 | 설명 | 페이지 |
|------|------|--------|
| **반 배치** | 학생/강사 드래그앤드롭 배치 | /assignments |
| **기록 측정** | 종목별 기록 입력 (UPSERT) | /records |
| **수업 계획** | 운동 계획 + 환경 체크 | /plans |
| **수업 기록** | 학생별 컨디션/메모 | /training |
| **월말테스트** | 테스트 세션 + 조편성 + 기록 | /monthly-test |
| **학생 프로필** | 종합 통계 + 차트 | /students/[id] |

---

## P-ACA Integration

```
P-ACA (paca DB)                    P-EAK (peak DB)
─────────────────                  ─────────────────
students ──────────────────────→ students (sync)
instructors ───────────────────→ 강사 배치
instructor_schedules ──────────→ 출근 스케줄
instructor_attendance ─────────→ 출근 상태
academy_settings ──────────────→ 시간대 설정
```

### 동기화 API
- `POST /peak/students/sync` - 학생 동기화 (active, paused, trial, pending만)
- `POST /peak/assignments/sync` - 출석 동기화

### 암호화
P-ACA `name`, `phone`은 `ENC:` 접두사로 암호화됨
→ `backend/utils/encryption.js`의 `decrypt()` 사용

---

## Key Implementation Details

### 1. 기록 측정 UPSERT
```javascript
// 하루에 한 종목당 최고 기록만 저장
// direction: 'higher' → 높을수록 좋음 (멀리뛰기)
// direction: 'lower' → 낮을수록 좋음 (달리기)
POST /peak/records/batch
```

### 2. 반 배치 시스템 (v2.0.0)
- 반(Class) 중심 구조
- 한 반에 여러 강사 배치 가능 (주강사 + 보조)
- dnd-kit: `pointerWithin` 충돌감지

### 3. 원장 표시
- 원장은 P-ACA `instructors`에 없음 (월급 대상 아님)
- `users` 테이블의 `id`를 음수로 변환 (user_id 2 → trainer_id -2)

### 4. 태블릿 감지
- middleware.ts: User-Agent 기반 리다이렉트
- PC layout: 클라이언트 사이드 fallback (터치 + 화면 크기)

---

## Database

> 상세: [docs/DATABASE.md](docs/DATABASE.md)

### 핵심 테이블
| 테이블 | 설명 |
|--------|------|
| `students` | 학생 (P-ACA sync) |
| `record_types` | 측정 종목 |
| `student_records` | 학생 기록 |
| `score_tables` + `score_ranges` | 배점표 |
| `daily_assignments` | 학생 반배치 |
| `class_instructors` | 강사 반배치 |
| `daily_plans` | 수업 계획 |
| `training_logs` | 수업 기록 |
| `monthly_tests` + `test_sessions` | 월말테스트 |

### UNIQUE KEY
```sql
students: uk_academy_paca (academy_id, paca_student_id)
student_records: (student_id, record_type_id, measured_at)
daily_assignments: uk_date_slot_student (date, time_slot, student_id)
```

---

## API

> 상세: [docs/API.md](docs/API.md)

### 주요 엔드포인트
| Method | Path | 설명 |
|--------|------|------|
| POST | `/auth/login` | P-ACA 로그인 |
| GET/POST | `/students` | 학생 CRUD |
| POST | `/students/sync` | P-ACA 동기화 |
| GET | `/assignments` | 반배치 조회 |
| POST | `/records/batch` | 기록 일괄 저장 |
| GET | `/students/:id/stats` | 학생 통계 |

---

## Permissions

| 기능 | staff | owner | admin |
|------|-------|-------|-------|
| 설정 메뉴 | ❌ | ✅ | ✅ |
| 운동/팩 관리 | ❌ | ✅ | ✅ |
| 태그 관리 | ❌ | ❌ | ✅ |
| 기록 측정 (전체) | ❌ | ✅ | ✅ |
| 수업 계획 (전체) | ❌ | ✅ | ✅ |

---

## Login

```
Email: sean8320@naver.com
Password: q141171616!
Role: admin
```
