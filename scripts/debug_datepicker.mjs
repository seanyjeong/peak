import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 로그인
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'owner@test.com');
    await page.fill('input[type="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 반배치 페이지
    await page.goto('http://localhost:3001/assignments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 모든 input 필드 확인
    const inputs = await page.locator('input').all();
    console.log('input 필드 개수:', inputs.length);
    for (let i = 0; i < inputs.length; i++) {
        const type = await inputs[i].getAttribute('type');
        const value = await inputs[i].inputValue();
        const placeholder = await inputs[i].getAttribute('placeholder');
        console.log(`input[${i}]: type=${type}, value="${value}", placeholder="${placeholder}"`);
    }

    // 날짜 영역 div 클릭 시도 (좌표로)
    console.log('\n날짜 영역 좌표 클릭 시도...');
    // 오른쪽 상단 날짜 영역 (대략 x: 1100, y: 60)
    await page.mouse.click(1100, 60);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/coord_click.png' });
    console.log('좌표 클릭 후 스크린샷 저장');

    await browser.close();
})();
