import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  createAuthedPage,
  launchSmokeBrowser,
  mockPeakApi,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

async function runPresets(browser, viewport, screenshotPath) {
  const state = {};
  const { context, diagnostics, page } = await createAuthedPage(browser, viewport);
  await mockPeakApi(context, state);

  await page.goto('/presets', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '반 프리셋' }).waitFor();
  await page.getByTestId('preset-groups').getByText('최코치반').waitFor();
  await page.getByText('서로운').waitFor();
  await page.getByRole('button', { name: '새 프리셋' }).click();
  await page.getByRole('heading', { name: '새 프리셋 만들기' }).waitFor();
  await page.getByRole('button', { name: '취소' }).click();

  const presetCalls = state.hits?.filter((hit) => hit === 'GET /presets').length || 0;
  const studentCalls = state.hits?.filter((hit) => hit === 'GET /students?status=active').length || 0;
  const instructorCalls = state.hits?.filter((hit) => hit === 'GET /presets/instructors').length || 0;
  if (presetCalls !== 1 || studentCalls !== 1 || instructorCalls !== 1) {
    throw new Error(`presets API contract mismatch: ${JSON.stringify(state.hits)}`);
  }

  await assertNoHorizontalOverflow(page, 'presets');
  assertNoConsoleProblems(diagnostics, 'presets');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();
  return state;
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const desktop = await runPresets(browser, { width: 1440, height: 960 }, '/Users/etlab/peak-presets-desktop.png');
    const tablet = await runPresets(browser, { width: 1024, height: 900 }, '/Users/etlab/peak-presets-tablet.png');
    console.log(JSON.stringify({ desktopHits: desktop.hits, tabletHits: tablet.hits }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
