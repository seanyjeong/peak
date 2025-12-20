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

## 현재 버전: v1.4.1

## 버전 정책

**⚠️ 중요: 커밋/푸시 전 반드시 버전 업데이트!**

| 자리 | 의미 | 예시 |
|------|------|------|
| **첫째 (Major)** | 큰 기능 추가 | 새 페이지, 새 시스템 |
| **둘째 (Minor)** | 기존 기능에 소규모 추가 | 탭 추가, 필터 추가 |
| **셋째 (Patch)** | 버그 수정 | 에러 수정, UI 수정 |

```
v1.0.0 → v1.0.1 (버그 수정)
v1.0.1 → v1.1.0 (소규모 기능 추가)
v1.1.0 → v2.0.0 (대규모 기능 추가)
```

## 기술 스택

- **프론트**: Next.js 16 + TailwindCSS + dnd-kit
- **백엔드**: Express.js + MySQL
- **배포**: Vercel + 로컬서버 (P-ACA와 동일)

---

## 백엔드 인프라

### 서비스 구조
```
chejump.com/peak/* → Caddy → localhost:8330 (peak.service)
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
- **서비스 파일**: `/etc/systemd/system/peak.service`
- **백엔드 코드**: `/home/sean/ilsanmaxtraining/backend/peak.js`
- **포트**: 8330

### 자주 쓰는 명령어
```bash
# 재시작 (sudo 비밀번호 자동 입력)
echo 'q141171616!' | sudo -S systemctl restart peak

# 로그 확인
echo 'q141171616!' | sudo -S journalctl -u peak -f

# 상태 확인
systemctl status peak
```

### sudo 팁 (안 될 때)
```bash
# -k 옵션 추가하면 캐시된 자격증명 초기화되어 더 안정적
echo 'q141171616!' | sudo -S -k systemctl restart peak

# 여러 명령 연속 실행 시 sh -c 사용
echo 'q141171616!' | sudo -S sh -c "systemctl stop peak && systemctl start peak"
```

**⚠️ 주의**: 백엔드 코드 수정 후 반드시 `sudo systemctl restart peak` 실행!

---

## 완료된 기능 (2025-12-20)

### 페이지
| 페이지 | 기능 |
|--------|------|
| /dashboard | 대시보드 (오늘 현황, 코치/학생 수) |
| /attendance | 코치 출근 체크 (P-ACA 연동, 시간대별 탭) |
| /assignments | 반 배치 (드래그앤드롭, 시간대별) |
| /plans | 수업 계획 (P-ACA 연동, 날짜/시간대, 권한별) |
| /training | 수업 기록 (컨디션/메모) |
| /records | 기록 측정 입력 |
| /students | 학생 관리 (전체/체험생 필터) |
| /settings | 설정 (종목/배점표/운동/태그/팩 관리) |

### 핵심 시스템
- [x] P-ACA 인증 연동 (JWT)
- [x] P-ACA 스케줄 연동 (instructor_schedules)
- [x] 동적 종목 시스템 (학원별 커스텀)
- [x] 자동 배점표 생성 (만점/최소/급간/감점단위)
- [x] 남/여 별도 배점, higher/lower 방향 지원

### v1.1.x 변경사항 (2025-12-20)
- [x] **v1.1.0** 팩 불러오기 기능 - 운동 목록을 팩 스냅샷으로 교체
- [x] **v1.1.1** 배점표 버그 수정 - toFixed 에러, score_step=0 무한루프
- [x] **v1.1.2** 기록측정/수업기록 페이지 개선
  - 시간대 탭 추가 (오전반/오후반/저녁반)
  - 롤 표시 통일 (원장/코치)
  - 원장은 모든 학생 측정 가능
- [x] **v1.1.3** 기록측정 UX 개선
  - 강사 선택 드롭다운 제거 (원장은 전체 학생, 강사는 자기 반)
  - 자동저장 (입력 후 blur 시 자동 저장)
  - 학생 기록 조회 버그 수정 (measured_at 타입 처리)
- [x] **v1.1.4** 종목 줄임말 시스템
  - DB에 short_name 컬럼 추가
  - 자동 줄임말 생성 (종목 추가/수정 시)
- [x] **v1.2.0** 학생 기록 그래프 UI
  - 종목별 버튼 클릭 → 그래프 표시
  - 평균선, 기록 목록 표시
  - 테이블 히스토리 → 인터랙티브 차트로 변경

### v1.0.0 신규 기능 (2025-12-20)
- [x] **태그 동적 관리** - DB 기반 태그 CRUD (시스템 admin 전용)
- [x] **운동 팩 시스템** - 운동 묶음 생성/내보내기/가져오기
  - JSON 형식으로 다른 학원과 공유 가능
  - 가져오기 시 태그 + 운동 자동 등록
- [x] **메뉴 네이밍 변경** - 훈련 → 수업
- [x] **학생 관리 개선**
  - 탭별 인원수 표시 (전체/재원/휴원/부상/체험생)
  - 휴원생 동기화 지원 (P-ACA paused → P-EAK inactive)
  - 체험생 정확도 개선 (미등록관리 제외, status='trial'만 체험생)

### 권한 체계
| 기능 | staff (코치) | owner (원장) | admin (시스템) |
|------|-------------|--------------|----------------|
| 설정 메뉴 | ❌ | ✅ | ✅ |
| 운동 목록 관리 | - | ✅ | ✅ |
| 운동 팩 관리 | - | ✅ | ✅ |
| **태그 관리** | - | ❌ | ✅ |
| 수업 계획 (자기 것) | ✅ | ✅ | ✅ |
| 수업 계획 (전체) | ❌ | ✅ | ✅ |

---

## DB 테이블

### peak DB
```sql
-- 종목 관리
record_types (id, name, unit, direction, is_active, display_order)

-- 배점표
score_tables (id, record_type_id, max_score, min_score, score_step, value_step, male_perfect, female_perfect)
score_ranges (id, score_table_id, score, male_min, male_max, female_min, female_max)

-- 학생 기록
student_records (id, student_id, record_type_id, value, measured_at)
training_logs (id, date, student_id, trainer_id, condition_score, notes)

-- 반 배치
daily_assignments (id, date, time_slot, student_id, trainer_id)

-- 운동 관리 (v0.5.0)
exercises (id, name, tags JSON, default_sets, default_reps, description)
exercise_tags (id, tag_id, label, color, display_order, is_active)
exercise_packs (id, name, description, version, author)
exercise_pack_items (id, pack_id, exercise_id, display_order)

-- 수업 계획
daily_plans (id, date, time_slot, instructor_id, trainer_id, focus_areas, exercises, notes)
```

### P-ACA 연동 테이블 (paca DB)
```sql
instructor_schedules (instructor_id, work_date, time_slot, academy_id)
instructor_attendance (instructor_id, check_in_time, work_date, academy_id)
instructors (id, name, user_id, academy_id)
```

---

## API 엔드포인트

### 인증
- POST `/peak/auth/login` - P-ACA 로그인

### 운동 관리 (v0.5.0)
- GET/POST `/peak/exercises` - 운동 목록/추가
- PUT/DELETE `/peak/exercises/:id` - 수정/삭제
- GET/POST `/peak/exercise-tags` - 태그 관리 (admin 전용)
- GET/POST `/peak/exercise-packs` - 팩 관리
- GET `/peak/exercise-packs/:id/export` - 팩 내보내기 (JSON)
- POST `/peak/exercise-packs/import` - 팩 가져오기

### 기타
- GET/POST `/peak/record-types` - 종목 관리
- GET/POST `/peak/score-tables` - 배점표 관리
- GET/POST `/peak/assignments` - 반 배치
- GET/POST `/peak/plans` - 수업 계획
- GET/POST `/peak/training` - 수업 기록
- GET `/peak/students` - 학생 목록

---

## TODO (다음 작업)

### 우선순위 높음
- [x] /records 페이지 개선 (시간대 탭, 롤 표시, 권한)
- [ ] 학생 기록에 점수 자동 계산 연동
- [ ] 기록 변화 그래프 (학생 프로필)

### 추가 기능
- [ ] 부상 관리
- [ ] 알림 시스템
- [ ] 통계/분석 대시보드
- [ ] 모바일 PWA 최적화

---

## 명령어

```bash
# 프론트 개발 서버
npm run dev

# 백엔드 재시작
sudo systemctl restart peak

# DB 접속
mysql -u paca -p peak

# 빌드
npm run build
```

---

## 로그인 정보

- **이메일**: sean8320@naver.com
- **비밀번호**: q141171616!
- **역할**: admin (시스템 관리자)
