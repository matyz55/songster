'use strict';
// Songster 6.0 – ustawienia gry jako krótki kreator: Gracze → Piosenki → Opcje trybu.
// Sekcje (.card) zostają tymi samymi elementami – setup.js dalej pokazuje i chowa ich części (data-for, data-hide-for, data-ctx).
// Kroki leżą obok siebie w pasku przesuwanym w bok (ukryte kroki nadal są „widoczne” dla podsumowania na dużym ekranie);
// treść kroku, która się nie mieści, przechodzi na kolejne strony (ui6Paginate).
// Na szerokim ekranie nie ma kroków: wszystkie sekcje płyną po kolei w kolumnach na całą szerokość (jedno pudełko ze stronami),
// więc kolumny wypełniają się równo, a kropki stron pojawiają się dopiero, gdy naprawdę brakuje miejsca.
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
    track.append(s.el);
    // pierwsza karta jest w kroku od razu – pudełko ze stronami wstawia się przed nią
    s.el.append(s.cards[0]);
    s.pager = ui6Paginate(s.el, s.cards, { cls: 'ui6-spages' });
    s.flow = s.pager.flow;
  }
  const opt = STEPS[2];
  const back = $('#btn-back');
  const start = $('#btn-start');
  // szeroki ekran: jedno pudełko na wszystkie sekcje, pasek jego stron w wierszu przycisków
  const wbox = el('div', { class: 'ui6-pages ui6-spages ui6-swbox' });
  const wflow = el('div', { class: 'ui6-flow' });
  wbox.append(wflow);
  scr.insertBefore(wbox, box);
  const wpager = ui6Pager(wbox, { navHost: back.parentElement, navBefore: back });
  wpager.nav.classList.add('ui6-swnav');
  const prevB = el('button', { type: 'button', class: 'ghost ui6-sprev', 'aria-label': T('← Wstecz'), onclick: () => step(cur - 1) }, T('← Wstecz'));
  const nextB = el('button', { type: 'button', class: 'ui6-snext', onclick: () => step(cur + 1) }, T('Dalej →'));
  back.after(prevB);
  start.before(nextB);
  let cur = 0;
  let jumpUntil = 0; // do kiedy trwa płynne przesunięcie do wybranego kroku
  let live = STEPS;
  let inWide = false;
  const offs = (s) => s.el.getBoundingClientRect().left - track.getBoundingClientRect().left;
  const wide = () => matchMedia('(min-width: 1000px) and (min-aspect-ratio: 4/3) and (min-height: 560px)').matches;
  // karty kroku w kolejności (jeden gracz – imię na początku „Opcji”)
  const stepCards = (s) => {
    if (s === STEPS[0]) return playCtx === 'multi' ? [pl] : [];
    if (s === opt) return playCtx === 'multi' ? s.cards : [pl, ...s.cards];
    return s.cards;
  };
  // sekcje na swoje miejsca: w krokach albo wszystkie po kolei w jednym pudełku (szeroki ekran)
  function place(w) {
    inWide = w;
    for (const s of STEPS) {
      const list = stepCards(s);
      const host = w ? wflow : s.flow;
      host.append(...list);
    }
    // na wąskim: nagłówek sekcji taki sam jak nazwa kroku w pasku („Piosenki”) – chowamy, żeby nie było dwóch takich samych
    for (const s of STEPS) for (const c of s.cards) {
      const h = c.querySelector(':scope > h2');
      if (h) h.classList.toggle('ui6-sdup', !w && h.textContent.trim() === T(s.name));
    }
  }
  // kroki tego trybu: pomijamy kroki, w których wszystkie sekcje są ukryte
  function rebuild() {
    place(false);
    markEmpty();
    live = STEPS.filter((s) => s.flow.querySelector(':scope > .card:not(.hidden):not(.ui6-empty)'));
    STEPS.forEach((s) => s.el.classList.toggle('hidden', !live.includes(s)));
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
  // zmiana opcji może wydłużyć albo skrócić sekcje (pokazane pola, liczby piosenek) – liczymy strony od nowa
  const recount = () => { markEmpty(); if (inWide) wpager.update(); else for (const s of live) s.pager.update(); };
  scr.addEventListener('change', () => requestAnimationFrame(recount));
  scr.addEventListener('click', () => requestAnimationFrame(recount));
  function step(n) {
    cur = Math.max(0, Math.min(live.length - 1, n));
    paint(true);
  }
  function paint(smooth) {
    const w = wide();
    scr.classList.toggle('ui6-swide', w);
    if (w !== inWide) place(w);
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
    if (w) { wpager.update(); return; }
    const target = live[cur];
    if (!target) return;
    const anim = smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // płynne przesunięcie: zdarzenia przewijania w trakcie ruchu nie mogą „cofnąć” wybranego kroku
    jumpUntil = anim ? Date.now() + 900 : 0;
    box.scrollTo({ left: offs(target), behavior: anim ? 'smooth' : 'auto' });
  }
  // przeglądarka sama przesuwa pasek, gdy fokus (Tab) trafi do innego kroku – zaznaczamy ten krok
  box.addEventListener('scrollend', () => { jumpUntil = 0; });
  box.addEventListener('scroll', () => {
    if (inWide || Date.now() < jumpUntil) return;
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
    if (!inWide) box.scrollLeft = offs(live[cur]);
    return live.length;
  };
}
