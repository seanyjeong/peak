# peak API-SPEC

Express 5, prefix `/peak/*`, JWT (`verifyToken`), Socket.io on `/socket.io/`.

## 공개 (인증 없음)
- `GET /health` — 헬스체크
- `/peak/auth` — 로그인/회원가입
- `/peak/public` — 공개 게시판
- `/peak/push` — 웹푸시 구독

## 인증 필수 (20개 라우트 모듈, `verifyToken` 미들웨어)
| Prefix | 모듈 | 역할 |
|---|---|---|
| `/peak/trainers` | trainers | 강사 CRUD |
| `/peak/students` | students | 학생 CRUD (paca 연동) |
| `/peak/plans` | plans | 수업 계획 (daily_plans) |
| `/peak/assignments` | assignments | 일일 반 배치 |
| `/peak/training` | training | 훈련 일지 |
| `/peak/records` | records | 측정 기록 (student_records) |
| `/peak/attendance` | attendance | 일일 출석 |
| `/peak/exercises` | exercises | 운동 라이브러리 |
| `/peak/exercise-tags` | exercise-tags | 태그 |
| `/peak/exercise-packs` | exercise-packs | 운동 팩 preset |
| `/peak/record-types` | recordTypes | 측정 종목 정의 |
| `/peak/score-tables` | scoreTable | 점수표 |
| `/peak/stats` | stats | 통계 |
| `/peak/settings` | peakSettings | 학원별 설정 |
| `/peak/mobile` | mobile | 모바일 전용 API |
| `/peak/presets` | presets | preset 그룹 |
| `/peak/analytics` | analytics | 분석 |
| `/peak/monthly-tests` | monthlyTests | 월말 테스트 |
| `/peak/test-sessions` | testSessions | 테스트 세션 |
| `/peak/test-applicants` | testApplicants | 참가자 |
| `/peak/notifications` | notifications | 알림 관리 |

## 미들웨어 스택 (`peak.js`)
```js
app.use(cors({...}));
app.use(helmet({...}));
app.use(rateLimit({...}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(requestLogger);
```

## Socket.io
```js
const io = new Server(server, { cors: {...} });
// 인증: JWT from handshake.auth.token or handshake.query.token
io.use((socket, next) => { verifyToken(socket); });
// Room join
socket.join(`academy_${academy_id}`);
// 이벤트 송신
io.to(`academy_${id}`).emit('record:new', data);
```

### 이벤트 목록
- `record:new` — 새 기록
- `attendance:check` — 출결
- `test:update` — 월말 테스트

## 전체 엔드포인트 추출
```bash
ssh n100 'grep -rnE "router\.(get|post|put|delete)\(" /home/sean/ilsanmaxtraining/backend/routes/' | head -50
```
