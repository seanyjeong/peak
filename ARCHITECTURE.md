# peak ARCHITECTURE

## 토폴로지 (pacapro 와 동일)
```
Browser ─HTTPS──→ chejump.com (CF DNS) ──→ n100 (primary) 또는 vultr (failover)
                                           │
                                           ├─ Caddy /peak/* → :8330
                                           └─ Caddy /socket.io/* → :8330
```

## 스택
- **Runtime**: Node.js v22.21.0 (n100), v18.19.1 (vultr)
- **Framework**: Express 5 + Socket.io 4.8
- **Auth**: JWT 9.0 (pacapro 와 secret 공유)
- **DB**: mysql2 2 풀 (`peak` 쓰기 + `paca` readonly)
- **Frontend**: Next.js 16.1.0 (App Router) + React 19.2.3 + Tailwind v4
- **State**: Zustand + TanStack Query
- **Testing**: Jest + Playwright

## 파일 구조
```
/home/sean/ilsanmaxtraining/
├── backend/
│   ├── peak.js                 # 부트스트랩 (Express + Socket.io)
│   ├── routes/ (24개 모듈)
│   │   ├── auth.js, trainers.js, students.js, plans.js, assignments.js
│   │   ├── training.js, records.js, attendance.js, exercises.js
│   │   ├── exercise-tags.js, exercise-packs.js, recordTypes.js, scoreTable.js
│   │   ├── stats.js, peakSettings.js, mobile.js, presets.js, analytics.js
│   │   ├── monthlyTests.js, testSessions.js, testApplicants.js, publicBoard.js
│   │   ├── notifications.js, push.js
│   ├── config/db.js            # mysql2 풀 (peak + paca)
│   ├── utils/logger.js         # Winston
│   └── .env
├── src/                        # Next.js 16
│   └── app/                    # App Router
├── public/, database/, screen/, docs/
├── peak.service                # systemd 파일 (소스 복사본)
└── package.json
```

## 부트스트랩 순서 (peak.js)
1. dotenv + express 초기화
2. DB 풀 생성 (peak + paca)
3. 미들웨어 (CORS, helmet, rate limit, express.json)
4. `/health` 라우트
5. `/peak/auth` 마운트 (토큰 없음)
6. verifyToken 뒤 20개 라우트 모듈 마운트
7. `/peak/public`, `/peak/push` (noauth)
8. `/peak/notifications` (verifyToken)
9. Socket.io 서버 부착
10. listen(8330)

## 실시간 (Socket.io)
- Room 전략: `academy_{academy_id}` (multi-tenant 격리)
- 인증: JWT (pacapro 와 공유)
- Caddy WebSocket 업그레이드 필수

## DB 연결
- **peak (primary pool)**: 자체 쓰기/읽기
- **paca (secondary pool, readonly)**: users + academies + students 조회용

## 의존 외부
- Cloudflare DNS (페일오버 전환 주체)
- Pacapro (JWT + paca DB)
