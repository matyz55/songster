// Katalog piosenek do trybu „Tak to leciało!” – polskie piosenki, które mają tekst z czasami wersów (LRCLIB)
// i działający film na YouTube (odtwarzany od początku do przerwy). Teksty NIE trafiają do repozytorium – gra
// pobiera je z LRCLIB w trakcie rozgrywki; katalog zawiera tylko identyfikatory i długości.
//   node tools/lyrics-catalog.mjs lrclib [n] – szuka tekstów z czasami i ich wariantów długości (tools/lyrics-data/lrclib.json)
//   node tools/lyrics-catalog.mjs youtube    – szuka filmów (wymaga YOUTUBE_API_KEY; najpierw identyfikatory z Wikidata,
//                                              potem wyszukiwarka YouTube – limit 100 wyszukiwań dziennie)
//   node tools/lyrics-catalog.mjs wikidata   – bez klucza: tylko teledyski z Wikidata (niesprawdzone – gra sama
//                                              porównuje długość filmu w trakcie odtwarzania)
//   node tools/lyrics-catalog.mjs lang [n]   – sprawdza język tekstów już znalezionych (pole pl: udział polskich wersów)
//   node tools/lyrics-catalog.mjs build      – zapisuje lyrics-catalog.js (tylko piosenki z polskim tekstem)
// Film jest przyjmowany, gdy można go osadzić, nie jest zablokowany w Polsce, a jego długość różni się od długości
// nagrania z tekstem o najwyżej 3 s (wtedy czasy wersów pasują do filmu), a kanał jest oficjalny (OFFICIAL_LABELS niżej).
// Kolejność: najpopularniejsze piosenki.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { SONGS, SongMatch, sparql, sleep, dir } from './wd-lib.mjs';

const UA = 'SongsterTools/1.0 (https://github.com/matyz55/hitster)';
const norm = SongMatch.norm;
const clean = (t) => t.replace(/\s*[([].*?[)\]]/g, '').replace(/\s+[-–]\s+.*$/, '').trim();
// wyniki zapisywane w repozytorium (tools/lyrics-data) – kolejne uruchomienia, także w innych sesjach, kontynuują pracę
// (tylko identyfikatory i długości – bez tekstów piosenek)
const dataDir = new URL('tools/lyrics-data/', dir);
const FILES = { 'lrclib-pl.json': 'lrclib.json', 'youtube-pl.json': 'youtube.json' };
const load = (name, def) => { const f = new URL(FILES[name] || name, dataDir); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : def; };
const save = (name, v) => writeFileSync(new URL(FILES[name] || name, dataDir),
  `{\n${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}: ${JSON.stringify(v[k])}`).join(',\n')}\n}\n`);
const key = (s) => `${s.a}|${s.t}`;

// Oficjalne kanały: „… - Topic” (YouTube Music), kanały VEVO, kanał z nazwą głównego wykonawcy albo wytwórnia z tej listy
// (porównanie bez wielkości liter, polskich znaków i odstępów – fragment nazwy kanału).
const OFFICIAL_LABELS = ['Universal Music Polska', 'Sony Music Poland', 'Warner Music Poland', 'Kayax', 'Agora', 'Polskie Nagrania',
  'Mystic Production', 'Pomaton', 'Step Records', 'QueQuality', 'SBM Label', 'Asfalt Records', 'Prosto', 'My Music', 'Magic Records',
  'Fonografika', 'Tonpress', 'S.P. Records', 'MTJ Wytwórnia Muzyczna', 'Agencja Muzyczna Polskiego Radia', 'MaxFloRec'];
// Wersje, które nie nadają się do gry: z tekstem na ekranie (zdradzają odpowiedź), karaoke, covery, koncerty, remiksy
// (nie dotyczy kanałów „- Topic”, gdzie np. „(Live)” to nagranie z płyty).
const BAD_TITLE = /\b(tekst|tekstem|lyrics?|karaoke|cover|live|na zywo|koncert|remix|8d|slowed|sped up|instrumental)\b/;
const words = (t) => t.toLowerCase().replace(/ł/g, 'l').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ');
const isTopic = (ch) => / - Topic$/.test(ch);
// tytuł filmu musi zawierać tytuł piosenki (np. „Trójkąty i kwadraty” ≠ film „Małomiasteczkowy”)
const titleMatches = (v, s) => ` ${words(v.title || '')} `.includes(` ${words(clean(s.t)).trim()} `);
// kanał „X - Topic” musi być kanałem wykonawcy tej piosenki (np. „Kombi Łosowski - Topic” to późniejsze nagranie,
// a nie wersja Kombi); w innych kanałach nazwa wykonawcy musi być w nazwie kanału albo w tytule filmu
function artistMatches(v, s) {
  const artists = SongMatch.artistsOf(s).map(norm).filter((a) => a.length >= 2);
  if (isTopic(v.channel)) return artists.includes(norm(v.channel.replace(/ - Topic$/, '')));
  const where = norm(`${v.channel} ${v.title || ''}`);
  return artists.some((a) => where.includes(a));
}
function usableVideo(v, s) {
  if (!v.channel || !titleMatches(v, s) || !artistMatches(v, s)) return false;
  return isTopic(v.channel) || !BAD_TITLE.test(words(v.title || ''));
}
function officialVideo(v, s) {
  if (!v.channel) return false;
  if (isTopic(v.channel)) return true;
  if (BAD_TITLE.test(words(v.title || ''))) return false;
  const ch = norm(v.channel);
  const artist = norm(SongMatch.mainArtist(s));
  return /vevo/.test(ch) || (artist.length >= 3 && ch.includes(artist)) || OFFICIAL_LABELS.some((l) => ch.includes(norm(l)));
}
const MAX_DIFF = 3;

// kandydaci: kilkaset najpopularniejszych polskich piosenek – popularność w Spotify (p), dodatkowo nowsze piosenki (od 2015)
// i klasyki z plebiscytu Trójki „Polski Top Wszech Czasów” (tp) oraz Opola; TOP=0 – wszystkie polskie piosenki z bazy
const tagged = (s) => (s.tg || []).some((t) => ['trojka', 'opole', 'memy'].includes(t));
const TOP = process.env.TOP === undefined ? 600 : Number(process.env.TOP);
const score0 = (s) => (s.p || 0) + (s.y >= 2015 ? 10 : 0) + ((s.f || []).some((f) => f === 'tp' || f.startsWith('tp:')) ? 15 : 0)
  + ((s.tg || []).includes('opole') ? 5 : 0);
// piosenki wskazane przez właściciela gry (playlisty „Tak to leciało!”) – tools/lyrics-data/wanted.json: [„Wykonawca|Tytuł”, …];
// zawsze w kandydatach i szukane jako pierwsze
const WANTED = new Set(JSON.parse(existsSync(new URL('tools/lyrics-data/wanted.json', dir)) ? readFileSync(new URL('tools/lyrics-data/wanted.json', dir), 'utf8') : '[]'));
const wantedFirst = (s) => (WANTED.has(`${s.a}|${s.t}`) ? 1000 : 0);
const candidates = [...new Set([...SONGS.filter((s) => s.c === 'PL' && WANTED.has(`${s.a}|${s.t}`)),
  ...SONGS.filter((s) => s.c === 'PL').sort((a, b) => score0(b) - score0(a)).slice(0, TOP || Infinity)])]
  .sort((a, b) => wantedFirst(b) + score0(b) - wantedFirst(a) - score0(a));
// kategorie gry (lyrics-cats.js) – piosenki z kategorii, które w katalogu mają mało piosenek, wyszukujemy najpierw,
// żeby plansze były różnorodne (kategoria potrzebuje co najmniej 2 piosenek, a lepiej kilku na kolejne gry)
const catCtx = { window: {}, T: (x) => x };
vm.runInNewContext(readFileSync(new URL('lyrics-cats.js', dir), 'utf8'), catCtx);
const CATS = [...catCtx.window.LY_THEMES.map((c) => ({ name: c.name(), test: (s) => c.re.test(s.t) })),
  ...catCtx.window.LY_SETS.map((c) => ({ name: c.name(), test: c.test }))];
const THIN = 6;
function thinBonus(s, have) {
  return CATS.filter((c) => c.test(s) && (have.get(c.name) || 0) < THIN).length * 25;
}
function catalogCounts(lr, yt) {
  const have = new Map();
  for (const s of candidates) if (lr[key(s)] && yt[key(s)] && yt[key(s)].id) for (const c of CATS) if (c.test(s)) have.set(c.name, (have.get(c.name) || 0) + 1);
  return have;
}

// wersy tekstu LRC (bez znaczników czasu) i udział polskich wersów (lyrics-cats.js: lyPolishShare)
const lrcTexts = (lrc) => lrc.split('\n').filter((l) => /^\[\d+:\d+/.test(l)).map((l) => l.replace(/^(\[[^\]]*\])+/, '').trim()).filter(Boolean);
const plShare = (texts) => Math.round(catCtx.window.lyPolishShare(texts) * 100) / 100;
const PL_MIN = catCtx.window.LY_PL_MIN;
async function lrclibGet(id) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://lrclib.net/api/get/${id}`, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (res && res.status === 429) { await sleep(1000 * Number(res.headers.get('retry-after') || 30)); continue; }
    if (res && res.status === 404) return null;
    if (!res || !res.ok) { await sleep(3000 * (attempt + 1)); continue; }
    return res.json();
  }
  return undefined;
}
// język tekstów zapisanych wcześniej bez pola pl – najpierw piosenki, które mają już film (trafiają do katalogu)
async function stepLang() {
  const cache = load('lrclib-pl.json', {});
  const yt = load('youtube-pl.json', {});
  // opcjonalny limit: node tools/lyrics-catalog.mjs lang 50
  const todo = Object.keys(cache).filter((k) => cache[k] && cache[k].pl === undefined).sort((a, b) => hasVideo(yt[b]) - hasVideo(yt[a]))
    .slice(0, Number(process.argv[3]) || Infinity);
  let n = 0;
  for (const k of todo) {
    const r = await lrclibGet(cache[k].id);
    if (r && r.syncedLyrics) cache[k].pl = plShare(lrcTexts(r.syncedLyrics));
    await sleep(600);
    if (++n % 25 === 0) { save('lrclib-pl.json', cache); process.stdout.write(`\rjęzyk: ${n}/${todo.length}`); }
  }
  save('lrclib-pl.json', cache);
  const notPl = Object.entries(cache).filter(([, v]) => v && v.pl !== undefined && v.pl < PL_MIN);
  console.log(`\njęzyk sprawdzony: ${n}; teksty nie po polsku (poniżej ${PL_MIN}): ${notPl.length}`);
  for (const [k, v] of notPl) if (hasVideo(yt[k])) console.log(`  ${k} – polskich wersów ${Math.round(v.pl * 100)}%`);
}
async function lrclibSearch(s, loose = false) {
  const artist = SongMatch.mainArtist(s);
  // najpierw dokładnie (tytuł i wykonawca osobno), a gdy nic – luźniej (jedno pole q: wykonawca i tytuł razem)
  const url = loose ? `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${clean(s.t)}`)}`
    : `https://lrclib.net/api/search?track_name=${encodeURIComponent(clean(s.t))}&artist_name=${encodeURIComponent(artist)}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    // 429 – limit zapytań, 503 – serwer chwilowo przeciążony: czekamy tyle, ile prosi (retry-after)
    if (res && (res.status === 429 || res.status === 503)) { await sleep(1000 * Math.max(1, Number(res.headers.get('retry-after') || 5))); continue; }
    if (!res || !res.ok) { await sleep(3000 * (attempt + 1)); continue; }
    const rows = await res.json();
    const artists = SongMatch.artistsOf(s).map(norm);
    let ok = (Array.isArray(rows) ? rows : []).filter((r) => r.syncedLyrics && !r.instrumental && norm(clean(r.trackName)) === norm(clean(s.t))
      && artists.some((a) => norm(r.artistName).includes(a)));
    if (!ok.length) return loose ? null : lrclibSearch(s, true);
    // polska piosenka: tylko teksty po polsku, jeśli takie są (bywają wgrane tłumaczenia albo inna wersja językowa)
    const pol = ok.filter((r) => plShare(lrcTexts(r.syncedLyrics)) >= PL_MIN);
    if (s.c === 'PL' && pol.length) ok = pol;
    // najczęstsza długość nagrania (różne wydania tej samej wersji) – potem najdłuższy tekst
    ok.sort((a, b) => ok.filter((x) => Math.abs(x.duration - b.duration) < 2).length - ok.filter((x) => Math.abs(x.duration - a.duration) < 2).length
      || b.syncedLyrics.length - a.syncedLyrics.length);
    const r = ok[0];
    const texts = lrcTexts(r.syncedLyrics);
    if (texts.length < 8) return null;
    // warianty: teksty dopasowane do nagrań o innej długości (np. wersja z teledysku) – film dostaje tekst o swojej długości
    const v = [];
    for (const x of ok) {
      if (lrcTexts(x.syncedLyrics).length < 8 || v.some(([, d]) => Math.abs(d - x.duration) < 1.5)) continue;
      v.push([x.id, Math.round(x.duration)]);
    }
    return { id: r.id, d: Math.round(r.duration), lines: texts.length, pl: plShare(texts), v };
  }
  return undefined; // nie udało się zapytać – spróbujemy następnym razem
}

async function stepLrclib() {
  const cache = load('lrclib-pl.json', {});
  let n = 0;
  // także ponownie piosenki zapisane bez wariantów długości (pole v) – najpierw te, które mają już film
  const yt = load('youtube-pl.json', {});
  // opcjonalny limit zapytań: node tools/lyrics-catalog.mjs lrclib 400
  let left = Number(process.argv[3]) || Infinity;
  // piosenki bez tekstu z czasami (null) sprawdzamy ponownie co 30 dni – teksty w LRCLIB z czasem przybywają;
  // data ostatniego sprawdzenia: lrclib-none.json; teksty z małym udziałem polskich wersów – też ponownie (wybór wariantu)
  const none = load('lrclib-none.json', {});
  const today = new Date().toISOString().slice(0, 10);
  const due = (k) => !none[k] || Date.now() - Date.parse(none[k]) >= 30 * 864e5;
  for (const s of [...candidates].sort((a, b) => wantedFirst(b) - wantedFirst(a) || hasVideo(yt[key(b)]) - hasVideo(yt[key(a)]))) {
    const c = cache[key(s)];
    if (key(s) in cache && ((c === null && !due(key(s))) || (c && c.v && !(c.pl < PL_MIN && !c.plChecked)))) continue;
    if (left-- <= 0) break;
    const r = await lrclibSearch(s);
    if (r === null) none[key(s)] = today;
    if (r && c && c.pl < PL_MIN) r.plChecked = true;
    if (r !== undefined) cache[key(s)] = r;
    await sleep(1100);
    if (++n % 25 === 0) { save('lrclib-pl.json', cache); process.stdout.write(`\rLRCLIB: ${n}`); }
  }
  save('lrclib-pl.json', cache);
  save('lrclib-none.json', none);
  const found = Object.values(cache).filter(Boolean).length;
  console.log(`\nLRCLIB: sprawdzone ${Object.keys(cache).length}, z tekstem z czasami: ${found}`);
}

// YouTube Data API v3: videos.list (1 jednostka) i search.list (osobny limit 100 dziennie)
const ytKey = process.env.YOUTUBE_API_KEY;
// Piosenka bez pasującego filmu: { none: data ostatniej próby, tries: liczba prób } – kolejna próba najwcześniej po
// RETRY_DAYS dniach, najwyżej MAX_TRIES prób (dawny zapis null = jedna próba bez daty, więc druga próba od razu).
const RETRY_DAYS = 30;
const MAX_TRIES = 2;
const hasVideo = (v) => !!(v && v.id);
const retryDue = (v) => v === undefined || v === null
  || (!!v.none && v.tries < MAX_TRIES && Date.now() - Date.parse(v.none) >= RETRY_DAYS * 864e5);
const noVideo = (prev) => ({ none: new Date().toISOString().slice(0, 10), tries: (prev === null ? 1 : (prev && prev.tries) || 0) + 1 });
const MAX_SEARCHES = 95; // dzienny limit search.list to 100
const SEARCH_PAUSE = 2000; // przerwa między wyszukiwaniami (limit zapytań na minutę)
const isoSec = (d) => { const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };
// Zwraca dane albo null przy błędzie (bez wyniku – nie zapisujemy wtedy „brak filmu”).
// Limit na minutę: przerwa 60 s i ponowna próba; limit dzienny (lub limit na minutę po 2 próbach): wyjątek – koniec wyszukiwań.
let searchCalls = 0; // każde zapytanie search.list (także ponowione) liczy się do dziennego limitu
async function ytApi(path, params) {
  const url = `https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key: ytKey })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (path === 'search' && searchCalls >= MAX_SEARCHES) throw new Error('limit wyszukiwań');
    if (path === 'search') searchCalls += 1;
    const res = await fetch(url).catch(() => null);
    if (!res) { await sleep(5000); continue; }
    const data = await res.json().catch(() => null);
    if (data && !data.error) return data;
    const msg = (data && data.error && data.error.message) || `HTTP ${res.status}`;
    console.error(`YouTube API: ${msg}`);
    const perMinute = res.status === 429 || /per minute/i.test(msg);
    if (perMinute && attempt < 2) { await sleep(60000); continue; }
    if (perMinute || res.status === 403) throw new Error('limit YouTube API');
    return null;
  }
  return null;
}
async function videoInfo(ids) {
  const data = await ytApi('videos', { part: 'contentDetails,status,snippet', id: ids.join(','), maxResults: 50 });
  if (!data) return null;
  return (data.items || []).map((v) => ({
    id: v.id, d: isoSec(v.contentDetails.duration), embeddable: v.status.embeddable, title: v.snippet.title, channel: v.snippet.channelTitle,
    age: !!(v.contentDetails.contentRating && v.contentDetails.contentRating.ytRating === 'ytAgeRestricted'),
    blockedPL: !!(v.contentDetails.regionRestriction && ((v.contentDetails.regionRestriction.blocked || []).includes('PL')
      || (v.contentDetails.regionRestriction.allowed && !v.contentDetails.regionRestriction.allowed.includes('PL')))),
  }));
}
// film nadaje się do gry: osadzalny, niezablokowany w Polsce, długość jak nagranie z tekstem, właściwy tytuł;
// oficjalne kanały mają pierwszeństwo, ale zostawiamy też inne – część wytwórni blokuje odtwarzanie na innych
// stronach (czego API nie pokazuje), więc gra próbuje kolejnych filmów z listy (alts)
// tekst do filmu: wariant z LRCLIB o długości najbliższej filmowi (najwyżej MAX_DIFF s różnicy) – [id tekstu, długość]
const lrVariants = (lr) => (lr.v && lr.v.length ? lr.v : [[lr.id, lr.d]]);
function lrFor(d, lr) {
  let best = null;
  for (const [id, ld] of lrVariants(lr)) if (Math.abs(ld - d) <= MAX_DIFF && (!best || Math.abs(ld - d) < Math.abs(best[1] - d))) best = [id, ld];
  return best;
}
const fits = (v, lr, s) => v && v.embeddable && !v.blockedPL && !v.age && !!lrFor(v.d, lr) && usableVideo(v, s);
const rank = (s, l) => (a, b) => (isTopic(b.channel) - isTopic(a.channel)) || (officialVideo(b, s) - officialVideo(a, s))
  || Math.abs(a.d - lrFor(a.d, l)[1]) - Math.abs(b.d - lrFor(b.d, l)[1]);
const MAX_ALTS = 5;
// zapis: film główny, zapasowe (alts) i długości wszystkich filmów (dur) – build dobiera do nich warianty tekstu
const entry = (v, src, alts, infos) => ({ id: v.id, src, channel: v.channel, title: v.title, ...(alts && alts.length > 1 ? { alts } : {}),
  dur: Object.fromEntries((infos || [v]).filter((x) => (alts || [v.id]).includes(x.id)).map((x) => [x.id, x.d])) });
// wszystkie polskie piosenki (także spoza listy kandydatów – piosenki już w katalogu zostają)
const ALL_PL = SONGS.filter((s) => s.c === 'PL');
const songByKey = new Map(ALL_PL.map((s) => [key(s), s]));

const WD_YT = `SELECT ?songLabel ?perfLabel ?yt WHERE { ?song wdt:P1651 ?yt ; wdt:P175 ?perf .
    ?perf wdt:P27|wdt:P495 wd:Q36 . SERVICE wikibase:label { bd:serviceParam wikibase:language "pl,en". } }`;
async function wikidataVideos(lr, yt) {
  const rows = await sparql(WD_YT, 'yt-pl');
  const wd = new Map();
  for (const s of candidates) {
    if (!lr[key(s)] || hasVideo(yt[key(s)])) continue;
    const r = rows.find((x) => norm(clean(x.songLabel.value)) === norm(clean(s.t)) && SongMatch.artistsOf(s).map(norm).includes(norm(x.perfLabel.value)));
    if (r) wd.set(key(s), r.yt.value);
  }
  return wd;
}
async function stepWikidata() {
  const lr = load('lrclib-pl.json', {});
  const yt = load('youtube-pl.json', {});
  const wd = await wikidataVideos(lr, yt);
  for (const [k, id] of wd) yt[k] = { id, src: 'wikidata', unverified: true };
  save('youtube-pl.json', yt);
  console.log(`Wikidata: teledyski dla ${wd.size} piosenek z tekstem (niesprawdzone)`);
}

const plOk = (l) => l && (l.pl === undefined || l.pl >= PL_MIN);
async function artistSearches(lr, yt, limit) {
  const done = load('artists.json', {});
  const groups = new Map();
  for (const s of candidates) {
    if (!plOk(lr[key(s)])) continue;
    const a = SongMatch.mainArtist(s);
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a).push(s);
  }
  const missing = (list) => list.filter((s) => !hasVideo(yt[key(s)]));
  const order = [...groups].filter(([a, list]) => missing(list).length && (!done[a] || Date.now() - Date.parse(done[a].at) >= RETRY_DAYS * 864e5))
    .sort((x, y) => missing(y[1]).reduce((n, s) => n + 10 + (s.p || 0), 0) - missing(x[1]).reduce((n, s) => n + 10 + (s.p || 0), 0));
  let found = 0;
  let searches = 0;
  for (const [artist, list] of order) {
    if (searches >= limit || searchCalls >= MAX_SEARCHES) break;
    if (searchCalls) await sleep(SEARCH_PAUSE);
    const data = await ytApi('search', { part: 'id', type: 'video', maxResults: 50, q: artist, regionCode: 'PL', videoEmbeddable: 'true', videoSyndicated: 'true' });
    searches += 1;
    if (!data) continue;
    const ids = (data.items || []).map((x) => x.id.videoId).filter(Boolean);
    const vids = ids.length ? await videoInfo(ids) : [];
    if (!vids) continue;
    let n = 0;
    for (const s of list) {
      const l = lr[key(s)];
      const ok = vids.filter((v) => fits(v, l, s)).sort(rank(s, l));
      if (!ok.length) continue;
      const prev = yt[key(s)];
      if (hasVideo(prev)) {
        // zapasowe filmy dla piosenki, która już ma film
        const all = [...new Set([...(prev.alts || [prev.id]), ...ok.map((v) => v.id)])].slice(0, MAX_ALTS);
        yt[key(s)] = { ...prev, ...(all.length > 1 ? { alts: all } : {}), dur: { ...(prev.dur || {}), ...Object.fromEntries(ok.map((v) => [v.id, v.d])) } };
      } else { yt[key(s)] = entry(ok[0], 'artist', ok.slice(0, MAX_ALTS).map((v) => v.id), ok); n += 1; }
    }
    found += n;
    done[artist] = { at: new Date().toISOString().slice(0, 10), found: n };
    save('youtube-pl.json', yt);
    save('artists.json', done);
    console.log(`  ${artist}: nowe piosenki z filmem ${n} (bez filmu było ${missing(list).length + n})`);
  }
  console.log(`Wyszukiwanie po wykonawcach: ${searches} zapytań, nowe piosenki z filmem: ${found}`);
}

async function stepYoutube() {
  if (!ytKey) { console.error('Brak zmiennej YOUTUBE_API_KEY – patrz README (Tak to leciało!).'); process.exit(1); }
  const lr = load('lrclib-pl.json', {});
  const yt = load('youtube-pl.json', {});
  // 0) wcześniej przyjęte bez sprawdzenia (krok wikidata) – sprawdzamy jak pozostałe
  for (const k of Object.keys(yt)) if (yt[k] && yt[k].unverified) delete yt[k];
  // 1) teledyski z Wikidata (P1651) – sprawdzenie długości i dostępności kosztuje 1 jednostkę na 50 filmów
  const wd = await wikidataVideos(lr, yt);
  const wdIds = [...new Set(wd.values())];
  const info = new Map();
  for (let i = 0; i < wdIds.length; i += 50) for (const v of await videoInfo(wdIds.slice(i, i + 50)) || []) info.set(v.id, v);
  for (const [k, id] of wd) if (fits(info.get(id), lr[k], songByKey.get(k))) yt[k] = entry(info.get(id), 'wikidata', [id], [info.get(id)]);
  save('youtube-pl.json', yt);
  // 2) ponowne sprawdzenie zapisanych filmów (1 jednostka na 50) – nieoficjalne, niedostępne lub niepasujące usuwamy,
  // żeby zostały wyszukane od nowa; pozostałym uzupełniamy kanał i tytuł
  const saved = Object.keys(yt).filter((k) => hasVideo(yt[k]) && !wd.has(k));
  const savedIds = [...new Set(saved.flatMap((k) => yt[k].alts || [yt[k].id]))];
  const now = new Map();
  let checked = true;
  for (let i = 0; i < savedIds.length; i += 50) {
    const vs = await videoInfo(savedIds.slice(i, i + 50));
    if (!vs) { checked = false; break; }
    for (const v of vs) now.set(v.id, v);
  }
  let removed = 0;
  if (checked) {
    for (const k of saved) {
      // zostają filmy, które nadal pasują (do któregoś wariantu tekstu); główny – pierwszy z nich
      const s = songByKey.get(k);
      const ok = s && lr[k] ? (yt[k].alts || [yt[k].id]).map((id) => now.get(id)).filter((v) => fits(v, lr[k], s)) : [];
      if (ok.length) yt[k] = { ...entry(ok[0], yt[k].src, ok.map((v) => v.id), ok), ...(yt[k].altsSearched ? { altsSearched: true } : {}) };
      else { delete yt[k]; removed += 1; }
    }
    save('youtube-pl.json', yt);
    console.log(`YouTube: sprawdzone zapisane filmy ${saved.length}, usunięte ${removed}`);
  }
  // 3) wyszukiwanie po wykonawcy: jedno zapytanie (50 filmów) obejmuje wiele piosenek tego wykonawcy – najpierw wykonawcy
  // z największą liczbą (i popularnością) piosenek z tekstem, ale bez filmu; wykonawca wraca najwcześniej po RETRY_DAYS dniach
  try { await artistSearches(lr, yt, Math.round(MAX_SEARCHES * 0.7)); } catch (e) { console.error(String(e.message || e)); }
  // 3) wyszukiwarka YouTube – najpopularniejsze piosenki bez filmu, potem te z jednym filmem (zapasowe filmy na wypadek
  // blokady osadzania); najpierw nagranie „… – Topic” (wersja z płyty), potem oficjalne kanały, potem pozostałe
  const have = catalogCounts(lr, yt);
  const score = (s) => wantedFirst(s) + (s.p || 0) + (tagged(s) ? 40 : 0) + thinBonus(s, have);
  const queue = [...candidates.filter((s) => lr[key(s)] && !hasVideo(yt[key(s)]) && retryDue(yt[key(s)])).sort((a, b) => score(b) - score(a)),
    ...candidates.filter((s) => lr[key(s)] && hasVideo(yt[key(s)]) && !yt[key(s)].alts && !yt[key(s)].altsSearched)];
  for (const s of queue) {
    const l = lr[key(s)];
    if (searchCalls >= MAX_SEARCHES) break;
    const q = `${SongMatch.mainArtist(s)} ${clean(s.t)}`;
    if (searchCalls) await sleep(SEARCH_PAUSE);
    let data, vids = [];
    try {
      // videoSyndicated – tylko filmy, które można odtwarzać poza youtube.com
      data = await ytApi('search', { part: 'id', type: 'video', maxResults: 8, q, regionCode: 'PL', videoEmbeddable: 'true', videoSyndicated: 'true' });
      if (!data) continue; // błąd – bez zapisu, piosenka wróci przy następnym uruchomieniu
      const ids = (data.items || []).map((x) => x.id.videoId).filter(Boolean);
      if (ids.length && !(vids = await videoInfo(ids))) continue;
    } catch { break; }
    const prev = yt[key(s)];
    const ok = vids.filter((v) => fits(v, l, s));
    if (hasVideo(prev)) {
      // zapasowe filmy dla piosenki, która już ma film
      const all = [prev.id, ...ok.map((v) => v.id).filter((id) => id !== prev.id)].slice(0, MAX_ALTS);
      yt[key(s)] = { ...prev, ...(all.length > 1 ? { alts: all } : {}), dur: { ...(prev.dur || {}), ...Object.fromEntries(ok.map((v) => [v.id, v.d])) }, altsSearched: true };
      save('youtube-pl.json', yt);
      continue;
    }
    if (!ok.length) { yt[key(s)] = noVideo(prev); save('youtube-pl.json', yt); continue; }
    ok.sort(rank(s, l));
    yt[key(s)] = entry(ok[0], 'search', ok.slice(0, MAX_ALTS).map((v) => v.id), ok);
    save('youtube-pl.json', yt);
  }
  const found = Object.values(yt).filter(hasVideo).length;
  console.log(`YouTube: wyszukiwania ${searchCalls}, filmy dla ${found} piosenek (z Wikidata: ${[...wd.keys()].filter((k) => hasVideo(yt[k])).length})`);
}

// filmy, które nie odtwarzają się w osadzonym odtwarzaczu na urządzeniach graczy (raport ze sprawdzarki w grze:
// Ustawienia → Tak to leciało! → Sprawdź filmy) – tools/lyrics-data/bad-videos.json: { id: kod błędu }
// „timeout” (film nie ruszył w czasie na urządzeniu gracza – zwykle blokada autoodtwarzania, nie wada filmu) nie wyklucza
// filmu: gracz sam wybiera film przed piosenką, a dotknięcie go uruchamia
const BAD = new Set(Object.entries(load('bad-videos.json', {})).filter(([, why]) => !/^timeout\b/.test(why)).map(([id]) => id));
// przesunięcia tekstu względem filmu (s; dodatnie – tekst później) ustawione przez graczy przyciskami pod piosenką
// i przekazane w raporcie – tools/lyrics-data/offsets.json: { id: sekundy }; w katalogu czwarta liczba przy filmie
const OFFSETS = load('offsets.json', {});
function stepBuild() {
  const lr = load('lrclib-pl.json', {});
  const yt = load('youtube-pl.json', {});
  const out = {};
  for (const s of ALL_PL) {
    const l = lr[key(s)]; const v = yt[key(s)];
    // zapisany tytuł filmu nie pasuje do piosenki albo to wersja z tekstem na ekranie – pomijamy (bez zapytań do API)
    if (hasVideo(v) && v.title && !usableVideo(v, s)) continue;
    // tylko piosenki z polskim tekstem (język sprawdzony krokiem lrclib albo lang); każdy film z tekstem o swojej długości:
    // [[film, tekst, długość], …] – filmy bez znanej długości (stare zapisy) dostają tekst główny
    if (!l || !hasVideo(v) || l.pl === undefined || l.pl < PL_MIN) continue;
    const alts = [];
    for (const id of v.alts || [v.id]) {
      if (BAD.has(id)) continue;
      const d = v.dur && v.dur[id];
      const m = d ? lrFor(d, l) : [l.id, l.d];
      if (m) alts.push(OFFSETS[id] ? [id, m[0], m[1], OFFSETS[id]] : [id, m[0], m[1]]);
    }
    if (alts.length) out[key(s)] = alts;
  }
  const js = '// Tryb „Tak to leciało!”: piosenka → [[film YouTube, tekst w LRCLIB, długość w s, przesunięcie tekstu w s (opcjonalnie)], …] (gra próbuje kolejnych filmów)\n'
    + '// – generuje tools/lyrics-catalog.mjs.\n'
    + '// Teksty nie są tu zapisane – gra pobiera je z lrclib.net w trakcie rozgrywki.\n'
    + `window.LYRICS_SONGS = ${JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"')};\n`;
  writeFileSync(new URL('lyrics-catalog.js', dir), js);
  console.log(`lyrics-catalog.js: ${Object.keys(out).length} piosenek`);
  const have = catalogCounts(lr, yt);
  console.log(`kategorie z co najmniej 2 piosenkami: ${CATS.filter((c) => (have.get(c.name) || 0) >= 2).length} z ${CATS.length}`
    + ` (mało piosenek: ${CATS.filter((c) => (have.get(c.name) || 0) < THIN).map((c) => c.name).join(', ')})`);
}

const step = process.argv[2];
if (step === 'lrclib') await stepLrclib();
else if (step === 'youtube') await stepYoutube();
else if (step === 'wikidata') await stepWikidata();
else if (step === 'lang') await stepLang();
else if (step === 'build') stepBuild();
else console.log('Użycie: node tools/lyrics-catalog.mjs lrclib | youtube | lang | build');
