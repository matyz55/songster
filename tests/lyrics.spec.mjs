import { test, expect, screen } from './fixtures.mjs';

// katalog testowy: 120 polskich piosenek z bazy (tekst i film podstawione w mock.js)
async function startLyrics(page, players = 1) {
  await page.goto('/');
  await page.evaluate(() => {
    const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
    window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [`vid${i}`, 1000 + i, 180]]));
  });
  if (players > 1) {
    await page.click('#btn-multi');
    for (let i = 1; i < players; i++) await page.click('#btn-lobby-add');
    await page.click('#btn-lobby-next');
  } else {
    await page.click('#btn-single');
  }
  await page.click('.mode[data-mode=lyrics]');
  await page.click('#btn-start');
  await expect.poll(() => screen(page)).toBe('lyrics');
}
async function playToGap(page) {
  await page.locator('.ly-cat:not(.done)').first().click();
  // po wyborze kategorii: zamiast kafelków dwie piosenki z rokiem wydania, bez powrotu do innej kategorii
  await expect(page.locator('.ly-cat')).toHaveCount(0);
  await expect(page.locator('.ly-song .ly-year')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Inna kategoria/ })).toHaveCount(0);
  await page.locator('.ly-song').first().click();
  await expect.poll(() => page.evaluate(() => state.phase), { timeout: 20000 }).toBe('answer');
}
const fillCorrect = (page) => page.evaluate(() => {
  const cur = state.lyrics.cur;
  const inp = document.querySelector('#ly-input');
  inp.value = cur.gap.blanks.filter((b, i) => !cur.revealed.has(i)).map((b) => b.want).join(' ');
  inp.dispatchEvent(new Event('input'));
});

test('Tak to leciało!: plansza 9 kategorii, przerwa przed wersem, dobra odpowiedź – 500 zł', async ({ page }) => {
  await startLyrics(page);
  await expect(page.locator('.ly-cat')).toHaveCount(9);
  // zapis wszystkich wersów pokazanych przed przerwą (numery wersów w kluczu okna karaoke)
  await page.evaluate(() => { window.__maxRow = -1; setInterval(() => { if (state.phase !== 'play') return; const k = $('#ly-lines').dataset.key || ''; k.split('|').filter(Boolean).forEach((x) => { window.__maxRow = Math.max(window.__maxRow, parseInt(x, 10)); }); }, 20); });
  await playToGap(page);
  // tekst nie przewija się za przerwę: przed odpowiedzią widać tylko wersy sprzed zagadki
  expect(await page.evaluate(() => window.__maxRow < Math.min(...state.lyrics.cur.gap.lines))).toBe(true);
  // puste pola: cały wers, który wcześniej w piosence nie padł
  const gap = await page.evaluate(() => {
    const c = state.lyrics.cur; const k = (t) => lyKey(t);
    return { n: c.gap.blanks.length, words: c.lines[c.gap.line].text.split(/\s+/).length, before: c.lines.slice(0, c.gap.line).some((l) => k(l.text) === k(c.lines[c.gap.line].text)) };
  });
  await expect(page.locator('.ly-dot')).toHaveCount(gap.n);
  // liczba słów do uzupełnienia – znacznik w wierszu z kategorią i rokiem (znany od startu piosenki)
  await expect(page.locator('#ly-song .ly-words-tag')).toContainText(String(gap.n));
  // układ: „Tak to leciało!” na całą szerokość, pod nim trzy koła ratunkowe, na samym dole źródła
  const order = await page.evaluate(() => [...document.querySelectorAll('#ly-answer > *')].map((e) => e.className));
  expect(order.indexOf('primary ly-submit')).toBeLessThan(order.indexOf('ly-lifebtns'));
  expect(order.at(-1)).toContain('ly-credit');
  await expect(page.locator('.ly-lifebtns button')).toHaveCount(3);
  expect(gap.n).toBe(gap.words);
  expect(gap.before).toBe(false);
  // karaoke: wersy sprzed przerwy, bez wersu do uzupełnienia
  const shown = await page.locator('#ly-lines').textContent();
  expect(shown).not.toContain(await page.evaluate(() => state.lyrics.cur.lines[state.lyrics.cur.gap.line].text));
  await fillCorrect(page);
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await expect(page.locator('#ly-answer .verdict')).toContainText('500 zł');
  // piosenka wraca o dwa wersy, a prawidłowy wers pojawia się, gdy jest śpiewany
  await expect(page.locator('.ly-reveal.go, .ly-reveal.shown')).toHaveCount(1);
  // prawidłowy wers pojawia się w tekście karaoke, gdy piosenka do niego dojdzie
  await expect(page.locator('#ly-lines p.gapline.ok')).toHaveCount(1, { timeout: 15000 });
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.locator('.ly-ladder li.now')).toContainText('1000 zł');
  // zagrana kategoria zostaje na planszy – wyszarzona i niedostępna; hit za 100 000 zł – dopiero na końcu
  await expect(page.locator('.ly-cat')).toHaveCount(9);
  await expect(page.locator('.ly-cat.done')).toHaveCount(1);
  expect(await page.locator('.ly-cat.done').isDisabled()).toBe(true);
  expect(await page.locator('.ly-hit').isDisabled()).toBe(true);
});

test('Tak to leciało!: po 9 kategoriach – hit za 100 000 zł albo rezygnacja z 75 000 zł; pomyłka w finale – 50 000 zł', async ({ page }) => {
  await startLyrics(page);
  await page.evaluate(() => { const p = state.players[0]; p.stage = 9; p.score = 75000; p.board.forEach((c) => { c.done = true; }); lyRender(); });
  expect(await page.locator('.ly-hit').isDisabled()).toBe(false);
  await page.locator('.ly-hit').click();
  await expect(page.getByRole('button', { name: /Rezygnuję – zabieram 75 000/ })).toBeVisible();
  // w finale bez kół ratunkowych
  await page.getByRole('button', { name: /Gram o 100 000/ }).click();
  await expect.poll(() => page.evaluate(() => state.phase), { timeout: 20000 }).toBe('answer');
  await expect(page.locator('.ly-lifebtns')).toHaveCount(0);
  await expect(page.locator('.ly-lifes')).toHaveCount(0);
  await fillCorrect(page);
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await expect(page.locator('#ly-answer .verdict')).toContainText('100 000 zł');
  expect(await page.evaluate(() => lyGuaranteed(10))).toBe(50000);
  expect(await page.evaluate(() => lyGuaranteed(6))).toBe(10000);
  expect(await page.evaluate(() => lyGuaranteed(5))).toBe(0);
});

test('Tak to leciało!: koła ratunkowe – trzy słowa, trzy wersje, wymiana piosenki; pomyłka kończy grę', async ({ page }) => {
  await startLyrics(page);
  await playToGap(page);
  // odsłonięcie słowa: wybór koła, potem stuknięcie pustego pola
  await page.getByRole('button', { name: /Odsłoń słowo \(3\)/ }).click();
  await page.locator('.ly-dot').nth(1).click();
  await expect(page.locator('.ly-dot').nth(1)).toHaveText(await page.evaluate(() => state.lyrics.cur.gap.blanks[1].want));
  expect(await page.evaluate(() => state.players[0].lifes.words)).toBe(2);
  // trzy wersje wersu – jedna prawdziwa
  await page.getByRole('button', { name: /Trzy wersje wersu/ }).click();
  const variants = await page.locator('.ly-variants button').allTextContents();
  expect(variants).toHaveLength(3);
  expect(variants).toContain(await page.evaluate(() => state.lyrics.cur.gap.blanks.map((b) => b.want).join(' ')));
  // wymiana piosenki na drugą z kategorii
  const before = await page.evaluate(() => songKey(state.lyrics.cur.it.song));
  await page.getByRole('button', { name: /Wymiana piosenki/ }).click();
  await expect.poll(() => page.evaluate(() => state.phase), { timeout: 20000 }).toBe('answer');
  expect(await page.evaluate(() => songKey(state.lyrics.cur.it.song))).not.toBe(before);
  // zła odpowiedź – koniec gry (przed 4. etapem bez kwoty gwarantowanej); piosenka po odpowiedzi gra wolniej,
  // żeby wers z przerwą nie minął, zanim test go sprawdzi (przy 40× cała piosenka mija w kilka sekund)
  await page.evaluate(() => { window.__ytSpeed = 3; });
  await page.locator('#ly-input').fill('zupełnie');
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await expect(page.locator('#ly-answer .verdict')).toContainText('0 zł');
  // w kafelkach wpisane słowa (puste miejsca – kreska), prawidłowy wers – w tekście karaoke
  await expect(page.locator('.ly-reveal .ly-word').first()).toHaveText('zupełnie');
  await expect(page.locator('.ly-reveal .ly-word.bad').first()).toBeVisible();
  const line = await page.evaluate(() => state.lyrics.cur.gap.lines.map((i) => state.lyrics.cur.lines[i].text)[0]);
  await expect(page.locator('#ly-lines p.gapline.bad')).toHaveText(line, { timeout: 15000 });
  // zgłoszenie złej wersji – i jego cofnięcie
  await page.getByRole('button', { name: /Zła wersja piosenki/ }).click();
  expect(await page.evaluate(() => store.get('lyBadVideos', []).length)).toBe(1);
  await page.getByRole('button', { name: /Cofnij zgłoszenie/ }).click();
  expect(await page.evaluate(() => [store.get('lyBadVideos', []).length, store.get('lyReports', []).length])).toEqual([0, 0]);
  await page.getByRole('button', { name: /Zła wersja piosenki/ }).click();
  await page.getByRole('button', { name: 'Koniec gry' }).click();
  await expect.poll(() => screen(page)).toBe('end');
  // przywrócenie w ustawieniach
  await page.click('#btn-settings');
  await expect(page.locator('#ly-reports li')).toHaveCount(1);
  await page.locator('#ly-reports button').click();
  await expect(page.locator('#ly-reports-card')).toBeHidden();
  expect(await page.evaluate(() => store.get('lyBadVideos', []).length)).toBe(0);
  await expect(page.locator('#winner-title')).toContainText('bez wygranej');
});

test('Tak to leciało!: film niedostępny – gra sama bierze drugą piosenkę z kategorii', async ({ page }) => {
  await startLyrics(page);
  await page.evaluate(() => { window.__ytFail = [state.players[0].board[0].songs[0].yts[0]]; window.__ytSpeed = 2; });
  await page.locator('.ly-cat').first().click();
  await page.locator('.ly-song').first().click();
  // komunikat między kołami ratunkowymi a źródłami; po chwili znika
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('Gramy inną piosenkę');
  const order = await page.evaluate(() => [...document.querySelectorAll('#ly-answer > *')].map((e) => e.className));
  expect(order.indexOf('muted ly-flash')).toBe(order.length - 2);
  await expect(page.locator('#ly-msg')).toBeHidden();
  await expect(page.locator('#ly-answer .ly-flash')).toHaveCount(0, { timeout: 9000 });
  expect(await page.evaluate(() => state.players[0].lifes.swap)).toBe(true);
});

test('Tak to leciało! (multiplayer): kolejka graczy i pomoc suflera', async ({ page }) => {
  await startLyrics(page, 2);
  const first = await page.evaluate(() => state.turn);
  await playToGap(page);
  await page.locator('.ly-help button').first().click();
  await page.locator('.ly-helper input').fill('podpowiedź testowa');
  await page.locator('.ly-helper button').click();
  await expect(page.locator('.ly-hint')).toContainText('podpowiedź testowa');
  await fillCorrect(page);
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
  expect(await page.evaluate(() => state.turn)).not.toBe(first);
  await expect(page.locator('#ly-scores .score')).toHaveCount(2);
});

test('Tak to leciało!: oba filmy w kategorii niedostępne – gra bierze inną piosenkę z katalogu', async ({ page }) => {
  await startLyrics(page);
  await page.evaluate(() => { window.__ytFail = state.players[0].board[0].songs.map((it) => it.yts[0]); });
  await page.locator('.ly-cat').first().click();
  await page.locator('.ly-song').first().click();
  await expect.poll(() => page.evaluate(() => state.phase), { timeout: 20000 }).toBe('answer');
  expect(await page.evaluate(() => window.__ytFail.includes(state.lyrics.cur.videoId))).toBe(false);
  // niedziałające filmy są zapamiętane i pomijane w następnych grach
  expect(await page.evaluate(() => store.get('lyBadVideos', []).length)).toBe(2);
});

test('Impreza: minigra „Tak to leciało!” – piosenka od zwrotki z przerwą, dobra odpowiedź = 1 pkt', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
    window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [`vid${i}`, 1000 + i, 180]]));
    store.set('partyGames', ['lyrics']);
  });
  await page.click('#btn-single');
  await page.click('.mode[data-mode=party]');
  await page.click('#btn-start');
  await expect.poll(() => page.evaluate(() => state.phase), { timeout: 20000 }).toBe('answer');
  expect(await page.evaluate(() => state.lyrics.mini && state.lyrics.cur.startAt > 0)).toBe(true);
  await fillCorrect(page);
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await expect(page.locator('#ly-answer .verdict')).toContainText('+1');
  expect(await page.evaluate(() => state.players[0].score)).toBe(1);
});

test('Sztafeta karaoke: kilka przerw w jednej piosence, przy każdej odpowiada kolejny gracz', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
    window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [`vid${i}`, 1000 + i, 180]]));
  });
  await page.click('#btn-multi');
  await page.click('#btn-lobby-add');
  await page.click('#btn-lobby-next');
  await page.click('.mode[data-mode=relay]');
  await page.fill('#rounds', '1');
  await page.click('#btn-start');
  await expect.poll(() => screen(page)).toBe('lyrics');
  const turns = [];
  const lines = [];
  for (let k = 0; k < 3; k++) {
    await expect.poll(() => page.evaluate(() => state.phase), { timeout: 20000 }).toBe('answer');
    const info = await page.evaluate(() => ({ turn: state.turn, gi: state.lyrics.cur.gi, n: state.lyrics.cur.gaps.length, line: state.lyrics.cur.gap.line }));
    if (k === 0) expect(info.n).toBeGreaterThanOrEqual(2);
    if (k >= info.n) break;
    turns.push(info.turn);
    lines.push(info.line);
    await expect(page.locator('#ly-title')).toContainText('Sztafeta karaoke');
    await fillCorrect(page);
    await page.getByRole('button', { name: 'Tak to leciało!' }).click();
    await expect(page.locator('#ly-answer .verdict')).toContainText('+1');
    const last = k === info.n - 1;
    await page.locator('#ly-answer .actions button.primary').click();
    if (last) break;
  }
  // gracze na zmianę, kolejne przerwy coraz dalej w tej samej piosence
  expect(turns[1]).not.toBe(turns[0]);
  expect(lines[1]).toBeGreaterThan(lines[0]);
  await expect.poll(() => screen(page)).toBe('end');
  expect(await page.evaluate(() => state.players.reduce((n, p) => n + p.score, 0))).toBe(turns.length);
});

test('Tak to leciało!: po odpowiedzi piosenka gra do końca, pasek przewijania przesuwa film i tekst karaoke', async ({ page }) => {
  await startLyrics(page);
  await playToGap(page);
  await expect(page.locator('#ly-seek')).toBeHidden();
  await fillCorrect(page);
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await expect(page.locator('#ly-seek')).toBeVisible();
  // dawniej muzyka stawała kilka sekund po wersie – teraz gra dalej
  await expect.poll(() => page.evaluate(() => lyYT.getCurrentTime() > state.lyrics.cur.resumeUntil + 5), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate(() => lyYT.getPlayerState())).toBe(1);
  // animacja odsłaniania słów była tylko raz – po przewinięciu słowa stoją bez animacji
  await expect(page.locator('.ly-reveal.go, .ly-reveal.shown')).toHaveCount(1);
  await page.waitForTimeout(3500);
  await page.evaluate(() => lyRender());
  await expect(page.locator('.ly-reveal.shown')).toHaveCount(1);
  await expect(page.locator('.verdict.still')).toHaveCount(1);
  // przewinięcie na 50 s: film i podświetlony wers idą za paskiem
  await page.evaluate(() => { const b = $('#ly-seek-bar'); b.value = '50'; b.dispatchEvent(new Event('input')); b.dispatchEvent(new Event('change')); });
  await page.evaluate(() => { window.__ytSpeed = 0.001; });
  const at = await page.evaluate(() => {
    const cur = state.lyrics.cur; const t = lyYT.getCurrentTime();
    let k = -1; cur.lines.forEach((l, i) => { if (l.t <= t + 0.05) k = i; });
    return { t, want: cur.lines[k].text, now: $('#ly-lines p.now') && $('#ly-lines p.now').textContent };
  });
  expect(at.t).toBeGreaterThanOrEqual(50);
  expect(at.t).toBeLessThan(52);
  expect(at.now).toBe(at.want);
});

test('Tak to leciało!: rezygnacja z wygraną także przy przerwie w piosence', async ({ page }) => {
  await startLyrics(page);
  await playToGap(page);
  // przy pierwszej piosence nie ma jeszcze czego zabrać
  await expect(page.locator('#ly-answer .ly-quit')).toHaveCount(0);
  await fillCorrect(page);
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
  await playToGap(page);
  await page.locator('#ly-answer .ly-quit').click();
  await expect.poll(() => screen(page)).toBe('end');
  await expect(page.locator('#winner-title')).toContainText('500 zł');
});

test('Tak to leciało!: film, który sam nie ruszył, jest zapisany i pomijany w kolejnych grach', async ({ page }) => {
  await startLyrics(page);
  const vid = await page.evaluate(() => {
    const it = state.players[0].board[0].songs[0];
    window.__lyAutoplayMs = 400; window.__ytNoPlay = [it.yts[0]];
    return it.yts[0];
  });
  await page.locator('.ly-cat').first().click();
  await page.locator('.ly-song').first().click();
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('nie odtworzył się automatycznie');
  const saved = await page.evaluate(() => [store.get('lyBadVideos', []), store.get('lyReports', [])]);
  expect(saved[0]).toContain(vid);
  expect(saved[1].some((r) => r.v === vid && r.why === 'autoplay')).toBe(true);
  expect(await page.evaluate((v) => lyCatalog().some((it) => it.yts.includes(v)), vid)).toBe(false);
});

test('Tak to leciało!: przerwa tylko w polskim wersie', async ({ page }) => {
  await page.goto('/');
  const picked = await page.evaluate(() => {
    const lines = Array.from({ length: 30 }, (_, i) => ({ t: 12 + i * 4, text: i % 3 ? 'oh yeah baby I love you tonight' : `idę sobie drogą numer ${i} przez miasto` }));
    return Array.from({ length: 30 }, () => { const g = lyPickGap(lines, 3, 140); return g.lines.map((i) => lyLineLang(lines[i].text)); }).flat();
  });
  expect(picked).not.toContain('en');
});


test('Tak to leciało!: odsłonięte słowo jest wpisane w pole – cały prawidłowy wers jest zaliczony', async ({ page }) => {
  await startLyrics(page);
  await playToGap(page);
  const want = await page.evaluate(() => state.lyrics.cur.gap.blanks.map((b) => b.want));
  await page.getByRole('button', { name: /Odsłoń słowo \(3\)/ }).click();
  await page.locator('.ly-dot').nth(1).click();
  // słowo w polu na swoim miejscu (przed nim puste miejsce – pole ma samo to słowo)
  await expect(page.locator('#ly-input')).toHaveValue(want[1]);
  // gracz wpisuje cały wers razem z odsłoniętym słowem
  await page.locator('#ly-input').fill(want.join(' '));
  expect(await page.evaluate(() => lyGiven(state.lyrics.cur))).toEqual(want);
  // także bez odsłoniętego słowa (np. z telefonu)
  expect(await page.evaluate((w) => { const c = state.lyrics.cur; const t = c.text; c.text = w.filter((_, i) => i !== 1).join(' '); const g = lyGiven(c); c.text = t; return g; }, want)).toEqual(want);
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await expect(page.locator('#ly-answer .verdict')).toContainText('500 zł');
});

test('Tak to leciało!: sprawdzarka filmów w ustawieniach pomija filmy, które się nie odtwarzają, i daje raport', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.LYRICS_SONGS = { 'A|a': [['ok1', 1, 180], ['zly1', 2, 180]], 'B|b': ['ok2', 3, 180], 'C|c': [['dl1', 4, 100]] };
    window.__ytFail = ['zly1'];
    lycRender();
  });
  await page.click('#btn-settings');
  await expect(page.locator('#lyc-summary')).toContainText('Filmów w katalogu: 4');
  await page.click('#lyc-run');
  await expect(page.locator('#lyc-status')).toHaveText('Gotowe.', { timeout: 20000 });
  const r = await page.evaluate(() => ({ checked: store.get('lyChecked', {}), bad: store.get('lyBadVideos', []), rep: lycReport() }));
  expect(r.checked.ok1.ok).toBe(true);
  expect(r.checked.zly1.err).toBe('150');
  expect(r.checked.dl1.err).toBe('dl80'); // film 180 s, nagranie z tekstem 100 s
  expect(r.bad.sort()).toEqual(['dl1', 'zly1']);
  expect(r.rep).toContain('zly1:150');
  await expect(page.locator('#lyc-copy')).toBeVisible();
});

test('Tak to leciało!: zapasowy film ma własny tekst dopasowany do swojej długości', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(() => {
    const s = window.SONGS.find((x) => x.c === 'PL');
    window.LYRICS_SONGS = { [songKey(s)]: [['v1', 11, 200], ['v2', 22, 180]] };
    const it = lyCatalog()[0];
    return { vids: it.vids, lr: it.lr, d: it.d };
  });
  expect(r.vids).toEqual([{ id: 'v1', lr: 11, d: 200 }, { id: 'v2', lr: 22, d: 180 }]);
  expect([r.lr, r.d]).toEqual([11, 200]);
});

test('Impreza: minigrę „Tak to leciało!” można pominąć – impreza idzie dalej do następnej minigry', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
    window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [`vid${i}`, 1000 + i, 180]]));
    store.set('partyGames', ['lyrics', 'hilo']);
  });
  await page.click('#btn-single');
  await page.click('.mode[data-mode=party]');
  await page.fill('#party-games', '2');
  await page.click('#btn-start');
  // pierwsza minigra: ustawiamy kolejność (najpierw „Tak to leciało!”)
  await expect.poll(() => page.evaluate(() => state.party && state.party.plan.length)).toBe(2);
  if (await page.evaluate(() => state.party.plan[0] !== 'lyrics')) {
    await page.evaluate(() => { state.party.plan = ['lyrics', 'hilo']; playPartyGame(); });
  }
  await expect.poll(() => screen(page)).toBe('lyrics');
  await expect(page.locator('#btn-mini-skip')).toBeVisible();
  // w zwykłej minigrze nie ma pominięcia piosenki (to tylko sztafeta)
  await expect(page.locator('#btn-ly-skip-song')).toBeHidden();
  await page.click('#btn-mini-skip');
  await expect.poll(() => screen(page)).toBe('end');
  await expect(page.locator('#end-party')).toBeVisible();
  expect(await page.evaluate(() => [state.party.idx, state.party.done, state.lyrics.cur])).toEqual([1, false, null]);
  await page.click('#btn-party-next');
  await expect.poll(() => screen(page)).toBe('game');
  expect(await page.evaluate(() => state.mode)).toBe('hilo');
  await expect(page.locator('#btn-mini-skip')).toBeVisible();
});

test('Sztafeta karaoke: bieżącą piosenkę można pominąć – gra bierze następną', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
    window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [`vid${i}`, 1000 + i, 180]]));
  });
  await page.click('#btn-multi');
  await page.click('#btn-lobby-add');
  await page.click('#btn-lobby-next');
  await page.click('.mode[data-mode=relay]');
  await page.fill('#rounds', '2');
  await page.click('#btn-start');
  await expect.poll(() => page.evaluate(() => state.phase), { timeout: 20000 }).toBe('answer');
  // osobny tryb (nie impreza) – bez pominięcia minigry
  await expect(page.locator('#btn-mini-skip')).toBeHidden();
  const first = await page.evaluate(() => songKey(state.lyrics.cur.it.song));
  await page.click('#btn-ly-skip-song');
  await expect.poll(() => page.evaluate(() => state.lyrics.cur && songKey(state.lyrics.cur.it.song)), { timeout: 20000 }).not.toBe(first);
  expect(await page.evaluate(() => [state.lyrics.mini.songs, state.history[0].note])).toEqual([1, 'pominięta']);
  await expect.poll(() => page.evaluate(() => state.phase), { timeout: 20000 }).toBe('answer');
  // druga (ostatnia) piosenka pominięta – koniec gry
  await page.click('#btn-ly-skip-song');
  await expect.poll(() => screen(page)).toBe('end');
});

test('Tak to leciało!: przyciski na dole przesuwają tekst względem filmu (zapis na urządzeniu, w raporcie i z katalogu)', async ({ page }) => {
  await startLyrics(page);
  await playToGap(page);
  await expect(page.locator('#ly-sync')).toBeVisible();
  await page.getByRole('button', { name: 'tekst za wcześnie' }).click();
  await page.getByRole('button', { name: 'tekst za wcześnie' }).click();
  await page.getByRole('button', { name: 'tekst za późno' }).click();
  await expect(page.locator('#ly-sync-off')).toHaveText('przesunięcie +0,5 s');
  const r = await page.evaluate(() => {
    const id = state.lyrics.cur.videoId;
    return { id, off: store.get('lyOffsets', {})[id], diff: lyYT.getCurrentTime() - lyNow(), rep: lycReport() };
  });
  expect(r.off).toBe(0.5);
  expect(r.diff).toBeCloseTo(0.5, 5);
  expect(r.rep).toContain(`przesunięcia tekstu (1): ${r.id}:+0.5`);
  // przesunięcie z katalogu (czwarta liczba), gdy na urządzeniu nie ustawiono własnego
  const cat = await page.evaluate(() => {
    const cur = state.lyrics.cur;
    store.set('lyOffsets', {});
    const v = cur.it.vids.find((x) => x.id === cur.videoId);
    v.off = -1.5;
    return lyOffset();
  });
  expect(cat).toBe(-1.5);
});

test('Tak to leciało!: zagadka nie trafia na zapowiedzi z koncertu, chórki w nawiasach ani onomatopeje', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(() => {
    const bad = ['(Dzięki wielkie Poznań!)', 'Dzięki wielkie poznań, dziękujemy', 'Brawo wy!', '(Jeszcze raz!)', 'La la la la', 'Hej hej, hej hej', 'Uuuu, jestem tu', 'Oh yeah', 'Na na na na na'];
    const good = ['Nie chcę tańczyć do melodii, którą znam', 'Jestem wolny, już mnie porwał wiatr', 'O tobie myślę co dzień'];
    // piosenka: tylko didaskalia i onomatopeje poza jednym zwykłym wersem
    const lines = [...bad, ...bad, good[0], ...bad].map((text, i) => ({ t: 12 + i * 4, text }));
    const picks = new Set(Array.from({ length: 40 }, () => { const g = lyPickGap(lines, 3, 200); return g && lines[g.line].text; }));
    return { bad: bad.map(lyGapLineOk), good: good.map(lyGapLineOk), picks: [...picks] };
  });
  expect(r.bad).toEqual(r.bad.map(() => false));
  expect(r.good).toEqual([true, true, true]);
  expect(r.picks).toEqual(['Nie chcę tańczyć do melodii, którą znam']);
});

test('Tak to leciało!: w kategorii wykonawcy starsza i nowsza piosenka (poza Męskim Graniem)', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(() => {
    const items = [1975, 1980, 1990, 2005, 2015].map((y, i) => ({ song: { a: 'X', t: `t${i}`, y } }));
    return Array.from({ length: 30 }, () => lyOldNew(items).map((it) => it.song.y)).every(([a, b]) => a < b && a <= 1990 && b >= 1990);
  });
  expect(r).toBe(true);
});

test('Tak to leciało!: „film pokazuje tekst – zmień film” bierze inny film i zgłasza poprzedni', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
    window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [[`vid${i}`, 1000 + i, 180], [`alt${i}`, 1000 + i, 180]]]));
  });
  await page.click('#btn-single');
  await page.click('.mode[data-mode=lyrics]');
  await page.click('#btn-start');
  await page.locator('.ly-cat:not(.done)').first().click();
  await page.locator('.ly-song').first().click();
  await expect.poll(() => page.evaluate(() => state.phase === 'play' && state.lyrics.cur.started)).toBe(true);
  const first = await page.evaluate(() => state.lyrics.cur.videoId);
  await page.getByRole('button', { name: 'film pokazuje tekst – zmień film' }).click();
  await expect.poll(() => page.evaluate(() => state.lyrics.cur.videoId)).not.toBe(first);
  const r = await page.evaluate(() => ({ bad: store.get('lyBadVideos', []), rep: lycReport() }));
  expect(r.bad).toContain(first);
  expect(r.rep).toContain(`${first}:tekst`);
});
