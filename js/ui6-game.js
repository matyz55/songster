'use strict';
// Songster 6.0 – ekran gry: zmiany układu dla nowego wyglądu (działa tylko przy UI6).
// Ekran gry dzieli się na strefy (nagłówek tury, płyta i odkrycie, odpowiedzi, oś czasu, przyciski) – układ stref
// zależy od orientacji i miejsca (ui6/game.css). Oś czasu pokazuje zawsze wszystkie karty: do 10 kart mieści się
// w całości (karty i „＋” robią się zwarte), dopiero dłuższa przewija się sama (data-ui6-scroll).
if (UI6) {
  (() => {
    const turn = $('#screen-game .player-turn');
    if (!turn) return;
    const tl = $('#timeline');
    // strefy: elementy zostają tymi samymi węzłami (gra odwołuje się do nich przez id)
    const zone = (cls, ids) => {
      const kids = ids.map((s) => $(s)).filter(Boolean);
      const box = el('div', { class: `g-zone ${cls}` });
      turn.insertBefore(box, kids[0]);
      box.append(...kids);
      return box;
    };
    zone('g-media', ['#cover-fog', '#words-box', '#screen-game .mystery', '#audio-note', '#climb-ladder']);
    // drabinka „Dekadowej wspinaczki”: szczeble dzielą wysokość drabinki (wypełnia wolne miejsce pod płytą)
    const ladder = $('#climb-ladder');
    const fitLadder = () => {
      const rows = Number(ladder.style.getPropertyValue('--rows')) || ladder.querySelectorAll('.cl-rung').length;
      if (!rows || !ladder.clientHeight) return;
      const r = Math.max(innerHeight < 500 ? 15 : 20, Math.min(64, Math.floor((ladder.clientHeight - 8) / rows)));
      if (ladder.style.getPropertyValue('--rung') !== `${r}px`) ladder.style.setProperty('--rung', `${r}px`);
    };
    new ResizeObserver(fitLadder).observe(ladder);
    new MutationObserver(fitLadder).observe(ladder, { childList: true });
    zone('g-side', ['#special-badge', '#buzz-who', '#buzzers', '#bingo-boards', '#guess-form', '#hint']);
    const board = zone('g-board', ['#drag-card', '#timeline']);
    $('#vinyl').closest('.mystery').classList.add('g-player');

    /* ---------- bingo: plansze na stronach (zakładki z imionami graczy) ---------- */
    const bingo = $('#bingo-boards');
    const bingoBox = el('div', { class: 'ui6-pages g-bingo-pages' });
    bingo.parentElement.insertBefore(bingoBox, bingo);
    bingoBox.append(bingo);
    bingo.classList.add('ui6-flow');
    ui6Pager(bingoBox, { tabs: ':scope > .bingo-board > .bingo-name' });
    // pudełko stron widoczne tylko razem z planszami
    const syncBingo = () => {
      const on = !bingo.classList.contains('hidden');
      bingoBox.classList.toggle('hidden', !on);
      if (bingoBox.nextElementSibling && bingoBox.nextElementSibling.matches('.ui6-nav') && !on) bingoBox.nextElementSibling.classList.add('hidden');
    };
    new MutationObserver(syncBingo).observe(bingo, { attributes: true, attributeFilter: ['class'] });
    syncBingo();
    // na szerokim ekranie wszystkie plansze obok siebie (kolumna na planszę), na wąskim – po jednej na stronę
    const bingoCols = () => {
      const n = bingo.children.length;
      if (!n || !bingoBox.clientWidth) return;
      const gap = parseFloat(getComputedStyle(bingo).columnGap) || 0;
      const min = 15 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      const w = Math.max(min, Math.floor((bingoBox.clientWidth - gap * (n - 1)) / n) - 1);
      bingo.style.columnWidth = `${Math.min(w, 34 * min / 15)}px`;
    };
    new MutationObserver(bingoCols).observe(bingo, { childList: true });
    new ResizeObserver(bingoCols).observe(bingoBox);

    /* ---------- osie pozostałych graczy: przełącznik (telefon) albo zwarte wiersze lat (duży ekran) ---------- */
    const others = $('#others');
    const sb = $('#scoreboard');
    // wyniki w karcie tury: w pionie na samej górze, poziomo nad osią (lewa kolumna)
    const row = el('div', { class: 'g-sbrow' });
    turn.insertBefore(row, turn.firstElementChild);
    const othersBtn = el('button', { type: 'button', class: 'ghost g-others-btn hidden', 'aria-expanded': 'false', 'aria-controls': 'others' }, '👀');
    row.append(sb, othersBtn);
    othersBtn.addEventListener('click', () => {
      const open = !others.classList.contains('ui6-open');
      others.classList.toggle('ui6-open', open);
      othersBtn.setAttribute('aria-expanded', String(open));
      othersBtn.textContent = open ? '✕' : '👀';
    });
    // okno z osiami tuż pod paskiem wyników; stuknięcie w nie zamyka
    others.addEventListener('click', () => othersBtn.click());
    const placeOthers = () => {
      const scr = $('#screen-game');
      if (!row.offsetParent) return;
      const top = Math.round(row.getBoundingClientRect().bottom - scr.getBoundingClientRect().top + 6);
      others.style.top = `${top}px`;
      others.style.maxHeight = `${scr.clientHeight - top - 10}px`;
    };
    othersBtn.addEventListener('click', placeOthers);
    new ResizeObserver(placeOthers).observe(row);
    const syncOthers = () => {
      othersBtn.classList.toggle('hidden', others.classList.contains('hidden'));
      const t = others.querySelector('h2') ? others.querySelector('h2').textContent : '';
      othersBtn.title = t;
      othersBtn.setAttribute('aria-label', t);
    };
    new MutationObserver(syncOthers).observe(others, { attributes: true, attributeFilter: ['class'], childList: true });
    syncOthers();
    // pasek wyników z jednym graczem jest ukryty – wiersz też
    const syncSb = () => row.classList.toggle('hidden', sb.classList.contains('hidden') && othersBtn.classList.contains('hidden'));
    new MutationObserver(syncSb).observe(sb, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(syncSb).observe(othersBtn, { attributes: true, attributeFilter: ['class'] });
    syncSb();

    /* ---------- pasek wyników: imię nad wynikiem, krótko („1/10 🪙🪙” zamiast „1/10 kart · 🪙🪙”) ---------- */
    const tidyScores = () => {
      for (const sc of sb.children) {
        if (sc.querySelector('.sc-n')) continue;
        const [name, ...rest] = [...sc.childNodes];
        if (!name) continue;
        if (rest[0] && rest[0].nodeType === 3 && rest[0].textContent.trim() === ':') rest.shift().remove();
        rest.forEach((n) => { if (n.nodeType === 3) n.textContent = n.textContent.replace(/^\/(\d+)\D.*$/, '/$1 '); });
        const nm = el('span', { class: 'sc-n' });
        sc.insertBefore(nm, name);
        nm.append(name);
        const v = el('span', { class: 'sc-v' });
        v.append(...rest);
        sc.append(v);
      }
    };
    new MutationObserver(tidyScores).observe(sb, { childList: true });
    tidyScores();

    /* ---------- żetony: „🪙 3” (i „(🪙 3)” na przyciskach) jako jednakowy złoty znaczek ---------- */
    const COIN = /\(?🪙\s*(\d+)\)?/;
    const coinify = (root) => {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (COIN.test(n.data) && !n.parentElement.closest('.ui6-coin, script, style') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      const list = [];
      while (walk.nextNode()) list.push(walk.currentNode);
      for (let n of list) {
        let m;
        while ((m = COIN.exec(n.data))) {
          const rest = n.splitText(m.index);
          n = rest.splitText(m[0].length);
          const chip = el('span', { class: 'ui6-coin', 'aria-label': T('Żetony: {0}', m[1]) }, el('span', { class: 'ui6-coin-i', 'aria-hidden': 'true' }, '🪙'), m[1]);
          rest.replaceWith(chip);
        }
      }
    };
    const scr = $('#screen-game');
    new MutationObserver((recs) => {
      for (const r of recs) {
        const t = r.type === 'characterData' ? r.target.parentElement : r.target;
        if (t && !t.closest('.ui6-coin')) coinify(t);
      }
    }).observe(scr, { childList: true, subtree: true, characterData: true });
    coinify(scr);

    /* ---------- gęstość: gdy karta tury się nie mieści, chowamy po kolei mniej ważne rzeczy ---------- */
    const LEVELS = ['g-d1', 'g-d2', 'g-d3', 'g-d4'];
    let fitting = false;
    // za dużo treści: karta wystaje albo któraś strefa nie mieści się w swoim polu siatki (nachodziłaby na sąsiednią)
    const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
    const turnOver = () => {
      if (turn.scrollHeight > turn.clientHeight + 1 || turn.scrollWidth > turn.clientWidth + 1) return true;
      const zs = [...turn.children].filter((z) => z.offsetParent && getComputedStyle(z).position !== 'absolute');
      if (zs.some((z) => z !== board && (z.scrollHeight > z.clientHeight + 1 || z.scrollWidth > z.clientWidth + 1))) return true;
      const rs = zs.map((z) => z.getBoundingClientRect());
      return rs.some((r, i) => rs.some((q, j) => j > i && overlap(r, q)));
    };

    /* ---------- oś czasu: zawsze wszystkie karty ---------- */
    // Do 10 kart oś mieści się w całości: najpierw pełne karty, potem cienkie „＋” między kartami, potem karty w jednej
    // linijce, na końcu (pionowa oś, gdy jest szerokość) – w dwóch kolumnach; w razie potrzeby reszta karty tury oddaje
    // miejsce (poziomy gęstości). Dopiero przy więcej niż 10 kartach oś może się przewijać (sama, nigdy cała strona) –
    // dostaje wtedy data-ui6-scroll i przewija się do wybranego miejsca / nowej karty.
    const TL_MAX = 10;
    const TL_LEVELS = [[], ['ui6-thin'], ['ui6-thin', 'ui6-compact'], ['ui6-thin', 'ui6-compact', 'ui6-cols2']];
    const TL_CLS = ['ui6-thin', 'ui6-compact', 'ui6-cols2'];
    const isCard = (e) => e.classList.contains('tcard');
    const horizontal = () => getComputedStyle(tl).flexDirection.startsWith('row');
    const tlOn = () => !tl.classList.contains('hidden') && !!tl.offsetParent && tl.children.length > 0;
    const tlOver = () => tlOn() && (tl.scrollWidth > tl.clientWidth + 1 || tl.scrollHeight > tl.clientHeight + 1);
    // pełny tytuł i wykonawca w podpowiedzi (w jednej linijce bywają skrócone „…”)
    function tagCards() {
      for (const c of tl.children) {
        if (!isCard(c) || c.title) continue;
        const t = c.querySelector('.t'); const a = c.querySelector('.a'); const y = c.querySelector('.y');
        if (!c.classList.contains('start')) c.title = `${y ? y.textContent : ''} · ${t ? t.textContent : ''} – ${a ? a.textContent : ''}`;
      }
    }
    let wideSong = null;
    function setTl(lv, scroll) {
      tl.classList.remove(...TL_CLS);
      tl.classList.add(...TL_LEVELS[lv]);
      const compact = TL_LEVELS[lv].includes('ui6-compact');
      tl.querySelectorAll('.tcard .t, .tcard .a').forEach((e) => { if (compact) e.dataset.ui6Trunc = ''; else delete e.dataset.ui6Trunc; });
      if (scroll) tl.setAttribute('data-ui6-scroll', ''); else tl.removeAttribute('data-ui6-scroll');
      // dwie kolumny osi potrzebują szerszej lewej kolumny
      // (ta sama piosenka: po odkryciu układ kolumn zostaje, żeby przyciski nie skakały)
      turn.classList.toggle('g-tlwide', TL_LEVELS[lv].includes('ui6-cols2') || (wideSong != null && wideSong === state.current));
    }
    // najpierw oś (od najmniej zwartej), potem kolejne poziomy gęstości karty tury
    function fitAll() {
      if (fitting || !turn.offsetParent) return;
      fitting = true;
      try {
        tagCards();
        const on = tlOn();
        const h = on && horizontal();
        const cards = on ? [...tl.children].filter(isCard).length : 0;
        // dwie kolumny tylko w pionowej osi obok reszty karty tury (poziomy ekran)
        const wide = !h && turn.clientWidth >= 560 && matchMedia('(min-aspect-ratio: 11/10)').matches;
        const lvs = on ? TL_LEVELS.map((x, i) => i).filter((i) => i < 3 || wide) : [0];
        const tryAll = (scroll, from = 0) => {
          for (const d of [null, ...LEVELS].slice(from)) {
            turn.classList.remove(...LEVELS);
            if (d) turn.classList.add(...LEVELS.slice(0, LEVELS.indexOf(d) + 1));
            // najmniej zwarta oś, która się mieści (zwarta oś nie pomoże, gdy za dużo jest reszty karty tury)
            for (const lv of scroll ? [2] : lvs) {
              setTl(lv, scroll);
              if (scroll || !tlOver()) { if (!turnOver()) return true; break; }
            }
          }
          return false;
        };
        turn.classList.remove(...LEVELS);
        setTl(0, false);
        // bez osi albo z osią, która się mieści – od razu; za długa (ponad 10 kart) – przewija się sama
        const ok = tryAll(false);
        if (!ok) {
          // przewijana oś na telefonie w pionie: reszta karty tury od razu zwarta, żeby oś pokazała więcej kart
          if (cards > TL_MAX) tryAll(true, !h && matchMedia('(max-aspect-ratio: 11/10)').matches ? 2 : 0);
          else {
            // nic się nie mieści: najgęstsza karta tury i najmniej zwarta oś, która się mieści
            turn.classList.add(...LEVELS);
            for (const lv of lvs) { setTl(lv, false); if (!tlOver()) break; }
          }
        }
        if (ok && tl.classList.contains('ui6-cols2')) wideSong = state.current;
        if (tl.hasAttribute('data-ui6-scroll')) focusTl(h);
        fitSuggest();
      } finally {
        moTurn.takeRecords();
        moTl.takeRecords();
        fitting = false;
      }
    }
    // przewijana oś: wybrane miejsce, wyzwanie, znacznik pomyłki albo nowa karta na środku (tylko gdy się zmieniło)
    let focusSig = '';
    function focusTl(h) {
      const items = [...tl.children];
      const f = tl.querySelector('.drop-over') || tl.querySelector('.slot.chosen, .slot.challenge, .mark.bad, .tcard.new, .mark.ok');
      const sig = `${items.length}:${f ? `${items.indexOf(f)}${f.className}` : ''}`;
      const r = f ? f.getBoundingClientRect() : null; const b = tl.getBoundingClientRect();
      const seen = r && (h ? r.left >= b.left - 1 && r.right <= b.right + 1 : r.top >= b.top - 1 && r.bottom <= b.bottom + 1);
      if (!f || (sig === focusSig && seen)) { focusSig = sig; return; }
      focusSig = sig;
      if (h) tl.scrollLeft += r.left - b.left - (b.width - r.width) / 2;
      else tl.scrollTop += r.top - b.top - (b.height - r.height) / 2;
    }
    let fitRaf = 0;
    const fitLater = () => { if (!fitting) { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitAll); } };
    const moTurn = new MutationObserver(fitLater);
    moTurn.observe(turn, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], characterData: true });
    // nowa oś (render) – od razu, żeby nie mignęła w złym układzie
    const moTl = new MutationObserver(() => { if (!fitting) fitAll(); });
    moTl.observe(tl, { childList: true });
    new ResizeObserver(fitLater).observe(turn);
    new ResizeObserver(fitLater).observe(board);

    /* ---------- bez przewijania: gra czasem przewija do wybranego miejsca (scrollIntoView) – tu wszystko jest widoczne
       (poza długą osią z data-ui6-scroll, która przewija się sama) ---------- */
    for (const e of [tl, board, turn, $('#screen-game')]) {
      e.addEventListener('scroll', () => {
        if (e === tl && tl.hasAttribute('data-ui6-scroll')) return;
        if (e.scrollTop || e.scrollLeft) { e.scrollTop = 0; e.scrollLeft = 0; }
      });
    }
    // przeciąganie karty przy brzegu przewijanej osi – oś przewija się sama
    let dragXY = null; let dragRaf = 0;
    const dragScroll = () => {
      dragRaf = 0;
      if (!dragXY || !$('#drag-card.dragging') || !tl.hasAttribute('data-ui6-scroll')) return;
      const r = tl.getBoundingClientRect(); const edge = 44;
      const [x, y] = dragXY;
      if (horizontal()) {
        if (y > r.top && y < r.bottom) { if (x < r.left + edge) tl.scrollLeft -= 10; else if (x > r.right - edge) tl.scrollLeft += 10; }
      } else if (x > r.left && x < r.right) {
        if (y < r.top + edge) tl.scrollTop -= 10; else if (y > r.bottom - edge) tl.scrollTop += 10;
      }
      dragRaf = requestAnimationFrame(dragScroll);
    };
    document.addEventListener('pointermove', (e) => {
      if (!$('#drag-card.dragging')) { dragXY = null; return; }
      dragXY = [e.clientX, e.clientY];
      if (!dragRaf) dragRaf = requestAnimationFrame(dragScroll);
    }, { passive: true });

    /* ---------- po odkryciu: status mówi o wyniku (zamiast „Posłuchaj i wybierz…”) ---------- */
    const reveal = $('#reveal');
    const status = $('#mystery-status');
    const syncResult = () => {
      const on = !reveal.classList.contains('hidden') && reveal.children.length > 0;
      const v = on ? reveal.querySelector(':scope > .verdict:not(.small-verdict)') : null;
      reveal.querySelectorAll('.ui6-dup').forEach((x) => { if (x !== v) x.classList.remove('ui6-dup'); });
      if (v && !v.classList.contains('ui6-dup')) v.classList.add('ui6-dup');
      const want = { 'ui6-res': on, 'ui6-res-none': on && !v, ok: !!v && !v.classList.contains('bad'), bad: !!v && v.classList.contains('bad') };
      for (const [c, x] of Object.entries(want)) if (status.classList.contains(c) !== x) status.classList.toggle(c, x);
      if (v && status.textContent !== v.textContent) status.textContent = v.textContent;
    };
    new MutationObserver(syncResult).observe(reveal, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true, characterData: true });
    // gra pisze nowy status przy następnej piosence – gdy odkrycie jest widoczne, wracamy do wyniku
    new MutationObserver(() => { if (!reveal.classList.contains('hidden') && status.classList.contains('ui6-res') && !status.classList.contains('ui6-res-none')) syncResult(); })
      .observe(status, { childList: true, characterData: true, subtree: true });
    syncResult();

    /* ---------- podpowiedzi: tylko tyle, ile mieści się nad polem (albo nad klawiaturą) – bez przewijania listy ---------- */
    const sug = $('#guess-suggest');
    function fitSuggest() {
      if (sug.classList.contains('hidden')) return;
      sug.style.maxHeight = 'none';
      const lis = [...sug.children];
      lis.forEach((li, i) => li.classList.toggle('ui6-cut', i >= 6 && !li.classList.contains('active')));
      // lista nie może wyjść poza okno ani (w trybie pisania) poza kartę tury
      const kbd = document.documentElement.classList.contains('kbd');
      const vh = window.visualViewport ? window.visualViewport.height : innerHeight;
      const tooBig = () => {
        const r = sug.getBoundingClientRect();
        const t = turn.getBoundingClientRect();
        return r.top < 2 || r.bottom > vh - 2 || sug.scrollHeight > sug.clientHeight + 1 || (kbd && (r.bottom > t.bottom - 4 || turnOver()));
      };
      while (tooBig()) {
        const vis = lis.filter((li) => !li.classList.contains('ui6-cut'));
        if (vis.length <= 1) break;
        (vis.filter((li) => !li.classList.contains('active')).pop() || vis.pop()).classList.add('ui6-cut');
      }
    }
    new MutationObserver(fitSuggest).observe(sug, { childList: true, attributes: true, attributeFilter: ['class'] });
  })();
}
