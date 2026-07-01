# Peak 보안 의존성 릴리즈 준비

날짜: 2026-06-02
브랜치: `release/security-deps-20260602`
대상 버전: `5.7.11`

## 목적

운영 기능은 바꾸지 않고, 패키지 보안 점검에서 잡힌 위험을 낮춘다.

## 변경 내용

- Next.js를 `16.2.7`로 올렸다.
- Next.js ESLint 설정도 같은 `16.2.7`로 맞췄다.
- 실제 코드에서 쓰지 않는 `xlsx` 패키지를 제거했다.
- 하위 패키지 보안 이슈를 막기 위해 `postcss`, `serialize-javascript`, `uuid` 버전을 고정했다.
- 사이드바 표시용 버전을 `5.7.11`로 올렸다.

## 토스 범위

Peak에는 토스 플러그인 작업이 없다. 이번 릴리즈도 토스와 무관하다.

## 검증

- `npm audit --omit=dev`: 0건
- `npm test -- --runInBand`: 12개 테스트 묶음, 121개 테스트 통과
- `npm run lint`: 오류 0건, 기존 경고만 있음
- `npm run build`: 성공

## 배포 전 확인

- 운영 배포 전 `supermax.kr/peak-health`를 먼저 확인한다.
- 배포 직후 로그인, 학생 목록, 기록 저장, 월말테스트 엑셀 다운로드를 확인한다.
- 피크와 파카가 JWT 비밀키를 공유하므로 환경변수는 변경하지 않는다.

## 되돌리는 법

운영 반영 후 문제가 생기면 직전 main 커밋으로 되돌린 뒤 서비스를 재시작한다.

```bash
git revert <release-commit>
sudo systemctl restart peak
curl -s https://supermax.kr/peak-health
```
