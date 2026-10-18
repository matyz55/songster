'use strict';
// Songster 6.0 – ustawienia gry jako krótki kreator: Gracze → Piosenki → Opcje trybu.
// Sekcje (.card) zostają tymi samymi elementami – setup.js dalej pokazuje i chowa ich części (data-for, data-hide-for, data-ctx).
// Kroki leżą obok siebie w pasku przesuwanym w bok (ukryte kroki nadal są „widoczne” dla podsumowania na dużym ekranie);
// treść kroku, która się nie mieści, przechodzi na kolejne strony (ui6Paginate).
// Na szerokim ekranie nie ma przechodzenia między krokami: kroki stoją obok siebie jako trzy (dwa) panele z nagłówkiem
// „1 Gracze · 2 Piosenki · 3 Opcje trybu”; każdy panel dostaje tyle kolumn, ile potrzebuje jego treść (Piosenki zwykle dwie),
// więc sekcje są pogrupowane tematycznie, a nie rozsypane po siatce jak formularz.
// „Graj od razu” (#btn-start) jest na każdym kroku. Działa tylko przy UI6.
if (UI6 && $('#screen-setup')) {
  const scr = $('#screen-setup');
  const cards = $$('#screen-setup > section.card');
  const [pl, songs, play, level, rules] = [$('#sec-players'), ...cards.filter((c) => c.id !== 'sec-players')];
  const STEPS = [
    { name: 'Gracze', icon: '👥', cards: [pl] },
    { name: 'Piosenki', icon: '🎵', cards: [songs, level] },
    { name: 'Opcje trybu', icon: '⚙️', cards: [play, rules] },
  ];
  const bar = el('nav', { class: 'ui6-ssteps', 'aria-label': T('Kroki') });
  const box = el('div', { class: 'ui6-pages ui6-sbox' });
  const track = el('div', { class: 'ui6-strack' });
  box.append(track);
  scr.insertBefore(bar, $('#setup-title').nextSibling);
  scr.insertBefore(box, bar.nextSibling);
  for (const s of STEPS) {
    s.el = el('section', { class: 'ui6-sstep', 'aria-label': T(s.name) });
    // nagłówek panelu (tylko na szerokim ekranie): numer i nazwa kroku
    s.head = el('h2', { class: 'ui6-shead' }, el('span', { class: 'ui6-snum' }, ''), el('span', { class: 'ui6-sicon', 'aria-hidden': 'true' }, s.icon), T(s.name));
    track.append(s.el);
    // pierwsza karta jest w kroku od razu – pudełko ze stronami wstawia się przed nią
    s.el.append(s.head, s.cards[0]);
    s.pager = ui6Paginate(s.el, s.cards, { cls: 'ui6-spages' });
    s.flow = s.pager.flow;
  }
  const opt = STEPS[2];
  const back = $('#btn-back');
  const start = $('#btn-start');
  const prevB = el('button', { type: 'button', class: 'ghost ui6-sprev', 'aria-label': T('← Wstecz'), onclick: () => step(cur - 1) }, T('← Wstecz'));
  const nextB = el('button', { type: 'button', class: 'ui6-snext', onclick: () => step(cur + 1) }, T('Dalej →'));
  back.after(prevB);
  start.before(nextB);
  let cur = 0;
  let live = STEPS;
  const offs = (s) => s.el.getBoundingClientRect().left - track.getBoundingClientRect().left;
  const wide = () => matchMedia('(min-width: 1000px) and (min-aspect-ratio: 4/3) and (min-height: 560px)').matches;
  // karty kroku w kolejności (jeden gracz – imię na początku „Opcji”)
  const stepCards = (s) => {
    if (s === STEPS[0]) return playCtx === 'multi' ? [pl] : [];
    if (s === opt) return playCtx === 'multi' ? s.cards : [pl, ...s.cards];
    return s.cards;
  };
  function place() {
    for (const s of STEPS) s.flow.append(...stepCards(s));
    // nagłówek sekcji taki sam jak nazwa kroku („Piosenki”) – chowamy, żeby nie było dwóch takich samych (CSS)
    for (const s of STEPS) for (const c of s.cards) {
      const h = c.querySelector(':scope > h2');
      if (h) h.classList.toggle('ui6-sdup', h.textContent.trim() === T(s.name));
    }
  }
  // kroki tego trybu: pomijamy kroki, w których wszystkie sekcje są ukryte
  function rebuild() {
    place();
    markEmpty();
    live = STEPS.filter((s) => s.flow.querySelector(':scope > .card:not(.hidden):not(.ui6-empty)'));
    STEPS.forEach((s) => s.el.classList.toggle('hidden', !live.includes(s)));
    live.forEach((s, i) => { s.head.firstChild.textContent = String(i + 1); });
    bar.replaceChildren(...live.map((s, i) => el('button', {
      type: 'button', class: 'ui6-sstep-b', 'aria-label': T(s.name), onclick: () => step(i),
    }, el('span', { class: 'ui6-snum' }, String(i + 1)), el('span', { class: 'ui6-sname' }, T(s.name)))));
    scr.classList.toggle('ui6-one', live.length < 2);
    cur = 0;
    paint(false);
  }
  // sekcja, w której w tym trybie nic nie zostało (np. „Odtwarzanie” w Licytacji sekund), znika razem z nagłówkiem
  function markEmpty() {
    for (const c of cards) {
      c.classList.remove('ui6-empty');
      const any = [...c.children].some((x) => x.tagName !== 'H2' && !x.classList.contains('hidden') && getComputedStyle(x).display !== 'none'
        && (x.id !== 'audio-out-box' || !x.classList.contains('hidden')));
      c.classList.toggle('ui6-empty', !any);
    }
  }
  // szeroki ekran: podział kolumn między panele – sprawdzamy możliwe podziały i wybieramy ten, przy którym
  // nic nie przechodzi na drugą stronę, potem ten z najmniejszą liczbą pustych kolumn, potem ten z większą liczbą kolumn
  function sizeWide() {
    const W = track.clientWidth;
    if (!W || !live.length) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const colw = rem * 16;
    const cgap = parseFloat(getComputedStyle(live[0].flow).columnGap) || gap;
    const padOf = (s) => { const cs = getComputedStyle(s.el); return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); };
    const pad = live.reduce((n, s) => n + padOf(s), 0);
    const n = live.length;
    const C = Math.max(n, Math.min(9, Math.floor((W - gap * (n - 1) - pad + cgap * n) / (colw + cgap))));
    const apply = (cols) => live.forEach((s, i) => {
      s.flow.style.columnWidth = 'auto';
      s.flow.style.columnCount = String(cols[i]);
      s.el.style.flexGrow = String(cols[i]);
      // bardzo szeroki ekran: kolumna nie szersza niż ok. 1,8 zwykłej (panele stoją na środku zamiast się rozciągać)
      s.el.style.maxWidth = `${cols[i] * (colw * 1.8 + cgap) - cgap + padOf(s) + 2}px`;
    });
    // ocena podziału: strony ponad pierwszą i puste kolumny w każdym panelu
    const judge = (cols) => {
      apply(cols);
      let over = 0; let empty = 0;
      live.forEach((s, i) => {
        const f = s.flow;
        const bw = s.pager.box.clientWidth;
        const cw = (bw - cgap * (cols[i] - 1)) / cols[i];
        const pages = Math.max(1, Math.ceil((f.scrollWidth + cgap) / (bw + cgap) - 0.05));
        over += pages - 1;
        if (pages === 1) {
          const kids = [...f.children].filter((k) => k.offsetParent && k.getClientRects().length);
          const left = f.getBoundingClientRect().left;
          const right = kids.reduce((m, k) => Math.max(m, ...[...k.getClientRects()].map((r) => r.right)), left);
          empty += cols[i] - Math.max(1, Math.round((right - left + cgap) / (cw + cgap)));
        }
      });
      return over * 1000 + empty * 10 - cols.reduce((a, b) => a + b, 0);
    };
    // wszystkie podziały co najwyżej C kolumn na n paneli (każdy panel co najmniej jedna kolumna)
    const splits = [];
    const walk = (pre, rest, k) => {
      if (k === 1) { for (let c = 1; c <= rest; c++) splits.push([...pre, c]); return; }
      for (let c = 1; c <= rest - (k - 1); c++) walk([...pre, c], rest - c, k - 1);
    };
    walk([], C, n);
    let best = null;
    for (const cols of splits) {
      const sc = judge(cols);
      if (!best || sc < best.sc) best = { cols, sc };
    }
    apply(best.cols);
    for (const s of live) s.pager.update();
  }
  function unsizeWide() {
    for (const s of STEPS) { s.flow.style.columnCount = ''; s.flow.style.columnWidth = ''; s.el.style.flexGrow = ''; s.el.style.maxWidth = ''; }
  }
  // zmiana opcji może wydłużyć albo skrócić sekcje (pokazane pola, liczby piosenek) – liczymy strony od nowa
  const recount = () => { markEmpty(); if (wide()) sizeWide(); else for (const s of live) s.pager.update(); };
  scr.addEventListener('change', () => requestAnimationFrame(recount));
  scr.addEventListener('click', () => requestAnimationFrame(recount));
  function step(n) {
    cur = Math.max(0, Math.min(live.length - 1, n));
    paint(true);
  }
  function paint(smooth) {
    const w = wide();
    const was = scr.classList.contains('ui6-swide');
    scr.classList.toggle('ui6-swide', w);
    if (was && !w) unsizeWide();
    [...bar.children].forEach((b, i) => { b.classList.toggle('on', w || i === cur); b.classList.toggle('done', !w && i < cur); b.setAttribute('aria-current', String(i === cur)); });
    const last = w || cur >= live.length - 1;
    back.classList.toggle('hidden', !w && cur > 0);
    prevB.classList.toggle('hidden', w || cur === 0);
    nextB.classList.toggle('hidden', last);
    start.textContent = last ? T('Zaczynamy!') : T('▶ Graj od razu');
    start.classList.toggle('ui6-sshort', !last);
    // niski ekran (telefon poziomo): paski stron kroków w pasku akcji – widać tylko pasek bieżącego kroku
    const low = !w && innerHeight < 500;
    STEPS.forEach((s) => {
      const nav = s.pager.nav;
      if (low) { if (nav.parentElement !== start.parentElement) nextB.before(nav); } else if (nav.parentElement !== s.el) s.el.append(nav);
      nav.classList.toggle('ui6-cur', !w && s === live[cur]);
    });
    if (w) { box.scrollLeft = 0; sizeWide(); return; }
    const target = live[cur];
    if (!target) return;
    box.scrollTo({ left: offs(target), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
  }
  // przeglądarka sama przesuwa pasek, gdy fokus (Tab) trafi do innego kroku – zaznaczamy ten krok
  box.addEventListener('scroll', () => {
    if (scr.classList.contains('ui6-swide')) { if (box.scrollLeft) box.scrollLeft = 0; return; }
    const i = live.findIndex((s) => Math.abs(offs(s) - box.scrollLeft) < box.clientWidth / 2);
    if (i >= 0 && i !== cur) { cur = i; paint(false); }
  }, { passive: true });
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => paint(false)); }).observe(scr);
  const orig = openSetup;
  openSetup = function ui6OpenSetup(...a) {
    const r = orig.apply(this, a);
    rebuild();
    requestAnimationFrame(recount);
    setTimeout(recount, 400);
    return r;
  };
  // dla narzędzia zrzutów i testów: przejście do kroku n (od 1); zwraca liczbę kroków (na szerokim ekranie widać wszystko naraz)
  window.ui6SetupStep = (n) => {
    step((n || 1) - 1);
    if (!scr.classList.contains('ui6-swide')) box.scrollLeft = offs(live[cur]);
    return live.length;
  };
}
