import { chromium } from 'playwright';

const SCREENSHOTS_DIR = '/home/sean/ilsanmaxtraining/landing/screenshots';
const BASE_URL = 'https://peak-rose.vercel.app';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 테스트 계정으로 로그인
    console.log("1. 테스트 계정으로 로그인...");
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'owner@test.com');
    await page.fill('input[type="password"]', 'test1234');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 2. 대시보드 스크린샷
    console.log("2. 대시보드 스크린샷...");
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // 모달 닫기
    try {
        const closeBtn = page.locator('button:has-text("확인"), button:has-text("닫기")');
        if (await closeBtn.count() > 0) {
            await closeBtn.first().click();
            await page.waitForTimeout(500);
        }
    } catch(e) {}
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/dashboard.png` });
    console.log("  -> dashboard.png 저장완료");

    // 3. 학생 관리 스크린샷
    console.log("3. 학생 관리 스크린샷...");
    await page.goto(`${BASE_URL}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/students.png` });
    console.log("  -> students.png 저장완료");

    // 4. 학생 프로필 (기록 있는 학생 - 박보검 id:9316)
    console.log("4. 학생 프로필 스크린샷 (박보검 - 제자리멀리뛰기)...");
    await page.goto(`${BASE_URL}/students/9316`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // 기록 추이 차트에서 제자리멀리뛰기 선택
    try {
        const chartSelect = page.locator('select').first();
        if (await chartSelect.count() > 0) {
            await chartSelect.selectOption({ label: '제자리멀리뛰기' });
            await page.waitForTimeout(1000);
        }
    } catch(e) {}
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/student-profile.png` });
    console.log("  -> student-profile.png 저장완료");

    // 날짜를 12일로 변경하는 헬퍼 함수
    async function changeToJan12(page) {
        const dateInput = page.locator('input[type="date"]');
        if (await dateInput.count() > 0) {
            await dateInput.fill('2026-01-12');
            await page.waitForTimeout(1500);
        }
    }

    // 5. 반 배치 스크린샷 - 1월 12일
    console.log("5. 반 배치 스크린샷...");
    await page.goto(`${BASE_URL}/assignments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await changeToJan12(page);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/assignments.png` });
    console.log("  -> assignments.png 저장완료");

    // 6. 기록 측정 스크린샷 - 1월 12일
    console.log("6. 기록 측정 스크린샷...");
    await page.goto(`${BASE_URL}/records`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await changeToJan12(page);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/records.png` });
    console.log("  -> records.png 저장완료");

    // 7. 수업 기록 스크린샷 - 1월 12일
    console.log("7. 수업 기록 스크린샷...");
    await page.goto(`${BASE_URL}/training`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await changeToJan12(page);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/training.png` });
    console.log("  -> training.png 저장완료");

    // 8. 수업 계획 스크린샷 - 1월 12일
    console.log("8. 수업 계획 스크린샷...");
    await page.goto(`${BASE_URL}/plans`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await changeToJan12(page);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/plans.png` });
    console.log("  -> plans.png 저장완료");

    await browser.close();
    console.log("\n완료! 랜딩페이지용 스크린샷이 저장되었습니다.");
})();
