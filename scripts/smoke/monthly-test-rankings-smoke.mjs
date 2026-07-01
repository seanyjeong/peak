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
  const state = { hits: [] };

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPeakApi = url.href.startsWith('https://supermax.kr/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    state.hits.push(`${request.method()} ${path}`);
    if (request.method() === 'GET' && path === '/monthly-tests/31/all-records') return jsonRoute(route, makeRankings());
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/monthly-test/31/rankings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '6월 실기 테스트', exact: true }).waitFor();
  await page.getByRole('button', { name: '멀리' }).click();
  await page.getByRole('button', { name: '여' }).click();
  await page.getByText('김서연').waitFor();

  if (!state.hits.includes('GET /monthly-tests/31/all-records')) {
    throw new Error('monthly test rankings API was not requested');
  }

  await assertNoHorizontalOverflow(page, 'monthly test rankings desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-monthly-test-rankings-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'monthly test rankings');
  await browser.close();
}

function makeRankings() {
  return {
    success: true,
    test: { id: 31, test_name: '6월 실기 테스트', test_month: '2026-06', status: 'active' },
    record_types: [
      { id: 100, record_type_id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm', direction: 'higher' },
      { id: 101, record_type_id: 2, name: '왕복달리기', short_name: '왕복', unit: '초', direction: 'lower' },
    ],
    participants: [
      { student_id: 201, name: '김서연', gender: 'F', school: '백마고', grade: '고2', participant_type: 'enrolled', records: { 1: 236, 2: 9.8 }, scores: { 1: 98, 2: 96 }, total_score: 194, scored_count: 2 },
      { student_id: 202, name: '유민재', gender: 'M', school: '정발고', grade: '고3', participant_type: 'enrolled', records: { 1: 251, 2: 9.3 }, scores: { 1: 100, 2: 98 }, total_score: 198, scored_count: 2 },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
