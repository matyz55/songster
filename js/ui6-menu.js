'use strict';
// Songster 6.0 – menu: zmiany układu dla nowego wyglądu (działa tylko przy UI6)
// Ekran startowy (duży wybór: sam / razem, duży ekran pod 📺 w pasku, ostatnio grany tryb), ustawienia i statystyki na stronach z zakładkami,
// kariera w siatce, okna: zasady (jeden tryb na raz), duży ekran, własna lista piosenek.
if (UI6) {
  /* ---------- ekran startowy ---------- */
  {
    const home = $('#screen-home');
    const pick = home.querySelector('.ctx-pick');
    // kafelek: ikona, nazwa, opis, przykładowe tryby (na dużym ekranie) i napis-zachęta na dole
    const setTile = (btn, icon, name, desc, tags, go) => btn.replaceChildren(
      el('span', { class: 'mode-icon', 'aria-hidden': 'true' }, icon), el('b', {}, name), el('span', { class: 'muted' }, desc),
      el('span', { class: 'ui6-tile-tags', 'aria-hidden': 'true' }, tags.map((t) => el('span', { class: 'ui6-tag' }, t))),
      el('span', { class: 'ui6-tile-go', 'aria-hidden': 'true' }, go));
    setTile($('#btn-single'), '👤', T('Gram sam'), T('Oś czasu, gra na czas, zgadywanie melodii, quizy i impreza dla jednej osoby.'),
      [T('Oś czasu'), T('Na czas'), T('Jaka to melodia'), T('Kariera'), T('Wyzwanie dnia'), T('Impreza')], T('Wybierz tryb'));
    setTile($('#btn-multi'), '👥', T('Gramy razem'), T('2–16 osób przy jednym urządzeniu albo na własnych telefonach.'),
      [T('Oś czasu'), T('Drużyny'), T('Współpraca'), T('Kto pierwszy?'), T('Impreza')], T('Dodaj graczy'));
    // duży ekran: bez osobnego kafelka – ikona 📺 w górnym pasku (na ekranie startowym z podpisem, gdy jest miejsce)
    $('#btn-tv-home').classList.add('hidden');
    $('#btn-tv').append(el('span', { class: 'ui6-tv-label' }, T('Duży ekran')));
    pick.classList.add('ui6-pick');

    // pasek pod kafelkami: baza piosenek, ostatnia gra (jedno stuknięcie), moje statystyki
    const pl = window.SONGS.filter((s) => s.c === 'PL').length;
    const n = window.SONGS.length;
    const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
    const songs = el('div', { class: 'ui6-info ui6-info-songs' },
      el('span', { class: 'ui6-last-play', 'aria-hidden': 'true' }, '🎵'),
      el('span', { class: 'ui6-last-txt' },
        el('small', {}, T('Baza piosenek')),
        el('b', {}, few ? T('{0} piosenki', n) : T('{0} piosenek', n)),
        el('span', { class: 'muted' }, T('{0} polskich · {1} zagranicznych', pl, n - pl))));
    const last = el('button', { type: 'button', id: 'ui6-last', class: 'ui6-info ui6-last' });
    const stats = $('#btn-stats');
    stats.classList.add('ui6-info', 'ui6-info-stats');
    const info = el('div', { class: 'ui6-home-info' }, songs, last, stats);
    pick.after(info);
    // stopka: instalacja, wersja (pełne zdanie o bazie piosenek zostaje dla czytników ekranu)
    const foot = home.querySelector('.home-links');
    foot.classList.add('ui6-home-foot');
    foot.append($('#btn-install'), $('#home-info'), $('#app-version'));

    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('#screen-modes .mode[data-mode]');
      if (b && !b.disabled) store.set('ui6LastMode', { m: b.dataset.mode, ctx: playCtx });
    }, true);
    const tileOf = (m) => $(`#screen-modes .mode[data-mode="${m}"]`);
    const dayLabel = (d) => {
      const days = Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(d)) / 864e5);
      return days <= 0 ? T('dziś') : days === 1 ? T('wczoraj') : d.split('-').reverse().slice(0, 2).join('.');
    };
    const renderLast = () => {
      const lm = store.get('ui6LastMode', null);
      const tile = lm && tileOf(lm.m);
      last.classList.toggle('ui6-first', !tile);
      if (!tile) {
        // jeszcze bez gry – zasady na start
        last.dataset.ctx = '';
        last.replaceChildren(el('span', { class: 'ui6-last-play', 'aria-hidden': 'true' }, '?'),
          el('span', { class: 'ui6-last-txt' }, el('small', {}, T('Pierwszy raz?')), el('b', {}, T('Zasady wszystkich trybów'))));
        return;
      }
      const icon = tile.querySelector('.mode-icon');
      const name = tile.querySelector('b');
      const multi = lm.ctx === 'multi';
      const g = store.get('stats', { g: [] }).g || [];
      const lg = g.length && g[g.length - 1].m === lm.m ? g[g.length - 1] : null;
      last.replaceChildren(
        el('span', { class: 'ui6-last-play', 'aria-hidden': 'true' }, '▶'),
        el('span', { class: 'ui6-last-txt' },
          el('small', {}, multi ? T('Ostatnio graliście – najpierw lista graczy') : T('Zagraj znowu')),
          el('b', {}, `${icon ? icon.textContent.trim() + ' ' : ''}${name ? name.textContent.trim() : lm.m}`),
          lg && lg.d ? el('span', { class: 'muted' }, T('Ostatnia gra: {0}', dayLabel(lg.d))) : null));
      last.dataset.ctx = lm.ctx;
    };
    const renderStatsTile = () => {
      const st = store.get('stats', { a: [], g: [] });
      const a = st.a || []; const g = st.g || [];
      const ok = a.filter((x) => x.ok).length;
      stats.replaceChildren(
        el('span', { class: 'ui6-last-play', 'aria-hidden': 'true' }, '📊'),
        el('span', { class: 'ui6-last-txt' },
          el('small', {}, T('Moje statystyki')),
          el('b', {}, g.length || a.length ? `${T('Gry')}: ${g.length} · ${T('Skuteczność')}: ${a.length ? Math.round((ok / a.length) * 100) : 0}%` : T('Osiągnięcia i postępy'))));
    };
    last.addEventListener('click', () => {
      const lm = store.get('ui6LastMode', null);
      if (!lm || !tileOf(lm.m)) { $('#btn-rules').click(); return; }
      if (lm.ctx === 'multi') { $('#btn-multi').click(); return; }
      $('#btn-single').click();
      const tile = tileOf(lm.m);
      if (tile && !tile.disabled && !tile.classList.contains('hidden')) tile.click();
    });
    const render = () => { renderLast(); renderStatsTile(); };
    render();
    new MutationObserver(() => { if (!home.classList.contains('hidden')) render(); }).observe(home, { attributes: true, attributeFilter: ['class'] });
  }

  // aktywna zakładka z nazwą, pozostałe jako kropki (na wąskich ekranach – CSS); krótkie nazwy zakładek
  const tabNames = (root, names) => {
    for (const h of root.querySelectorAll(':scope > .card > h2, :scope > section > h2')) {
      const k = Object.keys(names).find((n) => h.textContent.includes(T(n)));
      if (k) h.dataset.tab = T(names[k]);
    }
  };

  /* ---------- ustawienia: zakładki i strony ---------- */
  {
    const scr = $('#screen-settings');
    const cards = $$('#screen-settings > .card');
    $('#ly-reports-card h2').dataset.tab = T('Zgłoszone');
    tabNames(scr, { 'Język / Language': 'Język', Efekty: 'Efekty', 'Rok i kraj piosenek': 'Rok i kraj', Wygląd: 'Wygląd' });
    ui6Paginate(scr, cards, { tabs: ':scope > .card > h2', cls: 'ui6-menu-pages' });
    const back = $('#btn-settings-back');
    const bar = el('div', { class: 'actions' });
    back.after(bar);
    bar.append(back);
  }

  /* ---------- statystyki: zakładki i strony ---------- */
  {
    const scr = $('#screen-stats');
    const body = $('#stats-body');
    // nagłówek: tytuł i uwaga o zapisie w jednym wierszu
    const title = scr.querySelector(':scope > .screen-title');
    const head = el('div', { class: 'ui6-stats-head' });
    title.before(head);
    head.append(title, scr.querySelector(':scope > p.muted'));
    // podsumowanie (kafelki: gry, odpowiedzi, skuteczność, czas) zawsze widoczne nad stronami
    const sum = el('div', { class: 'ui6-stats-sum' });
    const box = el('div', { class: 'ui6-pages ui6-menu-pages' });
    body.before(sum, box);
    box.append(body);
    body.classList.add('ui6-flow');
    const names = { 'Osiągnięcia': 'Osiągnięcia', 'Postępy': 'Postępy', 'Skuteczność': 'Skuteczność', 'Najczęściej mylone piosenki': 'Mylone',
      'Historia rekordów': 'Rekordy', 'Rozegrane gry': 'Gry', 'Przenieś postępy': 'Przenieś' };
    const name = () => {
      const top = body.querySelectorAll(':scope > .stat-tiles, :scope > .card:not(:has(h2))');
      if (top.length) sum.replaceChildren(...top);
      tabNames(body, names);
    };
    new MutationObserver(name).observe(body, { childList: true });
    name();
    ui6Pager(box, { tabs: ':scope > .card > h2' });
  }

  /* ---------- kariera: ikona etapu osobno, wyróżniony następny etap, pasek zebranych gwiazdek ---------- */
  {
    const list = $('#career-list');
    const total = $('#career-total');
    let busy = false;
    const dress = () => {
      if (busy) return;
      busy = true;
      const stages = [...list.querySelectorAll('.career-stage')];
      let firstLocked = true;
      stages.forEach((b) => {
        const name = b.querySelector('.career-name b');
        if (name && !b.querySelector('.ui6-career-icon')) {
          const [icon, ...rest] = name.textContent.split(' ');
          name.textContent = rest.join(' ');
          b.prepend(el('span', { class: 'ui6-career-icon', 'aria-hidden': 'true' }, icon));
        }
        // ten sam napis o blokadzie tylko na pierwszym zablokowanym etapie, dalej sama kłódka
        if (b.classList.contains('locked')) {
          b.classList.toggle('ui6-lock-more', !firstLocked);
          firstLocked = false;
        }
      });
      const next = stages.find((b) => !b.classList.contains('locked') && !/★/.test(b.querySelector('.career-stars').textContent));
      stages.forEach((b) => b.classList.toggle('ui6-next', b === next));
      const m = total.textContent.match(/(\d+)\D+(\d+)/);
      if (m) total.style.setProperty('--p', `${(100 * m[1]) / m[2]}%`);
      busy = false;
    };
    new MutationObserver(dress).observe(list, { childList: true });
    dress();
  }

  /* ---------- okno zasad: wybór trybu i zasady jednego trybu na raz ---------- */
  {
    const dlg = $('#dlg-rules');
    const body = dlg.querySelector('[data-i18n-html]');
    const title = body.querySelector('h2');
    const secs = [];
    let cur = null;
    for (const n of [...body.children]) {
      if (n === title) continue;
      if (n.tagName === 'H3') { cur = el('section', { class: 'ui6-rule' }); secs.push(cur); }
      if (cur) cur.append(n);
    }
    const names = secs.map((s) => s.querySelector('h3').textContent.trim());
    const select = el('select', { class: 'ui6-rules-select', 'aria-label': T('Zasady trybu') },
      names.map((n, i) => el('option', { value: String(i) }, n)));
    const list = el('nav', { class: 'ui6-rules-list', 'aria-label': T('Zasady trybu') },
      names.map((n, i) => el('button', { type: 'button', class: 'ghost', onclick: () => show(i) }, n)));
    const pane = el('div', { class: 'ui6-rules-pane' }, ...secs);
    body.classList.add('ui6-rules');
    body.replaceChildren(el('div', { class: 'ui6-rules-head' }, title, select), el('div', { class: 'ui6-rules-main' }, list, pane));
    const pager = ui6Paginate(pane, secs, { cls: 'ui6-rules-pages' });
    function show(i) {
      i = Math.max(0, Math.min(secs.length - 1, i | 0));
      secs.forEach((s, j) => s.classList.toggle('hidden', j !== i));
      [...list.children].forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
      select.value = String(i);
      store.set('ui6Rules', i);
      if (pager) { pager.page = 0; requestAnimationFrame(() => { pager.update(); pager.go(0, false); }); }
    }
    select.addEventListener('change', () => show(select.value));
    show(store.get('ui6Rules', 0));
    // po otwarciu okna – przeliczenie stron (wcześniej okno było niewidoczne)
    new MutationObserver(() => { if (dlg.open && pager) requestAnimationFrame(pager.update); }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
  }

  /* ---------- okno „Duży ekran i telefony”: trzy części obok siebie albo na stronach ---------- */
  {
    const dlg = $('#dlg-connect');
    const secs = [];
    let cur = null;
    for (const n of [...dlg.children]) {
      if (n.tagName === 'H2' || n.tagName === 'FORM') continue;
      if (n.tagName === 'H3') { cur = el('section', { class: `ui6-sec${n.classList.contains('join-part') ? ' join-part' : ''}` }); secs.push(cur); }
      if (cur) cur.append(n);
    }
    secs.forEach((s) => dlg.insertBefore(s, dlg.querySelector(':scope > form')));
    secs.forEach((s, i) => { s.querySelector('h3').dataset.tab = [T('Ten komputer'), T('Telewizor'), T('Telefony graczy')][i] || ''; });
    const pager = ui6Paginate(dlg, secs, { tabs: ':scope > .ui6-sec > h3', cls: 'ui6-connect-pages' });
    new MutationObserver(() => { if (dlg.open && pager) requestAnimationFrame(() => { pager.update(); pager.go(0, false); }); })
      .observe(dlg, { attributes: true, attributeFilter: ['open', 'class'] });
  }

  /* ---------- okno „Własna lista piosenek”: wklejanie z lewej, wynik dopasowania z prawej ---------- */
  {
    const dlg = $('#dlg-playlist');
    const form = dlg.querySelector(':scope > form');
    const inp = el('div', { class: 'ui6-pl-in' });
    const out = el('div', { class: 'ui6-pl-out' });
    const wrap = el('div', { class: 'ui6-pl' }, inp, out);
    dlg.insertBefore(wrap, form);
    inp.append(...[...dlg.children].filter((n) => n !== wrap && n !== form && n.tagName !== 'H2' && n.id !== 'pl-result'));
    out.append($('#pl-result'));
    ui6Paginate(out, [$('#pl-result')], { cls: 'ui6-pl-pages' });
  }
}
