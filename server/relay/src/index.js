// Songster – serwer pośredniczący dla gry na kilku urządzeniach (gospodarz, duży ekran, telefony graczy).
// Każdy pokój (np. „play-ABCD”) to jeden Durable Object; urządzenia łączą się z nim przez WebSocket (port 443),
// więc połączenie działa w każdej sieci – także w sieci komórkowej, gdzie bezpośrednie WebRTC często zawodzi.
// Serwer niczego nie zapisuje: przekazuje tylko wiadomości gry między gospodarzem a graczami.
//   wss://<adres>/room/<pokój>?role=host           – gospodarz (jeden na pokój)
//   wss://<adres>/room/<pokój>?role=peer&id=<id>   – dołączające urządzenie
// Gospodarz wysyła {to: id, d: wiadomość} (albo {to: id, close: true}); urządzenie wysyła {d: wiadomość}.
// Serwer odsyła: gospodarzowi {t: 'ok'|'taken'}, {t: 'join'|'leave', id}, {from: id, d}; urządzeniu {t: 'ok'|'nohost'|'bye'}, {d}.
// Tekst „ping” dostaje odpowiedź „pong” bez budzenia pokoju (podtrzymanie połączenia za darmo).
import { DurableObject } from 'cloudflare:workers';

const ROOM = /^\/room\/([A-Za-z0-9-]{1,40})$/;
const ID = /^[A-Za-z0-9]{1,24}$/;
const MAX_MSG = 64 * 1024;
const MAX_PEERS = 32;

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  host() { return this.ctx.getWebSockets('host')[0] || null; }

  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const id = url.searchParams.get('id') || '';
    if (role !== 'host' && !(role === 'peer' && ID.test(id))) return new Response('bad request', { status: 400 });
    const [client, server] = Object.values(new WebSocketPair());
    const send = (m) => server.send(JSON.stringify(m));
    if (role === 'host') {
      this.ctx.acceptWebSocket(server, ['host']);
      server.serializeAttachment({ role });
      // kod pokoju zajęty przez innego gospodarza – ten musi wylosować inny
      if (this.ctx.getWebSockets('host').length > 1) { send({ t: 'taken' }); server.close(4009, 'taken'); }
      else send({ t: 'ok' });
    } else {
      const tag = 'peer:' + id;
      // to samo urządzenie łączy się ponownie – stare połączenie zamykamy
      for (const old of this.ctx.getWebSockets(tag)) old.close(4001, 'replaced');
      this.ctx.acceptWebSocket(server, ['peer', tag]);
      server.serializeAttachment({ role, id });
      const host = this.host();
      if (!host) { send({ t: 'nohost' }); server.close(4004, 'no host'); }
      else if (this.ctx.getWebSockets('peer').length > MAX_PEERS) { send({ t: 'full' }); server.close(4013, 'full'); }
      else { send({ t: 'ok' }); host.send(JSON.stringify({ t: 'join', id })); }
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(message); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const me = ws.deserializeAttachment() || {};
    if (me.role === 'host') {
      if (!ID.test(String(m.to))) return;
      for (const peer of this.ctx.getWebSockets('peer:' + m.to)) {
        if (m.close) { peer.send(JSON.stringify({ t: 'bye' })); peer.close(1000, 'closed by host'); } else peer.send(JSON.stringify({ d: m.d }));
      }
      return;
    }
    const host = this.host();
    if (host && 'd' in m) host.send(JSON.stringify({ from: me.id, d: m.d }));
  }

  async webSocketClose(ws, code) {
    const me = ws.deserializeAttachment() || {};
    if (me.role === 'host') {
      // gospodarz zniknął – urządzenia dostają „bye” (same połączą się ponownie, gdy wróci)
      if (code === 4009) return;
      for (const peer of this.ctx.getWebSockets('peer')) { try { peer.send(JSON.stringify({ t: 'bye' })); peer.close(1000, 'host gone'); } catch (e) { /* zamknięte */ } }
      return;
    }
    if (code === 4001) return; // zastąpione nowym połączeniem tego samego urządzenia
    const host = this.host();
    if (host) host.send(JSON.stringify({ t: 'leave', id: me.id }));
  }

  async webSocketError(ws) { await this.webSocketClose(ws, 1011); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(ROOM);
    if (!m) return new Response('Songster relay', { status: url.pathname === '/' ? 200 : 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    // tylko strony gry (ALLOWED_ORIGINS w wrangler.jsonc, adresy po przecinku) i uruchomienie lokalne
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (allowed.length && !local && !allowed.includes(origin)) return new Response('forbidden', { status: 403 });
    const room = env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase()));
    return room.fetch(request);
  },
};
