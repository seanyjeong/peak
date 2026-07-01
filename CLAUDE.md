---
product: peak
display_name: Peak (IlsanMaxTraining)
server: vultr
base_url: https://supermax.kr/peak
tags:
  - domain:체대입시
  - domain:실기기록
  - domain:realtime
  - stack:node
  - stack:express
  - stack:nextjs
  - stack:socketio
  - db:mysql
  - deploy:vultr-primary
  - deploy:n100-legacy
  - auth:jwt
provides:
  - realtime-record-api
  - practice-measurement
shares_with:
  - pacapro:jwt-secret
  - pacapro:data-encryption-key
  - pacapro:paca-student-id
depends_on:
  - pacapro:paca-db
---

# peak (P-EAK · IlsanMaxTraining)

@ARCHITECTURE.md
@API-SPEC.md
@DB-SCHEMA.md
@BUSINESS-LOGIC.md
@DEPLOYMENT.md
@RELATIONSHIPS.md

체대입시 학생 실기 기록 시스템. Socket.io 실시간. Express 5 + MySQL + Next.js 16. **vultr primary 전환 중**이며 n100은 legacy/rollback 경로로만 취급한다.

## 🏗 구조
- **Primary**: vultr `peak-failover.service` · `/root/peak/backend/peak.js` · **port 8330**
- **Legacy**: n100 `peak.service` · `/home/sean/ilsanmaxtraining/backend/peak.js` · **port 8330** (LAN/rollback only)
- **DB**: vultr MySQL `peak` + `paca` DB readonly 접근 (users 테이블)
- **도메인**: `supermax.kr/peak` canonical. `chejump.com`은 etserver/vultr Caddy 호환 브리지일 뿐 새 릴리즈 기본값으로 쓰지 않는다.
- **Frontend**: Next.js 16 + React 19 + Tailwind v4

## 🔁 페일오버
새 릴리즈 기준 canonical backend는 `https://supermax.kr/peak`이다. 기존 `chejump.com` 브리지는 외부 잔여 트래픽이 0인지 확인한 뒤 마지막에 제거한다.

## 🔌 라우트 23개 모듈 (`peak.js`)
```
/peak/auth           → routes/auth (no auth)
/peak/trainers       → routes/trainers (verifyToken)
/peak/students       → routes/students (verifyToken)
/peak/plans          → routes/plans (verifyToken)
/peak/assignments    → routes/assignments (verifyToken)
/peak/training       → routes/training (verifyToken)
/peak/records        → routes/records (verifyToken)
/peak/attendance     → routes/attendance (verifyToken)
/peak/exercises      → routes/exercises (verifyToken)
/peak/exercise-tags  → routes/exercise-tags (verifyToken)
/peak/exercise-packs → routes/exercise-packs (verifyToken)
/peak/record-types   → routes/recordTypes (verifyToken)
/peak/score-tables   → routes/scoreTable (verifyToken)
/peak/stats          → routes/stats (verifyToken)
/peak/settings       → routes/peakSettings (verifyToken)
/peak/mobile         → routes/mobile (verifyToken)
/peak/analytics      → routes/analytics (verifyToken)
/peak/monthly-tests  → routes/monthlyTests (verifyToken)
/peak/test-sessions  → routes/testSessions (verifyToken)
/peak/test-applicants→ routes/testApplicants (verifyToken)
/peak/presets        → routes/presets (verifyToken)
/peak/notifications  → routes/notifications (verifyToken)
/peak/public         → routes/publicBoard (no auth)
/peak/push           → routes/push (no auth)
```

## 🌐 도메인
- prod: `supermax.kr/peak/*` (+ `/socket.io/*`) — **vultr Caddy → localhost:8330**
- legacy bridge: `chejump.com/peak/*` — etserver/vultr Caddy가 `supermax.kr`로 프록시한다. 새 코드/문서 기본값으로 사용 금지.
- dev: `dev.sean8320.dedyn.io/peak/*` — etserver Caddy → n100
- 맥미니 internal: `http://192.168.35.249:8330`

## 🗄 DB (MySQL `peak`, 36 tables)
학생 기록/훈련/시험/출결 중심. `paca` DB 와 cross-DB JOIN (users 인증).

## 🔐 인증
- JWT (**pacapro 와 secret 공유** — `.env` PACA_* + peak 자체)
- verifyToken 미들웨어
- Socket.io: JWT `auth.token` 또는 `handshake.query.token`

## 🚨 절대 규칙
1. **systemd** (PM2 아님)
2. **출결 해석 주의**: `checked_at IS NOT NULL` = 체크완료 (COUNT 오용 금지)
3. **paca DB readonly** — peak 에서 INSERT/UPDATE 금지
4. **JWT secret 변경 시 pacapro 도 동시 재시작**
5. Socket.io path `/socket.io/` — Caddy `proxy_http_version 1.1` + Upgrade header 필수
6. **Next.js 16.1 + React 19** — 의존성 민감, build 시 node 버전 (v22.x) 확인
7. 시간 KST

## 🛠 자주 쓰는 명령
```bash
curl -s https://supermax.kr/peak-health
ssh vultr 'systemctl status peak-failover'
```

Legacy n100 checks are rollback-only and must not be used to restart or verify
the new release path unless the rollback runbook explicitly says so.


## 📦 버전 관리 룰 (2026-05-06 명시)

### Frontend bump 시 *반드시* 두 필드 동시
- `package.json` 의 "version" + "lastUpdate" 둘 다 갱신
- 명령:
  ```
  jq '.version = "X.Y.Z" | .lastUpdate = "YYYY-MM-DD"' package.json > /tmp/p.json && mv /tmp/p.json package.json
  ```

### Sidebar 표시 자동화
- `src/app/(pc)/layout.tsx` + `src/app/tablet/layout.tsx` 가 `packageJson` 을 import 해서 자동 표시
- 표시 형식: `v{version} · {lastUpdate}`
- 새 hardcoded version 박기 *절대 금지* — package.json bump만으로 sidebar 자동 갱신

### 위반 시 증상
- PWA 사용자가 사이드바에서 옛 버전 보고 새로고침 안 함
- 캐시 문제로 기능 적용 안 된 것처럼 오해
