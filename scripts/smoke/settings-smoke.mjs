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
    const isPeakApi = url.href.startsWith('https://chejump.com/peak')
      || url.href.startsWith('https://supermax.kr/peak')
      || url.href.startsWith('http://localhost:8330/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    if (request.method() !== 'GET') state.bodies.push({ method: request.method(), path, body: request.postDataJSON() });

    if (request.method() === 'GET' && path === '/record-types') return jsonRoute(route, makeRecordTypes());
    if (request.method() === 'GET' && path === '/score-tables') return jsonRoute(route, makeScoreTables());
    if (request.method() === 'GET' && path === '/score-tables/10') return jsonRoute(route, makeScoreTableDetail());
    if (request.method() === 'POST' && path === '/record-types') return jsonRoute(route, { success: true, id: 3 }, 201);
    if (request.method() === 'POST' && path === '/score-tables') return jsonRoute(route, { success: true, scoreTableId: 11 }, 201);
    if (request.method() === 'PUT' && path === '/score-tables/ranges/501') return jsonRoute(route, { success: true });
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '실기 측정 설정', exact: true }).waitFor();
  await page.getByRole('button', { name: '종목 추가' }).click();
  await page.getByLabel('종목명').fill('메디신볼던지기');
  await page.getByLabel('단위').fill('m');
  await page.getByRole('button', { name: '저장' }).click();

  await page.getByRole('button', { name: '배점표', exact: true }).click();
  await page.getByRole('button', { name: '배점표 생성' }).click();
  await page.getByLabel('종목').selectOption('2');
  await page.getByRole('button', { name: '생성', exact: true }).click();

  await page.getByRole('button', { name: /제자리멀리뛰기 배점표 열기/ }).click();
  await page.getByRole('button', { name: '100점 구간 수정' }).click();
  await page.locator('input[type="number"]').first().fill('246');
  await page.getByRole('button', { name: '100점 구간 저장' }).click();

  const createType = state.bodies.find((entry) => entry.path === '/record-types');
  if (!createType || createType.body.name !== '메디신볼던지기' || createType.body.unit !== 'm') {
    throw new Error('record type create contract was not preserved');
  }

  const createScore = state.bodies.find((entry) => entry.path === '/score-tables');
  if (!createScore || createScore.body.record_type_id !== 2 || createScore.body.score_step !== 2) {
    throw new Error('score table create contract was not preserved');
  }

  const saveRange = state.bodies.find((entry) => entry.path === '/score-tables/ranges/501');
  if (!saveRange || saveRange.body.male_min !== 246 || saveRange.body.female_max !== 9999.99) {
    throw new Error('score range update contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'settings desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-settings-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'settings');
  await browser.close();
}

function makeRecordTypes() {
  return {
    recordTypes: [
      { id: 1, name: '제자리멀리뛰기', unit: 'cm', direction: 'higher', is_active: true, display_order: 1, min_value: 100, max_value: 350 },
      { id: 2, name: '왕복달리기', unit: '초', direction: 'lower', is_active: true, display_order: 2, min_value: 6, max_value: 20 },
    ],
  };
}

function makeScoreTables() {
  return {
    scoreTables: [
      {
        id: 10,
        record_type_id: 1,
        record_type_name: '제자리멀리뛰기',
        unit: 'cm',
        direction: 'higher',
        name: '제자리멀리뛰기 배점표',
        max_score: 100,
        min_score: 50,
        score_step: 2,
        value_step: 5,
        decimal_places: 0,
        male_perfect: 250,
        female_perfect: 220,
      },
    ],
  };
}

function makeScoreTableDetail() {
  return {
    success: true,
    scoreTable: makeScoreTables().scoreTables[0],
    ranges: [
      { id: 501, score_table_id: 10, score: 100, male_min: 250, male_max: 9999.99, female_min: 220, female_max: 9999.99 },
      { id: 502, score_table_id: 10, score: 98, male_min: 245, male_max: 249, female_min: 215, female_max: 219 },
      { id: 503, score_table_id: 10, score: 50, male_min: 0, male_max: 149, female_min: 0, female_max: 129 },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
