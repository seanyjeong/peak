# 반배치 프리셋 시스템 - Design Document

## 1. DB 스키마

### 1.1 신규 테이블 (기존 테이블 변경 없음)

```sql
CREATE TABLE IF NOT EXISTS class_presets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('"'"'homeroom'"'"', '"'"'group'"'"') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_academy (academy_id)
);

CREATE TABLE IF NOT EXISTS preset_groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    preset_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    instructor_id INT DEFAULT NULL,
    order_num INT DEFAULT 0,
    FOREIGN KEY (preset_id) REFERENCES class_presets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS preset_group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    student_id INT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES preset_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_group_student (group_id, student_id)
);
```

## 2. API 설계

### 2.1 신규 라우트: `backend/routes/presets.js`

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /peak/presets | 학원의 프리셋 목록 (그룹+멤버 포함) |
| POST | /peak/presets | 프리셋 생성 |
| PUT | /peak/presets/:id | 프리셋 수정 (이름, 활성화) |
| DELETE | /peak/presets/:id | 프리셋 삭제 (CASCADE) |
| POST | /peak/presets/:id/groups | 그룹 추가 |
| PUT | /peak/presets/groups/:groupId | 그룹 수정 (이름, 강사) |
| DELETE | /peak/presets/groups/:groupId | 그룹 삭제 (CASCADE) |
| POST | /peak/presets/groups/:groupId/members | 학생 추가 (batch) |
| DELETE | /peak/presets/groups/:groupId/members | 학생 제거 (batch) |
| POST | /peak/presets/:id/apply | **프리셋 적용 (자동 반배치)** |

### 2.2 핵심 API 상세

#### GET /peak/presets
```json
// Response
{
  "success": true,
  "presets": [
    {
      "id": 1,
      "name": "담임제",
      "type": "homeroom",
      "is_active": true,
      "groups": [
        {
          "id": 1,
          "name": "김코치반",
          "instructor_id": 5,
          "instructor_name": "김코치",
          "order_num": 0,
          "members": [
            { "student_id": 10, "name": "홍길동", "gender": "M", "grade": "중2" }
          ]
        }
      ]
    }
  ]
}
```

#### POST /peak/presets/:id/apply
```json
// Request
{
  "date": "2026-02-14",
  "time_slot": "evening"
}

// Response
{
  "success": true,
  "result": {
    "classes_created": 3,
    "students_assigned": 18,
    "students_unmatched": 2,
    "instructors_absent": 1
  }
}
```

**적용 로직:**
1. 해당 시간대 기존 배치 초기화 (기존 reset 로직 재사용)
2. 프리셋의 각 그룹별로:
   a. 강사가 오늘 출근했는지 확인 (Paca instructor_schedules)
   b. 출근 강사 → class_instructors에 주강사로 등록
   c. 그룹 학생 중 오늘 daily_assignments에 있는 학생만 → class_id 배정
3. 미매칭 학생(프리셋에 없는 오늘의 학생)은 대기 영역에 남김
4. Socket.io broadcast

## 3. 프론트엔드 설계

### 3.1 파일 구조
```
src/app/(pc)/presets/page.tsx          # PC 프리셋 관리 (신규)
src/app/tablet/presets/page.tsx        # Tablet 프리셋 관리 (신규)
src/app/(pc)/assignments/page.tsx      # 기존 - 프리셋 적용 버튼만 추가
src/app/tablet/assignments/page.tsx    # 기존 - 프리셋 적용 버튼만 추가
```

### 3.2 PC 프리셋 관리 페이지 (`/presets`)

```
┌──────────────────────────────────────────────────────────┐
│ 반 프리셋                              [+ 새 프리셋]    │
├──────────────────────────────────────────────────────────┤
│ [담임제 ▼] [대학별 ▼]  ← 프리셋 탭                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  미배정 학생                                             │
│  ┌──────────────────────────────────────────────┐       │
│  │ [학생A] [학생B] [학생C] ...   (드래그 가능)  │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  그룹 목록                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐    │
│  │ 김코치반 │ │ 박코치반 │ │ 이코치반 │ │ + 그룹 │    │
│  │ 강사:김  │ │ 강사:박  │ │ 강사:이  │ │  추가  │    │
│  │ [학생D]  │ │ [학생G]  │ │ [학생J]  │ └────────┘    │
│  │ [학생E]  │ │ [학생H]  │ │ [학생K]  │               │
│  │ [학생F]  │ │ [학생I]  │ │          │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                          │
│  ← 학생을 그룹 사이에서 드래그 가능                      │
│  ← 미배정 학생도 그룹으로 드래그 가능                     │
└──────────────────────────────────────────────────────────┘
```

**핵심 컴포넌트:**
- `PresetTabs`: 프리셋 선택 탭 (활성 프리셋 전환)
- `UnassignedStudents`: 아직 그룹에 안 들어간 학생 목록
- `GroupColumn`: 그룹 카드 (이름 편집, 강사 선택, 학생 목록)
- `AddGroupZone`: 새 그룹 추가 영역
- D&D: @dnd-kit 사용 (기존 assignments와 동일 패턴)

**담임제 그룹 생성 플로우:**
1. "새 그룹" 클릭
2. 강사 선택 드롭다운 (Paca 강사 목록)
3. 그룹 이름 자동 생성: "{강사이름}반"
4. 학생 드래그하여 배정

**그룹별 그룹 생성 플로우:**
1. "새 그룹" 클릭
2. 그룹 이름 직접 입력 (숭실대반, A레벨 등)
3. 강사 배정 선택사항
4. 학생 드래그하여 배정

### 3.3 반배치 페이지 수정 (최소 변경)

기존 Header 영역에 버튼 1개만 추가:

```
┌──────────────────────────────────────────────────────────┐
│ 반 배치  2월 14일(금)                                    │
│                                                          │
│ [달력] [배정 12/15명] [프리셋 적용 ▼] [초기화] [새로고침]│
│                          ↑ 이것만 추가                   │
└──────────────────────────────────────────────────────────┘
```

**"프리셋 적용" 버튼 클릭 시:**
1. 활성 프리셋 목록 드롭다운 표시
2. 프리셋 선택
3. 확인 모달: "담임제 프리셋을 적용하시겠습니까? 현재 {시간대} 배치가 초기화됩니다."
4. 확인 → POST /presets/:id/apply
5. 데이터 리페치 → 자동 배치 완료
6. 미매칭 학생은 대기 영역에 표시

### 3.4 사이드메뉴 추가

PC `layout.tsx`:
```typescript
// 반 배치 다음에 추가
{ name: 반 프리셋, href: /presets, icon: Layers },
```

Tablet `layout.tsx`:
```typescript
// 동일하게 추가
```

## 4. 구현 순서

### Step 1: DB 마이그레이션
- SSH로 MySQL 직접 실행 (3개 CREATE TABLE)
- 소요: ~5분

### Step 2: 백엔드 API (`backend/routes/presets.js`)
- CRUD 전체 + apply 엔드포인트
- `backend/peak.js`에 라우트 등록
- 소요: 핵심 파일 1개

### Step 3: PC 프리셋 관리 페이지
- `src/app/(pc)/presets/page.tsx`
- D&D 학생 배정 UI
- 그룹 CRUD
- PC layout 메뉴 추가
- 소요: 핵심 파일 1개 + layout 수정

### Step 4: 반배치 연동 (PC)
- `src/app/(pc)/assignments/page.tsx` 수정
- 프리셋 적용 버튼 + 드롭다운 + 확인 모달
- 소요: 기존 파일 수정 (최소 변경)

### Step 5: Tablet 동일 적용
- `src/app/tablet/presets/page.tsx`
- `src/app/tablet/assignments/page.tsx` 수정
- Tablet layout 메뉴 추가
- 소요: PC와 유사한 구조

## 5. 에러 처리

| 시나리오 | 처리 |
|----------|------|
| 프리셋 강사가 미출근 | 해당 그룹은 강사 없이 반 생성, 토스트 알림 |
| 프리셋 학생이 오늘 결석 | 대기 영역에 결석 표시, 반에 미배정 |
| 프리셋 학생이 오늘 스케줄에 없음 | 무시 (daily_assignments에 없는 학생) |
| 중복 적용 | 항상 초기화 후 적용 (confirm 필수) |
| 프리셋이 비어있음 | "그룹이 없습니다" 안내 |

## 6. 기존 시스템 영향도

| 항목 | 영향 |
|------|------|
| daily_assignments 테이블 | 변경 없음 |
| class_instructors 테이블 | 변경 없음 |
| assignments.js API | 변경 없음 |
| assignments/page.tsx | 버튼 1개 추가만 |
| Socket.io | 기존 broadcast 재사용 |
| Paca 연동 | 기존 sync 로직 그대로 |
