import { test, expect, ready } from './fixtures.mjs';

// Impreza w wyglądzie 6.0 – teleturniej: zapowiedź rundy, modyfikatory, tablica wyników, finał „Ostatnie odliczanie”
async function party(page, { ui6 = true, n = 3, games = ['duel', 'melody'], count = 3 } = {}) {
  await page.goto('/');
  await page.evaluate((on) => localStorage.setItem('songster.ui6', on ? '1' : '0'), ui6);
  await page.reload();
  await page.evaluate((g) => store.set('partyGames', g), games);
  if (n > 1) {
    await page.click('#btn-multi');
    for (let i = 1; i < n; i++) await page.click('#btn-lobby-add');
    await page.click('#btn-lobby-next');
  } else await page.click('#btn-single');
  await page.click('.mode[data-mode=party]');
  await page.evaluate((c) => { document.querySelector('#party-games').value = String(c); document.querySelector('#btn-start').click(); }, count);
}
// plansza zapowiedzi → „Zaczynamy!” → bez czekania na odliczanie
async function go(page) {
  await expect(page.locator('#p6[data-kind=intro]')).toBeVisible();
  await page.click('#p6 .p6-go');
  await page.click('#p6 .p6-acts .ghost');
  await expect(page.locator('#p6')).toBeHidden();
  await ready(page);
}

test('6.0 impreza: zapowiedź rundy, tablica wyników, podwójna stawka i finał – kto spadnie, odpada', async ({ page }) => {
  await party(page);
  const intro = page.locator('#p6[data-kind=intro]');
  await expect(intro).toBeVisible();
  await expect(intro.locator('.p6-round')).toHaveText('Runda 1 z 3');
  await expect(intro.locator('.p6-mod')).toContainText('Runda otwierająca');
  await expect(intro.locator('.p6-host')).toContainText('Gracz 1');
  const name = await page.evaluate(() => T(PARTY_GAMES[state.party.plan[0]].name));
  await expect(intro.locator('.p6-name')).toHaveText(name);
  await expect(intro.locator('.p6-rule')).not.toBeEmpty();
  // gra nie startuje przed „Zaczynamy!”
  expect(await page.evaluate(() => state.players.length && state.phase === 'listen' && !document.querySelector('#screen-game').classList.contains('hidden'))).toBeFalsy();
  // odliczanie 3-2-1 i start minigry
  await page.click('#p6 .p6-go');
  await expect(page.locator('#p6 .p6-count')).toHaveText(/[123]/);
  await expect(page.locator('#p6')).toBeHidden({ timeout: 5000 });
  await ready(page);
  await page.evaluate(() => { state.players[0].score = 3; state.players[1].score = 1; endGame(); });
  // tablica wyników po rundzie
  const board = page.locator('#p6[data-kind=board]');
  await expect(board).toBeVisible();
  await expect(board.locator('.p6-row').first()).toContainText('Gracz 1');
  await expect(board.locator('.p6-row').first().locator('.p6-pts-n')).toHaveText('3');
  await expect(board.locator('.p6-host')).not.toBeEmpty();
  // przedostatnia runda – podwójna stawka
  await board.locator('.p6-next').click();
  await expect(page.locator('#p6[data-kind=intro] .p6-mod.hot')).toContainText('Podwójna stawka');
  await go(page);
  await expect(page.locator('#party-bar')).toHaveAttribute('data-mod', /Podwójna stawka/);
  await page.evaluate(() => { state.players.forEach((p) => { p.score = 0; }); state.players[1].score = 2; endGame(); });
  expect(await page.evaluate(() => state.party.points)).toEqual([3, 8, 0]);
  await expect(page.locator('#p6 .p6-note')).toContainText('razy dwa');
  await page.click('#p6 .p6-next');
  await go(page);
  await page.evaluate(() => { state.players.forEach((p) => { p.score = 0; }); endGame(); });
  // po ostatniej rundzie impreza jeszcze trwa – finał
  expect(await page.evaluate(() => state.party.done)).toBe(false);
  await expect(page.locator('#p6 .p6-next')).toContainText('Finał');
  await page.click('#p6 .p6-next');
  const fin = page.locator('#p6[data-kind=final]');
  await expect(fin).toBeVisible();
  await expect(fin.locator('.p6-pillar')).toHaveCount(3);
  // punkty imprezy → sekundy: więcej punktów – wyższy podest
  const secs = await page.evaluate(() => party6.fin.secs.slice());
  expect(secs[1]).toBeGreaterThan(secs[0]);
  expect(secs[0]).toBeGreaterThan(secs[2]);
  await page.click('#p6 .p6-go');
  await expect(page.locator('#p6 .p6-opt').first()).toBeVisible({ timeout: 5000 });
  // dobra odpowiedź podnosi, zła obniża
  const before = await page.evaluate(() => { const f = party6.fin; return [f.q.who, f.secs[f.q.who]]; });
  await page.evaluate(() => party6.answer(party6.fin.q.options.findIndex((o) => o.ok)));
  expect(await page.evaluate((w) => party6.fin.secs[w], before[0])).toBeGreaterThan(before[1]);
  await expect(page.locator('#p6 .p6-opt.ok')).toHaveCount(1);
  // Gracz 3 spada pierwszy, potem Gracz 1 – wygrywa Gracz 2
  await page.evaluate(() => { party6.fin.secs[2] = 0.05; });
  await expect(page.locator('#p6 .p6-pillar[data-i="2"]')).toHaveClass(/out/);
  await page.evaluate(() => { party6.fin.secs[0] = 0.05; });
  const podium = page.locator('#p6[data-kind=podium]');
  await expect(podium).toBeVisible();
  await expect(podium.locator('.p6-title')).toContainText('Gracz 2 wygrywa imprezę');
  await podium.locator('.p6-go').click();
  await expect(page.locator('#p6')).toBeHidden();
  await expect(page.locator('#winner-title')).toContainText('Imprezę wygrywa Gracz 2');
  expect(await page.evaluate(() => [state.party.done, state.party.finalRank])).toEqual([true, [1, 0, 2]]);
  await expect(page.locator('.party-standings li').first()).toContainText('Gracz 2');
});

test('6.0 impreza: złodziej punktów – zwycięzca rundy zabiera punkty wybranemu rywalowi', async ({ page }) => {
  await party(page, { count: 4 });
  await go(page);
  await page.evaluate(() => { state.party.mods[1] = 'thief'; state.players[0].score = 3; state.players[1].score = 2; state.players[2].score = 1; endGame(); });
  expect(await page.evaluate(() => state.party.points)).toEqual([3, 2, 1]);
  await page.click('#p6 .p6-next');
  await expect(page.locator('#p6 .p6-mod.hot')).toContainText('Złodziej punktów');
  await go(page);
  await page.evaluate(() => { state.players.forEach((p) => { p.score = 0; }); state.players[2].score = 4; endGame(); });
  // Gracz 3 wygrał rundę (+3) i wybiera ofiarę
  await expect(page.locator('#p6 .p6-victim')).toHaveCount(2);
  await expect(page.locator('#p6 .p6-next')).toBeDisabled();
  await page.click('#p6 .p6-victim:has-text("Gracz 1")');
  expect(await page.evaluate(() => state.party.points)).toEqual([1, 2, 6]);
  await expect(page.locator('#p6 .p6-note')).toContainText('Gracz 3 zabiera 2 pkt');
  await expect(page.locator('#p6 .p6-next')).toBeEnabled();
  await expect(page.locator('.party-standings li').first()).toContainText('Gracz 3 – 6 pkt');
});

test('6.0 impreza: pominięta runda bez punktów, jeden gracz – finał na rekord', async ({ page }) => {
  await party(page, { n: 1, games: ['melody', 'duel'], count: 2 });
  await go(page);
  await page.evaluate(() => { state.party.mods[1] = 'normal'; });
  await page.click('#btn-mini-skip');
  await expect(page.locator('#p6[data-kind=board] .p6-host')).toContainText('Runda pominięta');
  expect(await page.evaluate(() => state.party.points)).toEqual([0]);
  await page.click('#p6 .p6-next');
  await go(page);
  await page.evaluate(() => { state.players[0].score = 2; endGame(); });
  await page.click('#p6 .p6-next');
  await expect(page.locator('#p6[data-kind=final] .p6-chip')).toContainText('Runda na rekord');
  await page.click('#p6 .p6-go');
  await expect(page.locator('#p6 .p6-opt').first()).toBeVisible({ timeout: 5000 });
  await page.evaluate(() => party6.answer(party6.fin.q.options.findIndex((o) => o.ok)));
  await page.evaluate(() => { party6.fin.secs[0] = 0.05; });
  await expect(page.locator('#p6[data-kind=podium] .p6-title')).toContainText('1 dobrych odpowiedzi');
  await page.click('#p6 .p6-go');
  expect(await page.evaluate(() => [state.party.done, state.party.points[0]])).toEqual([true, 3]);
  await expect(page.locator('#winner-title')).toContainText('3 pkt');
});

test('bez 6.0 impreza bez zmian: od razu minigra, bez tablicy i finału', async ({ page }) => {
  await party(page, { ui6: false, count: 2 });
  await ready(page);
  await expect(page.locator('#p6')).toHaveCount(0);
  await page.evaluate(() => { state.players[0].score = 3; endGame(); });
  await expect(page.locator('#end-party')).toBeVisible();
  await page.click('#btn-party-next');
  await ready(page);
  await page.evaluate(() => { state.players[0].score = 1; endGame(); });
  expect(await page.evaluate(() => [state.party.done, state.party.points, !!state.party.mods, !!state.party.finalRank])).toEqual([true, [6, 0, 0], false, false]);
  await expect(page.locator('#winner-title')).toContainText('Imprezę wygrywa Gracz 1 (6 pkt)');
  await expect(page.locator('#p6')).toHaveCount(0);
});
