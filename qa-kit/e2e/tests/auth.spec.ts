import { test, expect } from "../support/fixtures";
import { CREDS, Role } from "../support/api";

async function uiLogin(
    page: import("@playwright/test").Page,
    role: Role,
    password = CREDS[role].password,
) {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(CREDS[role].email);
    await page.getByTestId("login-password").fill(password);
    await page.getByTestId("login-submit").click();
}

test.describe("authentication", () => {
    for (const [role, landing] of [
        ["admin", /\/dashboard$/],
        ["manager", /\/dashboard$/],
        ["staff", /\/orders$/],
    ] as const) {
        test(`${role} can log in and lands on the right page`, async ({
            page,
        }) => {
            await uiLogin(page, role);
            await expect(page).toHaveURL(landing);
            await expect(page.getByTestId("user-menu")).toContainText(
                CREDS[role].name,
            );
        });
    }

    test("wrong password shows an error and stays on login", async ({
        page,
    }) => {
        await uiLogin(page, "admin", "definitely-wrong");
        await expect(page.getByTestId("login-error")).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
        expect(
            await page.evaluate(() => localStorage.getItem("oms-auth")),
        ).toBeNull();
    });

    test("empty form shows validation messages without calling the API", async ({
        page,
    }) => {
        let called = false;
        await page.route("**/api/login", (r) => {
            called = true;
            return r.continue();
        });
        await page.goto("/login");
        await page.getByTestId("login-submit").click();
        await expect(page.getByTestId("field-error").first()).toBeVisible();
        expect(called).toBe(false);
    });

    test("unauthenticated visitors are redirected to /login", async ({
        page,
    }) => {
        for (const path of [
            "/orders",
            "/orders/new",
            "/customers",
            "/products",
            "/dashboard",
        ]) {
            await page.goto(path);
            await expect(page).toHaveURL(/\/login/);
        }
    });

    test("logout clears the session and protects routes again", async ({
        page,
    }) => {
        await uiLogin(page, "manager");
        await expect(page).toHaveURL(/\/dashboard$/);
        await page.getByTestId("user-menu").click();
        await page.getByTestId("logout-button").click();
        await expect(page).toHaveURL(/\/login/);
        expect(
            await page.evaluate(
                () =>
                    JSON.parse(
                        localStorage.getItem("oms-auth") ?? '{"state":{}}',
                    ).state?.token ?? null,
            ),
        ).toBeNull();
        await page.goto("/orders");
        await expect(page).toHaveURL(/\/login/);
    });

    test("an expired/invalid token (401 from API) sends the user to /login", async ({
        page,
        loginAs,
    }) => {
        await loginAs("admin");
        await page.route("**/api/me", (r) =>
            r.fulfill({
                status: 401,
                json: {
                    success: false,
                    message: "Unauthenticated.",
                    code: "UNAUTHENTICATED",
                    errors: {},
                },
            }),
        );
        await page.route("**/api/orders**", (r) =>
            r.fulfill({
                status: 401,
                json: {
                    success: false,
                    message: "Unauthenticated.",
                    code: "UNAUTHENTICATED",
                    errors: {},
                },
            }),
        );
        await page.goto("/orders");
        await expect(page).toHaveURL(/\/login/);
    });
});
