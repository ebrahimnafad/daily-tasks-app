import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Mock API requests to prevent optimistic update rollbacks when DB is not configured
  await page.route('**/api/db**', async (route) => {
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
    await expect(page.locator('text=إضافة مهمة')).toBeVisible();
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
