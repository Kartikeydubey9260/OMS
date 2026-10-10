import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Root package.json is "type": "module", so Playwright loads this file as ESM: no __dirname.
const root = fileURLToPath(new URL("../../", import.meta.url)); // monorepo root = Laravel root

/**
 * Once per run:
 *  1. build the React SPA (so e2e never tests stale assets)   — skip with E2E_SKIP_BUILD=1
 *  2. rebuild the e2e database from the documented seed state — skip with E2E_SKIP_SEED=1
 * Note: the webServer starts before globalSetup, but /api/health needs no DB or assets, so the order is safe.
 * Make sure no Vite dev server is running (it creates public/hot and would be used instead of public/build).
 */
export default async function globalSetup() {
    if (process.env.E2E_SKIP_BUILD !== "1") {
        execSync("npm run build", { cwd: root, stdio: "inherit" });
    }
    if (process.env.E2E_SKIP_SEED !== "1") {
        execSync("php artisan migrate:fresh --seed --force", {
            cwd: root,
            env: { ...process.env, APP_ENV: "e2e" },
            stdio: "inherit",
        });
    }
}
