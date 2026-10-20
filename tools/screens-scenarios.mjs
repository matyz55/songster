// Scenariusze dla tools/screens.mjs: jak dojść w grze do każdego ekranu i stanu.
// Każdy scenariusz: id, grupa, tytuł i run({ newPage, capture, … }) – może zrobić kilka zrzutów (capture) po drodze.
// Odpowiedzi w grze podajemy przez funkcje gry (jak w testach), żeby zrzuty były powtarzalne.

/* ---------- pomocnicze ---------- */
// piosenka gotowa (w trybach bez ▶ na start – Okładka z mgły, Pierwsze słowa, Ułóż piątkę… – wystarczy wczytany fragment)
const ready = (page) => page.waitForFunction(() => state.phase === 'listen' && (state.current || state.sort) && (state.preview || state.sort)
  && document.querySelector('#mystery-status') && !/Szukam/.test(document.querySelector('#mystery-status').textContent), null, { timeout: 30000 });
const screenIs = (page, s) => page.waitForFunction((x) => !document.querySelector(`#screen-${x}`).classList.contains('hidden'), s, { timeout: 30000 });
async function home(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.SONGS && typeof showScreen === 'function');
}
async function toModes(page, ctx, n) {
  await home(page);
  if (ctx === 'multi') {
    await page.click('#btn-multi');
    for (let i = 1; i < n; i++) await page.click('#btn-lobby-add');
    await page.click('#btn-lobby-next');
  } else await page.click('#btn-single');
  await screenIs(page, 'modes');
}
async function startMode(page, mode, { ctx = 'single', n = 3, rounds = null, prep = null } = {}) {
  await toModes(page, ctx, n);
  await page.click(`.mode[data-mode=${mode}]`);
  // odpowiedź: tylko tytuł (krótsze zrzuty i jednoznaczne „dobrze”)
  await page.evaluate(() => { const r = document.querySelector('input[name=guess][value=title]'); if (r) r.checked = true; });
  if (rounds != null && await page.locator('#rounds').isVisible()) await page.fill('#rounds', String(rounds));
  if (prep) await prep(page);
  await page.click('#btn-start');
}
// odpowiedź w bieżącej turze – dobra albo zła – według trybu
async function answer(page, ok) {
  await page.evaluate((good) => {
    const m = state.mode;
    const s = state.current;
    const timeline = ['solo', 'multi', 'teams', 'timed'].includes(m);
    if (timeline) {
      const p = activePlayer();
      const c = correctSlot(p.timeline, s.y);
      onSlotClick(good ? c : (c === 0 ? p.timeline.length : 0));
      onConfirmPlacement();
      return;
    }
    const guess = (txt) => { document.querySelector('#guess-song').value = txt; document.querySelector('#guess-form').requestSubmit(); };
    if (['steps', 'cover', 'mirror', 'words'].includes(m)) { if (good) guess(s.t); else revealSteps(true); return; }
    if (m === 'melody') { guess(good ? s.t : 'zupełnie nie ta piosenka'); return; }
    if (['year', 'daily', 'climb'].includes(m)) { answerQuiz(good ? s.y : s.y + (s.y > 2015 ? -9 : 9)); return; }
    if (m === 'bid') { state.quiz.bet = 1; }
    if (isQuiz()) { const i = state.quiz.options.findIndex((o) => o.ok === good); answerQuiz(i); return; }
    if (m === 'hilo') {
      const older = s.y <= state.ref.y;
      document.querySelectorAll('#actions button.big-choice')[older === good ? 0 : 1].click();
      return;
    }
    if (m === 'duel') { const i = state.duel.indexOf(decadeOf(s)); document.querySelectorAll('#actions button.big-choice')[good ? i : 1 - i].click(); return; }
    if (m === 'royale') { royaleAlive().forEach((i, k) => royaleAnswer(i, good || k ? s.y - k : (s.y > 2010 ? s.y - 12 : s.y + 12))); return; }
    if (m === 'live') { const r = state.live.options.findIndex((o) => o.ok); liveAnswer(0, r); liveAnswer(1, good ? r : (r + 1) % 4); return; }
    if (m === 'bingo') {
      state.bingo.boards.forEach((b, i) => {
        const c = b.cells.findIndex((id, k) => !b.marked[k] && state.bingo.cats[id].test(s) === (good || i > 0));
        bingoPick(i, c >= 0 ? c : b.marked.findIndex((x) => !x));
      });
      bingoReveal();
      return;
    }
    if (m === 'sort5') { checkSort(false); return; }
    throw new Error(`brak odpowiedzi dla trybu ${m}`);
  }, ok);
  await page.waitForFunction(() => state.phase === 'revealed', null, { timeout: 15000 });
}
async function buzzIn(page) {
  await page.evaluate(() => requestBuzz(0));
  await page.waitForFunction(() => state.buzz && state.buzz.answering != null, null, { timeout: 5000 });
}
async function next(page) {
  await page.click('#actions button.primary');
  await page.waitForTimeout(200);
}
async function endNow(page) {
  await page.evaluate(() => endGame());
  await screenIs(page, 'end');
}
// gra w trybie: ekran przed odsłuchem, dobra i zła odpowiedź, koniec gry
function gameScenario(mode, title, opts = {}) {
  const { ctx = 'single', n = 3, rounds = 3, group } = opts;
  return {
    id: `gra-${mode}${ctx === 'multi' && opts.alsoSingle ? '-multi' : ''}`,
    group: group || 'Gra',
    title,
    async run({ newPage, capture }) {
      const page = await newPage();
      await startMode(page, mode, { ctx, n, rounds, prep: opts.prep });
      await ready(page);
      const id = this.id;
      await capture(page, { id: `${id}-1-start`, group: this.group, title: `${title} – nowa piosenka`, desc: 'Piosenka wczytana, przed odsłuchem.' });
      if (opts.placed) {
        await page.evaluate(() => { const p = activePlayer(); onSlotClick(correctSlot(p.timeline, state.current.y)); });
        await capture(page, { id: `${id}-2-placed`, group: this.group, title: `${title} – karta położona na osi`, desc: 'Gracz wybrał miejsce, przed zatwierdzeniem.' });
        await page.evaluate(() => { state.slot = null; state.phase = 'listen'; render(); });
      }
      if (mode === 'buzz') await buzzIn(page);
      if (mode === 'buzz') await capture(page, { id: `${id}-2-buzz`, group: this.group, title: `${title} – gracz się zgłosił`, desc: 'Pierwszy gracz nacisnął przycisk i odpowiada.' });
      if (mode === 'buzz') { await page.fill('#guess-song', await page.evaluate(() => state.current.t)); await page.press('#guess-song', 'Enter'); await page.waitForFunction(() => state.phase === 'revealed'); } else await answer(page, true);
      await capture(page, { id: `${id}-3-ok`, group: this.group, title: `${title} – dobra odpowiedź`, desc: 'Odkryta karta po dobrej odpowiedzi.' });
      if (!opts.noBad) {
        await next(page);
        if (await page.evaluate(() => !document.querySelector('#screen-game').classList.contains('hidden'))) {
          await ready(page);
          if (mode === 'buzz') { await buzzIn(page); await page.fill('#guess-song', 'zupełnie nie to'); await page.press('#guess-song', 'Enter'); await page.waitForTimeout(500); }
          else await answer(page, false);
          await capture(page, { id: `${id}-4-bad`, group: this.group, title: `${title} – zła odpowiedź`, desc: 'Odkryta karta po złej odpowiedzi.' });
        }
      }
      if (await page.evaluate(() => document.querySelector('#screen-end').classList.contains('hidden'))) await endNow(page);
      await capture(page, { id: `${id}-5-end`, group: this.group, title: `${title} – koniec gry`, desc: 'Podsumowanie gry.' });
    },
  };
}

// długa oś: n kart u każdego gracza (różne lata, po kolei) – oś do 10 kart ma być widoczna w całości, dłuższa przewija się sama
async function fillTimelines(page, n) {
  await page.evaluate((k) => {
    const used = new Set([state.current && state.current.y]);
    const pool = window.SONGS.filter((s) => !used.has(s.y) && used.add(s.y));
    state.players.forEach((p, pi) => {
      const pick = pool.filter((_, i) => i % state.players.length === pi).slice(0, k).sort((a, b) => a.y - b.y);
      p.timeline = pick.map((s, i) => (i === 0 ? { y: s.y, start: true } : s));
    });
    render();
  }, n);
}
function longTimeline(id, title, { ctx = 'single', n = 3, cards }) {
  return {
    id, group: 'Oś czasu', title,
    async run({ newPage, capture }) {
      const page = await newPage();
      await startMode(page, ctx === 'multi' ? 'multi' : 'solo', { ctx, n, rounds: 3 });
      await ready(page);
      await fillTimelines(page, cards);
      await capture(page, { id: `${id}-1-start`, group: this.group, title: `${title} – nowa piosenka`, desc: `Na osi ${cards} kart – przed odsłuchem.` });
      await page.evaluate(() => { const p = activePlayer(); onSlotClick(correctSlot(p.timeline, state.current.y)); });
      await capture(page, { id: `${id}-2-placed`, group: this.group, title: `${title} – karta położona`, desc: 'Gracz wybrał miejsce, przed zatwierdzeniem.' });
      await answer(page, true);
      await capture(page, { id: `${id}-3-ok`, group: this.group, title: `${title} – odkryta karta`, desc: 'Odkryta karta po dobrej odpowiedzi.' });
      // koniec gry z taką samą osią – oś zwycięzcy w podsumowaniu (do 10 kart w całości, dłuższa przewija się sama)
      await fillTimelines(page, cards);
      await endNow(page);
      await capture(page, { id: `${id}-4-end`, group: this.group, title: `${title} – koniec gry`, desc: `Podsumowanie, oś zwycięzcy: ${cards} kart.` });
    },
  };
}

/* ---------- ekrany ogólne ---------- */
const general = [
  { id: 'start', group: 'Start i menu', title: 'Ekran startowy', async run({ newPage, capture }) {
    const page = await newPage();
    await home(page);
    await capture(page, { id: 'start', group: this.group, title: this.title, desc: 'Pierwsze otwarcie gry.' });
    await page.click('#btn-rules');
    await page.waitForTimeout(300);
    await capture(page, { id: 'start-zasady', group: this.group, title: 'Zasady gry (okno)', desc: 'Okno z zasadami wszystkich trybów.' });
    await page.keyboard.press('Escape');
    await page.click('#btn-tv');
    await page.waitForTimeout(500);
    await capture(page, { id: 'start-duzy-ekran', group: this.group, title: 'Duży ekran – łączenie (okno)', desc: 'Okno łączenia z dużym ekranem.' });
    await page.keyboard.press('Escape');
    await page.click('#btn-settings');
    await screenIs(page, 'settings');
    await capture(page, { id: 'ustawienia', group: this.group, title: 'Ustawienia', desc: 'Ekran ustawień aplikacji.' });
    await home(page);
    await page.click('#btn-stats');
    await screenIs(page, 'stats');
    await capture(page, { id: 'statystyki-puste', group: this.group, title: 'Statystyki – bez gier', desc: 'Statystyki przed pierwszą grą.' });
    await page.evaluate(() => {
      const a = Array.from({ length: 160 }, (_, i) => { const s = window.SONGS[(i * 37) % window.SONGS.length]; return { d: `2026-10-${String(1 + (i % 15)).padStart(2, '0')}`, m: ['year', 'melody', 'solo'][i % 3], ok: i % 4 !== 0, y: s.y, g: s.g || [], k: songKey(s), t: s.t, ar: s.a }; });
      const g = Array.from({ length: 24 }, (_, i) => ({ d: `2026-10-${String(1 + (i % 15)).padStart(2, '0')}`, m: ['year', 'melody', 'solo', 'hilo', 'timed'][i % 5], s: 300, sc: 6 + (i % 5), p: 1, w: i % 2 === 0 }));
      store.set('stats', { a, g });
      store.set('recordLog', [{ d: '2026-10-10', k: 'hilo0', v: 9, l: 'Starsza czy nowsza?, Łatwy' }]);
      checkAchievements();
      renderStats();
    });
    await page.waitForTimeout(400);
    await capture(page, { id: 'statystyki', group: this.group, title: 'Statystyki – z grami i osiągnięciami', desc: 'Przykładowe statystyki: kafelki, osiągnięcia, wykresy, przenoszenie postępów.' });
  } },
  { id: 'wznowienie', group: 'Start i menu', title: 'Ekran startowy z przerwaną grą', async run({ newPage, capture }) {
    const page = await newPage();
    await startMode(page, 'solo');
    await ready(page);
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForFunction(() => window.SONGS && typeof showScreen === 'function');
    await page.waitForTimeout(500);
    await capture(page, { id: 'start-wznowienie', group: this.group, title: this.title, desc: 'Po przeładowaniu strony w trakcie gry – propozycja wznowienia.' });
  } },
  { id: 'menu', group: 'Start i menu', title: 'Wybór trybu i lobby', async run({ newPage, capture }) {
    const page = await newPage();
    await toModes(page, 'single');
    await capture(page, { id: 'tryby-1-gracz', group: this.group, title: 'Wybór trybu – jeden gracz', desc: 'Lista trybów dla jednego gracza.' });
    await home(page);
    await page.click('#btn-multi');
    await screenIs(page, 'lobby');
    await page.waitForTimeout(3000);
    await capture(page, { id: 'lobby-pusty', group: this.group, title: 'Lobby – sam gospodarz', desc: 'Multiplayer: kod pokoju i QR, jeden gracz.' });
    for (let i = 1; i < 5; i++) await page.click('#btn-lobby-add');
    await capture(page, { id: 'lobby-5', group: this.group, title: 'Lobby – 5 graczy', desc: 'Gracze dodani na tym urządzeniu.' });
    await page.click('#btn-lobby-next');
    await screenIs(page, 'modes');
    await capture(page, { id: 'tryby-multi', group: this.group, title: 'Wybór trybu – multiplayer', desc: 'Lista trybów dla 5 graczy.' });
  } },
  { id: 'kariera', group: 'Start i menu', title: 'Kariera', async run({ newPage, capture }) {
    const page = await newPage();
    await toModes(page, 'single');
    await page.evaluate(() => store.set('career', { 'artist-easy': 3, 'melody-hits': 2, 'year-80s': 1 }));
    await page.click('.mode[data-mode=career]');
    await screenIs(page, 'career');
    await capture(page, { id: 'kariera', group: 'Kariera', title: 'Kariera – lista etapów', desc: 'Trzy etapy zaliczone, czwarty odblokowany.' });
    await page.locator('.career-stage').nth(0).click();
    await ready(page);
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => answerQuiz(state.quiz.options.findIndex((o) => o.ok)));
      await next(page);
      if (i < 4) await ready(page);
    }
    await screenIs(page, 'end');
    await capture(page, { id: 'kariera-wynik', group: 'Kariera', title: 'Kariera – wynik etapu', desc: 'Trzy gwiazdki i przycisk następnego etapu.' });
  } },
];

/* ---------- ustawienia gry: każdy tryb ---------- */
const SINGLE_SETUP = ['solo', 'timed', 'hilo', 'duel', 'melody', 'steps', 'cover', 'mirror', 'words', 'year', 'artist', 'country', 'who', 'screen', 'chain', 'climb', 'bid',
  'sort5', 'bingo', 'mashup', 'lyrics', 'party'];
const MULTI_SETUP = ['multi', 'teams', 'coop', 'buzz', 'royale', 'seconds', 'bomb', 'relay', 'tour', 'live'];
const setups = [
  { id: 'ustawienia-gry', group: 'Ustawienia gry', title: 'Ustawienia gry – wszystkie tryby', timeout: 600000, async run({ newPage, capture }) {
    const page = await newPage();
    for (const [list, ctx] of [[SINGLE_SETUP, 'single'], [MULTI_SETUP, 'multi']]) {
      await toModes(page, ctx, 4);
      for (const m of list) {
        if (!await page.locator(`.mode[data-mode=${m}]`).isVisible()) continue;
        await page.click(`.mode[data-mode=${m}]`);
        await screenIs(page, 'setup');
        const name = await page.evaluate(() => document.querySelector('#setup-title').textContent);
        await capture(page, { id: `ustawienia-${ctx}-${m}`, group: this.group, title: `${name} (${ctx === 'multi' ? 'multiplayer' : '1 gracz'})`, desc: 'Ekran ustawień przed startem gry.' });
        // wygląd 6.0: ustawienia to kreator – zrzut każdego kolejnego kroku (w obecnym wyglądzie nie ma kroków)
        const steps = await page.evaluate(() => (typeof ui6SetupStep === 'function' && UI6 ? ui6SetupStep(1) : 0));
        for (let k = 2; k <= steps; k++) {
          await page.evaluate((n) => ui6SetupStep(n), k);
          await page.waitForTimeout(300);
          await capture(page, { id: `ustawienia-${ctx}-${m}-krok${k}`, group: this.group, title: `${name} (${ctx === 'multi' ? 'multiplayer' : '1 gracz'}) – krok ${k}`, desc: `Kreator ustawień 6.0 – krok ${k} z ${steps}.` });
        }
        if (steps) await page.evaluate(() => ui6SetupStep(1));
        await page.click('#btn-back');
        await screenIs(page, 'modes');
      }
    }
  } },
];

/* ---------- gra: każdy tryb ---------- */
const games = [
  gameScenario('solo', 'Oś czasu – 1 gracz', { group: 'Oś czasu', placed: true }),
  gameScenario('timed', 'Na czas', { group: 'Oś czasu' }),
  longTimeline('gra-os10', 'Oś czasu – 10 kart', { cards: 10 }),
  longTimeline('gra-os14', 'Oś czasu – 14 kart (przewijanie osi)', { cards: 14 }),
  longTimeline('gra-os10-multi', 'Oś czasu – multiplayer, po 10 kart', { ctx: 'multi', cards: 10 }),
  gameScenario('multi', 'Oś czasu – multiplayer', { group: 'Oś czasu', ctx: 'multi', placed: true }),
  gameScenario('teams', 'Oś czasu – drużyny', { group: 'Oś czasu', ctx: 'multi', n: 4 }),
  gameScenario('coop', 'Współpraca', { group: 'Oś czasu', ctx: 'multi' }),
  gameScenario('hilo', 'Starsza czy nowsza?', { group: 'Szybkie gry' }),
  gameScenario('duel', 'Pojedynek dekad', { group: 'Szybkie gry' }),
  gameScenario('melody', 'Jaka to melodia', { group: 'Zgadywanie' }),
  gameScenario('steps', 'Melodia krok po kroku', { group: 'Zgadywanie' }),
  gameScenario('cover', 'Okładka z mgły', { group: 'Zgadywanie' }),
  gameScenario('mirror', 'Krzywe zwierciadło', { group: 'Zgadywanie' }),
  gameScenario('words', 'Pierwsze słowa', { group: 'Zgadywanie', prep: (p) => p.evaluate(() => { window.LYRICS_SONGS = {}; }) }),
  gameScenario('buzz', 'Kto pierwszy?', { group: 'Zgadywanie', ctx: 'multi' }),
  gameScenario('year', 'Rok co do roku', { group: 'Quizy' }),
  gameScenario('artist', 'Kto to śpiewa?', { group: 'Quizy' }),
  gameScenario('country', 'Skąd jest wykonawca?', { group: 'Quizy' }),
  gameScenario('who', 'Kto za tym stoi?', { group: 'Quizy' }),
  gameScenario('screen', 'Z jakiego to ekranu?', { group: 'Quizy' }),
  gameScenario('chain', 'Łańcuch skojarzeń', { group: 'Quizy' }),
  gameScenario('climb', 'Dekadowa wspinaczka', { group: 'Quizy' }),
  gameScenario('bid', 'Licytacja', { group: 'Quizy' }),
  gameScenario('sort5', 'Ułóż piątkę', { group: 'Szybkie gry', noBad: true }),
  gameScenario('bingo', 'Bingo muzyczne', { group: 'Szybkie gry', ctx: 'multi' }),
  gameScenario('royale', 'Ostatni na placu boju', { group: 'Szybkie gry', ctx: 'multi' }),
  gameScenario('live', 'Pojedynek na żywo', { group: 'Szybkie gry', ctx: 'multi', n: 2 }),
  { id: 'gra-seconds', group: 'Szybkie gry', title: 'Licytacja sekund', async run({ newPage, capture }) {
    const page = await newPage();
    await startMode(page, 'seconds', { ctx: 'multi', n: 3, rounds: 1 });
    await ready(page);
    await capture(page, { id: 'gra-seconds-1-licytacja', group: this.group, title: 'Licytacja sekund – licytacja', desc: 'Gracze licytują, w ile sekund rozpoznają piosenkę.' });
    await page.locator('#actions button.secs-bid').first().click();
    await page.waitForTimeout(200);
    await capture(page, { id: 'gra-seconds-2-stawka', group: this.group, title: 'Licytacja sekund – po pierwszej stawce', desc: 'Następny gracz: mniej czy pas?' });
    await endNow(page);
    await capture(page, { id: 'gra-seconds-3-end', group: this.group, title: 'Licytacja sekund – koniec gry', desc: 'Podsumowanie.' });
  } },
  { id: 'gra-bomb', group: 'Szybkie gry', title: 'Gorąca bomba', async run({ newPage, capture }) {
    const page = await newPage();
    await startMode(page, 'bomb', { ctx: 'multi', n: 3 });
    await ready(page);
    await capture(page, { id: 'gra-bomb-1-start', group: this.group, title: 'Gorąca bomba – przed startem', desc: 'Bombę trzyma pierwszy gracz.' });
    await page.evaluate(() => bombStart());
    await page.waitForTimeout(600);
    await capture(page, { id: 'gra-bomb-2-pytanie', group: this.group, title: 'Gorąca bomba – pytanie', desc: 'Tyka bomba, gracz odpowiada na pytanie o piosenkę.' });
    await endNow(page);
    await capture(page, { id: 'gra-bomb-3-end', group: this.group, title: 'Gorąca bomba – koniec gry', desc: 'Podsumowanie.' });
  } },
  { id: 'gra-mashup', group: 'Zgadywanie', title: 'Mikser', async run({ newPage, capture }) {
    const page = await newPage();
    await startMode(page, 'mashup', { rounds: 1 });
    await page.waitForFunction(() => state.phase === 'listen' && state.current && state.mashup, null, { timeout: 30000 });
    await capture(page, { id: 'gra-mashup-1-start', group: this.group, title: 'Mikser – dwie piosenki naraz', desc: 'Przed odsłuchem.' });
    await page.evaluate(() => { document.querySelector('#guess-song').value = state.current.t; mashupGuess(); });
    await page.waitForTimeout(300);
    await capture(page, { id: 'gra-mashup-2-po', group: this.group, title: 'Mikser – po odpowiedzi', desc: 'Jeden tytuł odgadnięty.' });
    await endNow(page);
    await capture(page, { id: 'gra-mashup-3-end', group: this.group, title: 'Mikser – koniec gry', desc: 'Podsumowanie.' });
  } },
  { id: 'gra-daily', group: 'Quizy', title: 'Wyzwanie dnia', async run({ newPage, capture }) {
    const page = await newPage();
    await toModes(page, 'single');
    await page.click('.mode[data-mode=daily]');
    await ready(page);
    await capture(page, { id: 'gra-daily-1-start', group: this.group, title: 'Wyzwanie dnia – piosenka', desc: '10 piosenek wspólnych dla wszystkich.' });
    await answer(page, true);
    await capture(page, { id: 'gra-daily-2-ok', group: this.group, title: 'Wyzwanie dnia – dobra odpowiedź', desc: '' });
    await endNow(page);
    await capture(page, { id: 'gra-daily-3-end', group: this.group, title: 'Wyzwanie dnia – wynik do udostępnienia', desc: '' });
  } },
];

/* ---------- Tak to leciało!, Sztafeta ---------- */
// katalog jak w testach: polskie piosenki z bazy, film i tekst z atrapy (długość 180 s zgodna z atrapą odtwarzacza)
const lyCatalogPrep = (p) => p.evaluate(() => {
  const pl = window.SONGS.filter((s) => s.c === 'PL').slice(0, 400);
  window.LYRICS_SONGS = Object.fromEntries(pl.map((s, i) => [songKey(s), [`vid${i}`, 1000 + i, 180]]));
});
const lyrics = [
  { id: 'lyrics', group: 'Tak to leciało!', title: 'Tak to leciało!', timeout: 180000, async run({ newPage, capture }) {
    const page = await newPage();
    await startMode(page, 'lyrics', { prep: lyCatalogPrep });
    await screenIs(page, 'lyrics');
    await page.waitForTimeout(300);
    const g = this.group;
    await capture(page, { id: 'lyrics-1-plansza', group: g, title: 'Plansza kategorii', desc: '9 kategorii i hit za 100 000 zł.' });
    await page.locator('.ly-cat').first().click();
    await capture(page, { id: 'lyrics-2-piosenki', group: g, title: 'Wybór piosenki w kategorii', desc: 'Dwie piosenki z rokiem wydania.' });
    await page.evaluate(() => { window.__ytSpeed = 1; });
    await page.locator('.ly-song').first().click();
    await page.waitForFunction(() => state.phase === 'play' && state.lyrics.cur && state.lyrics.cur.lines, null, { timeout: 20000 });
    await page.waitForTimeout(2500);
    await capture(page, { id: 'lyrics-3-spiew', group: g, title: 'W trakcie piosenki', desc: 'Film gra, tekst przewija się jak w karaoke.' });
    await page.evaluate(() => { window.__ytSpeed = 60; });
    await page.waitForFunction(() => state.phase === 'answer', null, { timeout: 30000 }).catch(async (e) => {
      throw new Error(`${e.message} | ${await page.evaluate(() => JSON.stringify({ ph: state.phase, st: state.lyrics.cur.started, t: lyYT && lyYT.getCurrentTime(), gap: state.lyrics.cur.gap && state.lyrics.cur.gap.pauseAt, tick: !!lyTick }))}`);
    });
    await capture(page, { id: 'lyrics-4-przerwa', group: g, title: 'Przerwa – dokończ wers', desc: 'Muzyka milknie, gracz wpisuje brakujący wers.' });
    await page.evaluate(() => lyThree());
    await capture(page, { id: 'lyrics-5-trzy-wersje', group: g, title: 'Koło ratunkowe: trzy wersje wersu', desc: '' });
    await page.evaluate(() => {
      const cur = state.lyrics.cur;
      const inp = document.querySelector('#ly-input');
      inp.value = cur.gap.blanks.map((b) => b.want).join(' ');
      inp.dispatchEvent(new Event('input'));
      lySubmit();
    });
    await page.waitForFunction(() => state.lyrics.cur && state.lyrics.cur.revealing, null, { timeout: 20000 });
    await capture(page, { id: 'lyrics-6-dobrze', group: g, title: 'Dobra odpowiedź', desc: 'Prawidłowy wers pojawia się, gdy jest śpiewany.' });
    await page.evaluate(() => { const p = state.players[0]; p.stage = 9; p.score = 75000; p.board.forEach((c) => { c.done = true; }); lyNextTurn(); });
    await page.waitForTimeout(300);
    await capture(page, { id: 'lyrics-7-hit', group: g, title: 'Hit za 100 000 zł', desc: 'Po 9 kategoriach: gram albo rezygnuję.' });
    await page.locator('.ly-hit').click();
    await capture(page, { id: 'lyrics-8-decyzja', group: g, title: 'Hit – decyzja', desc: 'Rezygnacja z 75 000 zł albo gra o 100 000 zł.' });
    await page.evaluate(() => { state.players[0].out = true; lyEnd(); });
    await screenIs(page, 'end');
    await capture(page, { id: 'lyrics-9-end', group: g, title: 'Koniec gry', desc: '' });
  } },
  { id: 'relay', group: 'Tak to leciało!', title: 'Sztafeta karaoke', timeout: 180000, async run({ newPage, capture }) {
    const page = await newPage();
    await startMode(page, 'relay', { ctx: 'multi', n: 3, rounds: 1, prep: lyCatalogPrep });
    await page.waitForFunction(() => state.phase === 'answer', null, { timeout: 30000 });
    await capture(page, { id: 'relay-1-przerwa', group: this.group, title: 'Sztafeta – przerwa dla gracza', desc: 'Odpowiada pierwszy gracz.' });
    await page.evaluate(() => { const inp = document.querySelector('#ly-input'); inp.value = 'zupełnie inne słowa'; inp.dispatchEvent(new Event('input')); lySubmit(); });
    await page.waitForTimeout(500);
    await capture(page, { id: 'relay-2-wynik', group: this.group, title: 'Sztafeta – po odpowiedzi', desc: 'Zła odpowiedź; przycisk „Dalej – śpiewa …”.' });
    await page.evaluate(() => lyEnd());
    await screenIs(page, 'end');
    await capture(page, { id: 'relay-3-end', group: this.group, title: 'Sztafeta – koniec', desc: '' });
  } },
];

/* ---------- impreza, turniej ---------- */
const events = [
  { id: 'party', group: 'Impreza i turniej', title: 'Impreza', timeout: 180000, async run({ newPage, capture }) {
    const page = await newPage();
    await home(page);
    await page.evaluate(() => store.set('partyGames', ['artist', 'year', 'hilo']));
    await startMode(page, 'party', { ctx: 'multi', n: 3 });
    // wygląd 6.0: impreza jako teleturniej – plansza zapowiedzi, tablica wyników, finał „Ostatnie odliczanie”
    const ui6 = await page.evaluate(() => typeof UI6 !== 'undefined' && UI6);
    const p6 = (kind) => page.waitForSelector(`#p6[open][data-kind=${kind}]`, { timeout: 15000 });
    const p6go = async () => { await page.click('#p6 .p6-go'); await page.click('#p6 .p6-acts .ghost'); };
    if (ui6) {
      await p6('intro');
      await capture(page, { id: 'party-0-zapowiedz', group: this.group, title: 'Impreza 6.0 – zapowiedź rundy', desc: 'Runda 1 z 5: ikona, zasada, modyfikator, prowadzący, „Zaczynamy!”.' });
      await p6go();
    }
    await ready(page);
    await capture(page, { id: 'party-1-minigra', group: this.group, title: 'Impreza – minigra', desc: 'Pasek „Minigra 1 z 5”.' });
    if (ui6) {
      await page.evaluate(() => { state.players.forEach((p, i) => { p.score = 3 - i; }); });
      await endNow(page);
      await p6('board');
      await page.waitForTimeout(1500);
      await capture(page, { id: 'party-2a-tablica', group: this.group, title: 'Impreza 6.0 – tablica wyników po rundzie', desc: 'Przyrost punktów, miejsca, komentarz prowadzącego.' });
      await page.click('#p6 .p6-acts .ghost');
    } else await endNow(page);
    await capture(page, { id: 'party-2-przerwa', group: this.group, title: 'Impreza – klasyfikacja po minigrze', desc: 'Przerwa między minigrami.' });
    if (ui6) {
      // druga runda ze złodziejem punktów: Gracz 3 wygrywa i wybiera ofiarę
      await page.evaluate(() => { state.party.mods[1] = 'thief'; document.querySelector('#btn-party-next').click(); });
      await p6('intro');
      await capture(page, { id: 'party-2b-zapowiedz-zlodziej', group: this.group, title: 'Impreza 6.0 – zapowiedź rundy z modyfikatorem', desc: 'Złodziej punktów.' });
      await p6go();
      await ready(page);
      await page.evaluate(() => { state.players.forEach((p) => { p.score = 0; }); state.players[2].score = 5; });
      await endNow(page);
      await page.waitForSelector('#p6 .p6-victim', { timeout: 15000 });
      await capture(page, { id: 'party-2c-zlodziej', group: this.group, title: 'Impreza 6.0 – złodziej punktów', desc: 'Zwycięzca rundy wybiera, komu zabrać punkty.' });
      await page.click('#p6 .p6-victim');
      // od razu finał (pozostałe rundy pominięte)
      await page.evaluate(() => { state.party.plan = state.party.plan.slice(0, state.party.idx); });
      await page.click('#p6 .p6-next');
      await p6('final');
      await capture(page, { id: 'party-4-final-zasady', group: this.group, title: 'Impreza 6.0 – finał: zasady', desc: 'Punkty zamieniają się w sekundy na podestach.' });
      await page.click('#p6 .p6-go');
      await page.waitForSelector('#p6 .p6-opt', { timeout: 15000 });
      // zatrzymany zegar – zrzut na wszystkich urządzeniach w tym samym stanie
      await page.evaluate(() => { clearInterval(party6.fin.iv); });
      await capture(page, { id: 'party-5-final', group: this.group, title: 'Impreza 6.0 – finał „Ostatnie odliczanie”', desc: 'Podesty z sekundami, pytanie dla gracza, cztery odpowiedzi.' });
      await page.evaluate(() => { const f = party6.fin; f.secs = f.secs.map((x, i) => (i === 2 ? x : 0)); party6.answer(-1); });
      await p6('podium');
      await capture(page, { id: 'party-6-podium', group: this.group, title: 'Impreza 6.0 – zwycięzca finału', desc: 'Podium po finale.' });
      await page.click('#p6 .p6-go');
    } else await page.click('#btn-party-stop');
    await capture(page, { id: 'party-3-koniec', group: this.group, title: 'Impreza – koniec', desc: 'Klasyfikacja końcowa.' });
  } },
  { id: 'tour', group: 'Impreza i turniej', title: 'Turniej', timeout: 180000, async run({ newPage, capture }) {
    const page = await newPage();
    await startMode(page, 'tour', { ctx: 'multi', n: 5 });
    await ready(page);
    await capture(page, { id: 'tour-1-mecz', group: this.group, title: 'Turniej – mecz', desc: 'Dwóch graczy, minigra „Kto to śpiewa?”.' });
    await endNow(page);
    await capture(page, { id: 'tour-2-drabinka', group: this.group, title: 'Turniej – drabinka po meczu', desc: '' });
    await page.click('#btn-party-stop');
    await capture(page, { id: 'tour-3-koniec', group: this.group, title: 'Turniej – przerwany', desc: '' });
  } },
];

/* ---------- duży ekran i telefony graczy (PeerJS – jak w prawdziwej grze) ---------- */
const devices = [
  { id: 'tv-i-telefony', group: 'Duży ekran i telefony', title: 'Duży ekran i telefon gracza', timeout: 300000, async run({ newPage, capture, TV_DEVICES, PHONE_DEVICES }) {
    const g = this.group;
    const tv = await newPage(TV_DEVICES.tv);
    await tv.goto('/tv.html');
    await tv.waitForSelector('#net-box:not(.hidden)', { timeout: 40000 });
    await capture(tv, { id: 'tv-1-kod', group: g, title: 'Duży ekran – kod do połączenia', desc: 'Telewizor czeka na grę.' }, TV_DEVICES);
    const tvCode = (await tv.textContent('.net-code')).trim();
    const host = await newPage();
    await host.goto(`/index.html?tv=${tvCode}`);
    await host.waitForFunction(() => [...remotes].some((r) => r.role === 'tv'), null, { timeout: 40000 });
    await host.keyboard.press('Escape');
    await host.click('#btn-multi');
    await host.waitForFunction(() => !!roomCode, null, { timeout: 40000 });
    await tv.waitForFunction(() => last && last.screen === 'lobby', null, { timeout: 40000 });
    await tv.waitForTimeout(800);
    await capture(tv, { id: 'tv-2-lobby', group: g, title: 'Duży ekran – lobby z kodem QR', desc: 'Gospodarz otworzył multiplayer.' }, TV_DEVICES);
    const code = await host.evaluate(() => roomCode);
    const ania = await newPage();
    await ania.goto(`/tv.html?join=${code}`);
    await ania.waitForSelector('.join-name', { timeout: 40000 });
    await capture(ania, { id: 'telefon-1-dolaczanie', group: g, title: 'Telefon gracza – dołączanie', desc: 'Po zeskanowaniu kodu: wpisanie imienia.' }, PHONE_DEVICES);
    await ania.fill('.join-name', 'Ania');
    await ania.click('.join-form button');
    await ania.waitForSelector('.phone-info', { timeout: 15000 });
    await host.click('#btn-lobby-add');
    await host.click('#btn-lobby-next');
    await tv.waitForSelector('.modes-board .mb-tile', { timeout: 20000 });
    await ania.waitForTimeout(800);
    await capture(tv, { id: 'tv-3-tryby', group: g, title: 'Duży ekran – wybór trybu', desc: '' }, TV_DEVICES);
    await capture(ania, { id: 'telefon-2-tryby', group: g, title: 'Telefon gracza – głosowanie na tryb', desc: '' }, PHONE_DEVICES);
    // oś czasu multiplayer
    await host.click('.mode[data-mode=multi]');
    await tv.waitForSelector('.setup-board', { timeout: 20000 });
    await capture(tv, { id: 'tv-4-ustawienia', group: g, title: 'Duży ekran – ustawienia gry', desc: '' }, TV_DEVICES);
    await host.click('#btn-start');
    await ready(host);
    await tv.waitForSelector('.turn-card', { timeout: 20000 });
    await tv.waitForTimeout(800);
    await capture(tv, { id: 'tv-5-os', group: g, title: 'Duży ekran – oś czasu w trakcie gry', desc: '' }, TV_DEVICES);
    await ania.waitForTimeout(500);
    const aniaTurn = await host.evaluate(() => activePlayer().name === 'Ania');
    await capture(ania, { id: 'telefon-3-os', group: g, title: aniaTurn ? 'Telefon gracza – moja kolej (oś czasu)' : 'Telefon gracza – kolej innego gracza (oś czasu)', desc: '' }, PHONE_DEVICES);
    await host.evaluate(() => { const p = activePlayer(); onSlotClick(correctSlot(p.timeline, state.current.y)); onConfirmPlacement(); });
    await tv.waitForTimeout(800);
    await capture(tv, { id: 'tv-6-odkryta', group: g, title: 'Duży ekran – odkryta karta', desc: '' }, TV_DEVICES);
    await capture(ania, { id: 'telefon-4-odkryta', group: g, title: 'Telefon gracza – odkryta karta', desc: '' }, PHONE_DEVICES);
    // quiz
    await host.evaluate(() => { state.mode = 'artist'; showModes(); });
    await host.click('.mode[data-mode=artist]');
    await host.click('#btn-start');
    await ready(host);
    await tv.waitForTimeout(1000);
    await capture(tv, { id: 'tv-7-quiz', group: g, title: 'Duży ekran – quiz „Kto to śpiewa?”', desc: '' }, TV_DEVICES);
    await capture(ania, { id: 'telefon-5-quiz', group: g, title: 'Telefon gracza – quiz', desc: '' }, PHONE_DEVICES);
    await host.evaluate(() => endGame());
    await tv.waitForTimeout(1000);
    await capture(tv, { id: 'tv-8-wyniki', group: g, title: 'Duży ekran – wyniki', desc: '' }, TV_DEVICES);
    await capture(ania, { id: 'telefon-6-wyniki', group: g, title: 'Telefon gracza – wyniki', desc: '' }, PHONE_DEVICES);
  } },
];

export const SCENARIOS = [...general, ...setups, ...games, ...lyrics, ...events, ...devices];
