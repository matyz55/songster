'use strict';

// aktualna wersja gry – ta sama co ostatni wpis w CHANGELOG.md (pokazywana na dole ekranu startowego)
const GAME_VERSION = '5.58.6';

/* ---------- narzędzia ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c != null) node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
};
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const clampInt = (v, min, max, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const store = {
  get(key, def) {
    try { const v = localStorage.getItem('songster.' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('songster.' + key, JSON.stringify(val)); } catch (e) { /* tryb prywatny */ }
  },
};
const { pickPreview, mainArtist, checkTitle, checkArtist, artistsOf, norm } = window.SongMatch;
translatePage();

const MAX_TOKENS = 5;
const SKIP_COST = 1;
const BUY_COST = 3;
const MAX_PLAYERS = 16;

/* ---------- efekty: dźwięki (Web Audio, bez plików) i animacje ---------- */
let sfxCtx = null;
function tone(freq, start, dur, { type = 'sine', vol = 0.18, slide = 0 } = {}) {
  const t0 = sfxCtx.currentTime + start;
  const osc = sfxCtx.createOscillator();
  const gain = sfxCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(sfxCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}
const SOUNDS = {
  good: () => { tone(523, 0, 0.12); tone(659, 0.09, 0.12); tone(784, 0.18, 0.22); },
  bad: () => { tone(220, 0, 0.35, { type: 'sawtooth', vol: 0.08, slide: 0.6 }); },
  place: () => { tone(880, 0, 0.06, { type: 'triangle', vol: 0.12 }); },
  win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, { type: 'triangle', vol: 0.15 })); },
  // Gorąca bomba: tykanie i wybuch
  tick: () => { tone(1500, 0, 0.03, { type: 'square', vol: 0.06 }); },
  boom: () => { tone(90, 0, 0.9, { type: 'sawtooth', vol: 0.25, slide: 0.3 }); tone(60, 0.05, 1.1, { type: 'square', vol: 0.15, slide: 0.5 }); },
};
function fx(kind) {
  if (!store.get('sounds', true) || !SOUNDS[kind]) return;
  try {
    sfxCtx = sfxCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (sfxCtx.state === 'suspended') sfxCtx.resume();
    SOUNDS[kind]();
  } catch (e) { /* brak Web Audio – gramy bez efektów */ }
}
const animationsOn = () => store.get('animations', true)
  && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function applyAnimationSetting() { document.body.classList.toggle('no-anim', !animationsOn()); }
applyAnimationSetting();
// konfetti z emoji przy wygranej i nowym rekordzie
function celebrate() {
  if (!animationsOn()) return;
  const box = el('div', { class: 'confetti', 'aria-hidden': 'true' });
  const emoji = ['🎉', '🎵', '⭐', '🎶', '✨', '🏆'];
  for (let i = 0; i < 28; i++) {
    box.append(el('span', {
      style: `left:${Math.random() * 100}%;animation-delay:${(Math.random() * 0.8).toFixed(2)}s;font-size:${18 + Math.random() * 18}px`,
    }, emoji[i % emoji.length]));
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3500);
}

/* ---------- piosenki, flagi, poprawki dat ---------- */
const songKey = (s) => s.a + '|' + s.t;
// ta sama piosenka zapisana w bazie dwa razy (np. z różnych źródeł, inną wielkością liter) – zostaje jeden wpis z uzupełnionymi
// polami, żeby w jednej grze nie trafiła się dwa razy
(function dedupeSongs() {
  const seen = new Map();
  window.SONGS = window.SONGS.filter((s) => {
    const k = songKey(s).toLowerCase();
    const first = seen.get(k);
    if (!first) { seen.set(k, s); return true; }
    for (const [f, v] of Object.entries(s)) {
      if (first[f] == null || first[f] === '' || (f === 'p' && v > first[f])) first[f] = v;
      else if (Array.isArray(first[f]) && Array.isArray(v)) first[f] = [...new Set([...first[f], ...v])];
    }
    return false;
  });
}());

// piosenki zagrane w tej sesji (do zamknięcia karty) – kolejne rozgrywki losują najpierw spośród pozostałych
const played = (() => {
  try { return new Set(JSON.parse(sessionStorage.getItem('songster.played') || '[]')); } catch (e) { return new Set(); }
})();
function markPlayed(song) {
  played.add(songKey(song));
  try { sessionStorage.setItem('songster.played', JSON.stringify([...played])); } catch (e) { /* tryb prywatny */ }
}
// pula bez zagranych piosenek; gdy zostało ich za mało, zaczynamy od nowa (tylko dla tej puli)
function freshPool(pool, needed) {
  const fresh = pool.filter((s) => !played.has(songKey(s)));
  if (fresh.length >= Math.max(needed * 4, 150)) return fresh;
  for (const s of pool) played.delete(songKey(s));
  try { sessionStorage.setItem('songster.played', JSON.stringify([...played])); } catch (e) { /* tryb prywatny */ }
  return pool;
}
// wszyscy wykonawcy (a – pierwszych dwóch, x – kolejni)
const artistLine = (s) => [s.a, ...(s.x || [])].join(' & ');
const ORIGINAL_YEAR = new Map(window.SONGS.map((s) => [songKey(s), s.y]));
const ORIGINAL_COUNTRY = new Map(window.SONGS.map((s) => [songKey(s), { cc: s.cc || '', c: s.c }]));

// poprawki użytkownika (rok i kraj) zapisane w przeglądarce
function applyOverrides() {
  const years = store.get('yearOverrides', {});
  const countries = store.get('countryOverrides', {});
  for (const s of window.SONGS) {
    const key = songKey(s);
    s.y = years[key] ?? ORIGINAL_YEAR.get(key);
    const orig = ORIGINAL_COUNTRY.get(key);
    if (countries[key] != null) {
      s.cc = countries[key];
      // polska/zagraniczna wynika z kraju; „nieznany” zostawia pierwotną kategorię
      s.c = s.cc === 'PL' ? 'PL' : (s.cc ? 'INT' : orig.c);
    } else {
      s.cc = orig.cc;
      s.c = orig.c;
    }
  }
}
applyOverrides();

// Flagi jako obrazki SVG (pakiet flag-icons, katalog flags/) – emoji flag nie działają w Windows
const FLAG_SET = new Set(window.FLAG_CODES || []);
const hasFlag = (cc) => FLAG_SET.has((cc || '').toLowerCase());
const countryName = (() => {
  try {
    const dn = new Intl.DisplayNames([LANG], { type: 'region' });
    // YU to historyczny kod Jugosławii – przeglądarki pokazują go jako „Serbia”
    const special = { YU: T('Jugosławia') };
    return (song) => (song.cc ? special[song.cc.toUpperCase()] || dn.of(song.cc.toUpperCase()) : 'kraj nieznany');
  } catch (e) {
    return (song) => song.cc || 'kraj nieznany';
  }
})();
function flagEl(song) {
  const name = countryName(song);
  if (!hasFlag(song.cc)) return el('span', { class: 'flag', title: name, 'aria-label': name }, '🌍');
  return el('img', {
    class: 'flag-img', src: `flags/${song.cc.toLowerCase()}.svg`, alt: name, title: name, width: '20', height: '15',
  });
}

/* ---------- linki do serwisów streamingowych ---------- */
function streamUrl(song, preview, platform) {
  const q = encodeURIComponent(`${mainArtist(song)} ${song.t}`);
  if (platform === 'spotify') {
    // identyfikatory Spotify są w osobnym pliku (songs-sp.js), doczytywanym w tle po starcie
    const sp = song.sp || (window.SONG_SP && window.SONG_SP[songKey(song)]);
    return sp ? `https://open.spotify.com/track/${sp}` : `https://open.spotify.com/search/${q}`;
  }
  if (platform === 'apple') {
    return preview && preview.link ? preview.link : `https://music.apple.com/search?term=${q}`;
  }
  return `https://www.youtube.com/results?search_query=${q}`;
}
// identyfikatory utworów w Spotify – w tle, gdy przeglądarka nie ma nic pilniejszego (pierwsze ładowanie jest lżejsze)
(window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => {
  const sc = document.createElement('script');
  sc.src = 'songs-sp.js';
  document.head.append(sc);
  // ciekawostki z Wikidata (tools/facts.mjs) – potrzebne dopiero po odkryciu karty
  loadFacts();
});
// ciekawostki (facts.js) – potrzebne też od razu na starcie trybu „Kto za tym stoi?”
let factsPromise = null;
function loadFacts() {
  if (!factsPromise) {
    factsPromise = new Promise((resolve) => {
      if (window.SONG_FACTS) { resolve(); return; }
      const fc = document.createElement('script');
      fc.src = 'facts.js';
      fc.onload = () => resolve();
      fc.onerror = () => { factsPromise = null; resolve(); };
      document.head.append(fc);
    });
  }
  return factsPromise;
}
const PLATFORM_NAMES = { youtube: 'YouTube', spotify: 'Spotify', apple: 'Apple Music' };
// Android: kliknięcie ikonki otwiera od razu aplikację linkiem „intent://” – w tej samej karcie i bezpośrednio
// po kliknięciu (w nowej karcie przeglądarki, np. Brave, nie przekazują go do aplikacji). Bez adresu zastępczego:
// gdy aplikacji nie ma, Android proponuje Sklep Play, a gra zostaje otwarta. iPhone i komputer: zwykłe linki https.
const APP_PACKAGES = { youtube: 'com.google.android.youtube', spotify: 'com.spotify.music', apple: 'com.apple.android.music' };
// Brave na Androidzie ma błąd: nie przekazuje linków „intent://” do aplikacji (ERR_UNKNOWN_URL_SCHEME,
// github.com/brave/brave-browser/issues/46614) – tam zostają zwykłe linki https
const IS_BRAVE = !!navigator.brave;
// telefon / tablet bez myszy i klawiatury – w „Kto pierwszy?” nie pokazujemy klawiszy
const TOUCH_ONLY = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
const IS_ANDROID = /Android/i.test(navigator.userAgent) && !IS_BRAVE;
function intentUrl(url, platform) {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=${APP_PACKAGES[platform]};end`;
}
// proste ikonki serwisów (SVG w kodzie – bez zewnętrznych plików)
const PLATFORM_ICONS = {
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#FF0000"/><path d="M10 8.6v6.8l5.8-3.4z" fill="#fff"/></svg>',
  spotify: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1ED760"/><path d="M6.6 9.3c3.8-1.1 8-.8 11.1 1M7.2 12.5c3.1-.9 6.5-.6 9.2.9M7.8 15.5c2.4-.6 4.9-.4 7 .7" stroke="#000" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>',
  apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="5.5" fill="#FA2D48"/><path d="M15.6 5.4v9.4a2.3 2.3 0 1 1-1.4-2.1V8.3l-5 1.1v6.7a2.3 2.3 0 1 1-1.4-2.1V7.2z" fill="#fff"/></svg>',
};
// trzy ikonki: piosenka w YouTube, Spotify albo Apple Music
function listenLinks(song, preview, withLabel = true) {
  const box = el('span', { class: 'listen' }, withLabel ? el('span', { class: 'listen-label' }, T('Posłuchaj całości:')) : null);
  for (const platform of ['youtube', 'spotify', 'apple']) {
    const url = streamUrl(song, preview, platform);
    const a = el('a', {
      href: url, target: '_blank', rel: 'noopener', class: 'listen-icon',
      title: T('Posłuchaj w: {0}', PLATFORM_NAMES[platform]), 'aria-label': T('Posłuchaj w: {0}', PLATFORM_NAMES[platform]),
    });
    a.innerHTML = PLATFORM_ICONS[platform];
    if (IS_ANDROID) a.addEventListener('click', (e) => { e.preventDefault(); window.location.href = intentUrl(url, platform); });
    box.append(a);
  }
  return box;
}

/* ---------- talia ---------- */
// Zasady losowania:
// 1. Każdy wykonawca może pojawić się w jednej grze tylko raz (także jako gość w duecie).
// 2. Przy mieszanej puli pilnujemy wybranego udziału piosenek polskich i zagranicznych.
// 3. Dekady: losujemy tę, z której w tej grze padło najmniej piosenek – żadna nie dominuje.
// 4. Poziom trudny (oś czasu): mniej więcej co druga piosenka jest wydana blisko lat kart gracza,
//    ale tylko z dekad, które nie są nadreprezentowane – gra nie utknie w jednym okresie.
const artistKeys = (s) => SongMatch.artistsOf(s).map((a) => SongMatch.norm(a.replace(/^the /i, ''))).filter(Boolean);
// piosenek sprzed 1960 r. jest bardzo mało – lata 30., 40. i 50. tworzą jedną kategorię z latami 60.
const OLDEST_DECADE = 1960;
const decadeOf = (s) => Math.max(OLDEST_DECADE, Math.floor(s.y / 10) * 10);
const decadeLabel = (d) => (d === OLDEST_DECADE ? 'do 1969' : `${d}s`);
const decadeRange = (d) => (d === OLDEST_DECADE ? T('do 1969 r.') : T('lata {0}. ({1}–{2})', d % 100 || '00', d, d + 9));

class Deck {
  constructor(songs, { level = 1, plShare = 0.5 } = {}) {
    this.level = level;
    this.plShare = plShare;
    this.lists = { PL: new Map(), INT: new Map() };
    for (const s of shuffle(songs)) {
      const m = this.lists[s.c === 'PL' ? 'PL' : 'INT'];
      if (!m.has(decadeOf(s))) m.set(decadeOf(s), []);
      m.get(decadeOf(s)).push(s);
    }
    this.used = new Map();
    this.drawn = { PL: 0, INT: 0 };
    this.usedArtists = new Set();
  }
  * allLists() {
    for (const m of Object.values(this.lists)) yield* m.values();
  }
  get size() {
    let n = 0;
    for (const l of this.allLists()) n += l.length;
    return n;
  }
  isFresh(s) {
    return artistKeys(s).every((k) => !this.usedArtists.has(k));
  }
  listOf(s) {
    return this.lists[s.c === 'PL' ? 'PL' : 'INT'].get(decadeOf(s));
  }
  take(song) {
    const list = this.listOf(song);
    list.splice(list.indexOf(song), 1);
    this.used.set(decadeOf(song), (this.used.get(decadeOf(song)) || 0) + 1);
    this.drawn[song.c === 'PL' ? 'PL' : 'INT'] += 1;
    for (const k of artistKeys(song)) this.usedArtists.add(k);
    return song;
  }
  // piosenka nie zagrała (brak fragmentu lub błąd sieci) – zwalniamy wykonawcę i licznik
  release(song, putBack) {
    for (const k of artistKeys(song)) this.usedArtists.delete(k);
    this.used.set(decadeOf(song), this.used.get(decadeOf(song)) - 1);
    this.drawn[song.c === 'PL' ? 'PL' : 'INT'] -= 1;
    if (putBack) this.listOf(song).unshift(song);
  }
  // kategoria, której udział jest najbardziej poniżej docelowego
  pickCategory() {
    const has = (c) => [...this.lists[c].values()].some((l) => l.length);
    if (!has('PL')) return has('INT') ? 'INT' : null;
    if (!has('INT')) return 'PL';
    const total = this.drawn.PL + this.drawn.INT;
    if (!total) return Math.random() < this.plShare ? 'PL' : 'INT';
    const deficitPL = this.plShare - this.drawn.PL / total;
    if (Math.abs(deficitPL) < 1e-9) return Math.random() < this.plShare ? 'PL' : 'INT';
    return deficitPL > 0 ? 'PL' : 'INT';
  }
  draw(nearYears) {
    for (const l of this.allLists()) {
      for (let i = l.length - 1; i >= 0; i--) if (!this.isFresh(l[i])) l.splice(i, 1);
    }
    const cat = this.pickCategory();
    if (!cat) return null;
    const decades = [...this.lists[cat].entries()].filter(([, l]) => l.length);
    const least = Math.min(...decades.map(([d]) => this.used.get(d) || 0));
    if (this.level === 2 && nearYears && nearYears.length && Math.random() < 0.5) {
      // tylko dekady co najwyżej o 1 piosenkę „ponad normę”
      const allowed = decades.filter(([d]) => (this.used.get(d) || 0) <= least + 1).flatMap(([, l]) => l.slice(-60));
      const pick = this.closeTo(allowed, nearYears);
      if (pick) return this.take(pick);
    }
    const fair = decades.filter(([d]) => (this.used.get(d) || 0) === least);
    const [, list] = fair[Math.floor(Math.random() * fair.length)];
    return this.take(list[list.length - 1]);
  }
  // piosenka wydana 1–3 lata od którejś karty na osi (ten sam rok jest za łatwy)
  closeTo(pool, nearYears) {
    const close = pool.filter((s) => {
      const dist = Math.min(...nearYears.map((y) => Math.abs(y - s.y)));
      return dist >= 1 && dist <= 3;
    });
    return close.length ? close[Math.floor(Math.random() * close.length)] : null;
  }
}

/* ---------- podgląd audio z iTunes Search API ---------- */
// Fragmenty z iTunes Search API. Apple podaje limit ok. 20 zapytań na minutę, dlatego:
// • kolejka zapytań pilnuje limitu (najwyżej 18 na minutę) i po odmowie serwera robi dłuższą przerwę,
// • znalezione adresy fragmentów (sam adres, nie dźwięk) zapamiętujemy w przeglądarce na 30 dni,
// • gdy kolejka jest pusta, w tle wyszukujemy kilka piosenek z puli gry na zapas.
const previewCache = new Map();
const PREVIEW_STORE = 'songster.previews';
const PREVIEW_TTL = 30 * 864e5;
const NO_PREVIEW_TTL = 3 * 864e5;
const savedPreviews = (() => {
  try { return JSON.parse(localStorage.getItem(PREVIEW_STORE) || '{}'); } catch (e) { return {}; }
})();
let savePreviewsTimer = null;
function rememberPreview(key, result) {
  savedPreviews[key] = { r: result, d: Date.now() };
  clearTimeout(savePreviewsTimer);
  savePreviewsTimer = setTimeout(() => {
    // najwyżej 3000 wpisów – najstarsze wypadają
    const keys = Object.keys(savedPreviews);
    if (keys.length > 3000) keys.sort((x, y) => savedPreviews[x].d - savedPreviews[y].d).slice(0, keys.length - 3000).forEach((k) => delete savedPreviews[k]);
    try { localStorage.setItem(PREVIEW_STORE, JSON.stringify(savedPreviews)); } catch (e) { /* brak miejsca – bez zapisu */ }
  }, 500);
}
function forgetPreview(song) {
  const key = songKey(song);
  previewCache.delete(key);
  delete savedPreviews[key];
}
async function findPreview(song, { quiet = false } = {}) {
  const key = songKey(song);
  if (previewCache.has(key)) return previewCache.get(key);
  const saved = savedPreviews[key];
  if (saved && Date.now() - saved.d < (saved.r ? PREVIEW_TTL : NO_PREVIEW_TTL)) {
    previewCache.set(key, saved.r);
    return saved.r;
  }
  const term = song.q || `${mainArtist(song)} ${song.t}`;
  let result = null;
  let networkError = false;
  for (const country of ['PL', 'US']) {
    const url = 'https://itunes.apple.com/search?' + new URLSearchParams({
      term, entity: 'song', limit: '25', country,
    });
    try {
      const res = await fetchWithRetry(url, quiet);
      if (!res) { networkError = true; continue; }
      const data = await res.json();
      const hit = pickPreview(data.results, song);
      if (hit) {
        result = {
          url: hit.previewUrl,
          art: (hit.artworkUrl100 || '').replace('100x100', '300x300'),
          link: hit.trackViewUrl,
          // oznaczenie wydawcy w Apple Music: tekst z przekleństwami
          ex: hit.trackExplicitness === 'explicit' ? 1 : 0,
        };
        break;
      }
    } catch (e) {
      networkError = true;
      console.warn('iTunes', e);
    }
  }
  // wynik „brak fragmentu” zapamiętujemy tylko, gdy API faktycznie odpowiedziało
  if (result || !networkError) { previewCache.set(key, result); rememberPreview(key, result); }
  return result;
}

// kolejka zapytań do iTunes: najwyżej 18 na minutę; po odmowie (403/429) przerwa
const itunesQueue = { times: [], blockedUntil: 0, chain: Promise.resolve(), waiting: 0 };
function itunesTurn(quiet) {
  itunesQueue.waiting += 1;
  const run = async () => {
    for (;;) {
      const now = Date.now();
      itunesQueue.times = itunesQueue.times.filter((t) => now - t < 60000);
      const full = itunesQueue.times.length >= 18 ? 60000 - (now - itunesQueue.times[0]) + 100 : 0;
      const wait = Math.max(itunesQueue.blockedUntil - now, full, 0);
      if (!wait) { itunesQueue.times.push(now); itunesQueue.waiting -= 1; return; }
      if (!quiet && wait > 1500) $('#mystery-status').textContent = T('Serwer z fragmentami ma limit zapytań – czekam {0} s…', Math.ceil(wait / 1000));
      await new Promise((r) => setTimeout(r, Math.min(wait, 2000)));
    }
  };
  const p = itunesQueue.chain.then(run);
  itunesQueue.chain = p.catch(() => {});
  return p;
}
async function fetchWithRetry(url, quiet = false, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    await itunesTurn(quiet);
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      // serwer odmawia (zbyt wiele zapytań) – dłuższa przerwa dla całej kolejki
      if (res.status === 403 || res.status === 429) itunesQueue.blockedUntil = Date.now() + 20000 * (i + 1);
    } catch (e) {
      console.warn('fetch', e);
      itunesQueue.blockedUntil = Math.max(itunesQueue.blockedUntil, Date.now() + 3000 * (i + 1));
    }
    if (i < attempts - 1 && !quiet) $('#mystery-status').textContent = T('Serwer z fragmentami jest zajęty, ponawiam…');
  }
  return null;
}
// wyszukiwanie na zapas: co kilka sekund jedna piosenka z puli, tylko gdy nic innego nie czeka
// i zostaje zapas w limicie (żeby nie spowalniać wyszukiwania piosenek potrzebnych teraz)
let warmTimer = null;
function warmPreviews(pool) {
  clearInterval(warmTimer);
  const todo = shuffle(pool.filter((s) => !savedPreviews[songKey(s)])).slice(0, 40);
  warmTimer = setInterval(() => {
    if (!todo.length || $('#screen-game').classList.contains('hidden')) { if (!todo.length) clearInterval(warmTimer); return; }
    const recent = itunesQueue.times.filter((t) => Date.now() - t < 60000).length;
    if (itunesQueue.waiting || recent > 8 || Date.now() < itunesQueue.blockedUntil) return;
    findPreview(todo.pop(), { quiet: true }).catch(() => {});
  }, 6000);
}

/* ---------- stan gry ---------- */
const MAX_TEAMS = 16;
const MODES = {
  solo: { title: T('Oś czasu – 1 gracz'), minPlayers: 1, maxPlayers: 1 },
  multi: { title: T('Oś czasu – multiplayer'), minPlayers: 2, maxPlayers: MAX_PLAYERS },
  teams: { title: T('Oś czasu – drużyny'), minPlayers: 2, maxPlayers: MAX_TEAMS, teams: true },
  melody: { title: 'Jaka to melodia', minPlayers: 1, maxPlayers: MAX_PLAYERS },
  steps: { title: 'Melodia krok po kroku', minPlayers: 1, maxPlayers: MAX_PLAYERS },
  cover: { title: T('Okładka z mgły'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  words: { title: T('Pierwsze słowa'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  mirror: { title: T('Krzywe zwierciadło'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  timed: { title: 'Na czas', minPlayers: 1, maxPlayers: 1 },
  hilo: { title: T('Starsza czy nowsza?'), minPlayers: 1, maxPlayers: 1 },
  duel: { title: T('Pojedynek dekad'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  buzz: { title: 'Kto pierwszy?', minPlayers: 2, maxPlayers: MAX_PLAYERS },
  party: { title: T('Impreza – minigry'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  // tryby quizowe (modes.js)
  year: { title: T('Rok co do roku'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  artist: { title: T('Kto to śpiewa?'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  country: { title: T('Skąd jest wykonawca?'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  who: { title: T('Kto za tym stoi?'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  screen: { title: T('Z jakiego to ekranu?'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  chain: { title: T('Łańcuch skojarzeń'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  climb: { title: T('Dekadowa wspinaczka'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  royale: { title: T('Ostatni na placu boju'), minPlayers: 2, maxPlayers: MAX_PLAYERS },
  seconds: { title: T('Licytacja sekund'), minPlayers: 2, maxPlayers: MAX_PLAYERS },
  bomb: { title: T('Gorąca bomba'), minPlayers: 2, maxPlayers: MAX_PLAYERS },
  mashup: { title: T('Mikser'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  bid: { title: T('Licytacja'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  daily: { title: T('Wyzwanie dnia'), minPlayers: 1, maxPlayers: 1 },
  sort5: { title: T('Ułóż piątkę'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  bingo: { title: T('Bingo muzyczne'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  // współpraca: wszyscy razem przeciw grze – wspólna oś i wspólne pomyłki (zasady osi jednego gracza)
  coop: { title: T('Współpraca'), minPlayers: 2, maxPlayers: MAX_PLAYERS },
  // Tak to leciało!: dokończ wers piosenki z YouTube (lyrics.js)
  lyrics: { title: T('Tak to leciało!'), minPlayers: 1, maxPlayers: MAX_PLAYERS },
  relay: { title: T('Sztafeta karaoke'), minPlayers: 2, maxPlayers: MAX_PLAYERS },
  career: { title: T('Kariera'), minPlayers: 1, maxPlayers: 1 },
  tour: { title: T('Turniej'), minPlayers: 3, maxPlayers: MAX_PLAYERS },
  live: { title: T('Pojedynek na żywo'), minPlayers: 2, maxPlayers: 2 },
};
// jeden gracz albo multiplayer (lobby z listą graczy, telefonami i głosowaniem na tryb)
let playCtx = 'single';
const maxPlayersFor = (mode) => (playCtx === 'single' ? 1 : MODES[mode].maxPlayers);
const minPlayersFor = (mode) => (playCtx === 'single' ? 1 : MODES[mode].minPlayers);
// Impreza: krótkie minigry oparte na pozostałych trybach (mode – tryb dla danej liczby graczy, opts – krótsza wersja)
const PARTY_GAMES = {
  melody: { icon: '🎤', name: 'Jaka to melodia', mode: () => 'melody', opts: (n) => ({ rounds: n === 1 ? 3 : 1 }) },
  steps: { icon: '⏱️', name: 'Melodia krok po kroku', mode: () => 'steps', opts: (n) => ({ rounds: n === 1 ? 2 : 1 }) },
  cover: { icon: '🌫️', name: T('Okładka z mgły'), mode: () => 'cover', opts: (n) => ({ rounds: n === 1 ? 2 : 1 }) },
  words: { icon: '📝', name: T('Pierwsze słowa'), mode: () => 'words', opts: (n) => ({ rounds: n === 1 ? 2 : 1 }) },
  mirror: { icon: '🪞', name: T('Krzywe zwierciadło'), mode: () => 'mirror', opts: (n) => ({ rounds: n === 1 ? 2 : 1 }) },
  duel: { icon: '🥊', name: T('Pojedynek dekad'), mode: () => 'duel', opts: (n) => ({ rounds: n === 1 ? 5 : 2 }) },
  year: { icon: '📅', name: T('Rok co do roku'), mode: () => 'year', opts: (n) => ({ rounds: n === 1 ? 4 : 1 }) },
  artist: { icon: '🎙️', name: T('Kto to śpiewa?'), mode: () => 'artist', opts: (n) => ({ rounds: n === 1 ? 5 : 2 }) },
  country: { icon: '🌍', name: T('Skąd jest wykonawca?'), mode: () => 'country', opts: (n) => ({ rounds: n === 1 ? 5 : 2 }) },
  who: { icon: '🕵️', name: T('Kto za tym stoi?'), mode: () => 'who', opts: (n) => ({ rounds: n === 1 ? 5 : 2 }) },
  screen: { icon: '🎬', name: T('Z jakiego to ekranu?'), mode: () => 'screen', opts: (n) => ({ rounds: n === 1 ? 4 : 2 }) },
  chain: { icon: '🔗', name: T('Łańcuch skojarzeń'), mode: () => 'chain', opts: (n) => ({ rounds: n === 1 ? 4 : 2 }) },
  hilo: { icon: '↕️', name: T('Starsza czy nowsza?'), mode: () => 'hilo', opts: (n) => ({ rounds: n === 1 ? 0 : 2 }) },
  buzz: { icon: '🔔', name: 'Kto pierwszy?', min: 2, mode: () => 'buzz', opts: (n) => ({ rounds: Math.min(8, Math.max(4, n + 2)) }) },
  lyrics: { icon: '🎤', name: T('Tak to leciało!'), mode: () => 'lyrics', opts: (n) => ({ rounds: n === 1 ? 3 : 1 }) },
  relay: { icon: '🏃', name: T('Sztafeta karaoke'), min: 2, mode: () => 'relay', opts: () => ({ rounds: 1 }) },
  mashup: { icon: '🎛️', name: T('Mikser'), mode: () => 'mashup', opts: (n) => ({ rounds: n === 1 ? 3 : 1 }) },
  sort5: { icon: '🔢', name: T('Ułóż piątkę'), mode: () => 'sort5', opts: () => ({ rounds: 1 }) },
  seconds: { icon: '⏱', name: T('Licytacja sekund'), min: 2, mode: () => 'seconds', opts: () => ({ rounds: 1 }) },
  bomb: { icon: '💣', name: T('Gorąca bomba'), min: 2, mode: () => 'bomb', opts: () => ({}) },
  royale: { icon: '🏁', name: T('Ostatni na placu boju'), min: 2, mode: () => 'royale', opts: () => ({}) },
  live: { icon: '⚡', name: T('Pojedynek na żywo'), min: 2, max: 2, mode: () => 'live', opts: () => ({}) },
  // oś czasu: dla jednej osoby – minuta na czas, dla kilku – wyścig do 4 kart (przy wielu graczach trwałoby to za długo)
  timeline: { icon: '🎧', name: T('Oś czasu'), max: 8, mode: (n) => (n === 1 ? 'timed' : 'multi'), opts: () => ({ winTarget: 4, timeLimit: 60 }) },
};
const partyGamesFor = (n) => Object.keys(PARTY_GAMES).filter((k) => n >= (PARTY_GAMES[k].min || 1) && n <= (PARTY_GAMES[k].max || MAX_PLAYERS));
// klawisze graczy w „Kto pierwszy?” (oprócz przycisków na ekranie)
// domyślne klawisze „Kto pierwszy?” (kody fizycznych klawiszy – działają niezależnie od układu klawiatury);
// każdy gracz może w ustawieniach przypisać sobie własny
const BUZZ_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];
const KEY_NAMES = { Space: () => T('Spacja'), Enter: () => 'Enter', ArrowUp: () => '↑', ArrowDown: () => '↓', ArrowLeft: () => '←', ArrowRight: () => '→',
  ShiftLeft: () => T('lewy Shift'), ShiftRight: () => T('prawy Shift'), ControlLeft: () => T('lewy Ctrl'), ControlRight: () => T('prawy Ctrl'),
  AltLeft: () => T('lewy Alt'), AltRight: () => T('prawy Alt'), Backspace: () => '⌫', Tab: () => 'Tab' };
function keyLabel(code) {
  if (!code) return '?';
  if (KEY_NAMES[code]) return KEY_NAMES[code]();
  const m = code.match(/^(?:Key|Digit)(.+)$/);
  if (m) return m[1];
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
// pierwszy wolny klawisz dla nowego gracza
const freeBuzzKey = (used) => [...BUZZ_KEYS, 'Digit9', 'Digit0', 'KeyQ', 'KeyP', 'KeyZ', 'KeyM', 'KeyA', 'KeyL', 'KeyW', 'KeyO'].find((k) => !used.includes(k));
const BUZZ_COLORS = ['#ff3d7f', '#2de2e6', '#ffc93c', '#3ddc84', '#a78bfa', '#ff8a3d', '#60a5fa', '#f472b6',
  '#e11d48', '#14b8a6', '#eab308', '#22c55e', '#8b5cf6', '#f97316', '#0ea5e9', '#ec4899'];
// karty specjalne (modyfikatory osi czasu)
const SPECIAL_CHANCE = 0.2;
const SPECIALS = {
  double: { icon: '✨', name: T('Karta podwójna'), desc: T('dobre ułożenie daje dodatkową kartę') },
  steal: { icon: '🪙', name: T('Kradzież żetonu'), desc: T('dobre ułożenie zabiera żeton graczowi, który ma ich najwięcej') },
  swap: { icon: '🔄', name: T('Zamiana osi'), desc: T('po dobrym ułożeniu możesz zamienić się osią z innym graczem') },
  shield: { icon: '🛡️', name: T('Tarcza'), desc: T('dobre ułożenie daje tarczę – jednorazowo chroni przed zamianą osi, kradzieżą żetonu i utratą karty przy wyzwaniu „dokładny rok”') },
  fog: { icon: '🌫️', name: T('Mgła'), desc: T('dobre ułożenie ukrywa lata na Twojej osi przed innymi graczami (na dużym ekranie i ich telefonach) do Twojej następnej tury') },
  golden: { icon: '🎯', name: T('Złoty strzał'), desc: T('możesz też wpisać dokładny rok – trafienie daje +2 żetony') },
  magnet: { icon: '🧲', name: T('Magnes'), desc: T('tylko dla gracza na ostatnim miejscu – dobre ułożenie daje darmową kartę z samym rokiem') },
};
// „Melodia krok po kroku”: długość fragmentu i punkty za odgadnięcie na danym kroku
const STEPS = [{ len: 1, pts: 4 }, { len: 2, pts: 3 }, { len: 4, pts: 2 }, { len: 8, pts: 1 }];
// Okładka z mgły: najpierw sama rozmyta okładka (bez dźwięku), potem coraz ostrzejsza i coraz dłuższy fragment
// blur – rozmycie jako ułamek szerokości obrazka (tak samo mocne na telefonie i na dużym ekranie)
const COVER_STEPS = [{ len: 0, pts: 4, blur: 0.09 }, { len: 1, pts: 3, blur: 0.05 }, { len: 4, pts: 2, blur: 0.022 }, { len: 10, pts: 1, blur: 0 }];
// Pierwsze słowa: najpierw 3 pierwsze słowa piosenki, potem pierwszy wers, dwa wersy i na końcu 10 s fragmentu
const WORDS_STEPS = [{ len: 0, pts: 4, show: 3 }, { len: 0, pts: 3, show: 'l1' }, { len: 0, pts: 2, show: 'l2' }, { len: 10, pts: 1, show: 'l2' }];
// tryby „krok po kroku” (wspólne zasady: odgadnięcie w kroku daje jego punkty, błąd albo „wydłuż” – następny krok)
// Krzywe zwierciadło: ten sam 10-sekundowy fragment, z każdym krokiem mniej zniekształcony; efekt losowany dla piosenki:
// za ścianą (filtr dolnoprzepustowy), hel (szybciej i wyżej), slowed (wolniej i niżej), wspak (od tyłu)
const MIRROR_STEPS = [{ len: 10, pts: 4 }, { len: 10, pts: 3 }, { len: 10, pts: 2 }, { len: 10, pts: 1 }];
const MIRROR_FX = {
  wall: { icon: '🧱', name: T('Za ścianą'), lowpass: [250, 700, 2200, 0] },
  helium: { icon: '🎈', name: T('Hel'), rate: [1.75, 1.45, 1.2, 1] },
  slow: { icon: '🐢', name: T('Slowed'), rate: [0.6, 0.72, 0.86, 1] },
  reverse: { icon: '⏪', name: T('Wspak'), reverse: [true, true, false, false], lowpass: [0, 0, 1200, 0] },
};
const isSteps = () => ['steps', 'cover', 'mirror', 'words'].includes(state.mode);
const stepsList = () => (state.mode === 'cover' ? COVER_STEPS : state.mode === 'mirror' ? MIRROR_STEPS : state.mode === 'words' ? WORDS_STEPS : STEPS);

const state = {
  mode: null,
  players: [],        // {name, tokens, timeline: [song], score, lives, members, member}
  deck: null,
  turn: 0,
  current: null,
  preview: null,
  phase: 'setup',     // listen | placed | challenge | revealed
  slot: null,
  challenger: null,
  challengeSlot: null,
  challengeYear: null,
  challengeMode: 'place',
  endless: false,
  winTarget: 10,
  awarded: false,
  guessType: 'title',
  rounds: 5,
  turnsPlayed: 0,
  history: [],        // {song, preview, player, ok, note}
  drawId: 0,
  difficulty: 1,
  showAll: true,
  clipStart: 0,
  clipLen: 30,
};
const activePlayer = () => state.players[state.turn];
const isTimeline = () => ['solo', 'multi', 'teams', 'timed'].includes(state.mode);
// jedna osoba układa własną oś (bez wyzwań)
const isSoloLike = () => state.mode === 'solo' || state.mode === 'timed';
const isQuick = () => state.mode === 'hilo' || state.mode === 'duel';
// multiplayer i drużyny mają te same zasady (wyzwania, żetony) – drużyna to „gracz” ze wspólną osią
const isMultiMode = (m) => m === 'multi' || m === 'teams';
const isMulti = () => isMultiMode(state.mode);
const timeLabel = (sec) => (sec % 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : T('{0} min', sec / 60));
const isMelody = () => ['melody', 'steps', 'cover', 'mirror', 'words', 'buzz', 'seconds', 'mashup'].includes(state.mode);
// kto teraz odpowiada: w drużynach członkowie zmieniają się co turę drużyny
function answering(p) {
  return (state.mode === 'teams' || state.coop) && p.members && p.members.length ? p.members[p.member % p.members.length] : null;
}
const turnName = (p) => (answering(p) ? `${p.name} (odpowiada: ${answering(p)})` : p.name);
