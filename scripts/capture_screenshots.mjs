import { chromium } from 'playwright';

const SCREENSHOTS_DIR = '/home/sean/ilsanmaxtraining/landing/screenshots';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 1. 로그인 페이지로 이동
    console.log("1. 로그인 페이지로 이동...");
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // 로그인 정보 입력
    console.log("2. 로그인 중...");
    await page.fill('input[type="email"]', 'sean8320@naver.com');
    await page.fill('input[type="password"]', 'q141171616!');
    await page.click('button[type="submit"]');

    // 대시보드로 리다이렉트 대기
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 3. 대시보드 스크린샷
    console.log("3. 대시보드 스크린샷...");
    await page.goto('http://localhost:3001/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    // 모달이 있으면 닫기
    try {
        const closeBtn = page.locator('button:has-text("확인"), button:has-text("닫기")');
        if (await closeBtn.count() > 0) {
            await closeBtn.first().click();
            await page.waitForTimeout(500);
        }
    } catch(e) {}
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/dashboard.png` });
    console.log("  -> dashboard.png 저장완료");

    // 4. 반 배치 스크린샷
    console.log("4. 반 배치 스크린샷...");
    await page.goto('http://localhost:3001/assignments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/assignments.png` });
    console.log("  -> assignments.png 저장완료");

    // 5. 기록 측정 스크린샷
    console.log("5. 기록 측정 스크린샷...");
    await page.goto('http://localhost:3001/records');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/records.png` });
    console.log("  -> records.png 저장완료");

    // 6. 학생 관리 스크린샷
    console.log("6. 학생 관리 스크린샷...");
    await page.goto('http://localhost:3001/students');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/students.png` });
    console.log("  -> students.png 저장완료");

    // 7. 학생 프로필 스크린샷
    console.log("7. 학생 프로필 스크린샷...");
    // 학생 링크 찾아서 클릭
    try {
        const studentLink = page.locator('a[href*="/students/"]').first();
        if (await studentLink.count() > 0) {
            await studentLink.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);
        }
    } catch(e) {
        await page.goto('http://localhost:3001/students/1');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/student-profile.png` });
    console.log("  -> student-profile.png 저장완료");

    // 8. 수업 기록 스크린샷
    console.log("8. 수업 기록 스크린샷...");
    await page.goto('http://localhost:3001/training');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/training.png` });
    console.log("  -> training.png 저장완료");

    // 9. 수업 계획 스크린샷
    console.log("9. 수업 계획 스크린샷...");
    await page.goto('http://localhost:3001/plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/plans.png` });
    console.log("  -> plans.png 저장완료");

    await browser.close();
    console.log("\n완료! 모든 스크린샷이 저장되었습니다.");
})();
