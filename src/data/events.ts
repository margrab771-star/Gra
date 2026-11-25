import type { EventEffect, ResourceType } from '../engine/types';

export interface EventTemplate {
  id: string;
  name: string;
  category: 'weather' | 'economy' | 'policy' | 'labor' | 'opportunity' | 'disaster';
  headline: string;
  forecastHeadline?: string;
  forecastBody?: string;
  body: string;
  analysis: string;
  hints: string[];
  mitigationHint: string;
  durationTicks: number;
  forecastLeadTicks: number; // >0 means Newspaper warns players BEFORE impact!
  relatedResource?: ResourceType;
  effects: EventEffect[];
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'oil_crisis_strait',
    name: 'Kryzys w Cieśninie Naftowej',
    category: 'economy',
    forecastHeadline: 'Napięcia na szlakach tankowców — analitycy prognozują skok cen ropy!',
    forecastBody:
      'Źródła żeglugowe raportują koncentrację flot w kluczowej cieśninie transportowej. Kontrakty terminowe na ropę mogą gwałtownie wzrosnąć w ciągu najbliższych dni.',
    headline: 'KRYZYS NAFTOWY! Ceny ropy i paliw szybują w górę!',
    body: 'Blokada kluczowego korytarza morskiego ograniczyła podaż ropy naftowej. Koszty paliw i transportu gwałtownie rosną w całej gospodarce.',
    analysis:
      'Drożejąca ropa automatycznie podnosi stawki logistyczne we wszystkich sektorach. Najwięcej zyskają właściciele szybów naftowych, rafinerii oraz firmy z zapasami paliwa w magazynach.',
    hints: [
      'Zabezpiecz własne szyby naftowe lub rafinerię przed skokiem.',
      'Magazynuj paliwo przed szczytem i zawrzyj stałe kontrakty B2B.',
    ],
    mitigationHint: 'Magazyny paliwa, kontrakty B2B o stałej cenie, technologia Intermodalne Węzły.',
    durationTicks: 24,
    forecastLeadTicks: 8,
    relatedResource: 'oil',
    effects: [
      { kind: 'priceMultiplier', target: 'oil', value: 1.52 },
      { kind: 'priceMultiplier', target: 'fuel', value: 1.45 },
    ],
  },
  {
    id: 'severe_drought',
    name: 'Długotrwała Susza Hydrologiczna',
    category: 'weather',
    forecastHeadline: 'Meteorolodzy ostrzegają przed rekordową falą upałów i niżówką na rzekach',
    forecastBody:
      'Poziom wód gruntowych i rzek systematycznie spada. Eksperci ostrzegają przed problemami z chłodzeniem elektrowni oraz spadkiem mocy hydroenergetyki.',
    headline: 'SUSZA PARALIŻUJE RZEKI! Elektrownie wodne i ujęcia wody tracą moc!',
    body: 'Ekstremalna susza uderzyła w ujęcia wody przemysłowej, elektrownie wodne oraz zakłady wymagające intensywnego chłodzenia.',
    analysis:
      'Elektrownie wodne pracują na ułamku mocy, a ceny wody przemysłowej i prądu szybują w górę. Zakłady bez obiegów zamkniętych cierpią na przestoje.',
    hints: [
      'Zbadaj technologię "Retencja i Obiegi Zamknięte" lub "Chłodzenie Suche" w elektrowniach.',
      'Dywersyfikuj energetykę w kierunku atomu lub farm OZE.',
    ],
    mitigationHint: 'Technologia Obiegi Zamknięte, Chłodzenie Suche w elektrowni atomowej, farma OZE.',
    durationTicks: 22,
    forecastLeadTicks: 7,
    relatedResource: 'water',
    effects: [
      { kind: 'hydroPenalty', value: 0.55 },
      { kind: 'waterPenalty', value: 0.35 },
      { kind: 'priceMultiplier', target: 'water', value: 1.65 },
      { kind: 'priceMultiplier', target: 'electricity', value: 1.3 },
    ],
  },
  {
    id: 'semiconductor_boom',
    name: 'Globalny Boom Cyfrowy',
    category: 'opportunity',
    forecastHeadline: 'Koncerny technologiczne szykują wielkie zamówienia na chipy i elektronikę',
    forecastBody:
      'Branża automatyki i centrów danych zapowiada rekordowy cykl inwestycyjny. Popyt na półprzewodniki i metale rzadkie ma wzrosnąć skokowo.',
    headline: 'BOOM NA PÓŁPRZEWODNIKI! Rekordowe marże w sektorze High-Tech!',
    body: 'Lawina zamówień na układy scalone wywindowała ceny półprzewodników, elektroniki oraz metali ziem rzadkich.',
    analysis:
      'Fabryki półprzewodników, elektroniki i kopalnie metali rzadkich notują najwyższe marże w cyklu koniunkturalnym.',
    hints: [
      'Rozbuduj łańcuch: Kopalnia Metali Rzadkich -> Zakłady Chemiczne -> Półprzewodniki.',
      'Zatrudnij wykwalifikowanych inżynierów po Uniwersytecie.',
    ],
    mitigationHint: 'Własne kopalnie metali rzadkich i wysokie zapasy chemikaliów.',
    durationTicks: 25,
    forecastLeadTicks: 7,
    relatedResource: 'semiconductors',
    effects: [
      { kind: 'priceMultiplier', target: 'semiconductors', value: 1.48 },
      { kind: 'priceMultiplier', target: 'electronics', value: 1.35 },
      { kind: 'priceMultiplier', target: 'rareMetals', value: 1.32 },
    ],
  },
  {
    id: 'zus_reform_hike',
    name: 'Podwyżka Składek Pracowniczych',
    category: 'policy',
    forecastHeadline: 'Parlament debatuje nad wyższymi składkami ZUS i funduszem płac',
    forecastBody:
      'Projekt ustawy zakłada podniesienie narzutów na wynagrodzenia w celu łatania budżetu. Firmy o dużym zatrudnieniu mogą stracić rentowność.',
    headline: 'NOWE SKŁADKI HR! Koszty pracy rosną o 28%!',
    body: 'Weszła w życie ustawa podnosząca składki pracodawcy. Pracochłonne kopalnie i huty bez automatyzacji odczuwają gwałtowny wzrost kosztów stałych.',
    analysis:
      'Zamiast zatrudniać nowych pracowników, bardziej opłacalne staje się doszkalanie obecnej kadry na kursach oraz inwestowanie w robotyzację w drzewkach budynków.',
    hints: [
      'Uruchom "Automatyzację i Robotyzację" w wewnętrznych drzewkach kopalń i hut.',
      'Wyślij kadrę na kursy zamiast dokładać etaty obciążone składkami.',
    ],
    mitigationHint: 'Moduły Automatyzacji w budynkach, szkolenia HR, lobbing w Filarze Finansowym.',
    durationTicks: 26,
    forecastLeadTicks: 6,
    effects: [
      { kind: 'zusDelta', value: 0.28 },
      { kind: 'voterMoodDelta', value: -8 },
    ],
  },
  {
    id: 'construction_boom',
    name: 'Rządowy Program Infrastrukturalny',
    category: 'opportunity',
    forecastHeadline: 'Zapowiedź gigantycznego pakietu inwestycji mieszkaniowych i drogowych',
    forecastBody:
      'Rząd planuje wieloletni program budowy autostrad i dzielnic biurowych. Rynek oczekuje gwałtownego wzrostu popytu na stal, kruszywa i prefabrykaty.',
    headline: 'Hossa Budowlana! Stal i prefabrykaty biją rekordy cenowe!',
    body: 'Rozpoczęcie państwowych przetargów wywołało gorączkę zakupową na rynku stali, kruszyw oraz prefabrykatów.',
    analysis:
      'Deweloperzy i producenci materiałów budowlanych przeżywają złote żniwa, lecz koszty nowych inwestycji budowlanych lekko rosną.',
    hints: [
      'Postaw Kamieniołom i Zakłady Prefabrykatów oraz Hutę Stali.',
      'Sprzedaj zgromadzone wcześniej zapasy stali z dużym zyskiem.',
    ],
    mitigationHint: 'Wcześniejsze kontrakty B2B na dostawy stali i prefabrykatów.',
    durationTicks: 24,
    forecastLeadTicks: 6,
    relatedResource: 'steel',
    effects: [
      { kind: 'priceMultiplier', target: 'steel', value: 1.38 },
      { kind: 'priceMultiplier', target: 'prefabs', value: 1.45 },
      { kind: 'priceMultiplier', target: 'gravel', value: 1.35 },
    ],
  },
  {
    id: 'energy_deficit',
    name: 'Kryzys Mocy Szczytowych',
    category: 'economy',
    forecastHeadline: 'Operator sieci ostrzega przed deficytem prądu podczas szczytu przemysłowego',
    forecastBody:
      'Gwałtowna industrializacja wyprzedza moce wytwórcze przestarzałych elektrowni. Nadchodzą wyższe taryfy za energię.',
    headline: 'DEFICYT ENERGII! Ceny MWh rosną o 60%!',
    body: 'Przeciążona sieć energetyczna zmusiła operatora do podniesienia cen prądu. Zakłady energochłonne bez własnych źródeł tracą marże.',
    analysis:
      'Właściciele elektrowni węglowych, OZE i atomowych zgarniają gigantyczne premie za produkcję prądu.',
    hints: [
      'Wybuduj własną elektrownię (OZE, węglową lub atomową), aby uniezależnić się od rynku.',
      'Wykorzystaj moduł "Monopolistyczna Sieć Taryfowa" w Elektrowni Atomowej.',
    ],
    mitigationHint: 'Własne moce wytwórcze (OZE/Atom) i technologia Inteligentne Sieci.',
    durationTicks: 20,
    forecastLeadTicks: 6,
    relatedResource: 'electricity',
    effects: [{ kind: 'priceMultiplier', target: 'electricity', value: 1.6 }],
  },
  {
    id: 'cit_tax_relief',
    name: 'Pakiet Deregulacji Gospodarczej',
    category: 'policy',
    headline: 'Obniżka podatku CIT! Rząd wspiera inwestycje prywatne',
    body: 'Presja środowisk biznesowych oraz pozytywne nastroje wyborców zaowocowały czasową obniżką podatku dochodowego dla przedsiębiorstw.',
    analysis:
      'Doskonały moment na realizację zysków, ekspansję na nowe działki i spłatę zadłużenia.',
    hints: ['Zwiększ produkcję na pełnych obrotach podczas okna podatkowego.'],
    mitigationHint: 'Pozytywne zdarzenie — maksymalizuj sprzedaż zapasów z magazynów.',
    durationTicks: 22,
    forecastLeadTicks: 0,
    effects: [
      { kind: 'taxDelta', value: -0.05 },
      { kind: 'voterMoodDelta', value: 10 },
    ],
  },
  {
    id: 'labor_strike_wave',
    name: 'Fala Strajków Związkowych',
    category: 'labor',
    forecastHeadline: 'Związki zawodowe w przemyśle ciężkim ogłaszają pogotowie strajkowe',
    forecastBody:
      'Rosnąca inflacja i pogorszenie jakości powietrza w strefach przemysłowych podgrzewają nastroje załóg.',
    headline: 'STRAJKI W ZAKŁADACH! Spada wydajność i grożą przestoje!',
    body: 'Niezadowolenie społeczne wywołało przestoje w nisko wyszkolonych i uciążliwych zakładach przemysłowych.',
    analysis:
      'Firmy z dobrze wyszkoloną kadrą, czystymi filtrami oraz wysokim poparciem Kościoła i mediów łagodzą skutki strajków.',
    hints: [
      'Zadbaj o szkolenia pracowników oraz wskaźnik nastrojów wyborców.',
      'Buduj Fundacje Kościelne i Agencje Medialne, aby tonować konflikty społeczne.',
    ],
    mitigationHint: 'Kursy HR, Filtry w budynkach, Filar Społeczny (Kościół i Media).',
    durationTicks: 16,
    forecastLeadTicks: 5,
    effects: [
      { kind: 'strikeRisk', value: 0.22 },
      { kind: 'voterMoodDelta', value: -12 },
    ],
  },
  {
    id: 'defense_tender',
    name: 'Strategiczny Kontrakt Obronny',
    category: 'opportunity',
    headline: 'Państwo ogłasza pilny przetarg na modernizację armii',
    body: 'Zamówienia rządowe windują ceny uzbrojenia, stali pancernej i półprzewodników wojskowych.',
    analysis:
      'Kompleksy zbrojeniowo-technologiczne osiągają rekordowe zyski z każdej dostarczonej partii.',
    hints: ['Uruchom Kompleks Zbrojeniowy lub sprzedawaj stal i chipy producentom broni.'],
    mitigationHint: 'Dywersyfikacja w przemysł obronny i metale strategiczne.',
    durationTicks: 20,
    forecastLeadTicks: 5,
    relatedResource: 'weapons',
    effects: [
      { kind: 'priceMultiplier', target: 'weapons', value: 1.48 },
      { kind: 'priceMultiplier', target: 'steel', value: 1.2 },
    ],
  },
  {
    id: 'rd_subsidy_grant',
    name: 'Narodowy Grant Innowacji',
    category: 'opportunity',
    headline: 'Rząd uruchamia program dopłat do badań R&D i uczelni',
    body: 'Uniwersytety oraz laboratoria R&D generują dodatkowe punkty technologiczne w przyspieszonym tempie.',
    analysis:
      'Idealny moment na nadrabianie dystansu technologicznego do rywali i odblokowanie Atomu lub Programu Kosmicznego.',
    hints: ['Inwestuj w Szkoły, Uniwersytety i Laboratoria R&D.'],
    mitigationHint: 'Posiadanie zaplecza edukacyjnego maksymalizuje zysk z grantu.',
    durationTicks: 20,
    forecastLeadTicks: 0,
    effects: [{ kind: 'researchBoost', value: 0.5 }],
  },
  {
    id: 'global_recession',
    name: 'Spowolnienie Koniunktury',
    category: 'economy',
    forecastHeadline: 'Słabsze odczyty PMI na rynkach światowych zwiastują ochłodzenie popytu',
    forecastBody:
      'Ekonomiści ostrzegają przed przejściowym spadkiem cen surowców przemysłowych i niższym popytem na nieruchomości.',
    headline: 'KOREKTA NA RYNKACH! Ceny surowców spadają o 20%!',
    body: 'Globalne spowolnienie obniżyło wyceny surowców bazowych i przetworzonych. Firmy o wysokich kosztach stałych muszą pilnować płynności.',
    analysis:
      'To świetny moment na tani zakup działek i gromadzenie tanich surowców w magazynach przed odbiciem koniunktury.',
    hints: [
      'Przełącz fabryki na gromadzenie zapasów w magazynach zamiast sprzedaży po dołku.',
      'Wykorzystaj tani kapitał do wykupienia strategicznych gruntów.',
    ],
    mitigationHint: 'Gromadzenie zapasów w magazynach i unikanie nadmiernego lewarowania kredytowego.',
    durationTicks: 18,
    forecastLeadTicks: 6,
    effects: [{ kind: 'priceMultiplier', target: 'all', value: 0.8 }],
  },
  {
    id: 'green_subsidies',
    name: 'Premie za Czystą Energię',
    category: 'policy',
    headline: 'Zielony Ład Przemysłowy: Dopłaty do OZE i kary za emisje',
    body: 'Właściciele farm OZE otrzymują wyższe stawki za energię, podczas gdy nieekologiczne zakłady płacą wyższe kary środowiskowe.',
    analysis:
      'Czyste filtry w kopalniach i hutach oraz elektrownie OZE i atomowe stają się znacznie bardziej rentowne.',
    hints: ['Zainstaluj filtry ekologiczne w budynkach i inwestuj w Farmy OZE.'],
    mitigationHint: 'Wewnętrzne moduły ekologiczne w kopalniach, hutach i rafineriach.',
    durationTicks: 22,
    forecastLeadTicks: 5,
    effects: [
      { kind: 'priceMultiplier', target: 'electricity', value: 1.22 },
      { kind: 'voterMoodDelta', value: 5 },
    ],
  },
  // ─── KATASTROFY NATURALNE (Gdy disastersEnabled = true) ──────────────────
  {
    id: 'disaster_earthquake',
    name: 'Trzęsienie Ziemi',
    category: 'disaster',
    forecastHeadline: 'Sejsmolodzy odnotowują rosnące naprężenia tektoniczne pod regionem',
    forecastBody:
      'Stacje sejsmiczne ostrzegają przed możliwością wystąpienia silnych wstrząsów ziemi w ciągu najbliższych dni.',
    headline: 'TRZĘSIENIE ZIEMI! Poważne uszkodzenia budynków i infrastruktury!',
    body: 'Silne wstrząsy sejsmiczne przeszły przez mapę, uszkadzając kopalnie, huty, zakłady przemysłowe i drogi!',
    analysis:
      'Nieregularne wstrząsy natychmiast podnoszą poziom zniszczeń obiektów. Zakłady bez włączonej autonaprawy ryzykują awarie.',
    hints: ['Upewnij się, że masz rezerwę gotówki na naprawy i włączoną Autonaprawę.'],
    mitigationHint: 'Rezerwa gotówki, Remizy i Szpitale przyspieszające reakcję kryzysową.',
    durationTicks: 10,
    forecastLeadTicks: 4,
    effects: [
      { kind: 'disasterDamage', value: 24 },
      { kind: 'voterMoodDelta', value: -8 },
    ],
  },
  {
    id: 'disaster_flood',
    name: 'Katastrofalna Powódź Rzeczna',
    category: 'disaster',
    forecastHeadline: 'Gwałtowne ulewy podnoszą stan wód na rzekach — ryzyko powodzi na wybrzeżach',
    forecastBody:
      'Synoptycy prognozują przekroczenie stanów alarmowych na polach przybrzeżnych i w pobliżu rzek.',
    headline: 'POWÓDŹ ZALEWA WYBRZEŻE! Obiekty nadrzeczne i porty pod wodą!',
    body: 'Woda wystąpiła z brzegów, uszkadzając infrastrukturę nadbrzeżną, drogi przy rzece oraz zakłady przemysłowe na terenach nisko położonych.',
    analysis:
      'Działki typu coastal i grass są najbardziej narażone na zalanie oraz przejściowe skoki cen materiałów budowlanych.',
    hints: ['Dywersyfikuj inwestycje poza samą linię brzegową i zabezpiecz finanse.'],
    mitigationHint: 'Prefabrykaty na odbudowę i obiekty na terenach wyżynnych.',
    durationTicks: 12,
    forecastLeadTicks: 4,
    effects: [
      { kind: 'disasterDamage', value: 20 },
      { kind: 'priceMultiplier', target: 'steel', value: 1.25 },
    ],
  },
  {
    id: 'disaster_tornado',
    name: 'Niszczycielskie Tornado',
    category: 'disaster',
    forecastHeadline: 'Alerty tornadowe: gwałtowny front burzowy zbliża się nad równiny',
    forecastBody:
      'Służby meteorologiczne ostrzegają przed lokalnym lejem kondensacyjnym mogącym przejść przez pas przemysłowy.',
    headline: 'TORNADO PRZESZŁO PRZEZ MAPĘ! Zniszczony pas zakładów i turbin!',
    body: 'Gwałtowna trąba powietrzna przetoczyła się przez losowy pas terenu, niszcząc linie energetyczne, farmy wiatrowe i fabryki na swojej trasie.',
    analysis:
      'Tornado uderza punktowo z ogromną siłą — warto natychmiast sprawdzić uszkodzenia w wyznaczonym sektorze.',
    hints: ['Napraw uszkodzone obiekty lub wyślij ekipy techniczne zanim stan spadnie do ruiny.'],
    mitigationHint: 'Autonaprawa oraz dywersyfikacja przestrzenna fabryk.',
    durationTicks: 8,
    forecastLeadTicks: 3,
    effects: [{ kind: 'disasterDamage', value: 28 }],
  },
  {
    id: 'disaster_heatwave',
    name: 'Ekstremalna Fala Upałów i Susza',
    category: 'disaster',
    forecastHeadline: 'Rekordowa kopuła gorąca nadciąga nad kontynent — grozi załamanie ujęć wody',
    forecastBody:
      'Temperatury przekraczają normy klimatyczne, drastycznie zwiększając zapotrzebowanie na wodę i energię chłodzącą.',
    headline: 'KATASTROFALNA FALA UPAŁÓW! Kryzys chłodzenia w całej gospodarce!',
    body: 'Rekordowe upały sparaliżowały rzeki i wywołały gwałtowny skok cen wody oraz prądu.',
    analysis:
      'Elektrownie wodne i zakłady bez obiegów zamkniętych tracą ogromną część wydajności.',
    hints: ['Stawiaj Stacje Wody i rozwijaj moduły ochrony przed suszą.'],
    mitigationHint: 'Moduły obiegów zamkniętych, studnie głębinowe, elektrownie OZE/Gazowe.',
    durationTicks: 18,
    forecastLeadTicks: 5,
    relatedResource: 'water',
    effects: [
      { kind: 'hydroPenalty', value: 0.6 },
      { kind: 'waterPenalty', value: 0.45 },
      { kind: 'priceMultiplier', target: 'water', value: 1.75 },
      { kind: 'weatherCloudy', value: 0.1 },
    ],
  },
  {
    id: 'disaster_geomagnetic',
    name: 'Burza Magnetyczna (Słońce)',
    category: 'disaster',
    forecastHeadline: 'Obserwatoria ostrzegają przed potężnym rozbłyskiem słonecznym klasy X',
    forecastBody:
      'Koronalny wyrzut masy może wywołać zakłócenia w sieciach wysokiego napięcia, fabrykach półprzewodników i farmach solarnych.',
    headline: 'BURZA MAGNETYCZNA! Zakłócenia sieci energetycznych i elektroniki!',
    body: 'Silna burza geomagnetyczna przeciążyła transformatory i linie przesyłowe, obniżając moc elektrowni o 30% i windując ceny elektroniki.',
    analysis:
      'W trakcie burzy magnetycznej firmy o małym zapasie mocy MW wpadają w ostry deficyt prądu.',
    hints: ['Utrzymuj bezpieczną nadwyżkę mocy MW ponad bieżące zużycie!'],
    mitigationHint: 'Nadwyżka mocy energetycznej, technologia Inteligentne Sieci, Baterie EV.',
    durationTicks: 12,
    forecastLeadTicks: 4,
    relatedResource: 'electricity',
    effects: [
      { kind: 'energyPenalty', value: 0.3 },
      { kind: 'weatherCloudy', value: 0.25 },
      { kind: 'priceMultiplier', target: 'electricity', value: 1.45 },
      { kind: 'priceMultiplier', target: 'semiconductors', value: 1.25 },
    ],
  },
];
