# peak DEPLOYMENT

## 📦 이중화 환경
| 역할 | Host | 위치 | 포트 | 상태 |
|---|---|---|---|---|
| **Primary** | n100 | `/home/sean/ilsanmaxtraining/backend` | 8330 | systemd `peak.service` (active) |
| **Failover** | vultr | `/root/peak/backend` | 8330 | systemd `peak-failover.service` (enabled·**inactive**) |
| Frontend | **Vercel** (자동) | github.com/seanyjeong/peak | - | Vercel ↔ GitHub UI 통합 |

## 🌐 도메인 / 라우팅
**`https://chejump.com/peak/*`** + **`/socket.io/*`** — Cloudflare DNS 자동 전환 (pacapro 와 동시)

### etserver Caddy (`chejump.com`, 정상)
```
chejump.com {
    handle /peak-health { rewrite * /health; reverse_proxy 192.168.35.249:8330 }
    handle /peak/*      { reverse_proxy 192.168.35.249:8330 }
    handle /socket.io/* { reverse_proxy 192.168.35.249:8330 }
    # ... + paca/* (위 파일 참조)
}
```

### vultr Caddy (`chejump.com`, 페일오버)
```
chejump.com {
    handle /peak/*      { reverse_proxy localhost:8330 }
    handle /socket.io/* { reverse_proxy localhost:8330 }
}
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

## 🔧 systemd (n100 primary) — `peak.service`
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

## 🔧 systemd (vultr failover) — `peak-failover.service`
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
| `N8N_API_KEY` | (env) | n8n 웹훅 |

## 🔁 GitHub repo & push
- **repo**: `https://github.com/seanyjeong/peak.git` (HTTPS)
- **현재 HEAD**: `54e98c8 fix: add supermax.kr to CSP connect-src for failover`
- **push 위치**: n100 `/home/sean/ilsanmaxtraining` 또는 맥미니 (collab)
- ⚠️ etserver 에는 peak clone 없음

## 🚀 배포 흐름

### A. Backend (n100 systemd)
```bash
ssh n100
cd /home/sean/ilsanmaxtraining
git pull origin main
cd backend
npm install            # 의존성 변경 시
sudo systemctl restart peak
sudo journalctl -u peak -f
```

### B. Frontend (Vercel 자동 — vercel.json 없지만 Next.js 자동 감지)
- github.com/seanyjeong/peak **main 브랜치 push** → Vercel 자동 빌드
- Next.js 16.1 + React 19.2 + Tailwind v4 + PWA (`@ducanh2912/next-pwa`)
- `NEXT_PUBLIC_API_URL` default = `https://chejump.com/peak`
- 빌드 명령: `next build`
- 도메인: (Vercel project 이름 확인 필요 — 사장님 Vercel dashboard)

### C. Vultr Failover Backend
- pacapro 와 동일 메커니즘 (auto-failover.sh 가 동시 전환)
- DB 동기화: n100 cron 30분마다

## ❤️ 헬스체크
```bash
curl -s https://chejump.com/peak-health           # → 200
ssh n100 'curl -s http://localhost:8330/health'
ssh vultr 'systemctl status peak-failover'
```

## 📡 Socket.io 실시간
- 이벤트: `record:new`, `attendance:check`, `test:update`
- Room: `academy_{academy_id}` (multi-tenant)
- Caddy `handle /socket.io/* { reverse_proxy ... 8330 }` — Upgrade header 자동
- 페일오버 시 클라이언트 자동 재연결 + room 재입장

## 🛠 로그 / 디버그
```bash
ssh n100 'sudo journalctl -u peak -f'
ssh n100 'sudo journalctl -u peak --since "1 hour ago" -n 100 --no-pager'
ssh vultr 'systemctl status peak-failover'
```

## 🗃 DB
- **n100 (primary)**: MySQL `peak` DB (36 tables) + `paca` DB readonly (users)
- **vultr (sync 복제)**: 30분마다
- **백업**: n100 cron `0 3 * * *` (paca 와 함께)

## ⏪ 롤백
```bash
ssh n100 'cd /home/sean/ilsanmaxtraining && git log --oneline -5'
ssh n100 'cd /home/sean/ilsanmaxtraining && git checkout <SHA> && cd backend && sudo systemctl restart peak'
```

## 🚨 운영 주의
1. `NODE_ENV=development` 로 되어있음 — prod 표준에 맞게 검토 필요
2. JWT_SECRET / DATA_ENCRYPTION_KEY pacapro 와 공유 — 변경 시 둘 다 재시작
3. **paca DB readonly 만** — peak 에서 paca DB 쓰기 금지
4. 출결 해석 함정 — `daily_attendance.checked_at IS NOT NULL` 가 체크완료
5. Socket.io 연결수 많아지면 메모리 압박 (행사 당일 모니터)
6. Next.js 16.1 + React 19.2 의존성 충돌 주의 — Vercel 빌드 실패 시 dashboard 확인
