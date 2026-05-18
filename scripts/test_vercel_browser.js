import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => console.log(`BROWSER_CONSOLE_${msg.type()}:`, msg.text()));
  page.on('pageerror', (err) => console.error('BROWSER_PAGEERROR:', err));

  await page.goto('https://daily-tasks-app-neon.vercel.app/');
  await page.waitForTimeout(10000); // wait longer to allow for network/rendering

  await browser.close();
})();
