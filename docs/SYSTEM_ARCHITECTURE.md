# P-EAK 시스템 아키텍처

> **P**hysical **E**xcellence **A**chievement **K**eeper
> 체대입시 실기 훈련관리 시스템 v4.3.38

---

## 시스템 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           클라이언트                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  PC (/)          │  Tablet (/tablet)     │  Mobile (/mobile)           │
│  원장/관리자용    │  현장 강사용            │  강사 간편 기록용             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         프론트엔드                                       │
│  Next.js 16 + React 19 + TypeScript + TailwindCSS 4                    │
│  Vercel 자동 배포 (GitHub Push)                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          백엔드 API                                      │
│  Express.js 5 + Node.js + JWT 인증                                      │
│  Caddy → localhost:8330 (systemd: peak.service)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│         peak (메인 DB)         │   │     paca (P-ACA 연동 DB)       │
│         MySQL                 │   │         MySQL                 │
│  - 학생, 기록, 테스트          │←──│  - 학원, 사용자, 출결           │
│  - 수업계획, 훈련일지          │   │  - 강사 스케줄                  │
└───────────────────────────────┘   └───────────────────────────────┘
```

---

## 프론트엔드 페이지 구조

### PC 버전 (`/`)
| 경로 | 설명 | 주요 기능 |
|------|------|----------|
| `/dashboard` | 대시보드 | 오늘 출석, 통계 요약 |
| `/students` | 학생 관리 | 학생 목록, 검색, 필터 |
| `/students/[id]` | 학생 상세 | 개인 기록, 차트, 통계 |
| `/assignments` | 반 배치 | 드래그앤드롭 배치 |
| `/records` | 기록 측정 | 종목별 기록 입력 |
| `/plans` | 수업 계획 | 운동 계획 + 환경 체크 |
| `/training` | 수업 기록 | 학생별 컨디션/메모 |
| `/exercises` | 운동 관리 | 운동, 태그, 팩 관리 |
| `/monthly-test` | 월말테스트 | 테스트 목록 |
| `/monthly-test/[testId]` | 테스트 상세 | 세션 관리, 종목 설정 |
| `/monthly-test/[testId]/[sessionId]` | 조 편성 | 강사/학생 배치 |
| `/monthly-test/[testId]/[sessionId]/records` | 기록 측정 | 테스트 기록 입력 |
| `/monthly-test/[testId]/rankings` | 전체 순위 | 종목별/총점 순위 |
| `/attendance` | 출근 관리 | 강사 출근 체크 |
| `/settings` | 설정 | 종목, 배점표, 학원 설정 |

### Tablet 버전 (`/tablet`)
- PC와 동일한 구조
- 터치 최적화 UI (큰 버튼, 넓은 간격)

### Mobile 버전 (`/mobile`)
| 경로 | 설명 |
|------|------|
| `/records` | 기록 측정 (간편) |
| `/plans` | 수업 계획 |
| `/training` | 수업 기록 |

---

## 백엔드 API 구조

### 인증 (`/auth`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/login` | P-ACA 로그인 |
| GET | `/me` | 현재 사용자 정보 |

### 학생 (`/students`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 학생 목록 |
| GET | `/:id` | 학생 상세 |
| GET | `/:id/records` | 학생 기록 |
| GET | `/:id/stats` | 학생 통계 |
| POST | `/sync` | P-ACA 동기화 |
| GET | `/today` | 오늘 출석 학생 |
| GET | `/schedule` | 스케줄별 학생 |

### 기록 측정 (`/records`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 기록 조회 |
| POST | `/` | 기록 저장 |
| POST | `/batch` | 일괄 저장 (UPSERT) |
| GET | `/by-date` | 날짜별 기록 |
| GET | `/latest` | 최신 기록 |
| GET | `/stats/:student_id` | 개인 통계 |

### 기록 종목 (`/record-types`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 종목 목록 |
| POST | `/` | 종목 추가 |
| PUT | `/:id` | 종목 수정 |
| DELETE | `/:id` | 종목 삭제 |

### 배점표 (`/score-tables`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 배점표 목록 |
| GET | `/:id` | 배점표 상세 |
| GET | `/by-type/:recordTypeId` | 종목별 배점표 |
| POST | `/` | 배점표 생성 |
| PUT | `/ranges/:id` | 점수 구간 수정 |
| DELETE | `/:id` | 배점표 삭제 |
| POST | `/calculate` | 점수 계산 |

### 반 배치 (`/assignments`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 배치 조회 |
| POST | `/instructor` | 강사 배치 |
| PUT | `/:id` | 학생 배치 변경 |
| POST | `/sync` | P-ACA 출석 동기화 |
| GET | `/next-class-num` | 다음 반 번호 |
| GET | `/instructors` | 출근 강사 목록 |

### 수업 계획 (`/plans`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 계획 조회 |
| POST | `/` | 계획 생성 |
| PUT | `/:id` | 계획 수정 |
| DELETE | `/:id` | 계획 삭제 |
| PUT | `/:id/toggle-exercise` | 운동 완료 토글 |
| POST | `/:id/extra-exercise` | 추가 운동 |
| PUT | `/:id/conditions` | 환경 체크 |

### 수업 기록 (`/training`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 훈련일지 조회 |
| POST | `/` | 훈련일지 생성 |
| PUT | `/:id` | 훈련일지 수정 |
| PUT | `/conditions/:date` | 컨디션 일괄 저장 |

### 운동 관리 (`/exercises`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 운동 목록 |
| GET | `/:id` | 운동 상세 |
| POST | `/` | 운동 추가 |
| PUT | `/:id` | 운동 수정 |
| DELETE | `/:id` | 운동 삭제 |

### 운동 태그 (`/exercise-tags`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 태그 목록 |
| GET | `/all` | 전체 태그 (시스템 포함) |
| POST | `/` | 태그 추가 |
| PUT | `/:id` | 태그 수정 |
| DELETE | `/:id` | 태그 삭제 |

### 운동 팩 (`/exercise-packs`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 팩 목록 |
| GET | `/:id` | 팩 상세 |
| POST | `/` | 팩 생성 |
| PUT | `/:id` | 팩 수정 |
| DELETE | `/:id` | 팩 삭제 |
| GET | `/:id/export` | 팩 내보내기 (JSON) |
| POST | `/import` | 팩 가져오기 |
| POST | `/:id/apply` | 팩 적용 |

### 월말테스트 (`/monthly-tests`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 테스트 목록 |
| GET | `/:id` | 테스트 상세 |
| POST | `/` | 테스트 생성 |
| PUT | `/:id` | 테스트 수정 |
| DELETE | `/:id` | 테스트 삭제 |
| GET | `/:id/export` | 엑셀 다운로드 |
| POST | `/:testId/sessions` | 세션 추가 |
| GET | `/:testId/sessions` | 세션 목록 |
| GET | `/:testId/all-records` | 전체 기록 |
| GET | `/:testId/conflicts` | 종목 충돌 설정 |
| POST | `/:testId/conflicts` | 충돌 추가 |
| PUT | `/:testId/conflicts` | 충돌 일괄 수정 |

### 테스트 세션 (`/test-sessions`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| DELETE | `/:sessionId` | 세션 삭제 |
| GET | `/:sessionId/groups` | 조 편성 조회 |
| POST | `/:sessionId/groups` | 조 생성 |
| DELETE | `/:sessionId/groups/:groupId` | 조 삭제 |
| POST | `/:sessionId/supervisor` | 감독관 배치 |
| PUT | `/:sessionId/participants/:participantId` | 참가자 배치 변경 |
| POST | `/:sessionId/participants/sync` | 재원생 동기화 |
| GET | `/:sessionId/available-students` | 추가 가능 학생 |
| POST | `/:sessionId/participants` | 참가자 추가 |
| DELETE | `/:sessionId/participants/:participantId` | 참가자 삭제 |
| GET | `/:sessionId/records` | 기록 조회 |
| POST | `/:sessionId/records/batch` | 기록 일괄 저장 |
| DELETE | `/:sessionId/records` | 기록 전체 삭제 |

### 테스트 신규 지원자 (`/test-applicants`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 지원자 목록 |
| POST | `/` | 지원자 추가 |
| PUT | `/:id` | 지원자 수정 |
| DELETE | `/:id` | 지원자 삭제 |
| POST | `/:id/convert` | 학생으로 전환 |
| GET | `/rest-students` | 휴원생 목록 |

### 전광판 (공개) (`/public-board`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/:slug` | 전광판 데이터 |
| GET | `/:slug/scores` | 점수 데이터 |

### 통계 (`/stats`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/academy-average` | 학원 평균 |
| GET | `/leaderboard/:recordTypeId` | 종목별 리더보드 |

### 출근 관리 (`/attendance`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 출근 기록 |
| GET | `/current` | 현재 출근 상태 |
| POST | `/checkin` | 출근 체크 |

### 강사 (`/trainers`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 강사 목록 |
| GET | `/:id` | 강사 상세 |
| POST | `/` | 강사 추가 |

### 알림 (`/notifications`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 알림 목록 |
| PUT | `/:id/read` | 읽음 처리 |
| PUT | `/read-all` | 전체 읽음 |
| GET | `/check` | 새 알림 체크 |

### 푸시 알림 (`/push`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/vapid-public-key` | VAPID 키 |
| POST | `/subscribe` | 구독 |
| DELETE | `/subscribe` | 구독 취소 |
| GET | `/subscriptions` | 구독 목록 |
| POST | `/test` | 테스트 알림 |

### 학원 설정 (`/peak-settings`)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 설정 조회 |
| POST | `/` | 설정 저장 |

---

## 데이터베이스 스키마

### 핵심 테이블 관계도

```
                    ┌─────────────────┐
                    │   academies     │ (P-ACA)
                    │   (학원)        │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    students     │ │  record_types   │ │ monthly_tests   │
│    (학생)       │ │   (측정종목)     │ │  (월말테스트)    │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         │         ┌─────────┴─────────┐         │
         │         │                   │         │
         ▼         ▼                   ▼         ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│    student_records      │   │    test_sessions        │
│    (학생 기록)           │   │    (테스트 세션)         │
│ ┌─────────────────────┐ │   └───────────┬─────────────┘
│ │ student_id (FK)     │ │               │
│ │ record_type_id (FK) │ │    ┌──────────┼──────────┐
│ │ value               │ │    │          │          │
│ │ measured_at         │ │    ▼          ▼          ▼
│ └─────────────────────┘ │  ┌──────┐ ┌────────┐ ┌────────┐
└─────────────────────────┘  │groups│ │partici-│ │records │
                             │(조)  │ │pants   │ │(기록)  │
                             └──────┘ └────────┘ └────────┘

┌─────────────────────────────────────────────────────────┐
│                    수업 관리 영역                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  daily_assignments ◄───► daily_plans ◄───► training_logs│
│     (반 배치)              (수업 계획)       (훈련 일지)   │
│                                │                        │
│                                ▼                        │
│                          exercises                      │
│                           (운동)                        │
│                                │                        │
│                    ┌───────────┴───────────┐            │
│                    ▼                       ▼            │
│              exercise_tags          exercise_packs      │
│               (운동 태그)              (운동 팩)          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 테이블별 상세

#### students (학생)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 학생 ID |
| academy_id | INT | 학원 ID |
| paca_student_id | INT | P-ACA 학생 ID (연동) |
| name | VARCHAR | 이름 |
| gender | ENUM('M','F') | 성별 |
| phone | VARCHAR | 연락처 |
| school | VARCHAR | 학교 |
| grade | VARCHAR | 학년 |
| status | ENUM | active/paused/trial/graduated |
| is_trial | TINYINT | 체험 여부 |

#### record_types (측정 종목)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 종목 ID |
| academy_id | INT | 학원 ID |
| name | VARCHAR | 종목명 |
| short_name | VARCHAR | 약칭 |
| unit | VARCHAR | 단위 (cm, m, sec 등) |
| direction | ENUM | higher/lower (높을수록/낮을수록 좋음) |
| is_active | TINYINT | 활성화 여부 |

#### student_records (학생 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 기록 ID |
| academy_id | INT | 학원 ID |
| student_id | INT FK | 학생 ID |
| record_type_id | INT FK | 종목 ID |
| value | DECIMAL | 기록 값 |
| measured_at | DATE | 측정 날짜 |
| **UNIQUE** | | (student_id, record_type_id, measured_at) |

#### monthly_tests (월말테스트)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 테스트 ID |
| academy_id | INT | 학원 ID |
| test_month | VARCHAR | 테스트 월 (2026-01) |
| test_name | VARCHAR | 테스트명 |
| status | ENUM | draft/active/completed |

#### test_sessions (테스트 세션)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 세션 ID |
| monthly_test_id | INT FK | 월말테스트 ID |
| test_date | DATE | 테스트 날짜 |
| time_slot | ENUM | morning/afternoon/evening |

#### test_participants (참가자)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 참가자 ID |
| test_session_id | INT FK | 세션 ID |
| test_group_id | INT FK | 조 ID (nullable) |
| student_id | INT FK | 재원생 ID (nullable) |
| test_applicant_id | INT | 신규지원자 ID (nullable) |
| participant_type | ENUM | enrolled/rest/trial/test_new |

#### test_records (테스트 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 기록 ID |
| test_session_id | INT FK | 세션 ID |
| student_id | INT | 재원생 ID (nullable) |
| test_applicant_id | INT | 신규지원자 ID (nullable) |
| record_type_id | INT FK | 종목 ID |
| value | DECIMAL | 기록 값 |
| measured_at | DATE | 측정 날짜 |

#### daily_assignments (반 배치)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 배치 ID |
| date | DATE | 날짜 |
| time_slot | ENUM | morning/afternoon/evening |
| student_id | INT FK | 학생 ID |
| trainer_id | INT | 강사 ID |
| class_id | INT | 반 번호 |
| status | ENUM | present/absent/late |

#### daily_plans (수업 계획)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 계획 ID |
| date | DATE | 날짜 |
| time_slot | ENUM | 시간대 |
| trainer_id | INT | 강사 ID |
| exercises | JSON | 운동 목록 |
| completed_exercises | JSON | 완료 운동 |
| extra_exercises | JSON | 추가 운동 |
| conditions_checked | TINYINT | 환경 체크 여부 |
| temperature | DECIMAL | 온도 |
| humidity | INT | 습도 |

#### training_logs (훈련 일지)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 일지 ID |
| date | DATE | 날짜 |
| student_id | INT FK | 학생 ID |
| trainer_id | INT | 강사 ID |
| plan_id | INT FK | 계획 ID |
| condition_score | TINYINT | 컨디션 점수 (1-5) |
| notes | TEXT | 메모 |

#### exercises (운동)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 운동 ID |
| academy_id | INT | 학원 ID (null=시스템) |
| is_system | TINYINT | 시스템 기본 운동 |
| name | VARCHAR | 운동명 |
| tags | JSON | 태그 배열 |
| default_sets | INT | 기본 세트 |
| default_reps | INT | 기본 횟수 |
| video_url | VARCHAR | 영상 링크 |

#### exercise_packs (운동 팩)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | 팩 ID |
| academy_id | INT | 학원 ID |
| name | VARCHAR | 팩 이름 |
| description | TEXT | 설명 |
| snapshot_data | JSON | 운동+태그 스냅샷 |

---

## P-ACA 연동

### 연동 테이블 (paca DB)
| 테이블 | 용도 |
|--------|------|
| `academies` | 학원 정보 |
| `users` | 사용자 (로그인) |
| `students` | 학생 정보 (암호화) |
| `instructors` | 강사 정보 |
| `instructor_schedules` | 강사 출근 스케줄 |
| `instructor_attendance` | 강사 출근 기록 |
| `test_applicants` | 테스트 신규 지원자 |

### 동기화 흐름
```
P-ACA (paca DB)                    P-EAK (peak DB)
─────────────────                  ─────────────────
students (active) ─────sync─────→ students
instructors ───────────────────→ 강사 배치에 사용
instructor_attendance ─────────→ 출근 상태 확인
test_applicants ───────────────→ 월말테스트 신규 참가자
```

### 암호화
- P-ACA의 `name`, `phone`은 `ENC:` 접두사로 암호화
- `/backend/utils/encryption.js`의 `decrypt()` 사용

---

## 백업 시스템

### DB 트리거 (자동 백업)
```sql
-- student_records 삭제 시 자동 백업
TRIGGER before_student_records_delete
→ student_records_backup 테이블로 복사

-- test_records 삭제 시 자동 백업
TRIGGER before_test_records_delete
→ test_records_backup 테이블로 복사
```

### 백업 테이블
| 테이블 | 원본 테이블 |
|--------|------------|
| `student_records_backup` | `student_records` |
| `test_records_backup` | `test_records` |

---

## 권한 시스템

| 기능 | staff | owner | admin |
|------|-------|-------|-------|
| 설정 메뉴 | ❌ | ✅ | ✅ |
| 운동/팩 관리 | ❌ | ✅ | ✅ |
| 태그 관리 | ❌ | ❌ | ✅ |
| 기록 측정 (전체) | ❌ | ✅ | ✅ |
| 수업 계획 (전체) | ❌ | ✅ | ✅ |
| 엑셀 다운로드 | ✅ | ✅ | ✅ |

---

## 배포 구조

```
GitHub (main branch)
         │
         │ push
         ▼
    ┌─────────┐
    │  Vercel │ ← 프론트엔드 자동 배포
    └─────────┘

로컬 서버 (N100)
         │
    ┌────┴────┐
    │  Caddy  │ ← 리버스 프록시 (HTTPS)
    └────┬────┘
         │
    ┌────┴────┐
    │  peak   │ ← systemd 서비스 (localhost:8330)
    └─────────┘
```

### 배포 명령어
```bash
# 프론트엔드
git push  # → Vercel 자동 배포

# 백엔드
sudo systemctl restart peak
```

---

## 환경 변수

### 프론트엔드 (.env.local)
```
NEXT_PUBLIC_API_URL=https://peak-api.sean8320.dedyn.io
```

### 백엔드 (환경변수)
```
PORT=8330
DB_HOST=localhost
DB_USER=paca
DB_PASSWORD=***
DB_NAME=peak
PACA_DB_NAME=paca
JWT_SECRET=***
```

---

*최종 업데이트: 2026-01-14 (v4.3.38)*
