import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  createAuthedPage,
  launchSmokeBrowser,
  mockPeakApi,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

async function runAttendance(browser, viewport, screenshotPath) {
  const state = {};
  const { context, diagnostics, page } = await createAuthedPage(browser, viewport);
  await mockPeakApi(context, state);

  await page.goto('/attendance', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '출근 체크' }).waitFor();
  await page.getByTestId('attendance-list').getByText('저녁반 강사').waitFor();
  await page.getByText('박코치').waitFor();
  await page.getByRole('button', { name: /오후반/ }).click();
  await page.getByTestId('attendance-list').getByText('오후반 강사').waitFor();
  await page.getByText('최코치').waitFor();

  const attendanceCalls = state.hits?.filter((hit) => hit.startsWith('GET /attendance?date=')).length || 0;
  if (attendanceCalls !== 1) {
    throw new Error(`attendance API contract mismatch: ${JSON.stringify(state.hits)}`);
  }

  await assertNoHorizontalOverflow(page, 'attendance');
  assertNoConsoleProblems(diagnostics, 'attendance');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();
  return state;
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const desktop = await runAttendance(browser, { width: 1440, height: 960 }, '/Users/etlab/peak-attendance-desktop.png');
    const tablet = await runAttendance(browser, { width: 1024, height: 900 }, '/Users/etlab/peak-attendance-tablet.png');
    console.log(JSON.stringify({ desktopHits: desktop.hits, tabletHits: tablet.hits }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
