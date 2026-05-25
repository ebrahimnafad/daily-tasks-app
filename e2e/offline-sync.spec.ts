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

  await page.route('**/api/schedule', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          schedule: [
            {
              id: 'evening',
              label: 'الأسبوع المسائي',
              icon: '🌙',
              offDays: [],
              offDayLabel: '',
              blocks: [],
              weekStartHour: 0,
            },
            {
              id: 'morning',
              label: 'الأسبوع الصباحي',
              icon: '☀️',
              offDays: [4, 6],
              offDayLabel: 'إجازة',
              blocks: [],
              weekStartHour: 0,
            },
          ],
        }),
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
        tasks: [],
        checked: {},
        subChecked: {},
        skipped: {},
        schedule: [],
      }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-for-e2e');
    // Set a known shift epoch so computeShift is predictable
    localStorage.setItem('mhm_epoch', '"2020-01-03"'); // A Friday
  });
});

test('offline schedule change and midnight reset', async ({ page, context }) => {
  // 1. Install fake timers before navigating
  await page.clock.install({ time: new Date('2020-01-01T12:00:00Z') });
  await page.goto('/');

  // Wait for the initial schedule to load
  await page.waitForFunction(() => {
    const data = window.localStorage.getItem('mhm_schedule');
    return data && JSON.parse(data).length > 0;
  });

  // 2. Go offline
  await context.setOffline(true);
  console.log('Went offline');

  // 3. Change the schedule in cache (mimicking user interaction)
  await page.evaluate(() => {
    const newSchedule = [
      {
        id: 'evening',
        label: 'الأسبوع المسائي المعدل',
        icon: '🌙',
        offDays: [],
        offDayLabel: '',
        blocks: [],
        weekStartHour: 10,
      },
    ];
    localStorage.setItem('mhm_schedule', JSON.stringify(newSchedule));
    // Set stored date to yesterday so tick() triggers reset
    localStorage.setItem('mhm_date', '"2019-12-31"');
  });

  // 4. Fast forward time by 61 seconds to trigger setInterval(tick, 60_000)
  await page.clock.fastForward(61000);

  // 5. Verify it used the correct schedule during the offline tick
  const scheduleSaved = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('mhm_schedule') || '[]');
  });

  expect(scheduleSaved[0].weekStartHour).toBe(10);

  await context.setOffline(false);
  console.log('Went online');
});
