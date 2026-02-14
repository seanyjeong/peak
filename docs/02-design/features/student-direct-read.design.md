# Design: Student Direct Read (학생 데이터 파카 직접 참조)

## 설계 방향

**"매핑 테이블 패턴"** - Peak `students` 테이블을 축소하여 ID 매핑 전용으로 유지하고,
학생 정보(이름, 성별, 상태 등)는 파카 DB에서 직접 읽는다.

### 왜 FK를 전면 교체하지 않는가?

- 기존 5개 테이블에 2,259건의 레코드가 `students.id`를 FK로 참조
- FK를 일괄 변경하면 단 1건이라도 매핑 오류 시 데이터 유실
- 매핑 테이블을 유지하면 **기존 데이터를 하나도 건드리지 않고** 전환 가능
- 50개 학원 환경에서도 매핑 테이블은 학생 수(~3,000행)로 충분히 작음

## 1. DB 스키마 변경

### Peak `students` 테이블 축소

```sql
-- Before: 16개 컬럼 (파카 데이터 복사본)
-- After: 4개 컬럼 (매핑 전용)

-- Step 1: 불필요한 컬럼 제거 (name, gender, phone, school, grade 등)
ALTER TABLE students
  DROP COLUMN name,
  DROP COLUMN gender,
  DROP COLUMN phone,
  DROP COLUMN school,
  DROP COLUMN grade,
  DROP COLUMN class_days,
  DROP COLUMN is_trial,
  DROP COLUMN trial_total,
  DROP COLUMN trial_remaining,
  DROP COLUMN join_date,
  DROP COLUMN status;

-- 남는 컬럼: id, academy_id, paca_student_id, created_at, updated_at
```

**남기는 이유:**
- `id`: 기존 FK 참조 보존 (student_records, daily_assignments 등)
- `academy_id`: 보안 - 학원 격리 검증
- `paca_student_id`: 파카 DB JOIN 키

### 참조 테이블 변경 없음

| 테이블 | FK | 변경 | 이유 |
|--------|-----|:----:|------|
| student_records | student_id → students.id | **없음** | 매핑 테이블 경유 |
| daily_assignments | student_id → students.id | **없음** | 매핑 테이블 경유 |
| training_logs | student_id → students.id | **없음** | 매핑 테이블 경유 |
| preset_group_members | student_id → students.id | **없음** | 매핑 테이블 경유 |

## 2. 쿼리 패턴 변경

### Before (파카 복사본에서 읽기)
```sql
SELECT r.*, s.name, s.gender, s.school, s.grade
FROM student_records r
JOIN students s ON r.student_id = s.id
WHERE s.academy_id = ?
```

### After (파카 DB 직접 JOIN)
```sql
SELECT r.*, ps.name, ps.gender, ps.school, ps.grade
FROM student_records r
JOIN students s ON r.student_id = s.id
JOIN paca.students ps ON s.paca_student_id = ps.id
WHERE s.academy_id = ?
```

**변경 포인트:** `s.name` → `ps.name` + `JOIN paca.students ps ON s.paca_student_id = ps.id`

### 복호화 처리

파카의 name, phone은 `ENC:` 접두어 암호화. 기존 `decryptFields()` 유틸 활용.

```javascript
// Helper: 파카 학생 데이터 복호화
function decryptStudentFields(students) {
  return students.map(s => ({
    ...s,
    name: decrypt(s.name),
    phone: s.phone ? decrypt(s.phone) : null
  }));
}
```

### 성별 변환

파카: `male`/`female` → Peak 기존: `M`/`F`

```javascript
// Helper: 성별 변환
function convertGender(pacaGender) {
  return pacaGender === 'male' ? 'M' : 'F';
}
```

## 3. 보안 설계 (학원 격리)

### 원칙: 모든 쿼리에 academy_id 필터 필수

```sql
-- GOOD: 학원 격리 보장
JOIN students s ON r.student_id = s.id AND s.academy_id = ?
JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?

-- BAD: 학원 격리 없음 (절대 금지)
JOIN paca.students ps ON s.paca_student_id = ps.id
```

### 이중 검증

1. **Peak 매핑 테이블**: `students.academy_id = ?` (1차)
2. **Paca 원본**: `paca.students.academy_id = ?` (2차)

두 곳 모두 academy_id를 검증하여 크로스 학원 데이터 유출 원천 차단.

### Cross-DB 권한

현재 `paca` MySQL 유저가 `peak`, `paca` 양쪽 DB 접근 가능 확인됨.
운영 시 READ-ONLY 권한만 부여 권장:

```sql
-- 운영 환경 권한 설정 (향후)
GRANT SELECT ON paca.students TO 'peak_readonly'@'localhost';
```

## 4. 라우트별 변경 상세

### 4.1 students.js (전면 재작성)

**삭제:**
- `POST /sync` 엔드포인트 전체
- `POST /students/sync` 관련 코드 (싱크 로직, 상태 변환, 중복 체크 등)

**변경:**
- `GET /` → 파카 DB 직접 조회 + 복호화
- `GET /:id` → 매핑 테이블 경유 파카 JOIN
- `GET /:id/records` → 파카 JOIN
- `GET /:id/stats` → 파카 JOIN

**신규:**
- `POST /register` → 파카 학생을 Peak에 매핑 등록 (매핑 테이블에 INSERT)
  - 파카에 이미 있는 학생을 Peak에서 사용하겠다고 등록하는 것
  - 싱크가 아니라 명시적 등록

```javascript
// GET /peak/students - 학생 목록 (파카 직접)
router.get('/', async (req, res) => {
  const academyId = req.user.academyId;
  const { status } = req.query;

  let query = `
    SELECT s.id, s.paca_student_id,
           ps.name, ps.gender, ps.phone, ps.school, ps.grade,
           ps.status, ps.class_days, ps.enrollment_date,
           ps.is_trial, ps.trial_remaining, ps.trial_dates
    FROM students s
    JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
    WHERE s.academy_id = ?
  `;
  const params = [academyId, academyId];

  if (status) {
    query += ' AND ps.status = ?';
    params.push(status);
  }
  query += ' ORDER BY ps.name';

  const [rows] = await db.query(query, params);
  const students = decryptStudentFields(rows).map(s => ({
    ...s, gender: convertGender(s.gender)
  }));
  res.json({ success: true, students });
});
```

### 4.2 records.js

```diff
- JOIN students s ON r.student_id = s.id
+ JOIN students s ON r.student_id = s.id
+ JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?

- s.name as student_name, s.gender
+ ps.name as student_name, ps.gender
```

결과에 `decryptFields(row, ['student_name'])` 적용.

### 4.3 training.js

```diff
- JOIN students s ON l.student_id = s.id
+ JOIN students s ON l.student_id = s.id
+ JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?

- s.name as student_name, s.gender as student_gender
+ ps.name as student_name, ps.gender as student_gender
```

### 4.4 assignments.js

이미 `paca_attendance_id`로 파카와 연결됨. 변경:
```diff
- s.name as student_name, s.gender, s.school, s.grade, s.paca_student_id
+ ps.name as student_name, ps.gender, ps.school, ps.grade, s.paca_student_id
+ JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
```

assignments sync 로직에서 학생 정보 업데이트 부분 제거 (파카에서 직접 읽으니 불필요).

### 4.5 presets.js

```diff
  SELECT pgm.student_id, s.name, s.gender, s.grade, s.school, s.status
  FROM preset_group_members pgm
- JOIN students s ON pgm.student_id = s.id
+ JOIN students s ON pgm.student_id = s.id
+ JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
```

### 4.6 stats.js

```diff
- SELECT gender, COUNT(*) FROM students WHERE status = 'active' AND academy_id = ?
+ SELECT ps.gender, COUNT(*)
+ FROM students s
+ JOIN paca.students ps ON s.paca_student_id = ps.id AND ps.academy_id = ?
+ WHERE ps.status = 'active' AND s.academy_id = ?
```

### 4.7 attendance.js

daily_assignments 기반이므로 학생 조회 패턴만 변경.

### 4.8 mobile.js

assignments/records 와 동일 패턴 적용.

### 4.9 monthlyTests.js, testApplicants.js, testSessions.js

학생 참조가 있는 쿼리에 동일한 파카 JOIN 패턴 적용.

### 4.10 notifications.js, publicBoard.js

학생 이름 조회 시 파카 JOIN + 복호화.

## 5. 자동 매핑 등록 (sync 대체)

기존 sync는 제거하되, 학생이 Peak에서 처음 사용될 때 자동 매핑:

### 5.1 assignments sync 시 자동 등록

```javascript
// assignments.js의 sync 엔드포인트에서
// 파카에서 출석 데이터 가져올 때, Peak 매핑이 없으면 자동 생성

for (const pacaStudent of pacaStudents) {
  let [mapping] = await db.query(
    'SELECT id FROM students WHERE paca_student_id = ? AND academy_id = ?',
    [pacaStudent.id, academyId]
  );
  if (mapping.length === 0) {
    const [result] = await db.query(
      'INSERT INTO students (academy_id, paca_student_id) VALUES (?, ?)',
      [academyId, pacaStudent.id]
    );
    mapping = [{ id: result.insertId }];
  }
  peakStudentId = mapping[0].id;
}
```

### 5.2 수동 등록 엔드포인트

```javascript
// POST /peak/students/register - 파카 학생 매핑 등록
// 프리셋 등에서 학생 추가 시 사용
router.post('/register', async (req, res) => {
  const { paca_student_ids } = req.body;
  // 파카에서 존재 확인 + academy_id 검증
  // 매핑 테이블에 INSERT IGNORE
});
```

## 6. 프론트엔드 변경

### 변경 없음 예상

- API 응답 구조는 동일하게 유지 (`student_id`, `name`, `gender` 등)
- 학생 `id`는 여전히 Peak의 `students.id`
- 프론트엔드에서 학생 ID로 `/students/:id` 호출 시 Peak ID 사용

**유일한 변경점:**
- 학생 목록 API에서 `status` 필터가 파카 기준으로 바뀜 (즉시 반영)
- 성별이 `male`/`female`로 올 수 있으므로 변환 확인

## 7. 구현 순서

| Step | 작업 | 영향도 | 롤백 가능 |
|:----:|------|:------:|:---------:|
| 1 | 복호화 헬퍼 함수 추가 (`utils/paca-student.js`) | 없음 | ✅ |
| 2 | `students.js` 재작성 (파카 직접 조회) | 높음 | ✅ (이전 파일 백업) |
| 3 | `records.js` JOIN 변경 | 중간 | ✅ |
| 4 | `training.js` JOIN 변경 | 중간 | ✅ |
| 5 | `assignments.js` 학생 정보 JOIN 변경 + 자동 매핑 | 높음 | ✅ |
| 6 | `presets.js` JOIN 변경 | 중간 | ✅ |
| 7 | `stats.js` JOIN 변경 | 중간 | ✅ |
| 8 | `attendance.js` JOIN 변경 | 중간 | ✅ |
| 9 | `mobile.js` JOIN 변경 | 중간 | ✅ |
| 10 | 나머지 라우트 (monthlyTests, testApplicants, testSessions, notifications, publicBoard) | 낮음 | ✅ |
| 11 | 전체 빌드 + API 테스트 | - | - |
| 12 | DB 컬럼 제거 (students 테이블 축소) | 높음 | ⚠️ (백업 필수) |
| 13 | sync 코드 제거 | 낮음 | ✅ |

**핵심 원칙: Step 12 (DB 컬럼 제거)는 모든 코드 전환이 완료되고 충분히 테스트된 후 마지막에 수행.**

## 8. 테스트 체크리스트

- [ ] 학생 목록 조회: 파카 데이터와 일치 (이름, 성별, 상태, 학교, 학년)
- [ ] 학생 상세: Peak ID로 조회 시 파카 정보 정상 표시
- [ ] 기록 조회: 기존 1,263건 student_records 정상 표시 + 학생 이름 복호화
- [ ] 반배치: 학생 배치 + 프리셋 적용 정상
- [ ] 출석체크: 학생 출석 상태 변경 정상
- [ ] 통계: 성별/학교별 통계 정상
- [ ] 학원 격리: A학원 로그인으로 B학원 학생 조회 불가 확인
- [ ] 파카에서 상태 변경 → Peak에서 즉시 반영 확인
- [ ] 이름 복호화: 모든 화면에서 정상 표시 (암호문 노출 없음)
- [ ] 성별 변환: male→M, female→F 정상 변환
