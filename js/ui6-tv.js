'use strict';
// Songster 6.0 – duży ekran i telefon gracza (tv.html). Działa tylko przy html.ui6 (przełącznik w <head> tv.html).
// tv.html nie ładuje js/ui6.js, więc tutaj jest własna kontrola „bez przewijania” (ui6Check) i przebudowy widoku telefonu:
// • głosowanie na tryb – kafelki na całą wysokość, podzielone na strony (‹ ›, kropki, przesunięcie palcem),
// • rozgrywka – stałe strefy: pasek wyników, karta tury, panel osi z zakładkami (twoja oś / gracz z turą / pozostali);
//   oś do 10 kart widać w całości (przy ciasnym miejscu karty w jednej linii), dłuższa przewija się sama (tylko oś),
// • pozostałe ekrany (dołączanie, lobby, ustawienia, wyniki) – jedna karta; gdy treść się nie mieści – strony.
// Elementy z tv.js są przenoszone (nie kopiowane), więc wszystkie przyciski działają jak dotąd. Logika gry bez zmian.
const UI6 = document.documentElement.classList.contains('ui6');

/* ---------- kontrola „bez przewijania” (ten sam wynik co ui6Check w js/ui6.js) ---------- */
// pomijamy pudełka stron (.u6-pages – treść celowo przesuwana w bok) i celowe skróty tekstu (wielokropek, line-clamp)
function ui6Check() {
  const d = document.documentElement;
  const out = { scrollY: d.scrollHeight > innerHeight + 1, scrollX: d.scrollWidth > innerWidth + 1, clipped: [] };
  for (const e of document.body.querySelectorAll('*')) {
    if (!e.offsetParent || e.closest('.u6-pages')) continue;
    // długa oś (więcej niż 10 kart) przewija się sama – oznacza ją data-ui6-scroll; oś do 10 kart musi mieścić się w całości
    if (e.closest('[data-ui6-scroll]')) { out.scrollOk = (out.scrollOk || 0) + 1; continue; }
    const cs = getComputedStyle(e);
    if (!/(hidden|clip|auto|scroll)/.test(cs.overflowY + cs.overflowX)) continue;
    if (cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) continue;
    if (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2) {
      out.clipped.push(e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`);
    }
  }
  return out;
}

if (UI6) {
  const u6 = { tab: '', tabKey: '', other: '', votePage: null, focus: {}, flowPage: 0, flowKey: '' };
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const overflows = (n) => n.scrollHeight > n.clientHeight + 1;

  /* ---------- przesunięcie palcem w bok ---------- */
  function swipe(node, fn) {
    let sx = null; let sy = 0;
    node.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    node.addEventListener('touchend', (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx; const dy = e.changedTouches[0].clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) fn(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  // pasek stron: ‹ kropki (albo „2/5”) ›
  function pageNav(pages, page, go) {
    const nav = mk('nav', 'u6-nav');
    nav.setAttribute('aria-label', T('Strony'));
    const prev = mk('button', 'u6-prev', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', T('Poprzednia strona'));
    const next = mk('button', 'u6-next', '›'); next.type = 'button'; next.setAttribute('aria-label', T('Następna strona'));
    prev.disabled = page <= 0; next.disabled = page >= pages - 1;
    prev.addEventListener('click', () => go(page - 1));
    next.addEventListener('click', () => go(page + 1));
    let mid;
    if (pages <= 6) {
      mid = mk('div', 'u6-dots');
      for (let i = 0; i < pages; i++) mid.append(mk('span', 'u6-dot' + (i === page ? ' on' : '')));
    } else mid = mk('span', 'u6-count', `${page + 1}/${pages}`);
    nav.append(prev, mid, next);
    nav.classList.toggle('hidden', pages < 2);
    return nav;
  }

  /* ---------- głosowanie na tryb: kafelki w siatce dopasowanej do okna, reszta na kolejnych stronach ---------- */
  function layoutVote(view) {
    const list = view.querySelector('.vote-list');
    const items = [...list.children];
    const old = view.querySelector(':scope > .u6-nav');
    if (old) old.remove();
    items.forEach((it) => it.classList.remove('u6-off'));
    const gap = 8;
    const navH = 46;
    const W = list.clientWidth;
    const cols = Math.max(1, Math.min(4, Math.floor((W + gap) / (150 + gap))));
    const rowsFor = (H) => Math.max(1, Math.floor((H + gap) / (58 + gap)));
    let rows = rowsFor(list.clientHeight);
    if (Math.ceil(items.length / (cols * rows)) > 1) rows = rowsFor(list.clientHeight - navH);
    const per = cols * rows;
    const pages = Math.max(1, Math.ceil(items.length / per));
    if (u6.votePage == null) {
      const mine = items.findIndex((it) => it.classList.contains('mine'));
      u6.votePage = mine >= 0 ? Math.floor(mine / per) : 0;
    }
    const page = Math.max(0, Math.min(pages - 1, u6.votePage));
    u6.votePage = page;
    list.style.setProperty('--cols', cols);
    list.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    const rowH = (list.clientHeight - (pages > 1 ? navH : 0) - gap * (rows - 1)) / rows;
    list.classList.toggle('roomy', rowH >= 92);
    items.forEach((it, i) => it.classList.toggle('u6-off', Math.floor(i / per) !== page));
    const go = (n) => { u6.votePage = Math.max(0, Math.min(pages - 1, n)); layoutVote(view); };
    view.append(pageNav(pages, page, go));
    if (!list.u6swipe) { list.u6swipe = true; swipe(list, (d) => go(u6.votePage + d)); }
  }

  /* ---------- karta (dołączanie, lobby, ustawienia, wyniki, Tak to leciało!): gdy się nie mieści – strony ---------- */
  function layoutCard(card) {
    let box = card.querySelector(':scope > .u6-pages');
    if (!box) {
      if (!overflows(card) && app.scrollHeight <= app.clientHeight + 1) return;
      // nagłówek (tytuł, pasek gracza) zostaje na górze, reszta płynie w kolumnach o szerokości karty
      const keep = [...card.children].filter((n, i) => (i === 0 && /^H[23]$/.test(n.tagName)) || n.matches('.p-top'));
      const flow = mk('div', 'u6-flow');
      flow.append(...[...card.children].filter((n) => !keep.includes(n)));
      box = mk('div', 'u6-pages');
      box.append(flow);
      card.append(box, pageNav(2, 0, () => {}));
      card.classList.add('u6-paged');
      flow.u6paged = true;
      swipe(box, (d) => { u6.flowPage += d; layoutCard(card); });
    }
    const flow = box.firstElementChild;
    const key = card.textContent.slice(0, 80);
    if (key !== u6.flowKey) { u6.flowKey = key; u6.flowPage = 0; }
    // mierzymy na całej wysokości okna; gdy wszystko mieści się na jednej stronie – karta wraca do swojej wysokości
    card.classList.add('u6-fill');
    flow.style.height = '100%';
    const gap = parseFloat(getComputedStyle(flow).columnGap) || 0;
    const two = box.clientWidth > 520;
    flow.style.columnWidth = `${two ? (box.clientWidth - gap) / 2 - 1 : box.clientWidth}px`;
    const step = box.clientWidth + gap;
    const n = Math.max(1, Math.round((flow.scrollWidth + gap) / step));
    if (n === 1) { card.classList.remove('u6-fill'); flow.style.height = 'auto'; }
    u6.flowPage = Math.max(0, Math.min(n - 1, u6.flowPage));
    card.querySelector(':scope > .u6-nav').replaceWith(pageNav(n, u6.flowPage, (k) => { u6.flowPage = k; layoutCard(card); }));
    box.scrollLeft = u6.flowPage * step;
  }

  /* ---------- oś na telefonie: do 10 kart w całości, dłuższa przewija się sama (tylko oś, nigdy strona) ---------- */
  // Wysokość kart i miejsc „＋” liczona z wolnego miejsca: najpierw karty dwulinijkowe (tytuł / wykonawca),
  // przy ciasnym miejscu – jedna linia „rok · tytuł – wykonawca” i cienkie „＋”, a na szerokim panelu dwie kolumny.
  const LONG = 10;
  function fitAxis(vtl, key) {
    const rows = [...vtl.children].filter((n) => n.matches('.vrow'));
    const slots = [...vtl.children].filter((n) => n.matches('.vslot'));
    const cards = rows.filter((n) => n.matches('.vcard')).length;
    const long = cards > LONG;
    vtl.classList.add('u6-fit');
    vtl.classList.remove('u6-c1', 'u6-two', 'u6-short', 'u6-long', 'u6-nohint', 'u6-thin', 'u6-hair');
    vtl.toggleAttribute('data-ui6-scroll', long);
    vtl.classList.toggle('u6-long', long);
    const set = (rh, sh, g, cls) => {
      vtl.style.setProperty('--rh', `${Math.floor(rh)}px`);
      vtl.style.setProperty('--sh', `${Math.floor(sh)}px`);
      vtl.style.setProperty('--g', `${g}px`);
      cls.forEach((c) => vtl.classList.add(c));
      if (sh < 30) vtl.classList.add('u6-thin');
      if (sh < 16) vtl.classList.add('u6-hair');
    };
    const nr = rows.length; const ns = slots.length;
    if (!nr && !ns) return { ok: true };
    const H = vtl.clientHeight;
    const W = vtl.clientWidth;
    const hOf = (sel) => [...vtl.children].filter((n) => n.matches(sel)).reduce((a, n) => a + n.offsetHeight, 0);
    const titleH = hOf('.vtl-title');
    const hintH = hOf('.vtl-hint');
    const nFix = [...vtl.children].filter((n) => n.matches('.vtl-title, .vtl-hint')).length;
    let res = { ok: true };
    if (long) {
      // długa oś: wygodne, jednakowe karty; przewijana jest tylko sama oś
      set(38, ns ? 26 : 0, 4, ['u6-c1']);
      res = { ok: H >= 6 * 42, long: true };
    } else {
      // miejsce na karty i „＋” przy danym odstępie (g), z napisami „starsze/nowsze” albo bez nich
      const avail = (g, hints, cols = 1) => {
        const items = Math.ceil((nr + ns + (hints ? nFix : titleH ? 1 : 0)) / cols);
        return H - (hints ? titleH + hintH : titleH) / (cols > 1 ? 2 : 1) - g * Math.max(0, items - 1);
      };
      const per = (k, cols) => Math.ceil(k / cols);
      const dist = (room, r, s, r0, s0, rMax, sMax, sFirst) => {
        // ile dorzucić kartom i miejscom „＋” ponad minimum (najpierw cele dotyku albo najpierw karty)
        let extra = room - (r * r0 + s * s0);
        if (extra < 0) return null;
        let rh = r0; let sh = s0;
        const grow = (which) => {
          if (which === 's' && s) { const d = Math.min(sMax - sh, extra / s); sh += d; extra -= d * s; }
          if (which === 'r' && r) { const d = Math.min(rMax - rh, extra / r); rh += d; extra -= d * r; }
        };
        (sFirst ? ['s', 'r'] : ['r', 's']).forEach(grow);
        return { rh, sh, left: extra };
      };
      const tries = [
        // dwie linijki, „＋” pełnej wielkości gdy jest miejsce
        () => { const g = ns ? 2 : 4; const d = dist(avail(g, true), nr, ns, 44, 18, 62, 46, true); return d && { d, g, cls: [] }; },
        // jedna linijka, cienkie „＋”
        () => { const g = ns ? 0 : 3; const d = dist(avail(g, true), nr, ns, 28, 10, 40, 26, false); return d && { d, g, cls: ['u6-c1'] }; },
        // dwie kolumny (szeroki panel – np. telefon poziomo): najpierw karty dwulinijkowe, potem w jednej linii
        () => {
          if (W < 330) return null;
          const g = ns ? 0 : 3;
          const d = dist(avail(g, false, 2) - 4, per(nr, 2), per(ns, 2), 40, 10, 50, 30, false);
          return d && { d, g, cls: ['u6-two', 'u6-nohint'] };
        },
        () => {
          if (W < 330) return null;
          const g = ns ? 0 : 3;
          const d = dist(avail(g, false, 2) - 4, per(nr, 2), per(ns, 2), 26, 10, 46, 30, false);
          return d && { d, g, cls: ['u6-c1', 'u6-two', 'u6-nohint'] };
        },
        // bez napisów „starsze/nowsze”, najmniejsze odstępy
        () => { const g = ns ? 0 : 2; const d = dist(avail(g, false), nr, ns, 24, 8, 40, 20, false); return d && { d, g, cls: ['u6-c1', 'u6-nohint'] }; },
      ];
      let pick = null;
      for (const t of tries) { pick = t(); if (pick) break; }
      if (!pick) { pick = { d: { rh: 22, sh: 8, left: 0 }, g: 2, cls: ['u6-c1', 'u6-nohint'] }; res.ok = false; }
      set(pick.d.rh, pick.d.sh, pick.g, pick.cls);
      if (pick.cls.length === 0 && pick.d.left > 24) { vtl.classList.add('u6-short'); res.short = true; }
      // za drobno: karty niższe niż 28 px albo podpisane „＋ Wcześniej / ＋ Później” ściśnięte do kreski
      res.poor = pick.d.rh < 28 || (!!vtl.querySelector(':scope > .vslot.labeled') && pick.d.sh < 34);
    }
    // wybrane miejsce / nowa karta / znacznik – zawsze widoczne (przewijamy oś do niego)
    if (long) {
      const f = vtl.querySelector(':scope > .vmys, :scope > .vmark, :scope > .vslot.chosen, :scope > .vnew');
      const all = [...vtl.children];
      const sig = f ? `${all.length}:${all.indexOf(f)}` : '';
      const saved = u6.focus[key];
      if (saved) vtl.scrollTop = saved.top;
      // nowe miejsce / nowa karta albo poza widokiem – na środek osi
      const out = f && (f.offsetTop < vtl.scrollTop || f.offsetTop + f.offsetHeight > vtl.scrollTop + vtl.clientHeight);
      if (f && (!saved || saved.sig !== sig || out)) vtl.scrollTop = f.offsetTop - (vtl.clientHeight - f.offsetHeight) / 2;
      u6.focus[key] = { sig, top: vtl.scrollTop };
      vtl.onscroll = () => { u6.focus[key] = { sig, top: vtl.scrollTop }; };
    }
    return res;
  }

  /* ---------- żetony „🪙 3” i stan gracza „1/10 kart · 🪙 2” – krótko, w osobnych kawałkach ---------- */
  const COIN = /🪙\s*\d+/;
  // „1/10 kart · 🪙 2” → [„1/10”, „🪙 2”]; inny tekst (np. „3 pkt”) zostaje bez zmian
  function statParts(text) {
    const frac = text.match(/\d+\s*\/\s*\d+/);
    const coin = text.match(COIN);
    if (!frac && !coin) return [text.trim()];
    return [frac ? frac[0].replace(/\s+/g, '') : '', coin ? coin[0].replace(/\s+/, ' ') : ''].filter(Boolean);
  }
  const coinEl = (t) => mk('span', 'u6-coin', t);
  // ułamek „1/10”: mianownik w osobnym kawałku – w wąskich kafelkach chowany (cel jest ten sam dla wszystkich)
  const statEl = (p) => {
    const m = p.match(/^(\d+)(\/\d+)$/);
    if (!m) return mk('span', 'u6-stat', p);
    const n = mk('span', 'u6-stat', m[1]);
    n.append(mk('span', 'u6-den', m[2]));
    return n;
  };
  const statEls = (text) => statParts(text).map((p) => (COIN.test(p) ? coinEl(p) : statEl(p)));
  // pasek wyników na telefonie: kafelki „imię / 1/10 · 🪙 2” w siatce na całą szerokość (bez przewijania w bok)
  function scoreChips(board) {
    if (!board || board.u6) return;
    board.u6 = true;
    for (const sp of [...board.children]) {
      const t = sp.textContent;
      const k = t.indexOf(': ');
      const name = k > 0 ? t.slice(0, k) : t;
      const rest = k > 0 ? t.slice(k + 2) : '';
      sp.title = t;
      sp.replaceChildren(mk('b', '', name));
      if (rest) { const sm = mk('small', ''); sm.append(...statEls(rest)); sp.append(sm); }
    }
    board.classList.add('u6-chips');
  }
  // duży ekran: ten sam tekst, ale liczba kart pogrubiona, a żetony jako złota ikonka z liczbą
  function markStats(node) {
    if (!node || node.u6 || node.children.length) return;
    const t = node.textContent;
    const re = /(\d+\s*\/\s*\d+)|(🪙\s*\d+)/g;
    const out = [];
    let at = 0; let m;
    while ((m = re.exec(t))) {
      if (m.index > at) out.push(t.slice(at, m.index));
      out.push(m[1] ? mk('b', 'u6-stat', m[1].replace(/\s+/g, '')) : coinEl(m[2].replace(/\s+/, ' ')));
      at = m.index + m[0].length;
    }
    if (!out.length) return;
    if (at < t.length) out.push(t.slice(at));
    node.u6 = true;
    node.replaceChildren(...out);
  }
  // „Żetony: 🪙 2” (informacja w nagłówku tury) → spokojny podpis i wyraźna liczba żetonów
  function tokenInfo(node) {
    if (!node || node.u6) return;
    const m = node.textContent.match(/^(.*?)\s*(🪙\s*\d+)\s*$/);
    if (!m) return;
    node.u6 = true;
    node.title = node.textContent;
    node.replaceChildren(...[m[1] ? mk('span', 'u6-lbl', m[1].replace(/[:：]\s*$/, '')) : null, coinEl(m[2].replace(/\s+/, ' '))].filter(Boolean));
    node.classList.add('u6-tokens');
  }
  function sizeChips(board) {
    if (!board || !board.u6) return;
    const n = board.children.length;
    const cols = Math.max(1, Math.min(n, Math.floor((board.clientWidth + 4) / 66)));
    board.style.setProperty('--cols', cols);
    board.classList.toggle('narrow', board.clientWidth / cols < 84);
  }

  /* ---------- rozgrywka na telefonie ---------- */
  function buildGame(s) {
    const card = app.querySelector(':scope > .ht-card');
    const top = app.querySelector(':scope > .p-top');
    const board = app.querySelector(':scope > .ht-scores');
    const party = app.querySelector(':scope > .p-party');
    const tls = s.timelines || [];
    const active = tls.find((t) => t.active);
    const views = [];
    // odkryta karta obok płyty (status jest wtedy pusty)
    const rev = card.querySelector(':scope > .ht-reveal');
    const body = card.querySelector('.ht-body');
    if (rev && body) body.append(rev);
    // dwie kolumny karty (poziomo, gdy karta ma całą szerokość): informacje | to, czym gracz steruje
    // ▶ Odtwórz i ⏭ Pomiń – pod płytą na całą szerokość karty (obok płyty zostaje sam status, przyciski się nie zawijają)
    const controls = body && body.querySelector(':scope > .ht-controls');
    if (controls) card.querySelector('.ht-mystery').after(controls);
    // przy odpowiedziach do wyboru pozostałe przyciski (np. 💡 Pierwsza litera) są w kolumnie informacji, obok podpowiedzi
    const choicesHere = !!card.querySelector(':scope > .p-choices');
    const ctrl = [...card.children].filter((x) => x.matches('.ht-controls, .bingo-board, .live-box, .ht-actions, .guess-form, .year-form, .p-buzz, .sort-box')
      && !(choicesHere && x.matches('.ht-actions:not(.p-choices)')));
    if (ctrl.length) {
      const colA = mk('div', 'u6-col u6-colA');
      const colB = mk('div', 'u6-col u6-colB');
      colA.append(...[...card.children].filter((x) => !ctrl.includes(x) && !x.matches('.vtl')));
      colB.append(...ctrl);
      card.prepend(colA, colB);
      card.classList.add('u6-cols');
    }
    const turnTl = card.querySelector(':scope > .vtl');
    if (turnTl) {
      const pick = !!turnTl.querySelector('.vslot');
      const shared = active && !active.name;
      views.push({ key: 'turn', label: shared ? T('Wspólna oś') : (pick ? `📍 ${T('Moja oś')}` : T('Moja oś')), node: turnTl, pick });
    }
    const watch = app.querySelector(':scope > .vtl.watch');
    if (watch) views.push({ key: 'watch', label: `👀 ${active ? active.name : ''}`, node: watch });
    const own = app.querySelector(':scope > .ht-tl');
    if (own) views.push({ key: 'own', label: T('Moja oś'), node: own });
    const others = app.querySelector(':scope > .ht-others');
    if (others) views.push({ key: 'others', label: T('Inni'), node: others, list: [...others.querySelectorAll('.vtl')] });
    scoreChips(board);
    tokenInfo(card.querySelector('.ht-info'));
    const bar = mk('div', 'u6-bar');
    bar.append(...[top, board].filter(Boolean));
    const main = mk('div', 'u6-main');
    const panel = mk('div', 'u6-panel');
    const tabs = mk('div', 'u6-tabs');
    tabs.setAttribute('role', 'tablist');
    const view = mk('div', 'u6-view');
    panel.append(tabs, view);
    main.append(card, panel);
    app.replaceChildren(...[bar, party, main].filter(Boolean));
    app.classList.add('u6-game');
    app.scrollTop = 0;
    main.u6 = { views, card, panel, tabs, view, s };
    // zakładka: po zmianie tury wraca domyślna (miejsca do wyboru > gracz z turą > twoja oś)
    const turnKey = `${s.title}|${s.turnName}|${s.phase}`;
    if (turnKey !== u6.tabKey) { u6.tabKey = turnKey; u6.tab = ''; }
    layoutGame(main);
  }
  function showView(main) {
    const { views, card, panel, tabs, view } = main.u6;
    const tabbed = main.classList.contains('tabbed');
    // bez wyboru gracza: przy zakładkach – karta tury (chyba że trzeba wybrać miejsce na osi), bez nich – pierwsza oś
    let cur = u6.tab;
    if (!tabbed && cur === 'card') cur = '';
    if (cur && cur !== 'card' && !views.some((v) => v.key === cur)) cur = '';
    if (!cur) cur = tabbed && !views.some((v) => v.pick) ? 'card' : (views[0] || {}).key;
    const list = (tabbed ? [{ key: 'card', label: T('🎵 Tura') }] : []).concat(views);
    tabs.replaceChildren(...list.map((v) => {
      const b = mk('button', 'u6-tab' + (v.key === cur ? ' on' : '') + (v.pick ? ' pick' : ''), v.label);
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(v.key === cur));
      b.addEventListener('click', () => { u6.tab = v.key; showView(main); });
      return b;
    }));
    tabs.classList.toggle('hidden', list.length < 2);
    if (tabbed) { main.prepend(tabs); } else if (tabs.parentElement !== panel) panel.prepend(tabs);
    card.classList.toggle('hidden', tabbed && cur !== 'card');
    panel.classList.toggle('hidden', !views.length || (tabbed && cur === 'card'));
    const v = views.find((x) => x.key === cur);
    if (!v) return;
    let node = v.node;
    // pozostali gracze: wybór gracza i jego oś
    if (v.key === 'others') {
      const all = v.list;
      const names = all.map((x) => (x.querySelector('.vtl-title') || {}).textContent || '');
      let k = names.indexOf(u6.other);
      if (k < 0) k = 0;
      u6.other = names[k];
      const who = mk('div', 'u6-who');
      if (all.length > 1) {
        names.forEach((nm, i) => {
          const b = mk('button', i === k ? 'on' : '', nm.split(' · ')[0]);
          b.type = 'button';
          b.addEventListener('click', () => { u6.other = nm; showView(main); });
          who.append(b);
        });
      }
      node = all[k];
      view.replaceChildren(who, node);
      const title = node.querySelector('.vtl-title');
      if (title) title.classList.toggle('hidden', all.length > 1);
    } else view.replaceChildren(node);
    const vtl = node.matches('.vtl') ? node : node.querySelector('.vtl');
    main.classList.remove('short');
    const res = vtl ? fitAxis(vtl, `${v.key}|${u6.other}`) : { ok: true };
    // krótka oś (kilka kart): panel tylko tak wysoki jak oś, resztę miejsca dostaje karta tury (większa płyta)
    if (res.short && main.classList.contains('split') && innerWidth <= innerHeight) main.classList.add('short');
    growCard(main);
    return res;
  }
  // wolne miejsce w karcie tury: większa płyta / okładka (do 150 px), reszta wyśrodkowana
  function growCard(main) {
    const { card } = main.u6;
    const vin = card.querySelector('.ht-vinyl');
    if (!vin) return;
    vin.style.width = ''; vin.style.height = '';
    card.classList.remove('u6-roomy');
    if (card.classList.contains('hidden') || !(main.classList.contains('solo') || main.classList.contains('short'))) return;
    // kolumny .u6-col mają display: contents – liczymy ich zawartość
    const flat = (n) => [...n.children].flatMap((k) => (getComputedStyle(k).display === 'contents' ? flat(k) : [k]));
    const kids = flat(card).filter((n) => n.offsetParent);
    if (!kids.length) return;
    const bottom = Math.max(...kids.map((n) => n.getBoundingClientRect().bottom));
    const used = bottom - card.getBoundingClientRect().top + parseFloat(getComputedStyle(card).paddingBottom);
    const free = card.clientHeight - used;
    if (free < 24) return;
    card.classList.add('u6-roomy');
    // ciasny układ (mniejsza płyta) – tylko wyśrodkowanie
    if (main.classList.contains('tight') || main.classList.contains('mini')) return;
    const base = vin.offsetWidth;
    const row = vin.parentElement.clientWidth;
    let v = Math.min(150, base + free - 12, row * (card.querySelector('.ht-reveal') ? 0.26 : 0.42));
    for (; v > base; v -= 8) {
      vin.style.width = `${v}px`; vin.style.height = `${v}px`;
      if (!overflows(card)) break;
    }
    if (v <= base) { vin.style.width = ''; vin.style.height = ''; }
  }
  function layoutGame(main) {
    main.classList.remove('tight', 'tabbed', 'split', 'solo', 'pick', 'wide', 'mini', 'short', 'lean');
    sizeChips(app.querySelector('.u6-bar > .ht-scores'));
    const { views, card, panel } = main.u6;
    card.classList.remove('hidden');
    const land = innerWidth > innerHeight;
    if (!views.length) {
      main.classList.add('solo'); panel.classList.add('hidden');
      main.classList.toggle('wide', land);
      if (overflows(card)) main.classList.add('tight');
      growCard(main);
      return;
    }
    main.classList.add('split');
    const pick = views.some((v) => v.pick);
    main.classList.toggle('pick', pick);
    // kolejno: zwykły układ → ciaśniejsza karta tury → (wybór miejsca) karta tury w jednym-dwóch rzędach → zakładki
    let res = showView(main);
    const cramped = () => overflows(card) || card.scrollWidth > card.clientWidth + 1 || !res.ok || (!land && panel.clientHeight < 150);
    if (cramped() || res.poor) { main.classList.add('tight'); res = showView(main); }
    // własna tura: gdy karty osi wychodzą drobne, karta tury oddaje miejsce (sam nagłówek i przyciski)
    // (poziomo – węższa karta tury, a oś dostaje szeroki panel na dwie kolumny)
    const small = () => cramped() || res.poor;
    const turn = views[0].key === 'turn' && !card.querySelector('.p-choices');
    if (small() && land) { main.classList.add('lean'); if (turn) main.classList.add('mini'); res = showView(main); }
    if (small() && turn) { main.classList.add('mini'); res = showView(main); }
    if (cramped()) {
      main.classList.remove('split', 'mini', 'lean'); main.classList.add('tabbed'); main.classList.toggle('wide', land); showView(main);
    }
  }

  /* ---------- telefon: po każdym odświeżeniu ekranu ---------- */
  function phoneLayout() {
    app.classList.remove('u6-game');
    const main = app.querySelector(':scope > .u6-main');
    if (main) { app.classList.add('u6-game'); layoutGame(main); return; }
    if (app.querySelector(':scope > .ht-card') && last) { buildGame(last); return; }
    const vote = app.querySelector(':scope > .vote-view');
    if (vote) { layoutVote(vote); return; }
    u6.votePage = null;
    const card = app.querySelector(':scope > .picker, :scope > .waiting');
    if (card) layoutCard(card);
  }
  function tvLayout(s) {
    // wybór trybu: liczba kolumn z liczby kafelków i proporcji ekranu – kafelki wypełniają cały ekran
    const grid = app.querySelector('.mb-grid');
    if (grid) {
      const n = grid.children.length;
      grid.style.setProperty('--mbcols', Math.max(3, Math.min(8, Math.round(Math.sqrt((n * innerWidth) / innerHeight / 1.6)))));
      fit();
    }
    // Tak to leciało! – tv.js nie dopasowuje tego ekranu; ta sama pętla co dla pozostałych (mniejsza czcionka, aż się zmieści)
    if (s && s.screen === 'lyrics') fit();
    // rozgrywka: żetony w nagłówku tury i stan graczy przy osiach – liczby wyraźne z kanapy
    const card = app.querySelector('.turn-card');
    if (card) {
      tokenInfo(card.querySelector('.turn-head .info'));
      app.querySelectorAll('.tl-name small, .scores .score').forEach(markStats);
      fit();
    }
  }
  // flaga albo okładka wczytana po dopasowaniu ekranu zmienia wysokość karty tury – dopasowujemy jeszcze raz
  let refit = 0;
  if (!PLAYER) {
    app.addEventListener('load', (e) => {
      if (e.target.tagName !== 'IMG' || !last) return;
      cancelAnimationFrame(refit);
      refit = requestAnimationFrame(() => { const b = app.querySelector('.timelines'); if (overflows(app) || (b && overflows(b))) fit(); });
    }, true);
  }
  /* ---------- duży ekran: oś dłuższa niż 10 kart – karty tej wielkości co przy 10, przewija się tylko oś ---------- */
  // do 10 kart oś mieści się w całości (dopasowanie z tv.js); przy dłuższej karty nie maleją dalej, a oś przesuwa się
  // tak, by nowa karta / wybrane miejsce / znacznik pomyłki były na środku (bez znacznika – najnowsze karty po prawej)
  function tvLongAxes() {
    const box = app.querySelector('.timelines');
    if (!box) return;
    const u = scaleUnit();
    for (const r of box.children) {
      const tl = r.querySelector('.tl');
      if (!tl) continue;
      const n = tl.querySelectorAll(':scope > .card:not(.mystery)').length;
      const long = n > LONG;
      tl.toggleAttribute('data-ui6-scroll', long);
      tl.classList.toggle('u6-long', long);
      if (!long) continue;
      const items = [...tl.children];
      const gap = parseFloat(tl.style.getPropertyValue('--gap')) || 0;
      const marks = items.filter((x) => !x.matches('.card') || x.matches('.mystery')).length;
      const rowH = r.clientHeight;
      const cw0 = parseFloat(tl.style.getPropertyValue('--cw')) || 0;
      const room = (tl.clientWidth - gap * (LONG + marks - 1)) / (LONG + marks * 0.55);
      const cw = Math.max(cw0, Math.min(room, rowH * 0.78, contentWidth() * 0.16));
      const ch = Math.max(20 * u, Math.min(rowH - 6 * u, cw * 1.35));
      const tiny = ch < 85 * u;
      tl.style.setProperty('--cw', `${cw}px`);
      tl.style.setProperty('--ch', `${ch}px`);
      tl.style.setProperty('--fs', `${Math.max(6, Math.min(cw / 5.8, ch / (tiny ? 3.9 : 8.2)))}px`);
      r.classList.toggle('tiny', tiny);
      const f = tl.querySelector(':scope > .mystery, :scope > .mark, :scope > .card.new');
      tl.scrollLeft = f ? f.offsetLeft - (tl.clientWidth - f.offsetWidth) / 2 : tl.scrollWidth;
      // wygaszona krawędź po stronie, gdzie są dalsze karty
      tl.classList.toggle('u6-more-l', tl.scrollLeft > 2);
      tl.classList.toggle('u6-more-r', tl.scrollLeft + tl.clientWidth < tl.scrollWidth - 2);
    }
  }
  if (!PLAYER) {
    const baseFit = fit;
    fit = function ui6Fit() { baseFit(); try { tvLongAxes(); } catch (e) { console.error(e); } };
  }
  const baseRender = render;
  render = function ui6Render(s) {
    baseRender(s);
    try { if (PLAYER) phoneLayout(); else tvLayout(s); } catch (e) { console.error(e); }
  };
  // obrót telefonu / klawiatura: ten sam ekran, nowy układ (bez przebudowy – pole tekstowe nie traci fokusu)
  let rz = 0;
  const relayout = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (PLAYER) phoneLayout(); }); };
  window.addEventListener('resize', relayout);
  // klawiatura ekranowa: html.kbd i wysokość nad klawiaturą (--vvh)
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const kbd = () => {
      const a = document.activeElement;
      const typing = a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit)$/.test(a.type)));
      const on = !!typing && vv.height < innerHeight - 120;
      document.documentElement.classList.toggle('kbd', on);
      document.documentElement.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      relayout();
    };
    vv.addEventListener('resize', kbd);
    window.addEventListener('focusout', () => setTimeout(kbd, 50));
  }
  if (PLAYER && app.firstChild) phoneLayout();
}
