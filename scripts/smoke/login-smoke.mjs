import {
  assertNoConsoleProblems,
  assertNoHorizontalOverflow,
  createDiagnostics,
  jsonRoute,
  launchSmokeBrowser,
  stabilizeForScreenshot,
} from './peak-smoke-utils.mjs';

const BASE_URL = process.env.PEAK_SMOKE_BASE_URL || 'http://localhost:3110';
const TECHNICAL_ERROR_PATTERN = /Unauthorized|Forbidden|Network Error|CORS|ERR_|stack|token|401|403|500/i;

async function main() {
  const browser = await launchSmokeBrowser();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 860 },
  });
  await context.addInitScript(() => {
    window.__PEAK_SMOKE__ = true;
    localStorage.setItem('peak-ui-theme', 'light');
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  const hits = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPeakApi = url.href.startsWith('https://supermax.kr/peak');

    if (!isPeakApi) return route.continue();

    const path = url.pathname.replace(/^\/peak/, '') || '/';
    hits.push(`${request.method()} ${path}`);
    if (request.method() === 'POST' && path === '/auth/login') {
      return jsonRoute(route, { message: 'Unauthorized token stack' }, 401);
    }

    return jsonRoute(route, { message: 'mocked' });
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '로그인' }).waitFor();
  await page.getByLabel('이메일').fill('wrong@example.com');
  await page.getByLabel('비밀번호').fill('wrong-password');
  const loginResponse = page.waitForResponse((response) => response.url().includes('/auth/login'));
  await page.getByRole('button', { name: /로그인/ }).click();
  await loginResponse;
  await page.waitForTimeout(500);

  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('이메일과 비밀번호를 다시 확인해주세요.')) {
    throw new Error(`login safe error was not rendered. hits=${JSON.stringify(hits)} body=${bodyText}`);
  }
  if (TECHNICAL_ERROR_PATTERN.test(bodyText)) {
    throw new Error('login error exposes a technical message');
  }

  await assertNoHorizontalOverflow(page, 'login desktop');
  await stabilizeForScreenshot(page);
  await page.screenshot({ path: '/Users/etlab/peak-login-desktop.png', fullPage: true });

  assertNoConsoleProblems(diagnostics, 'login');
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
