import { test, expect, count, money } from '../support/fixtures';
import { Api, exampleOrder } from '../support/api';

// Runs in the "consistency" project AFTER all other specs, so global counts are stable.
test.describe('dashboard uses real data', () => {
  test('stat cards equal the API summary', async ({ page, loginAs }) => {
    const admin = await Api.as('admin');
    const s = (await admin.get('/dashboard/summary')).body.data;
    await loginAs('admin');
    await page.goto('/dashboard');
    await expect(page.getByTestId('stat-total-orders')).toContainText(count(s.total_orders));
    await expect(page.getByTestId('stat-pending')).toContainText(count(s.pending_orders));
    await expect(page.getByTestId('stat-confirmed')).toContainText(count(s.confirmed_orders));
    await expect(page.getByTestId('stat-processing')).toContainText(count(s.processing_orders));
    await expect(page.getByTestId('stat-completed')).toContainText(count(s.completed_orders));
    await expect(page.getByTestId('stat-cancelled')).toContainText(count(s.cancelled_orders));
    await expect(page.getByTestId('stat-customers')).toContainText(count(s.total_customers));
    await expect(page.getByTestId('stat-products')).toContainText(count(s.total_products));
    await expect(page.getByTestId('stat-revenue')).toContainText(money(Number(s.total_revenue)));
    await expect(page.getByTestId('stat-avg')).toContainText(money(Number(s.average_order_value)));
    await expect(page.getByTestId('chart-status')).toBeVisible();
    await expect(page.getByTestId('chart-revenue')).toBeVisible();
  });

  test('numbers are not hardcoded: mocked API values appear on screen', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.route('**/api/dashboard/summary**', (r) =>
      r.fulfill({
        json: {
          success: true, message: 'OK',
          data: { total_orders: 12345, pending_orders: 111, confirmed_orders: 222, processing_orders: 333, completed_orders: 444, cancelled_orders: 55, total_revenue: 987654.32, average_order_value: 321.09, total_customers: 777, total_products: 88 },
        },
      }),
    );
    await page.goto('/dashboard');
    await expect(page.getByTestId('stat-total-orders')).toContainText('12,345');
    await expect(page.getByTestId('stat-customers')).toContainText('777');
    await expect(page.getByTestId('stat-revenue')).toContainText('$987,654.32');
  });

  test('a new order is reflected after reload', async ({ page, loginAs }) => {
    const admin = await Api.as('admin');
    const before = (await admin.get('/dashboard/summary')).body.data.total_orders as number;
    await exampleOrder(admin);
    await loginAs('admin');
    await page.goto('/dashboard');
    await expect(page.getByTestId('stat-total-orders')).toContainText(count(before + 1));
  });

  test('revenue trend can be switched between day, week and month', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto('/dashboard');
    for (const period of ['week', 'month', 'day'] as const) {
      const req = page.waitForRequest((r) => r.url().includes('/dashboard/revenue-trend') && r.url().includes(`period=${period}`));
      await page.getByTestId(`revenue-period-${period}`).click();
      await req;
      await expect(page.getByTestId('chart-revenue')).toBeVisible();
    }
  });

  test('API aggregates match: status distribution sums to total orders', async () => {
    const admin = await Api.as('admin');
    const summary = (await admin.get('/dashboard/summary')).body.data;
    const dist = (await admin.get('/dashboard/status-distribution')).body.data as { status: string; count: number }[];
    const sum = dist.reduce((n, d) => n + Number(d.count), 0);
    expect(sum).toBe(Number(summary.total_orders));
    const trend = (await admin.get('/dashboard/revenue-trend?period=day')).body.data as { label: string; revenue: number }[];
    expect(Array.isArray(trend)).toBe(true);
    trend.forEach((p) => { expect(typeof p.label).toBe('string'); expect(Number(p.revenue)).toBeGreaterThanOrEqual(0); });
  });
});
