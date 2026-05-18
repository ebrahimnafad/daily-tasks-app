import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => console.log(`BROWSER_CONSOLE_${msg.type()}:`, msg.text()));
  page.on('pageerror', (err) => console.error('BROWSER_PAGEERROR:', err));

  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(5000);

  await browser.close();
})();
