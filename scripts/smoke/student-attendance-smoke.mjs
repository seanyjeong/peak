import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  createAuthedPage,
  launchSmokeBrowser,
  mockPeakApi,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

async function runStudentAttendance(browser, viewport, screenshotPath) {
  const state = {};
  const { context, diagnostics, page } = await createAuthedPage(browser, viewport);
  await mockPeakApi(context, state);

  await page.goto('/student-attendance', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '학생 출석' }).waitFor();
  await page.getByTestId('student-attendance-list').getByText('저녁반 학생').waitFor();
  await page.getByText('강하늘').waitFor();
  await page.getByRole('button', { name: '미체크 출석 처리' }).click();
  const successToast = page.getByText('1명을 출석 처리했습니다.');
  await successToast.waitFor();
  await page.getByRole('button', { name: /오후반/ }).click();
  await page.getByTestId('student-attendance-list').getByText('오후반 학생').waitFor();
  await page.getByTestId('student-row-102').getByRole('button', { name: '결석' }).click();

  const getCalls = state.hits?.filter((hit) => hit.startsWith('GET /attendance/students?date=')).length || 0;
  const batchCalls = state.hits?.filter((hit) => hit === 'POST /attendance/student/batch').length || 0;
  const singleCalls = state.hits?.filter((hit) => hit === 'POST /attendance/student').length || 0;
  if (getCalls !== 1 || batchCalls !== 1 || singleCalls !== 1) {
    throw new Error(`student attendance API contract mismatch: ${JSON.stringify(state.hits)}`);
  }

  await assertNoHorizontalOverflow(page, 'student-attendance');
  assertNoConsoleProblems(diagnostics, 'student-attendance');
  await successToast.waitFor({ state: 'detached', timeout: 6000 });
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();
  return state;
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const desktop = await runStudentAttendance(browser, { width: 1440, height: 960 }, '/Users/etlab/peak-student-attendance-desktop.png');
    const tablet = await runStudentAttendance(browser, { width: 1024, height: 900 }, '/Users/etlab/peak-student-attendance-tablet.png');
    console.log(JSON.stringify({ desktopHits: desktop.hits, desktopBodies: desktop.bodies, tabletHits: tablet.hits }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
