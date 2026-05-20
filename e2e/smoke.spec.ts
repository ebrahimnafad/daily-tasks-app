import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', (err) => console.error('BROWSER ERROR:', err));

  // Mock API requests to prevent failures when DB / auth is not configured in test env
  await page.route(/\/api\//, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/src/')) {
      await route.fallback();
      return;
    }

    // Auth: always return authenticated
    if (url.includes('/api/auth')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, username: 'test', token: 'mock-token' }),
      });
      return;
    }

    if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    } else if (method === 'GET') {
      // Return empty mock data for other resources
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
          finance_income: [],
          finance_obligations: [],
          finance_payments: [],
          finance_goals: [],
          finance_categories: [],
        }),
      });
    } else {
      await route.fallback();
    }
  });

  // Inject a fake auth token so the app considers the user authenticated
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-for-e2e');
  });
});

test.describe('Smoke Tests', () => {
  test('app loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/مهام اليوم/);
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=المالية')).toBeVisible();
    await page.click('text=المالية');
    await expect(page.locator('text=المالية')).toBeVisible();
  });
});

test.describe('Task Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('open add task modal', async ({ page }) => {
    await page.click('button >> text=إضافة مهمة');
    await expect(page.getByRole('heading', { name: '➕ مهمة جديدة' })).toBeVisible();
  });

  test('fill and save task', async ({ page }) => {
    await page.click('button >> text=إضافة مهمة');
    const titleInput = page.locator('input[placeholder*="اكتب المهمة"]').first();
    await titleInput.fill('E2E Test Task');
    await page.click('button:has-text("إضافة المهمة")');
    await expect(page.locator('text=E2E Test Task')).toBeVisible();
  });
});

test.describe('Finance Section', () => {
  test('finance page loads', async ({ page }) => {
    await page.goto('/');
    await page.click('text=المالية');
    await expect(page.locator('text=المالية')).toBeVisible();
  });
});

test.describe('Calendar Section', () => {
  test('calendar page loads', async ({ page }) => {
    await page.goto('/');
    await page.click('text=التقويم');
    await expect(page.locator('text=التقويم')).toBeVisible();
  });
});
