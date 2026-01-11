import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'owner@test.com');
    await page.fill('input[type="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.goto('http://localhost:3001/assignments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 캘린더 아이콘 클릭
    const calIcon = page.locator('svg.lucide-calendar').first();
    if (await calIcon.count() > 0) {
        await calIcon.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/datepicker_open.png' });
        console.log('캘린더 아이콘 클릭 후 스크린샷 저장');
    } else {
        // input[type=date] 시도
        const dateInput = page.locator('input[type="date"]').first();
        if (await dateInput.count() > 0) {
            console.log('date input 발견');
            await dateInput.fill('2026-01-12');
            await page.waitForTimeout(1500);
            await page.screenshot({ path: '/tmp/datepicker_filled.png' });
        } else {
            console.log('날짜 입력 요소 없음');
            await page.screenshot({ path: '/tmp/datepicker_none.png' });
        }
    }

    await browser.close();
})();
