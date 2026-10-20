'use strict';
// Songster 6.0 – end: zmiany układu dla nowego wyglądu (działa tylko przy UI6)
// Podsumowanie gry bez przewijania: u góry wynik (#winner-title), pod nim zakładki Wyniki / Liga / Piosenki
// (na szerokim ekranie wszystko obok siebie, bez zakładek); treść, która się nie mieści, przechodzi na kolejne strony.
// Elementy gry (#ranking, #winner-timeline, #played-list, przyciski) zostają tymi samymi węzłami – gra dalej je wypełnia.
if (UI6) {
  const scr = $('#screen-end');
  const resCard = $('#ranking').closest('section');
  const songsCard = $('#played-list').closest('section');
  resCard.classList.add('end-res-card');
  songsCard.classList.add('end-songs-card');

  // nagłówek: wynik gry (zapowiedź minigry/turnieju gra wstawia tuż przed tytułem – trafia tu razem z nim)
  const hero = el('header', { class: 'end-hero' });
  scr.prepend(hero);
  hero.append($('#winner-title'));

  // zakładki (telefony i wąskie okna)
  const tabs = el('div', { class: 'end-tabs', role: 'tablist', 'aria-label': T('Podsumowanie') });
  const TABS = [
    { id: 'res', label: () => T('🏆 Wyniki') },
    { id: 'league', label: () => ($('#ranking .league-box') ? T('📊 Liga') : T('✨ Momenty')) },
    { id: 'songs', label: () => T('🎵 Piosenki') },
  ];
  const btns = {};
  for (const t of TABS) {
    btns[t.id] = el('button', { type: 'button', role: 'tab', class: 'end-tab', onclick: () => setTab(t.id) });
    tabs.append(btns[t.id]);
  }
  const bar = el('div', { class: 'end-bar' }, tabs);
  hero.after(bar);

  // główna część: dwa panele ze stronami
  const body = el('div', { class: 'end-body' });
  bar.after(body);
  const resPanel = el('div', { class: 'end-panel end-res' });
  const songsPanel = el('div', { class: 'end-panel end-songs' });
  body.append(resPanel, songsPanel);
  resPanel.append(resCard);
  songsPanel.append(songsCard);
  const resPager = ui6Paginate(resCard, [...resCard.children], { cls: 'end-pages' });
  const songsPager = ui6Paginate(songsCard, [$('#played-list')], { cls: 'end-pages end-songs-pages' });
  const pagers = [resPager, songsPager].filter(Boolean);

  // pasek stron: na telefonie w rzędzie zakładek (oszczędza wysokość), na szerokim ekranie – pod panelem
  const wide = matchMedia('(min-width: 900px) and (min-height: 521px)');
  const placeNav = () => {
    for (const p of pagers) {
      const panel = p.box.closest('.end-panel');
      p.nav.dataset.panel = panel === resPanel ? 'res' : 'songs';
      if (wide.matches) p.box.parentElement.insertBefore(p.nav, p.box.nextSibling);
      else bar.append(p.nav);
    }
  };

  const hasLeague = () => !!$('#ranking .league-box, #ranking .moments-box');
  // bez rankingu i osi (np. jedna osoba we wspinaczce) – same piosenki, bez pustej zakładki „Wyniki”
  const noRes = () => !$('#ranking').children.length && $('#winner-timeline').classList.contains('hidden');
  const refresh = () => {
    const empty = noRes();
    scr.classList.toggle('end-nores', empty);
    btns.res.classList.toggle('hidden', empty);
    if (empty && scr.dataset.tab === 'res') scr.dataset.tab = 'songs';
    btns.league.classList.toggle('hidden', !hasLeague());
    if (scr.dataset.tab === 'league' && !hasLeague()) scr.dataset.tab = 'res';
    for (const t of TABS) {
      // „🏆 Wyniki” → ikona i napis osobno (na wąskim telefonie nieaktywne zakładki to same ikony)
      const label = t.label();
      const sp = label.indexOf(' ');
      btns[t.id].replaceChildren(el('span', { class: 'end-tab-ic', 'aria-hidden': 'true' }, sp > 0 ? label.slice(0, sp) : ''),
        el('span', { class: 'end-tab-tx' }, sp > 0 ? label.slice(sp + 1) : label));
      btns[t.id].title = label;
      btns[t.id].setAttribute('aria-label', sp > 0 ? label.slice(sp + 1) : label);
      const on = scr.dataset.tab === t.id;
      btns[t.id].classList.toggle('on', on);
      btns[t.id].setAttribute('aria-selected', String(on));
    }
    requestAnimationFrame(() => { pagers.forEach((p) => p.go(0, false)); fit(); });
  };

  // oś zwycięzcy: do 10 kart cała (zwarte wiersze), dłuższa przewija się sama w wysokości kolumny (data-ui6-scroll)
  const tl = $('#winner-timeline');
  const longTl = () => !tl.classList.contains('hidden') && tl.querySelectorAll('.tcard').length > 10;
  // szeroki ekran: gdy wszystko mieści się na jednej stronie, panele mają szerokość treści i stoją razem na środku
  // (zamiast wąskiej kolumny po lewej i pustej reszty); dłuższa treść – zwykły układ ze stronami
  const FIT = ['end-fit', 'end-fit-res', 'end-fit-songs'];
  const columns = (box, sel) => {
    const lefts = [];
    let w = 0;
    for (const e of box.querySelectorAll(sel)) {
      for (const r of e.getClientRects()) {
        if (r.width < 1) continue;
        lefts.push(r.left);
        w = Math.max(w, r.width);
      }
    }
    lefts.sort((a, b) => a - b);
    const n = lefts.filter((x, i) => i === 0 || x - lefts[i - 1] > 60).length;
    return { n: Math.max(1, n), w: Math.ceil(w) };
  };
  function fit() {
    scr.classList.remove(...FIT);
    if (scr.classList.contains('hidden')) return;
    const long = longTl();
    tl.toggleAttribute('data-ui6-scroll', long);
    if (long) {
      scr.style.removeProperty('--end-colh');
      resPager && resPager.update();
      if (resPager && resPager.box.clientHeight) scr.style.setProperty('--end-colh', `${resPager.box.clientHeight - (parseFloat(getComputedStyle(resPager.flow).columnGap) || 0) - 4}px`);
    }
    pagers.forEach((p) => p.update());
    if (!wide.matches) return;
    const gap = parseFloat(getComputedStyle(body).columnGap) || 0;
    const one = (p) => p && p.box.offsetParent && p.pages === 1;
    const fitRes = one(resPager) && !scr.classList.contains('end-nores');
    const fitSongs = one(songsPager);
    if (fitRes) {
      const c = columns(resPager.box, '#ranking > *, #winner-timeline');
      scr.style.setProperty('--end-rescols', c.n);
      scr.style.setProperty('--end-resw', `${c.n * c.w + (c.n - 1) * gap}px`);
      scr.classList.add('end-fit-res');
    }
    if (fitSongs) {
      const c = columns(songsPager.box, '#played-list > li');
      scr.style.setProperty('--end-songcols', c.n);
      scr.style.setProperty('--end-songw', `${c.n * c.w + (c.n - 1) * gap}px`);
      scr.classList.add('end-fit-songs');
    }
    if (fitSongs && (fitRes || scr.classList.contains('end-nores'))) scr.classList.add('end-fit');
    pagers.forEach((p) => p.update());
    // zabezpieczenie: gdyby po zmianie coś nie zmieściło się w wysokości – wracamy do zwykłego układu
    if (body.scrollHeight > body.clientHeight + 1 || pagers.some((p) => p.box.offsetParent && p.pages > 1)) {
      scr.classList.remove(...FIT);
      pagers.forEach((p) => p.update());
    }
    const vis = [...body.children].filter((e) => e.offsetParent);
    const w = scr.classList.contains('end-fit') ? vis.reduce((sum, e) => sum + e.offsetWidth, 0) + gap * (vis.length - 1) : 0;
    scr.style.setProperty('--end-w', w > 0 ? `${Math.ceil(w)}px` : '100%');
  }
  function setTab(id) {
    scr.dataset.tab = id;
    refresh();
  }
  scr.dataset.tab = 'res';
  placeNav();
  wide.addEventListener('change', () => { placeNav(); refresh(); });
  let rt = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(fit); });
  // nowe podsumowanie (koniec gry, przerwa w imprezie) – od zakładki „Wyniki” i pierwszej strony
  let wasHidden = scr.classList.contains('hidden');
  new MutationObserver(() => {
    const hidden = scr.classList.contains('hidden');
    if (wasHidden && !hidden) setTab('res');
    wasHidden = hidden;
  }).observe(scr, { attributes: true, attributeFilter: ['class'] });
  // wysokość widocznego rzędu przycisków – powiadomienia pokazują się nad nim
  const acts = $$('#screen-end > .actions');
  const lift = () => {
    const a = acts.find((x) => !x.classList.contains('hidden'));
    document.documentElement.style.setProperty('--end-act', `${a ? a.offsetHeight : 0}px`);
  };
  const ro = new ResizeObserver(lift);
  acts.forEach((a) => ro.observe(a));
  new MutationObserver(refresh).observe($('#ranking'), { childList: true });
  new MutationObserver(refresh).observe($('#winner-timeline'), { attributes: true, attributeFilter: ['class'] });
  refresh();
}
