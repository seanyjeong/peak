import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  createAuthedPage,
  jsonRoute,
  launchSmokeBrowser,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

async function main() {
  const browser = await launchSmokeBrowser();
  const { context, diagnostics, page } = await createAuthedPage(browser, { width: 1440, height: 960 });
  const state = { bodies: [] };

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPeakApi = url.href.startsWith('https://supermax.kr/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    if (request.method() !== 'GET') state.bodies.push({ method: request.method(), path, body: request.postDataJSON() });

    if (request.method() === 'GET' && path === '/test-sessions/41/groups') return jsonRoute(route, makeGroups());
    if (request.method() === 'GET' && path === '/test-sessions/41/schedule') return jsonRoute(route, makeSchedule());
    if (request.method() === 'GET' && path === '/test-sessions/41/available-students') return jsonRoute(route, makeAvailableStudents());
    if (request.method() === 'POST' && path === '/test-sessions/41/participants/sync') return jsonRoute(route, { success: true });
    if (request.method() === 'PUT' && path.startsWith('/test-sessions/41/participants/')) return jsonRoute(route, { success: true });
    if (request.method() === 'POST' && path === '/test-sessions/41/participants') return jsonRoute(route, { success: true, id: 900 });
    if (request.method() === 'POST' && path === '/test-sessions/41/schedule/generate') return jsonRoute(route, { success: true });
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/monthly-test/31/41', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '6월 실기 테스트', exact: true }).waitFor();

  await page.getByRole('button', { name: '균일 배치' }).click();
  await page.getByText('미배치 학생을 균일하게 배치했습니다.').waitFor();
  await page.getByRole('button', { name: '재원생 동기화' }).click();
  await page.getByText('참가자 명단을 동기화했습니다.').waitFor();

  await page.getByRole('button', { name: '참가자 추가' }).click();
  await page.getByText('휴원생').waitFor();
  await page.getByText('휴원 김민재').click();
  await page.getByRole('button', { name: '추가', exact: true }).click();

  await page.getByRole('button', { name: '순서표' }).click();
  await page.getByText('타임 1').waitFor();
  await page.getByRole('button', { name: '순서표 생성' }).click();
  await page.getByText('순서표를 생성했습니다.').waitFor();

  if (!state.bodies.some((entry) => entry.path === '/test-sessions/41/participants/sync')) {
    throw new Error('participant sync contract was not preserved');
  }
  if (!state.bodies.some((entry) => entry.path === '/test-sessions/41/participants/901' && entry.body.test_group_id === 701)) {
    throw new Error('auto assign participant contract was not preserved');
  }
  if (!state.bodies.some((entry) => entry.path === '/test-sessions/41/participants' && entry.body.paca_student_id === 801)) {
    throw new Error('participant add contract was not preserved');
  }
  if (!state.bodies.some((entry) => entry.path === '/test-sessions/41/schedule/generate')) {
    throw new Error('schedule generate contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'monthly test session desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-monthly-test-session-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'monthly test session');
  await browser.close();
}

function makeGroups() {
  return {
    success: true,
    session: { id: 41, test_date: '2026-06-24', time_slot: 'morning', test_name: '6월 실기 테스트', test_month: '2026-06' },
    groups: [
      {
        id: 701,
        group_num: 1,
        group_name: null,
        supervisors: [{ instructor_id: 4, name: '김코치', is_main: true }],
        participants: [{ id: 902, name: '김서연', gender: 'F', school: '백마고', grade: '고2', participant_type: 'enrolled', attendance_status: 'present' }],
      },
    ],
    waitingParticipants: [
      { id: 901, name: '유민재', gender: 'M', school: '정발고', grade: '고3', participant_type: 'enrolled', attendance_status: 'scheduled' },
    ],
    waitingInstructors: [{ instructor_id: 5, name: '이코치' }],
  };
}

function makeSchedule() {
  return {
    success: true,
    schedule: {
      groups: [{ id: 701, group_num: 1, group_name: null }],
      recordTypes: [
        { id: 1, name: '제자리멀리뛰기', short_name: '멀리' },
        { id: 2, name: '왕복달리기', short_name: '왕복' },
      ],
      timeSlots: [
        { order: 0, assignments: [{ group_id: 701, record_type_id: 1, record_type_name: '제자리멀리뛰기', short_name: '멀리' }] },
        { order: 1, assignments: [{ group_id: 701, record_type_id: 2, record_type_name: '왕복달리기', short_name: '왕복' }] },
      ],
    },
  };
}

function makeAvailableStudents() {
  return {
    success: true,
    students: [
      { id: 801, name: '휴원 김민재', gender: 'M', school: '정발고', grade: '고3' },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
