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
    state.hits.push(`${request.method()} ${path}${url.search}`);

    if (request.method() === 'GET' && path === '/students') return jsonRoute(route, makeStudents());
    if (request.method() === 'GET' && path === '/record-types') return jsonRoute(route, makeRecordTypes());
    if (request.method() === 'GET' && path === '/records/latest') return jsonRoute(route, makeLatestRecords());
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/students/records', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '전체 기록 관리', exact: true }).waitFor();
  await page.getByPlaceholder('학생 이름 또는 학교 검색').fill('김서연');
  await page.getByText('236cm').waitFor();

  const profileHref = await page.getByRole('link', { name: '김서연' }).getAttribute('href');
  if (profileHref !== '/students/201') throw new Error(`student record link target changed: ${profileHref}`);

  for (const expected of ['GET /students', 'GET /record-types?active=true', 'GET /records/latest']) {
    if (!state.hits.includes(expected)) throw new Error(`student records did not request ${expected}`);
  }

  await assertNoHorizontalOverflow(page, 'student records desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-student-records-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'student records');
  await browser.close();
}

function makeStudents() {
  return {
    students: [
      { id: 201, name: '김서연', gender: 'F', school: '백마고', grade: '고2', status: 'active' },
      { id: 202, name: '유민재', gender: 'M', school: '정발고', grade: '고3', status: 'trial' },
      { id: 203, name: '오지안', gender: 'F', school: '저동고', grade: '고2', status: 'pending' },
    ],
  };
}

function makeRecordTypes() {
  return {
    recordTypes: [
      { id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm', direction: 'higher' },
      { id: 2, name: '왕복달리기', short_name: '왕복', unit: '초', direction: 'lower' },
    ],
  };
}

function makeLatestRecords() {
  return {
    records: [
      { student_id: 201, record_type_id: 1, value: 236, measured_at: '2026-06-20', student_name: '김서연', gender: 'F', record_type_name: '제자리멀리뛰기', unit: 'cm', direction: 'higher' },
      { student_id: 201, record_type_id: 2, value: 9.8, measured_at: '2026-06-20', student_name: '김서연', gender: 'F', record_type_name: '왕복달리기', unit: '초', direction: 'lower' },
      { student_id: 202, record_type_id: 1, value: 251, measured_at: '2026-06-20', student_name: '유민재', gender: 'M', record_type_name: '제자리멀리뛰기', unit: 'cm', direction: 'higher' },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
