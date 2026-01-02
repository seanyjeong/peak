# P-EAK API 명세서

**버전**: v4.3.9
**Base URL**: `https://chejump.com/peak` (Production) / `http://localhost:8330/peak` (Development)
**최종 업데이트**: 2025-01-02

---

## 목차

1. [공통 사항](#공통-사항)
2. [인증](#인증)
3. [학생 관리](#학생-관리)
4. [기록 측정](#기록-측정)
5. [반 배치](#반-배치)
6. [수업 계획](#수업-계획)
7. [수업 기록](#수업-기록)
8. [종목 관리](#종목-관리)
9. [배점표](#배점표)
10. [통계](#통계)
11. [운동 관리](#운동-관리)
12. [운동 팩](#운동-팩)
13. [운동 태그](#운동-태그)
14. [월말테스트](#월말테스트)
15. [테스트 세션](#테스트-세션)
16. [테스트 신청자](#테스트-신청자)
17. [알림](#알림)
18. [푸시 알림](#푸시-알림)
19. [강사 관리](#강사-관리)
20. [출근 체크](#출근-체크)
21. [전광판 (Public)](#전광판)
22. [Multi-Tenant 보안](#multi-tenant-보안)

---

## 공통 사항

### 인증 헤더

모든 API 요청(Public 제외)에는 JWT 토큰이 필요합니다.

```
Authorization: Bearer <JWT_TOKEN>
```

### 응답 형식

```json
{
  "success": true,
  "data": { ... },
  "message": "성공 메시지"
}
```

### 에러 응답

```json
{
  "error": "Error Type",
  "message": "에러 설명"
}
```

### Multi-Tenant 필수 필드

> **중요**: 모든 데이터 조회/수정 API는 `academy_id`를 기반으로 데이터를 격리합니다.
> JWT 토큰에서 자동으로 `academyId`를 추출하여 사용합니다.

---

## 인증

### POST /auth/login

P-ACA 계정으로 로그인합니다.

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "홍길동",
    "role": "staff",
    "position": "실장",
    "academyId": 2
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### GET /auth/me

현재 로그인된 사용자 정보를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Response**
```json
{
  "id": 1,
  "name": "홍길동",
  "role": "admin",
  "academyId": 2
}
```

---

## 학생 관리

### POST /students/sync

P-ACA에서 학생 데이터를 동기화합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Response**
```json
{
  "success": true,
  "message": "학생 동기화 완료",
  "stats": {
    "total": 50,
    "synced": 48,
    "errors": 2
  }
}
```

### GET /students

학생 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| status | string | - | `active`, `inactive`, `trial`, `pending`, `paused` |

**Response**
```json
{
  "students": [
    {
      "id": 1,
      "paca_student_id": 123,
      "name": "김철수",
      "gender": "M",
      "school": "한국고등학교",
      "grade": 2,
      "status": "active",
      "is_trial": false,
      "academy_id": 2
    }
  ]
}
```

### GET /students/:id

특정 학생 정보를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /students/:id/records

학생의 전체 기록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /students/:id/stats

학생 종합 통계를 조회합니다. (레이더 차트용)

**Headers**: `Authorization: Bearer <token>` (필수)

**Response**
```json
{
  "student": { "id": 1, "name": "김철수", "gender": "M" },
  "recordTypes": [...],
  "records": { "1": 12.5, "2": 5.2 },
  "scores": { "1": 85, "2": 90 },
  "maleScoreAverages": { "1": 75, "2": 80 },
  "femaleScoreAverages": { "1": 70, "2": 75 },
  "trends": { "1": "up", "2": "stable" }
}
```

### GET /students/today

오늘 출석 예정 학생을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| date | string | - | YYYY-MM-DD (기본: 오늘) |

---

## 기록 측정

### GET /records

기록 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| student_id | number | - | 특정 학생 ID |
| record_type_id | number | - | 특정 종목 ID |
| start_date | string | - | 시작일 (YYYY-MM-DD) |
| end_date | string | - | 종료일 (YYYY-MM-DD) |

### GET /records/by-date

특정 날짜의 기록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| date | string | Y | 날짜 (YYYY-MM-DD) |
| student_ids | string | - | 학생 ID 목록 (콤마 구분) |

### POST /records

단일 기록을 저장합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Request Body**
```json
{
  "student_id": 1,
  "record_type_id": 1,
  "value": 12.5,
  "measured_at": "2025-12-30",
  "notes": "메모"
}
```

### POST /records/batch

여러 기록을 일괄 저장합니다. (UPSERT)

> **동작 방식**: 같은 날짜+학생+종목 조합에서 더 좋은 기록만 저장됩니다.
> - `direction: 'higher'`: 높을수록 좋음 (멀리뛰기)
> - `direction: 'lower'`: 낮을수록 좋음 (달리기)

**Headers**: `Authorization: Bearer <token>` (필수)

**Request Body**
```json
{
  "records": [
    {
      "student_id": 1,
      "record_type_id": 1,
      "value": 12.5,
      "measured_at": "2025-12-30"
    }
  ]
}
```

### GET /records/latest

각 학생의 최신 기록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 반 배치

### GET /assignments

특정 날짜의 반 배치를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| date | string | Y | 날짜 (YYYY-MM-DD) |

**Response**
```json
{
  "assignments": [...],
  "instructors": { "morning": [...], "afternoon": [...], "evening": [...] },
  "timeSlots": {
    "morning": "09:30-12:00",
    "afternoon": "14:00-18:00",
    "evening": "18:30-21:00"
  }
}
```

### POST /assignments/sync

P-ACA 출석 데이터와 동기화합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Request Body**
```json
{
  "date": "2025-12-30"
}
```

### PUT /assignments/:id

학생 배치를 변경합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Request Body**
```json
{
  "class_id": 2,
  "order_num": 3
}
```

### POST /assignments/instructor

강사를 반에 배치합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Request Body**
```json
{
  "date": "2025-12-30",
  "time_slot": "morning",
  "class_num": 1,
  "instructor_id": 5,
  "is_main": true
}
```

### GET /assignments/instructors

특정 날짜의 출근 강사 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 수업 계획

### GET /plans

수업 계획 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| date | string | Y | 날짜 (YYYY-MM-DD) |
| instructor_id | number | - | 강사 ID |

### POST /plans

수업 계획을 생성합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /plans/:id

수업 계획을 수정합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### DELETE /plans/:id

수업 계획을 삭제합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /plans/:id/toggle-exercise

운동 완료 상태를 토글합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /plans/:id/extra-exercise

추가 운동을 등록합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /plans/:id/conditions

환경 조건(온도/습도)을 저장합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 수업 기록

### GET /training

수업 기록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| date | string | Y | 날짜 (YYYY-MM-DD) |

### POST /training

수업 기록을 생성합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /training/:id

컨디션/메모를 저장합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 종목 관리

### GET /record-types

종목 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| active_only | boolean | - | 활성 종목만 (기본: true) |

**Response**
```json
{
  "recordTypes": [
    {
      "id": 1,
      "name": "100m 달리기",
      "short_name": "100m",
      "unit": "초",
      "direction": "lower",
      "is_active": true,
      "display_order": 1,
      "academy_id": 2
    }
  ]
}
```

### POST /record-types

종목을 생성합니다. (owner/admin 전용)

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /record-types/:id

종목을 수정합니다. (owner/admin 전용)

**Headers**: `Authorization: Bearer <token>` (필수)

### DELETE /record-types/:id

종목을 비활성화합니다. (soft delete)

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 배점표

### GET /score-tables

배점표 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /score-tables/:id

특정 배점표를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /score-tables/by-type/:recordTypeId

종목별 배점표를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /score-tables

배점표를 생성합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /score-tables/ranges/:id

배점 범위를 수정합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### DELETE /score-tables/:id

배점표를 삭제합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /score-tables/calculate

기록값에 대한 점수를 계산합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 통계

### GET /stats/academy-average

학원 평균 통계를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Response**
```json
{
  "recordTypes": [...],
  "maleAverages": { "1": 12.5, "2": 5.2 },
  "femaleAverages": { "1": 14.0, "2": 4.8 },
  "maleScoreAverages": { "1": 75, "2": 80 },
  "femaleScoreAverages": { "1": 70, "2": 75 },
  "studentCounts": { "M": 30, "F": 25 }
}
```

### GET /stats/leaderboard/:recordTypeId

종목별 리더보드를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 운동 관리

### GET /exercises

운동 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /exercises/:id

특정 운동을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /exercises

운동을 생성합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /exercises/:id

운동을 수정합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### DELETE /exercises/:id

운동을 삭제합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 운동 팩

### GET /exercise-packs

운동 팩 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /exercise-packs/:id

특정 팩을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /exercise-packs

팩을 생성합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /exercise-packs/:id

팩을 수정합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### DELETE /exercise-packs/:id

팩을 삭제합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /exercise-packs/:id/export

팩을 JSON으로 내보냅니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /exercise-packs/import

JSON 팩을 가져옵니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /exercise-packs/:id/apply

팩을 현재 운동 목록에 적용합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 운동 태그

### GET /exercise-tags

활성 태그 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /exercise-tags/all

모든 태그(비활성 포함)를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /exercise-tags

태그를 생성합니다. (admin 전용)

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /exercise-tags/:id

태그를 수정합니다. (admin 전용)

**Headers**: `Authorization: Bearer <token>` (필수)

### DELETE /exercise-tags/:id

태그를 비활성화합니다. (admin 전용)

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 월말테스트

### GET /monthly-tests

월말테스트 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /monthly-tests/:id

특정 테스트를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /monthly-tests

테스트를 생성합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /monthly-tests/:id

테스트를 수정합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### DELETE /monthly-tests/:id

테스트를 삭제합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /monthly-tests/:testId/sessions

테스트 세션을 생성합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /monthly-tests/:testId/sessions

테스트의 세션 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /monthly-tests/academy/slug

학원 slug를 설정합니다. (전광판용)

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 테스트 세션

### GET /test-sessions/:sessionId/groups

세션의 그룹별 참가자를 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /test-sessions/:sessionId/participants/sync

참가자를 동기화합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /test-sessions/:sessionId/available-students

참가 가능한 학생 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /test-sessions/:sessionId/records

세션의 기록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 테스트 신청자

### GET /test-applicants

테스트 신청자 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /test-applicants

신청자를 등록합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /test-applicants/:id

신청자 정보를 수정합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### DELETE /test-applicants/:id

신청자를 삭제합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /test-applicants/:id/convert

신청자를 재원생으로 전환합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /test-applicants/rest-students

휴원 학생 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 알림

### GET /notifications

미읽은 알림 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /notifications/:id/read

알림을 읽음 처리합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### PUT /notifications/read-all

모든 알림을 읽음 처리합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /notifications/check

실시간 알림 체크 (기록 미입력, 계획 미제출)

**Headers**: `Authorization: Bearer <token>` (필수)

**Response**
```json
{
  "alerts": [
    {
      "type": "record_missing",
      "title": "실기기록 미입력",
      "message": "12월 5주차 실기기록측정이 이루어지지 않은 학생이 5명 있습니다.",
      "severity": "warning",
      "count": 5
    }
  ],
  "hasAlerts": true
}
```

---

## 푸시 알림

### GET /push/vapid-public-key

VAPID 공개키를 조회합니다. (인증 불필요)

**Response**
```json
{
  "publicKey": "BN3..."
}
```

### POST /push/subscribe

푸시 알림을 구독합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### DELETE /push/subscribe

푸시 구독을 해제합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### GET /push/subscriptions

내 구독 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

### POST /push/test

테스트 푸시를 발송합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 강사 관리

### GET /trainers

강사 목록을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 출근 체크

### GET /attendance

출근 현황을 조회합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

**Query Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| date | string | - | 날짜 (YYYY-MM-DD) |

### POST /attendance/checkin

출근 체크인합니다.

**Headers**: `Authorization: Bearer <token>` (필수)

---

## 전광판

### GET /public-board/:slug

학원 전광판 데이터를 조회합니다. (인증 불필요)

**Parameters**
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| slug | string | Y | 학원 slug (URL path) |

**Response**
```json
{
  "success": true,
  "academy": {
    "name": "일산맥스체대입시",
    "slug": "ilsanmax"
  },
  "test": {
    "name": "12월 월말테스트",
    "month": "2025-12"
  },
  "ranking": {
    "male": [
      { "rank": 1, "name": "김철수", "school": "한국고", "grade": 2, "total": 450 }
    ],
    "female": [
      { "rank": 1, "name": "이영희", "school": "서울고", "grade": 3, "total": 420 }
    ]
  },
  "events": [...]
}
```

---

## Multi-Tenant 보안

> **v4.3.4 업데이트**: 모든 API 엔드포인트에서 `academy_id` 필터링 완료

### 적용된 보안 조치

1. **JWT 토큰 기반 격리**: 모든 API 요청에서 토큰의 `academyId`로 데이터 필터링
2. **쿼리 레벨 격리**: 모든 SQL 쿼리에 `WHERE academy_id = ?` 조건 적용
3. **스케줄러 격리**: 푸시 알림 스케줄러에서 학원별 개별 처리
4. **Public API 보안**: `publicBoard`는 slug 기반으로 학원 식별

### 검증된 라우트 (20개)

| 라우트 | 상태 | 비고 |
|--------|------|------|
| auth.js | ✅ | 로그인 시 academyId 토큰에 포함 |
| students.js | ✅ | 모든 쿼리 academy_id 필터 |
| records.js | ✅ | 모든 쿼리 academy_id 필터 |
| assignments.js | ✅ | 모든 쿼리 academy_id 필터 |
| plans.js | ✅ | 모든 쿼리 academy_id 필터 |
| training.js | ✅ | 모든 쿼리 academy_id 필터 |
| recordTypes.js | ✅ | 모든 쿼리 academy_id 필터 |
| scoreTable.js | ✅ | 모든 쿼리 academy_id 필터 |
| stats.js | ✅ | 모든 쿼리 academy_id 필터 |
| exercises.js | ✅ | 모든 쿼리 academy_id 필터 |
| exercise-packs.js | ✅ | 모든 쿼리 academy_id 필터 |
| exercise-tags.js | ✅ | 모든 쿼리 academy_id 필터 |
| monthlyTests.js | ✅ | 모든 쿼리 academy_id 필터 |
| testSessions.js | ✅ | 모든 쿼리 academy_id 필터 |
| testApplicants.js | ✅ | 모든 쿼리 academy_id 필터 |
| trainers.js | ✅ | 모든 쿼리 academy_id 필터 |
| attendance.js | ✅ | 모든 쿼리 academy_id 필터 |
| notifications.js | ✅ | v4.3.4에서 수정 |
| push.js | ✅ | v4.3.4에서 수정 |
| publicBoard.js | ✅ | slug 기반 학원 식별 |

---

## 에러 코드

| HTTP 상태 | 에러 코드 | 설명 |
|----------|----------|------|
| 400 | Validation Error | 요청 데이터 유효성 검증 실패 |
| 401 | Unauthorized | 인증 토큰 없음 또는 만료 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 중복 데이터 |
| 500 | Server Error | 서버 내부 오류 |

---

## 변경 이력

### v4.3.4 (2025-12-30)
- `notifications.js`: `/check` 엔드포인트에 academy_id 필터 추가
- `push.js`: `sendPushToAllInstructors()` 함수에 academyId 필수 파라미터 추가
- `pushScheduler.js`: 모든 학원을 순회하며 개별 처리하도록 리팩토링
- API 명세서 전면 업데이트

### v4.3.3 (2025-12-30)
- 레이더 차트 점수 기반으로 변경
- `stats.js`: `maleScoreAverages`, `femaleScoreAverages` 추가
