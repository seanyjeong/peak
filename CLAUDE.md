# CLAUDE.md - P-EAK (피크)

## 프로젝트 개요

**P-EAK** = **P**hysical **E**xcellence **A**chievement **K**eeper
체육 성과 기록 관리 시스템

### 이름 의미
- **Physical** = 체육, 신체
- **Excellence** = 탁월함, 우수함
- **Achievement** = 성과, 기록
- **Keeper** = 관리자, 기록 보관자

### Peak (피크) 의미
- **정점, 최고점** - 기록의 정점을 향해
- **산봉우리** - 목표를 향한 도전
- "피크 컨디션" - 최상의 상태
- "피크를 찍다" - 최고 기록 달성

### P-ACA 자매 시스템
| 시스템 | 발음 | 역할 |
|--------|------|------|
| P-ACA | 파카 | 학원 종합관리 |
| P-EAK | 피크 | 실기 훈련관리 |

> "**파카**로 학원 관리, **피크**로 기록 정점!"

---

## 현재 버전: v1.6.0

## 버전 정책

**⚠️ 중요: 커밋/푸시 전 반드시 버전 업데이트!**

| 자리 | 의미 | 예시 |
|------|------|------|
| **첫째 (Major)** | 큰 기능 추가 | 새 페이지, 새 시스템 |
| **둘째 (Minor)** | 기존 기능에 소규모 추가 | 탭 추가, 필터 추가 |
| **셋째 (Patch)** | 버그 수정 | 에러 수정, UI 수정 |

**버전 업데이트 위치**:
- `package.json` → `"version": "x.x.x"`
- `src/app/(pc)/layout.tsx` → `const APP_VERSION = 'vx.x.x'`

---

## 기술 스택

- **프론트**: Next.js 16 + React 19 + TailwindCSS 4 + dnd-kit
- **백엔드**: Express.js 5 + MySQL (mysql2)
- **인증**: JWT (P-ACA 연동)
- **차트**: Recharts
- **배포**: Vercel (프론트) + systemd (백엔드)

---

## 백엔드 인프라

### 서비스 구조
```
인터넷 → chejump.com/peak/* → Caddy → localhost:8330 (peak.service)
```

### Caddy 설정 (/etc/caddy/Caddyfile)
```
chejump.com {
    handle /peak/* {
        reverse_proxy localhost:8330
    }
    handle {
        reverse_proxy localhost:8320  # P-ACA
    }
}
```

### systemd 서비스
| 항목 | 값 |
|------|-----|
| 서비스 파일 | `/etc/systemd/system/peak.service` |
| 백엔드 코드 | `/home/sean/ilsanmaxtraining/backend/peak.js` |
| 포트 | 8330 |
| 로그 | `journalctl -u peak` |

### 서버 명령어
```bash
# 백엔드 재시작 (비밀번호 자동 입력)
echo 'q141171616!' | sudo -S systemctl restart peak

# 로그 실시간 확인
echo 'q141171616!' | sudo -S journalctl -u peak -f

# 상태 확인
systemctl status peak

# Caddy 재시작 (설정 변경 시)
echo 'q141171616!' | sudo -S systemctl restart caddy
```

### sudo 팁 (안 될 때)
```bash
# -k 옵션으로 캐시 초기화
echo 'q141171616!' | sudo -S -k systemctl restart peak

# 여러 명령 연속 실행
echo 'q141171616!' | sudo -S sh -c "systemctl stop peak && systemctl start peak"
```

**⚠️ 주의**: 백엔드 코드 수정 후 반드시 `sudo systemctl restart peak` 실행!

---

## 핵심 기술 구현

### 1. P-ACA 동기화 (반 배치)
**파일**: `backend/routes/assignments.js`

```javascript
// POST /peak/assignments/sync
// 기존 배치(trainer_id) 유지하면서 P-ACA 학생 동기화
// - 새 학생: INSERT (trainer_id = NULL)
// - 기존 학생: trainer_id 유지
// - 취소된 학생: DELETE
```

**로직**:
1. 기존 배치를 `student_id + time_slot`로 맵핑
2. P-ACA에서 학생 목록 조회
3. 기존에 있으면 `trainer_id` 유지, 없으면 새로 추가
4. P-ACA에 없는 학생은 삭제

### 2. 기록 측정 UPSERT
**파일**: `backend/routes/records.js`

```javascript
// POST /peak/records/batch
// 하루에 한 종목당 최고 기록만 저장
// direction: 'higher' → 높을수록 좋음 (멀리뛰기)
// direction: 'lower' → 낮을수록 좋음 (달리기)
```

**로직**:
1. 같은 날짜, 학생, 종목 기록 조회
2. `direction`에 따라 비교
3. 더 좋은 기록이면 UPDATE, 아니면 무시

### 3. 드래그앤드롭 (반 배치)
**파일**: `src/app/(pc)/assignments/page.tsx`

```javascript
// dnd-kit 사용
// collisionDetection: pointerWithin (정확한 마우스 위치 감지)
// closestCorners는 가로 배열에서 부정확함
```

### 4. 시간대 설정 (P-ACA 연동)
**파일**: `backend/routes/assignments.js`

```sql
-- P-ACA academy_settings에서 시간대 조회
SELECT morning_class_time, afternoon_class_time, evening_class_time
FROM academy_settings WHERE academy_id = 2
```

**응답에 포함**:
```json
{
  "timeSlots": {
    "morning": "09:30-12:00",
    "afternoon": "14:00-18:00",
    "evening": "18:30-21:00"
  }
}
```

### 5. 역할 표시명
```javascript
// 모든 페이지에서 동일하게 사용
const getRoleDisplayName = (role, position) => {
  if (position) return position;  // position 우선
  switch (role) {
    case 'owner': return '원장';
    case 'admin': return '관리자';
    case 'staff': return '강사';
    default: return '강사';
  }
};
```

---

## DB 스키마

### peak DB
```sql
-- 학생
students (
  id, paca_student_id, name, gender, school, grade,
  is_trial, trial_total, trial_remaining, status
)

-- 종목 관리
record_types (
  id, name, short_name, unit, direction, is_active, display_order
)
-- direction: 'higher' (높을수록 좋음) / 'lower' (낮을수록 좋음)

-- 배점표
score_tables (
  id, record_type_id, max_score, min_score, score_step, value_step,
  male_perfect, female_perfect
)
score_ranges (
  id, score_table_id, score, male_min, male_max, female_min, female_max
)

-- 학생 기록
student_records (
  id, student_id, record_type_id, value, measured_at
)
-- UNIQUE KEY (student_id, record_type_id, measured_at) 하루 한 기록

-- 수업 기록
training_logs (
  id, date, student_id, trainer_id, condition_score, notes
)

-- 반 배치
daily_assignments (
  id, date, time_slot, student_id, trainer_id, paca_attendance_id,
  status, order_num
)
-- UNIQUE KEY uk_date_slot_student (date, time_slot, student_id)

-- 운동 관리
exercises (id, name, tags JSON, default_sets, default_reps, description)
exercise_tags (id, tag_id, label, color, display_order, is_active)
exercise_packs (id, name, description, version, author)
exercise_pack_items (id, pack_id, exercise_id, display_order)

-- 수업 계획
daily_plans (
  id, date, time_slot, instructor_id, trainer_id,
  focus_areas, exercises JSON, notes
)
```

### P-ACA 연동 테이블 (paca DB)
```sql
-- 강사 스케줄
instructor_schedules (instructor_id, work_date, time_slot, academy_id)

-- 출근 체크
instructor_attendance (instructor_id, check_in_time, work_date, academy_id)

-- 강사 정보
instructors (id, name, user_id, academy_id)
-- name은 암호화됨 → decrypt() 필요

-- 학원 설정 (시간대 등)
academy_settings (
  academy_id, morning_class_time, afternoon_class_time, evening_class_time, ...
)
```

---

## API 엔드포인트

### 인증
| Method | Path | 설명 |
|--------|------|------|
| POST | `/peak/auth/login` | P-ACA 로그인 |

### 반 배치
| Method | Path | 설명 |
|--------|------|------|
| GET | `/peak/assignments?date=YYYY-MM-DD` | 반 배치 + timeSlots |
| POST | `/peak/assignments/sync` | P-ACA 동기화 (trainer_id 유지) |
| PUT | `/peak/assignments/:id` | 학생 배치 변경 |

### 기록 측정
| Method | Path | 설명 |
|--------|------|------|
| GET | `/peak/records/by-date?date=&student_ids=` | 날짜별 기록 조회 |
| POST | `/peak/records/batch` | 기록 일괄 저장 (UPSERT) |

### 수업 기록
| Method | Path | 설명 |
|--------|------|------|
| GET | `/peak/training?date=` | 수업 기록 조회 |
| PUT | `/peak/training/:id` | 컨디션/메모 저장 |

### 종목/배점표
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/peak/record-types` | 종목 CRUD |
| GET/POST | `/peak/score-tables` | 배점표 CRUD |

### 운동/팩
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/peak/exercises` | 운동 CRUD |
| GET/POST | `/peak/exercise-tags` | 태그 CRUD (admin) |
| GET/POST | `/peak/exercise-packs` | 팩 CRUD |
| GET | `/peak/exercise-packs/:id/export` | 팩 JSON 내보내기 |
| POST | `/peak/exercise-packs/import` | 팩 JSON 가져오기 |

---

## 버전 히스토리

### v1.6.0 (2025-12-21)
- **용어 통일**: '코치' → '강사' 전체 변경
- **대시보드 시간대**: P-ACA 설정 연동 (하드코딩 제거)
- **드래그앤드롭**: `pointerWithin` 충돌감지로 정확도 개선
- **P-ACA 동기화**: 기존 배치(trainer_id) 유지하면서 동기화

### v1.5.x (2025-12-20)
- **v1.5.0**: 기록측정 UPSERT (하루 최고기록만 저장)
- **v1.5.1**: 반 배치 날짜 선택 기능
- **v1.5.2**: daily_assignments unique key 수정 (date, time_slot, student_id)

### v1.2.0 (2025-12-20)
- 학생 기록 그래프 UI (Recharts)
- 종목별 버튼 → 그래프 표시

### v1.1.x (2025-12-20)
- v1.1.0: 팩 불러오기 (운동 목록 교체)
- v1.1.1: 배점표 버그 수정
- v1.1.2: 기록측정/수업기록 시간대 탭
- v1.1.3: 기록측정 자동저장
- v1.1.4: 종목 줄임말 시스템

### v1.0.0 (2025-12-20)
- 태그/팩 동적 관리
- 학생 관리 개선 (탭별 인원수)

---

## 권한 체계

| 기능 | staff (강사) | owner (원장) | admin (시스템) |
|------|-------------|--------------|----------------|
| 설정 메뉴 | ❌ | ✅ | ✅ |
| 운동/팩 관리 | ❌ | ✅ | ✅ |
| **태그 관리** | ❌ | ❌ | ✅ |
| 수업 계획 (자기) | ✅ | ✅ | ✅ |
| 수업 계획 (전체) | ❌ | ✅ | ✅ |
| 기록 측정 (자기 반) | ✅ | ✅ | ✅ |
| 기록 측정 (전체) | ❌ | ✅ | ✅ |

---

## 개발 명령어

```bash
# 프론트 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# 백엔드 재시작
echo 'q141171616!' | sudo -S systemctl restart peak

# DB 접속
mysql -u paca -pq141171616! peak

# 로그 확인
echo 'q141171616!' | sudo -S journalctl -u peak -f
```

---

## 로그인 정보

- **이메일**: sean8320@naver.com
- **비밀번호**: q141171616!
- **역할**: admin (시스템 관리자)

---

## TODO

### 우선순위 높음
- [ ] 학생 기록에 점수 자동 계산 연동
- [ ] 수업 기록 체크리스트 UI (계획된 운동 체크)

### 추가 기능
- [ ] 부상 관리
- [ ] 알림 시스템
- [ ] 통계/분석 대시보드
- [ ] 모바일 PWA 최적화
