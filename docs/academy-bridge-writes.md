# 공용 브릿지 운동 관리

브릿지의 운동 생성·수정·삭제는 고정 학원 확인 응답과 실제 재조회가 있어야 완료된다.
`expectedAcademy` 미들웨어는 토큰 재사용 중 계정 소속이 바뀐 경우에도 다른 학원 접근을 막는다.

`GET /peak/exercises/bridge-capabilities`는 원본 비교 지원을 알린다. 수정/삭제에
`x-academy-bridge-before-hash`가 있으면 전체 원본 행을 잠그고 비교한 뒤 처리한다.
오래된 원본은 409 `before_snapshot_changed`로 거절하며 자료를 변경하지 않는다.
헤더 없는 기존 화면 수정은 기존 경로를 유지한다.

운동 삭제는 모든 팩 참조를 검사한다. 사용 중이면 409 `exercise_in_use`를 반환하므로
팩에서 운동을 먼저 제외해야 한다. 타 학원 팩의 잘못된 참조도 함께 지워지지 않도록 막는다.
기존 수업 계획의 운동 JSON은 변경하지 않는다.

확인: `node --test scripts/tests/exercise-deletion.test.cjs`; 실제 MySQL·원본 HTTP 통합 검증은
MAX AI의 `scripts/test-academy-operations-native-mysql.py --domains`를 사용한다.
별도 Peak DB 마이그레이션은 없다. API·서비스·저장소·인증 가드 파일을 함께 설치한 뒤
academy-operations를 교체한다. 복구할 때는 해당 묶음을 함께 이전 버전으로 되돌린다.
