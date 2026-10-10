import { test, expect } from '@playwright/test';
import { Api, API_URL, CREDS, exampleOrder, uid } from '../support/api';

// Pure API tests (no browser). They protect the contract in docs/04-api-spec.md.
test.describe('API envelope and security', () => {
  test('success envelope: {success, message, data}', async () => {
    const admin = await Api.as('admin');
    const r = await admin.get('/me');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, message: expect.any(String) });
    expect(r.body.data).toMatchObject({ email: CREDS.admin.email, role: expect.any(String), permissions: expect.any(Array) });
  });

  test('401 without a token uses the error envelope', async () => {
    const anon = await Api.anonymous();
    const res = await anon.get(`${API_URL}/orders`, { headers: { Accept: 'application/json' } });
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, code: 'UNAUTHENTICATED' });
  });

  test('wrong credentials → 401 INVALID_CREDENTIALS, no token', async () => {
    const anon = await Api.anonymous();
    const res = await anon.post(`${API_URL}/login`, { data: { email: CREDS.admin.email, password: 'nope-nope' }, headers: { Accept: 'application/json' } });
    expect(res.status()).toBe(401);
    const b = await res.json();
    expect(b).toMatchObject({ success: false, code: 'INVALID_CREDENTIALS' });
    expect(JSON.stringify(b)).not.toMatch(/token/i);
  });

  test('validation errors: 422, VALIDATION_ERROR, field keyed errors', async () => {
    const admin = await Api.as('admin');
    const r = await admin.post('/orders', {});
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
    expect(r.body.errors.customer_id[0]).toBe('Customer is required.');
    expect(r.body.errors.items[0]).toBe('Order must contain at least one product.');
  });

  test('item validation messages', async () => {
    const admin = await Api.as('admin');
    const customer = await admin.createCustomer();
    const zero = await admin.post('/orders', { customer_id: customer.id, order_date: '2026-10-09', priority: 'normal', status: 'draft', items: [{ product_id: 1, quantity: 0 }] });
    expect(zero.status).toBe(422);
    expect(zero.body.errors['items.0.quantity'][0]).toBe('Quantity must be greater than 0.');
    const ghost = await admin.post('/orders', { customer_id: customer.id, order_date: '2026-10-09', priority: 'normal', status: 'draft', items: [{ product_id: 99999999, quantity: 1 }] });
    expect(ghost.body.errors['items.0.product_id'][0]).toBe('Product must exist.');
    const noCustomer = await admin.post('/orders', { customer_id: 99999999, order_date: '2026-10-09', priority: 'normal', status: 'draft', items: [{ product_id: 1, quantity: 1 }] });
    expect(noCustomer.body.errors.customer_id[0]).toBe('Customer must exist.');
  });

  test('totals are calculated by the server, client values are ignored (2×100 + 3×50 − 20 + 10% tax = 363)', async () => {
    const admin = await Api.as('admin');
    const { order } = await exampleOrder(admin, { total: 1, subtotal: 1, tax_amount: 0, grand_total: 1 });
    const d = (await admin.get(`/orders/${order.id}`)).body.data;
    expect(Number(d.subtotal)).toBe(350);
    expect(Number(d.discount_amount)).toBe(20);
    expect(Number(d.tax_amount)).toBe(33);
    expect(Number(d.total)).toBe(363);
    const lineSum = d.items.reduce((n: number, i: any) => n + Math.round(Number(i.line_total) * 100), 0);
    expect(lineSum).toBe(36300); // allocation leaves no rounding gap
  });

  test('preview endpoint matches the stored total and persists nothing', async () => {
    const admin = await Api.as('admin');
    const a = await admin.createProduct({ price: 100 });
    const b = await admin.createProduct({ price: 50 });
    const before = (await admin.get('/orders?per_page=1')).body.meta.total;
    const p = await admin.post('/orders/preview', { discount_type: 'fixed', discount_value: 20, items: [{ product_id: a.id, quantity: 2 }, { product_id: b.id, quantity: 3 }] });
    expect(p.status).toBe(200);
    expect(Number(p.body.data.total)).toBe(363);
    expect((await admin.get('/orders?per_page=1')).body.meta.total).toBe(before);
  });

  test('item prices are snapshotted: changing the product price later does not alter the order', async () => {
    const admin = await Api.as('admin');
    const { order, a } = await exampleOrder(admin);
    await admin.put(`/products/${a.id}`, { name: a.name, sku: a.sku, price: 999, stock_quantity: 100, status: 'active' });
    const d = (await admin.get(`/orders/${order.id}`)).body.data;
    expect(Number(d.total)).toBe(363);
  });

  test('edit is only allowed for draft/pending and enforces optimistic locking', async () => {
    const admin = await Api.as('admin');
    const { order } = await exampleOrder(admin);
    const ok = await admin.put(`/orders/${order.id}`, { priority: 'high', version: order.version });
    expect(ok.status).toBe(200);
    const stale = await admin.put(`/orders/${order.id}`, { priority: 'low', version: order.version });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('CONFLICT');
    await admin.setStatus(order.id, 'confirmed');
    const fresh = (await admin.get(`/orders/${order.id}`)).body.data;
    const locked = await admin.put(`/orders/${order.id}`, { priority: 'low', version: fresh.version });
    expect(locked.status).toBe(422);
  });

  test('stock is reserved on confirm, never goes negative, and two orders cannot oversell', async () => {
    const admin = await Api.as('admin');
    const customer = await admin.createCustomer();
    const p = await admin.createProduct({ stock_quantity: 5 });
    const mk = () => admin.createOrder({ customer_id: customer.id, items: [{ product_id: p.id, quantity: 3 }] });
    const [o1, o2] = [await mk(), await mk()];
    expect((await admin.setStatus(o1.id, 'confirmed')).status).toBe(200);
    expect(await admin.stock(p.id)).toBe(2);
    const second = await admin.setStatus(o2.id, 'confirmed');
    expect(second.status).toBe(422);
    expect(second.body.code).toBe('INSUFFICIENT_STOCK');
    expect(await admin.stock(p.id)).toBe(2);
    expect((await admin.get(`/orders/${o2.id}`)).body.data.status).toBe('pending');
  });

  test('concurrent confirmations of the same order succeed exactly once', async () => {
    const admin = await Api.as('admin');
    const customer = await admin.createCustomer();
    const p = await admin.createProduct({ stock_quantity: 10 });
    const o = await admin.createOrder({ customer_id: customer.id, items: [{ product_id: p.id, quantity: 4 }] });
    const results = await Promise.all([admin.setStatus(o.id, 'confirmed'), admin.setStatus(o.id, 'confirmed'), admin.setStatus(o.id, 'confirmed')]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await admin.stock(p.id)).toBe(6); // decremented once
  });

  test('delete rules: admin only, draft/cancelled only', async () => {
    const admin = await Api.as('admin');
    const { order: pending } = await exampleOrder(admin);
    expect((await admin.del(`/orders/${pending.id}`)).status).toBe(422);
    const { order: draft } = await exampleOrder(admin, { status: 'draft' });
    expect((await admin.del(`/orders/${draft.id}`)).status).toBe(200);
    expect((await admin.get(`/orders/${draft.id}`)).status).toBe(404);
  });

  test('404 uses the envelope and leaks no internals', async () => {
    const admin = await Api.as('admin');
    const r = await admin.get('/orders/99999999');
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    expect(r.text).not.toMatch(/vendor\/|Illuminate\\|stack|trace|\.php/i);
  });

  test('sensitive fields are never serialised', async () => {
    const admin = await Api.as('admin');
    for (const path of ['/me', '/users', '/users/assignable', '/orders?per_page=5']) {
      const r = await admin.get(path);
      expect(r.status, path).toBe(200);
      expect(r.text, path).not.toMatch(/"password"|remember_token|"token_hash"/);
    }
  });

  test('audit log records order changes with old and new values and the actor', async () => {
    const admin = await Api.as('admin');
    const { order } = await exampleOrder(admin);
    await admin.put(`/orders/${order.id}`, { priority: 'urgent', version: order.version });
    const log = await admin.get(`/audit-logs?auditable_type=order&auditable_id=${order.id}&per_page=50`);
    expect(log.status).toBe(200);
    const upd = log.body.data.find((l: any) => l.action === 'order.updated');
    expect(upd).toBeTruthy();
    expect(upd.old_values.priority).toBe('normal');
    expect(upd.new_values.priority).toBe('urgent');
    expect(upd.user?.name ?? upd.user_name).toBeTruthy();
    expect(log.body.data.some((l: any) => l.action === 'order.created')).toBe(true);
  });

  test('audit log is read-only', async () => {
    const admin = await Api.as('admin');
    expect([404, 405]).toContain((await admin.del('/audit-logs/1')).status);
    expect([404, 405]).toContain((await admin.put('/audit-logs/1', {})).status);
  });

  test('listing returns slim rows with pagination meta', async () => {
    const admin = await Api.as('admin');
    const r = await admin.get('/orders?per_page=5&sort=total&direction=desc');
    expect(r.status).toBe(200);
    expect(r.body.meta).toMatchObject({ current_page: 1, per_page: 5, total: expect.any(Number), last_page: expect.any(Number) });
    expect(r.body.data.length).toBeLessThanOrEqual(5);
    expect(r.body.data[0]).toHaveProperty('order_number');
    expect(r.body.data[0]).not.toHaveProperty('activities'); // detail-only
    const totals = r.body.data.map((o: any) => Number(o.total));
    expect([...totals].sort((x, y) => y - x)).toEqual(totals);
  });

  test('user management is admin only and an admin cannot delete themselves', async () => {
    const admin = await Api.as('admin');
    const email = `qa-${uid()}@oms.test`;
    const created = await admin.post('/users', { name: 'QA User', email, password: 'password123', role: 'staff', is_active: true });
    expect(created.status).toBe(201);
    expect((await admin.del(`/users/${admin.session.user.id}`)).status).toBe(422);
    const dup = await admin.post('/users', { name: 'QA User', email, password: 'password123', role: 'staff' });
    expect(dup.status).toBe(422);
  });

  test('inactive users cannot log in', async () => {
    const admin = await Api.as('admin');
    const email = `inactive-${uid()}@oms.test`;
    const created = await admin.post('/users', { name: 'Inactive', email, password: 'password123', role: 'staff', is_active: false });
    expect(created.status).toBe(201);
    const anon = await Api.anonymous();
    const res = await anon.post(`${API_URL}/login`, { data: { email, password: 'password123' }, headers: { Accept: 'application/json' } });
    expect(res.status()).toBe(401);
  });

  test('logout revokes the token', async () => {
    const anon = await Api.anonymous();
    const login = await anon.post(`${API_URL}/login`, { data: { email: CREDS.manager2.email, password: CREDS.manager2.password }, headers: { Accept: 'application/json' } });
    const token = (await login.json()).data.token as string;
    const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    expect((await anon.get(`${API_URL}/me`, { headers: auth })).status()).toBe(200);
    expect((await anon.post(`${API_URL}/logout`, { headers: auth })).status()).toBe(200);
    expect((await anon.get(`${API_URL}/me`, { headers: auth })).status()).toBe(401);
  });
});
