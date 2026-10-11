import { test, expect } from "../support/fixtures";
import { Api } from "../support/api";
import * as fs from "fs";

test.describe("dashboard reports", () => {
    test("per-client report filters to a single 2025 order and exports CSV", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const customer = await admin.createCustomer();
        const product = await admin.createProduct({ price: 120 });
        await admin.createOrder({
            customer_id: customer.id,
            order_date: "2025-01-15",
            status: "pending",
            items: [{ product_id: product.id, quantity: 2 }], // 240 + 10% tax = 264
        });

        await loginAs("admin");
        await page.goto("/dashboard");

        // The report options derive from real orders: the 2025 year and the new client appear.
        await expect(
            page.getByTestId("reports-filter-year").locator("option[value='2025']"),
        ).toHaveCount(1);
        await expect(
            page.getByTestId("reports-filter-client").locator(`option[value='${customer.id}']`),
        ).toHaveCount(1);

        // Filter by client + year → exactly the single order we created.
        await page.getByTestId("reports-filter-client").selectOption(String(customer.id));
        await page.getByTestId("reports-filter-year").selectOption("2025");
        await expect(page.getByTestId("report-stat-orders")).toHaveText("1");
        await expect(page.getByTestId("report-stat-revenue")).toHaveText("$264.00");

        // The per-client detail table shows the customer with their one order.
        await expect(page.getByTestId("reports-detail-row")).toHaveCount(1);
        await expect(page.getByTestId("reports-detail-row")).toContainText(customer.name);

        // CSV export honors the active filters (default per-client report).
        const [download] = await Promise.all([
            page.waitForEvent("download"),
            page.getByTestId("reports-export-csv").click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/\.csv$/);
        const tmpPath = await download.path();
        expect(tmpPath).toBeTruthy();
        const content = fs.readFileSync(tmpPath!, "utf8").replace(/^\uFEFF/, "");
        expect(content).toContain(customer.name);
        expect(content).toContain("264");
    });

    test("date range and status filters are applied, and reset restores the report", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const customer = await admin.createCustomer();
        const product = await admin.createProduct({ price: 50 });
        await admin.createOrder({
            customer_id: customer.id,
            order_date: "2025-03-10",
            status: "pending",
            items: [{ product_id: product.id, quantity: 1 }],
        });

        await loginAs("admin");
        await page.goto("/dashboard");

        await page.getByTestId("reports-filter-client").selectOption(String(customer.id));
        await page.getByTestId("reports-filter-start").fill("2025-01-01");
        await page.getByTestId("reports-filter-end").fill("2025-12-31");
        await expect(page.getByTestId("report-stat-orders")).toHaveText("1");

        // A conflicting status filter excludes the pending order from the stats.
        await page.getByTestId("reports-filter-status").selectOption("completed");
        await expect(page.getByTestId("report-stat-orders")).toHaveText("0");

        // Switching back to the order's status brings the numbers back.
        await page.getByTestId("reports-filter-status").selectOption("pending");
        await expect(page.getByTestId("report-stat-orders")).toHaveText("1");

        // Reset clears the filters and restores unfiltered numbers.
        await page.getByTestId("reports-reset").click();
        await expect(page.getByTestId("report-stat-orders")).not.toHaveText("0");
        await expect(page.getByTestId("reports-filter-client")).toHaveValue("");
        await expect(page.getByTestId("reports-filter-start")).toHaveValue("");
    });

    test("detailed breakdowns paginate, sort and respect per-page like other tables", async ({ page, loginAs }) => {
        await loginAs("admin");
        await page.goto("/dashboard");

        const pagination = page.getByTestId("reports-detail-pagination");
        await expect(pagination).toBeVisible();

        // Default: one page of 10 rows (seeded DB has 100 clients with orders).
        await expect(page.getByTestId("reports-detail-row")).toHaveCount(10);
        await expect(page.getByTestId("reports-detail-page-info")).toContainText("Page 1");

        // Next page shows a different set of clients.
        const firstClientPage1 = (await page.getByTestId("reports-detail-row").first().textContent()) ?? "";
        await page.getByTestId("reports-detail-next").click();
        await expect(page.getByTestId("reports-detail-page-info")).toContainText("Page 2");
        await expect(page.getByTestId("reports-detail-row").first()).not.toHaveText(firstClientPage1);

        // Per-page selector grows the page and resets to page 1.
        await page.getByTestId("reports-detail-per-page").selectOption("25");
        await expect(page.getByTestId("reports-detail-row")).toHaveCount(25);
        await expect(page.getByTestId("reports-detail-page-info")).toContainText("Page 1");

        // Sorting toggles the order: total_spent ascending is the inverse of the default.
        const firstDefault = (await page.getByTestId("reports-detail-row").first().textContent()) ?? "";
        await page.getByTestId("reports-detail-sort-total_spent").click();
        await expect(page.getByTestId("reports-detail-sort-total_spent")).toContainText("↑");
        await expect(page.getByTestId("reports-detail-row").first()).not.toHaveText(firstDefault);

        // Per-product view keeps its own sort columns (per-page selection persists).
        await page.getByTestId("reports-detail-per-product").click();
        await expect(page.getByTestId("reports-detail-row")).toHaveCount(25);
        await expect(page.getByTestId("reports-detail-page-info")).toContainText("Page 1");
        await page.getByTestId("reports-detail-sort-sku").click();
        await expect(page.getByTestId("reports-detail-sort-sku")).toContainText("↑");
    });
});