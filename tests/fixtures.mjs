import { test as base, expect, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const mockScript = readFileSync(new URL('./mock.js', import.meta.url), 'utf8');

// nowy kontekst przeglądarki z podstawionym iTunes i bez statystyk odwiedzin
export async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'pl-PL', ...opts });
  await ctx.addInitScript(mockScript);
  // RELAY_TEST_URL – wszystkie strony łączą się przez własny serwer pośredniczący (server/relay)
  if (process.env.RELAY_TEST_URL) await ctx.addInitScript((url) => { window.SONGSTER_RELAY = url; }, process.env.RELAY_TEST_URL);
  await ctx.route(/cloud\.umami\.is/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  return page;
}

export const phone = devices['Pixel 7'];

// piosenka wczytana i gotowa do odtworzenia
export const ready = (page) => page.waitForFunction(() => !document.querySelector('#btn-play').disabled && state.phase === 'listen' && state.current, null, { timeout: 30000 });
export const screen = (page) => page.evaluate(() => SCREENS.find((x) => !document.querySelector('#screen-' + x).classList.contains('hidden')));

export const test = base.extend({
  page: async ({ browser }, use) => {
    const page = await newPage(browser, phone);
    await use(page);
    expect(page.errors, 'błędy JavaScript na stronie').toEqual([]);
    await page.context().close();
  },
});
export { expect };
