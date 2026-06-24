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
    const isPeakApi = url.href.startsWith('https://chejump.com/peak')
      || url.href.startsWith('https://supermax.kr/peak')
      || url.href.startsWith('http://localhost:8330/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    state.hits.push(`${request.method()} ${path}`);

    if (request.method() === 'GET' && path === '/analytics/report') {
      return jsonRoute(route, makeReport());
    }

    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /분석 리포트/ }).waitFor();
  await page.getByText('종목별 최신 평균').waitFor();
  await page.getByRole('button', { name: '왕복' }).click();
  await page.locator('span').filter({ hasText: /^왕복달리기$/ }).waitFor();
  await page.getByText('여자 Top 10').waitFor();
  await page.getByRole('button', { name: /상승/ }).click();
  await page.getByText('정하린').first().waitFor();

  if (!state.hits.includes('GET /analytics/report')) {
    throw new Error('analytics report API was not requested');
  }

  await assertNoHorizontalOverflow(page, 'analytics desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-analytics-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'analytics');
  await browser.close();
}

function makeReport() {
  return {
    summary: {
      totalRecords: 1284,
      totalStudents: 64,
      academyName: '일산 맥스체대입시',
      reportDate: '2026-06-24',
      totalEvents: 2,
      overallTrend: { improving: 18, maintaining: 36, declining: 10 },
    },
    eventAverages: [
      {
        recordTypeId: 1,
        recordTypeName: '제자리멀리뛰기',
        shortName: '멀리',
        unit: 'cm',
        direction: 'higher',
        maleAvg: 241.8,
        femaleAvg: 208.4,
        totalAvg: 224.6,
        maleCount: 34,
        femaleCount: 30,
      },
      {
        recordTypeId: 2,
        recordTypeName: '왕복달리기',
        shortName: '왕복',
        unit: '초',
        direction: 'lower',
        maleAvg: 9.8,
        femaleAvg: 10.7,
        totalAvg: 10.2,
        maleCount: 34,
        femaleCount: 30,
      },
    ],
    rankings: [
      {
        recordTypeId: 1,
        recordTypeName: '제자리멀리뛰기',
        unit: 'cm',
        direction: 'higher',
        male: [
          { rank: 1, studentId: 201, studentName: '문태오', value: 278, measuredAt: '2026-06-20' },
          { rank: 2, studentId: 202, studentName: '강하늘', value: 271, measuredAt: '2026-06-20' },
        ],
        female: [
          { rank: 1, studentId: 203, studentName: '배수아', value: 236, measuredAt: '2026-06-20' },
        ],
      },
      {
        recordTypeId: 2,
        recordTypeName: '왕복달리기',
        unit: '초',
        direction: 'lower',
        male: [
          { rank: 1, studentId: 202, studentName: '강하늘', value: 8.9, measuredAt: '2026-06-22' },
        ],
        female: [
          { rank: 1, studentId: 205, studentName: '정하린', value: 9.8, measuredAt: '2026-06-22' },
        ],
      },
    ],
    eventTrends: [
      makeTrend(1, '제자리멀리뛰기', 'cm', 'higher'),
      makeTrend(2, '왕복달리기', '초', 'lower'),
    ],
    insufficientData: [
      {
        studentId: 301,
        studentName: '오지안',
        gender: 'F',
        events: [{ recordTypeName: '왕복달리기', recordCount: 3 }],
      },
    ],
  };
}

function makeTrend(recordTypeId, recordTypeName, unit, direction) {
  return {
    recordTypeId,
    recordTypeName,
    unit,
    direction,
    avgSlope: direction === 'lower' ? -0.8 : 1.2,
    avgTrend: 'improving',
    improving: [
      { studentId: 205, studentName: '정하린', gender: 'F', slope: direction === 'lower' ? -0.9 : 2.1, latestValue: direction === 'lower' ? 9.8 : 236, recentValues: [12, 11.4, 10.8, 10.1, 9.8] },
      { studentId: 202, studentName: '강하늘', gender: 'M', slope: direction === 'lower' ? -1.1 : 2.5, latestValue: direction === 'lower' ? 8.9 : 271, recentValues: [12, 11.1, 10.2, 9.4, 8.9] },
    ],
    maintaining: [
      { studentId: 203, studentName: '배수아', gender: 'F', slope: 0.1, latestValue: direction === 'lower' ? 10.4 : 236, recentValues: [10.5, 10.6, 10.4, 10.5, 10.4] },
    ],
    declining: [
      { studentId: 201, studentName: '문태오', gender: 'M', slope: direction === 'lower' ? 0.8 : -1.4, latestValue: direction === 'lower' ? 11.2 : 263, recentValues: [10, 10.3, 10.8, 11, 11.2] },
    ],
    analyzedCount: 4,
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
