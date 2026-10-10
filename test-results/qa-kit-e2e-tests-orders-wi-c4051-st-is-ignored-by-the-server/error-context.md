# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: qa-kit\e2e\tests\orders-wizard.spec.ts >> create order wizard >> a tampered total in the request is ignored by the server
- Location: qa-kit\e2e\tests\orders-wizard.spec.ts:117:5

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED 127.0.0.1:8001
Call log:
  - → POST http://127.0.0.1:8001/api/login
    - user-agent: Playwright/1.64.0 (x64; windows 10.0) node/22.5
    - accept: application/json
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 48

```

# Test source

```ts
  1   | import { request, APIRequestContext } from "@playwright/test";
  2   | 
  3   | export const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:8001/api";
  4   | 
  5   | export type Role = "admin" | "manager" | "manager2" | "staff" | "staff2";
  6   | 
  7   | export const CREDS: Record<
  8   |     Role,
  9   |     { email: string; password: string; name: string }
  10  | > = {
  11  |     admin: {
  12  |         email: "admin@oms.test",
  13  |         password: "password",
  14  |         name: "Admin User",
  15  |     },
  16  |     manager: {
  17  |         email: "manager@oms.test",
  18  |         password: "password",
  19  |         name: "Manager User",
  20  |     },
  21  |     manager2: {
  22  |         email: "manager2@oms.test",
  23  |         password: "password",
  24  |         name: "Second Manager",
  25  |     },
  26  |     staff: {
  27  |         email: "staff@oms.test",
  28  |         password: "password",
  29  |         name: "Staff User",
  30  |     },
  31  |     staff2: {
  32  |         email: "staff2@oms.test",
  33  |         password: "password",
  34  |         name: "Second Staff",
  35  |     },
  36  | };
  37  | 
  38  | export const uid = () => Math.random().toString(36).slice(2, 8);
  39  | 
  40  | export interface Session {
  41  |     token: string;
  42  |     user: {
  43  |         id: number;
  44  |         name: string;
  45  |         email: string;
  46  |         role: string;
  47  |         permissions: string[];
  48  |     };
  49  | }
  50  | const sessions = new Map<Role, Session>();
  51  | 
  52  | async function raw(token?: string): Promise<APIRequestContext> {
  53  |     return request.newContext({
  54  |         extraHTTPHeaders: {
  55  |             Accept: "application/json",
  56  |             ...(token ? { Authorization: `Bearer ${token}` } : {}),
  57  |         },
  58  |     });
  59  | }
  60  | 
  61  | /** Logs in through the API once per worker and caches the session. */
  62  | export async function apiLogin(role: Role): Promise<Session> {
  63  |     const cached = sessions.get(role);
  64  |     if (cached) return cached;
  65  |     const ctx = await raw();
> 66  |     const res = await ctx.post(`${API_URL}/login`, {
      |                           ^ Error: apiRequestContext.post: connect ECONNREFUSED 127.0.0.1:8001
  67  |         data: { email: CREDS[role].email, password: CREDS[role].password },
  68  |     });
  69  |     if (!res.ok())
  70  |         throw new Error(
  71  |             `login failed for ${role}: ${res.status()} ${await res.text()}`,
  72  |         );
  73  |     const body = await res.json();
  74  |     await ctx.dispose();
  75  |     const s: Session = { token: body.data.token, user: body.data.user };
  76  |     sessions.set(role, s);
  77  |     return s;
  78  | }
  79  | 
  80  | /** Thin authenticated client. Every call asserts nothing; specs assert on the returned status/body. */
  81  | export class Api {
  82  |     private constructor(
  83  |         private ctx: APIRequestContext,
  84  |         public session: Session,
  85  |     ) {}
  86  |     static async as(role: Role) {
  87  |         const session = await apiLogin(role);
  88  |         return new Api(await raw(session.token), session);
  89  |     }
  90  |     static async anonymous() {
  91  |         return await raw();
  92  |     }
  93  | 
  94  |     private async call(
  95  |         method: "get" | "post" | "put" | "patch" | "delete",
  96  |         path: string,
  97  |         data?: unknown,
  98  |     ) {
  99  |         const res = await this.ctx[method](
  100 |             `${API_URL}${path}`,
  101 |             data === undefined ? undefined : { data },
  102 |         );
  103 |         let body: any = null;
  104 |         try {
  105 |             body = await res.json();
  106 |         } catch {
  107 |             /* non-json */
  108 |         }
  109 |         return {
  110 |             status: res.status(),
  111 |             ok: res.ok(),
  112 |             body,
  113 |             text: body ? JSON.stringify(body) : "",
  114 |         };
  115 |     }
  116 |     get = (p: string) => this.call("get", p);
  117 |     post = (p: string, d?: unknown) => this.call("post", p, d ?? {});
  118 |     put = (p: string, d?: unknown) => this.call("put", p, d ?? {});
  119 |     patch = (p: string, d?: unknown) => this.call("patch", p, d ?? {});
  120 |     del = (p: string) => this.call("delete", p);
  121 | 
  122 |     async createCustomer(over: Record<string, unknown> = {}) {
  123 |         const id = uid();
  124 |         const r = await this.post("/customers", {
  125 |             name: `E2E Customer ${id}`,
  126 |             email: `e2e-${id}@example.test`,
  127 |             phone: "+91 98765 43210",
  128 |             city: "Noida",
  129 |             country: "India",
  130 |             ...over,
  131 |         });
  132 |         if (!r.ok)
  133 |             throw new Error(`createCustomer failed: ${r.status} ${r.text}`);
  134 |         return r.body.data as { id: number; name: string; email: string };
  135 |     }
  136 |     async createProduct(over: Record<string, unknown> = {}) {
  137 |         const id = uid().toUpperCase();
  138 |         const r = await this.post("/products", {
  139 |             name: `E2E Product ${id}`,
  140 |             sku: `E2E-${id}`,
  141 |             price: 100,
  142 |             stock_quantity: 100,
  143 |             status: "active",
  144 |             ...over,
  145 |         });
  146 |         if (!r.ok)
  147 |             throw new Error(`createProduct failed: ${r.status} ${r.text}`);
  148 |         return r.body.data as {
  149 |             id: number;
  150 |             name: string;
  151 |             sku: string;
  152 |             price: string | number;
  153 |             stock_quantity: number;
  154 |         };
  155 |     }
  156 |     async createOrder(
  157 |         over: Record<string, unknown> & {
  158 |             items: { product_id: number; quantity: number }[];
  159 |             customer_id: number;
  160 |         },
  161 |     ) {
  162 |         const r = await this.post("/orders", {
  163 |             order_date: new Date().toISOString().slice(0, 10),
  164 |             priority: "normal",
  165 |             status: "pending",
  166 |             ...over,
```