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
    const isPeakApi = url.href.startsWith('https://supermax.kr/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    state.hits.push(`${request.method()} ${path}`);
    if (request.method() !== 'GET') {
      state.bodies.push({ path, body: request.postDataJSON() });
    }

    if (request.method() === 'GET' && path === '/plans') return jsonRoute(route, makePlans());
    if (request.method() === 'GET' && path === '/exercises') return jsonRoute(route, makeExercises());
    if (request.method() === 'GET' && path === '/exercise-tags') return jsonRoute(route, makeExerciseTags());
    if (request.method() === 'POST' && path === '/plans') return jsonRoute(route, { success: true, planId: 33 }, 201);
    if (request.method() === 'PUT' && path.startsWith('/plans/')) return jsonRoute(route, { success: true });
    if (request.method() === 'DELETE' && path.startsWith('/plans/')) return jsonRoute(route, { success: true });
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/plans', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '수업 계획', exact: true }).waitFor();
  await page.getByText('작성 현황').waitFor();
  await page.getByRole('heading', { name: '박코치' }).waitFor();

  await page.getByRole('button', { name: /계획 추가/ }).click();
  await page.locator('select').selectOption({ label: '윤코치' });
  await page.getByRole('button', { name: '하체', exact: true }).click();
  await page.getByRole('button', { name: /스쿼트/ }).click();
  await page.getByPlaceholder('무게/개수').fill('40kg');
  await page.getByPlaceholder('횟수').fill('12');
  await page.getByPlaceholder('세부사항').fill('무릎 각도 확인');
  await page.getByPlaceholder('수업 방향이나 주의사항').fill('하체 안정성 중심');
  await page.getByRole('button', { name: /저장/ }).click();
  await page.getByText('계획 추가').waitFor();

  const postBody = state.bodies.find((entry) => entry.path === '/plans')?.body;
  if (!postBody || postBody.instructor_id !== 8 || postBody.exercises?.[0]?.weight !== '40kg') {
    throw new Error('plans POST contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'plans desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-plans-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'plans');
  await browser.close();
}

function makePlans() {
  return {
    success: true,
    slots: {
      morning: [{ id: -1, name: '테스트 원장', user_id: 1, time_slot: 'morning', isOwner: true }],
      afternoon: [{ id: -1, name: '테스트 원장', user_id: 1, time_slot: 'afternoon', isOwner: true }],
      evening: [
        { id: -1, name: '테스트 원장', user_id: 1, time_slot: 'evening', isOwner: true },
        { id: 7, name: '박코치', user_id: 70, time_slot: 'evening' },
        { id: 8, name: '윤코치', user_id: 80, time_slot: 'evening' },
      ],
    },
    plans: [
      {
        id: 20,
        instructor_id: 7,
        instructor_name: '박코치',
        time_slot: 'evening',
        tags: ['lower', 'speed'],
        exercises: [
          { exercise_id: 1, note: '기본 자세', weight: '30kg', reps: 10 },
          { exercise_id: 2, note: '왕복 3세트', reps: 3 },
        ],
        description: '측정 전 루틴 정리',
        date: '2026-06-24',
      },
    ],
  };
}

function makeExercises() {
  return {
    exercises: [
      { id: 1, name: '스쿼트', tags: ['lower'], default_sets: 3, default_reps: 10, description: '하체 기본', video_url: null },
      { id: 2, name: '왕복달리기', tags: ['speed'], default_sets: 3, default_reps: 1, description: '스피드', video_url: null },
      { id: 3, name: '배근력', tags: ['power'], default_sets: 2, default_reps: 5, description: '근력', video_url: null },
    ],
  };
}

function makeExerciseTags() {
  return {
    tags: [
      { id: 1, tag_id: 'lower', label: '하체', color: 'bg-emerald-100 text-emerald-700' },
      { id: 2, tag_id: 'speed', label: '스피드', color: 'bg-blue-100 text-blue-700' },
      { id: 3, tag_id: 'power', label: '근력', color: 'bg-amber-100 text-amber-700' },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
