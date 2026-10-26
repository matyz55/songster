// Zrzuty wszystkich ekranów gry do przeglądu interfejsu (narzędzie z uwagami do każdego ekranu).
// Gra działa tak jak w testach: zamiast iTunes, LRCLIB i YouTube – atrapy z tests/mock.js, więc nie potrzeba sieci
// (poza scenariuszami z dużym ekranem i telefonami, które łączą się przez PeerJS/MQTT jak w prawdziwej grze).
// Każdy ekran: 4 urządzenia (telefon pionowo i poziomo, PC, ultrawide), zrzut całej strony; zrzuty jednego ekranu
// są składane w jeden obrazek WebP (obok siebie), a ich położenie zapisuje manifest.json.
// Uruchomienie: node tools/screens.mjs [katalog wyjściowy] [filtr – fragment id scenariusza]
// UI6=1 – zrzuty nowego wyglądu 6.0 (wersja próbna); PORT – inny port serwera (kilka uruchomień naraz).
// Przy każdym urządzeniu zapisuje się też kontrola „bez przewijania”: czy strona się przewija i które elementy ucinają treść.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { SCENARIOS } from './screens-scenarios.mjs';

const OUT = process.argv[2] || 'screens-out';
const ONLY = process.argv[3] || '';
const PORT = Number(process.env.PORT) || 8799;
const UI6 = process.env.UI6 === '1';
const BASE = `http://localhost:${PORT}`;
export const DEVICES = {
  tel: { w: 360, h: 640, name: 'Telefon pionowo' },
  tell: { w: 640, h: 360, name: 'Telefon poziomo' },
  pc: { w: 1280, h: 720, name: 'PC' },
  uw: { w: 2560, h: 1080, name: 'Ultrawide' },
};
// urządzenia dużego ekranu i telefonu gracza (strona tv.html)
export const TV_DEVICES = {
  tv: { w: 1920, h: 1080, name: 'Telewizor' },
  tv720: { w: 1280, h: 720, name: 'Telewizor HD 720p' },
};
export const PHONE_DEVICES = { tel: DEVICES.tel, tell: DEVICES.tell };
const MAX_H = 6000; // dłuższe zrzuty przycinamy (w manifeście zostaje pełna wysokość)

const mock = readFileSync(new URL('../tests/mock.js', import.meta.url), 'utf8');
mkdirSync(`${OUT}/shots`, { recursive: true });

const server = spawn(process.execPath, ['tests/server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();

// nowa strona gry: atrapy, bez statystyk odwiedzin, polski, ograniczony ruch (zrzuty bez animacji)
async function newPage(viewport = DEVICES.tel) {
  const ctx = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h }, locale: 'pl-PL', reducedMotion: 'reduce', baseURL: BASE });
  await ctx.addInitScript(mock);
  await ctx.addInitScript((ui6) => { try { localStorage.setItem('songster.lang', '"pl"'); localStorage.setItem('songster.ui6', ui6 ? '1' : '0'); } catch { /* tryb prywatny */ } }, UI6);
  await ctx.route(/cloud\.umami\.is/, (r) => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  return page;
}

// obrazy PNG ułożone obok siebie w jeden WebP (w przeglądarce – canvas)
let composer = null;
async function compose(parts) {
  if (!composer) { composer = await (await browser.newContext()).newPage(); await composer.goto('about:blank'); }
  return composer.evaluate(async (list) => {
    const imgs = await Promise.all(list.map((p) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${p.b64}`; })));
    const gap = 40;
    const W = imgs.reduce((n, i) => n + i.width, 0) + gap * (imgs.length - 1);
    const H = Math.max(...imgs.map((i) => i.height));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0a10';
    g.fillRect(0, 0, W, H);
    let x = 0;
    const pos = [];
    for (const i of imgs) { g.drawImage(i, x, 0); pos.push({ x, y: 0, w: i.width, h: i.height }); x += i.width + gap; }
    return { data: c.toDataURL('image/webp', 0.82).split(',')[1], pos, W, H };
  }, parts);
}

const manifest = [];
const seen = new Set();
// zrzut bieżącego stanu na podanych urządzeniach (domyślnie wszystkie 4)
async function capture(page, meta, devices = DEVICES) {
  if (seen.has(meta.id)) throw new Error(`powtórzony id ${meta.id}`);
  seen.add(meta.id);
  if (ONLY && !meta.id.includes(ONLY) && !(meta.group || '').includes(ONLY)) return;
  const parts = [];
  const devs = {};
  for (const [id, d] of Object.entries(devices)) {
    await page.setViewportSize({ width: d.w, height: d.h });
    await page.waitForTimeout(250);
    // strona gry przewija się do góry przy zmianie ekranu – zrzut całej strony od góry
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('dialog[open], dialog[open] *').forEach((d) => { d.scrollTop = 0; }); });
    const buf = await page.screenshot({ fullPage: true, type: 'png', animations: 'disabled', caret: 'hide' });
    let b64 = buf.toString('base64');
    const full = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
    if (full > MAX_H) b64 = (await page.screenshot({ type: 'png', animations: 'disabled', clip: { x: 0, y: 0, width: d.w, height: MAX_H }, fullPage: true })).toString('base64');
    parts.push({ b64 });
    // bez przewijania: strona nie wystaje poza okno, a elementy nie ucinają treści (ui6Check w js/ui6.js)
    const fit = await page.evaluate(() => {
      if (typeof ui6Check === 'function') return ui6Check();
      const e = document.documentElement;
      return { scrollY: e.scrollHeight > innerHeight + 1, scrollX: e.scrollWidth > innerWidth + 1, clipped: [] };
    }).catch(() => null);
    devs[id] = { name: d.name, vw: d.w, vh: d.h, full, fit };
  }
  const img = await compose(parts);
  Object.keys(devs).forEach((k, i) => Object.assign(devs[k], img.pos[i]));
  const file = `shots/${meta.id}.webp`;
  writeFileSync(`${OUT}/${file}`, Buffer.from(img.data, 'base64'));
  manifest.push({ ...meta, file, W: img.W, H: img.H, devs, errors: page.errors.slice() });
  page.errors.length = 0;
  process.stdout.write(`✓ ${meta.id}\n`);
}

const ctx = { BASE, newPage, capture, DEVICES, TV_DEVICES, PHONE_DEVICES };
let failed = 0;
for (const sc of SCENARIOS) {
  if (ONLY && !(sc.id || '').includes(ONLY) && !(sc.group || '').includes(ONLY)) continue;
  const t0 = Date.now();
  try {
    await Promise.race([sc.run(ctx), new Promise((_, rej) => setTimeout(() => rej(new Error('przekroczony czas')), sc.timeout || 120000))]);
  } catch (e) {
    failed += 1;
    manifest.push({ id: `${sc.id}-blad`, group: sc.group, title: `${sc.title || sc.id} – błąd generowania`, desc: String(e && e.message || e).slice(0, 300), failed: true });
    process.stdout.write(`✘ ${sc.id}: ${e && e.message}\n`);
  }
  for (const c of browser.contexts()) if (c !== (composer && composer.context())) await c.close().catch(() => {});
  process.stdout.write(`  (${sc.id}: ${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ generated: new Date().toISOString(), devices: { ...DEVICES, ...TV_DEVICES }, screens: manifest }, null, 1));
console.log(`ekranów: ${manifest.filter((m) => !m.failed).length}, błędów: ${failed}`);
// zamknięcie przeglądarki potrafi zawisnąć (otwarte połączenia scenariuszy z dużym ekranem) – po 5 s kończymy i tak
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
server.kill();
process.exit(0);
