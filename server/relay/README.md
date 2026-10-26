# Serwer pośredniczący Songstera (Cloudflare Workers – plan darmowy)

Gospodarz gry, duży ekran i telefony graczy łączą się przez ten serwer (WebSocket, port 443). Działa w każdej sieci,
także komórkowej, gdzie bezpośrednie połączenie WebRTC często się nie udaje. Serwer niczego nie zapisuje – tylko
przekazuje wiadomości gry w ramach pokoju (4-znakowy kod). Dopóki adres serwera nie jest wpisany w `net.js`
(`RELAY_URL`), gra łączy się jak dawniej (WebRTC i publiczny serwer MQTT).

## Wdrożenie (jednorazowo, ok. 10 minut)

1. **Konto Cloudflare**: wejdź na <https://dash.cloudflare.com/sign-up>, wpisz e-mail i hasło, wybierz
   **Create Account** i potwierdź adres e-mail (link w wiadomości od Cloudflare).
2. W panelu Cloudflare otwórz **Workers & Pages** → **Create application** → wybierz **GitHub**
   (przy pierwszym razie Cloudflare poprosi o połączenie z kontem GitHub – zezwól na dostęp do repozytorium gry).
3. Wybierz repozytorium gry i ustaw:
   - nazwa projektu (Worker): **`songster-relay`** – musi być dokładnie taka jak w `wrangler.jsonc`,
   - gałąź: ta, na której jest katalog `server/relay`,
   - **Root directory** (katalog główny, w ustawieniach budowania): **`server/relay`**,
   - polecenie wdrożenia zostaw domyślne (`npx wrangler deploy`).
   Wybierz **Save and Deploy**.
4. Po wdrożeniu panel pokaże adres w postaci `https://songster-relay.<twoja-subdomena>.workers.dev`.
   Otwórz go w przeglądarce – ma się pokazać napis `Songster relay`.
5. Przekaż ten adres (nie jest tajny) – trafi do `net.js` jako `RELAY_URL` (z `wss://` zamiast `https://`).
   Każda kolejna zmiana w `server/relay` wdroży się sama po wysłaniu na tę gałąź.

Opcjonalnie: w ustawieniach Workera (**Settings** → **Variables**) zmienna `ALLOWED_ORIGINS` z adresem strony gry
(np. `https://matyz55.github.io`) – wtedy z serwera skorzysta tylko gra.

## Limity planu darmowego (dokumentacja Cloudflare)

- 100 000 zapytań dziennie (połączenie urządzenia = zapytanie); wiadomości przychodzące przez WebSocket liczone
  w proporcji 20:1 (100 wiadomości = 5 zapytań); limity odnawiają się o północy UTC.
- Pokój bez ruchu „zasypia” i nie zużywa czasu pracy; podtrzymanie połączenia („ping”) serwer obsługuje bez budzenia pokoju.

## Sprawdzenie lokalne

```
cd server/relay && npx wrangler dev --port 8790
RELAY_TEST_URL=ws://127.0.0.1:8790 npx playwright test tests/relay.spec.mjs tests/devices.spec.mjs
```
