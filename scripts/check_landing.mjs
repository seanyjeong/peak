import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // 랜딩페이지 열기
    await page.goto('file:///home/sean/ilsanmaxtraining/landing/index.html');
    await page.waitForTimeout(1000);

    // Hero 섹션 스크린샷
    await page.screenshot({ path: '/tmp/landing_preview.png' });
    console.log("Hero 섹션 스크린샷 저장: /tmp/landing_preview.png");

    // 스크린샷 섹션으로 스크롤
    await page.evaluate(() => document.querySelector('.screenshots').scrollIntoView());
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/landing_bento.png' });
    console.log("Bento Grid 스크린샷 저장: /tmp/landing_bento.png");

    await browser.close();
})();
