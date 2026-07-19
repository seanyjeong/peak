import assert from 'node:assert/strict';
import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  jsonRoute,
  launchSmokeBrowser,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    for (const device of DEVICES) {
      await verifyPublicBoard(browser, device);
    }
  } finally {
    await browser.close();
  }
}

const DEVICES = [
  { label: 'desktop', userAgent: undefined, viewport: { width: 1280, height: 720 } },
  { label: 'tablet', userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-T970)', viewport: { width: 1024, height: 768 } },
  { label: 'mobile', userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S918N) Mobile', viewport: { width: 390, height: 844 } },
];

async function verifyPublicBoard(browser, device) {
  const context = await browser.newContext({
    baseURL: process.env.PEAK_SMOKE_BASE_URL || 'http://localhost:3110',
    userAgent: device.userAgent,
    viewport: device.viewport,
  });
  const page = await context.newPage();
  const diagnostics = { consoleMessages: [], failedRequests: [], pageErrors: [] };

  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleMessages.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', (request) => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!url.href.startsWith('https://supermax.kr/peak')) return route.continue();
    const path = url.pathname.replace(/^\/peak/, '');
    if (path === '/public/ilsanmax') return jsonRoute(route, makeBoard());
    if (path === '/public/ilsanmax/scores') return jsonRoute(route, makeScores());
    return jsonRoute(route, { success: true });
  });

  try {
    const boardResponse = await page.goto('/board/ilsanmax', { waitUntil: 'domcontentloaded' });
    assert.equal(boardResponse?.status(), 200, `${device.label} board status`);
    assert.equal(new URL(page.url()).pathname, '/board/ilsanmax', `${device.label} board URL`);
    await page.getByText('일산 맥스체대입시').first().waitFor();
    await page.getByRole('heading', { name: '종합순위' }).waitFor();
    await assertNoHorizontalOverflow(page, `${device.label} board`);

    const scoresResponse = await page.goto('/board/ilsanmax/scores', { waitUntil: 'domcontentloaded' });
    assert.equal(scoresResponse?.status(), 200, `${device.label} scores status`);
    assert.equal(new URL(page.url()).pathname, '/board/ilsanmax/scores', `${device.label} scores URL`);
    await page.getByText('실기 배점표').waitFor();
    await assertNoHorizontalOverflow(page, `${device.label} scores`);

    if (device.label === 'desktop') {
      await stabilizeForScreenshot(page);
      await page.screenshot({ path: '/Users/etlab/peak-board-desktop.png', fullPage: true });
    }
    assertNoConsoleProblems(diagnostics, `${device.label} public board`);
  } finally {
    await context.close();
  }
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

function makeScores() {
  return {
    success: true,
    academy: { name: '일산 맥스체대입시', slug: 'ilsanmax' },
    scoreTables: [
      {
        id: 1,
        recordType: { id: 1, name: '제자리멀리뛰기', shortName: '멀리', unit: 'cm', direction: 'higher' },
        maxScore: 100,
        minScore: 0,
        scoreStep: 1,
        decimalPlaces: 0,
        malePerfect: 265,
        femalePerfect: 225,
        ranges: [{ score: 100, male: { min: 265, max: 999 }, female: { min: 225, max: 999 } }],
      },
    ],
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
