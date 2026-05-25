import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, username: 'test', token: 'mock-token' }),
    });
  });

  // Mock initial schedule fetch
  await page.route('**/api/schedule', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          dayStartHour: 0,
          schedule: [
            {
              id: 'morning',
              label: 'الأسبوع الصباحي',
              icon: '☀️',
              offDays: [],
              offDayLabel: '',
              blocks: [],
            },
          ],
        }),
      });
    } else if (route.request().method() === 'POST') {
      // Mock successful mutation
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
      }),
    });
  });

  await page.route('**/api/tasks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        tasks: [],
      }),
    });
  });

  await page.route('**/api/daily', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        checked: {},
        subChecked: {},
        skipped: {},
      }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-for-e2e');
  });
});

test('dayStartHour is fetched and migrated to localStorage', async ({ page }) => {
  // Device B: User loads the page, dayStartHour should be fetched from server
  await page.goto('/');

  await page.waitForFunction(() => {
    const ls = window.localStorage.getItem('mhm_day_start_hour');
    return ls !== null;
  });

  const dayStartHour = await page.evaluate(() => {
    return Number(localStorage.getItem('mhm_day_start_hour'));
  });

  expect(dayStartHour).toBe(0);
});

test('dayStartHour > 0 in localStorage overrides server 0 and triggers mutation', async ({
  page,
}) => {
  const postPayloads: Array<Record<string, unknown>> = [];

  page.on('request', (request) => {
    if (request.url().includes('/api/schedule') && request.method() === 'POST') {
      postPayloads.push(request.postDataJSON());
    }
  });

  await page.goto('/');

  // Wait for the app to finish its initial load and data fetching
  await expect(page.locator('text=الصلوات الخمس').first()).toBeVisible();

  await page.evaluate(() => {
    // Mimic an old user who has dayStartHour set locally
    localStorage.setItem('mhm_day_start_hour', '4');
  });

  await page.reload();

  // Wait for the mutation to be triggered
  await expect
    .poll(
      async () => {
        return postPayloads;
      },
      { timeout: 10000 }
    )
    .toContainEqual(expect.objectContaining({ dayStartHour: 4 }));
});
