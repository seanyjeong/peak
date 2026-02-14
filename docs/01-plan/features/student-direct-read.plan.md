# Plan: Student Direct Read (학생 데이터 파카 직접 참조)

## 개요

Peak의 `students` 테이블을 제거하고, 파카(Paca) DB의 학생 데이터를 직접 참조하는 구조로 전환한다.
현재 싱크 방식은 데이터 불일치, 상태 변환 버그, 스케일링 문제를 유발하므로 50개 학원 확장 전에 근본적으로 해결해야 한다.

## 현재 문제

1. **데이터 불일치**: 파카에서 상태 변경 시 Peak에 즉시 반영 안 됨 (수동 싱크 필요)
2. **변환 버그**: status 매핑 오류 (trial→active 버그 발생 경험)
3. **스케일링 위험**: 50개 학원 × 학원당 60명 = ~3,000명 싱크 관리 불가
4. **중복 데이터**: 동일 데이터를 두 DB에 저장, 디스크/메모리 낭비

## 현재 구조

```
[Paca DB] students (원본, 암호화)
    ↓ POST /students/sync (수동)
[Peak DB] students (복사본, 복호화)
    ↑ FK 참조
    ├── student_records (1,263건)
    ├── daily_assignments (741건)
    ├── preset_group_members
    ├── training_logs (255건)
    └── student_records_old
```

- Peak `students.id` (auto_increment) ≠ Paca `students.id`
- 매핑: Peak `students.paca_student_id` = Paca `students.id`

## 목표 구조

```
[Paca DB] students (원본, 암호화) ← 직접 참조 (Single Source of Truth)
    ↑ FK 참조 (paca_student_id 사용)
    ├── student_records
    ├── daily_assignments (이미 paca_student_id 보유)
    ├── preset_group_members
    ├── training_logs
    └── student_records_old
```

- Peak `students` 테이블 제거
- 모든 FK를 `paca_student_id` (= Paca `students.id`)로 전환
- 학생 정보(이름, 상태 등)는 파카 DB에서 직접 JOIN

## 핵심 제약 조건

1. **기존 기록 보존 필수**: student_records 1,263건, daily_assignments 741건, training_logs 255건 - 절대 유실 불가
2. **암호화 처리**: 파카 이름/전화번호는 `ENC:` 접두어 암호화 → 앱 레벨에서 복호화 필요
3. **다운타임 최소화**: 학원 운영 중 마이그레이션, 데이터 정합성 유지
4. **Cross-DB 접근**: 같은 MySQL 서버, `paca` 유저가 양쪽 DB 접근 가능 확인됨

## 영향 받는 파일 (13개 라우트)

| 파일 | 영향도 | 설명 |
|------|:------:|------|
| `students.js` | **높음** | sync 제거, 전면 재작성 (파카 직접 조회) |
| `assignments.js` | **높음** | student_id → paca_student_id 전환, JOIN 변경 |
| `records.js` | **높음** | student_records FK 전환 |
| `training.js` | **중간** | training_logs FK 전환 |
| `presets.js` | **중간** | preset_group_members FK 전환 |
| `attendance.js` | **중간** | 학생 조회 방식 변경 |
| `stats.js` | **중간** | 통계 쿼리 JOIN 변경 |
| `mobile.js` | **중간** | 모바일 API JOIN 변경 |
| `monthlyTests.js` | **낮음** | 학생 참조 변경 |
| `testApplicants.js` | **낮음** | 학생 참조 변경 |
| `testSessions.js` | **낮음** | 학생 참조 변경 |
| `notifications.js` | **낮음** | 학생 이름 조회 |
| `publicBoard.js` | **낮음** | 학생 참조 변경 |

## 프론트엔드 영향

- 학생 ID가 Peak ID → Paca ID로 변경
- API 응답의 `student_id` 필드 값이 바뀜
- 프론트엔드에서 학생 ID를 URL 파라미터 등으로 쓰는 곳 확인 필요

## 마이그레이션 전략

### Phase 1: DB 마이그레이션 (FK 전환)
1. 모든 테이블의 `student_id`를 `paca_student_id`로 업데이트
2. FK 제약 조건 제거 → 새 FK 생성 (Paca students.id 참조 또는 FK 없이 앱 레벨 관리)
3. Peak `students` 테이블은 백업 후 유지 (즉시 삭제 X)

### Phase 2: 백엔드 코드 전환
1. `students.js` 전면 재작성 (파카 직접 조회 + 복호화)
2. 모든 라우트의 JOIN 쿼리를 파카 DB 참조로 변경
3. 복호화 유틸리티를 쿼리 결과에 일괄 적용하는 헬퍼 함수

### Phase 3: 프론트엔드 대응
1. 학생 ID 참조 변경 확인
2. 프리셋 페이지 student_id 변경 대응

### Phase 4: 정리
1. sync 관련 코드 제거
2. Peak `students` 테이블 DROP (충분한 검증 후)

## 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 마이그레이션 중 ID 매핑 오류 | 기록 유실 | 트랜잭션 + 롤백 준비, 사전 검증 쿼리 |
| Cross-DB JOIN 성능 | 느린 응답 | 같은 서버라 무시할 수준, 인덱스 확인 |
| 파카 DB 장애 시 Peak도 불가 | 서비스 중단 | 현재도 파카 의존적 (로그인, 출결), 리스크 동일 |
| 복호화 오버헤드 | 목록 조회 느림 | 배치 복호화 함수, 필요 시 캐싱 |

## 성공 기준

- [ ] 기존 student_records 1,263건 모두 정상 조회
- [ ] 기존 daily_assignments 741건 모두 정상 조회
- [ ] 기존 training_logs 255건 모두 정상 조회
- [ ] 파카에서 학생 상태 변경 시 Peak에서 즉시 반영
- [ ] 싱크 엔드포인트 / 코드 완전 제거
- [ ] 50개 학원 환경에서도 정상 동작
