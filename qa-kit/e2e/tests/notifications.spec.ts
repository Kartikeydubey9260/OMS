import { test, expect } from '../support/fixtures';
import { Api, exampleOrder } from '../support/api';

// Uses "staff2" exclusively so other specs (which assign to "staff") cannot change the unread count.
test.describe('notifications', () => {
  test('assignee is notified, can open it and mark everything read', async ({ page, loginAs }) => {
    const admin = await Api.as('admin');
    const staff2 = await Api.as('staff2');
    const mine = await staff2.post('/notifications/read-all'); // start clean
    expect(mine.status).toBe(200);

    const { order: o1 } = await exampleOrder(admin, { assigned_to: staff2.session.user.id });
    const { order: o2 } = await exampleOrder(admin, { assigned_to: staff2.session.user.id });

    await loginAs('staff2');
    await page.goto('/orders');
    await expect(page.getByTestId('notification-badge')).toHaveText('2');

    await page.getByTestId('notification-bell').click();
    await expect(page.getByTestId('notification-item')).toHaveCount(2);
    await expect(page.getByTestId('notification-item').first()).toContainText(/assigned/i);

    await page.getByTestId('notification-item').filter({ hasText: o1.order_number }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${o1.id}$`));
    await expect(page.getByTestId('notification-badge')).toHaveText('1');

    await page.getByTestId('notification-bell').click();
    await page.getByTestId('notification-mark-all').click();
    await expect(page.getByTestId('notification-badge')).toHaveCount(0);
    expect(o2.id).toBeGreaterThan(0);
  });

  test('the person who performs an action is not notified about it', async () => {
    const admin = await Api.as('admin');
    await admin.post('/notifications/read-all');
    const before = (await admin.get('/notifications/unread-count')).body.data.count ?? (await admin.get('/notifications/unread-count')).body.data;
    await exampleOrder(admin, { assigned_to: admin.session.user.id });
    const afterRes = await admin.get('/notifications/unread-count');
    const after = afterRes.body.data.count ?? afterRes.body.data;
    expect(Number(after)).toBe(Number(before)); // self-assignment does not notify the actor
  });

  test('users cannot read or mark other users’ notifications', async () => {
    const admin = await Api.as('admin');
    const staff2 = await Api.as('staff2');
    await exampleOrder(admin, { assigned_to: staff2.session.user.id });
    const list = await staff2.get('/notifications?unread=1');
    const id = list.body.data[0].id as string;
    const intruder = await Api.as('manager2');
    const r = await intruder.post(`/notifications/${id}/read`);
    expect([403, 404]).toContain(r.status);
    const stillUnread = await staff2.get('/notifications?unread=1');
    expect(stillUnread.body.data.map((n: any) => n.id)).toContain(id);
  });
});
