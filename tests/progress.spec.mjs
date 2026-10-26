import { test, expect, ready, screen } from './fixtures.mjs';

// statystyki do testów: 12 dobrych odpowiedzi z rzędu w różnych dekadach i 2 gry
const sample = () => {
  const a = Array.from({ length: 12 }, (_, i) => ({ d: '2026-10-01', m: 'year', ok: true, y: 1960 + (i % 7) * 10, g: ['pop'], k: `A|T${i}`, t: `T${i}`, ar: 'A' }));
  return { a, g: [{ d: '2026-10-01', m: 'year', s: 60, sc: 12, p: 1, w: true }, { d: '2026-10-02', m: 'hilo', s: 30, sc: 3, p: 1 }] };
};

test('osiągnięcia: wyliczane ze statystyk, nowe pokazują się jako powiadomienie i zostają w statystykach', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((st) => { store.set('stats', st); }, sample());
  const fresh = await page.evaluate(() => checkAchievements().map((a) => a.id));
  expect(fresh).toEqual(expect.arrayContaining(['first-win', 'streak10', 'decades']));
  expect(fresh).not.toContain('streak25');
  // kilka naraz – jedno powiadomienie z liczbą i nazwami (zamiast stosu zasłaniającego ekran)
  await expect(page.locator('.toast')).toHaveCount(1);
  await expect(page.locator('.toast')).toContainText(`Nowe osiągnięcia (${fresh.length})`);
  // drugi raz – już nic nowego
  expect(await page.evaluate(() => checkAchievements().length)).toBe(0);
  await page.click('#btn-stats');
  await expect.poll(() => screen(page)).toBe('stats');
  await expect(page.locator('.ach.done')).toHaveCount(fresh.length);
  await expect(page.locator('#stats-body h2').first()).toContainText('Osiągnięcia');
});

test('osiągnięcie po prawdziwej grze: wygrana zapisuje się w statystykach', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-single');
  await page.click('.mode[data-mode=year]');
  await page.fill('#rounds', '1');
  await page.click('#btn-start');
  await ready(page);
  await page.evaluate(() => answerQuiz(state.current.y));
  await page.click('#actions button.primary');
  await expect.poll(() => screen(page)).toBe('end');
  expect(await page.evaluate(() => store.get('stats').g.at(-1).w)).toBe(true);
  expect(await page.evaluate(() => !!store.get('achievements', {})['first-win'])).toBe(true);
});

test('przenoszenie postępów: plik zapisany na jednym urządzeniu łączy statystyki na drugim', async ({ page, browser }) => {
  await page.goto('/');
  await page.evaluate((st) => { store.set('stats', st); store.set('records', { hilo0: 7 }); store.set('playlists', [{ name: 'Moja', keys: [] }]); }, sample());
  await page.click('#btn-stats');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-progress-save')]);
  const file = await download.path();
  // drugie urządzenie z własnymi statystykami
  const { newPage, phone } = await import('./fixtures.mjs');
  const other = await newPage(browser, phone);
  await other.goto('/');
  await other.evaluate(() => {
    store.set('stats', { a: [{ d: '2026-10-05', m: 'artist', ok: false, y: 1999, g: [], k: 'B|X', t: 'X', ar: 'B' }], g: [{ d: '2026-10-05', m: 'artist', s: 10, sc: 0, p: 1 }] });
    store.set('records', { hilo0: 9 });
  });
  await other.click('#btn-stats');
  await other.setInputFiles('#progress-file', file);
  await expect(other.locator('#progress-msg')).toContainText('Wczytano');
  const after = await other.evaluate(() => ({ a: store.get('stats').a.length, g: store.get('stats').g.length, rec: store.get('records').hilo0, pl: store.get('playlists', []).length }));
  expect(after).toEqual({ a: 13, g: 3, rec: 9, pl: 1 });
  // zły plik
  await other.setInputFiles('#progress-file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(other.locator('#progress-msg')).toContainText('To nie jest plik');
  await other.context().close();
});
