import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  createAuthedPage,
  launchSmokeBrowser,
  mockPeakApi,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

async function runDashboard(browser, viewport, screenshotPath) {
  const state = {};
  const result = await createAuthedPage(browser, viewport);
  const { context, diagnostics, page } = result;
  await mockPeakApi(context, state);

  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '대시보드' }).waitFor();
  await page.getByText('오늘 스케줄').waitFor();
  await page.getByText('강사 현황').waitFor();
  await page.getByTestId('dashboard-attendance').getByText('저녁반 기준').waitFor();

  const assignmentCalls = state.hits?.filter((hit) => hit.startsWith('GET /assignments?date=')).length || 0;
  const attendanceCalls = state.hits?.filter((hit) => hit === 'GET /attendance/current').length || 0;
  if (assignmentCalls !== 1 || attendanceCalls !== 1) {
    throw new Error(`dashboard API contract mismatch: ${JSON.stringify(state.hits)}`);
  }

  await assertNoHorizontalOverflow(page, 'dashboard');
  assertNoConsoleProblems(diagnostics, 'dashboard');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();
  return state;
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const desktop = await runDashboard(browser, { width: 1440, height: 960 }, '/Users/etlab/peak-dashboard-desktop.png');
    const tablet = await runDashboard(browser, { width: 1024, height: 900 }, '/Users/etlab/peak-dashboard-tablet.png');
    console.log(JSON.stringify({ desktopHits: desktop.hits, tabletHits: tablet.hits }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
