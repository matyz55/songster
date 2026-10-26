// Skrypt wstrzykiwany do stron w testach: zamiast iTunes – odpowiedź zbudowana z bazy piosenek gry,
// a zamiast prawdziwego fragmentu – 30-sekundowy sygnał WAV (jak fragment z iTunes). Dzięki temu testy nie zależą od sieci i limitu iTunes.
(() => {
  const realFetch = window.fetch.bind(window);
  let wav = null;
  const tone = () => {
    if (wav) return wav;
    const sr = 8000; const n = sr * 30; const buf = new ArrayBuffer(44 + n * 2); const v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin((i / sr) * 2 * Math.PI * 440) * 6000, true);
    wav = buf;
    return wav;
  };
  window.__itunesCalls = 0;
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (url.startsWith('https://itunes.apple.com/search')) {
      window.__itunesCalls += 1;
      const term = new URL(url).searchParams.get('term');
      const M = window.SongMatch;
      const song = (window.SONGS || []).find((s) => (s.q || `${M.mainArtist(s)} ${s.t}`) === term);
      const results = song ? [{
        wrapperType: 'track', kind: 'song', artistName: song.ia || M.mainArtist(song), trackName: song.m || song.t, collectionName: song.al || song.t,
        releaseDate: `${song.y}-01-01T00:00:00Z`, previewUrl: `https://audio.test/${encodeURIComponent(term)}.wav`,
        // okładka: mały obrazek SVG (tryb „Okładka z mgły”)
        artworkUrl100: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 10 10%22%3E%3Crect width=%2210%22 height=%2210%22 fill=%22%23e33%22/%3E%3C/svg%3E#100x100bb', trackViewUrl: 'https://music.apple.com/test',
      }] : [];
      return new Response(JSON.stringify({ resultCount: results.length, results }), { headers: { 'content-type': 'application/json' } });
    }
    if (url.startsWith('https://audio.test/')) {
      return new Response(new Blob([tone()], { type: 'audio/wav' }), { headers: { 'content-type': 'audio/wav' } });
    }
    // „Tak to leciało”: tekst z czasami (LRC) – 40 wersów co 4 s, w refrenie (co 4. wers) powtarzany wers
    // wyszukiwanie tekstu (Pierwsze słowa): tytuł i wykonawca jak w zapytaniu, tekst z nagłówkiem do pominięcia
    if (url.startsWith('https://lrclib.net/api/search')) {
      const q = new URL(url).searchParams;
      const plain = `[Zwrotka 1]\nRefren:\npierwszy wers piosenki ${q.get('track_name')}\ndrugi wers tej piosenki\ntrzeci wers`;
      return new Response(JSON.stringify([{ id: 1, trackName: q.get('track_name'), artistName: q.get('artist_name'), plainLyrics: plain }]), { headers: { 'content-type': 'application/json' } });
    }
    if (url.startsWith('https://lrclib.net/api/get/')) {
      const id = url.split('/').pop();
      const pad = (n) => String(n).padStart(2, '0');
      const lines = Array.from({ length: 40 }, (_, i) => {
        const t = 8 + i * 4;
        const text = i % 4 === 3 ? 'tak to leciało w naszej starej piosence' : `wers ${i} ${id} ${'la '.repeat(i % 5)}śpiewamy`.replace(/\s+/g, ' ');
        return `[${pad(Math.floor(t / 60))}:${pad(t % 60)}.00] ${text}`;
      });
      return new Response(JSON.stringify({ id: Number(id), syncedLyrics: lines.join('\n'), duration: 180 }), { headers: { 'content-type': 'application/json' } });
    }
    return realFetch(input, init);
  };
  // odtwarzacz YouTube: czas płynie window.__ytSpeed razy szybciej (domyślnie 40×), bez prawdziwego filmu
  window.__ytSpeed = 40;
  window.YT = { Player: class {
    constructor(elId, opts) { this.opts = opts; this.base = 0; this.t0 = null; this.vid = null; setTimeout(() => opts.events.onReady({ target: this }), 0); }
    loadVideoById(o) {
      this.vid = o.videoId; this.base = o.startSeconds || 0; this.t0 = performance.now();
      // __ytNoPlay: film wczytany, ale sam nie rusza (np. wymaga kliknięcia)
      if (window.__ytNoPlay && window.__ytNoPlay.includes(o.videoId)) { this.t0 = null; return; }
      // __ytFail: film nie odtwarza się w osadzonym odtwarzaczu (błąd 150, bez startu)
      if (window.__ytFail && window.__ytFail.includes(o.videoId)) { this.t0 = null; setTimeout(() => this.opts.events.onError({ data: 150 }), 20); return; }
      setTimeout(() => this.opts.events.onStateChange({ data: 1 }), 10);
    }
    // film czeka w odtwarzaczu (miniatura i ▶) – nie gra, dopóki ktoś nie dotknie ▶
    cueVideoById(o) { this.vid = o.videoId; this.base = o.startSeconds || 0; this.t0 = null; window.__ytCued = o.videoId; setTimeout(() => this.opts.events.onStateChange({ data: 5 }), 5); }
    destroy() { window.__ytDestroyed = (window.__ytDestroyed || 0) + 1; }
    getCurrentTime() { return this.t0 == null ? this.base : this.base + ((performance.now() - this.t0) / 1000) * window.__ytSpeed; }
    pauseVideo() { this.base = this.getCurrentTime(); this.t0 = null; }
    playVideo() { if (this.t0 == null) this.t0 = performance.now(); }
    seekTo(t) { this.base = t; if (this.t0 != null) this.t0 = performance.now(); }
    unloadModule() {}
    setOption() {}
    mute() {}
    stopVideo() { this.pauseVideo(); }
    getPlayerState() { return this.t0 == null ? 2 : 1; }
    getDuration() { return 180; }
  } };
})();
