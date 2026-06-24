import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  jsonRoute,
  launchSmokeBrowser,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

async function main() {
  const browser = await launchSmokeBrowser();
  const context = await browser.newContext({ baseURL: process.env.PEAK_SMOKE_BASE_URL || 'http://localhost:3110', viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const diagnostics = { consoleMessages: [], failedRequests: [], pageErrors: [] };

  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleMessages.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', (request) => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const isPeakApi = url.href.startsWith('https://chejump.com/peak')
      || url.href.startsWith('https://supermax.kr/peak')
      || url.href.startsWith('http://localhost:8330/peak');
    if (!isPeakApi) return route.continue();
    if (url.pathname.replace(/^\/peak/, '') === '/public/ilsanmax') return jsonRoute(route, makeBoard());
    return jsonRoute(route, { success: true });
  });

  await page.goto('/board/ilsanmax', { waitUntil: 'domcontentloaded' });
  await page.getByText('일산 맥스체대입시').waitFor();
  await page.getByRole('heading', { name: '종합순위' }).waitFor();
  await assertNoHorizontalOverflow(page, 'board');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-board-desktop.png', fullPage: true });
  assertNoConsoleProblems(diagnostics, 'board');
  await browser.close();
}

function makeBoard() {
  return {
    success: true,
    academy: { name: '일산 맥스체대입시', slug: 'ilsanmax' },
    test: { name: '6월 실기 테스트', month: '2026-06' },
    ranking: {
      male: [{ rank: 1, name: '유민재', school: '정발고', total: 98 }],
      female: [{ rank: 1, name: '김서연', school: '백마고', total: 96 }],
    },
    events: [
      {
        id: 1,
        name: '제자리멀리뛰기',
        shortName: '멀리',
        unit: 'cm',
        records: [
          { rank: 1, name: '유민재', school: '정발고', gender: 'M', value: 265, score: 100 },
          { rank: 1, name: '김서연', school: '백마고', gender: 'F', value: 225, score: 98 },
        ],
      },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
