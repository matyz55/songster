'use strict';
// Service worker Songstera: szybkie uruchamianie i działanie bez sieci (poza fragmentami z iTunes).
// Pliki gry: najpierw sieć (zawsze najnowsza wersja), a gdy jej brak – kopia z pamięci podręcznej.
// Flagi i ikony: najpierw pamięć podręczna (nie zmieniają się).
const CACHE = 'songster-v50';
const CORE = ['./', 'index.html', 'style.css', 'js/core.js', 'js/screens.js', 'js/remote.js', 'js/lobby.js', 'js/setup.js', 'js/play.js', 'js/rules.js', 'js/audio.js', 'js/render.js', 'js/settings.js', 'js/modes.js', 'js/playlists.js', 'js/stats.js', 'js/achievements.js', 'js/career.js', 'js/tournament.js', 'js/resume.js', 'js/lyrics.js', 'js/lycheck.js', 'lyrics-catalog.js', 'lyrics-cats.js', 'match.js', 'songs.js', 'songs-sp.js', 'facts.js', 'i18n.js', 'i18n-en.js', 'analytics.js', 'tv.html', 'tv.js', 'net.js', 'dragsort.js', 'js/ui6.js', 'js/ui6-menu.js', 'js/ui6-modes.js', 'js/ui6-setup.js', 'js/ui6-game.js', 'js/ui6-lyrics.js', 'js/ui6-end.js', 'js/ui6-tv.js', 'ui6/base.css', 'ui6/tv.css', 'ui6/menu.css', 'ui6/modes.css', 'ui6/setup.css', 'ui6/game.css', 'ui6/lyrics.css', 'ui6/end.css', 'ui6/party.css', 'js/ui6-party.js',
  'flags/codes.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // tylko własne pliki; zapytania do iTunes i fragmenty audio idą prosto do sieci
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const static_ = /\/(flags|icons)\//.test(url.pathname);
  if (static_) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
