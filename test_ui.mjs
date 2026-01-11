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
  console.log('✓ 로그인 성공');
  
  console.log('2. PC 대시보드 확인...');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/dashboard_light.png', fullPage: false });
  console.log('✓ 라이트모드 스크린샷 저장');
  
  console.log('3. 다크모드 토글 확인...');
  const darkToggle = await page.$('button[title*="다크"]');
  if (darkToggle) {
    console.log('✓ 다크모드 토글 버튼 발견!');
    await darkToggle.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/dashboard_dark.png', fullPage: false });
    console.log('✓ 다크모드 스크린샷 저장');
  } else {
    console.log('✗ 다크모드 토글 버튼 없음');
  }
  
  // 원형 프로그레스 색상 확인
  const orangeCircle = await page.$('circle[stroke="#f97316"]');
  const tealCircle = await page.$('circle[stroke="#14b8a6"]');
  
  console.log('\n4. 색상 확인:');
  console.log(orangeCircle ? '✓ 오렌지 (#f97316) 적용됨' : '✗ 오렌지 없음');
  console.log(tealCircle ? '✓ 틸 (#14b8a6) 적용됨' : '✗ 틸 없음');
  
  await browser.close();
  console.log('\n모든 테스트 완료!');
}

test().catch(console.error);
