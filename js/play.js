'use strict';
// Songster – przebieg gry: start, impreza, liga, losowanie piosenek.
// Pliki js/*.js to zwykłe skrypty ładowane po kolei (index.html) – współdzielą zmienne globalne.
/* ---------- przebieg gry ---------- */
// over – ustawienia minigry w trybie „Impreza” (party: rodzaj minigry, rounds, winTarget, timeLimit)
function startGame(over = {}) {
  const party = over.party || null;
  // Turniej: mecz (over.tour) to krótka minigra dwóch graczy
  if (!over.tour) state.tour = null;
  if (!party) {
    state.baseMode = over.tour ? 'tour' : state.mode;
    state.party = null;
    // głosy dotyczyły tej gry – przy następnym wyborze trybu głosujemy od nowa
    lobby.votes.clear();
    if (state.mode === 'party') { startParty(); return; }
    if (state.mode === 'tour') { startTournament(); return; }
  }
  // współpraca = oś jednego gracza dla wspólnej drużyny, w której wszyscy odpowiadają po kolei
  state.coop = !party && state.mode === 'coop';
  if (state.coop && readSetupRows().length < MODES.coop.minPlayers) {
    alert(T('W tym trybie potrzeba co najmniej {0} – dodaj kolejnego gracza albo dołącz go przez telefon.', MODES.coop.minPlayers));
    return;
  }
  const coopRows = state.coop ? [{ name: T('Drużyna'), members: readSetupRows().map((r) => r.name.trim()).filter(Boolean).join(', ') }] : null;
  if (state.coop) state.mode = 'solo';
  const teams = !!MODES[state.mode].teams;
  // Kariera: etap gra zawsze jeden gracz (bez ekranu ustawień)
  if (!over.career) state.career = null;
  const setupRows = party ? state.party.rows : (over.rows || coopRows || readSetupRows());
  if (setupRows.length < minPlayersFor(party ? 'party' : state.mode)) {
    alert(T('W tym trybie potrzeba co najmniej {0} – dodaj kolejnego gracza albo dołącz go przez telefon.', minPlayersFor(state.mode)));
    return;
  }
  const rows = setupRows.map((r, i) => ({ name: r.name.trim() || `${teams ? T('Drużyna') : T('Gracz')} ${i + 1}`, members: r.members }));
  const names = rows.map((r) => r.name);
  if (!party && !state.coop && !over.rows) {
    if (teams) store.set('teams', rows); else store.set('players', names);
    // gracze ustawieni w grze wieloosobowej wracają do lobby (zmienione imiona, dopisani gracze)
    if (playCtx === 'multi' && !teams) {
      const phones = remoteNames();
      lobby.players = [...names.map((name) => lobby.players.find((p) => p.name === name) || { name }),
        ...lobby.players.filter((p) => phones.has(p.name) && !names.includes(p.name))].slice(0, MAX_PLAYERS);
      saveLobbyLocal();
    }
  }
  // Tak to leciało! – osobny przebieg gry (lyrics.js)
  if (state.mode === 'lyrics') return startLyrics(rows, party ? { rounds: over.rounds || 1 } : null);
  // Sztafeta karaoke – ta sama gra z tekstem, kilka przerw w piosence, gracze śpiewają na zmianę
  if (state.mode === 'relay') return startLyrics(rows, { rounds: over.rounds || clampInt($('#rounds').value, 1, 30, 3), relay: true });
  // klawisze „Kto pierwszy?” – bez powtórzeń (w imprezie gracze nie wybierali ich w ustawieniach)
  const usedKeys = [];
  state.buzzKeys = setupRows.map((r) => {
    const k = r.key && !usedKeys.includes(r.key) ? r.key : freeBuzzKey(usedKeys);
    usedKeys.push(k);
    return k;
  });
  if (state.mode === 'buzz' && !party) {
    store.set('buzzKeys', state.buzzKeys);
    const byName = store.get('buzzKeyByName', {});
    names.forEach((n, i) => { byName[n] = state.buzzKeys[i]; });
    store.set('buzzKeyByName', byName);
  }
  const startTokens = clampInt($('#start-tokens').value, 0, MAX_TOKENS, 2);
  const lives = clampInt($('#lives').value, 1, 10, 3);
  state.winTarget = over.winTarget || clampInt($('#win-target').value, 3, 30, 10);
  state.rounds = over.rounds != null ? over.rounds : clampInt($('#rounds').value, 1, 30, 5);
  // „Starsza czy nowsza?” dla kilku graczy: kolejno, każdy po rounds piosenek (bez kończenia na pomyłce)
  state.hiloMulti = state.mode === 'hilo' && names.length > 1;
  state.guessType = document.querySelector('input[name=guess]:checked').value;
  state.difficulty = filterState.level;
  state.showAll = filterState.showAll;
  state.endless = state.mode === 'solo' && !party && filterState.endless;
  state.challengeMode = filterState.challenge;
  state.challengeYear = null;
  state.recordLevel = recordKey();
  state.expert = isTimeline() && !party ? expertParts() : [];
  state.letterHint = filterState.letterHint;
  const plShare = poolValue() === 'ALL' ? filterState.plShare / 100 : (poolValue() === 'PL' ? 1 : 0);
  const needed = state.mode === 'royale' || state.mode === 'bomb' || state.mode === 'live' ? 30 : state.mode === 'buzz' ? state.rounds : state.mode === 'bingo' || state.mode === 'climb' ? 20 : state.mode === 'sort5' ? names.length * state.rounds * 5
    : (state.hiloMulti ? names.length * state.rounds + 2 : (isTimeline() || state.mode === 'hilo' ? names.length * 3 : names.length * state.rounds));
  let base = songPool();
  // tryby quizowe: podpowiedzi z tej samej puli; „Skąd jest wykonawca?” – tylko piosenki z flagą kraju
  if (state.mode === 'country') base = base.filter((s) => s.cc && hasFlag(s.cc));
  // „Kto za tym stoi?” – tylko piosenki, o które da się zadać pytanie (z 3 błędnymi odpowiedziami)
  if (state.mode === 'who') {
    if (!window.SONG_FACTS) { loadFacts().then(() => (window.SONG_FACTS ? startGame(over) : alert(T('Nie udało się wczytać danych o piosenkach – spróbuj ponownie.')))); return; }
    base = base.filter((s) => whoQuestions(s).length);
  }
  // Łańcuch skojarzeń – powiązania przez autorów piosenek pochodzą z danych Wikidata
  if (state.mode === 'chain' && !window.SONG_FACTS) {
    loadFacts().then(() => (window.SONG_FACTS ? startGame(over) : alert(T('Nie udało się wczytać danych o piosenkach – spróbuj ponownie.')))); return;
  }
  // „Z jakiego to ekranu?” – piosenki z filmów, seriali i gier (część danych pochodzi z Wikidata)
  if (state.mode === 'screen') {
    if (!window.SONG_FACTS) { loadFacts().then(() => (window.SONG_FACTS ? startGame(over) : alert(T('Nie udało się wczytać danych o piosenkach – spróbuj ponownie.')))); return; }
    base = base.filter((s) => songWorks(s).length);
  }
  state.quizPool = base;
  state.duelPool = null;
  if (state.mode === 'duel') {
    // „Losowo” (albo impreza): nowa para dekad przy każdej piosence; wybrane w ustawieniach – te same przez całą grę
    const random = !!party || (filterState.duelA == null && filterState.duelB == null);
    const decades = [...new Set(base.map(decadeOf))].sort((x, y) => x - y);
    if (random && decades.length >= 2) {
      state.duelPool = decades;
      state.duel = null;
    } else {
      state.duel = pickDuelDecades(base, needed, random);
      if (!state.duel) { alert(T('Za mało piosenek w wybranej puli dla tych ustawień.')); return; }
      base = base.filter((s) => state.duel.includes(decadeOf(s)));
    }
  }
  const pool = freshPool(base, needed);
  state.deck = state.mode === 'chain' ? new ChainDeck(pool) : state.mode === 'climb' ? new ClimbDeck(pool)
    : new Deck(pool, { level: state.difficulty, plShare });
  warmPreviews(pool);
  prefetched = null;
  const artists = new Set(pool.map((s) => artistKeys(s)[0])).size;
  if (state.deck.size < needed || artists < needed) {
    alert(T('Za mało piosenek w wybranej puli dla tych ustawień.'));
    return;
  }
  state.timeLimit = over.timeLimit || filterState.timeLimit || 120;
  state.timeLeft = state.timeLimit * 1000;
  state.specials = isTimeline() && !party ? (filterState.specials || []).filter((k) => isMulti() || k === 'double' || k === 'golden') : [];
  state.startedAt = Date.now();
  state.buzz = null;
  state.ref = null;
  state.streak = 0;
  state.players = rows.map((r) => ({
    name: r.name, tokens: startTokens, timeline: [], score: state.mode === 'bid' ? BID_START : 0, lives,
    members: teams || state.coop ? (r.members || '').split(/[,;\n]+/).map((m) => m.trim()).filter(Boolean) : [], member: 0,
  }));
  if (isTimeline()) dealStartYears(songPool());
  state.bingo = null;
  state.moments = [];
  state.bigMiss = 0;
  if (state.mode === 'bingo') startBingo();
  if (state.mode === 'royale') startRoyale();
  if (state.mode === 'bomb') startBomb();
  state.secsStart = null;
  state.turn = Math.floor(Math.random() * names.length);
  state.turnsPlayed = 0;
  state.history = [];
  if (state.mode === 'hilo') {
    // karta startowa: odkryta piosenka (bez odtwarzania)
    state.ref = state.deck.draw();
    markPlayed(state.ref);
  }
  if (!party) window.track && window.track('start-gry', {
    tryb: state.mode, gra: playCtx, poziom: (LEVELS[filterState.level] || LEVELS[1]).name, zestaw: filterState.tag || (renderPresetsActive() || 'wlasne'),
    graczy: names.length, ekspert: state.expert.join('+') || 'nie', specjalne: state.specials.join('+') || 'nie', jezyk: LANG,
  });
  showScreen('game');
  startTurn();
  return true;
}

/* ---------- Impreza: seria minigier ---------- */
// wybór minigier w ustawieniach (zapamiętany); niedostępne dla tej liczby graczy są wyszarzone
// długość minigier (mnożnik liczby piosenek / kart / czasu) i punktacja imprezy – zapamiętywane
$$('input[name=party-len]').forEach((r) => {
  r.checked = Number(r.value) === store.get('partyLen', 1);
  r.addEventListener('change', () => { store.set('partyLen', Number(r.value)); renderPartyPick(); });
});
// impreza na czas: losowe minigry, aż minie 15 / 30 / 45 minut (0 – zwykła liczba minigier)
const partyTimeSync = () => {
  const t = store.get('partyTime', 0);
  $('#party-games-row').classList.toggle('hidden', t > 0);
  $('#party-time-info').classList.toggle('hidden', !t);
};
$$('input[name=party-time]').forEach((r) => {
  r.checked = Number(r.value) === store.get('partyTime', 0);
  r.addEventListener('change', () => { store.set('partyTime', Number(r.value)); partyTimeSync(); });
});
partyTimeSync();
$$('input[name=party-score]').forEach((r) => {
  r.checked = r.value === store.get('partyScore', 'places');
  r.addEventListener('change', () => { store.set('partyScore', r.value); renderPartyPick(); });
});
function renderPartyPick() {
  const n = readSetupRows().length || 1;
  const avail = partyGamesFor(n);
  const chosen = new Set(store.get('partyGames', Object.keys(PARTY_GAMES)));
  $('#party-pick').replaceChildren(...Object.entries(PARTY_GAMES).map(([id, g]) => {
    const input = el('input', { type: 'checkbox', value: id });
    input.checked = chosen.has(id);
    input.disabled = !avail.includes(id);
    input.addEventListener('change', () => {
      const set = new Set(store.get('partyGames', Object.keys(PARTY_GAMES)));
      if (input.checked) set.add(id); else set.delete(id);
      store.set('partyGames', [...set]);
      renderPartyPick();
    });
    return el('label', { class: input.disabled ? 'off' : '' }, input, ` ${g.icon} ${T(g.name)}`);
  }));
  const games = partyChoice(n);
  $('#party-desc').textContent = (n === 1
    ? T('Jedna osoba: wyniki z minigier sumują się (punkty, seria, ułożone karty). Minigra „Oś czasu” to minuta na czas.')
    : (store.get('partyScore', 'places') === 'sum'
      ? T('Punkty z minigier sumują się (punkty, seria, ułożone karty). „Kto pierwszy?” – od 2 graczy, „Oś czasu” – do 8 graczy.')
      : T('Za każdą minigrę: 1. miejsce – 3 pkt, 2. – 2 pkt, 3. – 1 pkt (remis – tyle samo). Minigra „Oś czasu” to wyścig do 4 kart (do 8 graczy), „Kto pierwszy?” – od 2 graczy.')))
    + ' ' + T('W grze: {0}.', games.map((id) => `${PARTY_GAMES[id].icon} ${T(PARTY_GAMES[id].name)}`).join(', '));
}
$('#players-list').addEventListener('click', () => { if (state.mode === 'party') setTimeout(renderPartyPick, 0); });
// minigry, które zagrają: wybrane i dostępne dla tej liczby graczy (gdy nic nie wybrano – wszystkie dostępne)
function partyChoice(n) {
  const avail = partyGamesFor(n);
  const chosen = store.get('partyGames', Object.keys(PARTY_GAMES)).filter((id) => avail.includes(id));
  return chosen.length ? chosen : avail;
}
function startParty() {
  const rows = readSetupRows().map((r, i) => ({ ...r, name: r.name.trim() || `${T('Gracz')} ${i + 1}` }));
  if (!rows.length) return;
  const minutes = store.get('partyTime', 0);
  // na czas: plan z zapasem, impreza kończy się po minigrze, w której minął czas
  const count = minutes ? 60 : clampInt($('#party-games').value, 2, 12, 5);
  const games = partyChoice(rows.length);
  // kolejność: losowo, każda minigra przed powtórką, bez dwóch takich samych pod rząd
  const plan = [];
  while (plan.length < count) {
    const round = shuffle(games.slice());
    if (plan.length && round.length > 1 && round[0] === plan[plan.length - 1]) round.push(round.shift());
    plan.push(...round);
  }
  state.party = { rows, plan: plan.slice(0, count), idx: 0, points: rows.map(() => 0), last: [], done: false, until: minutes ? Date.now() + minutes * 60000 : 0,
    len: store.get('partyLen', 1), scoring: playCtx === 'multi' ? store.get('partyScore', 'places') : 'sum' };
  store.set('players', rows.map((r) => r.name));
  window.track && window.track('start-gry', { tryb: 'party', gra: playCtx, graczy: rows.length, minigier: count, jezyk: LANG });
  playPartyGame();
}
function playPartyGame() {
  const pt = state.party;
  const n = pt.rows.length;
  while (pt.idx < pt.plan.length) {
    // wygląd 6.0: plansza zapowiedzi rundy (teleturniej) – po „Zaczynamy!” wraca tu i startuje minigrę
    if (UI6 && party6.intro(pt, playPartyGame)) return;
    const g = PARTY_GAMES[pt.plan[pt.idx]];
    state.mode = g.mode(n);
    // dłuższe minigry: więcej piosenek, więcej kart do zebrania, więcej czasu
    const o = g.opts(n);
    const len = pt.len || 1;
    const opts = { ...o, rounds: o.rounds ? o.rounds * len : o.rounds, winTarget: o.winTarget ? o.winTarget + len - 1 : o.winTarget,
      timeLimit: o.timeLimit ? o.timeLimit * len : o.timeLimit };
    if (startGame({ party: pt.plan[pt.idx], ...opts })) return;
    pt.idx += 1; // za mało piosenek dla tej minigry – następna
  }
  // wygląd 6.0: na koniec finał „Ostatnie odliczanie” – po nim partyFinish()
  if (UI6 && party6.finale(pt, partyFinish)) return;
  partyFinish();
}
function partyFinish() {
  state.mode = 'party';
  $('#ranking').replaceChildren();
  partyStandings(true);
  updateEndButtons();
  showScreen('end');
}
// wynik gracza w minigrze: seria, ułożone karty albo punkty
function partyMetric(p) {
  if (state.mode === 'hilo' && !state.hiloMulti) return state.streak;
  if (isTimeline()) return p.timeline.filter((c) => !c.start).length;
  return p.score;
}
// po minigrze: punkty imprezy (jedna osoba – suma wyników, kilka – 3/2/1 pkt za miejsca) i klasyfikacja
function partyAfterGame() {
  const pt = state.party;
  const res = state.players.map((p) => partyMetric(p));
  const gained = res.map((v) => {
    if (pt.rows.length === 1 || pt.scoring === 'sum') return v;
    if (v <= 0) return 0;
    const better = new Set(res.filter((x) => x > v)).size;
    return Math.max(0, 3 - better);
  });
  // pominięta minigra – bez punktów
  if (state.miniSkipped) gained.fill(0);
  // wygląd 6.0: modyfikator rundy (podwójne punkty, wszystko albo nic…)
  if (UI6) party6.score(pt, gained);
  gained.forEach((g, i) => { pt.points[i] += g; });
  pt.last = gained;
  pt.idx += 1;
  // impreza na czas: po upływie czasu ta minigra była ostatnia
  if (pt.until && Date.now() >= pt.until) pt.plan = pt.plan.slice(0, pt.idx);
  // wygląd 6.0: po ostatniej minigrze jeszcze finał
  partyStandings(pt.idx >= pt.plan.length && !(UI6 && party6.wantsFinal(pt)));
}
function partyStandings(final) {
  const pt = state.party;
  pt.done = final;
  const g = PARTY_GAMES[pt.plan[Math.max(0, pt.idx - 1)]];
  const order = pt.rows.map((r, i) => ({ i, name: r.name, pts: pt.points[i], last: pt.last[i] || 0 })).sort((a, b) => b.pts - a.pts);
  // finał „Ostatnie odliczanie” (wygląd 6.0): kolejność według tego, kto dłużej został na placu
  if (pt.finalRank) order.sort((a, b) => pt.finalRank[a.i] - pt.finalRank[b.i]);
  const title = $('#winner-title');
  const kicker = el('p', { class: 'party-kicker' }, final ? T('🥳 Koniec imprezy!') : pt.until ? T('🥳 Minigra {0}: {1} {2}', pt.idx, g.icon, T(g.name))
    : T('🥳 Minigra {0} z {1}: {2} {3}', pt.idx, pt.plan.length, g.icon, T(g.name)));
  if (final) {
    if (pt.rows.length === 1) {
      const prev = saveRecord(`party${state.difficulty}`, order[0].pts, T('Impreza, {0}', (LEVELS[state.difficulty] || LEVELS[1]).name));
      title.textContent = order[0].pts > prev ? T('🏆 Nowy rekord imprezy: {0} pkt (poprzedni: {1})!', order[0].pts, prev)
        : T('Wynik imprezy: {0} pkt (rekord: {1}).', order[0].pts, prev);
    } else {
      const tie = !pt.finalRank && order.length > 1 && order[1].pts === order[0].pts;
      title.textContent = pt.finalRank ? T('🏆 Imprezę wygrywa {0} – ostatni na placu w finale!', order[0].name) : tie ? T('🤝 Remis! ({0} pkt)', order[0].pts) : T('🏆 Imprezę wygrywa {0} ({1} pkt)!', order[0].name, order[0].pts);
    }
    fx('win');
    celebrate();
  }
  $$('.party-kicker, .party-box').forEach((n) => n.remove());
  title.before(kicker);
  const next = !final && PARTY_GAMES[pt.plan[pt.idx]];
  $('#ranking').append(el('div', { class: 'party-box' },
    el('h3', {}, final ? T('Klasyfikacja końcowa') : T('Klasyfikacja imprezy')),
    el('ol', { class: 'ranking party-standings' }, order.map((o) => el('li', {}, `${o.name} – ${o.pts} ${T('pkt')}`, o.last ? el('span', { class: 'plus' }, ` (+${o.last})`) : null))),
    next ? el('p', { class: 'muted' }, T('Następna minigra: {0} {1}', next.icon, T(next.name))) : null,
    next && pt.until ? el('p', { class: 'muted' }, T('⏳ Do końca imprezy: ok. {0} min', Math.max(1, Math.ceil((pt.until - Date.now()) / 60000)))) : null));
  if (final) {
    $('#winner-timeline').classList.add('hidden');
    leagueAfterGame(pt.rows.map((r, i) => ({ name: r.name, v: pt.points[i] })));
  }
}
$('#btn-party-next').addEventListener('click', () => (state.tour ? playTourMatch() : playPartyGame()));
$('#btn-party-stop').addEventListener('click', () => {
  if (state.tour) {
    // przerwany turniej – bez zwycięzcy
    state.tour.done = true;
    state.mode = 'tour';
    $('#ranking').replaceChildren();
    tourStandings(null);
    $('#winner-title').textContent = T('Turniej przerwany.');
    updateEndButtons();
    tvSync();
    return;
  }
  state.party.plan = state.party.plan.slice(0, state.party.idx);
  state.mode = 'party';
  $('#ranking').replaceChildren();
  partyStandings(true);
  updateEndButtons();
  tvSync();
});
// pominięcie minigry (np. gdy coś nie działa): za minigrę nikt nie dostaje punktów, impreza (turniej) idzie dalej;
// przycisk ⏭ w górnym pasku obok ustawień – tylko w trakcie minigry imprezy albo meczu turnieju
function miniSkipPaint() {
  const on = !!(state.party || state.tour) && state.phase !== 'ended' && ['game', 'lyrics'].includes(currentScreen());
  $('#btn-mini-skip').classList.toggle('hidden', !on);
}
function skipMinigame() {
  if (!(state.party || state.tour) || state.phase === 'ended') return;
  const lyrics = currentScreen() === 'lyrics';
  if (!confirm(T('Pominąć tę minigrę? Nikt nie dostanie za nią punktów, a gra przejdzie dalej.'))) return;
  state.miniSkipped = true;
  try {
    if (lyrics) {
      // przerwana piosenka (wczytywanie, odtwarzanie) już nie wraca na ekran
      if (state.lyrics) state.lyrics.cur = null;
      lyEnd();
    } else endGame();
  } finally { state.miniSkipped = false; }
}
$$('.btn-mini-skip').forEach((b) => b.addEventListener('click', skipMinigame));
// Liga wieczoru: kolejne gry w tym samym lobby – za każdą grę 3/2/1 pkt za miejsca (remis – tyle samo, wynik 0 – bez punktów)
function leagueAfterGame(results) {
  if (!lobby.active || results.length < 2) return;
  if (!lobby.league) lobby.league = { games: 0, pts: {} };
  const L = lobby.league;
  L.games += 1;
  for (const r of results) {
    const better = new Set(results.filter((x) => x.v > r.v).map((x) => x.v)).size;
    L.pts[r.name] = (L.pts[r.name] || 0) + (r.v > 0 ? Math.max(0, 3 - better) : 0);
  }
  const order = Object.entries(L.pts).sort((a, b) => b[1] - a[1]);
  $$('.league-box').forEach((n) => n.remove());
  $('#ranking').append(el('div', { class: 'league-box' },
    el('h3', {}, T('🏆 Liga wieczoru – po {0}', L.games === 1 ? T('1 grze') : T('{0} grach', L.games))),
    el('ol', { class: 'ranking league-standings' }, order.map(([n, v]) => el('li', {}, `${n} – ${v} ${T('pkt')}`)))));
}
// przyciski pod podsumowaniem: impreza w toku / multiplayer / jeden gracz
function updateEndButtons() {
  const between = !!(state.party && !state.party.done) || !!(state.tour && !state.tour.done);
  $('#btn-party-next').textContent = state.tour ? T('▶ Następny mecz') : T('▶ Następna minigra');
  $('#btn-party-stop').textContent = state.tour ? T('Zakończ turniej') : T('Zakończ imprezę');
  $('#end-party').classList.toggle('hidden', !between);
  $('#end-multi').classList.toggle('hidden', between || playCtx !== 'multi');
  $('#end-actions').classList.toggle('hidden', between || playCtx === 'multi');
  if (state.party && state.party.done) state.mode = 'party';
}

// Pojedynek dekad: wybrane w ustawieniach albo losowe – dwie dekady z wystarczającą liczbą piosenek
function pickDuelDecades(pool, needed, random) {
  const count = new Map();
  for (const s of pool) count.set(decadeOf(s), (count.get(decadeOf(s)) || 0) + 1);
  const enough = [...count.keys()].filter((d) => count.get(d) >= Math.ceil(needed / 2) + 2);
  let [a, b] = random ? [null, null] : [filterState.duelA, filterState.duelB].map((d) => (d != null && count.has(d) ? d : null));
  if (a == null) a = shuffle(enough.filter((d) => d !== b))[0];
  if (b == null || b === a) b = shuffle(enough.filter((d) => d !== a))[0];
  if (a == null || b == null) return null;
  return [a, b].sort((x, y) => x - y);
}

function duelPairFor(song) {
  const d = decadeOf(song);
  const other = shuffle(state.duelPool.filter((x) => x !== d))[0];
  return [d, other].sort((x, y) => x - y);
}

// Karta startowa to sam rok (bez piosenki). Każdy gracz dostaje rok z innej kategorii dekad
// (jeśli to możliwe), a sam rok to rok losowej piosenki z puli – więc pasuje do zakresu gry.
function dealStartYears(pool) {
  const byDecade = new Map();
  for (const s of pool) {
    if (!byDecade.has(decadeOf(s))) byDecade.set(decadeOf(s), []);
    byDecade.get(decadeOf(s)).push(s.y);
  }
  let decades = [];
  for (const pl of state.players) {
    if (!decades.length) decades = shuffle([...byDecade.keys()]);
    const years = byDecade.get(decades.pop());
    pl.timeline.push({ y: years[Math.floor(Math.random() * years.length)], start: true });
  }
}

async function startTurn() {
  stopAudio();
  // „Na czas”: po końcu czasu (np. po pominięciu ostatniej piosenki) nie ma już nowych kart
  if (state.mode === 'timed' && state.timeLeft <= 0) return endGame();
  Object.assign(state, {
    phase: 'listen', slot: null, challenger: null, challengeSlot: null, challengeYear: null, awarded: false, challenges: [],
    current: null, preview: null, marks: null, special: null, swapOffer: false, hiloLost: false, skipped: false, heard: false,
    buzz: state.mode === 'buzz' ? { answering: null, locked: new Set() } : null,
  });
  if (state.mode === 'duel' && state.duelPool) state.duel = null;
  $('#reveal').classList.add('hidden');
  $('#guess-form').reset();
  $('#guess-song').disabled = false;
  $('#letter-hint').classList.add('hidden');
  miniSkipPaint();
  render();
  applyAudioRoute();
  await (state.mode === 'sort5' ? drawSort5() : drawSong());
}

// dobiera kolejną piosenkę, pomijając te bez dostępnego fragmentu
// kolejna piosenka szukana w tle, gdy gracz słucha obecnej
let prefetched = null;
// rok kart gracza, który dostanie następną piosenkę (dla trudniejszych poziomów)
function nearYearsFor(playerIndex) {
  if (state.mode === 'hilo') return state.ref ? [state.ref.y] : null;
  if (state.mode === 'climb') return [CLIMB[Math.min(state.players[playerIndex].climb || 0, CLIMB.length - 1)]];
  return isTimeline() ? state.players[playerIndex].timeline.map((s) => s.y) : null;
}
const nextPlayerIndex = () => (isMulti() ? (state.turn + 1) % state.players.length : state.turn);
// na trudnych poziomach oś następnego gracza zmienia się do chwili odkrycia karty – wtedy szukamy dopiero po odkryciu
const prefetchAfterReveal = () => state.mode === 'climb' || ((isTimeline() || state.mode === 'hilo') && state.difficulty === 2);

// Cały 30-sekundowy fragment (~1 MB) pobieramy z góry. Bez tego telefony zaczynały grać przy małym
// buforze i po chwili zatrzymywały się na doładowanie. Serwer iTunes zezwala na to (CORS: *).
async function withAudio(preview) {
  if (!preview || preview.blobUrl) return preview;
  try {
    const res = await fetch(preview.url);
    // zapamiętany adres fragmentu już nie działa – trzeba wyszukać piosenkę od nowa
    if (res.status === 403 || res.status === 404 || res.status === 410) return { ...preview, gone: true };
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = new Blob([await res.arrayBuffer()], { type: 'audio/mp4' });
    // kopia – obiekt w pamięci podręcznej wyszukiwania zostaje bez adresu blob (ten jest zwalniany po piosence)
    return { ...preview, blobUrl: URL.createObjectURL(blob) };
  } catch (e) {
    console.warn('Nie udało się pobrać całego fragmentu – odtwarzanie strumieniowe', e);
  }
  return preview;
}
let currentBlobUrl = null;
function setAudioSource(preview) {
  if (currentBlobUrl && currentBlobUrl !== preview.blobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = preview.blobUrl || null;
  $('#audio').src = preview.blobUrl || preview.url;
  delete $('#audio').dataset.rev;
  $('#audio').load();
  // urządzenia, które mogą grać muzykę, pobierają fragment z wyprzedzeniem
  remoteSend({ audioCmd: 'load', url: preview.url });
}

function prefetchNext() {
  const song = state.deck.draw(nearYearsFor(nextPlayerIndex()));
  prefetched = song ? { song, deck: state.deck, promise: findPreview(song, { quiet: true }).then(withAudio).catch(() => null) } : null;
  if (song && state.mode === 'words') firstWords(song);
}

async function drawSong() {
  const myDraw = ++state.drawId;
  $('#btn-play').disabled = true;
  setVinyl(null);
  for (;;) {
    let song;
    let preview;
    $('#mystery-status').textContent = T('Szukam fragmentu piosenki…');
    if (prefetched && prefetched.deck === state.deck) {
      ({ song } = prefetched);
      preview = await prefetched.promise;
      prefetched = null;
    } else {
      song = state.deck.draw(nearYearsFor(state.turn));
      if (!song) break;
      $('#mystery-status').textContent = T('Szukam fragmentu piosenki…');
      preview = await withAudio(await findPreview(song));
    }
    if (preview && preview.gone) { forgetPreview(song); preview = await withAudio(await findPreview(song)); }
    if (preview && preview.gone) preview = null;
    if (myDraw !== state.drawId) return; // gra została przerwana
    // „pomijaj niecenzuralne”: piosenka bez oznaczenia w bazie, ale oznaczona w Apple Music – losujemy inną
    if (preview && preview.ex && filterState.noExplicit) continue;
    // „Okładka z mgły” – tylko piosenki z okładką w iTunes
    if (preview && state.mode === 'cover' && !preview.art) continue;
    // „Pierwsze słowa” – tylko piosenki, których tekst udało się znaleźć
    if (preview && state.mode === 'words') {
      $('#mystery-status').textContent = T('Szukam tekstu piosenki…');
      state.words = await firstWords(song);
      if (myDraw !== state.drawId) return;
      if (!state.words) continue;
    }
    if (preview) {
      markPlayed(song);
      state.current = song;
      state.preview = preview;
      // Pojedynek dekad na „Losowo”: dekada tej piosenki kontra inna losowa dekada z puli (kolejność od najstarszej)
      if (state.mode === 'duel' && state.duelPool) state.duel = duelPairFor(song);
      // Krzywe zwierciadło: efekt losowany dla piosenki
      state.mirror = state.mode === 'mirror' ? shuffle(Object.keys(MIRROR_FX))[0] : null;
      if (isSteps()) {
        const maxLen = stepsList()[stepsList().length - 1].len;
        Object.assign(state, { step: 0, solved: {}, hintCost: 0, clipLen: stepsList()[0].len });
        state.clipStart = filterState.random ? Math.random() * (29 - maxLen) : 0;
      } else if (state.mode === 'daily') {
        // wyzwanie dnia: dla wszystkich tak samo – cały fragment od początku
        state.clipLen = 30;
        state.clipStart = 0;
      } else {
        state.clipLen = filterState.clip;
        state.clipStart = filterState.random && filterState.clip < 30 ? Math.random() * (29 - filterState.clip) : 0;
      }
      setAudioSource(preview);
      if (isQuiz()) prepareQuiz(song);
      if (state.mode === 'royale') state.royale = { answers: {} };
      if (state.mode === 'live') liveStartRound(song);
      if (state.mode === 'seconds') startSecsRound();
      if (state.mode === 'bomb') bombRound();
      if (state.mode === 'mashup') { state.mashup = null; state.clipLen = 10; $('#btn-play').disabled = true; mashupPrepare(myDraw).then(() => { $('#btn-play').disabled = !state.mashup; if (!state.mashup) $('#mystery-status').textContent = T('Nie udało się znaleźć drugiej piosenki – spróbuj następnej.'); }); }
      const status = isQuiz() ? QUIZ[state.mode].status() : {
        steps: T('Posłuchaj {0} sekundy i zgaduj – albo wydłuż fragment.', stepsList()[0].len),
        cover: T('Przyjrzyj się rozmytej okładce i zgaduj – na razie bez dźwięku.'),
        words: T('Przeczytaj pierwsze słowa piosenki i zgaduj – na razie bez dźwięku.'),
        mirror: T('Krzywe zwierciadło: {0} {1}. Posłuchaj i zgaduj – z każdym krokiem mniej zniekształceń.', MIRROR_FX[state.mirror || 'wall'].icon, MIRROR_FX[state.mirror || 'wall'].name),
        melody: T('Posłuchaj i wpisz odpowiedź.'),
        buzz: T('Włącz fragment – kto pierwszy naciśnie swój przycisk, ten odpowiada.'),
        hilo: T('Posłuchaj: starsza czy nowsza od poprzedniej karty?'),
        duel: T('Posłuchaj i wybierz dekadę.'),
        bingo: T('Posłuchaj i zaznacz na swojej planszy pole, które pasuje do tej piosenki.'),
        royale: T('Wszyscy naraz: wpiszcie rok wydania. Kto pomyli się najbardziej, traci serce.'),
        seconds: T('Licytacja: ile sekund wystarczy, by odgadnąć tytuł? Muzyka zagra po licytacji.'),
        bomb: T('Gorąca bomba: odpowiadaj szybko i podawaj bombę dalej, zanim wybuchnie!'),
        mashup: T('Mikser: dwie piosenki naraz – szukam drugiej…'),
      }[state.mode] || T('Posłuchaj i wybierz miejsce na swojej osi czasu.');
      $('#mystery-status').replaceChildren(status);
      // karta specjalna: co ok. piąta karta na osi czasu (jeśli włączone)
      if (state.specials && state.specials.length && Math.random() < SPECIAL_CHANCE) {
        // magnes – tylko dla gracza na ostatnim miejscu (najmniej kart, przy co najmniej 2 graczach)
        const last = state.players.length > 1 && activePlayer().timeline.length < Math.min(...state.players.filter((x) => x !== activePlayer()).map((x) => x.timeline.length));
        const pool = state.specials.filter((k) => k !== 'magnet' || last);
        state.special = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      }
      if (isMelody() && filterState.hint) {
        $('#mystery-status').append(' ', el('span', { class: 'decade-hint' }, T('Podpowiedź: {0}', decadeRange(decadeOf(song)))));
      }
      $('#btn-play').disabled = state.mode === 'seconds' || state.mode === 'bomb' || state.mode === 'mashup';
      render();
      // autoodtwarzanie (zawsze w trybie na czas, w innych – opcja w ustawieniach); przeglądarka może je zablokować,
      // wtedy gracz po prostu klika ▶
      if (state.mode === 'timed' || store.get('autoplay', false)) playClip();
      if (!prefetchAfterReveal()) prefetchNext();
      if (isMelody() && state.mode !== 'buzz') $('#guess-song').focus({ preventScroll: true });
      return;
    }
    if (!previewCache.has(songKey(song))) {
      // błąd sieci – oddajemy piosenkę do talii i próbujemy ponownie za chwilę
      state.deck.release(song, true);
      $('#mystery-status').textContent = T('Nie mogę połączyć się z serwerem fragmentów. Ponawiam za 10 s…');
      await new Promise((r) => setTimeout(r, 10000));
      if (myDraw !== state.drawId) return;
      continue;
    }
    console.warn('Brak fragmentu:', song.a, song.t);
    state.deck.release(song, false);
  }
  $('#mystery-status').textContent = T('Talia się skończyła!');
  endGame();
}
