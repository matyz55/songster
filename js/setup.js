'use strict';
// Songster – ustawienia rozgrywki, filtry, zestawy piosenek.
// Pliki js/*.js to zwykłe skrypty ładowane po kolei (index.html) – współdzielą zmienne globalne.
/* ---------- ekran ustawień rozgrywki ---------- */
function openSetup(mode) {
  state.mode = mode;
  state.party = null;
  const cfg = MODES[mode];
  $('#setup-title').textContent = cfg.title;
  $$('[data-for]').forEach((n) => n.classList.toggle('hidden', !n.dataset.for.split(' ').includes(mode)));
  // karty ustawień, które w danym trybie nie mają znaczenia (np. pula piosenek w „Tak to leciało!”)
  $$('[data-hide-for]').forEach((n) => n.classList.toggle('hidden', n.dataset.hideFor.split(' ').includes(mode)));
  if (['lyrics', 'relay'].includes(mode)) lyLangPaint();
  // opcje tylko dla multiplayera (np. muzyka na telefonie gracza z turą)
  $$('#screen-setup [data-ctx]').forEach((n) => { if (!n.dataset.ctx.split(' ').includes(playCtx)) n.classList.add('hidden'); });
  if (playCtx === 'multi') {
    renderSetupPlayers(lobbyRows(mode));
  } else {
    // jeden gracz – właściciel telefonu (zapamiętane imię)
    const names = store.get('players', [T('Gracz {0}', 1)]);
    renderSetupPlayers([{ name: names[0] || T('Gracz {0}', 1) }]);
  }
  $('#rounds-label').textContent = mode === 'buzz' ? T('Liczba piosenek') : (cfg.teams ? T('Piosenek na drużynę') : T('Piosenek na gracza'));
  if (mode === 'duel') renderDuelPick();
  if (mode === 'party') renderPartyPick();
  if (mode === 'tour') renderTourPick();
  updatePlaybackOptions();
  updatePoolInfo();
  showScreen('setup');
}
// gracze z lobby jako wiersze ustawień gry; w drużynach – gracze podzieleni na dwie drużyny (do zmiany)
function lobbyRows(mode) {
  const names = lobby.players.map((p) => p.name);
  if (MODES[mode].teams) {
    const count = Math.max(1, Math.min(MAX_TEAMS, names.length >= 2 ? 2 : 1));
    const teams = Array.from({ length: count }, (_, i) => ({ name: T('Drużyna {0}', i + 1), members: [] }));
    names.forEach((n, i) => teams[i % count].members.push(n));
    return teams.map((t) => ({ name: t.name, members: t.members.join(', ') }));
  }
  const keys = store.get('buzzKeys', BUZZ_KEYS);
  const byName = store.get('buzzKeyByName', {});
  return names.slice(0, MODES[mode].maxPlayers).map((name, i) => ({ name, key: byName[name] || keys[i] }));
}

// rows: [{name, members?}] – w trybie drużyn każdy wiersz ma też listę członków
function renderSetupPlayers(rows) {
  const cfg = MODES[state.mode];
  const max = maxPlayersFor(state.mode);
  const min = minPlayersFor(state.mode);
  const noun = cfg.teams ? T('Drużyny') : T('Gracze');
  $('#sec-players h2').textContent = max === 1 ? T('Gracz') : `${noun} (${min}–${max})`;
  // „Kto pierwszy?”: każdy gracz ma swój klawisz (bez powtórzeń)
  if (state.mode === 'buzz') {
    const used = [];
    for (const r of rows) { if (!r.key || used.includes(r.key)) r.key = freeBuzzKey(used); used.push(r.key); }
  }
  $('#players-list').replaceChildren(...rows.map((r, i) => el('div', { class: 'player-row' + (cfg.teams ? ' team-row' : '') },
    el('input', { type: 'text', value: r.name, maxlength: '20', class: 'p-name', 'aria-label': cfg.teams ? T('Nazwa drużyny {0}', i + 1) : T('Gracz {0}', i + 1) }),
    state.mode === 'buzz' && !TOUCH_ONLY ? el('button', {
      type: 'button', class: 'ghost p-key', 'data-key': r.key, title: T('Kliknij i naciśnij klawisz, którym ten gracz będzie się zgłaszał'),
      onclick: (e) => captureBuzzKey(e.currentTarget),
    }, `⌨ ${keyLabel(r.key)}`) : null,
    cfg.teams ? el('input', {
      type: 'text', value: r.members || '', maxlength: '120', class: 'p-members',
      placeholder: T('Członkowie, np. Ania, Bartek, Ola'), 'aria-label': T('Członkowie drużyny {0}', i + 1),
    }) : null,
    remoteNames().has(r.name) ? el('span', { class: 'p-phone', title: T('Dołączył(a) przez telefon') }, '📱') : null,
    rows.length > 1 && max > 1
      ? el('button', { class: 'ghost', title: T('Usuń'), onclick: () => {
        const cur = readSetupRows(); cur.splice(i, 1); renderSetupPlayers(cur);
      } }, '✕')
      : null,
  )));
  $('#btn-add-player').textContent = cfg.teams ? T('+ Dodaj drużynę') : T('+ Dodaj gracza');
  $('#btn-add-player').classList.toggle('hidden', rows.length >= max);
  // dołączanie przez telefon – w multiplayerze
  $('#btn-join-phone').classList.toggle('hidden', max === 1 || rows.length >= max);
  $('#players-min').textContent = rows.length < min
    ? T('W tym trybie potrzeba co najmniej {0} – dodaj kolejnego gracza albo dołącz go przez telefon.', min) : '';
  renderTeamBoard();
  tvSync();
}
// drużyny w multiplayerze: gracze jako przyciski – stuknij gracza, potem drużynę (albo przeciągnij), „🎲 Losuj drużyny”
let teamMove = null;
const splitMembers = (txt) => (txt || '').split(/[,;\n]+/).map((m) => m.trim()).filter(Boolean);
function renderTeamBoard() {
  const box = $('#team-board');
  const on = !!(MODES[state.mode] && MODES[state.mode].teams && playCtx === 'multi');
  box.classList.toggle('hidden', !on);
  if (!on) return;
  const rows = readSetupRows();
  const move = (member, to) => {
    const cur = readSetupRows();
    for (const r of cur) r.members = splitMembers(r.members).filter((m) => m !== member).join(', ');
    cur[to].members = [...splitMembers(cur[to].members), member].join(', ');
    teamMove = null;
    renderSetupPlayers(cur);
  };
  box.replaceChildren(
    el('div', { class: 'team-tools' },
      el('button', { type: 'button', class: 'ghost', onclick: () => {
        const cur = readSetupRows();
        const all = shuffle(cur.flatMap((r) => splitMembers(r.members)));
        cur.forEach((r) => { r.members = ''; });
        all.forEach((m, i) => { const r = cur[i % cur.length]; r.members = [...splitMembers(r.members), m].join(', '); });
        teamMove = null;
        renderSetupPlayers(cur);
      } }, T('🎲 Losuj drużyny')),
      el('span', { class: 'muted small' }, teamMove ? T('Stuknij drużynę, do której ma przejść {0}', teamMove) : T('Stuknij gracza, a potem drużynę – albo przeciągnij.'))),
    el('div', { class: 'team-cols' }, rows.map((r, i) => el('div', {
      class: 'team-col' + (teamMove ? ' target' : ''),
      onclick: () => { if (teamMove) move(teamMove, i); },
      ondragover: (e) => e.preventDefault(),
      ondrop: (e) => { e.preventDefault(); const m = e.dataTransfer.getData('text/plain'); if (m) move(m, i); },
    }, el('b', {}, r.name || T('Drużyna {0}', i + 1)),
    el('div', { class: 'team-chips' }, splitMembers(r.members).map((m) => el('button', {
      type: 'button', class: 'chip' + (teamMove === m ? ' on' : ''), draggable: 'true',
      ondragstart: (e) => e.dataTransfer.setData('text/plain', m),
      onclick: (e) => { e.stopPropagation(); teamMove = teamMove === m ? null : m; renderTeamBoard(); },
    }, remoteNames().has(m) ? '📱 ' : '', m)))))));
}
const remoteNames = () => new Set([...remotes].filter((r) => r.role === 'player' && r.name).map((r) => r.name));
// gracz dołącza telefonem: trafia do lobby, a gdy gospodarz ustawia już grę – także na listę graczy (albo do drużyny)
function joinFromPhone(name, from) {
  name = String(name || '').trim().slice(0, 20);
  if (!name) return;
  if (!lobby.active) { from.conn.send({ joinError: 'closed' }); return; }
  const known = lobby.players.find((p) => sameName(p.name, name));
  if (known) { name = known.name; known.phone = true; } else {
    if (lobby.players.length >= MAX_PLAYERS) { from.conn.send({ joinError: 'full' }); return; }
    lobby.players.push({ name, phone: true });
  }
  from.name = name;
  from.conn.send({ joined: name });
  if (!$('#screen-setup').classList.contains('hidden')) {
    const rows = readSetupRows();
    const cfg = MODES[state.mode] || {};
    if (cfg.teams) {
      // nowy członek do najmniejszej drużyny (jeśli jeszcze go nie ma w żadnej)
      const members = (r) => r.members.split(/[,;\n]+/).map((m) => m.trim()).filter(Boolean);
      if (!rows.some((r) => sameName(r.name, name) || members(r).some((m) => sameName(m, name))) && rows.length) {
        const small = rows.reduce((x, y) => (members(y).length < members(x).length ? y : x));
        small.members = [...members(small), name].join(', ');
      }
      renderSetupPlayers(rows);
    } else if (!rows.some((r) => sameName(r.name, name)) && rows.length < maxPlayersFor(state.mode)) {
      rows.push({ name, members: '', key: undefined });
      renderSetupPlayers(rows);
    }
  }
  renderRemoteList();
  tvSync();
  fx('place');
}
$('#btn-join-phone').addEventListener('click', () => {
  $('#dlg-connect').classList.add('join-only');
  $('#dlg-connect').showModal();
  openRoom();
});
$('#dlg-connect').addEventListener('close', () => $('#dlg-connect').classList.remove('join-only'));
$('#players-list').addEventListener('change', () => { tvSync(); renderTeamBoard(); });
const readSetupRows = () => $$('#players-list .player-row').map((row) => ({
  name: row.querySelector('.p-name').value,
  members: row.querySelector('.p-members') ? row.querySelector('.p-members').value : '',
  key: row.querySelector('.p-key') ? row.querySelector('.p-key').dataset.key : undefined,
}));

// przypisanie klawisza: następny naciśnięty klawisz (Esc anuluje); zajęty klawisz zamienia się z innym graczem
let keyCapture = null;
function captureBuzzKey(btn) {
  if (keyCapture) keyCapture.btn.textContent = `⌨ ${keyLabel(keyCapture.btn.dataset.key)}`;
  keyCapture = { btn };
  btn.textContent = T('⌨ Naciśnij klawisz…');
  btn.classList.add('capturing');
}
document.addEventListener('keydown', (e) => {
  if (!keyCapture) return;
  e.preventDefault();
  e.stopPropagation();
  const { btn } = keyCapture;
  keyCapture = null;
  btn.classList.remove('capturing');
  if (e.code !== 'Escape' && e.code) {
    const other = $$('#players-list .p-key').find((b) => b !== btn && b.dataset.key === e.code);
    if (other) { other.dataset.key = btn.dataset.key; other.textContent = `⌨ ${keyLabel(other.dataset.key)}`; }
    btn.dataset.key = e.code;
  }
  btn.textContent = `⌨ ${keyLabel(btn.dataset.key)}`;
}, true);
const readSetupNames = () => readSetupRows().map((r) => r.name);

$('#btn-add-player').addEventListener('click', () => {
  const rows = readSetupRows();
  rows.push({ name: `${MODES[state.mode].teams ? T('Drużyna') : T('Gracz')} ${rows.length + 1}`, members: '', key: freeBuzzKey(rows.map((r) => r.key)) });
  renderSetupPlayers(rows);
});
$('#btn-back').addEventListener('click', () => { renderModes(); showScreen('modes'); });
$$('input[name=pool]').forEach((r) => r.addEventListener('change', updatePoolInfo));

const poolValue = () => document.querySelector('input[name=pool]:checked').value;

/* --- filtry: dekady, gatunki, kraje, popularność --- */
const NO_GENRE = 'bez gatunku';
const genreName = (g) => T(g);
const NO_COUNTRY = '?';
const genresOf = (s) => (s.g && s.g.length ? s.g : [NO_GENRE]);
const countryOf = (s) => (s.cc || NO_COUNTRY).toUpperCase();
const FILTERS = {
  decade: { values: (s) => [decadeOf(s)], label: decadeLabel, sort: (a, b) => a - b },
  genre: { values: genresOf, label: genreName, sort: (a, b) => (a === NO_GENRE) - (b === NO_GENRE) || a.localeCompare(b, 'pl') },
  country: {
    values: (s) => [countryOf(s)],
    label: (c) => (c === NO_COUNTRY ? '🌍 nieznany' : [flagEl({ cc: c }), ' ', countryName({ cc: c })]),
    sort: null, // wg liczby piosenek
  },
};
// popularność w Spotify (0–100): mediana liczona osobno dla piosenek polskich i zagranicznych
// (polskie mają w Spotify ogólnie niższe wskaźniki – wspólny próg odciąłby prawie wszystkie)
const POP_MEDIAN = (() => {
  const med = (c) => {
    const ps = window.SONGS.filter((s) => s.c === c && s.p != null).map((s) => s.p).sort((a, b) => a - b);
    return ps.length ? ps[Math.floor(ps.length / 2)] : 0;
  };
  return { PL: med('PL'), INT: med('INT') };
})();
// „bardzo łatwy”: po 500 najpopularniejszych piosenek polskich i zagranicznych w Spotify (razem ok. 1000)
const TOP_PER_CATEGORY = 500;
const TOP_SONGS = new Set(['PL', 'INT'].flatMap((c) => window.SONGS
  .filter((s) => s.c === c && s.p != null).sort((a, b) => b.p - a.p)
  .slice(0, TOP_PER_CATEGORY).map(songKey)));
// indeks = wartość w ustawieniach (zapisane filtry i rekordy); kolejność na ekranie ustala index.html
const LEVELS = [
  { name: T('Łatwy'), desc: T('Znane piosenki (popularniejsza połowa w Spotify), równomiernie z różnych dekad.'),
    // bez danych o popularności: klasyki z pierwotnej listy i przeboje z list przebojów są „znane”,
    // piosenki dodane z Wikipedii dla uzupełnienia roku (w) – już nie
    ok: (s) => (s.p == null ? !s.w : s.p >= POP_MEDIAN[s.c]) },
  { name: T('Średni'), desc: T('Wszystkie piosenki, równomiernie z różnych dekad.'), ok: () => true },
  { name: T('Trudny'), desc: T('Mniej znane piosenki. Na osi czasu częściej trafiają się utwory wydane blisko lat Twoich kart – ale dekady wciąż są wymieszane.'),
    // piosenki bez danych o popularności to klasyki i przeboje z list – nie są „mniej znane”
    ok: (s) => s.p != null && s.p < POP_MEDIAN[s.c] },
  { name: T('Bardzo łatwy'), desc: T('Tylko największe przeboje: ok. 1000 najpopularniejszych piosenek w Spotify (po połowie polskich i zagranicznych), równomiernie z różnych dekad.'),
    ok: (s) => TOP_SONGS.has(songKey(s)) },
];

const filterState = Object.assign(
  {
    decade: [], genre: [], country: [], level: 1, plShare: 50, clip: 30, random: false, hint: false, showAll: true, endless: false,
    timeLimit: 120, specials: [], duelA: null, duelB: null,
    challenge: 'place', expert: false, expTitle: true, expArtist: true, expYear: true, letterHint: true, tag: null, preset: 'all',
  },
  store.get('filters', {}),
); // decade/genre/country przechowują WYŁĄCZONE wartości
// dawne dekady sprzed 1960 r. nie są już osobnymi kategoriami
filterState.decade = filterState.decade.filter((d) => Number(d) >= OLDEST_DECADE);

function saveFilters() { store.set('filters', filterState); }

// piosenki zapisanej własnej listy (playlists.js) – klucze „wykonawca|tytuł”
const playlistKeys = (id) => new Set((store.get('playlists', {})[id] || []));
function songPool(ignore) {
  const p = poolValue();
  const lvl = LEVELS[filterState.level] || LEVELS[1];
  const tag = filterState.tag;
  // własna lista piosenek (playlists.js) – bez filtra poziomu trudności, bo piosenki wybrał gracz
  const list = tag && tag.startsWith('list:') ? playlistKeys(tag) : null;
  return window.SONGS.filter((s) => (p === 'ALL' || s.c === p)
    && !(filterState.noExplicit && s.ex)
    && (list ? list.has(songKey(s)) : lvl.ok(s) && (!tag || (s.tg && s.tg.includes(tag))))
    && Object.keys(FILTERS).every((f) => f === ignore
      || FILTERS[f].values(s).some((v) => !filterState[f].includes(String(v)))));
}

function renderFilters() {
  for (const [name, f] of Object.entries(FILTERS)) {
    // liczby przy filtrze uwzględniają pozostałe filtry, ale nie ten
    const counts = new Map();
    for (const s of songPool(name)) for (const v of f.values(s)) counts.set(v, (counts.get(v) || 0) + 1);
    const base = window.SONGS.filter((s) => poolValue() === 'ALL' || s.c === poolValue());
    const all = new Set(base.flatMap(f.values));
    const values = [...all].sort(f.sort || ((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0)));
    $('#f-' + name).replaceChildren(...values.map((v) => {
      const off = filterState[name].includes(String(v));
      return el('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(!off),
        onclick: () => {
          const list = filterState[name];
          const i = list.indexOf(String(v));
          if (i >= 0) list.splice(i, 1); else list.push(String(v));
          saveFilters(); updatePoolInfo();
        },
      }, f.label(v), el('span', { class: 'n' }, String(counts.get(v) || 0)));
    }));
  }
}

$$('[data-all]').forEach((b) => b.addEventListener('click', () => {
  filterState[b.dataset.all] = []; saveFilters(); updatePoolInfo();
}));
$$('[data-none]').forEach((b) => b.addEventListener('click', () => {
  const f = FILTERS[b.dataset.none];
  filterState[b.dataset.none] = [...new Set(window.SONGS.flatMap(f.values))].map(String);
  saveFilters(); updatePoolInfo();
}));
$$('input[name=level]').forEach((r) => {
  r.checked = Number(r.value) === filterState.level;
  r.addEventListener('change', () => { filterState.level = Number(r.value); saveFilters(); updatePoolInfo(); });
});
// piosenki niecenzuralne (pole ex w songs.js – tools/explicit.mjs; w trakcie gry także oznaczenie z iTunes)
$('#no-explicit').checked = !!filterState.noExplicit;
$('#no-explicit').addEventListener('change', (e) => { filterState.noExplicit = e.target.checked; saveFilters(); updatePoolInfo(); tvSync(); });
$('#pl-share').value = String(filterState.plShare);
$('#pl-share').addEventListener('input', (e) => { filterState.plShare = Number(e.target.value); saveFilters(); updatePoolInfo(); });
$('#endless').checked = filterState.endless;
$('#endless').addEventListener('change', (e) => { filterState.endless = e.target.checked; saveFilters(); updateModeOptions(); });
$$('input[name=audio-out]').forEach((r) => {
  r.checked = r.value === store.get('audioOut', 'host');
  r.addEventListener('change', () => { store.set('audioOut', r.value); tvSync(); });
});
// opcje odtwarzania zależne od sytuacji:
// • „fragment z losowego miejsca” – tylko gdy wycinek jest krótszy od całego 30-sekundowego podglądu
//   (przy „30 s (cały)” nie ma się gdzie przesunąć) albo w trybach z krokami 1–8 s,
// • „muzyka gra na” – tylko gdy jest podłączony duży ekran albo (w multiplayerze) telefon gracza
function updatePlaybackOptions() {
  if (!state.mode || !MODES[state.mode]) return;
  $('#clip-random-row').classList.toggle('hidden', !(isSteps() || state.mode === 'party' || filterState.clip < 30));
  const display = tvWindowSeen || [...remotes].some((r) => r.role === 'tv');
  const phones = playCtx === 'multi' && [...remotes].some((r) => r.role === 'player' && r.name);
  const playerOk = phones && $('#audio-out-player').dataset.for.split(' ').includes(state.mode);
  $('#audio-out-tv').classList.toggle('hidden', !display);
  $('#audio-out-player').classList.toggle('hidden', !playerOk);
  $('#audio-out-box').classList.toggle('hidden', !display && !playerOk);
  // zapamiętany wybór chwilowo niedostępny – pokazujemy „to urządzenie” (zapis zostaje na następny raz)
  const cur = store.get('audioOut', 'host');
  const avail = { host: true, tv: display, player: playerOk }[cur];
  $$('input[name=audio-out]').forEach((r) => { r.checked = avail ? r.value === cur : r.value === 'host'; });
}
// Tak to leciało! i Sztafeta karaoke: piosenki z polskim tekstem, zagraniczne przeboje z angielskim tekstem albo mieszane
function lyLangPaint() {
  const cur = lyLangPref();
  $$('input[name=ly-lang]').forEach((r) => {
    const n = lyLangCount(r.value);
    r.checked = r.value === cur;
    r.disabled = n < 40 && r.value !== cur;
    r.closest('label').title = T('{0} piosenek', n);
  });
  const n = lyLangCount(cur);
  $('#ly-lang-info').textContent = cur === 'en' ? T('Bardzo popularne zagraniczne przeboje z tekstem po angielsku – w katalogu: {0}.', n)
    : cur === 'mix' ? T('Polskie piosenki i zagraniczne przeboje z tekstem po angielsku – w katalogu: {0}.', n)
      : T('Piosenki z polskim tekstem – w katalogu: {0}.', n);
}
$$('input[name=ly-lang]').forEach((r) => r.addEventListener('change', () => { store.set('lyLang', r.value); lyLangPaint(); }));
// bingo: rozmiar planszy (3×3, 4×4, 5×5)
$$('input[name=bingo-size]').forEach((r) => {
  r.checked = Number(r.value) === (filterState.bingoSize || 3);
  r.addEventListener('change', () => { filterState.bingoSize = Number(r.value); saveFilters(); tvSync(); });
});
$$('input[name=challenge]').forEach((r) => {
  r.checked = r.value === filterState.challenge;
  r.addEventListener('change', () => { filterState.challenge = r.value; saveFilters(); updateModeOptions(); });
});
// rekordy gry bez końca – osobno dla każdego poziomu trudności
const recordKey = () => `level${filterState.level}`;
function updateModeOptions() {
  $('#win-target').disabled = state.mode === 'solo' && filterState.endless;
  const rec = store.get('records', {})[recordKey()];
  $('#record-info').textContent = filterState.endless
    ? (rec ? T('Twój rekord na poziomie „{0}” – ułożone piosenki: {1}.', (LEVELS[filterState.level] || LEVELS[1]).name, rec) : T('Nie masz jeszcze rekordu na tym poziomie.'))
    : '';
  $('#expert-opts').classList.toggle('hidden', !filterState.expert);
  const sp = (filterState.specials || []).filter((k) => isMultiMode(state.mode) || k === 'double' || k === 'golden');
  $('#special-desc').textContent = sp.length
    ? sp.map((k) => `${SPECIALS[k].icon} ${T(SPECIALS[k].name)}: ${T(SPECIALS[k].desc)}`).join(' · ') : '';
  const lvlName = (LEVELS[filterState.level] || LEVELS[1]).name;
  const tr = (store.get('timedRecords', {})[`${filterState.timeLimit || 120}-${filterState.level}`] || [])[0];
  $('#timed-records').textContent = tr ? T('Rekord ({0}, poziom „{1}”): {2}', timeLabel(filterState.timeLimit || 120), lvlName, cardsLabel(tr.score)) : '';
  const hr = store.get('records', {})[`hilo${filterState.level}`];
  $('#hilo-record').textContent = hr ? T('Twój rekord na poziomie „{0}”: seria {1}.', lvlName, hr) : '';
  const parts = expertParts();
  $('#expert-desc').textContent = parts.length
    ? T('Kartę zatrzymujesz tylko wtedy, gdy ułożysz ją dobrze i podasz: {0}.', parts.map((x) => PART_NAMES[x]).join(', '))
    : '';
  $('#challenge-desc').textContent = filterState.challenge === 'year'
    ? T('Pretendent wpisuje rok wydania. Jeśli trafi co do roku – zabiera kartę, niezależnie od tego, czy gracz ułożył ją dobrze.')
    : filterState.challenge === 'all'
      ? T('Wyzwanie może rzucić kilka osób naraz (każda płaci 1 żeton) – każda wskazuje swoje miejsce. Jeśli gracz się pomyli, kartę zabiera ta, która pierwsza wskazała dobre miejsce.')
      : T('Pretendent wskazuje inne miejsce na osi gracza. Jeśli gracz się pomyli, a pretendent trafi – zabiera kartę.');
}
$('#show-all').checked = filterState.showAll;
$('#show-all').addEventListener('change', (e) => { filterState.showAll = e.target.checked; saveFilters(); });
$('#clip-length').value = String(filterState.clip);
$('#clip-length').addEventListener('change', (e) => { filterState.clip = Number(e.target.value); saveFilters(); updatePlaybackOptions(); });
$('#clip-random').checked = filterState.random;
$('#clip-random').addEventListener('change', (e) => { filterState.random = e.target.checked; saveFilters(); });
$('#hint-decade').checked = filterState.hint;
$('#hint-decade').addEventListener('change', (e) => { filterState.hint = e.target.checked; saveFilters(); });
$('#hint-letter').checked = filterState.letterHint;
$('#hint-letter').addEventListener('change', (e) => { filterState.letterHint = e.target.checked; saveFilters(); });
// tryb ekspert: które dane trzeba podać, by zatrzymać kartę
$('#expert').checked = filterState.expert;
$('#expert').addEventListener('change', (e) => { filterState.expert = e.target.checked; saveFilters(); updateModeOptions(); });
for (const [id, key] of [['#exp-title', 'expTitle'], ['#exp-artist', 'expArtist'], ['#exp-year', 'expYear']]) {
  $(id).checked = filterState[key];
  $(id).addEventListener('change', (e) => {
    filterState[key] = e.target.checked;
    // bez żadnej zaznaczonej opcji tryb ekspert nic nie zmienia – wyłączamy go
    if (!filterState.expTitle && !filterState.expArtist && !filterState.expYear) filterState.expert = false;
    $('#expert').checked = filterState.expert;
    saveFilters(); updateModeOptions();
  });
}
// limit czasu (tryb „Na czas”), dekady pojedynku, karty specjalne
$$('input[name=time-limit]').forEach((r) => {
  r.checked = Number(r.value) === (filterState.timeLimit || 120);
  r.addEventListener('change', () => { filterState.timeLimit = Number(r.value); saveFilters(); updateModeOptions(); });
});
for (const [id, key] of [['#sp-double', 'double'], ['#sp-steal', 'steal'], ['#sp-swap', 'swap'], ['#sp-shield', 'shield'], ['#sp-fog', 'fog'], ['#sp-golden', 'golden'], ['#sp-magnet', 'magnet']]) {
  $(id).checked = !!(filterState.specials || []).includes(key);
  $(id).addEventListener('change', (e) => {
    const set = new Set(filterState.specials || []);
    if (e.target.checked) set.add(key); else set.delete(key);
    filterState.specials = [...set];
    saveFilters(); updateModeOptions();
  });
}
function renderDuelPick() {
  const decades = [...new Set(songPool('decade').map(decadeOf))].sort((a, b) => a - b);
  for (const [id, key] of [['#duel-a', 'duelA'], ['#duel-b', 'duelB']]) {
    const sel = $(id);
    sel.replaceChildren(el('option', { value: '' }, T('losowo')),
      ...decades.map((d) => el('option', { value: String(d), selected: String(filterState[key] || '') === String(d) }, decadeLabelLong(d))));
    sel.onchange = () => { filterState[key] = sel.value ? Number(sel.value) : null; saveFilters(); };
  }
}
const decadeLabelLong = (d) => (d === OLDEST_DECADE ? T('do 1969')
  : (d >= 2000 ? T('lata {0}.', d) : T('lata {0}.', String(d % 100))) + ` (${d}–${d + 9})`);
const expertParts = () => (filterState.expert ? [
  filterState.expTitle && 'title', filterState.expArtist && 'artist', filterState.expYear && 'year'].filter(Boolean) : []);
const PART_NAMES = { title: T('tytuł'), artist: T('wykonawcę'), year: T('dokładny rok') };

/* --- zestawy tematyczne: gotowe i zapisane przez gracza ustawienia filtrów --- */
const allValues = (f) => [...new Set(window.SONGS.flatMap(FILTERS[f].values))].map(String);
const only = (f, keep) => allValues(f).filter((v) => !keep.includes(v));
const PRESETS = [
  { id: 'all', name: T('Wszystkie piosenki'), desc: T('Bez zawężania – wszystkie piosenki z bazy.'),
    set: () => ({ pool: 'ALL', tag: null, decade: [], genre: [], country: [] }) },
  { id: 'trojka', name: T('📻 Przeboje Trójki'), desc: T('Piosenki, które były na 1. miejscu Listy Przebojów Programu Trzeciego (wg polskiej Wikipedii) lub są w plebiscytach „Polski Top Wszech Czasów” Trójki.'),
    set: () => ({ pool: 'ALL', tag: 'trojka', decade: [], genre: [], country: [] }) },
  { id: 'opole', name: T('🎙 Opole'), desc: T('Piosenki wykonywane na Krajowym Festiwalu Piosenki Polskiej w Opolu (wg artykułów o kolejnych festiwalach w polskiej Wikipedii).'),
    set: () => ({ pool: 'PL', tag: 'opole', decade: [], genre: [], country: [] }) },
  { id: 'eurowizja', name: T('🌍 Eurowizja'), desc: T('Piosenki z Konkursu Piosenki Eurowizji i Eurowizji Junior – zwycięzcy, wszystkie polskie występy i najbardziej znane przeboje.'),
    set: () => ({ pool: 'ALL', tag: 'eurowizja', decade: [], genre: [], country: [] }) },
  { id: 'memy', name: T('😂 Memy'), desc: T('Piosenki znane z internetowych memów, polskich i zagranicznych – przy karcie ciekawostka, z jakiego memu pochodzą.'),
    set: () => ({ pool: 'ALL', tag: 'memy', decade: [], genre: [], country: [] }) },
  { id: 'film', name: T('🎬 Muzyka filmowa'), desc: T('Piosenki i motywy z filmów (gatunek „muzyka filmowa”).'),
    set: () => ({ pool: 'ALL', tag: null, decade: [], genre: only('genre', ['muzyka filmowa']), country: [] }) },
];
const currentSettings = () => ({
  pool: poolValue(), tag: filterState.tag || null,
  decade: [...filterState.decade].sort(), genre: [...filterState.genre].sort(), country: [...filterState.country].sort(),
});
const sameSettings = (a, b) => ['pool', 'tag', 'decade', 'genre', 'country']
  .every((k) => JSON.stringify(Array.isArray(a[k]) ? [...a[k]].sort() : a[k] ?? null)
    === JSON.stringify(Array.isArray(b[k]) ? [...b[k]].sort() : b[k] ?? null));
function applyPreset(set) {
  $$('input[name=pool]').forEach((r) => { r.checked = r.value === set.pool; });
  Object.assign(filterState, { tag: set.tag || null, decade: [...set.decade], genre: [...set.genre], country: [...set.country] });
  if (set.level != null) {
    filterState.level = set.level;
    $$('input[name=level]').forEach((r) => { r.checked = Number(r.value) === set.level; });
  }
  filterState.pool = set.pool;
  saveFilters();
  updatePoolInfo();
}
// id aktywnego zestawu (do statystyk)
function renderPresetsActive() {
  const cur = currentSettings();
  const p = [...PRESETS.map((x) => ({ ...x, set: x.set() })), ...store.get('presets', []).map((x) => ({ ...x, id: 'wlasny' }))]
    .find((x) => sameSettings(x.set, cur));
  return p ? p.id : null;
}
function renderPresets() {
  const cur = currentSettings();
  const own = store.get('presets', []);
  const chips = [...PRESETS.map((p) => ({ ...p, set: p.set() })), ...own.map((p) => ({ ...p, own: true }))];
  const active = chips.find((p) => sameSettings(p.set, cur));
  $('#presets').replaceChildren(...chips.map((p) => el('span', { class: 'preset' },
    el('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(p === active), title: p.desc || '',
      onclick: () => applyPreset(p.set),
    }, p.name),
    p.own ? el('button', {
      type: 'button', class: 'link preset-del', title: T('Usuń zestaw „{0}”', p.name), 'aria-label': T('Usuń zestaw {0}', p.name),
      onclick: () => {
        if (!confirm(T('Usunąć zestaw „{0}”?', p.name))) return;
        store.set('presets', store.get('presets', []).filter((x) => x.id !== p.id));
        if (p.set.tag && p.set.tag.startsWith('list:')) { const l = store.get('playlists', {}); delete l[p.set.tag]; store.set('playlists', l); }
        renderPresets();
      },
    }, '✕') : null)));
  $('#preset-desc').textContent = active ? (active.desc || T('Twój zapisany zestaw.')) : T('Własne ustawienia (zmienione filtry).');
}
$('#btn-save-preset').addEventListener('click', () => {
  const name = (prompt(T('Nazwa zestawu:'), '') || '').trim().slice(0, 30);
  if (!name) return;
  const own = store.get('presets', []).filter((p) => p.name !== name);
  own.push({ id: 'u' + Date.now(), name, desc: T('Twój zapisany zestaw.'), set: currentSettings() });
  store.set('presets', own);
  renderPresets();
});
// ostatnio wybrana pula (polskie/zagraniczne/mieszane) – przywracana przy kolejnym otwarciu
if (filterState.pool) $$('input[name=pool]').forEach((r) => { r.checked = r.value === filterState.pool; });
$$('input[name=pool]').forEach((r) => r.addEventListener('change', () => { filterState.pool = poolValue(); saveFilters(); }));

function updatePoolInfo() {
  renderFilters();
  renderPresets();
  const pool = songPool();
  const active = Object.keys(FILTERS).filter((f) => filterState[f].length).length;
  $('#filters summary').textContent = T('Filtry: dekady, gatunki, kraje{0}', active ? ` (aktywne: ${active})` : '');
  $('#difficulty-desc').textContent = (LEVELS[filterState.level] || LEVELS[1]).desc;
  updateModeOptions();
  $('#share-box').classList.toggle('hidden', poolValue() !== 'ALL');
  $('#pl-share-label').textContent = T('{0}% polskich · {1}% zagranicznych', filterState.plShare, 100 - filterState.plShare);
  if (!pool.length) {
    $('#pool-info').textContent = T('Żadna piosenka nie pasuje do wybranych filtrów i zestawu.');
    $('#btn-start').disabled = true;
    return;
  }
  $('#btn-start').disabled = false;
  const years = pool.map((s) => s.y);
  const decades = new Set(pool.map(decadeOf)).size;
  const artists = new Set(pool.map((s) => artistKeys(s)[0])).size;
  const pl = pool.filter((s) => s.c === 'PL').length;
  const preset = filterState.tag && PRESETS.find((p) => p.id === filterState.tag);
  $('#pool-info').textContent = T('{0}{1} piosenek (polskich: {2}, zagranicznych: {3}; {4} wykonawców) z lat {5}–{6}, dekad: {7}. Każdy wykonawca pojawi się w grze najwyżej raz.', preset ? T('Zestaw „{0}”: ', preset.name.replace(/^\S+\s/, '')) : '', pool.length, pl, pool.length - pl, artists, Math.min(...years), Math.max(...years), decades);
}

$('#btn-start').addEventListener('click', () => { primeAudio(); startGame(); });
// jeden gracz: „Zagraj ponownie” wraca do ustawień tego trybu, „Zmień tryb” – do listy trybów
$('#btn-again').addEventListener('click', () => openSetup(state.baseMode || state.mode));
$('#btn-home').addEventListener('click', () => showModes());
// multiplayer: od razu kolejna gra w tym samym trybie i z tymi samymi ustawieniami (z nowymi graczami z lobby)
$('#btn-end-same').addEventListener('click', () => {
  state.mode = state.baseMode || state.mode;
  addLobbyToSetup();
  startGame();
});
$('#btn-end-other').addEventListener('click', () => showModes());
$('#btn-end-menu').addEventListener('click', () => {
  if (!confirm(T('Wyjść do menu głównego? Telefony graczy zostaną rozłączone.'))) return;
  closeLobby();
  showScreen('home');
});
// gracze, którzy dołączyli do lobby w trakcie gry, wchodzą do następnej
function addLobbyToSetup() {
  if (playCtx !== 'multi' || MODES[state.mode].teams) return;
  const rows = readSetupRows();
  for (const p of lobby.players) {
    if (rows.length < maxPlayersFor(state.mode) && !rows.some((r) => sameName(r.name, p.name))) rows.push({ name: p.name, members: '', key: undefined });
  }
  renderSetupPlayers(rows);
}
