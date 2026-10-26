'use strict';
// Songster – osiągnięcia (liczone ze statystyk na tym urządzeniu) i przenoszenie postępów na inne urządzenie (plik).
// Pliki js/*.js to zwykłe skrypty ładowane po kolei (index.html) – współdzielą zmienne globalne.

/* ---------- osiągnięcia ---------- */
// najdłuższa seria dobrych odpowiedzi z rzędu
function bestStreak(answers) {
  let best = 0;
  let cur = 0;
  for (const a of answers) { cur = a.ok ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}
const decadesOk = (answers) => new Set(answers.filter((a) => a.ok).map((a) => Math.max(OLDEST_DECADE, Math.floor(a.y / 10) * 10))).size;
const genresOk = (answers) => new Set(answers.filter((a) => a.ok).flatMap((a) => a.g || [])).size;
const bestIn = (games, mode) => Math.max(0, ...games.filter((g) => g.m === mode).map((g) => g.sc || 0));
const ALL_DECADES = 2020 / 10 - OLDEST_DECADE / 10 + 1;

// każde osiągnięcie: ikona, nazwa, opis i postęp [ile, cel] wyliczany ze statystyk
const ACHIEVEMENTS = [
  { id: 'first-win', icon: '🏆', name: () => T('Pierwsza wygrana'), desc: () => T('Wygraj dowolną grę.'), goal: 1, val: (st) => st.g.filter((g) => g.w).length },
  { id: 'streak10', icon: '🔥', name: () => T('10 z rzędu'), desc: () => T('10 dobrych odpowiedzi z rzędu.'), goal: 10, val: (st) => bestStreak(st.a) },
  { id: 'streak25', icon: '☄️', name: () => T('25 z rzędu'), desc: () => T('25 dobrych odpowiedzi z rzędu.'), goal: 25, val: (st) => bestStreak(st.a) },
  { id: 'decades', icon: '🗓️', name: () => T('Wszystkie dekady'), desc: () => T('Dobra odpowiedź w każdej dekadzie – od lat 60. do 20.'), goal: ALL_DECADES, val: (st) => decadesOk(st.a) },
  { id: 'genres', icon: '🎸', name: () => T('Wszystkożerca'), desc: () => T('Dobre odpowiedzi w 10 różnych gatunkach.'), goal: 10, val: (st) => genresOk(st.a) },
  { id: 'answers500', icon: '🎧', name: () => T('Meloman'), desc: () => T('500 odpowiedzi.'), goal: 500, val: (st) => st.a.length },
  { id: 'games10', icon: '🎲', name: () => T('Stały bywalec'), desc: () => T('10 rozegranych gier.'), goal: 10, val: (st) => st.g.length },
  { id: 'games100', icon: '💯', name: () => T('Weteran'), desc: () => T('100 rozegranych gier.'), goal: 100, val: (st) => st.g.length },
  { id: 'modes10', icon: '🧭', name: () => T('Odkrywca'), desc: () => T('Zagraj w 10 różnych trybów.'), goal: 10, val: (st) => new Set(st.g.map((g) => g.m)).size },
  { id: 'timed10', icon: '⏳', name: () => T('Szybkie palce'), desc: () => T('Ułóż 10 kart w trybie „Na czas”.'), goal: 10, val: (st) => bestIn(st.g, 'timed') },
  { id: 'hilo10', icon: '↕️', name: () => T('Wyczucie czasu'), desc: () => T('Seria 10 w „Starsza czy nowsza?”.'), goal: 10, val: (st) => bestIn(st.g, 'hilo') },
  { id: 'climb', icon: '🏔️', name: () => T('Na szczycie'), desc: () => T('Dotrzyj do współczesności w „Dekadowej wspinaczce”.'), goal: 1, val: (st) => (st.g.some((g) => g.m === 'climb' && g.w) ? 1 : 0) },
  { id: 'lyrics', icon: '💰', name: () => T('Główna nagroda'), desc: () => T('Wygraj 100 000 zł w „Tak to leciało!”.'), goal: 1, val: (st) => (bestIn(st.g, 'lyrics') >= 100000 ? 1 : 0) },
  { id: 'daily7', icon: '📆', name: () => T('Codziennie'), desc: () => T('Zagraj w wyzwanie dnia 7 różnych dni.'), goal: 7, val: (st) => new Set(st.g.filter((g) => g.m === 'daily').map((g) => g.d)).size },
];

function achievementsState() {
  const st = store.get('stats', { a: [], g: [] });
  const got = store.get('achievements', {});
  return ACHIEVEMENTS.map((a) => {
    const v = Math.min(a.goal, a.val(st));
    return { ...a, v, done: !!got[a.id] || v >= a.goal, date: got[a.id] || null };
  });
}
// po każdej odpowiedzi i grze: nowe osiągnięcia zapisujemy z datą i pokazujemy na chwilę
function checkAchievements() {
  const got = store.get('achievements', {});
  const fresh = achievementsState().filter((a) => a.v >= a.goal && !got[a.id]);
  if (!fresh.length) return [];
  const day = new Date().toISOString().slice(0, 10);
  for (const a of fresh) got[a.id] = day;
  store.set('achievements', got);
  // kilka naraz (np. po pierwszej grze) – jedno powiadomienie zamiast stosu zasłaniającego ekran
  if (fresh.length <= 2) for (const a of fresh) toast(`${a.icon} ${T('Nowe osiągnięcie: {0}', a.name())}`);
  else toast(`🏆 ${T('Nowe osiągnięcia ({0}): {1}', fresh.length, fresh.map((a) => a.name()).join(', '))}`, 6500);
  return fresh;
}
// powiadomienie na kilka sekund; naraz najwyżej dwa (starsze znika)
function toast(text, ms = 4500) {
  let box = $('#toasts');
  if (!box) { box = el('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  while (box.children.length >= 2) box.firstChild.remove();
  const t = el('div', { class: 'toast' }, text);
  box.append(t);
  setTimeout(() => t.remove(), ms);
}
function achievementsCard() {
  const list = achievementsState();
  const done = list.filter((a) => a.done).length;
  return el('section', { class: 'card' }, el('h2', {}, T('Osiągnięcia ({0} z {1})', done, list.length)),
    el('div', { class: 'achievements' }, list.map((a) => el('div', { class: 'ach' + (a.done ? ' done' : '') },
      el('span', { class: 'ach-icon', 'aria-hidden': 'true' }, a.icon),
      el('div', {}, el('b', {}, a.name()), el('div', { class: 'muted small' }, a.desc()),
        a.done ? el('div', { class: 'small ach-date' }, a.date ? T('zdobyte {0}', a.date) : T('zdobyte'))
          : el('div', { class: 'ach-bar', title: `${a.v} / ${a.goal}` }, el('span', { style: `width:${Math.round((a.v / a.goal) * 100)}%` })))))));
}

/* ---------- przenoszenie postępów ---------- */
// klucze zapisane w przeglądarce, które przenosimy (bez pamięci podręcznej i ustawień tego urządzenia)
const TRANSFER_KEYS = ['stats', 'recordLog', 'records', 'timedRecords', 'achievements', 'daily', 'players', 'teams', 'playlists', 'presets', 'filters',
  'partyGames', 'partyLen', 'partyScore', 'yearOverrides', 'countryOverrides', 'lyBadVideos', 'lyReports', 'lyRecentCats', 'buzzKeys', 'buzzKeyByName',
  'sounds', 'animations', 'autoplay', 'lang'];
function exportProgress() {
  const data = {};
  for (const k of TRANSFER_KEYS) { const v = store.get(k, undefined); if (v !== undefined) data[k] = v; }
  return { app: 'songster', v: 1, date: new Date().toISOString(), data };
}
function saveProgressFile() {
  const blob = new Blob([JSON.stringify(exportProgress())], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `songster-postepy-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
// wczytanie: statystyki i rekordy są łączone z tymi na tym urządzeniu, pozostałe ustawienia – zastępowane
function importProgress(obj) {
  if (!obj || obj.app !== 'songster' || !obj.data || typeof obj.data !== 'object') throw new Error('format');
  const d = obj.data;
  for (const k of Object.keys(d)) if (!TRANSFER_KEYS.includes(k)) delete d[k];
  if (d.stats) {
    const cur = store.get('stats', { a: [], g: [] });
    const key = (x) => JSON.stringify(x);
    const merge = (a, b, max) => { const seen = new Set(a.map(key)); return [...a, ...b.filter((x) => !seen.has(key(x)))].slice(-max); };
    // odpowiedzi i gry w kolejności dat
    const byDate = (x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0);
    d.stats = { a: merge(cur.a, d.stats.a || [], STATS_MAX).sort(byDate), g: merge(cur.g, d.stats.g || [], 1000).sort(byDate) };
  }
  if (d.records) { const cur = store.get('records', {}); for (const [k, v] of Object.entries(cur)) d.records[k] = Math.max(v, d.records[k] || 0); }
  if (d.achievements) d.achievements = { ...d.achievements, ...store.get('achievements', {}) };
  if (d.recordLog) d.recordLog = [...store.get('recordLog', []), ...d.recordLog].slice(-200);
  for (const [k, v] of Object.entries(d)) store.set(k, v);
  return Object.keys(d).length;
}
// komunikat po wczytaniu pliku (zostaje po odświeżeniu statystyk)
let progressMsg = '';
function transferCard() {
  const input = el('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', id: 'progress-file' });
  const msg = el('p', { class: 'muted small', id: 'progress-msg' }, progressMsg);
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      const n = importProgress(JSON.parse(await f.text()));
      progressMsg = T('Wczytano postępy ({0} rodzajów danych). Statystyki zostały połączone z tymi z tego urządzenia.', n);
      checkAchievements();
      renderStats();
    } catch (e) {
      progressMsg = T('To nie jest plik z postępami Songster.');
      msg.textContent = progressMsg;
    }
    input.value = '';
  });
  return el('section', { class: 'card' }, el('h2', {}, T('📲 Przenieś postępy na inne urządzenie')),
    el('p', { class: 'muted' }, T('Zapisz plik z postępami (statystyki, rekordy, osiągnięcia, własne playlisty i ustawienia), a potem wczytaj go na innym urządzeniu. Statystyki z obu urządzeń zostaną połączone.')),
    el('div', { class: 'actions' },
      el('button', { class: 'ghost', id: 'btn-progress-save', onclick: saveProgressFile }, T('💾 Zapisz plik z postępami')),
      el('button', { class: 'ghost', id: 'btn-progress-load', onclick: () => input.click() }, T('📂 Wczytaj plik z postępami'))),
    input, msg);
}
