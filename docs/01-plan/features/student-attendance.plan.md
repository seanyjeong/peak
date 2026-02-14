# Plan: 학생 출석체크 (Student Attendance)

## 개요
Peak에서 학생 출석체크를 직접 수행하고, Paca DB의 attendance 테이블에 실시간 동기화하는 기능.

## 현재 상태 (As-Is)
- Peak `(pc)/attendance/page.tsx`: **강사 출근체크**만 존재
- Peak `assignments` 페이지: Paca에서 출석 상태를 **읽기만** 함 (attendanceMap)
- 출석은 **Paca에서만** 체크 가능 (schedules/:id/attendance 라우트)
- Peak `daily_assignments.paca_attendance_id`로 Paca `attendance.id` 연결됨

## 목표 (To-Be)
Peak에서 학생 출석체크 → Paca `attendance` 테이블에 즉시 반영

## 기능 요구사항

### FR-01: 학생 출석체크 API
- `POST /peak/attendance/student` - 학생 출석 상태 변경
- Peak → Paca DB 직접 쓰기 (pacaPool 사용)
- 상태: present / absent / late / excused
- 권한: staff 이상 (verifyToken)

### FR-02: 출석체크 UI
- 기존 반배치(assignments) 페이지 내에서 출석 버튼 추가
  - 이유: 반배치 화면에 이미 시간대별 학생 목록이 있음
  - 출석 상태 토글: 출석(present) ↔ 결석(absent)
  - 지각(late), 사유결석(excused) 옵션 제공
- 또는 별도 출석체크 전용 페이지 (태블릿 최적화)

### FR-03: 실시간 동기화
- Peak에서 출석 체크 → Paca attendance 테이블 UPDATE
- 대상: `attendance.attendance_status` 업데이트
- paca_attendance_id가 이미 daily_assignments에 저장되어 있음
- Socket.io로 다른 클라이언트에도 즉시 반영

### FR-04: 일괄 출석체크
- 시간대별 전체 출석 처리 (한 번에 present 처리)
- 개별 변경도 가능

## 기술 분석

### DB 연동 흐름
```
Peak UI → Peak API → Paca DB (attendance 테이블)
                   ↘ Peak DB (daily_assignments.status 업데이트 가능)
```

### Paca attendance 테이블 구조
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| class_schedule_id | int | 수업 일정 ID |
| student_id | int | 학생 ID (paca student) |
| attendance_status | enum | present/absent/late/excused |
| is_makeup | tinyint | 보충 여부 |
| notes | text | 비고 |
| recorded_by | int | 기록자 user ID |

### 핵심 연결 포인트
- Peak `daily_assignments.paca_attendance_id` → Paca `attendance.id`
- Peak `students.paca_student_id` → Paca `students.id`
- assignments/sync에서 이미 paca_attendance_id를 저장하고 있음

## 구현 범위

### Backend (backend/routes/)
1. `attendance.js` 확장 - 학생 출석 API 추가
   - `POST /peak/attendance/student` - 개별 출석 체크
   - `POST /peak/attendance/student/batch` - 일괄 출석 체크
   - `GET /peak/attendance/students` - 학생 출석 현황 조회

### Frontend (src/app/)
2. 출석체크 UI - 2가지 옵션 중 택 1
   - **Option A**: assignments 페이지에 출석 모드 추가
   - **Option B**: 별도 student-attendance 페이지 신규 생성
   → 태블릿에서 주로 사용하므로 **Option B 권장** (간결한 UI)

### Tablet
3. `src/app/tablet/attendance/` - 이미 강사 출근용 존재
   - 학생 출석체크 탭 추가 또는 별도 페이지

## 우선순위
1. 🔴 Backend API (Paca 연동) - 핵심
2. 🔴 태블릿 출석체크 UI - 실제 사용 환경
3. 🟡 PC 출석체크 UI
4. 🟢 일괄 출석 / 통계

## 리스크
- Paca DB 직접 쓰기 시 데이터 정합성 (트랜잭션 필요)
- paca_attendance_id가 NULL인 학생 처리 (sync 안 된 경우)
- Paca 측에서도 동시에 출석 체크하는 경우 (race condition)

## 일정 (예상)
- Backend API: 1시간
- 태블릿 UI: 2시간
- PC UI: 1시간
- 테스트: 1시간
