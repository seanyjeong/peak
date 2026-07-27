# peak BUSINESS-LOGIC

## 도메인
체대입시 학생 실기 기록/훈련/테스트 관리. 학원별 multi-tenant. Socket.io 실시간 공유.

## 출결 해석 (자주 틀림!)
- `daily_attendance` 테이블의 `checked_at IS NOT NULL` = **체크인 완료**
- `COUNT(DISTINCT att.id)` ≠ 체크완료 수 (row 존재는 예약만 돼도 생김)
- 과거 오판 기록: `cap-20260411-190412-9502`

## 측정 기록 (student_records) — 일상 측정 전용
- `record_type_id` 로 종목 식별
- `measured_at` (DATE) — 측정일
- `value` (DECIMAL) — 값
- `direction` higher/lower 로 정렬/평가
- **월말 입력과 저장 분리** (같은 날이어도 서로 덮어쓰지 않음)

## 월말 테스트 파이프라인
1. 원장이 `monthly_test` 생성 + 종목 (`monthly_test_types`)
2. `test_sessions` 회차 생성
3. `test_participants` 학생 배정
4. 실기 당일 **`test_records` 기록** (재원생·테스트신규 모두)
   - `test_records.student_id` 또는 `test_applicant_id` + `test_session_id`
   - 일반 측정 `student_records` 와 저장 분리
5. `score_tables` + `score_ranges` 로 점수 계산 → `calculated_score`
6. 순위 산정

## 학생 프로필 그래프/히스토리
- 조회 시 `student_records`(일상) + `test_records`(월말, student_id) **합산 표시**
- 같은 날 둘 다 있으면 둘 다 노출 (월말 라벨)
- 최고/최신 통계에도 월말 기록 포함

## 반 배치 시스템
- 원장이 `daily_plans` 로 하루 수업 계획
- `daily_assignments` 로 학생을 반에 배정
- `daily_attendance` 에 실제 출석 체크
- `class_instructors` 로 담당 강사 지정
- Socket.io `record:new` 이벤트로 실시간 공유

## 인증
- **pacapro 에서 발급한 JWT 사용** — secret 공유
- verifyToken 미들웨어가 payload 에서 `academy_id`, `user_id`, `role` 추출
- Socket.io 는 handshake auth.token 에서 동일 JWT 검증

## Multi-tenant 격리
- 모든 쿼리 `WHERE academy_id = ?` 필수
- Socket.io Room `academy_{id}` 분리
- Cross-academy 데이터 유출 = 치명적 버그

## 암호화
- `students.name` 등 민감 필드 AES (DATA_ENCRYPTION_KEY)
- pacapro 와 동일 키 — 둘 다 암/복호화 가능
- **로그에 복호화된 값 찍지 말 것**

## 웹푸시
- VAPID 기반, `push_subscriptions` 구독 저장
- 출결 체크 / 새 기록 / 월말 결과 등 자동 발송

## 모바일 API (`/peak/mobile`)
- 강사 모바일 앱 전용
- 간소화된 페이로드

## 자주 틀리는 함정
- 출결 해석 (위)
- JWT 만료 → Socket.io 연결 거부 (cap-20260411-201258-23255)
- `paca_student_id` orphan (paca 에서 학생 삭제 시 peak 에 남음) — 주기 sync 필요
- `academy_id` 누락 → 타 학원 노출
- 월말 테스트 점수 계산 시 score_tables direction 방향 오류

## 페일오버 시 주의
- 페일오버 중 Socket.io 재연결 → `academy_*` room 재입장 필요
- 세션 마이그레이션 없음 — 클라이언트 재연결 로직이 처리
