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

    if (request.method() === 'GET' && path === '/students/201/stats') return jsonRoute(route, makeStats());
    if (request.method() === 'GET' && path === '/students/201/records') return jsonRoute(route, makeRecords());
    if (request.method() === 'GET' && path === '/record-types') return jsonRoute(route, makeRecordTypes());
    if (request.method() === 'GET' && path === '/stats/academy-average') return jsonRoute(route, makeAcademyAverage());
    if (request.method() === 'GET' && path === '/score-tables') return jsonRoute(route, makeScoreTables());
    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/students/201', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '김서연', exact: true }).waitFor();
  await page.getByText('선택 종목 점수').waitFor();
  await page.getByRole('button', { name: '왕복' }).click();
  await page.getByRole('button', { name: '왕복' }).click();
  await page.getByRole('combobox').selectOption('2');
  await page.getByText('최근 기록', { exact: true }).waitFor();

  for (const expected of [
    'GET /students/201/stats',
    'GET /students/201/records',
    'GET /record-types?active=true',
    'GET /stats/academy-average',
    'GET /score-tables',
  ]) {
    if (!state.hits.includes(expected)) throw new Error(`student profile did not request ${expected}`);
  }

  await assertNoHorizontalOverflow(page, 'student profile desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-student-profile-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'student profile');
  await browser.close();
}

function makeRecordTypes() {
  return {
    recordTypes: [
      { id: 1, name: '제자리멀리뛰기', short_name: '멀리', unit: 'cm', direction: 'higher' },
      { id: 2, name: '왕복달리기', short_name: '왕복', unit: '초', direction: 'lower' },
      { id: 3, name: '메디신볼던지기', short_name: '메디신', unit: 'm', direction: 'higher' },
    ],
  };
}

function makeStats() {
  return {
    success: true,
    student: { id: 201, name: '김서연', gender: 'F', school: '백마고', grade: '고2', phone: null, status: 'active' },
    stats: {
      averages: { 1: 229, 2: 10.2, 3: 8.8 },
      bests: { 1: { value: 236, date: '2026-06-20' }, 2: { value: 9.8, date: '2026-06-20' }, 3: { value: 9.1, date: '2026-06-20' } },
      latests: { 1: { value: 236, date: '2026-06-20' }, 2: { value: 9.8, date: '2026-06-20' }, 3: { value: 9.1, date: '2026-06-20' } },
      scores: { 1: 98, 2: 96, 3: 92 },
      trends: { 1: 'up', 2: 'up', 3: 'stable' },
      totalScore: 286,
      maxPossibleScore: 300,
      percentage: 95.3,
      grade: 'A',
      overallTrend: 'up',
      recordCount: 18,
      typesWithRecords: 3,
    },
  };
}

function makeRecords() {
  const dates = ['2026-06-20', '2026-06-13', '2026-06-06', '2026-05-30', '2026-05-23', '2026-05-16'];
  return {
    success: true,
    records: dates.map((date, index) => ({
      measured_at: date,
      records: [
        { record_type_id: 1, record_type_name: '제자리멀리뛰기', unit: 'cm', value: 236 - index * 2 },
        { record_type_id: 2, record_type_name: '왕복달리기', unit: '초', value: 9.8 + index * 0.2 },
        { record_type_id: 3, record_type_name: '메디신볼던지기', unit: 'm', value: 9.1 - index * 0.1 },
      ],
    })),
  };
}

function makeAcademyAverage() {
  return {
    success: true,
    femaleAverages: { 1: 215, 2: 10.9, 3: 8.2 },
    femaleScoreAverages: { 1: 88, 2: 84, 3: 82 },
    maleAverages: {},
    maleScoreAverages: {},
  };
}

function makeScoreTables() {
  return {
    scoreTables: [
      { id: 10, record_type_id: 1, male_perfect: 250, female_perfect: 220, max_score: 100 },
      { id: 11, record_type_id: 2, male_perfect: 9.2, female_perfect: 10.0, max_score: 100 },
      { id: 12, record_type_id: 3, male_perfect: 10.5, female_perfect: 9.0, max_score: 100 },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
