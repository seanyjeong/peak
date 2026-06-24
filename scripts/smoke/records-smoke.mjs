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

    if (request.method() === 'GET' && path === '/record-types') return jsonRoute(route, makeRecordTypes());
    if (request.method() === 'GET' && path === '/assignments') return jsonRoute(route, makeAssignments());
    if (request.method() === 'GET' && path.startsWith('/score-tables/by-type/')) return jsonRoute(route, makeScoreTable());
    if (request.method() === 'GET' && path === '/records/by-date') return jsonRoute(route, { success: true, records: [] });
    if (request.method() === 'POST' && path === '/records/batch') return jsonRoute(route, { success: true, count: 1, results: [{ id: 77 }] }, 201);
    if (request.method() === 'DELETE' && path === '/records') return jsonRoute(route, { success: true });
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/records', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '기록 측정', exact: true }).waitFor();
  await page.getByRole('button', { name: '전체 펼치기' }).click();
  await page.locator('input[type="number"]').first().fill('245');
  await page.locator('input[type="number"]').first().blur();
  await page.waitForTimeout(150);

  const saveBody = state.bodies.find((entry) => entry.path === '/records/batch')?.body;
  if (!saveBody || saveBody.student_id !== 201 || saveBody.records?.[0]?.value !== 245) {
    throw new Error('records batch API contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'records desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-records-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'records');
  await browser.close();
}

function makeRecordTypes() {
  return {
    recordTypes: [
      { id: 1, name: '제자리멀리뛰기', unit: 'cm', direction: 'higher', is_active: true, min_value: 100, max_value: 350 },
      { id: 2, name: '왕복달리기', unit: '초', direction: 'lower', is_active: true, min_value: 6, max_value: 20 },
    ],
  };
}

function makeScoreTable() {
  return {
    scoreTable: { id: 1, decimal_places: 0, min_score: 1 },
    ranges: [
      { score: 10, male_min: 240, male_max: 350, female_min: 210, female_max: 350 },
      { score: 8, male_min: 220, male_max: 239, female_min: 190, female_max: 209 },
    ],
  };
}

function makeAssignments() {
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
              { id: 1, student_id: 201, student_name: '김서연', gender: 'F', attendance_status: 'present' },
              { id: 2, student_id: 202, student_name: '유민재', gender: 'M', attendance_status: 'present' },
            ],
          },
        ],
      },
    },
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
