import { test, expect, ready, screen } from './fixtures.mjs';
import fs from 'node:fs';

// jeden gracz: start trybu z ekranu „Jeden gracz”
async function start(page, mode, setup) {
  await page.goto('/');
  await page.click('#btn-single');
  await page.click(`.mode[data-mode=${mode}]`);
  if (setup) await setup(page);
  await page.click('#btn-start');
  await ready(page);
}

test('lista trybów jednego gracza', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-single');
  const modes = await page.$$eval('#screen-modes .mode:not(.hidden)', (x) => x.map((y) => y.dataset.mode));
  expect(modes).toEqual(expect.arrayContaining(['solo', 'timed', 'party', 'hilo', 'duel', 'melody', 'steps']));
  expect(modes).not.toContain('buzz');
  expect(modes).not.toContain('multi');
});

test('oś czasu: dobre ułożenie zostaje na osi', async ({ page }) => {
  await start(page, 'solo');
  await page.evaluate(() => onSlotClick(correctSlot(activePlayer().timeline, state.current.y)));
  await page.click('#actions button.primary');
  await expect.poll(() => page.evaluate(() => state.phase)).toBe('revealed');
  expect(await page.evaluate(() => activePlayer().timeline.length)).toBe(2);
});

test('Na czas: bez limitu kart; po końcu czasu piosenka milknie, ale kartę można jeszcze ułożyć', async ({ page }) => {
  await start(page, 'timed');
  await page.evaluate(() => { state.winTarget = 1; });
  await page.evaluate(() => onSlotClick(correctSlot(activePlayer().timeline, state.current.y)));
  await page.click('#actions button.primary');
  await expect.poll(() => page.evaluate(() => state.phase)).toBe('revealed');
  await page.click('#actions button.primary');
  await ready(page);
  expect(await screen(page)).toBe('game');
  // koniec czasu w trakcie piosenki
  await page.evaluate(() => { state.heard = true; state.timeLeft = 300; });
  await expect(page.locator('#turn-title')).toContainText('Koniec czasu');
  expect(await page.evaluate(() => [state.phase, document.querySelector('#audio').paused])).toEqual(['listen', true]);
  await page.evaluate(() => onSlotClick(correctSlot(activePlayer().timeline, state.current.y)));
  await page.click('#actions button.primary');
  await expect.poll(() => page.evaluate(() => state.phase)).toBe('revealed');
  expect(await page.evaluate(() => activePlayer().timeline.filter((c) => !c.start).length)).toBe(2);
  await page.click('#actions button.primary');
  await expect.poll(() => screen(page)).toBe('end');
});

test('Jaka to melodia: poprawny tytuł daje punkt, potem podsumowanie', async ({ page }) => {
  await start(page, 'melody', (p) => p.fill('#rounds', '1'));
  const title = await page.evaluate(() => state.current.t);
  await page.fill('#guess-song', title);
  await page.press('#guess-song', 'Enter');
  await expect.poll(() => page.evaluate(() => state.players[0].score)).toBe(1);
  await page.click('#actions button.primary');
  await expect.poll(() => screen(page)).toBe('end');
});

test('Starsza czy nowsza?: dobra odpowiedź przedłuża serię', async ({ page }) => {
  await start(page, 'hilo');
  const older = await page.evaluate(() => state.current.y <= state.ref.y);
  await page.click(`#actions button.big-choice >> nth=${older ? 0 : 1}`);
  await expect.poll(() => page.evaluate(() => state.streak)).toBe(1);
});

test('Pojedynek dekad: wybór właściwej dekady', async ({ page }) => {
  await start(page, 'duel', (p) => p.fill('#rounds', '1'));
  const idx = await page.evaluate(() => state.duel.indexOf(decadeOf(state.current)));
  await page.click(`#actions button.big-choice >> nth=${idx}`);
  await expect.poll(() => page.evaluate(() => state.players[0].score)).toBe(1);
});

test('Melodia krok po kroku: odgadnięcie przy 1 s daje 4 pkt', async ({ page }) => {
  await start(page, 'steps', (p) => p.fill('#rounds', '1'));
  await page.fill('#guess-song', await page.evaluate(() => state.current.t));
  await page.press('#guess-song', 'Enter');
  await expect.poll(() => page.evaluate(() => state.players[0].score)).toBe(4);
});

test('impreza dla jednej osoby: wyniki minigier się sumują', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => store.set('partyGames', ['hilo', 'duel']));
  await start(page, 'party', (p) => p.fill('#party-games', '2'));
  await page.evaluate(() => { state.streak = 3; state.players[0].score = 3; endGame(); });
  await expect(page.locator('#end-party')).toBeVisible();
  await expect(page.locator('.party-standings li').first()).toContainText('3');
  await page.click('#btn-party-next');
  await ready(page);
  await page.evaluate(() => { state.players[0].score = 2; state.streak = 2; endGame(); });
  await expect(page.locator('#end-actions')).toBeVisible();
  await expect(page.locator('#winner-title')).toContainText('5');
});

test('„fragment z losowego miejsca” tylko przy krótszym fragmencie; bez TV i telefonów – bez wyboru „muzyka gra na”', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-single');
  await page.click('.mode[data-mode=melody]');
  await page.selectOption('#clip-length', '30');
  await expect(page.locator('#clip-random-row')).toBeHidden();
  await page.selectOption('#clip-length', '10');
  await expect(page.locator('#clip-random-row')).toBeVisible();
  await expect(page.locator('#audio-out-box')).toBeHidden();
});

test('fragment z losowego miejsca: wycinek 10 s zaczyna się w różnych miejscach', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-single');
  await page.click('.mode[data-mode=melody]');
  await page.selectOption('#clip-length', '10');
  await page.check('#clip-random');
  await page.click('#btn-start');
  const starts = new Set();
  for (let k = 0; k < 4; k++) {
    await ready(page);
    starts.add(await page.evaluate(() => state.clipStart.toFixed(1)));
    await page.evaluate(() => { state.drawId++; startTurn(); });
  }
  expect(starts.size).toBeGreaterThan(1);
});

test('link do Spotify z identyfikatorem utworu (songs-sp.js wczytany w tle)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.SONG_SP);
  const url = await page.evaluate(() => {
    const song = window.SONGS.find((s) => window.SONG_SP[songKey(s)]);
    return streamUrl(song, null, 'spotify');
  });
  expect(url).toMatch(/open\.spotify\.com\/track\/[A-Za-z0-9]+$/);
});

test('gatunek disco polo usunięty z bazy i filtrów', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => window.SONGS.some((s) => (s.g || []).includes('disco polo')))).toBe(false);
});

test('własna lista piosenek: dopasowanie do bazy, zestaw i gra tylko z listy', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-single');
  await page.click('.mode[data-mode=melody]');
  const lines = await page.evaluate(() => {
    const picks = window.SONGS.filter((s, i) => i % 300 === 0).slice(0, 12);
    return picks.map((s, i) => (i % 2 ? `${s.t} – ${s.a}` : `${s.a} - ${s.t}`)).concat(['Nieistniejący Zespół – Piosenka, której nie ma']);
  });
  await page.click('#btn-playlist');
  await page.fill('#pl-text', lines.join('\n'));
  await page.click('#btn-pl-match');
  await expect(page.locator('#pl-result')).toContainText('12 z 13');
  await page.fill('#pl-name', 'Test');
  await page.click('#btn-pl-save');
  await expect(page.locator('#presets .chip[aria-pressed=true]')).toContainText('Test');
  expect(await page.evaluate(() => songPool().length)).toBe(12);
  await page.fill('#rounds', '1');
  await page.click('#btn-start');
  await ready(page);
  const keys = await page.evaluate(() => [...playlistKeys(filterState.tag)]);
  expect(keys).toContain(await page.evaluate(() => songKey(state.current)));
});

test('ciekawostki: nagroda z Wikidata, rok festiwalu w Opolu, przy karcie jedna ciekawostka', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.SONG_FACTS, null, { timeout: 15000 });
  const r = await page.evaluate(() => {
    const oscar = window.SONGS.find((s) => (s.f || []).some((f) => f.startsWith('a:oscar')));
    const bodo = window.SONGS.find((s) => s.t === 'Umówiłem się z nią na dziewiątą');
    const withMany = window.SONGS.find((s) => songFacts(s).length >= 3);
    return {
      oscar: songFacts(oscar).map((f) => f.txt).join(' | '),
      bodo: songFacts(bodo).map((f) => f.txt).join(' | '),
      years: [opoleYear('I'), opoleYear('XIX'), opoleYear('XX'), opoleYear('LIII'), opoleYear('LXII')],
      shown: factLines(withMany).length,
      composer: songFacts(window.SONGS.find((s) => s.t === 'Miłość ci wszystko wybaczy')).map((f) => f.txt).join(' | '),
    };
  });
  expect(r.oscar).toContain('Oscar');
  expect(r.oscar).toContain('Wikidata');
  // edycje wg Wikipedii: I – 1963, XIX – 1981, w 1982 bez festiwalu, XX – 1983, LIII – 2016, LXII – 2025
  expect(r.years).toEqual([1963, 1981, 1983, 2016, 2025]);
  expect(r.bodo).toContain('LIII Krajowym Festiwalu Piosenki Polskiej w Opolu (2016)');
  expect(r.shown).toBe(1);
  expect(r.composer).toContain('Henryk Wars');
});

test('ciekawostka zależna od zestawu: w Eurowizji – o Eurowizji, we wszystkich – dowolna', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.SONG_FACTS, null, { timeout: 15000 });
  const r = await page.evaluate(() => {
    // piosenka z ciekawostką o Eurowizji i inną (np. kompozytor z Wikidata)
    const song = window.SONGS.find((s) => songFacts(s).some((f) => f.kind === 'euro') && songFacts(s).some((f) => f.kind !== 'euro'));
    filterState.tag = 'eurowizja';
    const euro = new Set(Array.from({ length: 30 }, () => factLines(song)[0].textContent));
    filterState.tag = null;
    const any = new Set(Array.from({ length: 60 }, () => factLines(song)[0].textContent));
    return { euro: [...euro], any: any.size };
  });
  expect(r.euro.every((t) => /Eurowizj/.test(t))).toBe(true);
  expect(r.any).toBeGreaterThan(1);
});

test('zestaw Memy: gotowy zestaw w ustawieniach i ciekawostka, z jakiego memu', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.SONG_MEMES, null, { timeout: 15000 });
  const r = await page.evaluate(() => {
    const songs = window.SONGS.filter((s) => s.tg && s.tg.includes('memy'));
    const song = songs.find((s) => window.SONG_MEMES[songKey(s)] && songFacts(s).some((f) => f.kind !== 'memy'));
    filterState.tag = 'memy';
    const memes = new Set(Array.from({ length: 20 }, () => factLines(song)[0].textContent));
    filterState.tag = null;
    return { count: songs.length, memes: [...memes], preset: PRESETS.some((p) => p.id === 'memy') };
  });
  expect(r.count).toBeGreaterThan(300);
  expect(r.preset).toBe(true);
  expect(r.memes.length).toBe(1);
  expect(r.memes[0].startsWith('😂')).toBe(true);
});

test('wersja angielska interfejsu', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('songster.lang', JSON.stringify('en')));
  await page.reload();
  await expect(page.locator('#btn-single')).toContainText('Single player');
  await page.click('#btn-single');
  await expect(page.locator('.mode[data-mode=year]')).toContainText('Year on the nose');
});

test('ustawienia: wyszukiwanie piosenki i poprawka roku', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-settings');
  await page.fill('#song-search', 'Bohemian');
  await expect(page.locator('#song-editor .song-row').first()).toBeVisible({ timeout: 5000 });
  const input = page.locator('#song-editor .song-row input').first();
  const y = Number(await input.inputValue());
  await input.fill(String(y + 1));
  await input.dispatchEvent('change');
  await expect(page.locator('#song-editor .song-row.edited')).toHaveCount(1);
  await page.click('#btn-reset-years');
});

test('wersja gry na ekranie startowym zgodna z ostatnim wpisem w CHANGELOG.md', async ({ page }) => {
  await page.goto('/');
  const log = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const last = [...log.matchAll(/^## (\d+\.\d+\.\d+)/gm)].pop()[1];
  await expect(page.locator('#app-version')).toHaveText(`Songster v${last}`);
});

test('bez podłączonego dużego ekranu nie ma napisu „Brak połączonego urządzenia”', async ({ page }) => {
  // zapamiętane z wcześniejszej gry ustawienie „muzyka gra na dużym ekranie”
  await page.addInitScript(() => localStorage.setItem('songster.audioOut', JSON.stringify('tv')));
  await page.goto('/');
  await page.click('#btn-single');
  await page.click('.mode[data-mode=solo]');
  await page.click('#btn-start');
  await ready(page);
  await expect(page.locator('#audio-note')).toBeHidden();
  // po podłączeniu ekranu (okno na tym urządzeniu) napis wraca, póki ekran nie gra
  await page.evaluate(() => { tvWindowSeen = true; tvChannel = null; applyAudioRoute(); });
  await expect(page.locator('#audio-note')).toContainText('Brak połączonego urządzenia');
});

test('iPhone: przycisk „Zainstaluj” pokazuje, jak dodać grę do ekranu początkowego', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent',
    { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }));
  await page.goto('/');
  await expect(page.locator('#btn-install')).toBeVisible();
  await expect(page.locator('#ios-install')).toBeHidden();
  await page.click('#btn-install');
  await expect(page.locator('#ios-install')).toContainText('Do ekranu początkowego');
});

test('ciekawostki: żarty przy piosenkach Edyty Górniak i Maryli Rodowicz (co jakiś czas)', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(() => {
    const by = (a) => window.SONGS.find((s) => mainArtist(s) === a);
    window.__factEggChance = 1;
    const egg = [factLines(by('Edyta Górniak'))[0].textContent, factLines(by('Maryla Rodowicz'))[0].textContent];
    window.__factEggChance = 0;
    const plain = factLines(by('Edyta Górniak')).map((e) => e.textContent).join(' ');
    return { egg, plain };
  });
  expect(r.egg[0]).toContain('ok. 4000 lat p.n.e., Wszechświat');
  expect(r.egg[1]).toContain('A co, już sylwester?');
  expect(r.plain).not.toContain('Wszechświat');
});

test('Impreza: pominięcie minigry (⏭ obok ustawień) kończy ją bez punktów i przechodzi do przerwy', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => store.set('partyGames', ['melody', 'duel']));
  await start(page, 'party', (p) => p.fill('#party-games', '2'));
  await expect(page.locator('#btn-mini-skip')).toBeVisible();
  await expect(page.locator('#btn-mini-skip')).toHaveText('⏭');
  await page.evaluate(() => { state.players[0].score = 2; });
  await page.click('#btn-mini-skip');
  await expect.poll(() => screen(page)).toBe('end');
  await expect(page.locator('#end-party')).toBeVisible();
  expect(await page.evaluate(() => [state.party.idx, state.party.points[0]])).toEqual([1, 0]);
  // na ekranie przerwy przycisku nie ma
  await expect(page.locator('#btn-mini-skip')).toBeHidden();
  await page.click('#btn-party-next');
  await ready(page);
  await page.click('#btn-mini-skip');
  await expect(page.locator('#end-actions')).toBeVisible();
  // poza imprezą przycisku nie ma
  await start(page, 'melody');
  await expect(page.locator('#btn-mini-skip')).toBeHidden();
});

test('Pojedynek dekad: przy „Losowo” para dekad zmienia się co piosenkę, wybrane dekady zostają stałe', async ({ page }) => {
  await start(page, 'duel', (p) => p.fill('#rounds', '8'));
  const pairs = [];
  for (let k = 0; k < 6; k++) {
    const info = await page.evaluate(() => ({ duel: state.duel, d: decadeOf(state.current) }));
    expect(info.duel).toHaveLength(2);
    expect(info.duel).toContain(info.d);
    expect(info.duel[0]).toBeLessThan(info.duel[1]);
    pairs.push(info.duel.join('-'));
    await page.evaluate(() => answerDuel(decadeOf(state.current)));
    await page.click('#actions button.primary');
    await ready(page);
  }
  expect(new Set(pairs).size).toBeGreaterThan(1);
  // wybrane w ustawieniach: te same dwie dekady przez całą grę
  await page.goto('/');
  await page.click('#btn-single');
  await page.click('.mode[data-mode=duel]');
  await page.selectOption('#duel-a', '1980');
  await page.selectOption('#duel-b', '2000');
  await page.fill('#rounds', '4');
  await page.click('#btn-start');
  await ready(page);
  for (let k = 0; k < 3; k++) {
    expect(await page.evaluate(() => [state.duel, [1980, 2000].includes(decadeOf(state.current))])).toEqual([[1980, 2000], true]);
    await page.evaluate(() => answerDuel(decadeOf(state.current)));
    await page.click('#actions button.primary');
    await ready(page);
  }
});

test('wygląd 6.0: „Dalej →” w ustawieniach trybu przechodzi do następnego kroku (także z płynnym przewijaniem)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('songster.ui6', '1'));
  await page.reload();
  await page.click('#btn-single');
  await page.click('.mode[data-mode=solo]');
  await page.click('.ui6-snext');
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.ui6-sstep-b')].map((b) => b.getAttribute('aria-current'))), { timeout: 3000 }).toEqual(['false', 'true']);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => [...document.querySelectorAll('.ui6-sstep-b')].map((b) => b.getAttribute('aria-current')))).toEqual(['false', 'true']);
});
