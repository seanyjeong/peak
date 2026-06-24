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
  const state = { bodies: [], hits: [] };

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPeakApi = url.href.startsWith('https://chejump.com/peak')
      || url.href.startsWith('https://supermax.kr/peak')
      || url.href.startsWith('http://localhost:8330/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    state.hits.push(`${request.method()} ${path}`);
    if (request.method() !== 'GET') state.bodies.push({ path, body: request.postDataJSON() });

    if (request.method() === 'GET' && path === '/assignments') return jsonRoute(route, makeAssignments());
    if (request.method() === 'GET' && path === '/training') return jsonRoute(route, { success: true, logs: [] });
    if (request.method() === 'GET' && path === '/plans') return jsonRoute(route, makePlans());
    if (request.method() === 'GET' && path === '/exercises') return jsonRoute(route, makeExercises());
    if (request.method() === 'PUT' && path === '/plans/20/conditions') return jsonRoute(route, { success: true, checked_at: '2026-06-24T10:00:00.000Z' });
    if (request.method() === 'PUT' && path === '/plans/20/toggle-exercise') return jsonRoute(route, { success: true, completed_exercises: [1], exercise_times: { 1: '2026-06-24T10:01:00.000Z' } });
    if (request.method() === 'POST' && path === '/plans/20/extra-exercise') return jsonRoute(route, { success: true, extra_exercises: [{ name: '마무리 스트레칭', note: '5분', completed: false }] });
    if (request.method() === 'PUT' && path === '/plans/20/toggle-extra') return jsonRoute(route, { success: true, extra_exercises: [{ name: '마무리 스트레칭', note: '5분', completed: true }] });
    if (request.method() === 'POST' && path === '/training') return jsonRoute(route, { success: true, logId: 501 }, 201);
    if (request.method() === 'PUT' && path.startsWith('/training/')) return jsonRoute(route, { success: true });
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/training', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '수업 기록', exact: true }).waitFor();
  await page.getByRole('heading', { name: '박코치 체크리스트' }).waitFor();

  await page.getByPlaceholder('온도').fill('23.5');
  await page.getByPlaceholder('온도').blur();
  await page.getByRole('button', { name: /스쿼트/ }).click();
  await page.getByRole('button', { name: '좋음' }).first().click();
  await page.getByRole('button', { name: /운동 추가/ }).click();
  await page.getByPlaceholder('운동 이름').fill('마무리 스트레칭');
  await page.getByPlaceholder('메모').first().fill('5분');
  await page.getByRole('button', { name: '추가' }).click();

  if (!state.bodies.some((entry) => entry.path === '/plans/20/conditions' && entry.body.temperature === 23.5)) {
    throw new Error('conditions API contract was not preserved');
  }
  if (!state.bodies.some((entry) => entry.path === '/plans/20/toggle-exercise' && entry.body.exercise_id === 1)) {
    throw new Error('toggle exercise API contract was not preserved');
  }
  if (!state.bodies.some((entry) => entry.path === '/training' && entry.body.student_id === 201 && entry.body.condition_score === 4)) {
    throw new Error('student condition API contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'training desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-training-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'training');
  await browser.close();
}

function makeAssignments() {
  const student = (id, studentId, name, gender, status = 'present') => ({
    id,
    student_id: studentId,
    student_name: name,
    gender,
    status: 'enrolled',
    attendance_status: status,
    absence_reason: status === 'absent' ? '병원' : null,
  });

  return {
    success: true,
    slots: {
      evening: {
        waitingStudents: [],
        waitingInstructors: [],
        classes: [
          {
            class_num: 1,
            instructors: [{ id: 7, name: '박코치', isOwner: false, isMain: true }],
            students: [
              student(1, 201, '김서연', 'F'),
              student(2, 202, '유민재', 'M'),
              student(3, 203, '오지안', 'F', 'absent'),
            ],
          },
        ],
      },
    },
  };
}

function makePlans() {
  return {
    success: true,
    slots: {
      evening: [
        { id: -1, name: '테스트 원장', user_id: 1, time_slot: 'evening', isOwner: true },
        { id: 7, name: '박코치', user_id: 70, time_slot: 'evening' },
      ],
    },
    plans: [
      {
        id: 20,
        date: '2026-06-24',
        time_slot: 'evening',
        instructor_id: 7,
        instructor_name: '박코치',
        exercises: [
          { exercise_id: 1, name: '스쿼트', note: '기본 자세', weight: '40kg', reps: 12 },
          { exercise_id: 2, name: '왕복달리기', note: '3회', reps: 3 },
        ],
        completed_exercises: [],
        extra_exercises: [],
        exercise_times: {},
        conditions_checked: 0,
        conditions_checked_at: null,
        temperature: null,
        humidity: null,
      },
    ],
  };
}

function makeExercises() {
  return {
    exercises: [
      { id: 1, name: '스쿼트', tags: ['lower'] },
      { id: 2, name: '왕복달리기', tags: ['speed'] },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
