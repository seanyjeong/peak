# peak RELATIONSHIPS

## pacapro (TIGHT COUPLING)
| 항목 | 공유/관계 |
|---|---|
| 도메인 | `supermax.kr` canonical. `chejump.com`은 legacy bridge |
| 서버 | vultr primary + n100 legacy/rollback |
| 페일오버 | 기존 auto-failover는 더 이상 새 릴리즈 기본 경로가 아님 |
| JWT secret | **동일** (.env JWT_SECRET) |
| DATA_ENCRYPTION_KEY | **동일**. 값은 문서화하지 않고 env/secret store로만 관리 |
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

## Legacy n8n 자동화 (퇴역 대상)
- 새 Peak 릴리즈 backend code는 n8n API-key service account를 허용하지 않는다.
- 과거 n100 Docker n8n에 연결된 `record:new` 학부모 알림톡 또는 월말 결과 발송 흐름은 프로덕션 완료 전 퇴역/대체/비활성 증거가 필요하다.
- 새 운영 경로는 `supermax.kr`의 Vultr Peak backend와 JWT 인증만 기준으로 삼는다.

## NocoDB (관리)
- pacapro 와 같은 paca DB 공유 (nc_* 테이블)
- peak 데이터는 NocoDB 에서 직접 안 읽음 (별 DB 라서)

## 도메인 매핑
| URL | 대상 |
|---|---|
| supermax.kr/peak/* | vultr Caddy → localhost:8330 |
| supermax.kr/socket.io/* | vultr Caddy → localhost:8330 |
| supermax.kr/peak-health | rewrite → /health |
| chejump.com/peak/* | legacy bridge: etserver/vultr Caddy → supermax.kr |
| dev.sean8320.dedyn.io/peak/* | n100:8330 (etserver Caddy 경유) |
| dev.sean8320.dedyn.io/socket.io/* | 동일 |

## 백업/동기화 의존
- n100 cron `0 3 * * * /home/sean/backups/backup_all.sh` — DB 백업
- n100 cron `*/30 * * * * /home/sean/backups/sync-to-vultr.sh` — vultr 로 sync. vultr write-primary 전환 전 중지/재설계 필요
- vultr auto-failover cron은 vultr-primary 운영에서는 비활성 상태여야 한다.

## GitHub
- repo: github.com/seanyjeong/peak
- push/deploy 권한은 현재 작업 계정에서 별도 확인 필요

## 실패 시나리오
1. supermax.kr/vultr backend dies → PACA/Peak public API 장애
2. n100 mysql dies → peak + paca 둘 다 죽음 → failover 트리거됨
3. paca DB 만 깨짐 → peak 인증 실패 (verifyToken 에서 paca.users 조회 못함)
4. JWT secret 불일치 (pacapro vs peak) → 모든 API 401
5. legacy chejump bridge 제거 전 외부 callback/old frontend가 남아 있으면 해당 요청만 장애
