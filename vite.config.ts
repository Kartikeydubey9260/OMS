import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const frontend = fileURLToPath(
    new URL("./packages/OMS/Admin/src/Resources/assets", import.meta.url),
);

export default defineConfig({
    plugins: [
        laravel({
            input: [
                "resources/css/app.css",
                "packages/OMS/Admin/src/Resources/assets/app.tsx",
            ],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    resolve: { alias: { "@": frontend } },
    test: {
        environment: "jsdom",
        setupFiles: ["packages/OMS/Admin/src/Resources/assets/tests/setup.ts"],
        include: [
            "packages/OMS/**/tests/**/*.{test,spec}.{ts,tsx}",
            "tests/frontend/**/*.{test,spec}.{ts,tsx}",
        ],
        exclude: ["qa-kit/e2e/**", "node_modules/**"],
    },
} as Parameters<typeof defineConfig>[0] & { test: Record<string, unknown> });
