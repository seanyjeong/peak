# P-EAK API Documentation

Base URL: `https://chejump.com/peak` (Production) / `http://localhost:8330/peak` (Development)

## 인증

모든 보호된 API는 JWT 토큰이 필요합니다.

```
Authorization: Bearer <token>
```

### POST /auth/login

P-ACA 계정으로 로그인합니다.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "name": "홍길동",
    "email": "user@example.com",
    "role": "staff",
    "position": "강사"
  }
}
```

---

## 반 배치

### GET /assignments

날짜별 반 배치를 조회합니다.

**Query Parameters:**
- `date` (required): YYYY-MM-DD 형식

**Request:**
```
GET /peak/assignments?date=2024-12-23
```

**Response:**
```json
{
  "timeSlots": {
    "morning": "09:30-12:00",
    "afternoon": "14:00-18:00",
    "evening": "18:30-21:00"
  },
  "assignments": {
    "morning": {
      "instructors": [
        { "id": 1, "name": "김강사", "isOwner": false },
        { "id": -2, "name": "박원장", "isOwner": true }
      ],
      "classes": [
        {
          "classNum": 1,
          "instructors": [
            { "id": 1, "name": "김강사", "isMain": true }
          ],
          "students": [
            {
              "id": 101,
              "name": "이학생",
              "status": "active",
              "isTrial": false
            }
          ]
        }
      ]
    }
  }
}
```

### POST /assignments/sync

P-ACA 학생 데이터를 동기화합니다.

**Request:**
```json
{
  "date": "2024-12-23"
}
```

**Response:**
```json
{
  "message": "동기화 완료",
  "added": 5,
  "updated": 3,
  "removed": 1
}
```

### PUT /assignments/:id

학생 배치를 변경합니다.

**Request:**
```json
{
  "classId": 2,
  "timeSlot": "afternoon"
}
```

**Response:**
```json
{
  "message": "배치 변경 완료",
  "assignment": {
    "id": 123,
    "studentId": 101,
    "classId": 2,
    "timeSlot": "afternoon"
  }
}
```

---

## 기록 측정

### GET /records/by-date

날짜별 학생 기록을 조회합니다.

**Query Parameters:**
- `date` (required): YYYY-MM-DD 형식
- `student_ids` (optional): 쉼표 구분 학생 ID

**Request:**
```
GET /peak/records/by-date?date=2024-12-23&student_ids=101,102,103
```

**Response:**
```json
{
  "records": [
    {
      "studentId": 101,
      "recordTypeId": 1,
      "value": 2.85,
      "score": 95,
      "measuredAt": "2024-12-23"
    }
  ]
}
```

### POST /records/batch

기록을 일괄 저장합니다 (UPSERT).

**Request:**
```json
{
  "date": "2024-12-23",
  "records": [
    {
      "studentId": 101,
      "recordTypeId": 1,
      "value": 2.85
    },
    {
      "studentId": 101,
      "recordTypeId": 2,
      "value": 6.52
    }
  ]
}
```

**Response:**
```json
{
  "message": "저장 완료",
  "saved": 2,
  "skipped": 0
}
```

---

## 학생 통계

### GET /students/:id/stats

학생 종합 통계를 조회합니다.

**Request:**
```
GET /peak/students/101/stats
```

**Response:**
```json
{
  "student": {
    "id": 101,
    "name": "이학생",
    "gender": "male",
    "school": "XX고등학교",
    "grade": 3
  },
  "records": [
    {
      "typeId": 1,
      "typeName": "제자리멀리뛰기",
      "unit": "m",
      "direction": "higher",
      "latestValue": 2.85,
      "latestScore": 95,
      "avg": 2.78,
      "trend": "up",
      "history": [
        { "date": "2024-12-20", "value": 2.75 },
        { "date": "2024-12-23", "value": 2.85 }
      ]
    }
  ],
  "overallScore": 88
}
```

---

## 종목 관리

### GET /record-types

종목 목록을 조회합니다.

**Response:**
```json
{
  "recordTypes": [
    {
      "id": 1,
      "name": "제자리멀리뛰기",
      "shortName": "멀뛰",
      "unit": "m",
      "direction": "higher",
      "isActive": true,
      "displayOrder": 1
    }
  ]
}
```

### POST /record-types

새 종목을 추가합니다 (owner/admin only).

**Request:**
```json
{
  "name": "50m 달리기",
  "shortName": "50m",
  "unit": "초",
  "direction": "lower"
}
```

---

## 운동 관리

### GET /exercises

운동 목록을 조회합니다.

**Response:**
```json
{
  "exercises": [
    {
      "id": 1,
      "name": "스쿼트",
      "tags": ["하체", "기본"],
      "defaultSets": 3,
      "defaultReps": 10
    }
  ]
}
```

### GET /exercise-packs/:id/export

운동 팩을 JSON으로 내보냅니다.

**Response:**
```json
{
  "name": "기본 운동 세트",
  "version": "1.0",
  "exercises": [
    { "name": "스쿼트", "tags": ["하체"] }
  ]
}
```

### POST /exercise-packs/import

운동 팩을 가져옵니다.

**Request:**
```json
{
  "name": "가져온 팩",
  "exercises": [
    { "name": "런지", "tags": ["하체"] }
  ]
}
```

---

## 에러 응답

모든 에러 응답은 다음 형식을 따릅니다:

```json
{
  "error": "Error Type",
  "message": "상세 에러 메시지"
}
```

### HTTP 상태 코드

| 코드 | 의미 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 500 | 서버 에러 |
