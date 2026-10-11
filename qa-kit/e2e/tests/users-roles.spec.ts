import { test, expect } from "../support/fixtures";
import { Api, uid } from "../support/api";

test.describe("user management", () => {
    test("admin creates a user through a modal", async ({ page, loginAs }) => {
        const id = uid();
        const email = `new-${id}@example.test`;

        await loginAs("admin");
        await page.goto("/users");

        await page.getByTestId("users-new").click();
        await page.getByTestId("user-name").fill(`New User ${id}`);
        await page.getByTestId("user-email").fill(email);
        await page.getByTestId("user-password").fill("secret123");
        await page.getByTestId("user-role").selectOption({ label: "staff" });
        await page.getByTestId("user-submit").click();
        await expect(page.getByTestId("toast")).toContainText("created");

        await page.getByTestId("users-search").fill(email);
        await expect(page.getByTestId("user-row")).toHaveCount(1);
        await expect(page.getByTestId("user-row")).toContainText(email);
    });

    test("duplicate user email shows an inline error from the backend", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const created = await admin.post("/users", {
            name: "Taken User",
            email: `taken-${uid()}@example.test`,
            password: "secret123",
            role: "staff",
            is_active: true,
        });
        expect(created.status).toBe(201);

        await loginAs("admin");
        await page.goto("/users");

        await page.getByTestId("users-new").click();
        await page.getByTestId("user-name").fill("Another User");
        await page.getByTestId("user-email").fill(created.body.data.email);
        await page.getByTestId("user-password").fill("secret123");
        await page.getByTestId("user-role").selectOption({ label: "staff" });
        await page.getByTestId("user-submit").click();

        await expect(page.getByTestId("user-create-form")).toContainText("already been taken");
        await expect(page.getByTestId("field-error")).toContainText("already been taken");
    });

    test("admin edits and deletes users through the UI, and cannot delete their own account", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const email = `victim-${uid()}@example.test`;
        const created = await admin.post("/users", {
            name: "Victim User",
            email,
            password: "secret123",
            role: "staff",
            is_active: true,
        });
        expect(created.status).toBe(201);

        await loginAs("admin");
        await page.goto("/users");

        // Edit: rename via the edit modal.
        await page.getByTestId("users-search").fill(email);
        await expect(page.getByTestId("user-row")).toHaveCount(1);
        await page.getByTestId("user-row").getByTestId("user-edit").click();
        await expect(page.getByTestId("user-edit-form")).toBeVisible();
        const renamed = `Renamed ${uid()}`;
        await page.getByTestId("user-edit-name").fill(renamed);
        await page.getByTestId("user-edit-submit").click();
        await expect(page.getByTestId("toast").last()).toContainText("updated");

        // The renamed user shows up under its new name.
        await page.getByTestId("users-search").fill(renamed);
        await expect(page.getByTestId("user-row")).toHaveCount(1);
        await expect(page.getByTestId("user-row")).toContainText(renamed);

        // Delete the edited user.
        await page.getByTestId("user-row").getByTestId("user-delete").click();
        await page.getByTestId("user-delete-confirm").click();
        await expect(page.getByTestId("toast").last()).toContainText("deleted");
        await expect(page.getByTestId("users-empty")).toBeVisible();

        // Deleting your own account is blocked server-side with a clear toast.
        await page.getByTestId("users-search").fill("admin@oms.test");
        await expect(page.getByTestId("user-row")).toHaveCount(1);
        await page.getByTestId("user-row").getByTestId("user-delete").click();
        await page.getByTestId("user-delete-confirm").click();
        await expect(page.getByTestId("toast").last()).toContainText("own account");
        await expect(page.getByTestId("user-row")).toHaveCount(1);

        const gone = await admin.get(`/users?search=${encodeURIComponent(renamed)}`);
        const rows = gone.body.data as { name: string }[];
        expect(rows.some((r) => r.name === renamed)).toBe(false);
    });

    test("role permissions manager round-trips without changing permissions", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const roles = (await admin.get("/roles")).body.data as {
            id: number;
            name: string;
            permissions: { name: string }[];
        }[];
        const staff = roles.find((r) => r.name === "staff");
        expect(staff).toBeDefined();
        const permsBefore = staff!.permissions.map((p) => p.name);
        expect(permsBefore).toContain("orders.view_assigned");

        await loginAs("admin");
        await page.goto("/users");
        await page.getByTestId("section-tab-roles").click();
        await expect(page.getByTestId("roles-table")).toBeVisible();

        const staffRow = page.getByTestId("role-row").filter({ hasText: "staff" });
        await staffRow.getByTestId("role-permissions").click();
        await expect(page.getByTestId("role-permissions-modal")).toBeVisible();

        // Save is disabled until something changes.
        await expect(page.getByTestId("role-permissions-save")).toBeDisabled();

        const box = page.getByTestId("permission-checkbox-orders.view_assigned");
        await expect(box).toBeChecked();

        // Toggle off then on again: no net change, but exercises the PUT round-trip.
        await box.uncheck();
        await expect(box).not.toBeChecked();
        await box.check();
        await expect(box).toBeChecked();
        await page.getByTestId("role-permissions-save").click();
        await expect(page.getByTestId("toast")).toContainText("permissions updated");

        const after = (
            (await admin.get("/roles")).body.data as {
                id: number;
                name: string;
                permissions: { name: string }[];
            }[]
        ).find((r) => r.name === "staff");
        expect(after!.permissions.map((p) => p.name).sort()).toEqual([...permsBefore].sort());
    });

    test("roles can be created, renamed and deleted in their own section", async ({ page, loginAs }) => {
        const admin = await Api.as("admin");
        const id = uid();
        const initialName = `qa-role-${id}`;
        const renamed = `qa-team-${id}`;

        await loginAs("admin");
        await page.goto("/users");
        await page.getByTestId("section-tab-roles").click();
        await expect(page.getByTestId("roles-table")).toBeVisible();

        // System roles are protected: admin's edit/delete are disabled.
        const adminRow = page.getByTestId("role-row").filter({ hasText: "admin" });
        await expect(adminRow.getByTestId("role-edit")).toBeDisabled();
        await expect(adminRow.getByTestId("role-delete")).toBeDisabled();

        // Create a role.
        await page.getByTestId("role-new").click();
        await page.getByTestId("role-create-name").fill(initialName);
        await page.getByTestId("role-create-submit").click();
        await expect(page.getByTestId("toast")).toContainText("created");

        const newRow = page.getByTestId("role-row").filter({ hasText: initialName });
        await expect(newRow).toHaveCount(1);
        await expect(newRow.getByTestId("role-users-count")).toHaveText("0");
        await expect(newRow.getByTestId("role-perms-count")).toHaveText("0");

        // Rename it.
        await newRow.getByTestId("role-edit").click();
        await expect(page.getByTestId("role-edit-form")).toBeVisible();
        await page.getByTestId("role-edit-name").fill(renamed);
        await page.getByTestId("role-edit-submit").click();
        await expect(page.getByTestId("toast").last()).toContainText("renamed");
        await expect(page.getByTestId("role-row").filter({ hasText: initialName })).toHaveCount(0);
        await expect(page.getByTestId("role-row").filter({ hasText: renamed })).toHaveCount(1);

        // Delete it again.
        const renamedRow = page.getByTestId("role-row").filter({ hasText: renamed });
        await renamedRow.getByTestId("role-delete").click();
        await page.getByTestId("role-delete-confirm").click();
        await expect(page.getByTestId("toast").last()).toContainText("deleted");
        await expect(page.getByTestId("role-row").filter({ hasText: renamed })).toHaveCount(0);

        const remaining = (await admin.get("/roles")).body.data as { name: string }[];
        expect(remaining.some((r) => r.name === renamed)).toBe(false);
    });

    test("users table is server-driven: search, role filter and pagination controls", async ({ page, loginAs }) => {
        await loginAs("admin");
        await page.goto("/users");

        await expect(page.getByTestId("users-table")).toBeVisible();
        await expect(page.getByTestId("users-per-page")).toHaveValue("10");
        await expect(page.getByTestId("users-sort-name")).toBeVisible();
        await expect(page.getByTestId("users-filter-role")).toBeVisible();
        await expect(page.getByTestId("users-filter-role")).toContainText("staff");

        await page.getByTestId("users-filter-role").selectOption({ label: "staff" });
        await expect(page.getByTestId("users-page-info")).toContainText("Page 1");
        await expect(page.getByTestId("users-table")).toContainText("staff@oms.test");
        await expect(page.getByTestId("users-table")).not.toContainText("admin@oms.test");

        await page.getByTestId("users-filter-role").selectOption("");
        await page.getByTestId("users-search").fill("manager@oms.test");
        await expect(page.getByTestId("user-row")).toHaveCount(1);
        await expect(page.getByTestId("user-row")).toContainText("manager@oms.test");
    });
});