# Gap Analysis: Student Direct Read (student-direct-read)

> Generated: 2026-02-14
> Design: docs/02-design/features/student-direct-read.design.md
> Phase: Check

## Match Rate: 85%

```
[Plan] ✅ → [Design] ✅ → [Do] ✅ → [Check] 🔄 85% → [Act] ⏳
```

## 1. Route Migration Status

| Route File | Design Section | Status | Detail |
|-----------|:-------------:|:------:|--------|
| paca-student.js | 2 (Helper) | ✅ | decrypt + gender convert + aliased fields |
| students.js | 4.1 | ✅ | GET /, /:id, /today, /schedule, /:id/stats, /:id/export-pdf |
| records.js | 4.2 | ✅ | 2 queries patched + decrypt |
| training.js | 4.3 | ✅ | 1 query patched + decrypt |
| assignments.js | 4.4 | ✅ | 1 query patched + decrypt (sync query uses pacaPool - correct) |
| presets.js | 4.5 | ✅ | 1 query patched + decrypt |
| stats.js | 4.6 | ✅ | 3 queries patched + gender convert |
| attendance.js | 4.7 | ✅ | 1 query patched + decrypt |
| mobile.js | 4.8 | ✅ | 1 query patched + decrypt |
| monthlyTests.js | 4.9 | ⚠️ | 2 queries patched but LEFT JOIN lacks academy_id |
| testSessions.js | 4.9 | ❌ | 2 SELECT queries still read from Peak students |
| testApplicants.js | 4.9 | ⚠️ | No SELECT gap, but INSERT writes to columns to be dropped |
| notifications.js | 4.10 | ✅ | count query patched |
| publicBoard.js | 4.10 | ⚠️ | 1 query patched but LEFT JOIN lacks academy_id |

**Route migration: 11/13 fully done (85%)**

## 2. Gap List

### GAP-1: testSessions.js — 2 SELECT queries not patched [HIGH]

**Design requirement (Section 4.9):** "학생 참조가 있는 쿼리에 동일한 파카 JOIN 패턴 적용"

**Current code (line 205, 792):**
```sql
SELECT tp.*, s.name as student_name, s.gender, s.school, s.grade
FROM test_participants tp
LEFT JOIN students s ON tp.student_id = s.id
WHERE tp.test_session_id = ?
```

**Expected:**
```sql
SELECT tp.*, ps.name as student_name, ps.gender, ps.school, ps.grade
FROM test_participants tp
LEFT JOIN students s ON tp.student_id = s.id
LEFT JOIN paca.students ps ON s.paca_student_id = ps.id
WHERE tp.test_session_id = ?
```
+ decrypt student names + convert gender

### GAP-2: monthlyTests.js, publicBoard.js — LEFT JOIN lacks academy_id [MEDIUM]

**Design requirement (Section 3):** "모든 쿼리에 academy_id 필터 필수"

**Current:**
```sql
LEFT JOIN paca.students ps ON s.paca_student_id = ps.id
```

**Expected:**
```sql
LEFT JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
```

**Note:** 데이터는 이미 `test_session_id`로 학원 격리됨. 보안 이중 검증 차원의 gap.
publicBoard는 공개 엔드포인트라 academy_id를 slug 기반으로 조회해야 함.

### GAP-3: POST /sync not removed from students.js [LOW]

**Design (Section 4.1):** "POST /sync 엔드포인트 전체 삭제"
**Current:** students.js line 26에 `router.post('/sync', ...)` 존재

**Note:** Design Step 13에 해당. 코드 전환 완료 후 제거 예정. DB 컬럼 DROP (Step 12) 이후 수행하는 것이 안전.

### GAP-4: POST /register not implemented [LOW]

**Design (Section 5.2):** "POST /peak/students/register - 파카 학생 매핑 등록"
**Current:** 미구현

**Note:** 현재 자동 매핑이 assignments sync와 testSessions에서 수행되고 있어 운영에 즉각적 영향 없음. 프리셋에서 학생 추가 시 필요할 수 있음.

### GAP-5: testSessions.js, testApplicants.js — INSERT INTO students with deprecated columns [LOW]

**Lines:** testSessions.js:114,535,704 / testApplicants.js:221
```sql
INSERT INTO students (paca_student_id, name, gender, school, grade, status, is_trial) ...
```

**Note:** Step 12 (DB 컬럼 DROP) 시 함께 수정 필요. 현재는 동작에 문제없음.

## 3. Summary by Priority

| Priority | Gap | Impact | Effort |
|:--------:|-----|--------|--------|
| HIGH | GAP-1: testSessions.js 2 queries | 월말테스트 세션 상세에서 학생 이름 암호화 표시 가능 | 30분 |
| MEDIUM | GAP-2: academy_id in LEFT JOINs | 보안 이중검증 미충족 (1차 필터는 동작) | 15분 |
| LOW | GAP-3: /sync 제거 | 불필요한 코드 잔존 | Step 12 이후 |
| LOW | GAP-4: /register 미구현 | 수동 매핑 기능 부재 | 별도 구현 |
| LOW | GAP-5: INSERT 컬럼 수정 | Step 12 시 함께 처리 | Step 12 시 |

## 4. Test Checklist Status

| Test Item | Status | Note |
|-----------|:------:|------|
| 학생 목록 조회 | ✅ | 12명 정상, 이름 복호화 OK |
| 학생 상세 | ✅ | Peak ID → Paca 정보 정상 |
| 기록 조회 | ✅ | student_records 정상 + 이름 복호화 |
| 반배치 (프리셋) | ✅ | 프리셋 멤버 Paca 조회 정상 |
| 출석체크 | ✅ | 학생 출석 정상 |
| 통계 | ✅ | 성별/학교별 정상, gender 변환 OK |
| 학원 격리 | ⚠️ | GAP-2 해당 |
| 파카 즉시 반영 | ✅ | 직접 조회로 동기화 불필요 |
| 이름 복호화 | ⚠️ | testSessions 세션 상세에서 미적용 (GAP-1) |
| 성별 변환 | ⚠️ | testSessions 세션 상세에서 미적용 (GAP-1) |
| 월말테스트 참가자 | ✅ | 41명 정상 표시, 이름/성별 OK |
| 엑셀 export | ✅ | HTTP 200, 이름/성별 정상 |
| 알림 | ✅ | 기록 미입력 학생 3명 정상 카운트 |

## 5. Recommendation

**GAP-1 (HIGH)과 GAP-2 (MEDIUM)를 해결하면 Match Rate 95%+ 달성 가능.**

GAP-3~5는 Step 12 (DB 컬럼 DROP) 때 일괄 처리하는 것이 설계 의도에 부합.
