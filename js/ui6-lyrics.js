'use strict';
// Songster 6.0 – lyrics: zmiany układu dla nowego wyglądu (działa tylko przy UI6)
// Na telefonach drabinka kwot jest wąskim paskiem (kwota, o którą toczy się gra) – stuknięcie pokazuje całą drabinkę.
if (UI6) {
  const ladder = $('#ly-ladder');
  const strip = matchMedia('(orientation: portrait), (max-height: 520px), (max-width: 760px)');
  const sync = () => {
    ladder.classList.add('ly-strip');
    if (strip.matches) {
      ladder.setAttribute('role', 'button');
      ladder.setAttribute('tabindex', '0');
      ladder.setAttribute('aria-expanded', String(ladder.classList.contains('open')));
      ladder.setAttribute('aria-label', T('Drabinka kwot – stuknij, żeby zobaczyć całą'));
    } else {
      ['role', 'tabindex', 'aria-expanded', 'aria-label'].forEach((a) => ladder.removeAttribute(a));
    }
  };
  const toggle = () => {
    if (!strip.matches) return;
    ladder.classList.toggle('open');
    sync();
  };
  ladder.addEventListener('click', toggle);
  // przerwa na odpowiedź: rozwinięta drabinka zwija się sama (miejsce na kropki, pole i koła ratunkowe)
  new MutationObserver(() => {
    if (ladder.classList.contains('open') && $('#ly-input')) { ladder.classList.remove('open'); sync(); }
  }).observe($('#ly-answer'), { childList: true });
  ladder.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  strip.addEventListener('change', sync);
  sync();
  // na wąskim telefonie pominięcie piosenki w sztafecie to sama ikonka ⏭ – pełny napis jako podpowiedź
  const skipSong = $('#btn-ly-skip-song');
  if (skipSong) skipSong.title = T('⏭ Pomiń tę piosenkę');
}
