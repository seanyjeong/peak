# peak DB-SCHEMA

MySQL `peak` (n100 primary, vultr sync 복제). **36 테이블**. user=`paca` (env reuse).

## 학생 / 측정
| 테이블 | 역할 |
|---|---|
| `students` | 학생 로컬 캐시 (`paca_student_id` → paca.students.id) |
| `student_records` | 종목 기록 (student_id, record_type_id, measured_at, value) |
| `student_records_backup` / `_old` | 백업본 |
| `student_videos` | 학생 영상 |
| `record_types` | 종목 정의 (cm/m/sec/kg · direction higher/lower) |
| `record_type_conflicts` | 종목 충돌 정책 |

## 운동 라이브러리
| 테이블 | 역할 |
|---|---|
| `exercises` | 운동 정의 |
| `exercise_tags` | 태그 |
| `exercise_packs` | preset 팩 |
| `exercise_pack_items` | 팩 아이템 |

## 반 배치 / 출결
| 테이블 | 역할 |
|---|---|
| `class_instructors` | 반 담당 강사 |
| `class_presets` | 반 preset |
| `preset_groups` / `preset_group_members` | preset 그룹 |
| `daily_plans` | 일일 수업 계획 |
| `daily_assignments` | 일일 반 배치 |
| `daily_attendance` | **출석** (checked_at IS NOT NULL = 체크완료!) |
| `session_schedules` | 세션 스케줄 |
| `training_logs` | 개인 훈련 일지 |

## 월말 테스트
| 테이블 | 역할 |
|---|---|
| `monthly_tests` | 월말 테스트 |
| `monthly_test_types` | 종목 |
| `monthly_test_records` | 기록 |
| `test_sessions` | 회차 |
| `test_participants` | 참가자 |
| `test_records` / `_backup` | 기록 |
| `test_groups` | 그룹 |
| `test_group_supervisors` | 감독관 |

## 점수표
| `score_tables` | 점수표 |
| `score_ranges` | 점수 구간 |

## 기타
| `peak_settings` | 학원별 설정, 전광판 slug, 전광판 PIN 해시 |
| `academy_feature_permissions` | 학원별 강사 기능 권한 |
| `trainers` | 강사 |
| `push_subscriptions` | 웹푸시 |
| `notifications` | 알림 |
| `deletion_logs` | 삭제 감사 |

`peak_settings.board_pin_hash`는 전광판 PIN 해시만 저장한다. 운영 DB에는 `database/peak-board-pin.sql`을 적용해 컬럼을 추가한다.

## Cross-DB (paca)
peak 백엔드가 **paca DB 읽기** (users 인증/학원 정보):
```js
const pacaPool = mysql.createPool({ host: PACA_DB_HOST, user: PACA_DB_USER, database: 'paca' });
// users 테이블 조회
```

- `paca.users` → pacapro 발급 JWT 검증 용
- `paca.academies` → academy_id 교차 참조
- `paca.students` → `peak.students.paca_student_id` 역참조

⚠️ peak 에서 `paca` DB **쓰기 금지** (drift 원흉)

## 핵심 JOIN
```sql
-- 학생 + 최근 기록 20건
SELECT rt.name, sr.measured_at, sr.value
FROM student_records sr
JOIN record_types rt ON rt.id = sr.record_type_id
WHERE sr.student_id = ? AND sr.academy_id = ?
ORDER BY sr.measured_at DESC LIMIT 20;

-- 월말 순위
SELECT tp.student_id, SUM(tr.calculated_score) AS total
FROM test_participants tp
JOIN test_records tr ON tr.test_id = tp.monthly_test_id AND tr.participant_id = tp.id
WHERE tp.academy_id = ? AND tp.monthly_test_id = ?
GROUP BY tp.student_id ORDER BY total DESC;
```

## 인덱스 전략
- `academy_id` 대부분 첫 번째 (multi-tenant 필터)
- `(student_id, record_type_id, measured_at)` — 시계열 쿼리
- `(academy_id, measured_at)` — 학원 통계

## 암호화
- `students.name` 등 민감 필드 `DATA_ENCRYPTION_KEY` 로 AES
- 평문 로그 금지
