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
  await pickFilm(page);
  await toAnswer(page);
}
// przed każdą piosenką gracz wybiera film (dotknięcie uruchamia odtwarzanie)
async function pickFilm(page) {
  await page.locator('.ly-film:not(.failed)').first().click();
}
// do przerwy w piosence – z wyborem filmu, gdy gra go pokazuje
async function toAnswer(page) {
  await expect.poll(async () => {
    if (await page.locator('.ly-film:not(.failed)').count()) await page.locator('.ly-film:not(.failed)').first().click({ timeout: 1000 }).catch(() => {});
    return page.evaluate(() => state.phase);
  }, { timeout: 20000 }).toBe('answer').catch(async (e) => {
    // przy błędzie – stan piosenki (łatwiej znaleźć przyczynę)
    const st = await page.evaluate(() => {
      const ly = state.lyrics; const cur = ly && ly.cur;
      return JSON.stringify({ phase: state.phase, msg: ly && ly.msg, pick: cur && cur.pick, dead: cur && cur.dead, vid: cur && cur.videoId, lines: !!(cur && cur.lines),
        gap: !!(cur && cur.gap), started: cur && cur.started, failed: cur && cur.failed, yt: lyYT && lyYT.getPlayerState && lyYT.getPlayerState(), films: document.querySelectorAll('.ly-film').length });
    }).catch(() => '?');
    throw new Error(`${e.message}\nstan: ${st}`);
  });
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
  await toAnswer(page);
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
  await toAnswer(page);
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

test('Tak to leciało!: film niedostępny – gra nie zmienia piosenki sama, gracz wybiera drugą z kategorii', async ({ page }) => {
  await startLyrics(page);
  const [first, other] = await page.evaluate(() => { const s = state.players[0].board[0].songs; window.__ytFail = [s[0].yts[0]]; window.__ytSpeed = 2; return s.map((it) => songKey(it.song)); });
  await page.locator('.ly-cat').first().click();
  await page.locator('.ly-song').first().click();
  await pickFilm(page);
  // komunikat nad wyborem (wyjaśnia, co się stało); piosenka zostaje ta sama, dopóki gracz nie zdecyduje
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('zmień piosenkę');
  const order = await page.evaluate(() => [...document.querySelectorAll('#ly-answer > *')].map((e) => e.className));
  expect(order.indexOf('muted ly-flash')).toBe(0);
  await expect(page.locator('#ly-msg')).toBeHidden();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => songKey(state.lyrics.cur.it.song))).toBe(first);
  // niedziałający film zostaje do sprawdzenia jeszcze raz (oznaczony)
  await expect(page.locator('.ly-film:not(.failed)')).toHaveCount(0);
  await expect(page.locator('.ly-film.failed')).toContainText('YouTube: niedostępny (kod 150)');
  await page.locator('.ly-film-other').click();
  await expect.poll(() => page.evaluate(() => songKey(state.lyrics.cur.it.song))).toBe(other);
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

test('Tak to leciało!: oba filmy w kategorii niedostępne – „Inna piosenka” bierze piosenkę z katalogu', async ({ page }) => {
  await startLyrics(page);
  const failed = await page.evaluate(() => { window.__ytFail = state.players[0].board[0].songs.map((it) => it.yts[0]); return window.__ytFail; });
  await page.locator('.ly-cat').first().click();
  await page.locator('.ly-song').first().click();
  await pickFilm(page);
  await page.locator('.ly-film-other').click();
  await pickFilm(page);
  // drugiej piosenki z kategorii już nie ma – zostaje „Inna piosenka”
  await expect(page.locator('.ly-film-other')).toHaveCount(0);
  await page.locator('.ly-film-skip').click();
  await toAnswer(page);
  expect(await page.evaluate(() => window.__ytFail.includes(state.lyrics.cur.videoId))).toBe(false);
  // błąd YouTube (150) zapisany dopiero po starcie innego filmu; film nie znika od razu (może to być chwilowa blokada)
  const log = await page.evaluate(() => store.get('lyVidLog', {}));
  expect(failed.map((id) => log[id] && log[id].err)).toEqual(['150', '150']);
  expect(await page.evaluate(() => store.get('lyBadVideos', []).length)).toBe(0);
  expect(await page.evaluate((ids) => ids.map((id) => lyCatalog().some((it) => it.yts.includes(id))), failed)).toEqual([true, true]);
  // ten sam błąd innego dnia – film pomijany na tym urządzeniu
  expect(await page.evaluate((id) => {
    const all = store.get('lyVidLog', {}); all[id].d = '2020-01-01'; store.set('lyVidLog', all);
    lyVidLog(id, { err: '150' });
    return [store.get('lyVidLog', {})[id].n, lyCatalog().some((it) => it.yts.includes(id))];
  }, failed[0])).toEqual([2, false]);
});

test('Tak to leciało!: tekst do filmu się nie wczytał – drugi film tej piosenki i ponowna próba, bez zmiany piosenki', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
    // dwa filmy z osobnymi wariantami tekstu; tekst pierwszego – serwer przeciążony (503)
    window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [[`vid${i}`, 1000 + i, 180], [`alt${i}`, 5000 + i, 180]]]));
    window.__lrFail = pl.map((s, i) => 1000 + i);
    window.__lrRetryMs = 5;
  });
  await page.click('#btn-single');
  await page.click('.mode[data-mode=lyrics]');
  await page.click('#btn-start');
  const song = await page.evaluate(() => { const it = lyCatalog().find((x) => x.yts[0] === 'vid0'); lyPlay(it, lyCatalog().find((x) => x.yts[0] === 'vid1'), 'test'); return songKey(it.song); });
  await page.locator('.ly-film[data-key="1"]').click();
  // ta sama piosenka: film 1 oznaczony „brak tekstu”, film 2 do wyboru
  await expect(page.locator('.ly-film.failed')).toContainText('brak tekstu');
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('Nie udało się wczytać tekstu do tego filmu');
  expect(await page.evaluate(() => songKey(state.lyrics.cur.it.song))).toBe(song);
  await expect(page.locator('.ly-film:not(.failed)')).toHaveCount(1);
  // serwer znów działa – ponowna próba pierwszego filmu
  await page.evaluate(() => { window.__lrFail = []; });
  await page.locator('.ly-film.failed').click();
  await toAnswer(page);
  expect(await page.evaluate(() => [state.lyrics.cur.videoId, songKey(state.lyrics.cur.it.song)])).toEqual(['vid0', song]);
});

test('Tak to leciało!: kilka filmów z rzędu z błędem YouTube – blokada urządzenia, filmy nie są zapisywane jako niedziałające', async ({ page }) => {
  await startLyrics(page);
  const failed = await page.evaluate(() => {
    const songs = lyCatalog().slice(0, 3);
    window.__ytFail = songs.map((it) => it.yts[0]);
    lyPlay(songs[0], songs[1], 'test');
    return window.__ytFail;
  });
  await pickFilm(page);
  await page.locator('.ly-film-other').click();
  await pickFilm(page);
  await expect.poll(() => page.evaluate(() => state.lyrics.hardRow.length)).toBe(2);
  await page.evaluate((songs) => lyPlay(lyCatalog().find((it) => it.yts[0] === songs[2]), null, 'test'), failed);
  await pickFilm(page);
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('YouTube nie odtwarza teraz filmów');
  // potem film działa – wcześniejsze błędy nie trafiają do dziennika
  await page.locator('.ly-film-skip').click();
  await toAnswer(page);
  const log = await page.evaluate(() => store.get('lyVidLog', {}));
  expect(failed.filter((id) => log[id] && log[id].err)).toEqual([]);
});

test('Tak to leciało!: ▶ na polecanym filmie w odtwarzaczu wybiera ten film', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
    window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [[`vid${i}`, 1000 + i, 180], [`alt${i}`, 1000 + i, 180]]]));
    // drugi film działał wcześniej na tym urządzeniu – jest polecany
    store.set('lyVidLog', { alt0: { ok: 1, d: '2026-10-01' }, alt1: { ok: 1, d: '2026-10-01' }, alt2: { ok: 1, d: '2026-10-01' } });
  });
  await page.click('#btn-single');
  await page.click('.mode[data-mode=lyrics]');
  await page.click('#btn-start');
  await page.evaluate(() => { const it = lyCatalog().find((x) => x.yts[1] === 'alt0'); lyPlay(it, null, 'test'); });
  await expect.poll(() => page.evaluate(() => window.__ytCued)).toBe('alt0');
  await expect(page.locator('.ly-film').first()).toContainText('działał');
  await expect.poll(() => page.evaluate(() => lyLyricsDone.size > 0)).toBe(true);
  await page.evaluate(() => { lyYT.playVideo(); lyYT.opts.events.onStateChange({ data: 1 }); });
  await expect.poll(() => page.evaluate(() => [state.phase, state.lyrics.cur.videoId, state.lyrics.cur.started])).toEqual(['play', 'alt0', true]);
  await expect(page.locator('.ly-film')).toHaveCount(0);
});

test('Tak to leciało!: urządzenie blokuje odtwarzanie – od następnej piosenki odtwarzacz z przyciskami', async ({ page }) => {
  await startLyrics(page);
  await page.evaluate(() => { window.__ytNoPlay = [state.players[0].board[0].songs[0].yts[0]]; });
  await page.locator('.ly-cat').first().click();
  await page.locator('.ly-song').first().click();
  await pickFilm(page);
  await page.evaluate(() => lyYT.opts.events.onAutoplayBlocked());
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('Przeglądarka nie pozwoliła');
  expect(await page.evaluate(() => store.get('lyTapPlay', false))).toBe(true);
  // gracz dotyka ▶ w odtwarzaczu – gra rusza
  await page.evaluate(() => { lyYT.playVideo(); lyYT.opts.events.onStateChange({ data: 1 }); });
  await expect(page.locator('.ly-film')).toHaveCount(0);
  // następna piosenka: nowy odtwarzacz z przyciskami
  await page.evaluate(() => lyPlay(lyAnySong(), null, 'test'));
  await expect.poll(() => page.evaluate(() => lyYT && lyYT.opts.playerVars.controls)).toBe(1);
  expect(await page.evaluate(() => window.__ytDestroyed)).toBe(1);
  await expect(page.locator('.ly-films-title')).toContainText('dotknij ▶ na filmie');
  await expect(page.locator('#ly-tap-toggle')).toBeChecked({ checked: false }); // ustawienia odświeżają się przy otwarciu
});

test('Tak to leciało!: filmy odrzucone dawniej samoczynnie wracają, zgłoszone przez gracza – nie', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    store.set('lyBadVideos', ['auto1', 'zgl1', 'chk1']);
    store.set('lyReports', [{ k: 'a|b', v: 'auto1', why: 'autoplay' }, { k: 'a|c', v: 'zgl1' }]);
  });
  await page.reload();
  expect(await page.evaluate(() => [store.get('lyBadVideos', []), store.get('lyReports', []).map((r) => r.v)])).toEqual([['zgl1'], ['zgl1']]);
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
  await toAnswer(page);
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
    await toAnswer(page);
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

test('Tak to leciało!: film, który sam nie ruszył – wybór filmu wraca, film nie jest odrzucany, przyczyna trafia do raportu', async ({ page }) => {
  await startLyrics(page);
  const vid = await page.evaluate(() => {
    const it = state.players[0].board[0].songs[0];
    window.__lyAutoplayMs = 400; window.__ytNoPlay = [it.yts[0]];
    return it.yts[0];
  });
  await page.locator('.ly-cat').first().click();
  await page.locator('.ly-song').first().click();
  await expect(page.locator('.ly-film')).toHaveCount(1);
  await expect(page.locator('.ly-film img')).toHaveAttribute('src', `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`);
  // przed pierwszym wyborem nie ma pominięcia piosenki
  await expect(page.locator('.ly-film-skip')).toHaveCount(0);
  await pickFilm(page);
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('nie ruszył');
  await expect(page.locator('.ly-film .ly-film-tag')).toContainText('dotknij ▶');
  expect(await page.evaluate(() => store.get('lyBadVideos', []))).toEqual([]);
  // gracz uruchamia film w odtwarzaczu – gra rusza dalej
  await page.evaluate(() => { lyYT.playVideo(); lyYT.opts.events.onStateChange({ data: 1 }); });
  await expect(page.locator('.ly-film')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => store.get('lyVidLog', {})[state.lyrics.cur.videoId]?.ok)).toBe(1);
  expect(await page.evaluate(() => lycReport())).toContain(`ruszyły w grze (1): ${vid}`);
});

test('Tak to leciało!: blokada autoodtwarzania – wybór innej piosenki, przyczyna zapisana', async ({ page }) => {
  await startLyrics(page);
  const vid = await page.evaluate(() => { const it = state.players[0].board[0].songs[0]; window.__ytNoPlay = [it.yts[0]]; return it.yts[0]; });
  await page.locator('.ly-cat').first().click();
  await page.locator('.ly-song').first().click();
  await pickFilm(page);
  await page.evaluate(() => lyYT.opts.events.onAutoplayBlocked());
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('Przeglądarka nie pozwoliła');
  await page.locator('.ly-film-skip').click();
  await expect.poll(() => page.evaluate((v) => state.lyrics.cur && state.lyrics.cur.videoId !== v, vid)).toBe(true);
  await expect.poll(() => page.evaluate(() => lycReport())).toContain(`nie ruszyły w grze (1): ${vid}:blokada`);
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

test('Tak to leciało!: sprawdzarka filmów w ustawieniach oznacza filmy, które się nie odtwarzają, i daje raport', async ({ page }) => {
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
  // nic nie jest ukrywane – w grze niedziałający film jest na końcu listy i oznaczony
  expect(r.bad).toEqual([]);
  expect(r.rep).toContain('zly1:150');
  await expect(page.locator('#lyc-copy')).toBeVisible();
  expect(await page.evaluate(() => lyFilmChoices({ it: { vids: [{ id: 'zly1' }, { id: 'nowy' }, { id: 'ok1' }] }, failed: {} })
    .map((v) => [v.id, v.log && v.log.ok]))).toEqual([['ok1', 1], ['nowy', null], ['zly1', 0]]);
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
  await toAnswer(page);
  // osobny tryb (nie impreza) – bez pominięcia minigry
  await expect(page.locator('#btn-mini-skip')).toBeHidden();
  const first = await page.evaluate(() => songKey(state.lyrics.cur.it.song));
  await page.click('#btn-ly-skip-song');
  await expect.poll(() => page.evaluate(() => state.lyrics.cur && songKey(state.lyrics.cur.it.song)), { timeout: 20000 }).not.toBe(first);
  expect(await page.evaluate(() => [state.lyrics.mini.songs, state.history[0].note])).toEqual([1, 'pominięta']);
  await toAnswer(page);
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
    // liczba z trzema takimi samymi cyframi („2000”) to nie przeciągnięta głoska
    const good = ['Nie chcę tańczyć do melodii, którą znam', 'Jestem wolny, już mnie porwał wiatr', 'O tobie myślę co dzień', 'Już w roku 2000 będzie inaczej'];
    // piosenka: tylko didaskalia i onomatopeje poza jednym zwykłym wersem
    const lines = [...bad, ...bad, good[0], ...bad].map((text, i) => ({ t: 12 + i * 4, text }));
    const picks = new Set(Array.from({ length: 40 }, () => { const g = lyPickGap(lines, 3, 200); return g && lines[g.line].text; }));
    return { bad: bad.map(lyGapLineOk), good: good.map(lyGapLineOk), picks: [...picks] };
  });
  expect(r.bad).toEqual(r.bad.map(() => false));
  expect(r.good).toEqual([true, true, true, true]);
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
  await expect(page.locator('.ly-film')).toHaveCount(2);
  await pickFilm(page);
  await expect.poll(() => page.evaluate(() => state.phase === 'play' && state.lyrics.cur.started)).toBe(true);
  const first = await page.evaluate(() => state.lyrics.cur.videoId);
  await page.getByRole('button', { name: 'film pokazuje tekst – zmień film' }).click();
  // zostaje drugi film do wyboru
  await expect(page.locator('.ly-film')).toHaveCount(1);
  await pickFilm(page);
  await expect.poll(() => page.evaluate(() => state.lyrics.cur.videoId)).not.toBe(first);
  const r = await page.evaluate(() => ({ bad: store.get('lyBadVideos', []), rep: lycReport() }));
  expect(r.bad).toContain(first);
  expect(r.rep).toContain(`${first}:tekst`);
});

test('6.0 na telefonie: pasek – sama stawka, śpiewany wers zawsze widoczny, w przerwie kropki, pole z 🎤, koła i „✋ Rezygnuję”, wybrana z trzech wersji w polu', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('songster.ui6', '1'));
  await startLyrics(page);
  // drugi etap (500 zł wygrane) – przy przerwie można zrezygnować
  await page.evaluate(() => { Object.assign(state.players[0], { stage: 1, score: 500 }); lyRender(); });
  // pasek u góry: tylko kwota, o którą toczy się gra; stuknięcie – cała drabinka, 100 000 zł w osobnym wierszu
  const rungs = page.locator('#ly-ladder .ly-ladder li:visible');
  await expect(rungs).toHaveCount(1);
  await expect(rungs).toContainText('gramy o');
  await expect(rungs).toContainText('1000 zł');
  await page.locator('#ly-ladder').click();
  await expect(rungs).toHaveCount(10);
  const [top, other] = await page.evaluate(() => ['li.top', 'li:not(.top)'].map((s) => document.querySelector(`#ly-ladder ${s}`).getBoundingClientRect().width));
  expect(top).toBeGreaterThan(other * 2);
  await page.locator('#ly-ladder').click();
  await expect(rungs).toHaveCount(1);
  await page.locator('.ly-cat:not(.done)').first().click();
  await page.locator('.ly-song').first().click();
  // śpiewany wers – także ostatni przed przerwą – nigdy nie jest schowany (sprawdzane przy każdej zmianie wersów do przerwy)
  await page.evaluate(() => {
    window.__nowSeen = 0;
    window.__nowHidden = [];
    window.__nowWatch = new MutationObserver(() => {
      const n = state.phase === 'play' && document.querySelector('#ly-lines p.now');
      if (!n) return;
      window.__nowSeen++;
      if (getComputedStyle(n).display === 'none') window.__nowHidden.push(n.textContent);
    });
    window.__nowWatch.observe(document.querySelector('#ly-lines'), { childList: true, subtree: true, attributes: true });
  });
  await pickFilm(page);
  await toAnswer(page);
  expect(await page.evaluate(() => { window.__nowWatch.disconnect(); return window.__nowSeen; })).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__nowHidden)).toEqual([]);
  // przerwa: kropki, pole z „Tak to leciało!”, koła ratunkowe i „✋ Rezygnuję” z napisem (nie ikonka mikrofonu)
  for (const sel of ['.ly-dots', '#ly-input', '.ly-submit', '.ly-lifebtns', '#ly-answer .ly-quit']) await expect(page.locator(sel)).toBeVisible();
  await expect(page.locator('#ly-answer .ly-quit')).toHaveText('✋ Rezygnuję – zabieram 500 zł');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#ly-answer .ly-quit'), '::before').content)).toBe('none');
  // 🎤 (gdy przeglądarka rozpoznaje mowę) – w polu odpowiedzi, z prawej, w jego obrysie
  if (await page.evaluate(() => !!LySpeech)) {
    const [f, m] = await Promise.all([page.locator('#ly-input').boundingBox(), page.locator('#ly-answer .ly-field .ly-sing').boundingBox()]);
    expect(m.x).toBeGreaterThan(f.x + f.width / 2);
    expect(m.x + m.width).toBeLessThanOrEqual(f.x + f.width + 1);
    expect(m.y).toBeGreaterThanOrEqual(f.y - 1);
    expect(m.y + m.height).toBeLessThanOrEqual(f.y + f.height + 1);
  }
  // trzy wersje: kropki, pole i koła zostają; stuknięta wersja trafia do pola i jest zaznaczona
  await page.getByRole('button', { name: /Trzy wersje wersu/ }).click();
  await expect(page.locator('.ly-variants button')).toHaveCount(3);
  for (const sel of ['.ly-dots', '#ly-input', '.ly-submit', '.ly-lifebtns']) await expect(page.locator(sel)).toBeVisible();
  const pick = page.locator('.ly-variants button').nth(1);
  const text = await pick.textContent();
  await pick.click();
  await expect(page.locator('#ly-input')).toHaveValue(text);
  await expect(page.locator('.ly-variants button[aria-pressed=true]')).toHaveText(text);
  await expect(page.locator('.ly-variants button.on')).toHaveCount(1);
  expect(await page.evaluate(() => ui6Check())).toMatchObject({ scrollY: false, scrollX: false });
});

test('Tak to leciało!: trzy wersje po odsłonięciu słowa – odsłonięte słowo stoi w każdej wersji na swoim miejscu', async ({ page }) => {
  await startLyrics(page);
  await playToGap(page);
  const n = await page.evaluate(() => state.lyrics.cur.gap.blanks.length);
  test.skip(n < 2, 'przerwa z jednym słowem');
  await page.getByRole('button', { name: /Odsłoń słowo/ }).click();
  await page.locator('.ly-dot').nth(1).click();
  await page.getByRole('button', { name: /Trzy wersje wersu/ }).click();
  const want = await page.evaluate(() => state.lyrics.cur.gap.blanks.map((b) => b.want));
  const vs = await page.locator('.ly-variants button').allTextContents();
  expect(vs.length).toBeGreaterThanOrEqual(2);
  for (const v of vs) expect(v.split(' ')[1]).toBe(want[1]);
  // wybrana wersja w polu – prawdziwa wersja jest zaliczona w całości
  await page.locator('.ly-variants button', { hasText: new RegExp(`^${want.join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click();
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await expect(page.locator('#ly-answer .verdict')).toContainText('Tak to leciało!');
});

test('Tak to leciało!: rozpoznawanie mowy nie działa w przeglądarce (błąd „network”) – komunikat, przycisk 🎤 znika', async ({ page }) => {
  // przeglądarka z interfejsem rozpoznawania mowy, które nie działa (np. Brave)
  await page.addInitScript(() => {
    window.SpeechRecognition = class { start() { setTimeout(() => { this.onerror({ error: 'network' }); this.onend(); }, 20); } };
  });
  await startLyrics(page);
  await playToGap(page);
  await page.getByRole('button', { name: '🎤 Zaśpiewaj zamiast pisać' }).click();
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('nie działa w tej przeglądarce');
  await expect(page.locator('#ly-answer .ly-sing')).toHaveCount(0);
  expect(await page.evaluate(() => store.get('lySpeechOffAt', 0))).toBeGreaterThan(0);
});

test('Tak to leciało!: rozpoznawanie mowy – cisza daje komunikat, a przycisk 🎤 zostaje', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class { start() { setTimeout(() => { this.onerror({ error: 'no-speech' }); this.onend(); }, 20); } };
  });
  await startLyrics(page);
  await playToGap(page);
  await page.getByRole('button', { name: '🎤 Zaśpiewaj zamiast pisać' }).click();
  await expect(page.locator('#ly-answer .ly-flash')).toContainText('Nic nie słychać');
  await expect(page.locator('#ly-answer .ly-sing')).toHaveAttribute('aria-label', '🎤 Zaśpiewaj zamiast pisać');
});

test('Tak to leciało!: 🎤 w polu odpowiedzi – zaśpiewane słowa trafiają do pola, ponowne stuknięcie kończy słuchanie', async ({ page }) => {
  // atrapa rozpoznawania mowy: wynik podaje test, stop() kończy słuchanie
  await page.addInitScript(() => {
    window.SpeechRecognition = class { start() { window.__rec = this; } stop() { setTimeout(() => this.onend(), 10); } };
  });
  await startLyrics(page);
  await playToGap(page);
  const mic = page.locator('#ly-answer .ly-field .ly-sing');
  await expect(mic).toHaveAttribute('aria-label', '🎤 Zaśpiewaj zamiast pisać');
  await mic.click();
  await expect(mic).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#ly-input')).toHaveAttribute('placeholder', '🎤 Słucham…');
  // z zaśpiewanego zdania do pola trafiają słowa pasujące do przerwy
  const want = await page.evaluate(() => state.lyrics.cur.gap.blanks.map((b) => b.want).join(' '));
  await page.evaluate((t) => window.__rec.onresult({ results: [[{ transcript: `no więc ${t}` }]] }), want);
  await mic.click();
  await expect(mic).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#ly-input')).toHaveValue(want);
  await page.getByRole('button', { name: 'Tak to leciało!' }).click();
  await expect(page.locator('#ly-answer .verdict')).toContainText('Tak to leciało!');
});

test('Tak to leciało!: przy wyborze filmu wersja zwykła albo bez wokalu (podkład, karaoke) – osobna grupa, polecany zwykły film', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
    window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [[`vid${i}`, 1000 + i, 180], [`ins${i}`, 1000 + i, 180, 0, 'i'], [`kar${i}`, 1000 + i, 180, 0, 'k']]]));
  });
  await page.click('#btn-single');
  await page.click('.mode[data-mode=lyrics]');
  await page.click('#btn-start');
  await page.locator('.ly-cat:not(.done)').first().click();
  await page.locator('.ly-song').first().click();
  const films = page.locator('#ly-answer .ly-film');
  await expect(films).toHaveCount(3);
  await expect(films.first()).not.toHaveClass(/kar/);
  await expect(films.first()).toContainText('polecany');
  await expect(page.locator('#ly-answer .ly-films-sub')).toContainText('Bez wokalu');
  await expect(films.nth(1)).toContainText('podkład');
  await expect(films.nth(2)).toContainText('karaoke – tekst na filmie');
  // wybór podkładu – piosenka gra z tym filmem i tym samym tekstem
  await films.nth(1).click();
  await expect.poll(() => page.evaluate(() => state.lyrics.cur.videoId)).toMatch(/^ins/);
  await expect.poll(() => page.evaluate(() => state.phase), { timeout: 20000 }).toBe('answer');
});
