import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/** Theme the project runs in: Paper for *-paper projects, Iron for *-iron. */
export function projectTheme(info: TestInfo): 'paper' | 'iron' {
  return info.project.name.endsWith('iron') ? 'iron' : 'paper';
}

/** NFR-A11Y-1: no axe violations (WCAG 2.2 AA tags) on the current page. */
export async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary, summary.join('\n')).toEqual([]);
}

/** Waits until the service worker controls the page (needed before offline tests). */
export async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  }
}

/**
 * Offline check that works in every engine. Chromium: real offline (context.setOffline) and reload.
 * WebKit: Playwright's WebKit blocks service-worker-served requests when offline (tooling limitation,
 * DECISIONS D34), so instead we prove every same-origin resource the page loaded is in the precache.
 */
export async function goOfflineAndReload(page: Page, browserName: string, url: string) {
  await waitForServiceWorker(page);
  if (browserName === 'chromium') {
    await page.context().setOffline(true);
    await page.goto(url);
    return;
  }
  const missing = await page.evaluate(async () => {
    const urls = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin) && !u.includes('/sw.js'));
    urls.push(location.origin + '/index.html');
    const out: string[] = [];
    for (const u of urls) {
      const hit = await caches.match(u, { ignoreSearch: true });
      if (!hit) out.push(u);
    }
    return out;
  });
  expect(missing, `not precached: ${missing.join(', ')}`).toEqual([]);
  await page.goto(url);
}

/** Reads LiftLog's local error log (NFR-REL-4), for debugging failed runs. */
export async function appErrors(page: Page): Promise<{ message: string; stack?: string; route?: string }[]> {
  return page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('liftlog');
        r.onsuccess = () => {
          try {
            const q = r.result.transaction('errors').objectStore('errors').getAll();
            q.onsuccess = () => res(q.result);
          } catch {
            res([]);
          }
        };
        r.onerror = () => res([]);
      }),
  );
}
