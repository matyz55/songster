'use strict';
// Songster – nowy wygląd 6.0 (wersja próbna, włączana w ustawieniach albo adresem ?ui=6).
// Zasada: każdy ekran ma dokładnie wysokość i szerokość okna – bez przewijania strony. Treść, która się nie mieści,
// układa się w kolumny i strony („1/3”) przełączane strzałkami, kropkami, zakładkami albo przesunięciem palcem.
// Cały wygląd jest w plikach ui6/*.css (reguły zaczynają się od html.ui6), więc bez przełącznika gra wygląda jak dotąd.
const UI6 = document.documentElement.classList.contains('ui6');
function setUi6(on) {
  try { localStorage.setItem('songster.ui6', on ? '1' : '0'); } catch (e) { /* tryb prywatny */ }
  location.reload();
}

/* ---------- strony: treść w kolumnach o stałej wysokości, przewijana całymi stronami ---------- */
// box – element o stałej wysokości (overflow: hidden), flow – jego jedyne dziecko z kolumnami (column-width);
// kolumny, które się nie mieszczą, wypływają w bok – jedna strona to szerokość pudełka + odstęp między kolumnami
const ui6Pagers = new Set();
function ui6Pager(box, opts = {}) {
  if (!UI6 || !box || box.ui6pager) return box && box.ui6pager;
  const flow = box.firstElementChild;
  const nav = el('nav', { class: 'ui6-nav', 'aria-label': T('Strony') });
  const tabs = el('div', { class: 'ui6-tabs', role: 'tablist' });
  const prev = el('button', { type: 'button', class: 'ghost ui6-prev', 'aria-label': T('Poprzednia strona') }, '‹');
  const next = el('button', { type: 'button', class: 'ghost ui6-next', 'aria-label': T('Następna strona') }, '›');
  const count = el('span', { class: 'ui6-count' });
  nav.append(prev, tabs, count, next);
  (opts.navHost || box.parentElement).insertBefore(nav, opts.navBefore || box.nextSibling);
  const p = { box, flow, nav, page: 0, pages: 1, opts };
  box.ui6pager = p;
  ui6Pagers.add(p);
  const gap = () => parseFloat(getComputedStyle(flow).columnGap) || 0;
  const step = () => box.clientWidth + gap();
  p.go = (n, smooth = true) => {
    p.page = Math.max(0, Math.min(p.pages - 1, n));
    box.scrollTo({ left: p.page * step(), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
    paint();
  };
  // nagłówki sekcji jako zakładki: zakładka prowadzi do strony, na której zaczyna się sekcja
  const heads = () => (opts.tabs ? [...flow.querySelectorAll(opts.tabs)].filter((h) => h.offsetParent) : []);
  const pageOf = (e) => Math.round((e.getBoundingClientRect().left - flow.getBoundingClientRect().left) / step());
  function paint() {
    nav.classList.toggle('hidden', p.pages < 2);
    prev.disabled = p.page === 0;
    next.disabled = p.page >= p.pages - 1;
    count.textContent = `${p.page + 1}/${p.pages}`;
    const hs = heads();
    let active = -1;
    hs.forEach((h, i) => { if (pageOf(h) <= p.page) active = i; });
    if (hs.length > 1) {
      tabs.replaceChildren(...hs.map((h, i) => el('button', {
        type: 'button', role: 'tab', class: `ui6-tab${i === active ? ' on' : ''}`, 'aria-selected': String(i === active),
        onclick: () => p.go(pageOf(h)),
      }, (h.dataset.tab || h.textContent).trim())));
      count.classList.add('hidden');
    } else {
      // bez zakładek – kropki stron
      tabs.replaceChildren(...Array.from({ length: p.pages }, (_, i) => el('button', {
        type: 'button', class: `ui6-dot${i === p.page ? ' on' : ''}`, 'aria-label': T('Strona {0}', i + 1), onclick: () => p.go(i),
      })));
      count.classList.toggle('hidden', p.pages < 6);
      tabs.classList.toggle('hidden', p.pages >= 6);
    }
  }
  p.update = () => {
    if (!box.offsetParent) return;
    const s = step();
    // ostatnia strona może mieć tylko część kolumn – zaokrąglamy w górę (z małym zapasem na ułamki pikseli)
    p.pages = Math.max(1, Math.ceil((flow.scrollWidth + gap()) / s - 0.05));
    // zawartość mogła się skrócić – nie zostajemy na pustej stronie
    if (p.page > p.pages - 1) p.page = p.pages - 1;
    box.scrollLeft = p.page * s;
    paint();
  };
  prev.addEventListener('click', () => p.go(p.page - 1));
  next.addEventListener('click', () => p.go(p.page + 1));
  // pole z fokusem na innej stronie (Tab, podpowiedzi) – przeglądarka sama przesuwa pudełko; zapamiętujemy stronę
  box.addEventListener('scroll', () => {
    const n = Math.round(box.scrollLeft / step());
    if (n !== p.page) { p.page = n; paint(); }
  }, { passive: true });
  // przesunięcie palcem w bok – zmiana strony (pionowe ruchy zostają dla suwaków i list)
  let sx = null; let sy = 0;
  box.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx; const dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && !e.target.closest('input[type=range], .timeline')) p.go(p.page + (dx < 0 ? 1 : -1));
  }, { passive: true });
  let raf = 0;
  const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(p.update); };
  new ResizeObserver(later).observe(box);
  new MutationObserver(later).observe(flow, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'hidden'] });
  later();
  return p;
}
// strzałki klawiatury zmieniają stronę widocznego pudełka (poza polami tekstowymi)
document.addEventListener('keydown', (e) => {
  if (!UI6 || !['PageDown', 'PageUp'].includes(e.key)) return;
  for (const p of ui6Pagers) if (p.box.offsetParent && p.pages > 1) { p.go(p.page + (e.key === 'PageDown' ? 1 : -1)); e.preventDefault(); return; }
});

// opakowanie dzieci elementu w pudełko ze stronami (sekcje ekranu zostają tymi samymi elementami – działają jak dotąd)
function ui6Paginate(host, children, opts = {}) {
  if (!UI6 || !host) return null;
  const box = el('div', { class: `ui6-pages ${opts.cls || ''}`.trim() });
  const flow = el('div', { class: 'ui6-flow' });
  box.append(flow);
  const first = children[0];
  host.insertBefore(box, first);
  flow.append(...children);
  return ui6Pager(box, opts);
}

/* ---------- klawiatura ekranowa: mniej miejsca – ekran gry przechodzi w „tryb pisania” ---------- */
if (UI6 && window.visualViewport) {
  const kb = () => {
    const open = window.visualViewport.height < window.innerHeight * 0.75 && document.activeElement && document.activeElement.matches('input[type=text], input[type=number], input[type=search], textarea');
    document.documentElement.classList.toggle('kbd', !!open);
    document.documentElement.style.setProperty('--vvh', `${window.visualViewport.height}px`);
  };
  window.visualViewport.addEventListener('resize', kb);
  document.addEventListener('focusin', kb);
  document.addEventListener('focusout', () => setTimeout(kb, 50));
}

/* ---------- kontrola „bez przewijania” (narzędzie zrzutów i testy) ---------- */
// zwraca, czy strona się przewija, i elementy, których treść jest ucięta (wystaje poza ich pole)
function ui6Check() {
  const d = document.documentElement;
  const out = { scrollY: d.scrollHeight > innerHeight + 1, scrollX: d.scrollWidth > innerWidth + 1, clipped: [] };
  const root = $$('.screen').find((s) => !s.classList.contains('hidden')) || document.body;
  const scope = [root, ...root.querySelectorAll('*'), ...$$('dialog[open]'), ...$$('dialog[open] *')];
  for (const e of scope) {
    if (!e.offsetParent || e.closest('.ui6-pages')) continue;
    // długa oś czasu (więcej niż 10 kart) może przewijać się sama – oznacza ją atrybut data-ui6-scroll (ustawia skrypt osi);
    // oś do 10 kart musi być widoczna w całości
    if (e.closest('[data-ui6-scroll]')) { out.scrollOk = (out.scrollOk || 0) + 1; continue; }
    const cs = getComputedStyle(e);
    if (!/(hidden|clip|auto|scroll)/.test(cs.overflowY + cs.overflowX)) continue;
    if (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2) {
      out.clipped.push(e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`);
    }
  }
  return out;
}

/* ---------- przełącznik w ustawieniach ---------- */
if ($('#ui6-toggle')) {
  $('#ui6-toggle').checked = UI6;
  $('#ui6-toggle').addEventListener('change', (e) => setUi6(e.target.checked));
}
