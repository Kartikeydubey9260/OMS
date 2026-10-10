import { test, expect } from "../support/fixtures";
import { Api, uid } from "../support/api";

/** Creates N orders for one unique customer so searches are isolated from other tests' data. */
async function seedOrders(
    totals: number[],
    over: (i: number) => Record<string, unknown> = () => ({}),
) {
    const admin = await Api.as("admin");
    const customer = await admin.createCustomer({ name: `ListCo ${uid()}` });
    const orders = [];
    for (let i = 0; i < totals.length; i++) {
        const p = await admin.createProduct({ price: totals[i] });
        orders.push(
            await admin.createOrder({
                customer_id: customer.id,
                items: [{ product_id: p.id, quantity: 1 }],
                ...over(i),
            }),
        );
    }
    return { admin, customer, orders };
}

test.describe("order listing", () => {
    test("search by customer name, order number and customer email", async ({
        page,
        loginAs,
    }) => {
        const { customer, orders } = await seedOrders([10, 20, 30]);
        await loginAs("manager");
        await page.goto("/orders");

        await page.getByTestId("orders-search").fill(customer.name);
        await expect(page.getByTestId("order-row")).toHaveCount(3);

        await page.getByTestId("orders-search").fill(orders[1].order_number);
        await expect(page.getByTestId("order-row")).toHaveCount(1);
        await expect(page.getByTestId("order-row").first()).toHaveAttribute(
            "data-order-number",
            orders[1].order_number,
        );

        await page.getByTestId("orders-search").fill(customer.email);
        await expect(page.getByTestId("order-row")).toHaveCount(3);
    });

    test("filters by status and priority and keeps state in the URL", async ({
        page,
        loginAs,
    }) => {
        const { admin, customer, orders } = await seedOrders(
            [10, 20, 30],
            (i) => ({ priority: i === 0 ? "urgent" : "normal" }),
        );
        await admin.setStatus(orders[2].id, "confirmed");
        await loginAs("manager");
        await page.goto(`/orders?search=${encodeURIComponent(customer.name)}`);
        await expect(page.getByTestId("order-row")).toHaveCount(3);

        await page
            .getByTestId("orders-filter-status")
            .selectOption("confirmed");
        await expect(page.getByTestId("order-row")).toHaveCount(1);
        await expect(page).toHaveURL(/status=confirmed/);

        await page.getByTestId("orders-filter-status").selectOption("");
        await page.getByTestId("orders-filter-priority").selectOption("urgent");
        await expect(page.getByTestId("order-row")).toHaveCount(1);
        await expect(page.getByTestId("order-row").first()).toHaveAttribute(
            "data-order-number",
            orders[0].order_number,
        );

        await page.reload();
        await expect(page.getByTestId("orders-filter-priority")).toHaveValue(
            "urgent",
        );
        await expect(page.getByTestId("order-row")).toHaveCount(1);
    });

    test("sorts by total ascending and descending", async ({
        page,
        loginAs,
    }) => {
        const { customer } = await seedOrders([30, 10, 20]);
        await loginAs("manager");
        await page.goto(`/orders?search=${encodeURIComponent(customer.name)}`);
        await expect(page.getByTestId("order-row")).toHaveCount(3);

        const totals = async () =>
            await page
                .getByTestId("order-row")
                .evaluateAll((rows) =>
                    rows.map((r) => Number(r.getAttribute("data-total"))),
                );
        await page.getByTestId("orders-sort-total").click();
        await expect.poll(totals).toEqual([11, 22, 33]);
        await page.getByTestId("orders-sort-total").click();
        await expect.poll(totals).toEqual([33, 22, 11]);
    });

    test("paginates on the server", async ({ page, loginAs }) => {
        const { customer } = await seedOrders([10, 20, 30]);
        await loginAs("manager");
        await page.goto(
            `/orders?search=${encodeURIComponent(customer.name)}&per_page=2`,
        );
        await expect(page.getByTestId("order-row")).toHaveCount(2);
        await expect(page.getByTestId("orders-page-info")).toHaveText(
            /Page 1 of 2/,
        );
        await page.getByTestId("orders-next").click();
        await expect(page.getByTestId("orders-page-info")).toHaveText(
            /Page 2 of 2/,
        );
        await expect(page.getByTestId("order-row")).toHaveCount(1);
        await expect(page.getByTestId("orders-next")).toBeDisabled();
    });

    test("empty state when nothing matches", async ({ page, loginAs }) => {
        await loginAs("manager");
        await page.goto(`/orders?search=zzz-no-match-${uid()}`);
        await expect(page.getByTestId("orders-empty")).toContainText(
            "No orders found.",
        );
        await expect(page.getByTestId("order-row")).toHaveCount(0);
    });

    test("error state with retry", async ({ page, loginAs }) => {
        await loginAs("manager");
        await page.route("**/api/orders?**", (r) =>
            r.fulfill({
                status: 500,
                json: {
                    success: false,
                    message: "Server error",
                    code: "SERVER_ERROR",
                    errors: {},
                },
            }),
        );
        await page.goto("/orders");
        await expect(page.getByTestId("orders-error")).toContainText(
            "Unable to load orders.",
        );
        await page.unroute("**/api/orders?**");
        await page.getByTestId("orders-retry").click();
        await expect(page.getByTestId("orders-error")).toHaveCount(0);
        await expect(page.getByTestId("order-row").first()).toBeVisible();
    });

    test("loading skeleton is shown while the request is in flight", async ({
        page,
        loginAs,
    }) => {
        await loginAs("manager");
        await page.route("**/api/orders?**", async (r) => {
            await new Promise((res) => setTimeout(res, 1200));
            await r.continue();
        });
        await page.goto("/orders");
        await expect(page.getByTestId("orders-skeleton")).toBeVisible();
        await expect(page.getByTestId("order-row").first()).toBeVisible({
            timeout: 10_000,
        });
        await expect(page.getByTestId("orders-skeleton")).toHaveCount(0);
    });

    test("typing in search is debounced (does not fire one request per keystroke)", async ({
        page,
        loginAs,
    }) => {
        await loginAs("manager");
        await page.goto("/orders");
        await expect(page.getByTestId("order-row").first()).toBeVisible();
        let calls = 0;
        page.on("request", (r) => {
            if (r.url().includes("/api/orders?") && r.method() === "GET")
                calls++;
        });
        await page
            .getByTestId("orders-search")
            .pressSequentially("ORD-1000", { delay: 40 });
        await expect(page.getByTestId("orders-search")).toHaveValue("ORD-1000");
        await page.waitForLoadState("networkidle");
        expect(calls).toBeLessThanOrEqual(2);
    });

    test("list API never returns more than 100 rows and rejects unknown sort columns", async () => {
        const admin = await Api.as("admin");
        const big = await admin.get("/orders?per_page=1000");
        expect(big.status).toBe(200);
        expect(big.body.meta.per_page).toBeLessThanOrEqual(100);
        const bad = await admin.get(
            "/orders?sort=" + encodeURIComponent("id; DROP TABLE orders"),
        );
        expect(bad.status).toBe(422);
    });
});
