import { test, expect, ready, screen } from './fixtures.mjs';

// multiplayer na jednym urządzeniu (bez telefonów): lobby → wybór trybu → gra → co dalej
async function lobby(page, n = 3) {
  await page.goto('/');
  await page.click('#btn-multi');
  for (let i = 1; i < n; i++) await page.click('#btn-lobby-add');
  await page.click('#btn-lobby-next');
}

test('lobby i wybór trybu: tryby multiplayer, za mało graczy – wyszarzone', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-multi');
  await page.click('#btn-lobby-next');
  expect(await page.locator('.mode[data-mode=buzz]').isDisabled()).toBe(true);
  await page.click('#btn-modes-back');
  await page.click('#btn-lobby-add');
  await page.click('#btn-lobby-next');
  expect(await page.locator('.mode[data-mode=buzz]').isDisabled()).toBe(false);
  const modes = await page.$$eval('#screen-modes .mode:not(.hidden)', (x) => x.map((y) => y.dataset.mode));
  expect(modes).toEqual(expect.arrayContaining(['multi', 'teams', 'party', 'duel', 'melody', 'steps', 'buzz']));
});

test('oś czasu multiplayer: wyzwanie – pretendent trafia, gracz się myli', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=multi]');
  await page.click('#btn-start');
  await ready(page);
  // gracz kładzie kartę w złym miejscu, pretendent – w dobrym
  await page.evaluate(() => {
    const tl = activePlayer().timeline;
    // ten sam rok na osi i w nowej karcie – oba miejsca byłyby dobre
    if (tl.some((c) => c.y === state.current.y)) tl.forEach((c) => { c.y = state.current.y - 5; });
    const good = correctSlot(tl, state.current.y);
    onSlotClick(good === 0 ? 1 : 0);
  });
  await page.click('#actions button.gold');
  await page.click('#actions button.gold'); // imię pretendenta
  const challenger = await page.evaluate(() => state.challenger);
  await page.evaluate(() => onSlotClick(correctSlot(activePlayer().timeline, state.current.y)));
  await page.click('#actions button.primary');
  await expect.poll(() => page.evaluate(() => state.phase)).toBe('revealed');
  expect(await page.evaluate((c) => state.players[c].timeline.length, challenger)).toBe(2);
});

test('drużyny: gracze z lobby podzieleni na dwie drużyny', async ({ page }) => {
  await lobby(page, 4);
  await page.click('.mode[data-mode=teams]');
  const rows = await page.$$eval('#players-list .player-row', (x) => x.map((r) => r.querySelector('.p-members').value));
  expect(rows).toHaveLength(2);
  expect(rows.join(',').split(',').map((s) => s.trim()).filter(Boolean)).toHaveLength(4);
});

test('impreza: punkty za miejsca, potem „jeszcze raz” od razu startuje grę', async ({ page }) => {
  await lobby(page, 3);
  await page.evaluate(() => store.set('partyGames', ['duel', 'melody']));
  await page.click('.mode[data-mode=party]');
  await page.fill('#party-games', '2');
  await page.click('#btn-start');
  await ready(page);
  await page.evaluate(() => { state.players[0].score = 3; state.players[1].score = 1; endGame(); });
  await expect(page.locator('.party-standings li').first()).toContainText('3 pkt');
  await page.click('#btn-party-next');
  await ready(page);
  await page.evaluate(() => { state.players[0].score = 2; endGame(); });
  await expect(page.locator('#end-multi')).toBeVisible();
  await expect(page.locator('#winner-title')).toContainText('6 pkt');
  await page.click('#btn-end-same');
  await ready(page);
  expect(await page.evaluate(() => !!state.party && state.party.idx)).toBe(0);
});

test('po grze: inny tryb i menu główne', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=melody]');
  await page.fill('#rounds', '1');
  await page.click('#btn-start');
  await ready(page);
  await page.evaluate(() => endGame());
  await page.click('#btn-end-other');
  expect(await screen(page)).toBe('modes');
  await page.click('.mode[data-mode=duel]');
  await page.click('#btn-start');
  await ready(page);
  await page.evaluate(() => endGame());
  await page.click('#btn-end-menu');
  expect(await screen(page)).toBe('home');
});

test('przycisk ← i systemowe „wstecz”', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#btn-nav-back')).toBeHidden();
  await page.click('#btn-single');
  await page.click('.mode[data-mode=melody]');
  await page.goBack();
  await expect.poll(() => screen(page)).toBe('modes');
  await page.click('#btn-nav-back');
  await expect.poll(() => screen(page)).toBe('home');
});

test('uczciwy „Kto pierwszy?”: zgłoszenie z wolniejszego telefonu wcześniejsze o opóźnienie sieci wygrywa', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=buzz]');
  await page.click('#btn-start');
  await ready(page);
  const winner = await page.evaluate(async () => {
    // udawany telefon gracza 2 z czasem odpowiedzi 400 ms (opóźnienie w jedną stronę ok. 200 ms)
    const fake = { role: 'player', name: state.players[1].name, rtt: 400, seen: Date.now(), conn: { open: true, send() {} } };
    remotes.add(fake);
    requestBuzz(0); // gracz 1 na tym urządzeniu
    await new Promise((r) => setTimeout(r, 100));
    requestBuzz(1, fake.rtt / 2); // dotarło 100 ms później, ale naciśnięte ok. 100 ms wcześniej
    await new Promise((r) => setTimeout(r, 600));
    remotes.delete(fake);
    return state.buzz.answering;
  });
  expect(winner).toBe(1);
});

test('„Kto pierwszy?” bez telefonów: zgłoszenie od razu', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=buzz]');
  await page.click('#btn-start');
  await ready(page);
  expect(await page.evaluate(() => { requestBuzz(1); return state.buzz.answering; })).toBe(1);
});

test('współpraca: wspólna oś, odpowiadają po kolei, wspólne pomyłki', async ({ page }) => {
  await lobby(page, 3);
  await page.click('.mode[data-mode=coop]');
  await page.fill('#lives', '2');
  await page.click('#btn-start');
  await ready(page);
  expect(await page.evaluate(() => [state.mode, state.coop, state.players.length, state.players[0].members.length])).toEqual(['solo', true, 1, 3]);
  const first = await page.evaluate(() => answering(activePlayer()));
  // pomyłka
  await page.evaluate(() => { const tl = activePlayer().timeline; const good = correctSlot(tl, state.current.y); onSlotClick(good === 0 ? 1 : 0); });
  await page.click('#actions button.primary');
  await expect.poll(() => page.evaluate(() => activePlayer().lives)).toBe(1);
  await page.click('#actions button.primary >> nth=-1');
  await ready(page);
  expect(await page.evaluate(() => answering(activePlayer()))).not.toBe(first);
  await expect(page.locator('#turn-title')).toContainText('odpowiada');
});

test('liga wieczoru: punkty za miejsca w kolejnych grach', async ({ page }) => {
  await lobby(page, 2);
  for (const k of [0, 1]) {
    await page.click('.mode[data-mode=duel]');
    await page.click('#btn-start');
    await ready(page);
    await page.evaluate(() => { state.players[0].score = 2; state.players[1].score = 1; endGame(); });
    if (k === 0) await page.click('#btn-end-other');
  }
  const rows = await page.$$eval('.league-standings li', (x) => x.map((y) => y.textContent));
  expect(rows[0]).toContain('6 pkt');
  expect(rows[1]).toContain('4 pkt');
  await expect(page.locator('.league-box h3')).toContainText('2 grach');
});

test('bingo: plansze 3×3, trafione pole skreślone, trzy w linii kończą grę', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=bingo]');
  // bez limitu piosenek – gra trwa, aż ktoś ma BINGO
  await expect(page.locator('#rounds')).toBeHidden();
  await page.click('#btn-start');
  await ready(page);
  await expect(page.locator('#bingo-boards .bingo-board')).toHaveCount(2);
  await expect(page.locator('#bingo-boards .bingo-board >> nth=0 >> .bingo-cell')).toHaveCount(9);
  // gracz 1 wybiera pole pasujące do piosenki, gracz 2 – niepasujące (jeśli takie ma)
  const pick = await page.evaluate(() => {
    const b0 = state.bingo.boards[0]; const b1 = state.bingo.boards[1];
    const okCell = b0.cells.findIndex((id) => state.bingo.cats[id].test(state.current));
    const badCell = b1.cells.findIndex((id) => !state.bingo.cats[id].test(state.current));
    return { okCell, badCell };
  });
  test.skip(pick.okCell < 0, 'żadne pole nie pasuje do wylosowanej piosenki');
  await page.click(`#bingo-boards .bingo-board >> nth=0 >> .bingo-cell >> nth=${pick.okCell}`);
  if (pick.badCell >= 0) await page.click(`#bingo-boards .bingo-board >> nth=1 >> .bingo-cell >> nth=${pick.badCell}`);
  await page.click('#actions button.primary');
  await expect.poll(() => page.evaluate(() => state.players[0].score)).toBe(1);
  expect(await page.evaluate(() => state.players[1].score)).toBe(0);
  // trzy w linii → BINGO i koniec gry
  await page.evaluate(() => { const b = state.bingo.boards[1]; b.marked = [true, true, false, false, false, false, false, false, false]; state.turnsPlayed = 99; });
  await expect(page.locator('#actions button.primary')).toHaveText(/Następna piosenka/);
  await page.click('#actions button.primary');
  await ready(page);
  await page.evaluate(() => { const b = state.bingo.boards[1]; b.pick = 2; state.bingo.cats[b.cells[2]].test = () => true; bingoReveal(); });
  await expect(page.locator('#reveal')).toContainText('BINGO');
  await page.click('#actions button.primary');
  await expect(page.locator('#winner-title')).toContainText('BINGO');
});

test('wyzwanie „wszyscy naraz”: kartę bierze pierwszy, kto trafił', async ({ page }) => {
  await lobby(page, 3);
  await page.click('.mode[data-mode=multi]');
  await page.check('input[name=challenge][value=all]');
  await page.click('#btn-start');
  await ready(page);
  const info = await page.evaluate(() => {
    const tl = activePlayer().timeline;
    tl.push({ y: 1950, t: 'X', a: 'Y' }, { y: 2020, t: 'Z', a: 'W' });
    tl.sort((a, b) => a.y - b.y);
    render();
    const good = correctSlot(tl, state.current.y);
    const bad = [0, 1, 2, 3].filter((i) => !placeIsCorrect(tl, i, state.current.y));
    return { good, bad, turn: state.turn };
  });
  test.skip(info.bad.length < 2, 'za mało złych miejsc w tym rozdaniu');
  await page.evaluate((b) => onSlotClick(b), info.bad[0]);
  await page.click('#actions button.gold'); // ⚔ Wyzwanie
  // dwóch wyzywających: pierwszy pudłuje, drugi trafia
  const others = await page.evaluate((t) => state.players.map((p, i) => i).filter((i) => i !== t), info.turn);
  await page.evaluate(([i]) => { state.players[i].tokens -= 1; state.challenges.push({ i, slot: null }); state.challenger = i; }, [others[0]]);
  await page.evaluate((b) => onSlotClick(b), info.bad[1]);
  await page.evaluate(([i]) => { state.players[i].tokens -= 1; state.challenges.push({ i, slot: null }); state.challenger = i; }, [others[1]]);
  await page.evaluate((g) => onSlotClick(g), info.good);
  await page.evaluate(() => revealTimeline());
  expect(await page.evaluate((i) => state.players[i].timeline.length, others[1])).toBe(2);
  expect(await page.evaluate((i) => state.players[i].timeline.length, others[0])).toBe(1);
});

test('drużyny: losowanie i przenoszenie gracza stuknięciem', async ({ page }) => {
  await lobby(page, 4);
  await page.click('.mode[data-mode=teams]');
  await expect(page.locator('#team-board .team-col')).toHaveCount(2);
  await page.click('#team-board button:has-text("Losuj")');
  const total = await page.$$eval('#team-board .team-chips .chip', (x) => x.length);
  expect(total).toBe(4);
  const first = (await page.textContent('#team-board .team-col >> nth=0 >> .chip >> nth=0')).trim();
  await page.click('#team-board .team-col >> nth=0 >> .chip >> nth=0');
  await page.click('#team-board .team-col >> nth=1');
  await expect(page.locator('#team-board .team-col >> nth=1 >> .chip', { hasText: first })).toHaveCount(1);
  expect(await page.inputValue('#players-list .player-row >> nth=1 >> .p-members')).toContain(first);
});

test('impreza: punktacja „suma punktów” i dłuższe minigry', async ({ page }) => {
  await lobby(page, 2);
  await page.evaluate(() => store.set('partyGames', ['duel']));
  await page.click('.mode[data-mode=party]');
  await page.check('input[name=party-len][value="3"]');
  await page.check('input[name=party-score][value=sum]');
  await page.fill('#party-games', '2');
  await page.click('#btn-start');
  await ready(page);
  expect(await page.evaluate(() => state.rounds)).toBe(6);
  await page.evaluate(() => { state.players[0].score = 5; state.players[1].score = 2; endGame(); });
  await expect(page.locator('.party-standings li').first()).toContainText('5 pkt');
  await expect(page.locator('.party-standings li').nth(1)).toContainText('2 pkt');
});

test('najciekawsze momenty na podsumowaniu', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=duel]');
  await page.click('#btn-start');
  await ready(page);
  await page.evaluate(() => {
    const songs = window.SONGS.slice(0, 6);
    state.history = songs.map((song, i) => ({ song, player: state.players[i % 2 ? 1 : 0].name, ok: i % 2 === 0, note: '' }));
    endGame();
  });
  await expect(page.locator('.moments-box li').first()).toBeVisible();
  await expect(page.locator('.moments-box')).toContainText('Najstarsza piosenka');
});

for (const n of [4, 5]) {
  test(`bingo ${n}×${n}: plansza z ${n * n} polami, BINGO po pełnym wierszu`, async ({ page }) => {
    await lobby(page, 2);
    await page.click('.mode[data-mode=bingo]');
    await page.check(`input[name=bingo-size][value="${n}"]`);
    await page.click('#btn-start');
    await ready(page);
    expect(await page.evaluate(() => state.bingo.n)).toBe(n);
    await expect(page.locator('#bingo-boards .bingo-board >> nth=0 >> .bingo-cell')).toHaveCount(n * n);
    // różne kategorie na planszy i siatka n kolumn
    expect(await page.evaluate(() => new Set(state.bingo.boards[0].cells).size)).toBe(n * n);
    const cols = await page.locator('#bingo-boards .bingo-grid >> nth=0').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(n);
    // brakuje jednego pola w pierwszym wierszu – po jego trafieniu BINGO
    await page.evaluate((k) => {
      const b = state.bingo.boards[1];
      b.marked = b.marked.map((m, i) => i < k - 1);
      b.pick = k - 1; state.bingo.cats[b.cells[k - 1]].test = () => true; bingoReveal();
    }, n);
    await expect(page.locator('#reveal')).toContainText('BINGO');
  });
}

test('karty specjalne: tarcza, mgła, złoty strzał i magnes', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=multi]');
  await page.click('#btn-start');
  await ready(page);
  const placeGood = () => page.evaluate(() => onSlotClick(correctSlot(activePlayer().timeline, state.current.y)));
  // złoty strzał: pole roku, dokładny rok = +2 żetony
  await page.evaluate(() => { state.special = 'golden'; render(); });
  await expect(page.locator('#guess-year')).toBeVisible();
  const t0 = await page.evaluate(() => activePlayer().tokens);
  await page.evaluate(() => { $('#guess-year').value = String(state.current.y); });
  await placeGood();
  await page.click('#actions button.primary');
  await expect.poll(() => page.evaluate(() => state.phase)).toBe('revealed');
  expect(await page.evaluate(() => activePlayer().tokens)).toBe(Math.min(5, t0 + 2));
  await expect(page.locator('#reveal')).toContainText('Złoty strzał');
  // tarcza chroni przed kradzieżą żetonu
  const r = await page.evaluate(() => {
    const [a, b] = state.players;
    a.shield = true; a.tokens = 4; b.tokens = 1;
    state.special = 'steal';
    const line = applySpecial(b).textContent;
    return { line, a: a.tokens, b: b.tokens, shield: a.shield };
  });
  expect(r).toEqual({ line: expect.stringContaining('Tarcza'), a: 4, b: 1, shield: false });
  // mgła: znacznik przy graczu do jego następnej tury; magnes: darmowa karta z rokiem
  const m = await page.evaluate(() => {
    const p = state.players[1];
    state.special = 'fog'; applySpecial(p);
    const fog = p.fogUntil > state.turnsPlayed;
    const before = p.timeline.length;
    state.special = 'magnet'; applySpecial(p);
    return { fog, added: p.timeline.length - before, start: p.timeline.some((c) => c.start) };
  });
  expect(m).toEqual({ fog: true, added: 1, start: true });
});

test('Ostatni na placu boju: największa pomyłka traci serce, wygrywa ostatni', async ({ page }) => {
  await lobby(page, 3);
  await page.click('.mode[data-mode=royale]');
  await page.click('#btn-start');
  await ready(page);
  await expect(page.locator('#scoreboard')).toContainText('❤️❤️❤️');
  await expect(page.locator('#actions .royale-row')).toHaveCount(3);
  const y = await page.evaluate(() => state.current.y);
  const rows = page.locator('#actions .royale-row');
  // gracz 1 – dokładnie, gracz 2 – o 2 lata, gracz 3 – o 10 lat (w przeszłość, gdy rok +10 byłby w przyszłości)
  const far = y + 10 > new Date().getFullYear() ? y - 10 : y + 10;
  for (const [i, v] of [[0, y], [1, y - 2], [2, far]]) {
    await rows.nth(0).locator('input').fill(String(v));
    await rows.nth(0).locator('button').click();
    if (i < 2) await expect(page.locator('#actions .royale-row')).toHaveCount(2 - i);
  }
  await expect.poll(() => page.evaluate(() => state.phase)).toBe('revealed');
  expect(await page.evaluate(() => state.players.map((p) => p.hearts))).toEqual([3, 3, 2]);
  await expect(page.locator('#reveal')).toContainText('💔');
  // dwóch graczy z jednym sercem nie odpowiada → odpadają, wygrywa pierwszy
  await page.click('#actions button.primary');
  await ready(page);
  await page.evaluate(() => { state.players[1].hearts = 1; state.players[2].hearts = 1; royaleAnswer(0, state.current.y); royaleReveal(); });
  await expect(page.locator('#reveal')).toContainText('Odpada');
  await page.click('#actions button.primary');
  await expect.poll(() => screen(page)).toBe('end');
  await expect(page.locator('#winner-title')).toContainText('Ostatni na placu boju');
});

test('Licytacja sekund: licytacja w dół, najkrótsza stawka gra; trafienie +2, pudło +1 dla poprzedniego', async ({ page }) => {
  await lobby(page, 3);
  await page.click('.mode[data-mode=seconds]');
  await page.fill('#rounds', '2');
  await page.click('#btn-start');
  await page.waitForFunction(() => state.current && state.secs && state.phase === 'listen', null, { timeout: 30000 });
  await expect(page.locator('#btn-play')).toBeDisabled();
  await expect(page.locator('#hint')).toContainText('Rok:');
  const first = await page.evaluate(() => state.turn);
  await page.click('#actions .secs-bid >> text="4 s"');
  const second = await page.evaluate(() => state.turn);
  expect(second).not.toBe(first);
  await page.click('#actions .secs-bid >> text="2 s"');
  // trzeci i pierwszy pasują – gra drugi za 2 s
  await page.click('#actions button.ghost >> text=Pas');
  await page.click('#actions button.ghost >> text=Pas');
  await expect.poll(() => page.evaluate(() => state.secs.phase)).toBe('play');
  expect(await page.evaluate(() => [state.turn, state.clipLen])).toEqual([second, 2]);
  await expect(page.locator('#btn-play')).toBeEnabled();
  await expect(page.locator('#guess-song')).toBeVisible();
  // pudło – punkt dla poprzedniego licytującego (pierwszego)
  await page.fill('#guess-song', 'zupełnie nie ten tytuł xyz');
  await page.press('#guess-song', 'Enter');
  await expect.poll(() => page.evaluate(() => state.phase)).toBe('revealed');
  expect(await page.evaluate((i) => state.players[i].score, first)).toBe(1);
  expect(await page.evaluate((i) => state.players[i].score, second)).toBe(0);
});

test('Gorąca bomba: dobra odpowiedź podaje bombę dalej, zła blokuje, wybuch zabiera serce', async ({ page }) => {
  await lobby(page, 3);
  await page.click('.mode[data-mode=bomb]');
  await page.click('#btn-start');
  await page.waitForFunction(() => state.current && state.bomb && state.phase === 'listen', null, { timeout: 30000 });
  // bomba rusza sama, razem z muzyką (bez przycisku Start)
  await expect.poll(() => page.evaluate(() => state.bomb.phase)).toBe('run');
  expect(await page.evaluate(() => !audio.paused && state.bomb.startedAt > 0)).toBe(true);
  await expect(page.locator('#actions button.big-choice')).toHaveCount(2);
  const holder = await page.evaluate(() => state.turn);
  await page.evaluate(() => bombAnswer(state.bomb.q.options.findIndex((o) => o.ok)));
  expect(await page.evaluate(() => state.turn)).not.toBe(holder);
  // zła odpowiedź – blokada (przyciski wyłączone)
  await page.evaluate(() => bombAnswer(state.bomb.q.options.findIndex((o) => !o.ok)));
  await expect(page.locator('#actions button.big-choice').first()).toBeDisabled();
  // wybuch
  const now = await page.evaluate(() => state.turn);
  await page.evaluate(() => { state.bomb.explodeAt = Date.now() - 1; bombTick(); });
  await expect.poll(() => page.evaluate(() => state.phase)).toBe('revealed');
  expect(await page.evaluate((i) => state.players[i].hearts, now)).toBe(2);
  await expect(page.locator('#reveal')).toContainText('Bomba wybuchła');
  await expect(page.locator('#scoreboard')).toContainText('❤️❤️');
});

test('Gorąca bomba: koniec fragmentu przed wybuchem – od razu następna piosenka i nowe pytanie', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=bomb]');
  await page.click('#btn-start');
  await page.waitForFunction(() => state.bomb && state.bomb.phase === 'run' && !audio.paused, null, { timeout: 30000 });
  const first = await page.evaluate(() => { state.bomb.explodeAt = Date.now() + 60000; return songKey(state.current); });
  // fragment dobiega końca
  await page.evaluate(() => { audio.currentTime = state.clipStart + state.clipLen - 0.5; });
  await page.waitForFunction((k) => songKey(state.current) !== k && !audio.paused, first, { timeout: 30000 });
  const r = await page.evaluate(() => ({ phase: state.phase, bomb: state.bomb.phase, q: state.bomb.q && state.bomb.q.options.length, t: audio.currentTime, hist: state.history.length }));
  expect(r).toMatchObject({ phase: 'listen', bomb: 'run', q: 2, hist: 1 });
  expect(r.t).toBeLessThan(10);
});

test('Gorąca bomba: dużo rodzajów pytań, każde z dwiema odpowiedziami i jedną prawdziwą', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => loadFacts());
  await page.waitForFunction(() => !!window.SONG_FACTS);
  const r = await page.evaluate(() => {
    state.bomb = { recent: [] };
    const kinds = new Map();
    const bad = [];
    const songs = shuffle(window.SONGS.slice()).slice(0, 600);
    for (const s of songs) {
      for (const [kind, f] of Object.entries(BOMB_QUESTIONS)) {
        const q = f(s);
        if (!q) continue;
        if (q.options.length !== 2 || q.options.filter((o) => o && o.ok).length !== 1 || !q.q) bad.push(`${kind}: ${s.t}`);
        kinds.set(kind, (kinds.get(kind) || 0) + 1);
      }
    }
    // kilka pytań sprawdzanych z danymi piosenki
    const check = [];
    const s = window.SONGS.find((x) => x.y === 1984 && x.c === 'PL');
    const yes = (q) => q.options.find((o) => o.ok).label;
    check.push(yes(BOMB_QUESTIONS.exact(s)) === '1984');
    check.push(yes(BOMB_QUESTIONS.century(s)) === 'XX wiek');
    check.push(yes(BOMB_QUESTIONS.pl(s)) === 'Polska');
    const w = window.SONGS.find((x) => x.t === 'Chodź, Pomaluj Mój Świat');
    check.push(yes(BOMB_QUESTIONS.words(w)) === '4');
    check.push(yes(BOMB_QUESTIONS.letter(w)) === 'C');
    // kolejne pytania o tę samą piosenkę – różne rodzaje
    state.bomb = { recent: [] };
    const seq = Array.from({ length: 6 }, () => (state.bomb.q = bombQuestion(w)).kind);
    return { kinds: [...kinds.keys()], bad, check, seq };
  });
  expect(r.bad).toEqual([]);
  expect(r.kinds.length).toBeGreaterThanOrEqual(18);
  expect(r.check).toEqual([true, true, true, true, true]);
  expect(new Set(r.seq).size).toBe(6);
});

test('Turniej: 3 graczy – wolny los, mecz, finał i zwycięzca', async ({ page }) => {
  await lobby(page, 3);
  await page.click('.mode[data-mode=tour]');
  await page.selectOption('#tour-game', 'artist');
  await page.click('#btn-start');
  await ready(page);
  const first = await page.evaluate(() => ({ round: state.tour.rounds[0].map((m) => [m.a, m.b]), players: state.players.map((p) => p.name) }));
  // drabinka na 4 miejsca: jedna para z wolnym losem, w meczu gra dwóch graczy
  expect(first.round.filter(([, b]) => b == null)).toHaveLength(1);
  expect(first.players).toHaveLength(2);
  const play = async () => {
    // wygrywa zawsze pierwszy gracz meczu
    while ((await screen(page)) === 'game') {
      await page.evaluate(() => { const m = state.tour.rounds.at(-1).find((x) => !x.w); const ok = activePlayer().name === m.a; answerQuiz(state.quiz.options.findIndex((o) => o.ok === ok)); });
      await page.click('#actions button.primary');
      await page.waitForTimeout(200);
    }
  };
  await play();
  await expect(page.locator('#winner-title')).toContainText('przechodzi dalej');
  await expect(page.locator('.tour-box')).toContainText('Finał');
  await page.click('#btn-party-next');
  await ready(page);
  await play();
  const champ = await page.evaluate(() => state.tour.champion);
  await expect(page.locator('#winner-title')).toContainText(`Turniej wygrywa ${champ}`);
  await expect(page.locator('#end-party')).toBeHidden();
});

test('Pojedynek na żywo: szybsza dobra odpowiedź – 2 pkt, wolniejsza – 1 pkt, gra do 10', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=live]');
  await page.click('#btn-start');
  await ready(page);
  await expect(page.locator('#actions .live-row')).toHaveCount(2);
  const right = await page.evaluate(() => state.live.options.findIndex((o) => o.ok));
  // gracz 2 odpowiada pierwszy (dobrze), gracz 1 – później (dobrze)
  await page.locator('#actions .live-row').nth(1).locator('button').nth(right).click();
  await page.waitForTimeout(150);
  await page.locator('#actions .live-row').nth(0).locator('button').nth(right).click();
  await expect.poll(() => page.evaluate(() => state.phase)).toBe('revealed');
  expect(await page.evaluate(() => state.players.map((p) => p.score))).toEqual([1, 2]);
  // zła odpowiedź – 0, do 10 pkt koniec gry
  await page.click('#actions button.primary');
  await ready(page);
  await page.evaluate(() => { state.players[0].score = 9; const r = state.live.options.findIndex((o) => o.ok); liveAnswer(0, r); liveAnswer(1, (r + 1) % 4); });
  expect(await page.evaluate(() => state.players.map((p) => p.score))).toEqual([11, 2]);
  await page.click('#actions button.primary');
  await expect.poll(() => screen(page)).toBe('end');
  await expect(page.locator('#winner-title')).toContainText('Gracz 1');
});

test('Turniej: pominięty mecz bez wyniku i bez dogrywki – awans losowy, turniej idzie dalej', async ({ page }) => {
  await lobby(page, 3);
  await page.click('.mode[data-mode=tour]');
  await page.selectOption('#tour-game', 'artist');
  await page.click('#btn-start');
  await ready(page);
  await expect(page.locator('#btn-mini-skip')).toBeVisible();
  await page.click('#btn-mini-skip');
  await expect.poll(() => screen(page)).toBe('end');
  const m = await page.evaluate(() => state.tour.rounds[0].find((x) => x.b != null));
  expect(m.score).toBe('pominięty');
  expect([m.a, m.b]).toContain(m.w);
  await expect(page.locator('#end-party')).toBeVisible();
  await expect(page.locator('.tour-box')).toContainText('Finał');
});

test('żetony: ikonka i liczba („🪙 3”) w tytule tury, tablicy wyników i osiach innych graczy', async ({ page }) => {
  await lobby(page, 2);
  await page.click('.mode[data-mode=multi]');
  await page.click('#btn-start');
  await ready(page);
  await page.evaluate(() => { state.players.forEach((p, i) => { p.tokens = i + 3; }); state.showAll = true; render(); });
  const t = await page.evaluate(() => state.players[state.turn].tokens);
  await expect(page.locator('#turn-info')).toHaveText(`Żetony: 🪙 ${t}`);
  await expect(page.locator('#scoreboard .score .tokens')).toHaveText(['🪙 3', '🪙 4']);
  await expect(page.locator('#others .other-head .tokens')).toHaveText([`🪙 ${7 - t}`]);
  // na przyciskach koszt jako ikonka zamiast słowa „żeton”
  await expect(page.locator('#btn-skip')).toHaveText('⏭ Pomiń (🪙 1)');
  await expect(page.getByRole('button', { name: 'Kup tę kartę (🪙 3)' })).toBeVisible();
});

test('duży ekran: wyniki po grze bez powtórzeń (tabela ligi i momenty idą osobno)', async ({ page }) => {
  await lobby(page, 3);
  await page.click('.mode[data-mode=melody]');
  await page.fill('#rounds', '1');
  await page.click('#btn-start');
  await ready(page);
  await page.evaluate(() => endGame());
  expect(await screen(page)).toBe('end');
  // przechwycenie migawki wysyłanej do dużego ekranu (kanał w tej samej przeglądarce)
  const snap = await page.evaluate(() => {
    let last = null;
    tvChannel = { postMessage: (m) => { if (m && m.screen) last = m; } };
    tvSync();
    return last;
  });
  expect(snap.ranking).toHaveLength(3);
  expect(snap.league.length).toBeGreaterThan(0);
});
