# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: orders-list.spec.ts >> order listing >> sorts by total ascending and descending
- Location: qa-kit\e2e\tests\orders-list.spec.ts:82:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('order-row')
Expected: 3
Received: 0
Timeout:  7000ms

Call log:
  - Expect "toHaveCount" getByTestId('order-row') with timeout 7000ms
  - waiting for getByTestId('order-row')
    17 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e6]:
      - link "OMS Enterprise" [ref=e8] [cursor=pointer]:
        - /url: /dashboard
        - generic [ref=e9]: OMS
        - generic [ref=e10]: Enterprise
      - navigation [ref=e11]:
        - link "Dashboard" [ref=e12] [cursor=pointer]:
          - /url: /dashboard
        - link "Orders" [ref=e13] [cursor=pointer]:
          - /url: /orders
        - link "Customers" [ref=e14] [cursor=pointer]:
          - /url: /customers
        - link "Products" [ref=e15] [cursor=pointer]:
          - /url: /products
      - generic [ref=e16]:
        - button "Notifications" [ref=e18]
        - button "M Manager User" [ref=e22]:
          - generic [ref=e23]: M
          - generic [ref=e24]: Manager User
  - main [ref=e27]:
    - generic [ref=e28]:
      - generic [ref=e29]:
        - heading "Orders" [level=1] [ref=e30]
        - link "+ Create Order" [ref=e31] [cursor=pointer]:
          - /url: /orders/new
      - generic [ref=e32]:
        - generic [ref=e33]:
          - generic [ref=e34]: Search Orders
          - textbox "Search Orders" [ref=e35]:
            - /placeholder: "Order #, customer, email..."
            - text: ListCo a81z8w
        - generic [ref=e36]:
          - generic [ref=e37]: Status
          - combobox "Status" [ref=e38]:
            - option "All Statuses" [selected]
            - option "Draft"
            - option "Pending"
            - option "Confirmed"
            - option "Processing"
            - option "Ready"
            - option "Completed"
            - option "Cancelled"
        - generic [ref=e39]:
          - generic [ref=e40]: Priority
          - combobox "Priority" [ref=e41]:
            - option "All Priorities" [selected]
            - option "Low"
            - option "Normal"
            - option "High"
            - option "Urgent"
        - generic [ref=e42]:
          - generic [ref=e43]: Assignee
          - combobox "Assignee" [ref=e44]:
            - option "All Assignees" [selected]
            - option "Admin User"
            - option "Manager User"
            - option "Second Manager"
            - option "Staff User"
            - option "Second Staff"
            - option "QA User"
        - generic [ref=e45]:
          - generic [ref=e46]:
            - generic [ref=e47]: From
            - textbox "From" [ref=e48]
          - generic [ref=e49]:
            - generic [ref=e50]: To
            - textbox "To" [ref=e51]
      - alert [ref=e52]:
        - generic [ref=e53]: "Error: Unable to load orders. (Invalid sort column.)"
        - button "Retry" [ref=e54]
```

# Test source

```ts
  1   | import { test, expect } from "../support/fixtures";
  2   | import { Api, uid } from "../support/api";
  3   | 
  4   | /** Creates N orders for one unique customer so searches are isolated from other tests' data. */
  5   | async function seedOrders(
  6   |     totals: number[],
  7   |     over: (i: number) => Record<string, unknown> = () => ({}),
  8   | ) {
  9   |     const admin = await Api.as("admin");
  10  |     const customer = await admin.createCustomer({ name: `ListCo ${uid()}` });
  11  |     const orders = [];
  12  |     for (let i = 0; i < totals.length; i++) {
  13  |         const p = await admin.createProduct({ price: totals[i] });
  14  |         orders.push(
  15  |             await admin.createOrder({
  16  |                 customer_id: customer.id,
  17  |                 items: [{ product_id: p.id, quantity: 1 }],
  18  |                 ...over(i),
  19  |             }),
  20  |         );
  21  |     }
  22  |     return { admin, customer, orders };
  23  | }
  24  | 
  25  | test.describe("order listing", () => {
  26  |     test("search by customer name, order number and customer email", async ({
  27  |         page,
  28  |         loginAs,
  29  |     }) => {
  30  |         const { customer, orders } = await seedOrders([10, 20, 30]);
  31  |         await loginAs("manager");
  32  |         await page.goto("/orders");
  33  | 
  34  |         await page.getByTestId("orders-search").fill(customer.name);
  35  |         await expect(page.getByTestId("order-row")).toHaveCount(3);
  36  | 
  37  |         await page.getByTestId("orders-search").fill(orders[1].order_number);
  38  |         await expect(page.getByTestId("order-row")).toHaveCount(1);
  39  |         await expect(page.getByTestId("order-row").first()).toHaveAttribute(
  40  |             "data-order-number",
  41  |             orders[1].order_number,
  42  |         );
  43  | 
  44  |         await page.getByTestId("orders-search").fill(customer.email);
  45  |         await expect(page.getByTestId("order-row")).toHaveCount(3);
  46  |     });
  47  | 
  48  |     test("filters by status and priority and keeps state in the URL", async ({
  49  |         page,
  50  |         loginAs,
  51  |     }) => {
  52  |         const { admin, customer, orders } = await seedOrders(
  53  |             [10, 20, 30],
  54  |             (i) => ({ priority: i === 0 ? "urgent" : "normal" }),
  55  |         );
  56  |         await admin.setStatus(orders[2].id, "confirmed");
  57  |         await loginAs("manager");
  58  |         await page.goto(`/orders?search=${encodeURIComponent(customer.name)}`);
  59  |         await expect(page.getByTestId("order-row")).toHaveCount(3);
  60  | 
  61  |         await page
  62  |             .getByTestId("orders-filter-status")
  63  |             .selectOption("confirmed");
  64  |         await expect(page.getByTestId("order-row")).toHaveCount(1);
  65  |         await expect(page).toHaveURL(/status=confirmed/);
  66  | 
  67  |         await page.getByTestId("orders-filter-status").selectOption("");
  68  |         await page.getByTestId("orders-filter-priority").selectOption("urgent");
  69  |         await expect(page.getByTestId("order-row")).toHaveCount(1);
  70  |         await expect(page.getByTestId("order-row").first()).toHaveAttribute(
  71  |             "data-order-number",
  72  |             orders[0].order_number,
  73  |         );
  74  | 
  75  |         await page.reload();
  76  |         await expect(page.getByTestId("orders-filter-priority")).toHaveValue(
  77  |             "urgent",
  78  |         );
  79  |         await expect(page.getByTestId("order-row")).toHaveCount(1);
  80  |     });
  81  | 
  82  |     test("sorts by total ascending and descending", async ({
  83  |         page,
  84  |         loginAs,
  85  |     }) => {
  86  |         const { customer } = await seedOrders([30, 10, 20]);
  87  |         await loginAs("manager");
  88  |         await page.goto(`/orders?search=${encodeURIComponent(customer.name)}`);
> 89  |         await expect(page.getByTestId("order-row")).toHaveCount(3);
      |                                                     ^ Error: expect(locator).toHaveCount(expected) failed
  90  | 
  91  |         const totals = async () =>
  92  |             await page
  93  |                 .getByTestId("order-row")
  94  |                 .evaluateAll((rows) =>
  95  |                     rows.map((r) => Number(r.getAttribute("data-total"))),
  96  |                 );
  97  |         await page.getByTestId("orders-sort-total").click();
  98  |         await expect.poll(totals).toEqual([11, 22, 33]);
  99  |         await page.getByTestId("orders-sort-total").click();
  100 |         await expect.poll(totals).toEqual([33, 22, 11]);
  101 |     });
  102 | 
  103 |     test("paginates on the server", async ({ page, loginAs }) => {
  104 |         const { customer } = await seedOrders([10, 20, 30]);
  105 |         await loginAs("manager");
  106 |         await page.goto(
  107 |             `/orders?search=${encodeURIComponent(customer.name)}&per_page=2`,
  108 |         );
  109 |         await expect(page.getByTestId("order-row")).toHaveCount(2);
  110 |         await expect(page.getByTestId("orders-page-info")).toHaveText(
  111 |             /Page 1 of 2/,
  112 |         );
  113 |         await page.getByTestId("orders-next").click();
  114 |         await expect(page.getByTestId("orders-page-info")).toHaveText(
  115 |             /Page 2 of 2/,
  116 |         );
  117 |         await expect(page.getByTestId("order-row")).toHaveCount(1);
  118 |         await expect(page.getByTestId("orders-next")).toBeDisabled();
  119 |     });
  120 | 
  121 |     test("empty state when nothing matches", async ({ page, loginAs }) => {
  122 |         await loginAs("manager");
  123 |         await page.goto(`/orders?search=zzz-no-match-${uid()}`);
  124 |         await expect(page.getByTestId("orders-empty")).toContainText(
  125 |             "No orders found.",
  126 |         );
  127 |         await expect(page.getByTestId("order-row")).toHaveCount(0);
  128 |     });
  129 | 
  130 |     test("error state with retry", async ({ page, loginAs }) => {
  131 |         await loginAs("manager");
  132 |         await page.route("**/api/orders?**", (r) =>
  133 |             r.fulfill({
  134 |                 status: 500,
  135 |                 json: {
  136 |                     success: false,
  137 |                     message: "Server error",
  138 |                     code: "SERVER_ERROR",
  139 |                     errors: {},
  140 |                 },
  141 |             }),
  142 |         );
  143 |         await page.goto("/orders");
  144 |         await expect(page.getByTestId("orders-error")).toContainText(
  145 |             "Unable to load orders.",
  146 |         );
  147 |         await page.unroute("**/api/orders?**");
  148 |         await page.getByTestId("orders-retry").click();
  149 |         await expect(page.getByTestId("orders-error")).toHaveCount(0);
  150 |         await expect(page.getByTestId("order-row").first()).toBeVisible();
  151 |     });
  152 | 
  153 |     test("loading skeleton is shown while the request is in flight", async ({
  154 |         page,
  155 |         loginAs,
  156 |     }) => {
  157 |         await loginAs("manager");
  158 |         await page.route("**/api/orders?**", async (r) => {
  159 |             await new Promise((res) => setTimeout(res, 1200));
  160 |             await r.continue();
  161 |         });
  162 |         await page.goto("/orders");
  163 |         await expect(page.getByTestId("orders-skeleton")).toBeVisible();
  164 |         await expect(page.getByTestId("order-row").first()).toBeVisible({
  165 |             timeout: 10_000,
  166 |         });
  167 |         await expect(page.getByTestId("orders-skeleton")).toHaveCount(0);
  168 |     });
  169 | 
  170 |     test("typing in search is debounced (does not fire one request per keystroke)", async ({
  171 |         page,
  172 |         loginAs,
  173 |     }) => {
  174 |         await loginAs("manager");
  175 |         await page.goto("/orders");
  176 |         await expect(page.getByTestId("order-row").first()).toBeVisible();
  177 |         let calls = 0;
  178 |         page.on("request", (r) => {
  179 |             if (r.url().includes("/api/orders?") && r.method() === "GET")
  180 |                 calls++;
  181 |         });
  182 |         await page
  183 |             .getByTestId("orders-search")
  184 |             .pressSequentially("ORD-1000", { delay: 40 });
  185 |         await expect(page.getByTestId("orders-search")).toHaveValue("ORD-1000");
  186 |         await page.waitForLoadState("networkidle");
  187 |         expect(calls).toBeLessThanOrEqual(2);
  188 |     });
  189 | 
```