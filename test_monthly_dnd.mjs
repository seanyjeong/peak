import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
    // 1. 로그인
    console.log("1. 로그인 페이지 접속...");
    await page.goto('http://localhost:8330/login');
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: '/tmp/01_login.png', fullPage: true });

    // 2. 로그인 실행
    console.log("2. 로그인 중...");
    await page.fill('input[type="email"]', 'admin@ilsanmax.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/02_after_login.png', fullPage: true });
    console.log(`   현재 URL: ${page.url()}`);

    // 3. 월말테스트로 이동
    console.log("3. 월말테스트로 이동...");
    await page.goto('http://localhost:8330/monthly-test');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: '/tmp/03_monthly_test.png', fullPage: true });

    // 테스트 목록에서 첫 번째 테스트 클릭
    const testLinks = await page.locator('a[href*="/monthly-test/"]').all();
    console.log(`   테스트 링크: ${testLinks.length}개`);

    if (testLinks.length > 0) {
        await testLinks[0].click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await page.screenshot({ path: '/tmp/04_test_detail.png', fullPage: true });
        console.log(`   현재 URL: ${page.url()}`);

        // 세션 찾기 (조편성 버튼 또는 세션 링크)
        console.log("4. 세션/조편성 찾기...");

        // URL에서 testId 추출
        const url = page.url();
        const testIdMatch = url.match(/monthly-test\/(\d+)/);
        if (testIdMatch) {
            const testId = testIdMatch[1];
            // 세션 링크 찾기
            const sessionLinks = await page.locator(`a[href*="/monthly-test/${testId}/"]`).all();
            console.log(`   세션 링크: ${sessionLinks.length}개`);

            if (sessionLinks.length > 0) {
                await sessionLinks[0].click();
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(1000);
            }
        }

        await page.screenshot({ path: '/tmp/05_session.png', fullPage: true });
        console.log(`   현재 URL: ${page.url()}`);

        // 5. 조편성 페이지 분석
        console.log("5. 페이지 구조 분석...");

        // 드래그 가능한 학생 카드 찾기
        const participantCards = await page.locator('[data-type="participant"]').all();
        console.log(`   학생 카드 (participant): ${participantCards.length}개`);

        const supervisorCards = await page.locator('[data-type="supervisor"]').all();
        console.log(`   감독관 카드 (supervisor): ${supervisorCards.length}개`);

        // 이수민, 조윤태 찾기
        const sumin = await page.locator('text=이수민').all();
        console.log(`   이수민: ${sumin.length}개`);

        const yuntae = await page.locator('text=조윤태').all();
        console.log(`   조윤태: ${yuntae.length}개`);

        // 그룹들 확인
        const groups = await page.locator('[id^="group-"]').all();
        console.log(`   그룹: ${groups.length}개`);

        // UnassignZone 확인
        const unassignText = await page.locator('text=미배치로').all();
        console.log(`   '미배치로' 텍스트: ${unassignText.length}개`);

        // 6. 드래그 테스트
        console.log("6. 드래그 테스트...");

        if (participantCards.length > 0) {
            const card = participantCards[0];
            const cardText = await card.textContent();
            console.log(`   첫 번째 카드: "${cardText}"`);

            const box = await card.boundingBox();
            if (box) {
                console.log(`   카드 위치: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`);

                // 마우스 이동 후 드래그 시작
                const startX = box.x + box.width / 2;
                const startY = box.y + box.height / 2;

                await page.mouse.move(startX, startY);
                await page.mouse.down();
                await page.waitForTimeout(500);

                // 드래그 중 스크린샷
                await page.screenshot({ path: '/tmp/06_dragging.png', fullPage: true });
                console.log("   드래그 중 스크린샷 저장");

                // UnassignZone 나타났는지 확인
                const unassignZone = await page.locator('text=학생 미배치로').all();
                console.log(`   드래그 중 '학생 미배치로': ${unassignZone.length}개`);

                // 왼쪽으로 드래그
                await page.mouse.move(200, startY, { steps: 10 });
                await page.waitForTimeout(300);

                await page.screenshot({ path: '/tmp/07_drag_left.png', fullPage: true });

                // 드롭
                await page.mouse.up();
                await page.waitForTimeout(500);

                await page.screenshot({ path: '/tmp/08_after_drop.png', fullPage: true });
                console.log("   드롭 후 스크린샷 저장");

                // 결과 확인
                const afterParticipants = await page.locator('[data-type="participant"]').all();
                console.log(`   드롭 후 학생 카드: ${afterParticipants.length}개`);
            }
        }

        // 7. HTML 구조 출력
        console.log("7. 관련 HTML 구조 확인...");
        const content = await page.content();

        // unassign 관련 확인
        if (content.includes('unassign-participant')) {
            console.log("   ✓ unassign-participant ID 존재");
        } else {
            console.log("   ✗ unassign-participant ID 없음");
        }

        if (content.includes('UnassignZone')) {
            console.log("   ✓ UnassignZone 컴포넌트 존재");
        }

        // waiting 영역 확인
        if (content.includes('waiting-participants')) {
            console.log("   ✓ waiting-participants ID 존재");
        }

        // 드래그 상태 확인
        if (content.includes('isDragging')) {
            console.log("   ✓ isDragging 관련 코드 존재");
        }
    }

    console.log("\n✅ 테스트 완료! 스크린샷 확인:");
    console.log("  /tmp/01_login.png ~ /tmp/08_after_drop.png");

} catch (error) {
    console.error("Error:", error.message);
    await page.screenshot({ path: '/tmp/error.png', fullPage: true });
} finally {
    await browser.close();
}
