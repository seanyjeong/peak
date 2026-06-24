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
    if (request.method() !== 'GET') state.bodies.push({ path, body: request.postDataJSON() });

    if (request.method() === 'GET' && path === '/test-sessions/41/records') return jsonRoute(route, makeRecords());
    if (request.method() === 'POST' && path === '/test-sessions/41/records/batch') return jsonRoute(route, { success: true });
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/monthly-test/31/41/records', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '기록 측정', exact: true }).waitFor();
  await page.locator('input[type="number"]').first().fill('236');
  await page.waitForTimeout(800);

  const saveBody = state.bodies.find((entry) => entry.path === '/test-sessions/41/records/batch')?.body;
  if (!saveBody || saveBody.records?.[0]?.student_id !== 201 || saveBody.records?.[0]?.value !== 236) {
    throw new Error('monthly test record save contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'monthly test records desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-monthly-test-records-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'monthly test records');
  await browser.close();
}

function makeRecords() {
  return {
    success: true,
    session: { id: 41, test_date: '2026-06-24', time_slot: 'morning', test_name: '6월 실기 테스트', monthly_test_id: 31 },
    record_types: [
      { id: 100, record_type_id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm', direction: 'higher' },
      { id: 101, record_type_id: 2, name: '왕복달리기', short_name: '왕복', unit: '초', direction: 'lower' },
    ],
    participants: [
      { id: 901, student_id: 201, name: '김서연', gender: 'F', school: '백마고', grade: '고2', participant_type: 'enrolled', records: { 1: 232 }, test_group_id: 701 },
      { id: 902, student_id: 202, name: '유민재', gender: 'M', school: '정발고', grade: '고3', participant_type: 'enrolled', records: {}, test_group_id: 701 },
    ],
    groups: [{ id: 701, group_num: 1, instructors: [{ instructor_id: 4, name: '김코치', is_main: true }] }],
    score_ranges: {
      1: [{ score: 100, male_min: 250, male_max: 9999.99, female_min: 220, female_max: 9999.99 }],
      2: [{ score: 100, male_min: 0, male_max: 9.2, female_min: 0, female_max: 10.0 }],
    },
    min_scores: { 1: 50, 2: 50 },
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
