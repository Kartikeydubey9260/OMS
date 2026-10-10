import { request, APIRequestContext } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8001/api';

export type Role = 'admin' | 'manager' | 'manager2' | 'staff' | 'staff2';

export const CREDS: Record<Role, { email: string; password: string; name: string }> = {
  admin: { email: 'admin@oms.test', password: 'password', name: 'Admin User' },
  manager: { email: 'manager@oms.test', password: 'password', name: 'Manager User' },
  manager2: { email: 'manager2@oms.test', password: 'password', name: 'Second Manager' },
  staff: { email: 'staff@oms.test', password: 'password', name: 'Staff User' },
  staff2: { email: 'staff2@oms.test', password: 'password', name: 'Second Staff' },
};

export const uid = () => Math.random().toString(36).slice(2, 8);

export interface Session { token: string; user: { id: number; name: string; email: string; role: string; permissions: string[] } }
const sessions = new Map<Role, Session>();

async function raw(token?: string): Promise<APIRequestContext> {
  return request.newContext({
    extraHTTPHeaders: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

/** Logs in through the API once per worker and caches the session. */
export async function apiLogin(role: Role): Promise<Session> {
  const cached = sessions.get(role);
  if (cached) return cached;
  const ctx = await raw();
  const res = await ctx.post(`${API_URL}/login`, { data: { email: CREDS[role].email, password: CREDS[role].password } });
  if (!res.ok()) throw new Error(`login failed for ${role}: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  await ctx.dispose();
  const s: Session = { token: body.data.token, user: body.data.user };
  sessions.set(role, s);
  return s;
}

/** Thin authenticated client. Every call asserts nothing; specs assert on the returned status/body. */
export class Api {
  private constructor(private ctx: APIRequestContext, public session: Session) {}
  static async as(role: Role) {
    const session = await apiLogin(role);
    return new Api(await raw(session.token), session);
  }
  static async anonymous() { return await raw(); }

  private async call(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, data?: unknown) {
    const res = await this.ctx[method](`${API_URL}${path}`, data === undefined ? undefined : { data });
    let body: any = null;
    try { body = await res.json(); } catch { /* non-json */ }
    return { status: res.status(), ok: res.ok(), body, text: body ? JSON.stringify(body) : '' };
  }
  get = (p: string) => this.call('get', p);
  post = (p: string, d?: unknown) => this.call('post', p, d ?? {});
  put = (p: string, d?: unknown) => this.call('put', p, d ?? {});
  patch = (p: string, d?: unknown) => this.call('patch', p, d ?? {});
  del = (p: string) => this.call('delete', p);

  async createCustomer(over: Record<string, unknown> = {}) {
    const id = uid();
    const r = await this.post('/customers', { name: `E2E Customer ${id}`, email: `e2e-${id}@example.test`, phone: '+91 98765 43210', city: 'Noida', country: 'India', ...over });
    if (!r.ok) throw new Error(`createCustomer failed: ${r.status} ${r.text}`);
    return r.body.data as { id: number; name: string; email: string };
  }
  async createProduct(over: Record<string, unknown> = {}) {
    const id = uid().toUpperCase();
    const r = await this.post('/products', { name: `E2E Product ${id}`, sku: `E2E-${id}`, price: 100, stock_quantity: 100, status: 'active', ...over });
    if (!r.ok) throw new Error(`createProduct failed: ${r.status} ${r.text}`);
    return r.body.data as { id: number; name: string; sku: string; price: string | number; stock_quantity: number };
  }
  async createOrder(over: Record<string, unknown> & { items: { product_id: number; quantity: number }[]; customer_id: number }) {
    const r = await this.post('/orders', { order_date: new Date().toISOString().slice(0, 10), priority: 'normal', status: 'pending', ...over });
    if (!r.ok) throw new Error(`createOrder failed: ${r.status} ${r.text}`);
    return r.body.data as { id: number; order_number: string; total: string | number; version: number; status: string };
  }
  async setStatus(orderId: number, status: string, remarks?: string) {
    return this.post(`/orders/${orderId}/status`, { status, remarks });
  }
  async stock(productId: number): Promise<number> {
    const r = await this.get(`/products/${productId}`);
    return Number(r.body.data.stock_quantity);
  }
}

/** Convenience: customer + two products (100 and 50) + a pending order with the assessment example (2×100, 3×50, −20, 10% tax = 363). */
export async function exampleOrder(api: Api, over: Record<string, unknown> = {}) {
  const customer = await api.createCustomer();
  const a = await api.createProduct({ price: 100 });
  const b = await api.createProduct({ price: 50 });
  const order = await api.createOrder({
    customer_id: customer.id,
    discount_type: 'fixed',
    discount_value: 20,
    items: [{ product_id: a.id, quantity: 2 }, { product_id: b.id, quantity: 3 }],
    ...over,
  });
  return { customer, a, b, order };
}
