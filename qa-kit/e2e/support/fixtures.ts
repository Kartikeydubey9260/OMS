import { test as base, expect, Page } from '@playwright/test';
import { apiLogin, Role } from './api';

type Fixtures = {
  /** Injects a valid session (via API login) before the app loads. Not for logout tests. */
  loginAs: (role: Role) => Promise<void>;
  /** Auto-fixture: any uncaught error or console.error fails the test. */
  consoleGuard: string[];
};

export const test = base.extend<Fixtures>({
  consoleGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const t = m.text();
        // expected noise from intentional 4xx / aborted requests
        if (/Failed to load resource|status of 4\d\d|net::ERR_FAILED|ERR_ABORTED/i.test(t)) return;
        errors.push(`console.error: ${t}`);
      });
      await use(errors);
      expect(errors, 'unexpected browser errors').toEqual([]);
    },
    { auto: true },
  ],
  loginAs: async ({ page }, use) => {
    await use(async (role: Role) => {
      const { token, user } = await apiLogin(role);
      await page.addInitScript(
        ([t, u]) => localStorage.setItem('oms-auth', JSON.stringify({ state: { token: t, user: u }, version: 0 })),
        [token, user] as const,
      );
    });
  },
});

export { expect };

export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
export const count = (n: number) => n.toLocaleString('en-US');

export async function waitForPageTitle(page: Page) {
  await expect(page.getByTestId('page-title')).toBeVisible();
}
