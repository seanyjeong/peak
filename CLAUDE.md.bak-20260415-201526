# peak (P-EAK · IlsanMaxTraining)

@ARCHITECTURE.md
@API-SPEC.md
@DB-SCHEMA.md
@BUSINESS-LOGIC.md
@DEPLOYMENT.md
@RELATIONSHIPS.md

체대입시 학생 실기 기록 시스템. Socket.io 실시간. Express 5 + MySQL + Next.js 16. **n100 primary + vultr failover 이중화** (pacapro 와 동일 토폴로지).

## 🏗 구조
- **Primary**: n100 `peak.service` · `/home/sean/ilsanmaxtraining/backend/peak.js` · **port 8330**
- **Failover**: vultr `peak-failover.service` · `/root/peak/backend/peak.js` · **port 8330** (enabled·inactive)
- **DB**: n100 MySQL `peak` + pacapro 의 `paca` DB readonly 접근 (users 테이블)
- **도메인**: chejump.com (CF DNS A=218.148.190.61 → etserver Caddy → n100:8330 / 페일오버 시 → vultr 158.247.250.58)
- **Frontend**: Next.js 16 + React 19 + Tailwind v4

## 🔁 페일오버
pacapro 와 함께 auto-failover.sh 가 동시 전환. 매 1분 cron, 헬스체크 실패 시 DNS → vultr + 서비스 기동.

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
- prod: `chejump.com/peak/*` (+ `/socket.io/*`) — **etserver Caddy → n100:8330** (페일오버 시 vultr Caddy → localhost:8330)
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
ssh n100 'sudo systemctl restart peak && sudo journalctl -u peak -f'
ssh n100 'sudo mysql peak -e "SHOW TABLES"'
curl -s https://chejump.com/peak-health
```
