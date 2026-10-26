# Songster 🎵

Przeglądarkowa gra muzyczna: układanie piosenek na osi czasu (inspirowane planszówką
Hitster) oraz tryb w stylu „Jaka to melodia”. Polskie i zagraniczne przeboje od lat 50. do dziś.

**Zagraj:** https://matyz55.github.io/songster/ (po włączeniu GitHub Pages)

Historia wszystkich wersji gry: [CHANGELOG.md](CHANGELOG.md).

## Tryby gry

Na ekranie startowym wybiera się **Jeden gracz** albo **Multiplayer**:

- **Jeden gracz** – lista trybów dla jednej osoby (oś czasu, na czas, starsza czy nowsza, pojedynek dekad,
  Jaka to melodia, krok po kroku i impreza).
- **Multiplayer** – najpierw lobby: lista graczy (osoby grające na tym urządzeniu i ci, którzy dołączyli
  telefonem przez kod QR), potem wybór trybu. Gracze z telefonami głosują na tryb (głosy widać na kafelkach,
  także na dużym ekranie), a decyzję podejmuje gospodarz. Po podsumowaniu gry gospodarz wybiera: jeszcze raz
  ten sam tryb z tymi samymi ustawieniami (gra rusza od razu), inny tryb (lobby i telefony zostają połączone)
  albo menu główne (pokój jest zamykany, telefony się rozłączają).
- **Impreza – minigry** – seria krótkich minigier opartych na pozostałych trybach (Jaka to melodia, krok po
  kroku, pojedynek dekad, starsza czy nowsza – w multiplayerze po kolei i bez kończenia na pomyłce, Kto pierwszy?,
  oś czasu – wyścig do 4 kart albo minuta na czas dla jednej osoby). Liczba minigier i ich wybór w ustawieniach.
  Kilku graczy dostaje 3/2/1 pkt za miejsca w każdej minigrze; jedna osoba sumuje wyniki i bije rekord.

- **Oś czasu – 1 gracz** – układasz piosenki na osi czasu wg roku wydania;
  masz ograniczoną liczbę pomyłek. Wpisanie poprawnego tytułu i wykonawcy daje żeton.
- **Oś czasu – multiplayer** – 2–16 graczy przy jednym urządzeniu lub na własnych telefonach, z wyzwaniami
  i żetonami jak w planszówce. Żetony: 1 = pominięcie piosenki (gra najpierw pokazuje, co to było),
  3 = kupno karty – przed odkryciem na oś trafia grana piosenka, po odkryciu losowa karta z talii.
- **Oś czasu – drużyny** – 2–16 drużyn, każda ze wspólną osią czasu; członkowie drużyny
  odpowiadają po kolei (gra pokazuje, kto teraz zgaduje). Zasady jak w multiplayerze.
- **Jaka to melodia** – 1–16 graczy po kolei odgadują tytuł, wykonawcę albo oba. Odpowiedź wpisuje się
  w jedno pole – od 3 liter pojawiają się podpowiedzi ze wszystkich piosenek w bazie (także przy osi czasu).
  Wielkość liter, polskie znaki i drobne literówki nie mają znaczenia. Przy duetach
  i utworach kilku wykonawców wystarczy podać jednego z nich.
- **Melodia krok po kroku** – najpierw 1 s fragmentu, potem 2, 4 i 8 s. Odgadnięcie
  daje 4/3/2/1 pkt (za każdą zgadywaną część), błędna odpowiedź wydłuża fragment,
  a podpowiedź z pierwszą literą kosztuje 1 punkt.

- **Na czas** – jak najwięcej poprawnie ułożonych kart w 1/2/3/5 minut (czas płynie tylko
  podczas słuchania i układania); ranking 10 najlepszych wyników dla każdego limitu i poziomu.
- **Starsza czy nowsza?** – czy piosenka jest starsza, czy nowsza od poprzedniej karty;
  seria bez pomyłki i rekord.
- **Pojedynek dekad** – dwie dekady (losowe lub wybrane), trzeba wskazać, z której jest piosenka.
- **Kto pierwszy?** – 2–16 osób przy jednym urządzeniu albo na telefonach, każda ma przycisk i klawisz (domyślnie 1–8,
  przy większej liczbie graczy kolejno 9, 0, Q, P, Z, M, A, L, W, O; w ustawieniach każdy gracz może przypisać własny);
  kto pierwszy naciśnie, ten odpowiada: +1 pkt za dobrą odpowiedź, −1 za złą. O kolejności decyduje czas naciśnięcia
  z poprawką na opóźnienie połączenia telefonu.
- **Współpraca** – wszyscy razem przeciw grze: wspólna oś czasu i wspólny limit pomyłek, odpowiedzi po kolei.
- **Rok co do roku** – wpisz rok wydania: dokładnie 3 pkt, do 2 lat różnicy 1 pkt.
- **Wyzwanie dnia** – 10 piosenek, ten sam zestaw dla wszystkich danego dnia; wpisuje się rok, wynik (🟩/🟨/⬛)
  można udostępnić; liczy się pierwsze podejście dnia.
- **Kto to śpiewa?** i **Skąd jest wykonawca?** – cztery odpowiedzi do wyboru (wykonawcy / kraje z flagami), 1 pkt za dobrą.
- **Licytacja** – najpierw stawka 1–3 pkt, potem wybór dekady; dobrze – zyskujesz stawkę, źle – tracisz.
- **Ułóż piątkę** – pięć krótkich fragmentów (A–E) na liście do przeciągania (albo przesuwania ▲▼) od najstarszego
  do najnowszego, 90 s od pierwszego odtworzenia; punkt za każdą dobrze ułożoną sąsiednią parę + premia za całość (do 5 pkt).
- **Bingo muzyczne** – plansza 3×3, 4×4 albo 5×5 (w ustawieniach) z kategoriami; przy każdej piosence zaznacza się
  pasujące pole, cały wiersz, kolumna albo przekątna to BINGO.
- **Liga wieczoru** – kolejne gry w tym samym lobby: 3/2/1 pkt za miejsca w każdej grze, tabela pod wynikami.
- **Kto za tym stoi?** – pytanie z danych Wikidata o graną piosenkę (autor tekstu, kompozytor, producent, album,
  miejscowość wykonawcy, prawdziwe nazwisko), cztery odpowiedzi.
- **Z jakiego to ekranu?** – piosenka z filmu, serialu, musicalu albo gry (pole `w:` w songs.js i dane z Wikidata),
  cztery tytuły do wyboru.
- **Łańcuch skojarzeń** – każda kolejna piosenka łączy się z poprzednią (rok, kraj spoza PL/US/GB, autor muzyki lub
  tekstu z Wikidata, słowo w tytule); podpowiedź mówi, co je łączy, a z czterech piosenek pasuje do niej tylko jedna.
- **Dekadowa wspinaczka** – piosenka z dekady, na której stoi gracz; rok z dokładnością do 2 lat – dekada w górę,
  pomyłka – w dół; wygrywa, kto pierwszy dotrze do lat 20.
- **Pierwsze słowa** – trzy pierwsze słowa tekstu (lrclib.net, pobierany w trakcie gry), potem pierwszy wers, dwa
  wersy i 10 s fragmentu: 4/3/2/1 pkt.
- **Sztafeta karaoke** – wariant „Tak to leciało!” dla kilku graczy: w jednej piosence 3–4 przerwy, przy każdej
  odpowiada kolejny gracz; 1 pkt za dobrze dokończony wers.
- **Kariera** – 18 etapów (różne tryby i zestawy piosenek, js/career.js), do 3 gwiazdek za wynik; gwiazdka odblokowuje
  następny etap. Ustawienia piosenek gracza są na czas etapu zastępowane i potem przywracane.
- **Turniej** – drabinka pojedynków 1 na 1 (3–16 graczy, wolne losy), mecz to minigra z Imprezy dla dwóch graczy
  (js/tournament.js); remis – dogrywka.
- **Impreza na czas** – zamiast liczby minigier 15 / 30 / 45 minut: losowe minigry, aż minie czas.
- **Pojedynek na żywo** – dwóch graczy naraz wybiera graną piosenkę z czterech (telefony albo osobne przyciski):
  szybciej i dobrze 2 pkt, dobrze 1 pkt; gra do 10 pkt, na dużym ekranie paski punktów.
- **Okładka z mgły** – najpierw sama rozmyta okładka (bez dźwięku, 4 pkt), potem ostrzejsza i 1/4/10 s fragmentu (3/2/1 pkt).
- **Krzywe zwierciadło** – fragment zza ściany (filtr dolnoprzepustowy Web Audio), na helu / zwolniony
  (`playbackRate` bez zachowania wysokości) albo od tyłu (odwrócony bufor PCM zapisany jako WAV); z każdym krokiem słabiej.
- **Mikser** – dwie piosenki naraz przez 10 s (drugi element `<audio>`), punkt za każdy odgadnięty tytuł / wykonawcę.
- **Licytacja sekund** (multiplayer) – profil piosenki, licytacja w dół (8 s … 0,5 s), najkrótsza stawka zgaduje tytuł:
  trafienie 2 pkt, pudło – 1 pkt dla poprzedniego licytującego.
- **Gorąca bomba** (multiplayer) – tykająca bomba (oscylator Web Audio) i szybkie pytania o piosenkę; dobrze – bomba idzie
  dalej, źle – 3 s blokady; wybuch w losowej chwili 25–50 s zabiera serce.
- **Ostatni na placu boju** (multiplayer) – wszyscy naraz podają rok; największa pomyłka traci serce, wygrywa ostatni.

W multiplayerze wyzwanie na osi czasu ma trzy warianty: inne miejsce na osi, dokładny rok albo **wszyscy naraz**
(każdy z żetonem wskazuje własne miejsce, kartę bierze pierwszy trafny).

**Karty specjalne** (modyfikatory osi czasu, do wyboru): podwójna, kradzież żetonu, zamiana osi, tarcza (jednorazowa
ochrona), mgła (ukryte lata na osi dla innych do następnej tury), złoty strzał (dokładny rok = +2 żetony) i magnes
(tylko dla ostatniego gracza – darmowa karta z rokiem).

**Ciekawostki** po odkryciu karty – jedna, w zestawie tematycznym pasująca do niego (Eurowizja, Opole, Trójka, film, memy).
Z Wikidata (`tools/facts.mjs`, lista ze źródłami w [FACTS.md](FACTS.md)): kompozytor i autor tekstu, film/serial/gra,
album, producent, utwór, na którym piosenka jest oparta, prawdziwe imię i nazwisko wykonawcy, rok i miejscowość
urodzenia, rok i miejsce powstania zespołu – z kontrolą homonimów (wykonawca musi pasować do swoich piosenek: daty,
kraj przy nazwach jednowyrazowych) i zawodów (producent/kompozytor/autor tekstu to muzyk, poeta albo zespół).
Także preselekcje do Eurowizji (Polska) i nagrody z Wikidata – Oscar i Złoty Glob za piosenkę, Grammy, Grammy Hall of Fame,
Latin Grammy (tylko z datą przyznania; lista ze źródłami w [AWARDS.md](AWARDS.md), skrypt `tools/awards.mjs`); zwycięstwo lub miejsce na Eurowizji, 1. miejsce Listy
Przebojów Trójki, festiwal w Opolu, miejsce na Billboard Year-End Hot 100, nr 1 w Polsce.

**Moje statystyki** (📊, tylko na danym urządzeniu): skuteczność w dekadach i gatunkach,
najczęściej mylone piosenki, historia rekordów i wykres postępów.

**Duży ekran** (📺): drugie okno (`tv.html`) dla telewizora lub rzutnika, z dużymi kartami
i osiami wszystkich graczy; okno gry na tym samym urządzeniu jest pilotem (BroadcastChannel).
Wszystkie osie mieszczą się na ekranie bez przewijania (przy 4+ graczach w dwóch kolumnach), widać
wybrane miejsce karty (i miejsce wskazane przy wyzwaniu) oraz znaczniki po pomyłce. Stan graczy
(karty, żetony) jest przy ich osiach. Przyciski z okna gry (zatwierdź, wyzwanie z podpowiedzią, kto może je
rzucić, kupno karty, pominięcie…) są też na dużym ekranie i można je tam klikać. Wszystko skaluje się
na bieżąco do rozmiaru okna – także w 2K i 4K (czcionki, ramki i odstępy rosną z rozdzielczością,
okładki pobierane są w jakości dopasowanej do ekranu).

**Telewizor przez sieć**: na telewizorze (np. Google TV) lub innym komputerze otwórz `tv.html` i kliknij
„📶 Połącz z innym urządzeniem” – pojawi się 4-znakowy kod i kod QR. Telefon, na którym toczy się gra, skanuje
QR (albo w oknie 📺 wpisuje kod) i od tej chwili steruje dużym ekranem. Połączenie: najpierw przez własny serwer
pośredniczący Songstera (Cloudflare Workers, `server/relay` – instrukcja wdrożenia w `server/relay/README.md`), o ile
jego adres jest ustawiony; gdy go nie ma albo nie odpowiada – naraz bezpośrednio (WebRTC przez PeerJS) i przez publiczny
serwer pośredniczący MQTT (shiftr.io, WebSocket na porcie 443) – wygrywa kanał, który połączy się pierwszy. Biblioteki ładowane są dopiero przy łączeniu.
Gospodarz wysyła numer wersji gry – duży ekran albo telefon gracza ze starszą wersją (np. otwarty przed aktualizacją)
sam pobiera świeże pliki i się odświeża, a gospodarz łączy się z telewizorem ponownie (ten sam kod).

**Gracze na własnych telefonach**: w multiplayerze lobby od razu tworzy pokój – gracze skanują QR
(`tv.html?join=KOD`), wpisują imię, głosują na tryb, a w grze dostają własny, pionowy widok: cały czas układ jak na urządzeniu gospodarza (tablica wyników, karta tury, płyta, pasek postępu, karty z flagami);
w swojej turze dodatkowo ▶ Odtwórz / ⏭ Pomiń i oś z „＋ tutaj”, poza nią – podgląd na żywo osi gracza, który odpowiada
(z zaznaczonym miejscem – widać, czy warto rzucić wyzwanie); niżej własna oś i osie pozostałych graczy; przycisk ▶/⏸ (odtwarzaniem steruje gracz, który
teraz odpowiada – gospodarz przyjmuje to polecenie tylko od jego telefonu), baner „Twoja tura”, oś czasu
z przyciskami „＋ tutaj”, odpowiedź z podpowiedziami, duże przyciski (wyzwanie, kupno karty…) i ogromny
przycisk w „Kto pierwszy?”.

**Gdzie gra muzyka** (ustawienia rozgrywki → Odtwarzanie): na tym urządzeniu, na dużym ekranie (TV) albo – w trybach
z turami graczy – na telefonie gracza, który ma turę. Urządzenie gospodarza nadal prowadzi grę (odmierza fragmenty
i kroki), tylko bez dźwięku; wybrane urządzenie samo pobiera fragment i gra go z płynnym wejściem/wyjściem. Przeglądarki
pozwalają grać z dźwiękiem dopiero po jakiejkolwiek interakcji ze stroną (np. przycisk pilota) – gra nie czeka
wtedy na kliknięcie: muzyka od razu gra u gospodarza, a pierwsze naciśnięcie dowolnego przycisku pilota lub dotknięcie
ekranu przenosi ją na tamto urządzenie od bieżącego miejsca. Ekran z kodem na telewizorze podpowiada, by nacisnąć OK
już na starcie. Bez połączonego urządzenia muzyka gra u gospodarza.

Na dużym ekranie widać też pasek kroków (Melodia krok po kroku), przyciski graczy (Kto pierwszy?), kręcącą
się płytę i postęp fragmentu. W trakcie gry ekran telefonu nie gaśnie (Screen Wake Lock), a fragmenty
wchodzą i kończą się płynnie (150 ms).

**Wersja angielska**: język wybiera się w Ustawieniach (domyślnie wg języka przeglądarki).
Teksty interfejsu przechodzą przez `T()` (`i18n.js`), słownik jest w `i18n-en.js`; tytuły
piosenek i nazwy wykonawców się nie zmieniają.

**Statystyki odwiedzin**: Umami Cloud (`analytics.js`) – bez ciasteczek; zdarzenia
`start-gry` (tryb, poziom, zestaw, liczba graczy, język), `koniec-gry` (tryb, czas, wynik),
`czas-wizyty`, `statystyki`, `duzy-ekran`. Dane wysyłane są tylko z matyz55.github.io.

**Tryb ekspert** (osie czasu): żeby zatrzymać kartę, oprócz miejsca na osi trzeba podać
wybrane dane – tytuł, wykonawcę i/lub dokładny rok (do wyboru w ustawieniach gry).

**Tak to leciało!** – jak w teleturnieju: każdy gracz ma planszę 3×3 (9 kategorii po 2 piosenki – wykonawcy, tematy
z tytułów, dekady, zestawy; zagrane wyszarzone, ostatnio używane kategorie losowane rzadziej), a nad nią „Hit za
100 000 zł” na sam koniec (gram bez kół ratunkowych albo rezygnuję z 75 000 zł; pomyłka w finale – 50 000 zł); do uzupełnienia jest zawsze cały wers, który wcześniej
w piosence nie padł; drabinka 500 zł → 100 000 zł (gwarantowane 10 000 zł po 5. piosence, 50 000 zł przy pomyłce w finale), koła
ratunkowe: trzy słowa, wymiana piosenki, trzy wersje wersu, w multiplayerze sufler. Piosenka gra z YouTube (oficjalny
osadzany odtwarzacz) od początku, tekst z czasami wersów pobierany w trakcie gry z [lrclib.net](https://lrclib.net)
przewija się jak w karaoke, a przed wersem do uzupełnienia muzyka milknie. Odpowiedź wpisuje się albo śpiewa
(rozpoznawanie mowy przeglądarki). Katalog piosenek (`lyrics-catalog.js`, bez tekstów) buduje
`tools/lyrics-catalog.mjs`: `lrclib` (teksty z czasami), `youtube` (filmy – wymaga zmiennej `YOUTUBE_API_KEY` z kluczem
YouTube Data API v3; film musi dać się osadzić, nie może być zablokowany w Polsce, a jego długość musi zgadzać się
z nagraniem z tekstem ±3 s) i `build`. Wyniki pośrednie (tylko identyfikatory i długości) są w `tools/lyrics-data`, więc kolejne uruchomienia kontynuują pracę (piosenkę bez pasującego filmu narzędzie szuka jeszcze raz najwcześniej po 30 dniach, najwyżej dwa razy). Piosenka może mieć kilka filmów (piosenki z mniej niż dwoma działającymi filmami
narzędzie co 30 dni szuka ponownie) – przed piosenką gracz wybiera film z listy (miniatura, długość, znaczek „działał”
albo „wcześniej nie ruszył”), a polecany czeka już w odtwarzaczu (wystarczy dotknąć ▶). Gdy film nie rusza, gra nie zmienia
piosenki sama: gracz dotyka ▶ na filmie, wybiera inny film albo zmienia piosenkę (druga z kategorii albo inna – bez zużycia
koła). Urządzenie, na którym przeglądarka nie pozwala grze uruchamiać filmów (zdarzenie `onAutoplayBlocked`), dostaje
odtwarzacz z przyciskami YouTube. Błąd YouTube (100/101/150) zapisuje się dopiero po starcie innego filmu, a film znika
na tym urządzeniu po błędzie w dwóch różnych dniach (kilka błędów z rzędu bez żadnego startu to raczej blokada urządzenia
albo sieci, np. VPN). Raport ze sprawdzarki filmów (Ustawienia) zawiera też filmy, które ruszyły w grze – trafiają do
`tools/lyrics-data/good-videos.json` i są w katalogu pierwsze na liście; niedziałające – do `bad-videos.json`. Kafelek trybu pojawia
się, gdy katalog ma co najmniej 40 piosenek. W Imprezie jest minigra „Tak to leciało!” – piosenka od zwrotki lub refrenu
z wersem do uzupełnienia, dobra odpowiedź = 1 pkt.

**Zestawy tematyczne** – gotowe ustawienia puli: Przeboje Trójki (1. miejsca Listy Przebojów
Programu Trzeciego wg polskiej Wikipedii i plebiscyty „Polski Top Wszech Czasów”), Opole
(piosenki z artykułów o Krajowym Festiwalu Piosenki Polskiej w Opolu), Eurowizja (kategorie
„Eurovision songs” angielskiej Wikipedii oraz piosenki z krajowych preselekcji – `tools/preselections.mjs`
i pliki `tools/preselections-*.json`), Memy (piosenki znane z internetowych memów, ciekawostki „z jakiego memu”
ze źródłami w `tools/memes.json`, zapisywane do facts.js przez `tools/memes.mjs`) i muzyka filmowa. Własne
ustawienia można zapisać jako zestaw.

Kartę można **przeciągnąć palcem lub myszą** na oś (albo kliknąć „＋”). Gra ma proste
animacje i dźwięki efektów (do wyłączenia w ustawieniach) i działa jako **aplikacja (PWA)**:
na Androidzie przycisk „Zainstaluj”, na iPhonie „Udostępnij → Do ekranu początkowego”.

Każdy wykonawca pojawia się w jednej grze najwyżej raz, a piosenki nie powtarzają się
między kolejnymi rozgrywkami w tej samej karcie przeglądarki (dopóki w wybranej puli
nie zabraknie nowych). Po pomyłce oś pokazuje, gdzie gracz położył kartę i gdzie było
właściwe miejsce. **Poziom trudności**:
bardzo łatwy (ok. 1000 najpopularniejszych piosenek w Spotify – po 500 polskich
i zagranicznych), łatwy (znane piosenki), średni – domyślny (wszystkie piosenki) i trudny (mniej znane;
na osi czasu częściej trafiają się utwory wydane blisko lat Twoich kart). Na każdym
poziomie piosenki są losowane równomiernie z różnych dekad, a przy mieszanych piosenkach
można ustawić **udział polskich** (domyślnie 50%). W multiplayerze można widzieć osie wszystkich graczy.
Na telefonie oś czasu jest pionowa, a przyciski akcji przyklejone do dołu ekranu.

Przed grą można zawęzić pulę piosenek: polskie/zagraniczne, **dekady** (lata 30.–60. to jedna
kategoria „do 1969”, bo starszych piosenek jest niewiele), **gatunki**
(z Discogs), **kraj wykonawcy**, a także ustawić
**długość fragmentu** (30/15/10/5 s), odtwarzanie z **losowego miejsca** i podpowiedź
z dekadą. Ustawienia są zapamiętywane. Po grze widać listę
wszystkich piosenek, które padły, z ikonkami YouTube, Spotify i Apple Music (na Androidzie
otwierają od razu aplikację, a gdy jej nie ma – stronę serwisu). Te same ikonki są pod odkrytą kartą.

## Ustawienia (⚙)

- dźwięki efektów i animacje (włączone domyślnie; animacje wyłączają się też przy
  systemowym ustawieniu „ogranicz ruch”),
- poprawianie roku wydania i kraju wykonawcy dowolnej piosenki (zapisywane w przeglądarce;
  kraj decyduje też, czy piosenka jest polska, czy zagraniczna).

## Testy

```bash
npm install
npx playwright install chromium   # przeglądarka do testów (jednorazowo)
npm test                          # wszystkie testy
npx playwright test --grep-invert @net   # tylko testy bez sieci (iTunes jest w nich podstawiony)
npm run lint                      # sprawdzanie kodu (ESLint)
```

Testy uruchamiają się automatycznie na GitHubie przy każdej zmianie (`.github/workflows/test.yml`).

**Sprawdzanie bazy**: `node tools/check-previews.mjs --limit 150` sprawdza porcję piosenek w iTunes (najdawniej
sprawdzane najpierw, z limitem zapytań) i zapisuje raport piosenek bez fragmentu w [PREVIEW-REPORT.md](PREVIEW-REPORT.md).
Na GitHubie robi to codziennie `.github/workflows/check-previews.yml` (harmonogram działa na domyślnej gałęzi repozytorium).
`node tools/normalize-artists.mjs` ujednolica zapis wykonawców (ta sama nazwa pisana różnie, brakujące polskie znaki)
w songs.js, songs-sp.js, facts.js i tools/memes.json – listę zamian ma na początku pliku.

## Jak uruchomić lokalnie

To statyczna strona – bez instalacji i bez budowania.

```bash
python3 -m http.server 8000
# otwórz http://localhost:8000
```

Wymagany jest internet: 30-sekundowe fragmenty utworów są pobierane w trakcie
gry z publicznego [iTunes Search API](https://performance-partners.apple.com/search-api)
(format AAC/.m4a – przeglądarka musi go obsługiwać). Piosenki, dla których iTunes
nie ma fragmentu, są w grze automatycznie pomijane.

## Lista piosenek i lata wydania

Piosenki są w pliku [`songs.js`](songs.js) (`a` – wykonawca, `t` – tytuł,
`y` – rok, `c` – `PL`/`INT`, `cc` – kraj artysty, `g` – gatunki, `p` – popularność
w Spotify, `src` – źródło daty, `w` – piosenka dodana z Wikipedii dla uzupełnienia roku,
bez danych o popularności – nie trafia na poziom łatwy).
Rok oznacza **rok pierwszego wydania nagrania** danego wykonawcy.

Źródła: [Discogs](https://www.discogs.com/) (wydanie sprawdzane po trackliście),
[MusicBrainz](https://musicbrainz.org/), Wikipedia oraz daty wydań ze Spotify
(z eksportu playlist). Piosenka trafia do gry, jeśli rok podaje choć jedno źródło.
Oprócz przesłanych playlist lista jest uzupełniona o piosenki z list przebojów
(Billboard Year-End Hot 100, numery jeden w Polsce) i z artykułów polskiej Wikipedii o
piosenkach – tam, gdzie w danym roku brakowało polskich lub zagranicznych utworów.
Szczegóły, reguła wyboru roku i pełna tabela: [`VERIFICATION.md`](VERIFICATION.md).

Flagi to obrazki SVG z pakietu [flag-icons](https://github.com/lipis/flag-icons) 7.5.0
(licencja MIT, `flags/LICENSE`) – emoji flag nie wyświetlają się w Windows.

Dopasowanie nagrania w iTunes (`match.js`) wymaga zgodności wykonawcy i tytułu
oraz pomija wersje koncertowe, remiksy, karaoke i covery (pola `q`, `m`, `al`
w `songs.js` to podpowiedzi dla wyszukiwarki; `ia` – inny wykonawca, pod którym
nagranie jest w iTunes, `nx` – albumy z późniejszymi nagraniami do pominięcia).
Oryginałów Lombardu nie ma w iTunes – gra odtwarza nowe aranżacje z oryginalną
wokalistką z albumu Małgorzaty Ostrowskiej „Instynkt” (2001), a nie wersje
„Lombard Swing” (2016) czy „Lombard 40/40” (2025).
