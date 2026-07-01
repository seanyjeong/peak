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
    if (request.method() !== 'GET') state.bodies.push({ path, body: request.postDataJSON() });

    if (request.method() === 'GET' && path === '/monthly-tests') return jsonRoute(route, makeTests());
    if (request.method() === 'GET' && path === '/record-types') return jsonRoute(route, makeRecordTypes());
    if (request.method() === 'GET' && path === '/settings') return jsonRoute(route, { success: true, settings: { slug: 'ilsanmax' } });
    if (request.method() === 'POST' && path === '/monthly-tests') return jsonRoute(route, { success: true, id: 40 });
    if (request.method() === 'PUT' && path === '/monthly-tests/academy/slug') return jsonRoute(route, { success: true, slug: request.postDataJSON().slug });
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/monthly-test', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '월말테스트', exact: true }).waitFor();
  await page.getByText('6월 실기 테스트').waitFor();

  await page.getByRole('button', { name: /새 테스트/ }).click();
  await page.getByRole('button', { name: /제자리멀리뛰기/ }).click();
  await page.getByRole('button', { name: '생성', exact: true }).click();

  await page.getByRole('button', { name: /전광판 설정/ }).click();
  await page.locator('input[placeholder="ilsanmax"]').fill('gangnam-peak');
  await page.getByRole('button', { name: '저장' }).click();

  if (!state.bodies.some((entry) => entry.path === '/monthly-tests' && entry.body.record_type_ids?.[0] === 1)) {
    throw new Error('monthly test create contract was not preserved');
  }
  if (!state.bodies.some((entry) => entry.path === '/monthly-tests/academy/slug' && entry.body.slug === 'gangnam-peak')) {
    throw new Error('monthly test slug contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'monthly test desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-monthly-test-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'monthly test');
  await browser.close();
}

function makeTests() {
  return {
    tests: [
      {
        id: 31,
        test_month: '2026-06',
        test_name: '6월 실기 테스트',
        status: 'active',
        notes: null,
        session_count: 2,
        participant_count: 48,
        created_at: '2026-06-01T00:00:00.000Z',
      },
    ],
  };
}

function makeRecordTypes() {
  return {
    recordTypes: [
      { id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm', direction: 'higher', is_active: true },
      { id: 2, name: '왕복달리기', short_name: '왕복', unit: '초', direction: 'lower', is_active: true },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
