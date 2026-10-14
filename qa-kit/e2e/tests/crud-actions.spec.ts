import { test, expect } from "../support/fixtures";
import { Api, uid } from "../support/api";

test.describe("customer edit & delete", () => {
    test("admin edits a customer through the UI", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const c = await admin.createCustomer();
        const newName = `Edited Customer ${uid()}`;

        await loginAs("admin");
        await page.goto("/customers");
        await page.getByTestId("customers-search").fill(c.name);
        await expect(page.getByTestId("customer-row")).toHaveCount(1);

        await page.getByTestId("customer-row").getByTestId("customer-edit").click();
        await expect(page).toHaveURL(/\/customers\/\d+\/edit$/);
        await page.getByTestId("customer-name").fill(newName);
        await page.getByTestId("customer-submit").click();
        await expect(page.getByTestId("toast")).toContainText("updated");

        await page.goto("/customers");
        await page.getByTestId("customers-search").fill(newName);
        await expect(page.getByTestId("customer-row")).toHaveCount(1);
        await expect(page.getByTestId("customer-row")).toContainText(newName);
    });

    test("admin deletes a customer without order history", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const c = await admin.createCustomer();

        await loginAs("admin");
        await page.goto("/customers");
        await page.getByTestId("customers-search").fill(c.name);
        await expect(page.getByTestId("customer-row")).toHaveCount(1);

        await page.getByTestId("customer-row").getByTestId("customer-delete").click();
        await page.getByTestId("customer-delete-confirm").click();
        await expect(page.getByTestId("toast")).toContainText("deleted");
        await expect(page.getByTestId("customer-row")).toHaveCount(0);
    });

    test("manager sees edit but not delete; staff sees neither", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const c = await admin.createCustomer();

        await loginAs("manager");
        await page.goto("/customers");
        await page.getByTestId("customers-search").fill(c.name);
        await expect(page.getByTestId("customer-row")).toHaveCount(1);
        await expect(page.getByTestId("customer-edit")).toHaveCount(1);
        await expect(page.getByTestId("customer-delete")).toHaveCount(0);

        await loginAs("staff");
        await page.goto("/customers");
        await page.getByTestId("customers-search").fill(c.name);
        await expect(page.getByTestId("customer-row")).toHaveCount(1);
        await expect(page.getByTestId("customer-edit")).toHaveCount(0);
        await expect(page.getByTestId("customer-delete")).toHaveCount(0);
    });
});

test.describe("product edit & delete", () => {
    test("admin edits a product through the UI", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const p = await admin.createProduct();

        await loginAs("admin");
        await page.goto("/products");
        await page.getByTestId("products-search").fill(p.sku);
        await expect(page.getByTestId("product-row")).toHaveCount(1);

        await page.getByTestId("product-row").getByTestId("product-edit").click();
        await expect(page).toHaveURL(/\/products\/\d+\/edit$/);
        await page.getByTestId("product-price").fill("250");
        await page.getByTestId("product-submit").click();
        await expect(page.getByTestId("toast")).toContainText("updated");

        await page.goto("/products");
        await page.getByTestId("products-search").fill(p.sku);
        await expect(page.getByTestId("product-row")).toHaveCount(1);
        await expect(page.getByTestId("product-row")).toContainText("$250.00");
    });

    test("a product with order history cannot be deleted, a clean one can", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const customer = await admin.createCustomer();
        const withHistory = await admin.createProduct();
        const clean = await admin.createProduct();
        await admin.createOrder({
            customer_id: customer.id,
            items: [{ product_id: withHistory.id, quantity: 1 }],
        });

        await loginAs("admin");

        // Attempt to delete the product referenced by an order → rejected.
        await page.goto("/products");
        await page.getByTestId("products-search").fill(withHistory.sku);
        await expect(page.getByTestId("product-row")).toHaveCount(1);
        await page.getByTestId("product-delete").click();
        await page.getByTestId("product-delete-confirm").click();
        await expect(page.getByTestId("toast")).toContainText("order history");
        await expect(page.getByTestId("product-row")).toHaveCount(1);

        // A product without order history deletes cleanly.
        await page.getByTestId("products-search").fill(clean.sku);
        await expect(page.getByTestId("product-row")).toContainText(clean.sku);
        await page.getByTestId("product-delete").click();
        await page.getByTestId("product-delete-confirm").click();
        await expect(page.getByTestId("toast").last()).toContainText("deleted successfully");
        await expect(page.getByTestId("product-row")).toHaveCount(0);
    });

    test("products are filterable by price range", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const tag = `PRC-${uid().toUpperCase()}`;
        const cheap = await admin.createProduct({ sku: `${tag}-A`, price: 25 });
        const mid = await admin.createProduct({ sku: `${tag}-B`, price: 150 });
        await admin.createProduct({ sku: `${tag}-C`, price: 500 });

        await loginAs("admin");
        await page.goto("/products");
        await page.getByTestId("products-search").fill(tag);
        await expect(page.getByTestId("product-row")).toHaveCount(3);

        // Min price 100 keeps only the 150 and 500 products.
        await page.getByTestId("products-filter-price-min").fill("100");
        await expect(page.getByTestId("product-row")).toHaveCount(2);
        await expect(page.getByTestId("products-table")).toContainText(mid.sku);
        await expect(page.getByTestId("products-table")).not.toContainText(cheap.sku);

        // Adding max 200 narrows to the 150 product only.
        await page.getByTestId("products-filter-price-max").fill("200");
        await expect(page.getByTestId("product-row")).toHaveCount(1);
        await expect(page.getByTestId("products-table")).toContainText(mid.sku);

        // A range that excludes everything yields the empty state.
        await page.getByTestId("products-filter-price-min").fill("700");
        await expect(page.getByTestId("products-empty")).toBeVisible();
    });

    test("manager and staff see no product edit or delete actions", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const p = await admin.createProduct();

        await loginAs("manager");
        await page.goto("/products");
        await page.getByTestId("products-search").fill(p.sku);
        await expect(page.getByTestId("product-row")).toHaveCount(1);
        await expect(page.getByTestId("product-edit")).toHaveCount(0);
        await expect(page.getByTestId("product-delete")).toHaveCount(0);

        await loginAs("staff");
        await page.goto("/products");
        await page.getByTestId("products-search").fill(p.sku);
        await expect(page.getByTestId("product-row")).toHaveCount(1);
        await expect(page.getByTestId("product-edit")).toHaveCount(0);
        await expect(page.getByTestId("product-delete")).toHaveCount(0);
    });
});