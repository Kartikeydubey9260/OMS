import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
    {
        ignores: [
            "public/**",
            "vendor/**",
            "node_modules/**",
            "storage/**",
            "bootstrap/cache/**",
            "qa-kit/e2e/test-results/**",
            "qa-kit/e2e/playwright-report/**",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["packages/OMS/Admin/src/Resources/assets/**/*.{ts,tsx}"],
        plugins: { "react-hooks": reactHooks },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "no-console": ["error", { allow: ["warn", "error"] }],
        },
    },
);
