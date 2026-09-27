# PACA·PEAK 업무 위임 gateway (D-117)

2026-09-27 KST. 코드만 준비했으며 배포·운영 DB 변경은 수행하지 않았다.

`/peak/integrations/max-engine/full` 아래 token/identity/catalog/resources/:resource/preview/confirm을 제공한다. 고정 PACA 원본 주소로만 요청하고 별도 위임 Bearer를 그대로 전달한다. 기존 PEAK JWT·서비스 키로 바꾸거나 업무 DB에 직접 쓰지 않는다. 원장/관리자 활성·교육원·비밀번호 버전 검사는 PACA가 매 요청 수행한다.

설정 키 `MAX_ENGINE_PACA_URL`은 PACA의 신뢰된 HTTPS origin 또는 같은 서버 loopback HTTP origin이다. 쿼리·사용자정보·경로·리다이렉트를 허용하지 않는다. 실제 비밀값은 필요하지 않다. 기존 전용 PACA 위임으로만 연결한다.

- `/catalog`로 허용 resource·필터·쓰기 필드를 확인한다. 원본 id cursor로 100개씩, next_cursor=null까지 조회한다.
- PEAK 33개 원본 resource와 PACA 원본 id를 찾는 8개 `paca_*` 별칭이 제공된다. PEAK students.id와 PACA students.id를 혼용하지 않는다.
- 쓰기는 PACA 학생 기본정보 등록/수정, 재원생 상담·상담 기록, 출결 정정, 기존 청구 납부의 8개 명령이다. 학생 상태/수강료/수업 편성, 실기 기록 편집, 운동 계획 편집, 급여 지급·문자 발송·환불은 제공하지 않는다.
- preview는 원본 변경 없이 전후 값을 보여준다. 확인 후 동일 receipt/idempotency key와 confirm=true를 전달한다. 원본 변경 검사·업무 변경·멱등 기록은 PACA의 한 트랜잭션이다. 네트워크 오류 후 같은 확인을 재시도한다.
- 요청 로거에서 연동 경로를 제외하고 JSON 파싱 오류도 원문 없이 응답한다. `peak.js`·`middleware/requestLogger.js`·privacy middleware를 함께 배포한다.

검증: Jest 29 suites / 197 passed, Node 11 passed, TypeScript noEmit 통과. Node에는 기존 6개와 신규 gateway/입력·로그 보호 5개가 포함된다. Node 전용 scripts/tests가 Jest에도 수집되지 않도록 분리했다. max-engine의 실제 HTTP 스택 테스트에서 격리 MySQL → PACA → 이 gateway → PEAK MCP OAuth/조회/preview/confirm/재조회도 통과했다.

```sh
npm test -- --runInBand
npm run test:node
npx tsc --noEmit
```

세 저장소의 배포·롤백·포트·환경 키·스모크 절차는 max-engine `ops/deploy/mcp/VERIFY.md`, 라우트 전수와 범위는 `docs/analysis/paca-peak-full/`를 따른다. MCP 운영 로그인·Caddy·systemd 검증은 배포 담당자가 수행한다.
