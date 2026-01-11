import { chromium } from 'playwright';

const SCREENSHOTS_DIR = '/home/sean/ilsanmaxtraining/landing/screenshots';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 1. 로그인 페이지로 이동
    console.log("1. 테스트 계정으로 로그인...");
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // 테스트 계정으로 로그인
    await page.fill('input[type="email"]', 'owner@test.com');
    await page.fill('input[type="password"]', 'test1234');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 2. 대시보드 확인
    console.log("2. 대시보드 확인...");
    await page.goto('http://localhost:3001/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    // 모달 닫기
    try {
        const closeBtn = page.locator('button:has-text("확인"), button:has-text("닫기")');
        if (await closeBtn.count() > 0) {
            await closeBtn.first().click();
            await page.waitForTimeout(500);
        }
    } catch(e) {}
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/test_dashboard.png` });
    console.log("  -> test_dashboard.png 저장완료");

    // 3. 학생 관리 확인
    console.log("3. 학생 관리 확인...");
    await page.goto('http://localhost:3001/students');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/test_students.png` });
    console.log("  -> test_students.png 저장완료");

    // 4. 반 배치 확인
    console.log("4. 반 배치 확인...");
    await page.goto('http://localhost:3001/assignments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/test_assignments.png` });
    console.log("  -> test_assignments.png 저장완료");

    await browser.close();
    console.log("\n완료!");
})();
