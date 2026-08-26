import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  createAuthedPage,
  jsonRoute,
  launchSmokeBrowser,
  mockPeakApi,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

async function runAssignments(browser, viewport, screenshotPath) {
  const state = {};
  const { context, diagnostics, page } = await createAuthedPage(browser, viewport);
  await mockPeakApi(context, state);

  await page.goto('/assignments', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '반 배치' }).waitFor();
  await page.getByTestId('assignments-board').getByText('최코치반').waitFor();
  await page.getByText('강하늘').waitFor();
  await page.getByRole('button', { name: /오후반/ }).click();
  await page.getByTestId('assignments-board').getByText('이코치반').waitFor();
  await page.getByRole('button', { name: '새로고침' }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('반 배치 데이터를 불러오는 중입니다.'));
  await page.getByTestId('assignments-board').getByText('이코치반').waitFor();
  if (await page.getByTestId('assignments-board').getByText('최코치반').isVisible()) {
    throw new Error('assignments refresh moved afternoon selection to evening');
  }
  await page.getByRole('button', { name: /프리셋/ }).click();
  await page.getByRole('button', { name: /기본 배치/ }).click();
  await page.getByRole('heading', { name: '프리셋 적용' }).waitFor();
  await page.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '초기화' }).click();
  await page.getByRole('heading', { name: '반 배치 초기화' }).waitFor();
  await page.getByRole('button', { name: '취소' }).click();

  const syncCalls = state.hits?.filter((hit) => hit === 'POST /assignments/sync').length || 0;
  const assignmentCalls = state.hits?.filter((hit) => hit.startsWith('GET /assignments?date=')).length || 0;
  const presetCalls = state.hits?.filter((hit) => hit === 'GET /presets').length || 0;
  if (syncCalls !== 1 || assignmentCalls !== 2 || presetCalls !== 1) {
    throw new Error(`assignments API contract mismatch: ${JSON.stringify(state.hits)}`);
  }

  await assertNoHorizontalOverflow(page, 'assignments');
  assertNoConsoleProblems(diagnostics, 'assignments');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();
  return state;
}

async function runAssignmentsFailure(browser) {
  const state = {};
  const { context, diagnostics, page } = await createAuthedPage(browser);
  await mockPeakApi(context, state);
  await context.route('https://supermax.kr/peak/assignments/sync', (route) => (
    jsonRoute(route, { error: 'Internal Server Error' }, 500)
  ));

  await page.goto('/assignments', { waitUntil: 'networkidle' });
  await page.getByText('반 배치 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();

  const visibleText = await page.locator('body').innerText();
  for (const forbidden of ['Internal Server Error', '500', 'CORS', 'stack trace']) {
    if (visibleText.includes(forbidden)) {
      throw new Error(`assignments error UX leaked technical detail: ${forbidden}`);
    }
  }

  assertNoConsoleProblems(diagnostics, 'assignments failure UX');
  await context.close();
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const desktop = await runAssignments(browser, { width: 1440, height: 960 }, '/Users/etlab/peak-assignments-desktop.png');
    const tablet = await runAssignments(browser, { width: 1024, height: 900 }, '/Users/etlab/peak-assignments-tablet.png');
    await runAssignmentsFailure(browser);
    console.log(JSON.stringify({ desktopHits: desktop.hits, tabletHits: tablet.hits }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
