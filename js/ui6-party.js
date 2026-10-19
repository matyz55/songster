'use strict';
// Songster 6.0 – „Impreza” jako teleturniej (działa tylko przy UI6; bez 6.0 impreza wygląda i działa jak dotąd).
// Prowadzący zapowiada każdą rundę (plansza z zasadą i odliczaniem 3-2-1), rundy dostają modyfikatory
// (podwójne punkty, złodziej punktów, wszystko albo nic…), po rundzie tablica wyników z animacją,
// a na koniec finał „Ostatnie odliczanie”: punkty imprezy zamieniają się w sekundy, które wszystkim naraz uciekają.
// Zaczepienia w js/play.js: party6.intro / score / wantsFinal / finale (wywoływane tylko gdy UI6).

/* ---------- modyfikatory rund ---------- */
// apply(gained, before) – zmienia punkty imprezy zdobyte w rundzie (gained) w miejscu; before – punkty przed rundą
const P6_MODS = {
  warm: { icon: '🎬', name: () => T('Runda otwierająca'), rule: () => T('Rozgrzewka – zwykłe punkty, każdy zaczyna od zera.') },
  normal: { icon: '🎵', name: () => T('Klasyczna runda'), rule: () => T('Zwykłe punkty – bez niespodzianek.') },
  double: {
    icon: '✖️2', name: () => T('Podwójne punkty'), rule: () => T('Wszystkie punkty z tej rundy liczą się podwójnie.'),
    apply: (g) => g.forEach((v, i) => { g[i] = v * 2; }),
  },
  thief: {
    icon: '🦹', name: () => T('Złodziej punktów'), multi: true,
    rule: () => T('Zwycięzca rundy zabiera punkty wybranemu rywalowi.'),
  },
  allin: {
    icon: '🎲', name: () => T('Wszystko albo nic'), multi: true,
    rule: () => T('Punkty dostaje tylko zwycięzca rundy – za to podwójne. Reszta zostaje z niczym.'),
    apply: (g) => {
      const top = Math.max(...g);
      g.forEach((v, i) => { g[i] = top > 0 && v === top ? v * 2 : 0; });
    },
  },
  underdog: {
    icon: '🐢', name: () => T('Szansa dla maruderów'), multi: true,
    rule: () => T('Kto przed rundą zamyka tabelę, zdobywa podwójnie.'),
    apply: (g, before) => {
      const low = Math.min(...before);
      g.forEach((v, i) => { if (before[i] === low) g[i] = v * 2; });
    },
  },
  stakes: {
    icon: '🔥', name: () => T('Podwójna stawka'), rule: () => T('Przedostatnia runda: wszystkie punkty liczą się podwójnie – tu ważą się losy imprezy!'),
    apply: (g) => g.forEach((v, i) => { g[i] = v * 2; }),
  },
};
// ile punktów zabiera złodziej (punkty za miejsca – 2, suma wyników – piąta część, co najmniej 2)
const p6StealAmount = (pt, victim) => Math.min(pt.points[victim], pt.scoring === 'sum' && pt.rows.length > 1
  ? Math.max(2, Math.ceil(pt.points[victim] / 5)) : 2);

const party6 = (() => {
  const multi = (pt) => pt.rows.length > 1;
  const names = (pt, idx) => idx.map((i) => pt.rows[i].name);
  const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${T('i')} ${xs[xs.length - 1]}`);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const anim = () => animationsOn();

  // modyfikator rundy idx: pierwsza – otwierająca, przedostatnia (gdy rund jest co najmniej 3) – podwójna stawka,
  // pozostałe z „worka” (każdy raz, potem od nowa), bez tego samego dwa razy pod rząd
  function modFor(pt, idx) {
    pt.mods = pt.mods || {};
    if (pt.mods[idx]) return pt.mods[idx];
    let m;
    if (idx === 0) m = 'warm';
    else if (!pt.until && pt.plan.length >= 3 && idx === pt.plan.length - 2) m = 'stakes';
    else {
      if (!pt.modBag || !pt.modBag.length) {
        pt.modBag = shuffle(Object.keys(P6_MODS).filter((k) => !['warm', 'stakes'].includes(k) && (multi(pt) || !P6_MODS[k].multi)));
        if (!multi(pt)) pt.modBag.push('normal');
      }
      const prev = pt.mods[idx - 1];
      let at = pt.modBag.findIndex((k) => k !== prev);
      if (at < 0) at = 0;
      m = pt.modBag.splice(at, 1)[0];
    }
    pt.mods[idx] = m;
    return m;
  }
  const modLabel = (m) => `${P6_MODS[m].icon} ${P6_MODS[m].name()}`;
  const special = (m) => !['warm', 'normal'].includes(m);

  /* ---------- okno teleturnieju (jedno, pełny ekran) ---------- */
  let dlg = null;
  function stage(kind) {
    if (!dlg) {
      dlg = el('dialog', { id: 'p6', class: 'p6', 'aria-live': 'polite' });
      // Esc nie zamyka zapowiedzi ani finału (gra czeka na decyzję); na tablicy wyników – pokazuje szczegóły
      dlg.addEventListener('cancel', (e) => {
        e.preventDefault();
        if (dlg.dataset.kind === 'board') close();
      });
      document.body.append(dlg);
    }
    clearTimers();
    dlg.dataset.kind = kind;
    dlg.replaceChildren(el('div', { class: 'p6-lights', 'aria-hidden': 'true' }));
    if (!dlg.open) dlg.showModal();
    return dlg;
  }
  function close() {
    clearTimers();
    if (dlg && dlg.open) dlg.close();
  }
  let timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; if (fin && fin.iv) { clearInterval(fin.iv); fin.iv = 0; } }
  // wyjście z gry do menu (logo, „wstecz”) – okno teleturnieju znika razem z imprezą
  new MutationObserver(() => {
    if (dlg && dlg.open && !state.party) close();
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

  const host = (text) => el('div', { class: 'p6-host' }, el('span', { class: 'p6-mic', 'aria-hidden': 'true' }, '🎙️'),
    el('p', {}, el('span', { class: 'p6-host-who' }, T('Prowadzący')), text));

  /* ---------- prowadzący: zapowiedź rundy ---------- */
  function introLine(pt, idx, mod) {
    const pts = pt.points;
    const n = pt.rows.length;
    if (idx === 0) {
      return n > 1 ? T('Dobry wieczór w studiu! {0} – rozgrzejcie palce, zaczynamy!', list(names(pt, pt.rows.map((r, i) => i))))
        : T('Dobry wieczór w studiu! {0}, dziś grasz sam przeciw całej muzyce. Powodzenia!', pt.rows[0].name);
    }
    const order = pts.map((p, i) => i).sort((a, b) => pts[b] - pts[a]);
    const lead = pt.rows[order[0]].name;
    const last = pt.rows[order[order.length - 1]].name;
    const byMod = {
      double: () => (n > 1 ? T('Podwójne punkty! {0}, to idealny moment na powrót do gry.', last) : T('Podwójne punkty! {0}, nie zmarnuj tej szansy.', lead)),
      thief: () => T('Złodziej punktów w studiu! {0}, pilnuj kieszeni – z twoim wynikiem jesteś łakomym kąskiem.', lead),
      allin: () => T('Wszystko albo nic! Tylko zwycięzca tej rundy coś dziś zgarnie.'),
      underdog: () => T('{0}, ta runda jest dla ciebie – ostatni w tabeli liczą się podwójnie!', last),
      stakes: () => T('Przedostatnia runda i podwójna stawka. {0}, prowadzenie jeszcze niczego nie gwarantuje!', lead),
    };
    if (byMod[mod]) return byMod[mod]();
    if (n === 1) return pick([() => T('Runda {0}. {1}, masz już {2} pkt – idziemy po więcej!', idx + 1, lead, pts[0]), () => T('Kolejna runda, {0}. Publiczność wstrzymuje oddech.', lead)])();
    const tie = pts[order[0]] === pts[order[1]];
    return pick([
      () => (tie ? T('Na szczycie tłoczno! Runda {0} rozstrzygnie, kto tam zostanie.', idx + 1) : T('{0} prowadzi – wszyscy chcą zrzucić cię z tronu!', lead)),
      () => T('{0}, na razie zamykasz tabelę… ale w tej rundzie wszystko może się zmienić!', last),
      () => T('Runda {0}! Uwaga, teraz nie ma żartów.', idx + 1),
    ])();
  }

  /* ---------- zapowiedź rundy ---------- */
  // zwraca true, gdy pokazała planszę (gra wystartuje po „Zaczynamy!”)
  function intro(pt, go) {
    if (pt.p6intro === pt.idx) return false;
    const idx = pt.idx;
    const id = pt.plan[idx];
    const g = PARTY_GAMES[id];
    const mod = modFor(pt, idx);
    const d = stage('intro');
    const mode = g.mode(pt.rows.length);
    const tile = $(`.mode[data-mode=${mode}] .muted`);
    const roundTxt = pt.until ? T('Runda {0}', idx + 1) : T('Runda {0} z {1}', idx + 1, pt.plan.length);
    const ptsTxt = multi(pt) && pt.scoring !== 'sum' ? T('Punkty: 1. miejsce – 3, 2. – 2, 3. – 1.') : T('Każdy punkt z rundy to punkt imprezy.');
    const goBtn = el('button', { type: 'button', class: 'primary p6-go', onclick: () => countdown() }, T('Zaczynamy!'));
    d.append(
      el('header', { class: 'p6-top' }, el('span', { class: 'p6-round' }, roundTxt)),
      el('div', { class: 'p6-main' },
        el('div', { class: 'p6-icon', 'aria-hidden': 'true' }, g.icon),
        el('h2', { class: 'p6-name' }, T(g.name)),
        tile ? el('p', { class: 'p6-rule' }, tile.textContent.trim()) : null,
        el('div', { class: `p6-mod${special(mod) ? ' hot' : ''}` }, el('b', {}, modLabel(mod)), ' ', P6_MODS[mod].rule()),
        el('p', { class: 'p6-pts' }, '🏅 ', ptsTxt)),
      host(introLine(pt, idx, mod)),
      el('div', { class: 'p6-acts' }, goBtn));
    goBtn.focus();
    function countdown() {
      pt.p6intro = idx;
      const n = el('div', { class: 'p6-count', 'aria-live': 'assertive' });
      d.querySelector('.p6-main').replaceChildren(el('div', { class: 'p6-icon small', 'aria-hidden': 'true' }, g.icon), el('h2', { class: 'p6-name' }, T(g.name)), n);
      d.querySelector('.p6-acts').replaceChildren(el('button', { type: 'button', class: 'ghost', onclick: start }, T('Bez odliczania')));
      let k = 3;
      const step = () => {
        if (k === 0) { start(); return; }
        n.textContent = String(k);
        n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
        fx('tick');
        k -= 1;
        later(step, 650);
      };
      step();
    }
    function start() {
      close();
      fx('place');
      const bar = $('#party-bar');
      if (special(mod)) bar.dataset.mod = modLabel(mod); else delete bar.dataset.mod;
      go();
    }
    return true;
  }

  /* ---------- punkty rundy (modyfikator) ---------- */
  function score(pt, gained) {
    const mod = modFor(pt, pt.idx);
    const before = pt.points.slice();
    const base = gained.slice();
    const skipped = !!state.miniSkipped;
    if (!skipped && P6_MODS[mod].apply) P6_MODS[mod].apply(gained, before);
    // złodziej: zwycięzca (zwycięzcy) rundy – najwięcej zdobytych punktów
    const top = Math.max(...gained);
    const thieves = !skipped && mod === 'thief' && top > 0 ? gained.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0) : [];
    if (!skipped) pt.p6rounds = (pt.p6rounds || 0) + 1;
    pt.p6 = { idx: pt.idx, game: pt.plan[pt.idx], mod, before, base, gained: gained.slice(), skipped, thieves, steals: [] };
    delete $('#party-bar').dataset.mod;
    // tablica wyników nad ekranem podsumowania (pokazuje się po nim)
    setTimeout(() => board(pt), 0);
  }
  const wantsFinal = (pt) => !pt.finalDone && (pt.p6rounds || 0) > 0;

  /* ---------- tablica wyników po rundzie ---------- */
  function boardLine(pt) {
    const r = pt.p6;
    if (r.skipped) return T('Runda pominięta – nikt nic nie zyskał, nikt nic nie stracił.');
    const pts = pt.points;
    if (!multi(pt)) {
      return r.gained[0] > 0 ? pick([() => T('{0} pkt w tej rundzie! Razem masz już {1}.', r.gained[0], pts[0]), () => T('Tak trzymaj, {0} – {1} pkt na koncie.', pt.rows[0].name, pts[0])])()
        : T('{0}, tym razem bez punktów. Następna runda będzie twoja!', pt.rows[0].name);
    }
    const order = pts.map((p, i) => i).sort((a, b) => pts[b] - pts[a]);
    const was = r.before.map((p, i) => i).sort((a, b) => r.before[b] - r.before[a]);
    const lead = order[0];
    const tieTop = order.filter((i) => pts[i] === pts[lead]);
    const big = r.gained.indexOf(Math.max(...r.gained));
    const lines = [];
    if (r.steals.length) { const s = r.steals[r.steals.length - 1]; lines.push(T('Skok na kasę! {0} zabiera {1} pkt – {2} może tylko patrzeć.', pt.rows[s.from].name, s.n, pt.rows[s.to].name)); }
    if (tieTop.length > 1) lines.push(T('Remis na szczycie! {0} idą łeb w łeb.', list(names(pt, tieTop))));
    else if (was[0] !== lead && r.before[was[0]] !== r.before[lead]) lines.push(T('Zmiana lidera! {0} wskakuje na pierwsze miejsce.', pt.rows[lead].name));
    else lines.push(T('{0} prowadzi z {1} pkt. Czy ktoś to zatrzyma?', pt.rows[lead].name, pts[lead]));
    if (r.gained[big] >= 4) lines.push(T('Wielki skok: {0} zgarnia {1} pkt w jednej rundzie!', pt.rows[big].name, r.gained[big]));
    const last = order[order.length - 1];
    if (pts[last] < pts[lead]) lines.push(T('{0} zamyka tabelę – ale w finale każdy ma jeszcze szansę.', pt.rows[last].name));
    return lines.slice(0, 2).join(' ');
  }
  function board(pt) {
    if (!state.party || state.party !== pt || pt.done || !pt.p6) return;
    const r = pt.p6;
    const d = stage('board');
    const g = PARTY_GAMES[r.game];
    const n = pt.rows.length;
    const rows = el('ol', { class: 'p6-board' });
    const note = el('div', { class: 'p6-note' });
    const line = el('div', { class: 'p6-hostbox' });
    const nextIdx = pt.idx;
    const nextG = nextIdx < pt.plan.length && PARTY_GAMES[pt.plan[nextIdx]];
    const nextBtn = el('button', { type: 'button', class: 'primary p6-next', onclick: () => { close(); $('#btn-party-next').click(); } },
      nextG ? (pt.until ? T('▶ Runda {0}: {1} {2}', nextIdx + 1, nextG.icon, T(nextG.name)) : T('▶ Runda {0} z {1}: {2} {3}', nextIdx + 1, pt.plan.length, nextG.icon, T(nextG.name)))
        : T('🔥 Finał: Ostatnie odliczanie'));
    d.append(
      el('header', { class: 'p6-top' },
        el('span', { class: 'p6-round' }, pt.until ? T('Po rundzie {0}', r.idx + 1) : T('Po rundzie {0} z {1}', r.idx + 1, pt.plan.length)),
        el('span', { class: 'p6-chip' }, `${g.icon} ${T(g.name)}`),
        special(r.mod) ? el('span', { class: 'p6-chip hot' }, modLabel(r.mod)) : null),
      el('h2', { class: 'p6-title' }, T('Tablica wyników')),
      rows, note, line,
      el('div', { class: 'p6-acts' },
        el('button', { type: 'button', class: 'ghost', onclick: close }, T('📋 Szczegóły rundy')),
        el('button', { type: 'button', class: 'ghost', onclick: () => { close(); $('#btn-party-stop').click(); } }, T('Zakończ imprezę')),
        nextBtn));
    const paint = (animate) => {
      const pts = pt.points;
      const max = Math.max(1, ...pts);
      const order = pts.map((p, i) => i).sort((a, b) => pts[b] - pts[a] || a - b);
      const was = r.before.map((p, i) => i).sort((a, b) => r.before[b] - r.before[a] || a - b);
      const place = (i) => 1 + new Set(pts.filter((x) => x > pts[i])).size;
      rows.replaceChildren(...order.map((i) => {
        const pl = place(i);
        const moved = n > 1 && r.idx > 0 ? was.indexOf(i) - order.indexOf(i) : 0;
        const delta = pts[i] - r.before[i];
        const num = el('b', { class: 'p6-pts-n' }, String(animate ? r.before[i] : pts[i]));
        const fill = el('span', { class: 'p6-fill', style: `width:${((animate ? r.before[i] : pts[i]) / max) * 100}%` });
        const li = el('li', { class: `p6-row${pl <= 3 && n > 1 ? ` p${pl}` : ''}`, 'data-i': i },
          el('span', { class: 'p6-place' }, n > 1 ? (['🥇', '🥈', '🥉'][pl - 1] || `${pl}.`) : '⭐'),
          el('span', { class: 'p6-who' }, pt.rows[i].name,
            moved > 0 ? el('span', { class: 'p6-move up', title: T('awans') }, ` ▲${moved}`) : moved < 0 ? el('span', { class: 'p6-move down', title: T('spadek') }, ` ▼${-moved}`) : null),
          el('span', { class: 'p6-track' }, fill),
          num,
          el('span', { class: `p6-delta${delta > 0 ? ' up' : delta < 0 ? ' down' : ''}` }, delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '±0'));
        if (animate) {
          later(() => { fill.style.width = `${(pts[i] / max) * 100}%`; }, 60);
          const t0 = performance.now() + 60;
          const tick = () => {
            const k = Math.min(1, Math.max(0, (performance.now() - t0) / 900));
            num.textContent = String(Math.round(r.before[i] + (pts[i] - r.before[i]) * k));
            if (k < 1 && dlg && dlg.open) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
        return li;
      }));
      line.replaceChildren(host(boardLine(pt)));
    };
    paint(anim());
    // modyfikator: co zmienił
    const notes = {
      double: () => T('Podwójne punkty – zdobycze z tej rundy razy dwa!'),
      stakes: () => T('Podwójna stawka – zdobycze z tej rundy razy dwa!'),
      allin: () => (Math.max(...r.gained) > 0 ? T('Wszystko albo nic: punkty zgarnia tylko {0}.', list(names(pt, r.gained.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0))))
        : T('Wszystko albo nic: nikt nie zapunktował.')),
      underdog: () => T('Szansa dla maruderów: ostatni w tabeli zdobyli podwójnie.'),
    };
    if (!r.skipped && notes[r.mod]) note.append(el('p', {}, `${P6_MODS[r.mod].icon} `, notes[r.mod]()));
    // złodziej punktów: zwycięzca wybiera rywala (przy jednym możliwym – od razu)
    const queue = r.thieves.slice();
    const steal = (from, to) => {
      const k = p6StealAmount(pt, to);
      pt.points[to] -= k;
      pt.points[from] += k;
      r.steals.push({ from, to, n: k });
      fx('good');
      partyStandings(false);
      if (typeof saveGame === 'function') saveGame();
      tvSync();
    };
    const nextThief = () => {
      const t = queue.shift();
      if (t == null) {
        if (r.mod === 'thief' && !r.skipped && !r.thieves.length) note.replaceChildren(el('p', {}, '🦹 ', T('Złodziej punktów: nikt nie wygrał rundy – nikt nie kradnie.')));
        nextBtn.disabled = false;
        paint(false);
        nextBtn.focus();
        return;
      }
      const victims = pt.points.map((p, i) => i).filter((i) => i !== t && pt.points[i] > 0);
      if (!victims.length) {
        note.replaceChildren(el('p', {}, '🦹 ', T('{0} chce kraść, ale nikt nie ma punktów!', pt.rows[t].name)));
        nextThief();
        return;
      }
      if (victims.length === 1) {
        steal(t, victims[0]);
        note.replaceChildren(el('p', {}, '🦹 ', T('{0} zabiera {1} pkt – ofiara: {2}!', pt.rows[t].name, r.steals[r.steals.length - 1].n, pt.rows[victims[0]].name)));
        nextThief();
        return;
      }
      nextBtn.disabled = true;
      note.replaceChildren(el('div', { class: 'p6-steal' },
        el('p', {}, '🦹 ', T('{0} kradnie! Komu zabrać punkty?', pt.rows[t].name)),
        el('div', { class: 'p6-victims' }, victims.map((v) => el('button', {
          type: 'button', class: 'p6-victim', onclick: () => {
            steal(t, v);
            note.replaceChildren(el('p', {}, '🦹 ', T('{0} zabiera {1} pkt – ofiara: {2}!', pt.rows[t].name, r.steals[r.steals.length - 1].n, pt.rows[v].name)));
            nextThief();
          },
        }, `${pt.rows[v].name} (−${p6StealAmount(pt, v)})`)))));
    };
    if (r.steals.length) { paint(false); nextBtn.focus(); } else later(nextThief, anim() ? 1000 : 0);
    if (!r.thieves.length) nextBtn.focus();
  }

  /* ---------- finał „Ostatnie odliczanie” ---------- */
  // szybkie pytania bez muzyki: kto śpiewa (podpowiedzi jak w „Kto to śpiewa?”), rok, dekada, która starsza
  const used = new Set();
  function question() {
    let pool = [];
    try { pool = songPool(); } catch (e) { pool = []; }
    if (pool.length < 20) pool = window.SONGS;
    const draw = () => {
      for (let k = 0; k < 30; k++) {
        const s = pool[Math.floor(Math.random() * pool.length)];
        if (s && !used.has(songKey(s))) { used.add(songKey(s)); return s; }
      }
      return pool[Math.floor(Math.random() * pool.length)];
    };
    const song = draw();
    const label = `„${song.t}” – ${mainArtist(song)}`;
    const kind = pick(['artist', 'artist', 'year', 'year', 'older', 'decade']);
    if (kind === 'artist') {
      const opts = quizOptions(song, 'artist');
      if (opts.length === 4) return { q: T('Kto śpiewa „{0}”?', song.t), options: opts };
    }
    if (kind === 'older') {
      const other = pool.find((s) => Math.abs(s.y - song.y) >= 4 && !used.has(songKey(s)) && Math.random() < 0.05)
        || pool.find((s) => Math.abs(s.y - song.y) >= 4);
      if (other) {
        return { q: T('Która piosenka jest starsza?'), options: shuffle([song, other]).map((s) => ({ label: `„${s.t}” – ${mainArtist(s)}`, ok: s.y === Math.min(song.y, other.y) })) };
      }
    }
    if (kind === 'decade') {
      const all = [...new Set(pool.map(decadeOf))].sort((a, b) => a - b);
      if (all.length >= 4) {
        const at = all.indexOf(decadeOf(song));
        const from = Math.max(0, Math.min(at - Math.floor(Math.random() * 4), all.length - 4));
        return { q: T('Z której dekady jest {0}?', label), options: all.slice(from, from + 4).map((dd) => ({ label: decadeLabelLong(dd), ok: dd === decadeOf(song) })) };
      }
    }
    const now = new Date().getFullYear();
    const years = new Set([song.y]);
    for (const dy of shuffle([-1, 1, -2, 2, -3, 3, -5, 5, -8, 8])) {
      if (years.size >= 4) break;
      if (song.y + dy <= now) years.add(song.y + dy);
    }
    return { q: T('W którym roku ukazała się {0}?', label), options: [...years].sort((a, b) => a - b).map((y) => ({ label: String(y), ok: y === song.y })) };
  }

  const FIN_CAP = 60;    // najwyższy podest (sekundy)
  const Q_LIMIT = 7000;  // czas na odpowiedź – potem liczy się jak zła
  let fin = null;
  function finale(pt, done) {
    if (!wantsFinal(pt)) return false;
    const n = pt.rows.length;
    const maxP = Math.max(...pt.points);
    const secs = n > 1 ? pt.points.map((p) => (maxP > 0 ? 15 + Math.round((20 * p) / maxP) : 25)) : [30];
    fin = { pt, done, secs, out: [], alive: pt.rows.map((r, i) => i), turn: 0, q: null, correct: 0, run: false, iv: 0, elapsed: 0, lock: false };
    state.mode = 'party';
    const d = stage('final');
    d.append(
      el('header', { class: 'p6-top' }, el('span', { class: 'p6-round' }, T('Finał')), el('span', { class: 'p6-chip hot' }, n > 1 ? T('⏳ Ostatni na placu wygrywa') : T('⏳ Runda na rekord'))),
      el('div', { class: 'p6-main' },
        el('div', { class: 'p6-icon', 'aria-hidden': 'true' }, '⏳'),
        el('h2', { class: 'p6-name' }, T('Ostatnie odliczanie')),
        el('p', { class: 'p6-rule' }, n > 1
          ? T('Punkty imprezy zamieniają się w sekundy na podeście – i zaczynają uciekać wszystkim naraz. Odpowiadacie po kolei: dobra odpowiedź dodaje sekundy, zła zabiera. Kto spadnie do zera, odpada – ostatni na placu wygrywa imprezę!')
          : T('Masz 30 sekund, które ciągle uciekają. Dobra odpowiedź dodaje 3 s i 1 pkt, zła zabiera 5 s. Ile zdążysz zdobyć?')),
        pillars()),
      host(n > 1 ? T('Wszystko, co zebraliście, teraz zamienia się w czas. {0}, masz najwięcej – ale wystarczy kilka pomyłek…', pt.rows[pt.points.indexOf(maxP)].name)
        : T('{0}, czas na finał! Pobijesz swój rekord?', pt.rows[0].name)),
      el('div', { class: 'p6-acts' }, el('button', { type: 'button', class: 'primary p6-go', onclick: count }, T('Zaczynamy!'))));
    d.querySelector('.p6-go').focus();
    function count() {
      const c = el('div', { class: 'p6-count' });
      d.querySelector('.p6-main').replaceChildren(el('h2', { class: 'p6-name' }, T('Ostatnie odliczanie')), c);
      d.querySelector('.p6-acts').replaceChildren();
      let k = 3;
      const step = () => {
        if (k === 0) { run(); return; }
        c.textContent = String(k);
        c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
        fx('tick');
        k -= 1;
        later(step, 650);
      };
      step();
    }
    return true;
  }
  function pillars() {
    const box = el('div', { class: 'p6-pillars', style: `--n:${fin.pt.rows.length}` });
    fin.pt.rows.forEach((r, i) => box.append(el('div', { class: 'p6-pillar', 'data-i': i },
      el('span', { class: 'p6-secs' }, ''), el('span', { class: 'p6-col' }, el('span', { class: 'p6-lvl' })), el('span', { class: 'p6-pname' }, r.name))));
    paintPillars(box);
    return box;
  }
  function paintPillars(box = dlg && dlg.querySelector('.p6-pillars')) {
    if (!box || !fin) return;
    const active = fin.alive[fin.turn % Math.max(1, fin.alive.length)];
    box.querySelectorAll('.p6-pillar').forEach((p) => {
      const i = Number(p.dataset.i);
      const s = Math.max(0, fin.secs[i]);
      const out = fin.out.includes(i);
      p.classList.toggle('out', out);
      p.classList.toggle('on', fin.run && !out && i === active);
      p.classList.toggle('low', !out && s < 6);
      p.querySelector('.p6-lvl').style.height = `${Math.min(100, (s / FIN_CAP) * 100)}%`;
      p.querySelector('.p6-secs').textContent = out ? '💥' : `${Math.ceil(s)} s`;
    });
  }
  function run() {
    const d = dlg;
    const pt = fin.pt;
    const n = pt.rows.length;
    fin.run = true;
    fin.main = el('div', { class: 'p6-qbox' });
    fin.say = el('div', { class: 'p6-hostbox' });
    d.querySelector('.p6-main').replaceChildren(pillars(), fin.main);
    d.querySelector('.p6-host').replaceWith(fin.say);
    fin.say.append(host(n > 1 ? T('Zegar ruszył! Każda sekunda się liczy.') : T('Zegar ruszył!')));
    d.querySelector('.p6-acts').replaceChildren();
    let t = performance.now();
    fin.iv = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - t) / 1000);
      t = now;
      tickFinal(dt);
    }, 100);
    ask();
  }
  // upływ czasu: wszystkim naraz, coraz szybciej
  function tickFinal(dt) {
    if (!fin || !fin.run) return;
    fin.elapsed += dt;
    const rate = 1 + fin.elapsed / 40;
    for (const i of fin.alive) fin.secs[i] -= dt * rate;
    if (fin.q && !fin.lock && performance.now() - fin.q.at > Q_LIMIT) answer(-1);
    checkOut();
    paintPillars();
    if (fin && fin.q && fin.qbar) fin.qbar.style.width = `${Math.max(0, 100 - ((performance.now() - fin.q.at) / Q_LIMIT) * 100)}%`;
  }
  function checkOut() {
    const pt = fin.pt;
    const gone = fin.alive.filter((i) => fin.secs[i] <= 0);
    if (!gone.length) return;
    const activeBefore = fin.alive[fin.turn % fin.alive.length];
    // kilku naraz – lepszy ten z większą liczbą punktów imprezy
    gone.sort((a, b) => pt.points[a] - pt.points[b]);
    if (pt.rows.length > 1 && gone.length === fin.alive.length) gone.pop();
    for (const i of gone) {
      fin.out.push(i);
      fin.alive = fin.alive.filter((x) => x !== i);
    }
    if (!gone.length) return;
    fx('boom');
    if (pt.rows.length === 1 || fin.alive.length <= 1) { endFinal(); return; }
    fin.say.replaceChildren(host(fin.alive.length === 2 ? T('{0} odpada! Zostało dwoje: {1}. Kto wytrzyma dłużej?', list(names(pt, gone)), list(names(pt, fin.alive)))
      : T('{0} odpada! Dzięki za grę – zostało jeszcze {1}.', list(names(pt, gone)), fin.alive.length)));
    // odpadł ten, kto właśnie odpowiadał – pytanie dla następnego
    if (gone.includes(activeBefore)) {
      fin.turn = fin.turn % fin.alive.length;
      fin.lock = false;
      ask();
    } else fin.turn = fin.alive.indexOf(activeBefore);
  }
  function ask() {
    if (!fin || !fin.run) return;
    const pt = fin.pt;
    const who = fin.alive[fin.turn % fin.alive.length];
    const q = question();
    fin.q = { ...q, who, at: performance.now() };
    fin.lock = false;
    fin.qbar = el('span', { class: 'p6-qfill' });
    fin.main.replaceChildren(
      pt.rows.length > 1 ? el('p', { class: 'p6-turn' }, T('🎯 Odpowiada: {0}', pt.rows[who].name)) : null,
      el('p', { class: 'p6-q' }, q.q),
      el('span', { class: 'p6-qtime' }, fin.qbar),
      el('div', { class: `p6-opts n${q.options.length}` }, q.options.map((o, k) => el('button', {
        type: 'button', class: 'p6-opt', 'data-k': k, onclick: () => answer(k),
      }, el('span', { class: 'p6-key' }, String(k + 1)), el('span', {}, o.label)))));
    paintPillars();
  }
  function answer(k) {
    if (!fin || !fin.run || !fin.q || fin.lock) return;
    const pt = fin.pt;
    const n = pt.rows.length;
    const who = fin.q.who;
    const ok = k >= 0 && fin.q.options[k] && fin.q.options[k].ok;
    fin.lock = true;
    const gain = n > 1 ? 2 + 2 * fin.alive.length : 3;
    const loss = 5;
    fin.secs[who] = ok ? Math.min(FIN_CAP, fin.secs[who] + gain) : fin.secs[who] - loss;
    if (ok && n === 1) fin.correct += 1;
    fx(ok ? 'good' : 'bad');
    fin.main.querySelectorAll('.p6-opt').forEach((b, j) => {
      b.disabled = true;
      if (fin.q.options[j].ok) b.classList.add('ok');
      else if (j === k) b.classList.add('bad');
    });
    const name = pt.rows[who].name;
    fin.say.replaceChildren(host(ok ? (n > 1 ? T('Dobrze, {0}! +{1} s', name, gain) : T('Dobrze! +{0} s i +1 pkt', gain))
      : k < 0 ? T('Czas minął, {0}! −{1} s', name, loss) : (n > 1 ? T('Pudło, {0}! −{1} s', name, loss) : T('Pudło! −{0} s', loss))));
    const q = fin.q;
    checkOut();
    paintPillars();
    if (!fin || !fin.run) return;
    later(() => {
      if (!fin || !fin.run || fin.q !== q) return;
      fin.turn = (fin.alive.indexOf(who) + 1) % fin.alive.length;
      if (!fin.alive.includes(who)) fin.turn = fin.turn % fin.alive.length;
      ask();
    }, 900);
  }
  function endFinal() {
    const f = fin;
    const pt = f.pt;
    f.run = false;
    clearTimers();
    pt.finalDone = true;
    const n = pt.rows.length;
    let title;
    let line;
    if (n > 1) {
      // miejsca: ostatni na placu – 1., potem w odwrotnej kolejności odpadania
      const ranking = [...f.alive, ...f.out.slice().reverse()];
      pt.finalRank = pt.rows.map((r, i) => ranking.indexOf(i));
      pt.last = [];
      const w = pt.rows[ranking[0]].name;
      title = T('🏆 {0} wygrywa imprezę!', w);
      line = T('Ostatni na placu! {0}, studio szaleje – brawa!', w);
    } else {
      pt.points[0] += f.correct;
      pt.last = [f.correct];
      const best = store.get('party6FinalBest', 0);
      if (f.correct > best) store.set('party6FinalBest', f.correct);
      title = T('⏳ Finał: {0} dobrych odpowiedzi (+{0} pkt)', f.correct);
      line = f.correct > best ? T('Nowy rekord finału! Poprzedni: {0}.', best) : T('Rekord finału: {0}. Następnym razem!', best);
    }
    const d = stage('podium');
    const order = n > 1 ? pt.rows.map((r, i) => i).sort((a, b) => pt.finalRank[a] - pt.finalRank[b]) : [0];
    d.append(
      el('header', { class: 'p6-top' }, el('span', { class: 'p6-round' }, T('Finał')), el('span', { class: 'p6-chip hot' }, T('Ostatnie odliczanie'))),
      el('h2', { class: 'p6-title' }, title),
      n > 1 ? el('div', { class: 'p6-podium' }, [1, 0, 2].filter((k) => order[k] != null).map((k) => el('div', { class: `p6-step s${k + 1}` },
        el('span', { class: 'p6-pname' }, pt.rows[order[k]].name),
        el('span', { class: 'p6-block' }, ['🥇', '🥈', '🥉'][k])))) : el('div', { class: 'p6-icon', 'aria-hidden': 'true' }, '⏳'),
      host(line),
      el('div', { class: 'p6-acts' }, el('button', { type: 'button', class: 'primary p6-go', onclick: () => { close(); f.done(); } }, T('🏆 Podsumowanie imprezy'))));
    fx('win');
    celebrate();
    d.querySelector('.p6-go').focus();
    fin = null;
  }
  // klawisze 1–4 w finale
  document.addEventListener('keydown', (e) => {
    if (!fin || !fin.run || !dlg || !dlg.open || e.repeat) return;
    const k = Number(e.key) - 1;
    if (k >= 0 && k < 4) { e.preventDefault(); answer(k); }
  });

  // następna minigra w podsumowaniu (i na dużym ekranie): dopisek z modyfikatorem rundy
  if (UI6) {
    new MutationObserver(() => {
      const pt = state.party;
      const p = $('.party-box > p.muted');
      if (!pt || pt.done || !p || p.dataset.p6 || pt.idx >= pt.plan.length) return;
      const m = modFor(pt, pt.idx);
      if (!special(m)) return;
      p.dataset.p6 = '1';
      p.append(` · ${modLabel(m)}`);
    }).observe($('#ranking'), { childList: true, subtree: true });
  }

  return { intro, score, wantsFinal, finale, modFor, answer: (k) => answer(k), get fin() { return fin; }, close };
})();
