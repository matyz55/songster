'use strict';
// Songster – rysowanie ekranu gry, przeciąganie kart.
// Pliki js/*.js to zwykłe skrypty ładowane po kolei (index.html) – współdzielą zmienne globalne.
/* ---------- renderowanie gry ---------- */
// które pola odpowiedzi są na ekranie
function guessFields() {
  // Licytacja sekund: tylko tytuł i dopiero po licytacji
  if (state.mode === 'seconds') return state.secs && state.secs.phase === 'play' ? { title: true, artist: false, year: false } : {};
  if (isMelody()) {
    const t = state.guessType;
    return { title: t !== 'artist', artist: t !== 'title', year: false };
  }
  if (!isTimeline()) return {};
  const ex = state.expert || [];
  const solo = state.mode === 'solo';
  return { title: solo || ex.includes('title'), artist: solo || ex.includes('artist'), year: ex.includes('year') || state.special === 'golden' };
}

function render() {
  if (!state.players.length || $('#screen-game').classList.contains('hidden')) return;
  const p = activePlayer();
  const timeline = isTimeline();

  renderHeader(p, timeline);

  const canSkip = ['listen', 'placed'].includes(state.phase) && !!state.current && !(isSteps() || ['buzz', 'hilo', 'duel', 'sort5', 'bingo', 'royale', 'seconds', 'bomb', 'mashup', 'live'].includes(state.mode)) && !isQuiz();
  $('#btn-skip').textContent = timeline ? T('⏭ Pomiń (🪙 {0})', SKIP_COST) : T('⏭ Inna piosenka');
  $('#btn-skip').disabled = !canSkip || (timeline && p.tokens < SKIP_COST);
  $('#btn-skip').classList.toggle('hidden', (isSteps() || ['buzz', 'hilo', 'duel', 'sort5', 'bingo', 'royale', 'seconds', 'bomb', 'mashup', 'live'].includes(state.mode)) || isQuiz());
  // Ułóż piątkę: każdy fragment ma własny przycisk ▶
  // Łańcuch skojarzeń: bez muzyki do chwili odpowiedzi
  $('#btn-play').classList.toggle('hidden', state.mode === 'sort5' || (state.mode === 'chain' && state.phase !== 'revealed'));
  renderCoverFog();
  renderWordsBox();
  applyMirror();

  // pola odpowiedzi: zawsze w „Jaka to melodia”; przy osi czasu – w trybie ekspert (wymagane)
  // i w solo (tytuł + wykonawca opcjonalnie, za żeton)
  const fields = guessFields();
  const showGuess = !!state.current && state.phase !== 'revealed' && state.phase !== 'challenge'
    && (fields.title || fields.artist || fields.year)
    && (state.mode !== 'buzz' || (state.buzz && state.buzz.answering != null));
  $('#guess-form').classList.toggle('hidden', !showGuess);
  if (showGuess) {
    const ex = state.expert || [];
    const kind = suggestKind();
    $('#guess-song').closest('.suggest-wrap').classList.toggle('hidden', !kind);
    $('#guess-solved').classList.add('hidden');
    $('#guess-year').classList.toggle('hidden', !fields.year);
    const base = { both: T('Wpisz tytuł lub wykonawcę – od 3 liter pojawią się podpowiedzi'), title: T('Wpisz tytuł – od 3 liter pojawią się podpowiedzi'),
      artist: T('Wpisz wykonawcę – od 3 liter pojawią się podpowiedzi') }[kind] || '';
    const required = ['title', 'artist'].some((part) => fields[part] && ex.includes(part));
    $('#guess-song').placeholder = isMelody() ? base : `${base} (${required ? T('wymagany') : T('opcjonalnie – za żeton')})`;
    $('#guess-year').placeholder = T('Dokładny rok wydania (wymagany)');
    $('#btn-guess').classList.toggle('hidden', !isMelody());
    $('#btn-giveup').classList.toggle('hidden', state.mode !== 'melody');
    if (isSteps()) renderStepsGuess();
  }
  renderStepsBar();
  renderBuzzers();
  renderBingoBoards();
  renderClimbLadder();
  renderSpecialBadge();

  const hints = {
    listen: timeline ? (state.mode === 'solo'
      ? T('Przeciągnij kartę na oś albo kliknij miejsce (＋), gdzie pasuje ta piosenka.')
      : T('{0}, przeciągnij kartę na oś albo kliknij miejsce (＋), gdzie pasuje ta piosenka.', answering(p) || p.name)) : '',
    placed: isMulti() ? T('Zatwierdź wybór albo pozwól innym rzucić wyzwanie.') : T('Zatwierdź wybór.'),
    challenge: state.challenger == null
      ? T('Kto rzuca wyzwanie? (koszt: 1 żeton)')
      : (state.challengeMode === 'year'
        ? T('{0}, wpisz dokładny rok wydania tej piosenki.', state.players[state.challenger]?.name)
        : T('{0}, wybierz INNE miejsce na osi gracza {1}.', state.players[state.challenger]?.name, p.name)),
    revealed: !state.skipped && isMulti() && !state.awarded && !(guessFields().title && guessFields().artist)
      ? (state.mode === 'teams' ? T('Czy drużyna podała poprawnie wykonawcę i tytuł? Decydują pozostali.')
        : T('Czy gracz podał poprawnie wykonawcę i tytuł? Decyduje reszta stołu.')) : '',
  };
  $('#hint').textContent = (state.current || state.phase === 'revealed') ? (hints[state.phase] || '') : '';

  if (state.mode === 'hilo') hints.listen = T('Ta piosenka jest starsza czy nowsza od karty poniżej?');
  if (state.mode === 'duel') hints.listen = T('Z której dekady jest ta piosenka?');
  if (isQuiz()) hints.listen = QUIZ[state.mode].hint();
  if (state.mode === 'royale') hints.listen = royaleStatus();
  if (state.mode === 'live') hints.listen = T('Co to za piosenka? Kto pierwszy dobrze odpowie – 2 pkt, drugi dobrze – 1 pkt. Gra do {0} pkt.', liveTarget());
  if (state.mode === 'seconds') hints.listen = secsStatus();
  if (state.mode === 'bomb') hints.listen = bombStatus();
  if (state.mode === 'mashup') hints.listen = mashupStatus();
  if (state.mode === 'sort5') hints.listen = sortHint();
  if (state.mode === 'bingo') hints.listen = T('Każdy zaznacza na swojej planszy jedno pole, które pasuje do tej piosenki. Trzy skreślone w linii – BINGO!');
  if (state.mode === 'hilo' || state.mode === 'duel' || isQuiz() || state.mode === 'sort5' || state.mode === 'bingo' || state.mode === 'royale' || state.mode === 'live' || state.mode === 'seconds' || state.mode === 'bomb' || state.mode === 'mashup') $('#hint').textContent = state.current && state.phase === 'listen' ? hints.listen : '';

  const tl = $('#timeline');
  tl.classList.toggle('hidden', !timeline && state.mode !== 'hilo');
  if (timeline) renderTimeline(tl, p.timeline, ['listen', 'placed', 'challenge'].includes(state.phase),
    state.phase === 'revealed' ? state.marks : null);
  if (state.mode === 'hilo') renderHiloCards(tl);
  renderDragCard();
  renderOthers();
  renderActions();
  keepPlayingAfterReveal();
  tvSync();
  if (typeof scheduleSave === 'function') scheduleSave();
}

// żetony: ikonka i liczba („🪙 3”) – czytelniejsze niż rząd monet
function tokensLabel(n) { return `🪙 ${Math.max(0, n || 0)}`; }
// tablica wyników i tytuł tury – zależnie od trybu
function renderHeader(p, timeline) {
  const sb = $('#scoreboard');
  sb.classList.toggle('hidden', state.players.length === 1 && !isMelody() && state.mode !== 'duel' && !isQuiz() && state.mode !== 'sort5' && state.mode !== 'bingo' && state.mode !== 'royale' && state.mode !== 'bomb');
  // impreza: która minigra i ile zostało
  const pt = state.party;
  $('#party-bar').classList.toggle('hidden', !pt);
  if (pt) {
    const g = PARTY_GAMES[pt.plan[pt.idx]];
    $('#party-bar').textContent = pt.until ? T('🥳 Minigra {0}: {1} {2} · ⏳ ok. {3} min do końca', pt.idx + 1, g.icon, T(g.name), Math.max(0, Math.ceil((pt.until - Date.now()) / 60000)))
      : T('🥳 Minigra {0} z {1}: {2} {3}', pt.idx + 1, pt.plan.length, g.icon, T(g.name));
  }
  sb.replaceChildren(...state.players.map((pl, i) => el('div', {
    class: 'score' + (i === state.turn && state.mode !== 'buzz' && state.mode !== 'bingo' ? ' active' : ''),
    style: state.mode === 'buzz' ? `border-color:${BUZZ_COLORS[i]}` : null,
  }, pl.name, ': ', timeline
    ? [el('b', {}, String(pl.timeline.length)), T('/{0} kart · ', state.winTarget), el('span', { class: 'tokens' }, tokensLabel(pl.tokens)),
      pl.shield ? ' 🛡️' : '', pl.fogUntil > state.turnsPlayed ? ' 🌫️' : '']
    : state.mode === 'royale' || state.mode === 'bomb' ? ['❤️'.repeat(Math.max(0, pl.hearts)) || '💀', state.mode === 'bomb' && i === state.turn && state.bomb && state.bomb.phase !== 'boom' ? ' 💣' : '']
    : state.mode === 'climb' ? [el('b', {}, climbLabel(pl)), (pl.climb || 0) >= CLIMB.length ? ' 🏔️' : '']
    : [el('b', {}, String(pl.score)), T(' pkt')])));
  const title = $('#turn-title');
  const info = $('#turn-info');
  info.classList.toggle('tokens', timeline);
  const songNo = state.turnsPlayed + (state.phase === 'revealed' ? 0 : 1);
  if (state.mode === 'live') {
    title.textContent = T('Runda {0}', songNo);
    info.textContent = T('⚡ Pojedynek na żywo – do {0} pkt', liveTarget());
  } else if (state.mode === 'royale' || state.mode === 'bomb') {
    title.textContent = T('Runda {0}', songNo);
    info.textContent = T('W grze: {0} z {1}', royaleAlive().length, state.players.length);
  } else if (state.mode === 'bingo') {
    title.textContent = T('Piosenka {0} z {1}', Math.min(songNo, state.rounds), state.rounds);
    info.textContent = T('Cały wiersz, kolumna albo przekątna – BINGO!');
  } else if (state.mode === 'buzz') {
    title.textContent = T('Piosenka {0} z {1}', Math.min(songNo, state.rounds), state.rounds);
    info.textContent = TOUCH_ONLY ? T('Dotknij swojego pola, gdy znasz odpowiedź') : T('Naciśnij swój przycisk albo klawisz, gdy znasz odpowiedź');
  } else if (state.mode === 'hilo' && state.hiloMulti) {
    title.textContent = T('Tura: {0}', p.name);
    info.textContent = T('Runda {0}/{1}', Math.min(state.rounds, Math.floor(state.turnsPlayed / state.players.length) + 1), state.rounds);
  } else if (state.mode === 'hilo') {
    const rec = store.get('records', {})[`hilo${state.difficulty}`] || 0;
    title.textContent = T('Seria: {0}', state.streak);
    info.textContent = T('Rekord: {0}', Math.max(rec, state.streak));
  } else if (isQuiz() || state.mode === 'sort5') {
    quizHeader(p, title, info);
  } else if (state.mode === 'duel') {
    const round = Math.min(state.rounds, Math.floor(state.turnsPlayed / state.players.length) + 1);
    title.textContent = state.players.length > 1 ? T('Tura: {0}', p.name) : T('Piosenka {0} z {1}', songNo, state.rounds);
    info.textContent = (state.duel ? `🥊 ${decadeLabelLong(state.duel[0])} ${T('kontra')} ${decadeLabelLong(state.duel[1])}` : '🥊')
      + (state.players.length > 1 ? ` · ${T('Runda {0}/{1}', round, state.rounds)}` : ` · ${T('Wynik: {0} pkt', p.score)}`);
  } else if (isMelody()) {
    const round = Math.min(state.rounds, Math.floor(state.turnsPlayed / state.players.length) + 1);
    title.textContent = state.players.length > 1 ? T('Tura: {0}', p.name) : T('Piosenka {0} z {1}', songNo, state.rounds);
    info.textContent = state.players.length > 1 ? T('Runda {0}/{1}', round, state.rounds) : T('Wynik: {0} pkt', p.score);
  } else if (state.mode === 'timed') {
    renderTimer();
  } else {
    const placed = p.timeline.filter((c) => !c.start).length;
    const rec = store.get('records', {})[state.recordLevel] || 0;
    title.textContent = state.mode !== 'solo' ? T('Tura: {0}', turnName(p))
      : state.coop ? T('Wspólna oś: {0} z {1} · odpowiada: {2}', cardsLabel(p.timeline.length), state.winTarget, answering(p) || '–')
      : (state.endless ? T('Ułożone piosenki: {0} · rekord: {1}', placed, Math.max(rec, placed))
        : T('Twoja oś: {0} z {1}', cardsLabel(p.timeline.length), state.winTarget));
    info.textContent = T('Żetony: {0}', tokensLabel(p.tokens))
      + (state.mode === 'solo' ? T(' · Pomyłki: {0}', '❤️'.repeat(Math.max(0, p.lives))) : '');
  }
}

/* --- przeciąganie karty na oś (palcem lub myszą); kliknięcie „＋” działa nadal --- */
function dragAllowed() {
  if (!isTimeline() || !state.current) return false;
  if (state.phase === 'listen' || state.phase === 'placed') return true;
  return state.phase === 'challenge' && state.challenger != null && state.challengeMode === 'place';
}
function renderDragCard() {
  const card = $('#drag-card');
  const ok = dragAllowed();
  card.classList.toggle('hidden', !ok);
  if (!ok) return;
  card.lastChild.textContent = state.phase === 'challenge'
    ? T(' {0}: przeciągnij kartę na inne miejsce', state.players[state.challenger].name)
    : T(' Przeciągnij kartę na oś');
}
{
  const card = $('#drag-card');
  let drag = null;
  const slotAt = (x, y) => {
    const t = document.elementFromPoint(x, y);
    const slot = t && t.closest('#timeline .slot');
    return slot && !slot.disabled ? slot : null;
  };
  const autoScroll = () => {
    if (!drag) return;
    const { x, y } = drag;
    const edge = 70;
    if (y < edge) window.scrollBy(0, -14); else if (y > window.innerHeight - edge) window.scrollBy(0, 14);
    const tl = $('#timeline');
    const r = tl.getBoundingClientRect();
    if (tl.scrollWidth > tl.clientWidth && y > r.top && y < r.bottom) {
      if (x < r.left + edge) tl.scrollLeft -= 14; else if (x > r.right - edge) tl.scrollLeft += 14;
    }
    drag.over = slotAt(drag.x, drag.y);
    $$('#timeline .slot.drop-over').forEach((sl) => sl !== drag.over && sl.classList.remove('drop-over'));
    if (drag.over) drag.over.classList.add('drop-over');
    drag.raf = requestAnimationFrame(autoScroll);
  };
  const end = (drop) => {
    if (!drag) return;
    cancelAnimationFrame(drag.raf);
    drag.ghost.remove();
    card.classList.remove('dragging');
    $$('#timeline .slot.drop-over').forEach((sl) => sl.classList.remove('drop-over'));
    const target = drop && slotAt(drag.x, drag.y);
    drag = null;
    if (target) onSlotClick(Number(target.dataset.slot));
  };
  card.addEventListener('pointerdown', (e) => {
    if (!dragAllowed() || e.button > 0) return;
    e.preventDefault();
    card.setPointerCapture(e.pointerId);
    const ghost = el('div', { class: 'drag-ghost', 'aria-hidden': 'true' }, el('span', { class: 'dc-vinyl' }), ' ?');
    document.body.append(ghost);
    drag = { x: e.clientX, y: e.clientY, ghost, over: null, raf: 0 };
    ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    card.classList.add('dragging');
    drag.raf = requestAnimationFrame(autoScroll);
  });
  card.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });
  card.addEventListener('pointerup', () => end(true));
  card.addEventListener('pointercancel', () => end(false));
}

// osie pozostałych graczy (multiplayer, opcja „Pokazuj osie wszystkich graczy”)
function renderOthers() {
  const box = $('#others');
  const show = isMulti() && state.showAll;
  box.classList.toggle('hidden', !show);
  if (!show) return;
  const fresh = state.phase === 'revealed' ? state.current : null;
  box.replaceChildren(el('h2', {}, state.mode === 'teams' ? T('Osie pozostałych drużyn') : T('Osie pozostałych graczy')), ...state.players.map((pl, i) => (i === state.turn ? null
    : el('div', { class: 'other' },
      el('div', { class: 'other-head' }, el('b', {}, pl.name), ` · ${cardsLabel(pl.timeline.length)} · `,
        el('span', { class: 'tokens' }, tokensLabel(pl.tokens))),
      el('div', { class: 'mini-timeline' }, pl.timeline.map((s) => el('div', { class: 'mini' + (s === fresh ? ' new' : '') + (s.start ? ' start' : '') },
        el('b', {}, String(s.y)), el('span', { class: 'mt' }, s.start ? T('start') : s.t), el('span', { class: 'ma' }, s.start ? '' : s.a)))))))
    .filter(Boolean));
}

function renderTimeline(container, timeline, interactive, marks) {
  const items = [];
  const revealedSong = state.phase === 'revealed' ? state.current : null;
  for (let i = 0; i <= timeline.length; i++) {
    if (marks) {
      const who = state.mode === 'solo' ? T('Twój wybór') : activePlayer().name;
      if (marks.slot === i) items.push(el('div', { class: 'mark bad' }, `✘ ${who}`));
      if (marks.challengeSlot === i) items.push(el('div', { class: 'mark challenge' }, `✘ ${state.players[state.challenger].name}`));
      if (marks.correct === i) items.push(el('div', { class: 'mark ok' }, `✔ ${state.current.y}`));
    }
    if (interactive) {
      let cls = 'slot';
      let label = '＋';
      // przy jednej karcie na osi same plusy bywają mylące – podpisujemy kierunek
      if (timeline.length === 1) { cls += ' labeled'; label = i === 0 ? T('＋ Wcześniej') : T('＋ Później'); }
      if (state.slot === i) { cls += ' chosen'; label = state.mode === 'solo' ? T('tutaj') : activePlayer().name; }
      if (state.challengeMode === 'all' && state.phase === 'challenge') {
        const here = state.challenges.filter((x) => x.slot === i).map((x) => state.players[x.i].name);
        if (here.length) { cls += ' challenge'; label = here.join(', '); }
      } else if (state.challengeSlot === i) { cls += ' challenge'; label = state.players[state.challenger].name; }
      const disabled = !state.current
        || (state.phase === 'challenge' && (state.challenger == null || i === state.slot || state.challengeMode === 'year'));
      items.push(el('button', {
        class: cls, disabled, onclick: () => onSlotClick(i), 'aria-label': T('Miejsce {0}', i + 1), 'data-slot': String(i),
      }, label));
    }
    if (i < timeline.length) {
      const s = timeline[i];
      items.push(s.start
        ? el('div', { class: 'tcard start', title: T('Karta startowa – sam rok') },
          el('div', { class: 'a' }, T('karta startowa')),
          el('div', { class: 'y' }, String(s.y)),
          el('div', { class: 't' }, ''),
          el('div', { class: 'flag' }, '📅'))
        : el('div', { class: 'tcard' + (s === revealedSong ? ' new' : '') },
          el('div', { class: 'a' }, s.a),
          el('div', { class: 'y' }, String(s.y)),
          el('div', { class: 't' }, s.t),
          el('div', { class: 'flag' }, flagEl(s))));
    }
  }
  container.replaceChildren(...items);
  const chosen = container.querySelector('.chosen, .new, .mark.bad');
  if (chosen) chosen.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function renderActions() {
  const p = activePlayer();
  const btns = [];
  if (state.mode === 'mashup') {
    btns.push(...mashupActions());
  } else if (state.mode === 'bomb') {
    btns.push(...bombActions());
  } else if (state.mode === 'seconds') {
    btns.push(...secsActions());
  } else if (state.mode === 'royale') {
    btns.push(...royaleActions());
  } else if (state.mode === 'live') {
    btns.push(...liveActions());
  } else if (state.mode === 'bingo') {
    btns.push(...bingoActions());
  } else if (state.mode === 'sort5') {
    btns.push(...sortActions());
  } else if (isQuiz()) {
    btns.push(...quizActions());
  } else if (state.mode === 'hilo' || state.mode === 'duel' || state.mode === 'buzz') {
    btns.push(...quickActions(p));
  } else if (isMelody()) {
    if (isSteps() && state.phase === 'listen' && state.current) {
      btns.push(...stepsActions());
    }
    if (state.phase === 'revealed' && state.skipped) {
      btns.push(el('button', { class: 'primary', onclick: afterSkip }, T('Dalej – nowa piosenka →')));
    } else if (state.phase === 'revealed') {
      const last = state.turnsPlayed >= state.rounds * state.players.length;
      btns.push(el('button', { class: 'primary', onclick: nextTurn }, last ? T('Zobacz wyniki →') : (state.players.length > 1 ? T('Następny gracz →') : T('Następna piosenka →'))));
    }
  } else if (state.phase === 'listen' || state.phase === 'placed') {
    // główna akcja („Zatwierdź”, po odkryciu „Następny…”) zawsze pierwsza – po lewej, jak ▶ Odtwórz;
    // „Kup kartę” zawsze ostatni – przed i po odkryciu w tym samym miejscu
    btns.push(el('button', { class: 'primary', disabled: state.slot == null, onclick: onConfirmPlacement }, T('✔ Zatwierdź i odkryj')));
    if (isMulti()) {
      const canChallenge = state.players.some((pl, i) => i !== state.turn && pl.tokens >= 1);
      btns.push(el('button', {
        class: 'gold', disabled: state.slot == null || !canChallenge,
        onclick: () => { state.phase = 'challenge'; render(); },
      }, T('⚔ Wyzwanie')));
    }
    btns.push(el('button', {
      class: 'ghost buy-card', disabled: p.tokens < BUY_COST || !state.deck.size,
      title: T('Za 3 żetony odtwarzana piosenka trafia od razu na właściwe miejsce Twojej osi'),
      onclick: buyCard,
    }, T('Kup tę kartę (🪙 {0})', BUY_COST)));
  } else if (state.phase === 'challenge' && state.challengeMode === 'all') {
    // wszyscy naraz: kolejni wyzywający dołączają (1 żeton), każdy wskazuje swoje miejsce
    state.players.forEach((pl, i) => {
      if (i !== state.turn && pl.tokens >= 1 && !state.challenges.some((x) => x.i === i)) {
        btns.push(el('button', { class: 'gold', onclick: () => {
          pl.tokens -= 1; state.challenges.push({ i, slot: null }); state.challenger = i; state.challengeSlot = null; render();
        } }, pl.name));
      }
    });
    btns.push(el('button', { class: 'primary', disabled: !state.challenges.some((x) => x.slot != null), onclick: revealTimeline }, T('✔ Odkryj kartę')));
    if (!state.challenges.length) btns.push(el('button', { class: 'ghost', onclick: () => { state.phase = 'placed'; render(); } }, T('Anuluj')));
  } else if (state.phase === 'challenge') {
    if (state.challenger == null) {
      state.players.forEach((pl, i) => {
        if (i !== state.turn && pl.tokens >= 1) {
          btns.push(el('button', { class: 'gold', onclick: () => {
            state.challenger = i; pl.tokens -= 1; render();
          } }, pl.name));
        }
      });
      btns.push(el('button', { class: 'ghost', onclick: () => { state.phase = 'placed'; render(); } }, T('Anuluj')));
    } else {
      if (state.challengeMode === 'year') {
        const go = el('button', { class: 'primary', disabled: state.challengeYear == null, onclick: revealTimeline }, T('✔ Odkryj kartę'));
        const input = el('input', {
          type: 'number', id: 'challenge-year', min: '1900', max: String(new Date().getFullYear()), inputmode: 'numeric',
          placeholder: T('Rok, np. 1984'), 'aria-label': T('Rok wydania'), value: state.challengeYear ?? '',
          oninput: (e) => {
            const y = parseInt(e.target.value, 10);
            state.challengeYear = y >= 1900 && y <= new Date().getFullYear() ? y : null;
            go.disabled = state.challengeYear == null;
          },
          onkeydown: (e) => { if (e.key === 'Enter' && state.challengeYear != null) revealTimeline(); },
        });
        btns.push(input, go);
        setTimeout(() => input.focus(), 0);
      } else {
        btns.push(el('button', { class: 'primary', disabled: state.challengeSlot == null, onclick: revealTimeline }, T('✔ Odkryj kartę')));
      }
    }
  } else if (state.phase === 'revealed' && state.skipped) {
    btns.push(el('button', { class: 'primary', onclick: afterSkip }, T('Dalej – nowa piosenka →')));
  } else if (state.phase === 'revealed') {
    const over = state.mode === 'solo' && (p.lives <= 0 || (!state.endless && p.timeline.length >= state.winTarget));
    btns.push(el('button', { class: 'primary', onclick: nextTurn },
      over ? T('Zobacz podsumowanie →') : (isSoloLike() ? T('Następna piosenka →')
        : (state.mode === 'teams' ? T('Następna drużyna →') : T('Następny gracz →')))));
    // żeton „przy stole” – gdy tytułu i wykonawcy nie sprawdza gra
    if (isMulti() && !(guessFields().title && guessFields().artist)) {
      btns.push(el('button', {
        class: 'ok', disabled: state.awarded || p.tokens >= MAX_TOKENS,
        onclick: () => { p.tokens += 1; state.awarded = true; render(); },
      }, state.awarded ? T('+1 🪙 przyznany')
        : (state.mode === 'teams' ? T('🪙 Drużyna odgadła wykonawcę i tytuł') : T('🪙 Odgadł(a) wykonawcę i tytuł'))));
    }
    if (state.swapOffer) btns.push(...swapButtons(p));
    if (isTimeline()) {
      btns.push(el('button', {
        class: 'ghost buy-card', disabled: p.tokens < BUY_COST || !state.deck.size,
        title: T('Za 3 żetony dobierasz losową kartę z talii, która od razu trafia na właściwe miejsce osi'),
        onclick: buyCard,
      }, T('Kup losową kartę (🪙 {0})', BUY_COST)));
    }
  }
  // nie przebudowujemy listy „Ułóż piątkę” w trakcie przeciągania (zgubiłoby chwyt)
  if (!$('#actions .drag-active')) $('#actions').replaceChildren(...btns);
}

function onConfirmPlacement() {
  revealTimeline();
}

// Pierwsze słowa: początek tekstu przed odkryciem; dźwięk dopiero w ostatnim kroku
function renderWordsBox() {
  const box = $('#words-box');
  const on = state.mode === 'words' && state.phase === 'listen' && !!state.current && !!state.words;
  box.classList.toggle('hidden', !on);
  if (!on) return;
  box.textContent = wordsShown();
  $('#btn-play').disabled = state.clipLen === 0;
}
// Okładka z mgły: rozmyta okładka przed odkryciem; w pierwszym kroku bez dźwięku
function renderCoverFog() {
  const box = $('#cover-fog');
  const on = state.mode === 'cover' && state.phase === 'listen' && !!state.current && !!state.preview && !!state.preview.art;
  box.classList.toggle('hidden', !on);
  if (!on) return;
  let img = box.firstElementChild;
  if (!img) { img = el('div'); box.append(img); }
  const art = state.preview.art.replace(/\/\d+x\d+bb\./, '/600x600bb.');
  if (img.dataset.art !== art) { img.dataset.art = art; img.style.backgroundImage = `url("${art}")`; }
  const f = COVER_STEPS[state.step].blur;
  img.style.filter = f ? `blur(${Math.round((box.offsetWidth || 280) * f)}px)` : '';
  $('#btn-play').disabled = state.clipLen === 0;
}
