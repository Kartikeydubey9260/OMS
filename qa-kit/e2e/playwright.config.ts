import { defineConfig, devices } from "@playwright/test";

// Monorepo: Laravel serves the API (/api) AND the built React SPA from ONE origin.
const PORT = 8001;
const reuse = !process.env.CI;

export default defineConfig({
    testDir: "./tests",
    outputDir: "./test-results",
    globalSetup: "./global-setup.ts",
    timeout: 30_000,
    expect: { timeout: 7_000 },
    fullyParallel: false,
    workers: 2,
    retries: 0, // never hide flakiness with retries
    forbidOnly: true,
    reporter: [
        ["list"],
        ["html", { open: "never", outputFolder: "./playwright-report" }],
    ],
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "off",
        actionTimeout: 7_000,
        navigationTimeout: 15_000,
    },
    projects: [
        {
            name: "main",
            use: { ...devices["Desktop Chrome"] },
            testIgnore: [/dashboard\.spec\.ts/, /responsive\.spec\.ts/],
        },
        {
            // runs after everything else so concurrent tests do not change global counts mid-assertion
            name: "consistency",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /dashboard\.spec\.ts/,
            dependencies: ["main"],
            fullyParallel: false,
        },
        {
            name: "mobile",
            use: { ...devices["Pixel 5"] },
            testMatch: /responsive\.spec\.ts/,
        },
    ],
    webServer: {
        // APP_ENV=e2e makes Laravel read .env.e2e. Built SPA assets are produced in global-setup.
        command: `npx cross-env APP_ENV=e2e PHP_CLI_SERVER_WORKERS=4 php artisan serve --port=${PORT} --no-reload`,
        cwd: "../..",
        url: `http://127.0.0.1:${PORT}/api/health`,
        reuseExistingServer: reuse,
        timeout: 60_000,
    },
});
