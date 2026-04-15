# peak RELATIONSHIPS

## pacapro (TIGHT COUPLING)
| 항목 | 공유/관계 |
|---|---|
| 도메인 | chejump.com (동일) |
| 서버 | n100 primary + vultr failover (동일 토폴로지) |
| 페일오버 | auto-failover.sh 가 동시 전환 |
| JWT secret | **동일** (.env JWT_SECRET) |
| DATA_ENCRYPTION_KEY | **동일** (`QQe/soOzfamoQhmoHQBQ32CM7qQHthbTs3yhE/qDem0=`) |
| paca DB | peak 가 readonly 접속 (PACA_DB_*) |
| students 매핑 | `peak.students.paca_student_id` → `paca.students.id` |
| 사용자 인증 | pacapro 발급 토큰을 peak 가 검증 |

⚠️ **둘은 사실상 한 시스템**. 한쪽 변경 시 다른쪽 영향 검토 필수.

## maxtest (loose)
- 같은 체대입시 도메인이지만 별개 시스템
- maxtest = 시험 운영 (행사형), peak = 일상 기록
- 데이터 동기화 없음

## n100 함께 도는 서비스
- `coach-eval.service` (8331) — 강사 평가
- `edustats.service` (3002) + `edustats-api` (3003) — 학생 통계
- `jungsi-api.service` (8900) — 정시 SaaS API (vultr 정시엔진과 별개)
- `stock-api.service` (8340) — 주식 (관련 X)

## n8n 자동화 (n100 docker)
- peak `record:new` 이벤트 시 학부모 알림톡
- 월말 결과 발송
- N8N URL: https://n8n.sean8320.dedyn.io

## NocoDB (관리)
- pacapro 와 같은 paca DB 공유 (nc_* 테이블)
- peak 데이터는 NocoDB 에서 직접 안 읽음 (별 DB 라서)

## 도메인 매핑
| URL | 대상 |
|---|---|
| chejump.com/peak/* | etserver:443 Caddy → n100:8330 (또는 vultr:443→localhost:8330 페일오버) |
| chejump.com/socket.io/* | 동일 |
| chejump.com/peak-health | rewrite → /health |
| dev.sean8320.dedyn.io/peak/* | n100:8330 (etserver Caddy 경유) |
| dev.sean8320.dedyn.io/socket.io/* | 동일 |

## 백업/동기화 의존
- n100 cron `0 3 * * * /home/sean/backups/backup_all.sh` — DB 백업
- n100 cron `*/30 * * * * /home/sean/backups/sync-to-vultr.sh` — vultr 로 sync
- vultr cron `* * * * * /root/auto-failover.sh` — 페일오버 감시

## GitHub
- repo: github.com/seanyjeong/ilsanmaxtraining (추정 — 확인)
- push: 맥미니에서만 (n100/vultr SSH key 없음 추정)

## 실패 시나리오
1. n100 dies → vultr failover 활성 → chejump.com 정상 (Socket.io 재연결 필요)
2. n100 mysql dies → peak + paca 둘 다 죽음 → failover 트리거됨
3. paca DB 만 깨짐 → peak 인증 실패 (verifyToken 에서 paca.users 조회 못함)
4. JWT secret 불일치 (pacapro vs peak) → 모든 API 401
5. Cloudflare DNS 정체 → 페일오버 전환 지연 (TTL 60 으로 짧게 설정됨)
