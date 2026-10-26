'use strict';
// Songster – „Tak to leciało!”: sprawdzarka filmów na urządzeniu gracza (Ustawienia). YouTube nie pozwala sprawdzić
// osadzonego odtwarzania z serwera, więc gra po kolei odtwarza (bez dźwięku, w widocznym odtwarzaczu) każdy film
// z katalogu. Wynik nie ukrywa filmów – w grze film, który tu nie ruszył, jest oznaczony i stoi na końcu listy; raport
// (identyfikatory filmów i kody błędów) można skopiować i przekazać – trafia do tools/lyrics-data/bad-videos.json.
// Zasady YouTube: film może ruszyć, gdy odtwarzacz jest widoczny – sprawdzanie czeka, aż ponad połowa odtwarzacza
// jest na ekranie. Kilka błędów YouTube z rzędu bez żadnego udanego filmu to raczej blokada urządzenia albo sieci
// (np. VPN) – wtedy sprawdzanie się zatrzymuje i nie zapisuje tych wyników.
// Pliki js/*.js to zwykłe skrypty ładowane po kolei (index.html) – współdzielą zmienne globalne.
const LYC_TIMEOUT = 15000;
const LYC_ENV_ROW = 5;
let lycPlayer = null;
let lycStop = false;
let lycSeen = true; // ponad połowa odtwarzacza na ekranie
if (window.IntersectionObserver) new IntersectionObserver((es) => { lycSeen = es[es.length - 1].intersectionRatio >= 0.5; }, { threshold: [0, 0.5, 1] }).observe($('#lyc-box'));
const lycResults = () => store.get('lyChecked', {});
// wszystkie filmy z katalogu (także zapasowe) z długością nagrania z tekstem
function lycList() {
  const cat = window.LYRICS_SONGS || {};
  const out = [];
  for (const [k, raw] of Object.entries(cat)) {
    const vids = typeof raw[1] === 'number' ? (Array.isArray(raw[0]) ? raw[0] : [raw[0]]).map((id) => [id, raw[2]]) : raw.map(([id, , d]) => [id, d]);
    for (const [id, d] of vids) out.push({ k, id, d });
  }
  return out;
}
function lycPlayerReady() {
  if (lycPlayer) return Promise.resolve(lycPlayer);
  return lyLoadYT().then(() => new Promise((resolve) => {
    lycPlayer = new window.YT.Player('lyc-player', {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, cc_load_policy: 0, mute: 1 },
      events: { onReady: () => resolve(lycPlayer), onStateChange: (e) => lycPlayer.onState && lycPlayer.onState(e.data), onError: (e) => lycPlayer.onErr && lycPlayer.onErr(e.data) },
    });
  }));
}
// jeden film: odtwarzanie albo błąd (albo brak startu w 15 s); długość porównana z nagraniem z tekstem
function lycOne(p, v, ms = LYC_TIMEOUT) {
  return new Promise((res) => {
    const t = setTimeout(() => res({ ok: false, err: 'timeout' }), ms);
    p.onState = (s) => {
      if (s !== 1) return;
      clearTimeout(t);
      const d = Math.round(p.getDuration());
      p.pauseVideo();
      res(v.d && d && Math.abs(d - v.d) > LY_MAX_DIFF + 0.5 ? { ok: false, err: `dl${d - v.d}` } : { ok: true });
    };
    p.onErr = (c) => { clearTimeout(t); res({ ok: false, err: String(c) }); };
    p.mute();
    p.loadVideoById({ videoId: v.id });
  });
}
async function lycRun(all) {
  const box = $('#lyc-status');
  lycStop = false;
  $('#lyc-run').disabled = true;
  $('#lyc-stop').classList.remove('hidden');
  $('#lyc-box').classList.remove('hidden');
  $('#lyc-box').scrollIntoView({ block: 'center', behavior: 'smooth' });
  const done = lycResults();
  const list = lycList().filter((v) => all || !done[v.id]);
  let p;
  try { p = await lycPlayerReady(); } catch (e) { box.textContent = T('Nie udało się wczytać odtwarzacza YouTube.'); return; }
  let bad = 0;
  let okAny = false;
  let hardRow = [];
  let env = false;
  for (let i = 0; i < list.length && !lycStop; i++) {
    const v = list[i];
    box.textContent = T('Sprawdzanie {0} z {1} · nie działa: {2}', i + 1, list.length, bad);
    // karta w tle albo odtwarzacz poza ekranem – film by nie ruszył (każdy wyszedłby jako „timeout”); czekamy
    while ((document.hidden || !lycSeen) && !lycStop) {
      if (!lycSeen) box.textContent = T('Przewiń do odtwarzacza – sprawdzanie czeka, aż będzie widoczny.');
      await new Promise((r) => setTimeout(r, 500));
    }
    if (lycStop) break;
    let r = await lycOne(p, v);
    // nie ruszył – druga próba z dłuższym czasem (wolne łącze, reklama przed filmem)
    if (!r.ok && r.err === 'timeout' && !lycStop && !document.hidden && lycSeen) r = await lycOne(p, v, LYC_TIMEOUT * 2);
    if (r.ok) okAny = true;
    // błąd YouTube bez żadnego udanego filmu – wynik zapisujemy dopiero, gdy któryś film ruszy
    if (!r.ok && LY_HARD_ERR.includes(r.err) && !okAny) {
      hardRow.push([v.id, r]);
      if (hardRow.length >= LYC_ENV_ROW) { env = true; break; }
      continue;
    }
    for (const [id, x] of hardRow) { done[id] = { ...x, d: new Date().toISOString().slice(0, 10) }; bad += 1; }
    hardRow = [];
    done[v.id] = { ...r, d: new Date().toISOString().slice(0, 10) };
    if (!r.ok) bad += 1;
    store.set('lyChecked', done);
  }
  try { p.stopVideo(); } catch (e) { /* odtwarzacz zamknięty */ }
  $('#lyc-run').disabled = false;
  $('#lyc-stop').classList.add('hidden');
  box.textContent = env ? T('YouTube nie odtwarza teraz filmów na tym urządzeniu (np. przez VPN, blokadę reklam albo sieć) – sprawdzanie przerwane, wyniki nie zostały zapisane.')
    : lycStop ? T('Zatrzymano.') : T('Gotowe.');
  lycRender();
}
// raport do przekazania: filmy, które nie działają (id:kod), w jednej linii
function lycReport() {
  const bad = Object.entries(lycResults()).filter(([, r]) => !r.ok).map(([id, r]) => `${id}:${r.err}`);
  // przesunięcia tekstu ustawione przez graczy (przyciski pod piosenką) – trafiają do tools/lyrics-data/offsets.json
  const off = Object.entries(store.get('lyOffsets', {})).filter(([, o]) => o).map(([id, o]) => `${id}:${o > 0 ? '+' : ''}${o}`);
  // zgłoszenia z gry („Zła wersja piosenki”, „film pokazuje tekst”)
  const rep = store.get('lyReports', []).filter((r) => r.v).map((r) => `${r.v}:${r.r || 'zgl'}`).filter((x, i, a) => a.indexOf(x) === i);
  // start filmów w grze: które ruszyły, a które nie (kod błędu YouTube, „blokada” autoodtwarzania, „timeout”)
  const log = Object.entries(store.get('lyVidLog', {}));
  const okIds = log.filter(([, r]) => r.ok).map(([id]) => id);
  const noIds = log.filter(([, r]) => !r.ok).map(([id, r]) => `${id}:${r.err}`);
  return `Songster – Tak to leciało! – filmy, które się nie odtwarzają (${bad.length}): ${bad.join(' ')}`
    + (okIds.length ? ` · ruszyły w grze (${okIds.length}): ${okIds.join(' ')}` : '')
    + (noIds.length ? ` · nie ruszyły w grze (${noIds.length}): ${noIds.join(' ')}` : '')
    + (off.length ? ` · przesunięcia tekstu (${off.length}): ${off.join(' ')}` : '')
    + (rep.length ? ` · zgłoszenia z gry (${rep.length}): ${rep.join(' ')}` : '');
}
function lycRender() {
  const res = lycResults();
  const list = lycList();
  const checked = list.filter((v) => res[v.id]);
  const bad = checked.filter((v) => !res[v.id].ok);
  $('#lyc-summary').textContent = checked.length
    ? T('Sprawdzone filmy: {0} z {1}, nie odtwarza się: {2} (w grze oznaczone i na końcu listy filmów).', checked.length, list.length, bad.length)
    : T('Filmów w katalogu: {0}. Sprawdzanie trwa kilka minut – filmy grają bez dźwięku.', list.length);
  $('#lyc-copy').classList.toggle('hidden', !bad.length && !Object.values(store.get('lyOffsets', {})).some(Boolean) && !store.get('lyReports', []).length
    && !Object.keys(store.get('lyVidLog', {})).length);
}
$('#lyc-run').addEventListener('click', () => lycRun(false));
$('#ly-tap-toggle').checked = !!store.get('lyTapPlay', false);
$('#ly-tap-toggle').addEventListener('change', (e) => { store.set('lyTapPlay', e.target.checked); store.set('lyTapVotes', 0); });
$('#lyc-stop').addEventListener('click', () => { lycStop = true; });
$('#lyc-copy').addEventListener('click', async () => {
  const txt = lycReport();
  try { await navigator.clipboard.writeText(txt); $('#lyc-status').textContent = T('Raport skopiowany – wklej go w wiadomości.'); } catch (e) { $('#lyc-report').value = txt; $('#lyc-report').classList.remove('hidden'); $('#lyc-report').select(); }
});
lycRender();
