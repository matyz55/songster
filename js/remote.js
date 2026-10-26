'use strict';
// Songster – duży ekran i telefony graczy: połączenia, stan gry wysyłany na inne urządzenia, pokój.
// Pliki js/*.js to zwykłe skrypty ładowane po kolei (index.html) – współdzielą zmienne globalne.
/* ---------- duży ekran (TV / rzutnik): drugie okno na tym samym urządzeniu, to okno jest pilotem ---------- */
let tvChannel = null;
try {
  tvChannel = new BroadcastChannel('songster-tv');
  tvChannel.onmessage = (e) => handleRemote(e.data);
} catch (e) { /* stara przeglądarka – bez dużego ekranu */ }

// połączenia sieciowe (net.js): telewizor z kodem i telefony graczy – { conn, role: 'tv' | 'player', name }
const remotes = new Set();
let roomCode = null; // kod pokoju dla telefonów graczy (gdy utworzony)
// lobby multiplayera: gracze (na tym urządzeniu i z telefonami) i ich głosy na tryb gry
const lobby = { active: false, players: [], votes: new Map() };
const hasRemotes = () => !!tvChannel || remotes.size > 0;
function remoteSend(msg) {
  try { if (tvChannel) tvChannel.postMessage(msg); } catch (e) { /* okno TV zamknięte */ }
  for (const r of remotes) {
    try { if (r.conn.open) r.conn.send(msg); } catch (e) { /* połączenie zerwane */ }
  }
}
// polecenia z dużego ekranu i z telefonów graczy
function handleRemote(msg, from) {
  if (!msg) return;
  // druga strona zamknęła połączenie (np. telewizor wyłączył pokój)
  if (msg.__bye && from) { try { from.conn.close(); } catch (e) { /* zerwane */ } return; }
  // głos gracza na tryb gry (wybór trybu w multiplayerze – decyduje gospodarz)
  if (msg.vote && from && from.name && lobby.active) {
    if (msg.vote === '-') lobby.votes.delete(from.name); else lobby.votes.set(from.name, String(msg.vote));
    renderModes();
    tvSync();
    return;
  }
  if (msg.hello) {
    if (!from) { tvWindowSeen = true; updatePlaybackOptions(); } // okno dużego ekranu na tym urządzeniu
    if (from) { from.role = msg.role || from.role; from.name = msg.name || from.name; renderRemoteList(); }
    tvSync();
  }
  if (msg.iam && from) { from.name = msg.iam; renderRemoteList(); }
  // przeglądarka urządzenia z muzyką zablokowała dźwięk (brak interakcji) – gramy od razu tutaj;
  // po naciśnięciu przycisku na tamtym urządzeniu muzyka wraca tam od bieżącego miejsca
  if (msg.audioBlocked || msg.audioOk) {
    if (from) from.audioBlocked = !!msg.audioBlocked; else channelBlocked = !!msg.audioBlocked;
    const remote = applyAudioRoute();
    if (msg.audioOk && remote && !audio.paused && state.preview) {
      sendAudioCmd({ audioCmd: 'play', url: state.preview.url, t: audio.currentTime, until: clipEnd() });
    }
    return;
  }
  if (msg.join && from) joinFromPhone(msg.join, from);
  // ▶/⏸ z telefonu gracza – tylko od gracza, który teraz odpowiada (w drużynie – od odpowiadającego członka)
  if (msg.playToggle && from && from.name && controlNames().includes(from.name)) {
    const b = $('#btn-play');
    if (b.disabled || b.closest('.hidden')) { from.conn.send({ playError: 'loading' }); return; }
    if (!audio.paused) { softPause(false); return; }
    // przeglądarka gospodarza może zablokować dźwięk włączony nie jego dotknięciem – wtedy telefon gracza się o tym dowie
    playClip().then(() => {
      if (!audio.paused) return;
      from.conn.send({ playError: 'blocked' });
      $('#audio-note').textContent = T('🔇 Przeglądarka tego urządzenia zablokowała dźwięk włączony z telefonu gracza – naciśnij tu raz ▶, potem telefon będzie już sterował.');
      $('#audio-note').classList.remove('hidden');
    });
    return;
  }
  // przycisk kliknięty na innym ekranie – klikamy ten sam w oknie gry (sprawdzamy też napis, gdyby stan zdążył się zmienić)
  if (msg.click) {
    const b = tvButtons()[msg.click.i];
    if (b && !b.disabled && b.textContent.trim() === msg.click.text) {
      // „⚔ Wyzwanie” z telefonu gracza: wyzywającym od razu jest ten gracz (bez wybierania imienia z listy)
      const who = from && from.role === 'player' ? playerIndexOf(from.name) : -1;
      if (msg.click.text === T('⚔ Wyzwanie') && who >= 0 && who !== state.turn && state.players[who].tokens >= 1) {
        state.phase = 'challenge';
        state.challenger = who;
        state.players[who].tokens -= 1;
        if (state.challengeMode === 'all') state.challenges.push({ i: who, slot: null });
        render();
      } else b.click();
    }
  }
  // miejsce na osi z telefonu: tylko gracz z turą, a przy wyzwaniu – tylko wyzywający
  if (msg.slot != null && remoteSlotsAllowed()) {
    const who = from && from.role === 'player' ? playerIndexOf(from.name) : null;
    if (state.phase === 'challenge' && state.challengeMode === 'all' && who !== null) {
      // każdy wyzywający wskazuje miejsce na swoim telefonie niezależnie od innych
      if (state.challenges.some((x) => x.i === who)) { state.challenger = who; onSlotClick(msg.slot); }
    } else {
      const expected = state.phase === 'challenge' ? state.challenger : state.turn;
      if (who === null || who === expected) onSlotClick(msg.slot);
    }
  }
  // Tak to leciało!: słowa wpisane na telefonie gracza z turą, podpowiedź suflera
  if ((msg.lyAnswer || msg.lyHint != null) && from && from.name) lyFromPhone(msg, from.name);
  // Bingo: pole zaznaczone na telefonie gracza
  if (msg.bingoPick != null && from && state.mode === 'bingo') { const i = playerIndexOf(from.name); if (i >= 0) bingoPick(i, msg.bingoPick); }
  // „Rok co do roku”: rok wpisany na telefonie gracza z turą
  if (msg.yearAnswer != null && from && controlNames().includes(from.name) && isYearQuiz()) answerQuiz(msg.yearAnswer);
  // „Skąd jest wykonawca?” (wpisywany kraj): nazwa kraju z telefonu gracza z turą
  if (msg.countryAnswer != null && from && controlNames().includes(from.name) && state.quiz && state.quiz.typed) answerQuiz(String(msg.countryAnswer));
  // Ostatni na placu boju: rok z telefonu gracza
  if (msg.royaleYear != null && from && from.name) royaleAnswer(playerIndexOf(from.name), msg.royaleYear);
  // Pojedynek na żywo: odpowiedź z telefonu gracza
  if (msg.liveAnswer != null && from && from.name) liveAnswer(playerIndexOf(from.name), Number(msg.liveAnswer));
  // rok podany przez wyzywającego na jego telefonie (wariant wyzwania „dokładny rok”)
  if (msg.challengeYear != null && from && state.phase === 'challenge' && state.challengeMode === 'year'
    && state.challenger != null && playerIndexOf(from.name) === state.challenger) {
    const y = parseInt(msg.challengeYear, 10);
    if (y >= 1900 && y <= new Date().getFullYear()) { state.challengeYear = y; revealTimeline(); }
  }
  // czas odpowiedzi telefonu na sygnał obecności (średnia krocząca) – do stanu połączenia i uczciwego „Kto pierwszy?”
  if (msg.pong != null && from) {
    const rtt = Math.max(0, Date.now() - msg.pong);
    from.rtt = from.rtt == null ? rtt : Math.round(from.rtt * 0.7 + rtt * 0.3);
    return;
  }
  if (msg.buzz != null) requestBuzz(msg.buzz, from && from.rtt ? from.rtt / 2 : 0);
  if (msg.guess) {
    $('#guess-song').value = msg.guess.text || '';
    guessPick = msg.guess.pick ? { ...msg.guess.pick, label: msg.guess.text } : null;
    if (msg.guess.year != null && $('#guess-year')) $('#guess-year').value = msg.guess.year;
    if (msg.guess.submit && isMelody() && state.phase === 'listen' && state.current) $('#guess-form').requestSubmit();
    else render();
  }
}
// gracz (albo drużyna, do której należy) o tym imieniu – numer w state.players, -1 gdy brak
function playerIndexOf(name) {
  if (!name) return -1;
  return state.players.findIndex((p) => p.name === name || (p.members || []).includes(name));
}
// kto steruje odtwarzaniem ze swojego telefonu: gracz z turą (w drużynie także odpowiadający członek),
// w „Kto pierwszy?” – ten, kto się zgłosił
function controlNames() {
  if (!state.players.length || !state.current) return [];
  if (state.mode === 'buzz') return state.buzz && state.buzz.answering != null ? [state.players[state.buzz.answering].name] : [];
  if (state.mode === 'bingo') return [];
  const p = activePlayer();
  return [p.name, answering(p)].filter(Boolean);
}
const controlPhone = () => [...remotes].find((r) => r.role === 'player' && r.name && controlNames().includes(r.name));
// wybór miejsca na osi z innego urządzenia: gracz w swojej turze albo wyzywający (wariant „inne miejsce”)
const remoteSlotsAllowed = () => isTimeline() && !!state.current
  && (['listen', 'placed'].includes(state.phase) || (state.phase === 'challenge' && (state.challengeMode === 'all'
    ? state.challenges.length > 0 : state.challenger != null && state.challengeMode === 'place')));
// czy jest podłączone okno dużego ekranu na tym urządzeniu
let tvWindowSeen = false;
// wybrane opcje rozgrywki – czytane z widocznych pól ekranu ustawień (pokazywane na dużym ekranie)
function setupSummary() {
  const out = [];
  const visible = (n) => n && n.offsetParent !== null && !n.closest('.hidden');
  const clean = (t) => t.replace(/\s+/g, ' ').trim();
  const preset = $('#presets [aria-pressed="true"]');
  if (preset) out.push([T('Zestaw'), clean(preset.textContent)]);
  for (const sec of $$('#screen-setup section.card')) {
    if (sec.id === 'sec-players' || !visible(sec)) continue;
    for (const inp of sec.querySelectorAll('input, select')) {
      const lab = inp.closest('label');
      // przełączniki mają ukryte pole – liczy się widoczność etykiety
      if (!visible(lab || inp) || inp.closest('details:not([open])')) continue;
      if (inp.type === 'radio' && inp.checked) {
        const group = inp.closest('div[data-for], .card');
        const head = (inp.closest('.seg') && inp.closest('.seg').previousElementSibling && inp.closest('.seg').previousElementSibling.classList.contains('label'))
          ? inp.closest('.seg').previousElementSibling.textContent : (group.querySelector('h2') ? group.querySelector('h2').textContent : '');
        out.push([clean(head), clean(lab ? lab.textContent : inp.value)]);
      } else if (inp.type === 'checkbox' && inp.checked && lab) {
        out.push(['✔', clean(lab.textContent).replace(/\s[–-]\s.*$/, '')]);
      } else if (inp.type === 'number' && lab) {
        out.push([clean(lab.firstChild.textContent || lab.textContent), inp.value]);
      } else if (inp.tagName === 'SELECT' && lab) {
        out.push([clean(lab.firstChild.textContent || ''), clean(inp.selectedOptions[0] ? inp.selectedOptions[0].textContent : '')]);
      } else if (inp.type === 'range' && inp.id === 'pl-share' && visible($('#share-box'))) {
        out.push([T('Udział polskich piosenek'), clean($('#pl-share-label').textContent)]);
      }
    }
  }
  return out.filter(([k, v]) => v);
}
// sygnał obecności – duży ekran wie, że pilot nadal jest połączony (inaczej po chwili wraca do kodu QR)
// co 4 s – telefony odpowiadają (pong), z czego wiemy, kto jest połączony i z jakim opóźnieniem
setInterval(() => { if (hasRemotes()) remoteSend({ ping: Date.now() }); renderConnStrip(); }, 4000);
// zmiana dowolnej opcji na ekranie ustawień od razu trafia na duży ekran
$('#screen-setup').addEventListener('change', () => tvSync());
$('#screen-setup').addEventListener('click', () => setTimeout(tvSync, 0));
// stan odtwarzania na duży ekran / telefony – najwyżej 4 razy na sekundę
let tvAudioLast = 0;
function tvAudio(force) {
  if (!hasRemotes()) return;
  const now = Date.now();
  if (!force && !audio.paused && now - tvAudioLast < 250) return;
  tvAudioLast = now;
  const revealed = state.phase === 'revealed';
  const start = revealed ? 0 : state.clipStart;
  const len = revealed ? (audio.duration || 30) : state.clipLen;
  remoteSend({ audio: { playing: !audio.paused, progress: len ? Math.min(1, Math.max(0, (audio.currentTime - start) / len)) : 0 } });
}
// przyciski gry widoczne też na dużym ekranie: akcje tury (wyzwanie, kupno karty, dalej…) i pominięcie
function tvButtons() {
  return [...$$('#actions button'), $('#btn-skip')].filter((b) => b && !b.closest('.hidden') && !b.classList.contains('hidden'));
}
function tvSync() {
  if (!hasRemotes()) return;
  const screen = SCREENS.find((x) => !$('#screen-' + x).classList.contains('hidden'));
  const txt = (sel) => ($(sel) ? $(sel).textContent.trim() : '');
  const snap = { screen, mode: state.mode, players: state.players.map((pl) => pl.name), room: roomCode, multi: lobby.active, ver: window.SongsterNet.version };
  const joinUrl = roomCode ? window.SongsterNet.pageUrl('tv.html', { join: roomCode }) : null;
  if (lobby.active) {
    const phones = remoteNames();
    snap.lobby = { names: lobby.players.map((p) => p.name), phones: lobby.players.filter((p) => phones.has(p.name)).map((p) => p.name),
      full: lobby.players.length >= MAX_PLAYERS, joinUrl };
  }
  if (screen === 'modes') {
    snap.modes = { ctx: playCtx, items: modeTiles().map((b) => ({
      id: b.dataset.mode, icon: b.querySelector('.mode-icon').textContent, title: b.querySelector('b').textContent,
      desc: b.querySelector('.muted').textContent, disabled: b.disabled,
      votes: [...lobby.votes].filter(([, m]) => m === b.dataset.mode).map(([who]) => who),
    })) };
  }
  if (screen === 'setup' && MODES[state.mode]) {
    const cfg = MODES[state.mode];
    const names = readSetupRows().map((r) => r.name.trim()).filter(Boolean);
    snap.setup = {
      title: cfg.title, teams: !!cfg.teams, names, full: names.length >= maxPlayersFor(state.mode), multi: playCtx === 'multi',
      options: setupSummary(), poolInfo: $('#pool-info').textContent, joinUrl,
    };
  }
  // impreza: która minigra (na dużym ekranie i telefonach)
  if (state.party && (screen === 'game' || screen === 'end')) {
    const pt = state.party;
    const g = PARTY_GAMES[pt.plan[Math.min(pt.plan.length - 1, screen === 'game' ? pt.idx : Math.max(0, pt.idx - 1))]];
    snap.party = { label: pt.done ? T('🥳 Koniec imprezy!') : pt.until
      ? T('🥳 Minigra {0}: {1} {2}', screen === 'game' ? pt.idx + 1 : pt.idx, g.icon, T(g.name))
      : T('🥳 Minigra {0} z {1}: {2} {3}', screen === 'game' ? pt.idx + 1 : pt.idx, pt.plan.length, g.icon, T(g.name)) };
  }
  if (screen === 'lyrics') snap.lyrics = lyrSnapshot();
  if (screen === 'end') {
    snap.winner = txt('#winner-title');
    // w imprezie – klasyfikacja całej imprezy, a nie tylko ostatniej minigry
    // tylko wyniki tej gry – bez tabeli ligi i „najciekawszych momentów” (są w #ranking, ale idą osobno; wcześniej
    // duży ekran pokazywał graczy dwa razy)
    snap.ranking = ($('.party-standings') ? $$('.party-standings li') : $$('#ranking li').filter((li) => !li.closest('.league-box, .moments-box, .party-box')))
      .map((li) => li.textContent);
    if ($('.party-box p')) snap.next = $('.party-box p').textContent;
    snap.league = $$('.league-standings li').map((li) => li.textContent);
    snap.moments = $$('.moments li').map((li) => li.textContent);
    snap.leagueTitle = $('.league-box h3') ? $('.league-box h3').textContent : '';
    // piosenki z tej gry (ostatnie 12) – lista obok wyników, jak na ekranie gospodarza
    snap.played = (state.party && state.party.done ? [] : state.history).slice(-12).map((x) => ({
      y: x.song.y, t: x.song.t, a: artistLine(x.song), cc: x.song.cc, ok: x.ok, note: x.note,
    }));
  } else if (screen === 'game' && state.players.length) {
    const revealed = state.phase === 'revealed' && state.current;
    Object.assign(snap, {
      title: txt('#turn-title'), info: txt('#turn-info'), hint: txt('#hint'),
      status: revealed ? '' : txt('#mystery-status'), decadeHint: revealed ? '' : txt('#mystery-status .decade-hint'),
      // karta specjalna (podwójna, kradzież, tarcza…) – osobny pasek jak u gospodarza
      special: state.current && state.special && SPECIALS[state.special] ? txt('#special-badge') : '',
      // kupiona podpowiedź (pierwsza litera) i odgadnięte już części odpowiedzi
      letterHint: $('#letter-hint') && !$('#letter-hint').classList.contains('hidden') ? txt('#letter-hint') : '',
      solved: $('#guess-solved') && !$('#guess-solved').classList.contains('hidden') ? txt('#guess-solved') : '',
      scores: state.players.length > 1 ? $$('#scoreboard .score').map((n, i) => ({ text: n.textContent, active: n.classList.contains('active') || (state.buzz && state.buzz.answering === i) })) : [],
      art: revealed && state.preview ? state.preview.art : null,
      buttons: tvButtons().map((b) => ({ text: b.textContent.trim(), cls: b.className, disabled: b.disabled, title: b.title || '' })),
      reveal: revealed ? {
        y: state.current.y, t: state.current.t, a: artistLine(state.current), cc: state.current.cc,
        // linie odkrycia z kolorem jak u gospodarza (werdykt, ciekawostka, uwagi)
        lines: [...$('#reveal').children].slice(2).filter((n) => !n.classList.contains('listen') && n.textContent.trim())
          .map((n) => ({ text: n.textContent, cls: n.className })),
        // „Posłuchaj całości” – ikonki serwisów jak u gospodarza
        listen: state.preview ? ['youtube', 'spotify', 'apple'].map((p) => ({ p, url: streamUrl(state.current, state.preview, p) })) : [],
      } : null,
      // ▶/⏸ dla telefonu gracza, który teraz odpowiada
      play: state.current && !$('#btn-play').classList.contains('hidden') ? { disabled: $('#btn-play').disabled, playing: !audio.paused, who: controlNames() } : null,
      // wyzwanie „dokładny rok”: pole roku na telefonie wyzywającego
      challengeInput: state.phase === 'challenge' && state.challenger != null && state.challengeMode === 'year'
        ? { who: state.players[state.challenger].name } : null,
      // „Rok co do roku”: pole roku na telefonie gracza z turą
      bingo: bingoSnapshot(),
      live: liveSnapshot(),
      // Dekadowa wspinaczka: drabinka dekad z miejscem każdego gracza
      climb: climbSnapshot(),
      // Ostatni na placu boju: kto jeszcze nie podał roku (pole roku na jego telefonie)
      royale: state.mode === 'royale' && state.royale && state.phase === 'listen' && state.current
        ? { pending: royaleAlive().filter((i) => state.royale.answers[i] == null).map((i) => state.players[i].name) } : null,
      // „Ułóż piątkę”: kolejność fragmentów na liście (przeciąganie na telefonie gracza z turą)
      sort: state.mode === 'sort5' && state.sort && state.phase === 'listen'
        ? { rows: state.sort.order.map((k) => ({ letter: SORT_LETTERS[k], playing: state.sort.playing === k })) } : null,
      yearAsk: isYearQuiz() && state.phase === 'listen' && state.current ? { who: controlNames() } : null,
      // „Skąd jest wykonawca?” (wpisywany kraj): pole tekstowe na telefonie gracza z turą (odpowiedź: { countryAnswer })
      countryAsk: state.mode === 'country' && state.quiz && state.quiz.typed && state.phase === 'listen' && state.current ? { who: controlNames() } : null,
      phase: state.phase, turnName: activePlayer().name, turnWho: answering(activePlayer()), playing: !audio.paused, hasSong: !!state.current,
      // drużyny: do której drużyny należy gracz z telefonem
      teamOf: state.mode === 'teams' || state.coop ? Object.fromEntries(state.players.flatMap((pl) => (pl.members || []).map((m) => [m, pl.name]))) : null,
      challenger: state.challenger != null ? state.players[state.challenger].name : null,
      // wyzwanie „wszyscy naraz”: kto już rzucił wyzwanie (każdy może wskazać miejsce na swoim telefonie)
      challengers: state.challengeMode === 'all' && state.phase === 'challenge' ? state.challenges.map((x) => state.players[x.i].name) : [],
      challengeAll: state.challengeMode === 'all',
      slots: remoteSlotsAllowed(),
      // pasek kroków (Melodia krok po kroku): 1 s · 2 s · 4 s · 8 s
      steps: isSteps() && state.current ? { current: state.step, items: stepsList().map((x) => ({ len: x.len, pts: x.pts, label: stepLabel(x) })) } : null,
      // Okładka z mgły: rozmyta okładka przed odkryciem (stopień rozmycia z kroku)
      cover: state.mode === 'cover' && state.current && state.phase === 'listen' && state.preview && state.preview.art
        ? { art: state.preview.art, blur: COVER_STEPS[state.step].blur } : null,
      // Pierwsze słowa: początek tekstu widoczny w tym kroku
      words: state.mode === 'words' && state.current && state.phase === 'listen' && state.words ? wordsShown() : null,
      // przyciski graczy (Kto pierwszy?)
      buzzers: state.mode === 'buzz' && state.buzz ? {
        open: !!state.current && state.phase === 'listen' && state.buzz.answering == null,
        answering: state.buzz.answering != null ? state.players[state.buzz.answering].name : null,
        items: state.players.map((pl, i) => ({ name: pl.name, key: keyLabel((state.buzzKeys || BUZZ_KEYS)[i]), color: BUZZ_COLORS[i], locked: state.buzz.locked.has(i) })),
      } : null,
      // pole odpowiedzi (dla telefonów graczy)
      guess: !$('#guess-form').classList.contains('hidden') ? {
        kind: suggestKind(), placeholder: $('#guess-song').placeholder, year: !$('#guess-year').classList.contains('hidden'),
        submit: isMelody(), who: state.mode === 'buzz' && state.buzz && state.buzz.answering != null ? state.players[state.buzz.answering].name : activePlayer().name,
      } : null,
    });
    // mgła: lata na osi gracza ukryte dla innych (duży ekran i telefony – poza telefonem właściciela)
    const fogged = (p) => p && p.fogUntil > state.turnsPlayed ? p.name : null;
    const card = (c, p) => {
      const fog = fogged(p);
      const out = c.start ? { y: c.y, start: true } : { y: c.y, t: c.t, a: c.a, cc: c.cc, new: revealed && c === state.current };
      if (fog) out.fog = fog;
      return out;
    };
    if (isTimeline()) {
      // aktywny gracz na górze, potem pozostali
      const order = state.players.map((p, i) => ({ p, i })).sort((x, y) => (y.i === state.turn) - (x.i === state.turn));
      const choosing = ['listen', 'placed', 'challenge'].includes(state.phase) && !!state.current;
      const challenger = state.challenger != null ? state.players[state.challenger] : null;
      snap.timelines = order.map(({ p, i }) => {
        // stan gracza (karty, żetony) z tablicy wyników – na dużym ekranie pokazywany przy jego osi zamiast u góry
        const sc = $$('#scoreboard .score')[i];
        const tl = { name: p.name, active: i === state.turn, cards: p.timeline.map((c) => card(c, p)), sub: sc ? sc.textContent.replace(`${p.name}: `, '').trim() : '' };
        if (i !== state.turn) return tl;
        // gdzie gracz (i ewentualnie wyzywający) położył kartę, a po pomyłce – gdzie było jej miejsce
        if (choosing) {
          tl.slot = state.slot;
          tl.slotLabel = state.mode === 'solo' ? T('tutaj') : p.name;
          if (state.challengeMode === 'all') {
            tl.challenges = state.challenges.filter((x) => x.slot != null).map((x) => ({ slot: x.slot, label: state.players[x.i].name }));
          } else if (challenger && state.challengeSlot != null) { tl.challengeSlot = state.challengeSlot; tl.challengeLabel = challenger.name; }
        } else if (revealed && state.marks) {
          tl.marks = { slot: state.marks.slot, correct: state.marks.correct, challengeSlot: state.marks.challengeSlot,
            who: state.mode === 'solo' ? T('Twój wybór') : p.name, challenger: challenger ? challenger.name : '', year: state.current.y };
        }
        return tl;
      });
      // przypomnienie o wyzwaniu: kto może je rzucić (ma żeton) i co się dzieje w trakcie
      if (isMulti() && choosing) {
        const can = state.players.filter((pl, i) => i !== state.turn && pl.tokens >= 1).map((pl) => pl.name);
        if (state.phase === 'challenge') {
          snap.challenge = challenger ? '' : T('⚔ Kto rzuca wyzwanie? (koszt: 1 żeton)');
        } else if (can.length) {
          // przy wielu graczach krócej: „wszyscy pozostali” albo kilka imion i liczba pozostałych
          const who = can.length === state.players.length - 1 && can.length > 2 ? T('wszyscy pozostali gracze')
            : (can.length > 5 ? `${can.slice(0, 4).join(', ')} ${T('i {0} innych', can.length - 4)}` : can.join(', '));
          snap.challenge = T('⚔ Wyzwanie (1 żeton) mogą rzucić: {0}', who);
        }
      }
    } else if (state.mode === 'hilo' && state.ref) {
      const cards = [card(state.ref)];
      if (revealed) { const c = card(state.current); if (state.current.y < state.ref.y) cards.unshift(c); else cards.push(c); }
      snap.timelines = [{ name: '', active: true, cards }];
    }
  }
  remoteSend(snap);
}
function openTvWindow() {
  window.open('tv.html', 'songster-tv', 'width=1280,height=720');
  window.track && window.track('duzy-ekran');
  setTimeout(tvSync, 800);
}
function openTv() { $('#dlg-connect').showModal(); }
$('#btn-open-tv-window').addEventListener('click', () => { $('#dlg-connect').close(); openTvWindow(); });

// nowe połączenie (telewizor albo telefon gracza): stan gry → urządzenie, polecenia ← urządzenie
function addRemote(conn, role) {
  const r = { conn, role, name: '', seen: Date.now(), rtt: null };
  remotes.add(r);
  conn.on('data', (msg) => { r.seen = Date.now(); handleRemote(msg, r); });
  // telefon, który połączył się sam (np. po przeładowaniu gospodarza), przedstawia się na prośbę
  if (role === 'player') { try { conn.send({ whoAreYou: true }); } catch (e) { /* zerwane */ } }
  conn.on('close', () => {
    remotes.delete(r); renderRemoteList();
    if (role !== 'tv') return;
    $('#tv-status').textContent = T('Połączenie z dużym ekranem zostało przerwane – łączę ponownie…');
    // telewizor mógł się odświeżyć (np. po aktualizacji) – wraca z tym samym kodem, więc łączymy się ponownie
    reconnectTv(store.get('tvCode', ''), 0);
  });
  conn.on('error', () => { remotes.delete(r); renderRemoteList(); });
  renderRemoteList();
  tvSync();
  return r;
}
// telewizor pokazuje kod – telefon (pilot) łączy się z nim (także z kodu QR: index.html?tv=KOD)
async function connectTv(code, silent) {
  code = window.SongsterNet.normCode(code);
  if (silent) {
    // po przeładowaniu strony – ciche ponowne połączenie z ostatnim telewizorem
    try { const { conn } = await window.SongsterNet.connect('tv', code); addRemote(conn, 'tv'); $('#tv-status').textContent = T('✔ Połączono z dużym ekranem ({0}).', code); } catch (e) { /* telewizor wyłączony */ }
    return;
  }
  if (code.length !== 4) { $('#tv-status').textContent = T('Kod ma 4 znaki.'); return; }
  $('#tv-status').textContent = T('Łączenie z telewizorem…');
  try {
    const { conn } = await window.SongsterNet.connect('tv', code);
    addRemote(conn, 'tv');
    store.set('tvCode', code);
    $('#tv-status').textContent = T('✔ Połączono z dużym ekranem ({0}).', code);
    window.track && window.track('tv-siec');
  } catch (e) {
    $('#tv-status').textContent = T('Nie udało się połączyć – sprawdź kod i czy duży ekran jest otwarty.');
  }
}
$('#btn-tv-connect').addEventListener('click', () => connectTv($('#tv-code').value));
function reconnectTv(code, attempt) {
  if (!code || attempt >= 6 || [...remotes].some((r) => r.role === 'tv')) return;
  setTimeout(async () => {
    if ([...remotes].some((r) => r.role === 'tv')) return;
    await connectTv(code, true);
    if (![...remotes].some((r) => r.role === 'tv')) reconnectTv(code, attempt + 1);
  }, 3000 + attempt * 2000);
}
// adres dużego ekranu do wpisania w przeglądarce telewizora (bez https://, krócej)
$('#tv-url').textContent = window.SongsterNet.pageUrl('tv.html').replace(/^https?:\/\//, '');
$('#tv-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); connectTv($('#tv-code').value); } });

// pokój dla telefonów graczy: kod + QR prowadzący do tv.html?join=KOD
let roomOpening = null;
function openRoom() {
  // jedno tworzenie pokoju naraz (wywoływane też automatycznie przy dużym ekranie)
  if (roomCode) return Promise.resolve();
  if (!roomOpening) roomOpening = openRoomNow().finally(() => { roomOpening = null; });
  return roomOpening;
}
let roomClose = null; // zamknięcie pokoju (rozłącza telefony graczy)
async function openRoomNow() {
  $('#btn-room').disabled = true;
  $('#btn-room').textContent = T('Tworzenie pokoju…');
  $('#lobby-status').textContent = T('Tworzenie pokoju…');
  $('#btn-lobby-retry').classList.add('hidden');
  try {
    const { code, close } = await window.SongsterNet.host('room', (conn) => addRemote(conn, 'player'), store.get('roomCode', ''));
    roomCode = code;
    roomClose = close;
    store.set('roomCode', code);
    const url = window.SongsterNet.pageUrl('tv.html', { join: code });
    const svg = await window.SongsterNet.qrSvg(url);
    $('#room-code').textContent = code;
    $('#room-link').textContent = url;
    $('#room-qr').innerHTML = svg;
    $('#room-box').classList.remove('hidden');
    $('#btn-room').classList.add('hidden');
    $('#lobby-code').textContent = code;
    $('#lobby-link').textContent = url;
    $('#lobby-qr').innerHTML = svg;
    $('#lobby-status').textContent = '';
    renderRemoteList();
    tvSync();
    window.track && window.track('pokoj-graczy');
  } catch (e) {
    $('#btn-room').disabled = false;
    $('#btn-room').textContent = T('Utwórz pokój dla graczy');
    $('#lobby-status').textContent = T('Nie udało się utworzyć pokoju (brak połączenia z serwerem pośredniczącym). Gracze mogą grać na tym urządzeniu.');
    $('#btn-lobby-retry').classList.remove('hidden');
    if ($('#dlg-connect').open) alert(T('Nie udało się utworzyć pokoju (brak połączenia z serwerem pośredniczącym). Spróbuj ponownie.'));
  }
}
// zamknięcie pokoju – telefony graczy dostają „bye” i pokazują ekran rozłączenia
function closeRoom() {
  if (roomClose) { try { roomClose(); } catch (e) { /* już zamknięty */ } }
  roomClose = null;
  roomCode = null;
  for (const r of [...remotes]) if (r.role === 'player') { remotes.delete(r); try { r.conn.close(); } catch (e) { /* zerwane */ } }
  $('#room-box').classList.add('hidden');
  $('#btn-room').classList.remove('hidden');
  $('#btn-room').disabled = false;
  $('#btn-room').textContent = T('Utwórz pokój dla graczy');
  $('#lobby-code').textContent = '…';
  $('#lobby-qr').replaceChildren();
  $('#lobby-link').textContent = '';
  renderRemoteList();
}
$('#btn-room').addEventListener('click', openRoom);
function renderRemoteList() {
  const list = $('#room-list');
  if (!list) return;
  const players = [...remotes].filter((r) => r.role === 'player');
  list.replaceChildren(...(players.length ? players.map((r) => el('li', {}, '📱 ', r.name || T('(jeszcze nie wybrano gracza)')))
    : [el('li', { class: 'muted' }, T('Nikt jeszcze nie dołączył.'))]));
  // znaczki 📱 przy graczach w lobby i na liście trybów
  if (lobby.active) { renderLobby(); renderModes(); }
  updatePlaybackOptions();
}
// adres z kodu QR telewizora: index.html?tv=KOD
{
  const tvParam = new URLSearchParams(window.location.search).get('tv');
  if (tvParam) {
    $('#tv-code').value = tvParam;
    connectTv(tvParam).then(() => { if (remotes.size) { $('#dlg-connect').showModal(); } });
  } else if (store.get('tvCode', '')) {
    $('#tv-code').value = store.get('tvCode', '');
    connectTv(store.get('tvCode', ''), true);
  }
}

$('#logo').addEventListener('click', () => {
  if ($('#screen-game').classList.contains('hidden') || confirm(T('Przerwać grę i wrócić do ekranu startowego?'))) {
    state.drawId++;
    // w multiplayerze – do wyboru trybu (lobby i telefony zostają połączone)
    if (lobby.active) showModes(); else showScreen('home');
  }
});
$('#btn-rules').addEventListener('click', () => $('#dlg-rules').showModal());
$('#btn-tv').addEventListener('click', openTv);
$('#btn-tv-home').addEventListener('click', openTv);
$('#btn-settings').addEventListener('click', () => {
  const visible = SCREENS.find((s) => !$('#screen-' + s).classList.contains('hidden'));
  if (visible === 'settings') return;
  if (visible === 'game' && !confirm(T('Przerwać grę i przejść do ustawień?'))) return;
  state.drawId++;
  screenBeforeSettings = visible === 'game' ? (lobby.active ? 'modes' : 'home') : visible;
  renderSettings();
  if (typeof lyRenderReports === 'function') lyRenderReports();
  showScreen('settings');
});
$('#btn-settings-back').addEventListener('click', () => {
  if (screenBeforeSettings === 'setup') updatePoolInfo();
  if (screenBeforeSettings === 'end') renderPlayedList();
  showScreen(screenBeforeSettings);
});
