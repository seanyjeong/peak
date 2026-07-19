# Peak 5.9.4 공개 전광판 라우팅

- 배포일: 2026-07-19
- 대상: `/board/{slug}`, `/board/{slug}/scores`
- 변경: 공개 링크는 사용자 기기와 관계없이 동일한 공개 경로를 유지한다.
- 보존: 로그인 이후 PC·태블릿·모바일 업무 화면의 기존 자동 라우팅은 변경하지 않는다.
- 회귀 검사: 데스크톱, Android 태블릿, Android 모바일 사용자 에이전트에서 전광판과 배점표의 HTTP 200, 최종 URL, 화면 렌더링을 확인한다.
- 롤백: `rollback/peak-before-board-device-routing-20260719-164736`
