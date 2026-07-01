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
    if (request.method() !== 'GET') state.bodies.push({ method: request.method(), path, body: request.postDataJSON() });

    if (request.method() === 'GET' && path === '/monthly-tests/31') return jsonRoute(route, makeTest());
    if (request.method() === 'GET' && path === '/record-types') return jsonRoute(route, makeRecordTypes());
    if (request.method() === 'GET' && path === '/monthly-tests/31/conflicts') return jsonRoute(route, { success: true, conflicts: [{ record_type_id_1: 1, record_type_id_2: 2 }] });
    if (request.method() === 'POST' && path === '/monthly-tests/31/sessions') return jsonRoute(route, { success: true, id: 42 });
    if (request.method() === 'PUT' && path === '/monthly-tests/31') return jsonRoute(route, { success: true });
    if (request.method() === 'PUT' && path === '/monthly-tests/31/conflicts') return jsonRoute(route, { success: true });
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/monthly-test/31', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '6월 실기 테스트', exact: true }).waitFor();

  await page.getByRole('button', { name: '진행중' }).click();
  await page.getByRole('button', { name: '세션 추가' }).click();
  await page.locator('input[type="date"]').fill('2026-06-28');
  await page.getByRole('button', { name: '추가', exact: true }).click();

  await page.getByRole('button', { name: '테스트 설정' }).click();
  await page.getByRole('button', { name: '메디신' }).click();
  await page.getByRole('button', { name: /멀리 \/ 왕복/ }).click();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.getByText('테스트 설정을 저장했습니다.').waitFor();

  const statusUpdate = state.bodies.find((entry) => entry.path === '/monthly-tests/31' && entry.body.status === 'active');
  if (!statusUpdate) throw new Error('monthly test status contract was not preserved');

  const sessionCreate = state.bodies.find((entry) => entry.path === '/monthly-tests/31/sessions');
  if (!sessionCreate || sessionCreate.body.test_date !== '2026-06-28' || sessionCreate.body.time_slot !== 'morning') {
    throw new Error('monthly test session create contract was not preserved');
  }

  const settingsSave = state.bodies.find((entry) => entry.path === '/monthly-tests/31' && Array.isArray(entry.body.record_type_ids));
  if (!settingsSave || !settingsSave.body.record_type_ids.includes(3)) {
    throw new Error('monthly test settings contract was not preserved');
  }

  const conflictsSave = state.bodies.find((entry) => entry.path === '/monthly-tests/31/conflicts');
  if (!conflictsSave || !Array.isArray(conflictsSave.body.conflicts)) {
    throw new Error('monthly test conflicts contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'monthly test detail desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-monthly-test-detail-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'monthly test detail');
  await browser.close();
}

function makeTest() {
  return {
    success: true,
    test: {
      id: 31,
      test_month: '2026-06',
      test_name: '6월 실기 테스트',
      status: 'draft',
      notes: null,
      record_types: [
        { id: 100, record_type_id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm' },
        { id: 101, record_type_id: 2, name: '왕복달리기', short_name: '왕복', unit: '초' },
      ],
      sessions: [
        { id: 41, test_date: '2026-06-24', time_slot: 'morning', participant_count: 28, group_count: 4 },
      ],
    },
  };
}

function makeRecordTypes() {
  return {
    recordTypes: [
      { id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm', direction: 'higher', is_active: true },
      { id: 2, name: '왕복달리기', short_name: '왕복', unit: '초', direction: 'lower', is_active: true },
      { id: 3, name: '메디신볼던지기', short_name: '메디신', unit: 'm', direction: 'higher', is_active: true },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
