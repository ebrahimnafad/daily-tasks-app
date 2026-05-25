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
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/tasks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        tasks: [{ id: 'task1', text: 'Test Task', isPrayerTask: false, subtasks: [] }],
      }),
    });
  });

  await page.route('**/api/daily', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        checked: { task1: true },
        subChecked: {},
        skipped: {},
      }),
    });
  });

  await page.route('**/api/schedule', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        schedule: [],
        dayStartHour: 0,
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

test('SyncManager posts snapshot when mhm_midnight event fires', async ({ page }) => {
  await page.goto('/');

  // Wait for app to fully load (SyncManager must be mounted before we dispatch)
  await expect(page.locator('text=الصلوات الخمس').first()).toBeVisible();

  const requestPromise = page.waitForRequest(
    (request) => request.url().includes('/api/snapshots') && request.method() === 'POST',
    { timeout: 10000 }
  );

  // Directly dispatch the event that SyncManager listens to — this is exactly what
  // useMidnightReset does internally, so we test SyncManager → snapshotImpl → saveSnapshot.
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('mhm_midnight', {
        detail: {
          date: '2020-01-01',
          checked: { task1: true },
          subChecked: {},
        },
      })
    );
  });

  const req = await requestPromise;
  const postData = req.postDataJSON() as {
    date: string;
    snapshot: { checked: Record<string, boolean> };
  };
  expect(postData.date).toBe('2020-01-01');
  expect(postData.snapshot).toBeDefined();
  expect(postData.snapshot.checked).toMatchObject({ task1: true });
});
