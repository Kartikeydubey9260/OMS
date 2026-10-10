import { test, expect, money } from "../support/fixtures";
import { Api, exampleOrder, uid } from "../support/api";

test.describe("customers", () => {
    test("manager creates a customer through the UI and finds it by search", async ({
        page,
        loginAs,
    }) => {
        const id = uid();
        await loginAs("manager");
        await page.goto("/customers/new");
        await page.getByTestId("customer-name").fill(`UI Customer ${id}`);
        await page.getByTestId("customer-email").fill(`ui-${id}@example.test`);
        await page.getByTestId("customer-phone").fill("+91 99999 11111");
        await page.getByTestId("customer-submit").click();
        await expect(page.getByTestId("toast")).toBeVisible();

        await page.goto("/customers");
        await page.getByTestId("customers-search").fill(`UI Customer ${id}`);
        await expect(page.getByTestId("customer-row")).toHaveCount(1);
    });

    test("duplicate email shows an inline error from the backend", async ({
        page,
        loginAs,
    }) => {
        const admin = await Api.as("admin");
        const existing = await admin.createCustomer();
        await loginAs("manager");
        await page.goto("/customers/new");
        await page.getByTestId("customer-name").fill("Dup Person");
        await page.getByTestId("customer-email").fill(existing.email);
        await page.getByTestId("customer-submit").click();
        await expect(page.getByTestId("field-error").first()).toBeVisible();
        await expect(page).toHaveURL(/\/customers\/new$/);
    });

    test("detail page shows order statistics", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const customer = await admin.createCustomer();
        const p = await admin.createProduct({ price: 100 });
        const mk = () =>
            admin.createOrder({
                customer_id: customer.id,
                items: [{ product_id: p.id, quantity: 1 }],
            }); // 110 each incl. 10% tax
        const o1 = await mk();
        const o2 = await mk();
        await admin.setStatus(o2.id, "cancelled", "test");

        await loginAs("manager");
        await page.goto(`/customers/${customer.id}`);
        await expect(page.getByTestId("customer-stat-total")).toContainText(
            "2",
        );
        await expect(page.getByTestId("customer-stat-pending")).toContainText(
            "1",
        );
        await expect(page.getByTestId("customer-stat-cancelled")).toContainText(
            "1",
        );
        await expect(page.getByTestId("customer-stat-completed")).toContainText(
            "0",
        );
        await expect(page.getByTestId("customer-stat-value")).toContainText(
            money(110),
        ); // cancelled orders excluded
        await expect(page.getByTestId("customer-recent-orders")).toContainText(
            o1.order_number,
        );
    });

    test("staff can view but not create customers", async ({
        page,
        loginAs,
    }) => {
        await loginAs("staff");
        await page.goto("/customers");
        await expect(page.getByTestId("customer-row").first()).toBeVisible();
        await expect(page.getByTestId("customer-new")).toHaveCount(0);
    });

    test("customer API: validation errors and soft-delete protection", async () => {
        const admin = await Api.as("admin");
        const bad = await admin.post("/customers", {
            name: "",
            email: "not-an-email",
        });
        expect(bad.status).toBe(422);
        expect(bad.body.errors).toHaveProperty("name");
        expect(bad.body.errors).toHaveProperty("email");
        const { customer } = await exampleOrder(admin);
        const del = await admin.del(`/customers/${customer.id}`);
        expect([200, 204, 422]).toContain(del.status); // deleted/deactivated or blocked – but never a 500
        const after = await admin.get(
            `/orders?search=${encodeURIComponent(customer.name)}`,
        );
        expect(after.status).toBe(200);
        expect(after.body.data.length).toBeGreaterThan(0); // history preserved
    });
});

test.describe("products", () => {
    test("admin creates a product through the UI", async ({
        page,
        loginAs,
    }) => {
        const id = uid().toUpperCase();
        await loginAs("admin");
        await page.goto("/products/new");
        await page.getByTestId("product-name").fill(`UI Product ${id}`);
        await page.getByTestId("product-sku").fill(`UI-${id}`);
        await page.getByTestId("product-price").fill("49.99");
        await page.getByTestId("product-stock").fill("25");
        await page.getByTestId("product-submit").click();
        await expect(page.getByTestId("toast")).toBeVisible();
        await page.goto("/products");
        await page.getByTestId("products-search").fill(`UI-${id}`);
        await expect(page.getByTestId("product-row")).toHaveCount(1);
        await expect(page.getByTestId("product-row")).toContainText("$49.99");
    });

    test("duplicate SKU is rejected", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const p = await admin.createProduct();
        await loginAs("admin");
        await page.goto("/products/new");
        await page.getByTestId("product-name").fill("Another");
        await page.getByTestId("product-sku").fill(p.sku);
        await page.getByTestId("product-price").fill("10");
        await page.getByTestId("product-stock").fill("1");
        await page.getByTestId("product-submit").click();
        await expect(page.getByTestId("field-error").first()).toBeVisible();
    });

    test("manager and staff cannot create products", async ({
        page,
        loginAs,
    }) => {
        await loginAs("manager");
        await page.goto("/products");
        await expect(page.getByTestId("product-row").first()).toBeVisible();
        await expect(page.getByTestId("product-new")).toHaveCount(0);
        const manager = await Api.as("manager");
        expect(
            (
                await manager.post("/products", {
                    name: "x",
                    sku: `X-${uid()}`,
                    price: 1,
                    stock_quantity: 1,
                })
            ).status,
        ).toBe(403);
    });

    test("product API validation and stock rules", async () => {
        const admin = await Api.as("admin");
        const bad = await admin.post("/products", {
            name: "x",
            sku: "",
            price: -5,
            stock_quantity: -1,
        });
        expect(bad.status).toBe(422);
        expect(Object.keys(bad.body.errors)).toEqual(
            expect.arrayContaining(["sku", "price", "stock_quantity"]),
        );
        const p = await admin.createProduct({ stock_quantity: 10 });
        const adj = await admin.patch(`/products/${p.id}/stock`, {
            delta: -3,
            reason: "damaged",
        });
        expect(adj.status).toBe(200);
        expect(await admin.stock(p.id)).toBe(7);
        const tooMuch = await admin.patch(`/products/${p.id}/stock`, {
            delta: -100,
            reason: "oops",
        });
        expect(tooMuch.status).toBe(422);
        expect(await admin.stock(p.id)).toBe(7);
    });

    test("inactive products cannot be ordered", async () => {
        const admin = await Api.as("admin");
        const customer = await admin.createCustomer();
        const p = await admin.createProduct({ status: "inactive" });
        const r = await admin.post("/orders", {
            customer_id: customer.id,
            order_date: "2026-10-09",
            priority: "normal",
            status: "draft",
            items: [{ product_id: p.id, quantity: 1 }],
        });
        expect(r.status).toBe(422);
    });
});
