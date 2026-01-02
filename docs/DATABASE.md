# P-EAK Database Schema

> Last Updated: 2025-01-02 | Version: v4.3.9

---

## Overview

P-EAK은 `peak` 데이터베이스를 사용하며, P-ACA(`paca`)와 연동됩니다.

```
┌─────────────────────────────────────────────────────────────┐
│                        P-EAK (peak)                         │
├─────────────────────────────────────────────────────────────┤
│  학생관리    │  기록측정    │  수업관리    │  월말테스트   │
│  students    │  records     │  assignments │  monthly_test │
└──────┬───────┴──────────────┴───────┬──────┴───────────────┘
       │                              │
       │  paca_student_id             │  instructor_id
       ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        P-ACA (paca)                         │
├─────────────────────────────────────────────────────────────┤
│  students    │  instructors  │  instructor_schedules        │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Tables

### students
> P-ACA 학생 동기화 데이터

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | |
| `academy_id` | INT | 학원 ID (default: 2) |
| `paca_student_id` | INT UK | P-ACA students.id |
| `name` | VARCHAR(100) | 이름 (복호화됨) |
| `gender` | ENUM('M','F') | 성별 |
| `phone` | VARCHAR(20) | 전화번호 |
| `school` | VARCHAR(100) | 학교 |
| `grade` | VARCHAR(20) | 학년 |
| `class_days` | JSON | 수업 요일 [1,3,5] |
| `is_trial` | TINYINT | 체험생 여부 |
| `trial_total` | INT | 체험 총 횟수 |
| `trial_remaining` | INT | 체험 남은 횟수 |
| `status` | ENUM | active, paused, pending |

```sql
UNIQUE KEY uk_academy_paca (academy_id, paca_student_id)
```

---

### record_types
> 측정 종목 정의

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | |
| `name` | VARCHAR(100) | 종목명 (제자리멀리뛰기) |
| `short_name` | VARCHAR(20) | 줄임말 (제멀) |
| `unit` | VARCHAR(20) | 단위 (cm, 초, m) |
| `direction` | ENUM | `higher`: 높을수록 좋음, `lower`: 낮을수록 좋음 |
| `is_active` | TINYINT | 활성화 여부 |
| `display_order` | INT | 표시 순서 |

---

### student_records
> 학생 측정 기록 (하루 한 종목당 최고 기록만)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | |
| `student_id` | INT FK | students.id |
| `record_type_id` | INT FK | record_types.id |
| `measured_at` | DATE | 측정 날짜 |
| `value` | DECIMAL(10,2) | 측정값 |
| `notes` | TEXT | 메모 |

```sql
UNIQUE KEY (student_id, record_type_id, measured_at)
```

---

### score_tables + score_ranges
> 배점표 시스템

**score_tables**
| Column | Type | Description |
|--------|------|-------------|
| `record_type_id` | INT UK | 종목 (1:1) |
| `max_score` | INT | 최고점 (100) |
| `min_score` | INT | 최저점 (50) |
| `decimal_places` | TINYINT | 소수점 자리수 |
| `male_perfect` | DECIMAL | 남자 만점 기준 |
| `female_perfect` | DECIMAL | 여자 만점 기준 |

**score_ranges**
| Column | Type | Description |
|--------|------|-------------|
| `score_table_id` | INT FK | |
| `score` | INT | 점수 (100, 95, 90...) |
| `male_min/max` | DECIMAL | 남자 범위 |
| `female_min/max` | DECIMAL | 여자 범위 |

---

## Assignment Tables

### daily_assignments
> 일별 반 배치 (학생-반 매핑)

| Column | Type | Description |
|--------|------|-------------|
| `date` | DATE | 날짜 |
| `time_slot` | ENUM | morning, afternoon, evening |
| `student_id` | INT FK | |
| `class_id` | INT | 반 번호 (1, 2, 3...) |
| `trainer_id` | INT | P-ACA instructor_id (레거시) |
| `status` | ENUM | enrolled, trial, rest, injury |
| `order_num` | INT | 드래그 순서 |

```sql
UNIQUE KEY uk_date_slot_student (date, time_slot, student_id)
```

---

### class_instructors
> 반별 강사 배치 (v2.0.0+)

| Column | Type | Description |
|--------|------|-------------|
| `date` | DATE | |
| `time_slot` | ENUM | |
| `class_num` | INT | 반 번호 |
| `instructor_id` | INT | P-ACA instructor_id |
| `is_main` | TINYINT | 주강사 여부 |
| `order_num` | INT | 표시 순서 |

```sql
UNIQUE KEY uk_slot_class_instructor (date, time_slot, class_num, instructor_id)
```

---

## Training Tables

### daily_plans
> 수업 계획

| Column | Type | Description |
|--------|------|-------------|
| `date` | DATE | |
| `time_slot` | ENUM | |
| `trainer_id` | INT | P-ACA instructor_id |
| `tags` | JSON | 훈련 태그 ["하체파워", "민첩성"] |
| `exercises` | JSON | 운동 목록 |
| `completed_exercises` | JSON | 완료된 운동 |
| `temperature` | DECIMAL(4,1) | 체육관 온도 |
| `humidity` | INT | 습도(%) |

---

### training_logs
> 수업 기록 (학생별)

| Column | Type | Description |
|--------|------|-------------|
| `date` | DATE | |
| `student_id` | INT FK | |
| `trainer_id` | INT | P-ACA instructor_id |
| `plan_id` | INT FK | daily_plans.id |
| `condition_score` | TINYINT | 컨디션 1~5 |
| `notes` | TEXT | 개인 메모 |

---

## Exercise Tables

### exercises
> 운동 정의

| Column | Type | Description |
|--------|------|-------------|
| `name` | VARCHAR(100) | 운동명 |
| `tags` | JSON | 태그 ID 배열 |
| `default_sets` | INT | 기본 세트 수 |
| `default_reps` | INT | 기본 반복 수 |
| `is_system` | TINYINT | 시스템 기본 여부 |

### exercise_tags
> 운동 태그 (관리자 전용)

| Column | Type | Description |
|--------|------|-------------|
| `tag_id` | VARCHAR(50) UK | 고유 ID (power, agility) |
| `label` | VARCHAR(50) | 표시명 (하체파워) |
| `color` | VARCHAR(100) | Tailwind 색상 |

### exercise_packs
> 운동 팩 (세트 묶음)

| Column | Type | Description |
|--------|------|-------------|
| `name` | VARCHAR(100) | 팩 이름 |
| `snapshot_data` | JSON | 내보내기용 스냅샷 |

---

## Monthly Test Tables

### monthly_tests
> 월말테스트 정의

| Column | Type | Description |
|--------|------|-------------|
| `test_month` | VARCHAR(7) | 2025-01 |
| `test_name` | VARCHAR(100) | 1월 월말테스트 |
| `status` | ENUM | draft, active, completed |

### test_sessions
> 테스트 세션 (날짜/시간대별)

### test_groups
> 테스트 조 편성

### test_participants
> 참가자 목록 (재원생 + 체험생 + 신규)

### test_records
> 테스트 기록

---

## P-ACA Integration

### 연동 테이블 (읽기 전용)

```sql
-- 강사 스케줄
paca.instructor_schedules (instructor_id, work_date, time_slot)

-- 출근 체크
paca.instructor_attendance (instructor_id, check_in_time, work_date)

-- 강사 정보 (이름 암호화됨)
paca.instructors (id, name, user_id)

-- 학원 설정 (시간대)
paca.academy_settings (morning_class_time, afternoon_class_time, evening_class_time)
```

### 암호화

P-ACA의 `name`, `phone` 필드는 `ENC:` 접두사로 암호화됨.
`backend/utils/encryption.js`의 `decrypt()` 함수로 복호화.
