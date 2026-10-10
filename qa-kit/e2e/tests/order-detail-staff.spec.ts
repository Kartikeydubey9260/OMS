import { test, expect } from "../support/fixtures";
import { Api, exampleOrder } from "../support/api";

test.describe("order detail — content", () => {
    test("shows summary, customer info, items, timeline and activity", async ({
        page,
        loginAs,
    }) => {
        const admin = await Api.as("admin");
        const { order, customer, a, b } = await exampleOrder(admin);
        await loginAs("manager");
        await page.goto(`/orders/${order.id}`);

        await expect(page.getByTestId("order-number")).toHaveText(
            order.order_number,
        );
        await expect(page.getByTestId("order-customer-name")).toHaveText(
            customer.name,
        );
        await expect(page.getByTestId("order-customer-email")).toHaveText(
            customer.email,
        );
        await expect(page.getByTestId("order-items-table")).toContainText(
            a.sku,
        );
        await expect(page.getByTestId("order-items-table")).toContainText(
            b.sku,
        );
        await expect(page.getByTestId("order-item-row")).toHaveCount(2);
        await expect(page.getByTestId("order-timeline")).toBeVisible();
        await expect(page.getByTestId("order-activity")).toBeVisible();
        for (const t of [
            "action-edit",
            "action-status",
            "action-assign",
            "action-note",
            "action-cancel",
        ]) {
            await expect(page.getByTestId(t)).toBeVisible();
        }
        await expect(page.getByTestId("action-delete")).toHaveCount(0); // Manager cannot delete
    });

    test("admin can delete a draft order after confirming", async ({
        page,
        loginAs,
    }) => {
        const admin = await Api.as("admin");
        const { order } = await exampleOrder(admin, { status: "draft" });
        await loginAs("admin");
        await page.goto(`/orders/${order.id}`);
        await page.getByTestId("action-delete").click();
        await page.getByTestId("confirm-ok").click();
        await expect(page).toHaveURL(/\/orders$/);
        expect((await admin.get(`/orders/${order.id}`)).status).toBe(404);
    });

    test("unknown order id shows a not-found/error state, not a blank page", async ({
        page,
        loginAs,
    }) => {
        await loginAs("manager");
        await page.goto("/orders/99999999");
        await expect(
            page
                .getByTestId("not-found-page")
                .or(page.getByTestId("order-detail-error")),
        ).toBeVisible();
    });

    test("loading skeleton then content", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const { order } = await exampleOrder(admin);
        await loginAs("manager");
        await page.route(`**/api/orders/${order.id}`, async (r) => {
            await new Promise((res) => setTimeout(res, 1000));
            await r.continue();
        });
        await page.goto(`/orders/${order.id}`);
        await expect(page.getByTestId("order-detail-skeleton")).toBeVisible();
        await expect(page.getByTestId("order-number")).toBeVisible({
            timeout: 10_000,
        });
    });
});

test.describe("order detail — staff", () => {
    test("staff sees only the actions they are allowed to use", async ({
        page,
        loginAs,
    }) => {
        const admin = await Api.as("admin");
        const staff = await Api.as("staff");
        const { order } = await exampleOrder(admin, {
            assigned_to: staff.session.user.id,
        });
        await admin.setStatus(order.id, "confirmed");

        await loginAs("staff");
        await page.goto(`/orders/${order.id}`);
        await expect(page.getByTestId("order-number")).toBeVisible();
        for (const t of [
            "action-delete",
            "action-cancel",
            "action-assign",
            "action-edit",
        ]) {
            await expect(page.getByTestId(t)).toHaveCount(0);
        }
        await page.getByTestId("action-status").click();
        const values = await page
            .getByTestId("status-select")
            .locator("option")
            .evaluateAll((os) =>
                os.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
            );
        expect(values).toEqual(["processing"]);
        await page.getByTestId("status-select").selectOption("processing");
        await page.getByTestId("status-submit").click();
        await expect(page.getByTestId("order-status")).toHaveText(
            /processing/i,
        );
    });

    test("staff can add a note to an assigned order", async ({
        page,
        loginAs,
    }) => {
        const admin = await Api.as("admin");
        const staff = await Api.as("staff");
        const { order } = await exampleOrder(admin, {
            assigned_to: staff.session.user.id,
        });
        await loginAs("staff");
        await page.goto(`/orders/${order.id}`);
        await page.getByTestId("action-note").click();
        await page
            .getByTestId("note-input")
            .fill("Packed and ready for dispatch");
        await page.getByTestId("note-submit").click();
        await expect(page.getByTestId("order-activity")).toContainText(
            "Packed and ready for dispatch",
        );
    });

    test("staff opening an unassigned order gets the forbidden page", async ({
        page,
        loginAs,
    }) => {
        const admin = await Api.as("admin");
        const { order } = await exampleOrder(admin);
        await loginAs("staff");
        await page.goto(`/orders/${order.id}`);
        await expect(page.getByTestId("forbidden-page")).toBeVisible();
    });
});
