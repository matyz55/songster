// Własny serwer pośredniczący (server/relay): telefony łączą się z gospodarzem przez WebSocket, bez WebRTC i MQTT.
// Test potrzebuje działającego serwera – lokalnie: (cd server/relay && npx wrangler dev --port 8790), potem
// RELAY_TEST_URL=ws://127.0.0.1:8790 npx playwright test tests/relay.spec.mjs. Bez tej zmiennej test jest pomijany.
import { test, expect } from '@playwright/test';
import { newPage, phone, ready } from './fixtures.mjs';

const RELAY = process.env.RELAY_TEST_URL;
test.skip(!RELAY, 'brak RELAY_TEST_URL');

// strona z adresem serwera; WebRTC (PeerJS) i MQTT zablokowane – zostaje tylko własny serwer
async function relayPage(browser) {
  const p = await newPage(browser, phone);
  await p.context().addInitScript((url) => { window.SONGSTER_RELAY = url; }, RELAY);
  await p.context().route(/peerjs|mqtt/, (r) => r.abort());
  return p;
}

test('serwer pośredniczący: dołączenie telefonu, ▶ z telefonu steruje gospodarzem, zamknięcie rozłącza', async ({ browser }) => {
  const host = await relayPage(browser);
  await host.goto('/');
  await host.click('#btn-multi');
  await host.waitForFunction(() => !!roomCode, null, { timeout: 20000 });
  const code = await host.evaluate(() => roomCode);
  const ania = await relayPage(browser);
  await ania.goto(`/tv.html?join=${code}`);
  await ania.waitForSelector('.join-name', { timeout: 20000 });
  await ania.fill('.join-name', 'Ania');
  await ania.click('.join-form button');
  await ania.waitForSelector('.phone-info', { timeout: 15000 });
  await expect(host.locator('#lobby-list .p-phone')).toHaveCount(1);
  await host.click('#btn-lobby-next');
  await host.click('.mode[data-mode=multi]');
  await host.click('#btn-start');
  await ready(host);
  await host.evaluate(() => { state.turn = state.players.findIndex((p) => p.name === 'Ania'); startTurn(); });
  await ready(host);
  await ania.waitForSelector('.ht-controls .p-play');
  const t0 = Date.now();
  await ania.click('.ht-controls .p-play');
  await expect.poll(() => host.evaluate(() => !audio.paused)).toBe(true);
  console.log(`▶ z telefonu do gospodarza: ${Date.now() - t0} ms`);
  await host.evaluate(() => endGame());
  await host.click('#btn-end-menu');
  await ania.waitForSelector('text=Rozłączono', { timeout: 15000 });
  expect(host.errors).toEqual([]);
  expect(ania.errors).toEqual([]);
});
