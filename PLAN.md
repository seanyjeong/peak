# 일산맥스 트레이닝 AI - 구현 계획

## Phase 1: 기본 시스템 (MVP)

### 1.1 DB 스키마
```sql
-- 트레이너
trainers (id, name, phone, active)

-- 학생
students (id, name, gender, phone, join_date, status)

-- 학생 기록 (정기 측정)
student_records (
  id, student_id, measured_at,
  standing_jump,      -- 제자리멀리뛰기 (cm)
  medicine_ball,      -- 메디신볼 (m)
  shuttle_run,        -- 20m왕복 (초)
  flexibility         -- 좌전굴 (cm)
)

-- 일일 출근
daily_attendance (id, date, trainer_id)

-- 일일 훈련 계획
daily_plans (
  id, date, trainer_id,
  tags,           -- ["하체파워", "민첩성"]
  description     -- 자유 텍스트
)

-- 반 배치
daily_assignments (
  id, date, student_id, trainer_id,
  status          -- 'training' | 'rest' | 'injury'
)

-- 훈련 기록 (학생별)
training_logs (
  id, date, student_id, trainer_id,
  plan_id,        -- daily_plans 참조
  condition,      -- 1~5
  notes           -- 개인 메모
)
```

### 1.2 화면 목록

1. **대시보드** - 오늘 현황
2. **트레이너 출근** - 체크박스
3. **훈련 계획** - 트레이너별 작성
4. **반 배치** - 드래그앤드롭 보드
5. **훈련 기록** - 트레이너별 입력
6. **학생 목록** - 전체 학생
7. **학생 상세** - 개인 히스토리, 기록 변화
8. **기록 측정** - 정기 측정 입력
9. **통계/분석** - (Phase 2)

---

## Phase 2: 데이터 분석

- 학생별 기록 변화 그래프
- 훈련 패턴 vs 기록 향상 상관관계
- 비슷한 학생 비교

---

## Phase 3: AI 추천

- 훈련 조합 추천
- 기록 예측
- 개인 맞춤 프로그램

---

## 우선순위

1. 반 배치 (드래그앤드롭) - 핵심 기능
2. 훈련 계획/기록 시스템
3. 학생 프로필 & 히스토리
4. 기록 측정 & 변화 추적
5. 분석/통계 (데이터 쌓인 후)

---

## 개발 순서

```
Week 1-2: 프로젝트 셋업 & DB
Week 3-4: 트레이너/학생 기본 CRUD
Week 5-6: 반 배치 드래그앤드롭
Week 7-8: 훈련 계획 & 기록
Week 9-10: 학생 프로필 & 히스토리
Week 11-12: 기록 측정 & 그래프
```
