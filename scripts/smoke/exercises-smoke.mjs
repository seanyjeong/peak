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
    if (request.method() !== 'GET') {
      state.bodies.push({ path, body: request.postDataJSON() });
    }

    if (request.method() === 'GET' && path === '/exercises') return jsonRoute(route, makeExercises());
    if (request.method() === 'GET' && path === '/exercise-tags') return jsonRoute(route, makeTags());
    if (request.method() === 'GET' && path === '/exercise-packs') return jsonRoute(route, makePacks());
    if (request.method() === 'POST' && path === '/exercises') return jsonRoute(route, { success: true, id: 3 }, 201);
    if (request.method() === 'POST' && path === '/exercise-tags') return jsonRoute(route, { success: true, id: 3 }, 201);
    if (request.method() === 'POST' && path === '/exercise-packs') return jsonRoute(route, { success: true, id: 2 }, 201);
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/exercises', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '운동 관리', exact: true }).waitFor();
  await page.getByRole('button', { name: '운동 추가' }).click();
  await page.getByPlaceholder('박스점프, 메디신볼 던지기...').fill('메디신볼 던지기');
  await page.getByPlaceholder('3').fill('4');
  await page.getByPlaceholder('10').fill('8');
  await page.getByRole('button', { name: '상체 파워', exact: true }).click();
  await page.getByPlaceholder('운동 방법이나 주의사항...').fill('폭발적인 상체 출력 확인');
  await page.getByRole('button', { name: '저장' }).click();

  await page.getByRole('button', { name: '태그 관리' }).click();
  await page.getByRole('button', { name: '태그 추가' }).click();
  await page.getByPlaceholder('lower-power').fill('agility');
  await page.getByPlaceholder('하체 파워').fill('민첩성');
  await page.getByRole('button', { name: '저장' }).click();

  await page.getByRole('button', { name: '운동 팩' }).click();
  await page.getByRole('button', { name: '팩 만들기' }).click();
  await page.getByPlaceholder('하체 훈련 팩').fill('상체 테스트 팩');
  await page.getByPlaceholder('제멀, 스쿼트 관련 운동들').fill('메디신볼과 배근력 중심');
  await page.getByLabel('스쿼트').check();
  await page.getByRole('button', { name: '저장' }).click();

  const exerciseBody = state.bodies.find((entry) => entry.path === '/exercises')?.body;
  if (!exerciseBody || exerciseBody.name !== '메디신볼 던지기' || exerciseBody.default_sets !== 4) {
    throw new Error('exercise create contract was not preserved');
  }

  const tagBody = state.bodies.find((entry) => entry.path === '/exercise-tags')?.body;
  if (!tagBody || tagBody.tag_id !== 'agility' || tagBody.label !== '민첩성') {
    throw new Error('exercise tag create contract was not preserved');
  }

  const packBody = state.bodies.find((entry) => entry.path === '/exercise-packs')?.body;
  if (!packBody || packBody.name !== '상체 테스트 팩' || packBody.exercise_ids?.[0] !== 1) {
    throw new Error('exercise pack create contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'exercises desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-exercises-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'exercises');
  await browser.close();
}

function makeExercises() {
  return {
    exercises: [
      { id: 1, name: '스쿼트', tags: ['lower'], default_sets: 3, default_reps: 10, description: '하체 기본', video_url: null },
      { id: 2, name: '배근력', tags: ['upper'], default_sets: 2, default_reps: 5, description: '상체 근력', video_url: null },
    ],
  };
}

function makeTags() {
  return {
    tags: [
      { id: 1, tag_id: 'lower', label: '하체 파워', color: 'bg-emerald-100 text-emerald-700', display_order: 1, is_active: true },
      { id: 2, tag_id: 'upper', label: '상체 파워', color: 'bg-blue-100 text-blue-700', display_order: 2, is_active: true },
    ],
  };
}

function makePacks() {
  return {
    packs: [
      { id: 1, name: '기본 체력 팩', description: '기본 운동 묶음', version: '1.0.0', author: 'P-EAK', exercise_count: 2, created_at: '2026-06-24', is_system: false },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
