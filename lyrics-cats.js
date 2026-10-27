'use strict';
// Kategorie trybu „Tak to leciało!” (jak w programie: temat z tytułu, zestaw, dekada, gatunek) – wspólne dla gry
// (js/lyrics.js) i narzędzia katalogu (tools/lyrics-catalog.mjs), które dobiera nowe piosenki tak, żeby kategorie
// miały ich jak najwięcej. Kategorie-wykonawcy powstają w grze z piosenek z katalogu.
window.LY_THEMES = [
  { name: () => T('O pogodzie'), re: /deszcz|słońc|słonecz|burz|śnieg|wiatr|chmur|mgł|pogod|upał|tęcz|grad|pada\b|zim[aąy]\b|mróz/i, en: /\b(rain|raining|sun|sunshine|snow|wind|storm|weather|clouds?)\b/i },
  { name: () => T('Kolory'), re: /czerwon|biał|czarn|zielon|niebiesk|żółt|szar[ay]|różow|złot|srebrn|kolor|błękit|fiolet|pomarańcz/i, en: /\b(red|black|white|blue|yellow|green|purple|golden|pink|gr[ae]y|colou?rs?)\b/i },
  { name: () => T('Imiona'), re: /\b(jolk|ewk|małgośk|el[aię]\b|ann[aęy]|mari[aię]|kasi|marysi|agnieszk|józek|józk|stefan|marian|basi|zośk|juli[aię]|gosi|ol[ai]\b|ani[aę]?\b|celin|matyld|rebek|izold|jenny|lol[ai]\b|peggy|victori|wiki|weronik|krystyn|ag[aę]\b|helen|kamil|tomek|wojtek|jacek|marek|bartek|jasi|kubu|ewelin|ines|inez|sar[aę]\b|halink|aniel)/i, en: /\b(mary|jane|billie jean|roxanne|layla|michelle|angie|jolene|caroline|alice|jenny|lucy|rosanna|gloria|diana|jude|johnny|annie|maria|sara)\b/i },
  { name: () => T('Miasta i miejsca'), re: /warszaw|krak|gdańsk|gdyni|wrocław|łódź|łodz|poznań|sopot|mokotów|bieszczad|tatr|mazur|polsk|ameryk|berlin|pary[żs]|londyn|chałup|alabam|hollywood|tokyo|kioto|kyoto|barcelon|honolulu|fiji|santa|meksyk|afryk|kalifor|moskw|rzym|wenecj|nowy jork|new york|kair|lloret|miast/i, en: /\b(paris|london|california|texas|tokyo|vegas|chicago|america|new york|hollywood|berlin|city|town)\b/i },
  { name: () => T('Miłość'), re: /miło[sś]|kocha|kocham|serc|cału|pocałun|zakocha|ukochan|love/i, en: /\b(love|lovers?|loving|kiss)\b/i },
  { name: () => T('Noc i dzień'), re: /\bnoc|nocą|dzień|dnia\b|dni\b|ranek|rano\b|wieczor|północ|świt|zmierzch/i, en: /\b(night|nights|tonight|day|days|morning|midnight|sunrise)\b/i },
  { name: () => T('Zwierzęta'), re: /ptak|ptaszk|pies|psa\b|psy\b|kot\b|kota\b|koń|koni|wilk|wilcz|kruk|orł|orze|krow|ryb|motyl|pszczół|bocian|papug|kormoran|szczur|\blis\b|pingwin|\bmiś|baran|niedźwied|kaczk|żab|słoń|lew\b|tygrys|jeleń|sarn|wróbl|jaskółk|gołęb|łabędź|delfin|krab|węgorz|krowa|kogut|kur[ay]\b/i, en: /\b(birds?|dogs?|cats?|horses?|wolf|tiger|lion|fish|butterfly|bees?)\b/i },
  { name: () => T('Liczby'), re: /\d|\bjed(en|na|no)\b|\bdwa\b|\bdwie\b|\btrzy\b|\bcztery\b|\bpięć\b|\bsto\b|tysiąc|milion|\bpierwsz|ostatni|\bsiedem\b|\bosiem\b|\bdziewięć\b|\bdziesięć\b/i, en: /\b(\d+|one|two|three|four|five|seven|hundred|thousand|million|first|last)\b/i },
  { name: () => T('Taniec i zabawa'), re: /tańcz|taniec|tańc|tango|walc|\bbal\b|bal[ue]\b|disco|dyskotek|zabaw|party|impre|bawi/i, en: /\b(dance|dancing|dancer|party|disco)\b/i },
  { name: () => T('Woda i morze'), re: /morz|wod[ay]|rzek|ocean|plaż|statek|statki|parostat|\bfal[aei]|jezior|wisł|bałtyk|łódk|żagl/i, en: /\b(sea|ocean|water|river|beach|waves?)\b/i },
  { name: () => T('Czas'), re: /\bczas|wczoraj|jutro|dzisiaj|\bdziś|zawsze|nigdy|chwil|\bwiek|minut|godzin|sekund|lat[ao]?\b|rok\b/i, en: /\b(time|yesterday|tomorrow|today|forever|always|never|moment|minutes?|hours?|years?)\b/i },
  { name: () => T('Ty i ja'), re: /\bty\b|\bja\b|ciebie|tobą|\bmnie\b|\bmną\b|\bnas\b|\bmy\b/i, en: /\b(you and i|you and me|me and you)\b/i },
  { name: () => T('Pytania'), re: /\?|^czy\b|\bgdzie\b|\bdlaczego\b|\bczemu\b|\bczy\s/i, en: /\?|^(why|where|what|who|how)\b/i },
  { name: () => T('Być albo nie być'), re: /\bby(ć|c)\b/i },
  { name: () => T('Mowa i słowa'), re: /m(ó|o)w|pyta|powie|s(ł|l)(ó|o)w|g(ł|l)os|opowiad|s(ł|l)ucha|krzycz/i, en: /\b(say|said|talk|talking|tell|words|voice|call|calling|speak)\b/i },
  { name: () => T('Krok po kroku'), re: /\bkrok|\bstron(ę|e|ie)\b|prawy|do lewego/i },
  { name: () => T('Świat i niebo'), re: /\bniebo|nieba|gwiazd|księżyc|kosmos|planet|ziemi|świat|anioł|raj\b/i, en: /\b(sky|heaven|stars?|moon|world|earth|angels?|universe|space)\b/i },
  { name: () => T('Dom i rodzina'), re: /\bdom|mam[aąoy]\b|\btata\b|tato\b|ojc|matk|brat|siostr|dziadk|babci|dzieci|dziewczyn|chłopak|chłopc/i, en: /\b(home|mother|mama|father|daddy|family|brother|sister)\b/i },
  { name: () => T('Jedzenie i picie'), re: /win[ao]\b|kaw[aęy]|herbat|chleb|cukier|cukierk|słodk|czekolad|miód|miod|piw[ao]|wódk|wóda|szampan|marcepan|gelato|bubble|tea|lody|ciast|jabłk|pomidor|truskaw|malin|bigos/i },
  { name: () => T('Ciało'), re: /\boczy|oczach|serc|ręk|ręce|dłoń|dłoni|ust[aa]?\b|głow|włos|twarz|skór|nogi|krew|krwi/i, en: /\b(eyes|heart|hands?|lips|body|face|head|blood)\b/i },
  { name: () => T('W drodze'), re: /drog[aię]|pociąg|samolot|autobus|statek|stacj|podróż|jedziem|autostop|ulic|most|peron|taksówk|rower|lot\b|lec[ęi]/i, en: /\b(road|highway|train|drive|driving|street|bridge|ride)\b/i },
  { name: () => T('Uczucia'), re: /smut|szczęś|strach|radoś|łz[ay]|łez|tęsk|samotn|żal|zazdro|nadziej|wolnoś|spokój|cisza|cisz[ąy]/i, en: /\b(feel|feeling|feelings|fear|hope|free|freedom)\b/i },
  { name: () => T('Sny i marzenia'), re: /\bsen\b|\bsny\b|\bsnu\b|śni|marz|bajk|cud/i, en: /\b(dream|dreams|dreaming|dreamer)\b/i },
  { name: () => T('Pory roku'), re: /wiosn|\blat[ao]\b|latem|jesie|jesien|\bzim[aąy]\b|zimą|\bmaj\b|majem|grudni|lipc|sierpni/i, en: /\b(summer|winter|spring|autumn|december|july|september)\b/i },
  { name: () => T('Muzyka'), re: /piosenk|melodi|muzyk|radio|gitar|śpiew|ballad|\brock|disco|\bhit|\bsong|tango|walc|blues|jazz|rap\b|bęben/i, en: /\b(music|radio|guitar|piano|melody|song|sing|singing|rock|disco)\b/i },
  { name: () => T('Lato i wakacje'), re: /\blat[ao]\b|latem|wakacj|plaż|słońc|upał|chałup|morz|urlop|sierpni|lipc/i, en: /\b(summer|holiday|beach|sunshine)\b/i },
  { name: () => T('Młodość i szkoła'), re: /młod|szkoł|matur|klas[aiy]|dzieci|dzieciń|nastol|dziewczyn|chłopak|chłopc|generacj|pokoleni/i, en: /\b(young|school|teenage|youth|kids)\b/i },
  { name: () => T('Kobieta'), re: /kobiet|dziewczyn|pani\b|panienk|dama|damą|królow|księżnicz|narzeczon|żon[aąy]|mam[aąoy]\b|siostr|córk/i, en: /\b(girls?|woman|women|lady|queen|princess|wife|bride)\b/i },
  { name: () => T('Mężczyzna'), re: /mężczyzn|chłopak|chłopc|facet|pan\b|panie\b|król\b|książę|rycerz|brat|syn\b|tat[ao]\b|ojciec/i, en: /\b(boys?|man|men|king|prince|son|father|daddy)\b/i },
  { name: () => T('Polska i ojczyzna'), re: /polsk|polak|ojczyzn|kraj|warszaw|krak|wisł|tatr|bieszczad|mazur|biało|orł[aey]? |orła/i },
  { name: () => T('Pieniądze'), re: /pieni|grosz|złot[ye]\b|dolar|kas[aęy]\b|bank|milion|biedn|bogat|kredyt|hajs/i, en: /\b(money|dollars?|rich|cash|millionaire)\b/i },
  { name: () => T('Ogień i światło'), re: /ogień|ognia|ognist|płon|pal[ęi]|świat[łl]|lamp|gwiazd|słońc|blask|iskr|żar\b|reflektor/i, en: /\b(fire|light|lights|burn|burning|flame|bright|shine|shining)\b/i },
  { name: () => T('Kwiaty i drzewa'), re: /kwiat|kwiecie|róż[aey]|tulipan|fiołk|maki?\b|drzew|las\b|lasu|liść|liści|ogród|ogrod|jabłoń|wiśni|bez\b|konwali|stokrot/i, en: /\b(flowers?|roses?|trees?|garden)\b/i },
  { name: () => T('Wojna i pokój'), re: /wojn|wojen|wojsk|żołnier|bitw|walk|walcz|pokój|pokoju|armi|broń|karabin|bomb/i, en: /\b(war|fight|fighter|soldier|peace|guns?|bullet)\b/i },
  { name: () => T('Bóg i wiara'), re: /bóg|boga|boże|bogu|anioł|niebo|nieba|modlitw|grzech|święt|raj\b|piekł|diabł|szatan/i, en: /\b(god|heaven|hell|angels?|pray|prayer|devil|jesus|holy)\b/i },
  { name: () => T('Telefon i technika'), re: /telefon|radio|telewiz|komputer|internet|sms|komórk|samochod|auto\b|autem|maszyn|robot|kino|film\b|video|wideo/i, en: /\b(phone|telephone|video|tv|computer|machine|robots?)\b/i },
  { name: () => T('Alkohol'), re: /win[ao]\b|wódk|wóda|piw[ao]|szampan|whisky|drink|bimber|pijan|kieliszek|toast|naleweczk/i, en: /\b(wine|whiske?y|beer|drunk|tequila|champagne|vodka)\b/i },
  { name: () => T('Jednym słowem'), any: true, re: /^[^\s]+$/ },
  { name: () => T('Długie tytuły'), any: true, re: /^(\S+\s+){4,}\S+/ },
  { name: () => T('Wykrzyknik!'), any: true, re: /!/ },
  { name: () => T('Samotność i tęsknota'), re: /samotn|tęskn|\bsam[ao]?\b|bez ciebie|beze mnie|odejd|odszed|odesz|rozstan|żegnaj|pożegn/i, en: /\b(alone|lonely|goodbye|without you|miss you)\b/i },
  { name: () => T('Szczęście i uśmiech'), re: /szczęś|radoś|radosn|uśmiech|śmiej|śmiech|wesoł|happy/i, en: /\b(happy|smile|happiness|joy|laugh)\b/i },
  { name: () => T('Łzy i smutek'), re: /łz[aey]|łez|smut|płacz|płacze|żal|ból|boli|rani/i, en: /\b(tears|cry|crying|sad|pain|hurt)\b/i },
  { name: () => T('Wspomnienia'), re: /wspomn|pamięt|pamiec|dawno|kiedyś|wczoraj|dawniej|tamt[ey]/i, en: /\b(remember|memories|memory)\b/i },
  { name: () => T('Zaczyna się od „Nie”'), re: /^nie\b/i },
  { name: () => T('Ja i moje'), re: /^(ja|mój|moja|moje|mnie|mi)\b/i, en: /^(i|my|me|mine)\b/i },
];
// temat z tytułu: polska piosenka – wzorzec polski (re), zagraniczna – angielski (en) albo ogólny (any – np. „!”, jedno słowo)
window.lyThemeHas = (th, s) => { const re = s.c === 'PL' ? th.re : th.en || (th.any ? th.re : null); return !!re && re.test(s.t); };

window.LY_SETS = [
  { name: () => T('Festiwal w Opolu'), test: (s) => s.c === 'PL' && (s.tg || []).includes('opole') },
  { name: () => T('Przeboje Trójki'), test: (s) => (s.tg || []).includes('trojka') },
  { name: () => T('Memy'), test: (s) => (s.tg || []).includes('memy') },
  { name: () => T('Eurowizja'), test: (s) => (s.tg || []).includes('eurowizja') },
  { name: () => T('Z filmów i seriali'), test: (s) => (s.g || []).includes('muzyka filmowa') },
  { name: () => T('Duety'), test: (s) => s.a.includes(' & ') },
  { name: () => T('Rap'), test: (s) => (s.g || []).includes('hip-hop') },
  { name: () => T('Rock'), test: (s) => (s.g || []).includes('rock') },
  { name: () => T('Pop'), test: (s) => (s.g || []).includes('pop') },
  { name: () => T('Elektronika'), test: (s) => (s.g || []).includes('elektronika') },
  { name: () => T('Folk i country'), test: (s) => (s.g || []).includes('folk i country') },
  { name: () => T('Punk i nowa fala'), test: (s) => (s.g || []).includes('punk i nowa fala') },
  { name: () => T('Jazz i blues'), test: (s) => (s.g || []).some((g) => g === 'jazz' || g === 'blues') },
  { name: () => T('Soul, funk i disco'), test: (s) => (s.g || []).some((g) => g === 'soul i funk' || g === 'disco') },
  { name: () => T('Numer 1 w Polsce'), test: (s) => (s.f || []).some((f) => f.startsWith('n:')) },
  { name: () => T('Numer 1 Listy Trójki'), test: (s) => (s.f || []).includes('t1') || (s.f || []).some((f) => f.startsWith('t1:')) },
  { name: () => T('Polski Top Wszech Czasów'), test: (s) => s.c === 'PL' && (s.f || []).some((f) => f === 'tp' || f.startsWith('tp:')) },
  { name: () => T('Czasy PRL-u'), test: (s) => s.c === 'PL' && s.y < 1989 },
  { name: () => T('XXI wiek'), test: (s) => s.y >= 2001 },
  { name: () => T('Lata 60. i 70.'), test: (s) => s.y < 1980 },
  { name: () => T('Lata 80.'), test: (s) => s.y >= 1980 && s.y < 1990 },
  { name: () => T('Lata 90.'), test: (s) => s.y >= 1990 && s.y < 2000 },
  { name: () => T('Lata 2000.'), test: (s) => s.y >= 2000 && s.y < 2010 },
  { name: () => T('Lata 2010.'), test: (s) => s.y >= 2010 && s.y < 2020 },
  { name: () => T('Najnowsze przeboje'), test: (s) => s.y >= 2020 },
  { name: () => T('Złote przeboje'), test: (s) => s.y < 1995 && (s.p || 0) >= 40 },
  { name: () => T('Panie przy mikrofonie'), test: (s) => s.c === 'PL' && /^(Maryla|Anna|Ania|Kasia|Katarzyna|Edyta|Doda|Sylwia|Natalia|Beata|Kayah|Margaret|Krystyna|Urszula|Irena|Halina|Ewa|Maria|Justyna|Monika|Agnieszka|Basia|Sanah|sanah|Daria|Brodka|Viki|Roxie|Bovska|Mela|Julia|Kaśka|Zalia)/.test(s.a) },
];

// Tylko piosenki z polskim tekstem: wers jest polski, gdy ma polskie litery albo więcej polskich niż angielskich słów
// popularnych (bez słów wspólnych dla obu języków, np. „i”, „a”, „to”, „no”). Gra pomija przerwy w niepolskich wersach,
// a narzędzie katalogu – piosenki, w których polskich wersów jest za mało (LY_PL_MIN).
window.LY_PL_MIN = 0.7;
window.lyLineLang = (() => {
  const PL = new Set('w z na nie się sie że ze jak co mi ja ty jest tak po mnie ci bo już juz o mój moj moja czy tylko jeszcze gdy kiedy tu tam ten ta być byc mam masz był byl była nas was ich go jej jego dla od za przez bez we ty mną mna tobą toba ciebie siebie znowu teraz dziś dzis może moze chcę chce wiem nic nikt gdzie są sa będzie bedzie'.split(' '));
  const EN = new Set("the you me my and is it in of your we don't that this be all so oh yeah love baby on for with what can i'm it's are know just like i'll you're never ever now got feel go night girl boy want need heart".split(' '));
  return (text) => {
    const words = String(text).toLowerCase().match(/[a-ząćęłńóśźż']+/g) || [];
    let pl = /[ąćęłńśźż]/i.test(text) ? 2 : 0;
    let en = 0;
    for (const w of words) { if (PL.has(w)) pl += 1; if (EN.has(w)) en += 1; }
    return pl > en ? 'pl' : en > pl ? 'en' : '?';
  };
})();
// udział polskich wersów wśród wersów z rozpoznanym językiem (1 – cały tekst po polsku)
window.lyPolishShare = (texts) => {
  let pl = 0; let en = 0;
  for (const t of texts) { const l = window.lyLineLang(t); if (l === 'pl') pl += 1; else if (l === 'en') en += 1; }
  return pl + en ? pl / (pl + en) : 0;
};
