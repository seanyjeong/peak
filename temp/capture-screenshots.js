const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../landing/screenshots');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // 1. 로그인
    console.log('1. 로그인 중...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'sean8320@naver.com');
    await page.fill('input[type="password"]', 'q141171616!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('   로그인 성공!');

    // 2. 대시보드 스크린샷
    console.log('2. 대시보드 스크린샷...');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/dashboard.png`, fullPage: false });
    console.log('   저장: dashboard.png');

    // 3. 반 배치 페이지
    console.log('3. 반 배치 스크린샷...');
    await page.goto('http://localhost:3000/assignments');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/assignments.png`, fullPage: false });
    console.log('   저장: assignments.png');

    // 4. 기록 측정 페이지
    console.log('4. 기록 측정 스크린샷...');
    await page.goto('http://localhost:3000/records');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/records.png`, fullPage: false });
    console.log('   저장: records.png');

    // 5. 학생 프로필 (실제 학생)
    console.log('5. 학생 프로필 스크린샷...');
    await page.goto('http://localhost:3000/students/97');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/student-profile.png`, fullPage: false });
    console.log('   저장: student-profile.png');

    // 6. 수업 기록 페이지
    console.log('6. 수업 기록 스크린샷...');
    await page.goto('http://localhost:3000/training');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/training.png`, fullPage: false });
    console.log('   저장: training.png');

    // 7. 학생 관리 페이지
    console.log('7. 학생 관리 스크린샷...');
    await page.goto('http://localhost:3000/students');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/students.png`, fullPage: false });
    console.log('   저장: students.png');

    console.log('\n모든 스크린샷 완료!');
  } catch (err) {
    console.error('오류 발생:', err);
  } finally {
    await browser.close();
  }
}

main();
