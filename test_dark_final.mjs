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
  await page.waitForTimeout(1000);

  // 알림 팝업 닫기
  try {
    const closeBtn = await page.$('button:has-text("확인")');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {}

  console.log('2. 라이트 모드 스크린샷...');
  await page.screenshot({ path: '/tmp/final_light.png' });

  console.log('3. 다크모드 토글 클릭...');
  await page.click('button[title*="다크"]');
  await page.waitForTimeout(1000);

  // html에 dark 클래스 확인
  const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log('   HTML dark 클래스: ' + (hasDark ? '✓ 있음' : '✗ 없음'));

  // 배경색 확인
  const bgColor = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  console.log('   배경색: ' + bgColor);

  await page.screenshot({ path: '/tmp/final_dark.png' });
  console.log('4. 다크 모드 스크린샷 저장');

  // 여러 페이지 테스트
  const pages = ['/assignments', '/records', '/students'];
  for (const p of pages) {
    await page.goto(`${BASE_URL}${p}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const pageName = p.replace('/', '');
    await page.screenshot({ path: `/tmp/final_dark_${pageName}.png` });
    console.log(`   ✓ ${p} 스크린샷`);
  }

  await browser.close();
  console.log('\n완료!');
}

test().catch(console.error);
