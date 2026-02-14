# 반배치 프리셋 시스템 (Class Preset System)

## 개요
현재 반배치는 매일 수동으로 강사→반→학생을 드래그&드롭으로 배치하는 방식이다.
학원 운영 형태에 따라 **자동 반배치** 옵션을 추가한다.

## 문제 정의
- 담임제 학원: 매일 같은 강사-학생 조합인데 매번 수동 배치
- 대학별 분류 학원: 숭실대반, 동국대반 등 고정 그룹인데 매번 수동 배치
- 학원마다 운영 방식이 다르므로 **모두 선택적**이어야 함

## 핵심 요구사항

### 1. 프리셋 관리 페이지 (사이드메뉴 추가)
- 새 사이드메뉴: "반 프리셋" (PC/Tablet)
- 학원별 프리셋 생성/수정/삭제
- 프리셋 타입:
  - **담임제 (homeroom)**: 강사 기준 학생 그룹
  - **그룹별 (group)**: 이름 기준 학생 그룹 (대학별, 레벨별 등)

### 2. 담임제 프리셋
- 강사별로 담당 학생 목록을 미리 지정
- 예: 김코치 → [학생A, 학생B, 학생C]
- 강사-학생 매핑 UI (드래그 or 선택)

### 3. 그룹별 프리셋
- 자유로운 그룹 이름 설정 (숭실대반, 동국대반, A레벨, B레벨 등)
- 각 그룹에 강사 배정 (선택사항)
- 각 그룹에 학생 배정

### 4. 반배치 페이지 연동
- 기존 반배치 페이지에 **프리셋 적용 버튼** 추가
- "담임제 배치" 버튼 → 담임제 프리셋 기반 자동 배치
- "그룹별 배치" 버튼 → 그룹 프리셋 기반 자동 배치
- 자동 배치 후에도 **드래그&드롭으로 수동 조정 가능** (기존 기능 유지)
- 프리셋이 없으면 버튼 비활성화 or 미표시

### 5. 자동 배치 로직
- 프리셋 적용 시:
  1. 현재 배치 초기화 (해당 시간대)
  2. 프리셋 그룹별로 반 생성
  3. 강사 배치 (지정된 강사가 출근한 경우만)
  4. 학생 배치 (오늘 출석 예정인 학생만)
  5. 미매칭 학생은 대기 영역에 남김
- 이미 배치된 상태에서 프리셋 적용 시 확인 다이얼로그

## DB 설계 (초안)

```sql
-- 프리셋 정의
CREATE TABLE class_presets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM(homeroom, group) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_academy (academy_id)
);

-- 프리셋 내 그룹
CREATE TABLE preset_groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    preset_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    instructor_id INT,
    order_num INT DEFAULT 0,
    FOREIGN KEY (preset_id) REFERENCES class_presets(id) ON DELETE CASCADE
);

-- 그룹별 학생
CREATE TABLE preset_group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    student_id INT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES preset_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_group_student (group_id, student_id)
);
```

## 구현 범위

### Phase 1: 백엔드 API
- `backend/routes/presets.js` 신규
  - CRUD: 프리셋, 그룹, 멤버
  - POST /peak/presets/apply - 프리셋 적용 (자동 배치)
- `backend/peak.js` 라우트 등록
- DB 마이그레이션 (3개 테이블)

### Phase 2: 프리셋 관리 페이지
- `src/app/(pc)/presets/page.tsx` - PC 프리셋 관리
- `src/app/tablet/presets/page.tsx` - Tablet 프리셋 관리
- 프리셋 CRUD UI
- 그룹 관리 + 학생 배정 UI (드래그 or 체크박스)
- 사이드메뉴에 "반 프리셋" 추가

### Phase 3: 반배치 페이지 연동
- 기존 `assignments/page.tsx`에 프리셋 적용 버튼 추가 (PC + Tablet)
- 프리셋 선택 모달/드롭다운
- 적용 확인 다이얼로그
- 적용 후 기존 D&D 유지

## 의존성
- 기존 반배치 시스템 (`assignments.js`, `daily_assignments`, `class_instructors`)
- Paca 동기화 (학생/강사 목록)
- @dnd-kit (기존 사용중)
- Socket.io (실시간 동기화)

## 비기능 요구사항
- 프리셋 적용은 1초 이내
- 학원별 프리셋 최대 10개
- 그룹당 학생 최대 50명
- 기존 반배치 기능에 영향 없어야 함

## 리스크
- 프리셋 학생이 오늘 결석인 경우 처리
- 프리셋 강사가 오늘 미출근인 경우 처리
- 프리셋 적용 vs 수동 배치 충돌
- 학생 추가/퇴원 시 프리셋 자동 정리

## 우선순위
1. DB + API (필수)
2. PC 프리셋 관리 페이지 (필수)
3. 반배치 연동 - 적용 버튼 (필수)
4. Tablet 프리셋 관리 (중요)
5. Tablet 반배치 연동 (중요)
