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

    if (request.method() === 'GET' && path === '/students') return jsonRoute(route, makeStudents());
    if (request.method() === 'GET' && path === '/record-types') return jsonRoute(route, makeRecordTypes());
    if (request.method() === 'GET' && path.startsWith('/score-tables/by-type/')) return jsonRoute(route, makeScoreTable());
    if (request.method() === 'GET' && path === '/students/201/records') return jsonRoute(route, makeStudentRecords());
    if (request.method() === 'POST' && path === '/records/batch') return jsonRoute(route, { success: true, count: 1 }, 201);
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 관리', exact: true }).waitFor();
  await page.getByPlaceholder('학생 이름 검색').fill('김서연');
  await page.getByRole('button', { name: /김서연/ }).click();
  await page.getByRole('button', { name: /기록 추가/ }).click();
  await page.locator('input[type="number"]').first().fill('245');
  await page.getByRole('button', { name: '저장' }).click();

  const saveBody = state.bodies.find((entry) => entry.path === '/records/batch')?.body;
  if (!saveBody || saveBody.student_id !== 201 || saveBody.records?.[0]?.value !== 245) {
    throw new Error('student quick record contract was not preserved');
  }

  await assertNoHorizontalOverflow(page, 'students desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-students-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'students');
  await browser.close();
}

function makeStudents() {
  return {
    students: [
      { id: 201, paca_student_id: 1201, name: '김서연', gender: 'F', phone: null, school: '백마고', grade: '고2', class_days: [1, 3], is_trial: false, trial_total: 0, trial_remaining: 0, join_date: '2026-03-01', status: 'active' },
      { id: 202, paca_student_id: 1202, name: '유민재', gender: 'M', phone: null, school: '정발고', grade: '고3', class_days: [2, 4], is_trial: false, trial_total: 0, trial_remaining: 0, join_date: '2026-03-02', status: 'active' },
      { id: 203, paca_student_id: 1203, name: '오지안', gender: 'F', phone: null, school: '저동고', grade: '고2', class_days: [1], is_trial: true, trial_total: 3, trial_remaining: 1, join_date: '2026-06-01', status: 'trial' },
    ],
  };
}

function makeRecordTypes() {
  return {
    recordTypes: [
      { id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm', direction: 'higher', is_active: true, min_value: 100, max_value: 350 },
      { id: 2, name: '왕복달리기', short_name: '왕복', unit: '초', direction: 'lower', is_active: true, min_value: 6, max_value: 20 },
    ],
  };
}

function makeScoreTable() {
  return {
    scoreTable: { id: 1, decimal_places: 0, min_score: 1 },
    ranges: [{ score: 10, male_min: 240, male_max: 350, female_min: 210, female_max: 350 }],
  };
}

function makeStudentRecords() {
  return {
    success: true,
    records: [
      {
        measured_at: '2026-06-01',
        records: [{ record_type_id: 1, record_type_name: '제자리멀리뛰기', unit: 'cm', direction: 'higher', value: 232, notes: null }],
      },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
