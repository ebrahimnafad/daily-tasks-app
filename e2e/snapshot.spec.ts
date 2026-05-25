import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', (err) => console.error('BROWSER ERROR:', err));

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, username: 'test', token: 'mock-token' }),
    });
  });

  await page.route('**/api/snapshots', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    } else {
      await route.fallback();
    }
  });

  await page.route('**/api/sync', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        tasks: [{ id: 'task1', text: 'Test Task', isPrayerTask: false, subtasks: [] }],
        checked: { task1: true },
        subChecked: {},
        skipped: {},
        schedule: [],
      }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-for-e2e');
    // Set a stored date from yesterday to force the midnight tick
    localStorage.setItem('mhm_date', '"2020-01-01"');
    // Fake some checked state so snapshot actually runs
    localStorage.setItem('mhm_checked', JSON.stringify({ task1: true }));
  });
});

test('auto snapshot triggers on date mismatch', async ({ page }) => {
  // We want to wait for the POST request to /api/snapshots
  const requestPromise = page.waitForRequest(
    (request) => request.url().includes('/api/snapshots') && request.method() === 'POST'
  );

  await page.goto('/');

  // Wait for the snapshot POST request (happens on the first tick)
  const req = await requestPromise;

  const postData = req.postDataJSON();
  expect(postData.date).toBe('2020-01-01');
  expect(postData.snapshot).toBeDefined();
  expect(postData.snapshot.checked).toEqual({ task1: true });

  console.log('Snapshot successfully captured!');
});
