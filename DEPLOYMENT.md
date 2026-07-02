# peak DEPLOYMENT

## 📦 운영 환경
| 역할 | Host | 위치 | 포트 | 상태 |
|---|---|---|---|---|
| **Primary** | vultr | `/root/peak/backend` | 8330 | systemd `peak-failover.service` (active) |
| Legacy/rollback | n100 | `/home/sean/ilsanmaxtraining/backend` | 8330 | systemd `peak.service` (LAN only) |
| Frontend | **Vercel** (자동) | github.com/seanyjeong/peak | - | Vercel ↔ GitHub UI 통합 |

## 🌐 도메인 / 라우팅
**Canonical:** `https://supermax.kr/peak/*` + `https://supermax.kr/socket.io/*`

`chejump.com`은 legacy compatibility bridge이다. 새 프론트, smoke, env 기본값은 `supermax.kr`만 사용한다.

### vultr Caddy (`supermax.kr`, primary)
```
supermax.kr {
    handle /peak-health { rewrite * /health; reverse_proxy localhost:8330 }
    handle /peak/*      { reverse_proxy localhost:8330 }
    handle /socket.io/* { reverse_proxy localhost:8330 }
}
```

### legacy bridge (`chejump.com`)
```
chejump.com → etserver/vultr Caddy → https://supermax.kr
```

### dev 도메인 (etserver Caddy → n100)
```
dev.sean8320.dedyn.io {
    handle /peak-health { rewrite * /health; reverse_proxy 192.168.35.249:8330 }
    handle /peak/*      { reverse_proxy 192.168.35.249:8330 }
    handle /socket.io/* { reverse_proxy 192.168.35.249:8330 }
    handle              { reverse_proxy 192.168.35.249:3000 }   # Next.js dev (n100)
}
```

## 🔧 systemd (n100 legacy) — `peak.service`
```ini
[Unit]
Description=P-EAK Backend API
After=network.target mysql.service

[Service]
Type=simple
User=sean
WorkingDirectory=/home/sean/ilsanmaxtraining/backend
ExecStart=/home/sean/.nvm/versions/node/v22.21.0/bin/node peak.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 🔧 systemd (vultr primary) — `peak-failover.service`
```ini
[Unit]
Description=P-EAK Failover Backend (Port 8330)
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/peak/backend
ExecStart=/usr/bin/node peak.js
Restart=always
RestartSec=10
EnvironmentFile=/root/peak/backend/.env

[Install]
WantedBy=multi-user.target
```

## 🗄 환경변수 (`/home/sean/ilsanmaxtraining/backend/.env`)
| Key | Value | 비고 |
|---|---|---|
| `PORT` | `8330` | |
| `NODE_ENV` | `development` ⚠️ | prod 인데 development 로 설정됨 — 검토 필요 |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `3306` | |
| `DB_USER` | `paca` | (peak DB 인데 user=paca 공유) |
| `DB_NAME` | `peak` | |
| `PACA_DB_HOST` | `localhost` | |
| `PACA_DB_USER` | `paca` | cross-DB users 조회용 |
| `JWT_SECRET` | (env) | **pacapro 와 공유** |
| `DATA_ENCRYPTION_KEY` | (env) | **pacapro 와 공유** |

## 🔁 GitHub repo & push
- **repo**: `https://github.com/seanyjeong/peak.git` (HTTPS)
- **push 위치**: 맥미니 release worktree 기준. 현재 GitHub 권한은 별도 확인 필요.
- ⚠️ etserver 에는 peak clone 없음

## 🏷 버전 관리
**배포 전 반드시 버전 업데이트!**

| 파일 | 위치 | 현재 버전 |
|------|------|-----------|
| `src/app/(pc)/layout.tsx` | line 8: `const APP_VERSION = 'vX.Y.Z'` | v5.7.1 |
| `src/app/tablet/layout.tsx` | line 32: `const APP_VERSION = 'vX.Y.Z'` | v5.7.1 |

버전 규칙:
- **MAJOR.MINOR.PATCH** (예: v5.7.1)
- PATCH: 버그 수정, 작은 변경
- MINOR: 새 기능 추가
- MAJOR: 큰 구조 변경

## 🚀 배포 흐름

### A. Backend (vultr systemd)
```bash
ssh vultr
cd /root/peak
cd backend
python3 -m pip install -r requirements.txt
python3 -m playwright install chromium
npm install            # 의존성 변경 시
python3 scripts/pdf_generator_smoke.py
sudo systemctl restart peak-failover
sudo journalctl -u peak-failover -f
```

### B. Frontend (Vercel 자동 — vercel.json 없지만 Next.js 자동 감지)
- github.com/seanyjeong/peak **main 브랜치 push** → Vercel 자동 빌드
- Next.js 16.1 + React 19.2 + Tailwind v4 + PWA (`@ducanh2912/next-pwa`)
- `NEXT_PUBLIC_API_URL` default = `https://supermax.kr/peak`
- `NEXT_PUBLIC_SOCKET_URL` default = `https://supermax.kr`
- 빌드 명령: `next build`
- 도메인: (Vercel project 이름 확인 필요 — 사장님 Vercel dashboard)

### C. n100 Legacy Backend
- n100은 rollback/LAN 확인용으로만 남긴다.
- n100 → vultr DB sync cron은 vultr DB write-primary 전환 전에 반드시 중지하거나 primary-to-replica 방식으로 재설계한다.

## ❤️ 헬스체크
```bash
curl -s https://supermax.kr/peak-health           # → 200
ssh vultr 'systemctl status peak-failover'
```

Legacy n100 health checks are rollback-only. Do not use n100 health as
production readiness for the new release path.

## 📡 Socket.io 실시간
- 이벤트: `record:new`, `attendance:check`, `test:update`
- Room: `academy_{academy_id}` (multi-tenant)
- Caddy `handle /socket.io/* { reverse_proxy ... 8330 }` — Upgrade header 자동
- 페일오버 시 클라이언트 자동 재연결 + room 재입장

## 🛠 로그 / 디버그
```bash
ssh vultr 'systemctl status peak-failover'
ssh vultr 'journalctl -u peak-failover --since "1 hour ago" -n 100 --no-pager'
```

## 🗃 DB
- **vultr (primary target)**: MySQL `peak` DB + `paca` DB readonly (users)
- **n100 (legacy)**: 기존 DB가 남아 있으나 새 쓰기 primary로 보지 않는다.
- **주의**: n100 cron의 30분 sync가 남아 있으면 vultr DB를 덮어쓸 수 있다.
- **백업**: n100 cron `0 3 * * *` (paca 와 함께)

## ⏪ 롤백
```bash
ssh vultr 'cd /root/peak && git log --oneline -5'
ssh vultr 'cd /root/peak && git checkout <SHA> && cd backend && sudo systemctl restart peak-failover'
```

## 🚨 운영 주의
1. `NODE_ENV=development` 로 되어있음 — prod 표준에 맞게 검토 필요
2. JWT_SECRET / DATA_ENCRYPTION_KEY pacapro 와 공유 — 변경 시 둘 다 재시작
3. **paca DB readonly 만** — peak 에서 paca DB 쓰기 금지
4. 출결 해석 함정 — `daily_attendance.checked_at IS NOT NULL` 가 체크완료
5. Socket.io 연결수 많아지면 메모리 압박 (행사 당일 모니터)
6. Next.js 16.1 + React 19.2 의존성 충돌 주의 — Vercel 빌드 실패 시 dashboard 확인
