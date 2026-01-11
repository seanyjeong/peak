import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3002';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  console.log('1. 로그인...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'sean8320@naver.com');
  await page.fill('input[type="password"]', 'q141171616!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');

  // 알림 팝업 닫기
  const closeBtn = await page.$('button:has-text("확인")');
  if (closeBtn) await closeBtn.click();
  await page.waitForTimeout(500);

  console.log('2. 라이트 모드 스크린샷...');
  await page.screenshot({ path: '/tmp/test_light.png' });

  console.log('3. 다크모드 토글 클릭...');
  const toggle = await page.$('button[title*="다크"]');
  if (toggle) {
    await toggle.click();
    await page.waitForTimeout(1000);

    // html에 dark 클래스 확인
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    console.log('   HTML에 dark 클래스: ' + (hasDark ? '✓ 있음' : '✗ 없음'));

    await page.screenshot({ path: '/tmp/test_dark.png' });
    console.log('4. 다크 모드 스크린샷 저장');
  } else {
    console.log('   ✗ 토글 버튼 없음');
  }

  await browser.close();
  console.log('\n완료!');
}

test().catch(console.error);
