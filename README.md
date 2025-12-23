# P-EAK (피크)

**P**hysical **E**xcellence **A**chievement **K**eeper - 체육 실기 훈련 관리 시스템

## 소개

P-EAK는 체대입시 학원의 실기 훈련 관리를 위한 종합 시스템입니다. P-ACA(학원 종합관리)의 자매 시스템으로, 학생들의 실기 기록 측정, 반 배치, 수업 기록 등을 관리합니다.

### 주요 기능

- **반 배치 관리**: 드래그앤드롭으로 학생/강사 배치
- **기록 측정**: 종목별 기록 입력 및 점수 자동 계산
- **수업 기록**: 컨디션 체크, 수업 메모
- **학생 프로필**: FM 스타일 대시보드, 차트 분석
- **운동 관리**: 태그/팩 기반 운동 관리
- **다중 디바이스**: PC, 태블릿, 모바일 지원

## 기술 스택

### 프론트엔드
- Next.js 16
- React 19
- TailwindCSS 4
- Recharts
- dnd-kit

### 백엔드
- Express.js 5
- MySQL (mysql2)
- JWT 인증 (P-ACA 연동)
- Winston 로깅

## 설치 방법

### 요구사항
- Node.js 20+
- MySQL 8.0+
- npm 10+

### 1. 저장소 클론
```bash
git clone <repository-url>
cd ilsanmaxtraining
```

### 2. 의존성 설치
```bash
# 프론트엔드
npm install

# 백엔드
cd backend
npm install
```

### 3. 환경 변수 설정

**프론트엔드** (`.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8330/peak
```

**백엔드** (`backend/.env`):
```env
PORT=8330
NODE_ENV=development
DB_HOST=localhost
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=peak
JWT_SECRET=your_jwt_secret
```

### 4. 데이터베이스 설정
```bash
mysql -u root -p
CREATE DATABASE peak;
```

스키마는 `CLAUDE.md`의 DB 스키마 섹션 참조.

### 5. 서버 실행

**개발 모드**:
```bash
# 프론트엔드 (터미널 1)
npm run dev

# 백엔드 (터미널 2)
cd backend
node peak.js
```

**프로덕션 모드**:
```bash
# 프론트엔드 빌드
npm run build

# 백엔드 (systemd 서비스)
sudo systemctl start peak
```

## 프로젝트 구조

```
ilsanmaxtraining/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (pc)/              # PC 페이지
│   │   ├── tablet/            # 태블릿 페이지
│   │   └── mobile/            # 모바일 페이지
│   ├── components/
│   │   ├── ui/                # 공통 UI 컴포넌트
│   │   ├── exercises/         # 운동 관리
│   │   ├── records/           # 기록 측정
│   │   └── students/          # 학생 관리
│   ├── hooks/                 # 커스텀 훅
│   └── lib/
│       ├── api/               # API 클라이언트
│       └── constants/         # 상수 정의
├── backend/
│   ├── routes/                # API 라우트
│   ├── middleware/            # 미들웨어
│   ├── utils/                 # 유틸리티 (logger 등)
│   └── config/                # DB 설정
├── __tests__/                 # 테스트 파일
└── docs/                      # 문서
```

## 테스트

```bash
# 전체 테스트 실행
npm test

# 감시 모드
npm run test:watch

# 커버리지 확인
npm run test:coverage
```

## API 문서

주요 API 엔드포인트는 `docs/API.md` 참조.

### 인증
- `POST /peak/auth/login` - P-ACA 로그인

### 반 배치
- `GET /peak/assignments?date=YYYY-MM-DD` - 반 배치 조회
- `POST /peak/assignments/sync` - P-ACA 동기화

### 기록 측정
- `GET /peak/records/by-date?date=&student_ids=` - 기록 조회
- `POST /peak/records/batch` - 기록 일괄 저장

상세 정보는 `CLAUDE.md` 참조.

## 버전 정책

| 자리 | 의미 | 예시 |
|------|------|------|
| Major | 큰 기능 추가 | 새 페이지, 새 시스템 |
| Minor | 소규모 추가 | 탭 추가, 필터 추가 |
| Patch | 버그 수정 | 에러 수정, UI 수정 |

현재 버전: **v2.0.9**

## 권한 체계

| 기능 | staff | owner | admin |
|------|-------|-------|-------|
| 설정 메뉴 | - | O | O |
| 운동/팩 관리 | - | O | O |
| 태그 관리 | - | - | O |
| 기록 측정 (전체) | - | O | O |

## 관련 시스템

- **P-ACA**: 학원 종합관리 시스템 (본 시스템과 연동)
- **P-EAK**: 본 시스템 (실기 훈련 관리)

## 라이선스

Private - 일산맥스체육학원 전용
