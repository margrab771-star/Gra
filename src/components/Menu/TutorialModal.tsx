import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';

interface TutorialModalProps {
  onClose: () => void;
  onStartTrainingMap?: () => void;
  inLobby?: boolean;
}

interface TutorialChapter {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  sections: { heading: string; points: string[] }[];
  tip: string;
}

const CHAPTERS_PL: TutorialChapter[] = [
  {
    id: 'geo',
    icon: '🪨',
    title: '1. Start i Badania Geologiczne',
    subtitle: 'Wszystkie złoża podziemne na starcie są w 100% ukryte pod mapą.',
    sections: [
      {
        heading: 'Odkrywanie ukrytych złóż',
        points: [
          'Zanim postawisz kopalnię węgla, żelaza, miedzi, złota, ropy, uranu, litu lub diamentów, musisz przebadać działkę (ikona 🔎 Badanie Geologiczne).',
          'Po zbadaniu technologii "Geofizyka Złożowa i Georadar" odblokujesz Skan Obszarowy 3×3 oszczędzający czas i kapitał.',
          'W trybie Koalicji możesz włączyć współdzielenie map geologicznych — odkryte złoża sojuszników staną się widoczne również dla Ciebie.',
        ],
      },
      {
        heading: 'Dobór działki pod inwestycję',
        points: [
          'Góry kryją głównie węgiel, żelazo, miedź, złoto, uran, metale rzadkie i rzadkie diamenty; pustynie bogatą ropę, miedź i lit; lasy oraz równiny także mogą ukrywać cenne złoża.',
          'Oczyszczalnie ścieków, spalarnie oraz sortownie recyklingu można stawiać także na terenach leśnych poza centrum miasta.',
        ],
      },
    ],
    tip: 'Zacznij od 1–2 tanich kopalń lub elektrowni blisko centrum/dróg, zanim ruszysz na odległe bogate góry.',
  },
  {
    id: 'roads',
    icon: '🛣️',
    title: '2. Logistyka, Drogi i Płatne Autostrady',
    subtitle: 'Łączność transportowa decyduje o kosztach i szybkości reakcji służb.',
    sections: [
      {
        heading: 'Budowa dróg i myto',
        points: [
          'Kupuj sąsiednie działki i kładź na nich Zwykłe Drogi lub szybkie Autostrady Płatne (większa przepustowość, brak opóźnień i przychód z myta).',
          'Jako właściciel drogi możesz ustawić wysokość myta (Darmowe → Zaporowe), zablokować przejazd konkurentom lub nałożyć pełną blokadę drogi.',
          'Członkowie tej samej Koalicji przejeżdżają przez autostrady sojuszników całkowicie ZA DARMO (0% myta).',
        ],
      },
      {
        heading: 'Transport morski i lotniczy',
        points: [
          'Gdy rywale blokują drogi, wybuduj Port Towarowy przy wybrzeżu albo Lotnisko Cargo, które całkowicie omija blokady lądowe.',
        ],
      },
    ],
    tip: 'Płatne autostrady w wąskich przesmykach mapy potrafią finansować utrzymanie połowy imperium.',
  },
  {
    id: 'utilities',
    icon: '⚡',
    title: '3. Media: Prąd, Woda, Ścieki i Śmieci',
    subtitle: 'Nieliniowe kary za deficyt prądu lub wody potrafią sparaliżować całą produkcję.',
    sections: [
      {
        heading: 'Krytyczna sieć prądu (MW) i wody (m³)',
        points: [
          'Deficyt nie obniża już wydajności łagodnie: przy 50% pokrycia prądu lub wody fabryki pracują ledwie na ~26% mocy!',
          'Spadek pokrycia poniżej 20% całkowicie zatrzymuje obiekty produkcyjne (0% przychodu), przy dalszym naliczaniu płac i kosztów stałych.',
          'Buduj Elektrownie OZE (Wiatraki, Farmy Solarne), Gazowe, Geotermalne (odporne na pogodę!), Atomowe i Reaktory Fuzyjne.',
        ],
      },
      {
        heading: 'Ścieki i Gospodarka Odpadami',
        points: [
          'Przemysł generuje ścieki (m³) oraz odpady (t). Brak Oczyszczalni Ścieków lub zagospodarowania śmieci obniża wydajność, wywołuje kary sanitarne i złości wyborców.',
          'Masz wybór: tania Spalarnia Odpadów produkuje prąd (kosztem smogu i poparcia) albo zaawansowany Zakład Recyklingu (wymaga Uniwersytetu), który odzyskuje cenną Stal, Miedź, Lit i Metale Rzadkie prosto do Twojego magazynu!',
        ],
      },
    ],
    tip: 'Klikaj kapsułkę ⚡ 💧 🚰 🗑️ w górnym pasku, aby natychmiast sprawdzić szczegóły bilansu sieci.',
  },
  {
    id: 'economy_mp',
    icon: '🤝',
    title: '4. Gospodarka Zamknięta MP i Kontrakty B2B',
    subtitle: 'W trybie Multiplayer rynek NPC jest zamknięty — towary powstają tylko u graczy.',
    sections: [
      {
        heading: 'Zasada gospodarki zamkniętej (Multiplayer)',
        points: [
          'Budowa obiektów wymaga tylko gotówki, technologii, odpowiedniego terenu i poparcia (zero surowców na samo postawienie budynku!).',
          'Do bieżącej pracy fabryk (wsadu) w Multiplayerze NIE MOŻNA dokupywać brakujących surowców od NPC za gotówkę — musisz wydobywać je sam (z włączonym "Magazynuj") albo kupić je na rynku B2B od innych graczy.',
        ],
      },
      {
        heading: 'Kontrakty, Barter i Przetargi Rządowe',
        points: [
          'Panel Kontrakty B2B obsługuje stałe dostawy wieloturowe, szybkie transakcje Spot (jednorazowe), Barter (towar za towar) oraz publiczną Tablicę Ofert Otwartych.',
          'Realizuj okresowe Przetargi Rządowe z zapasów magazynowych, aby zdobyć premię gotówkową, wpływy i poparcie wyborców.',
        ],
      },
    ],
    tip: 'Jeśli brakuje Ci wsadu w fabryce w grze sieciowej, otwórz Giełdę B2B i wystaw otwarte zlecenie kupna lub zaproponuj barter!',
  },
  {
    id: 'hazards',
    icon: '🚒',
    title: '5. Pożary, Ruiny, Służby i Komornik',
    subtitle: 'Niegaszone incydenty obracają zakłady w ruiny, a długi kończą się licytacją.',
    sections: [
      {
        heading: 'Służby ratunkowe i zniszczenia',
        points: [
          'Pożary i wycieki HAZMAT zdarzają się rzadziej i wyłącznie w zakładach wysokiego ryzyka (elektrownie, chemia, huty, rafinerie, atom).',
          'Gdy brakuje wolnych wozów Straży Pożarnej lub HAZMAT, wskaźnik zniszczeń rośnie aż do 100% — po przekroczeniu progu budynek zamienia się w Ruiny, które trzeba odpłatnie uprzątnąć.',
          'W panelu obiektu znajdziesz przełącznik "Pipeta (Klonuj)" oraz globalny szablon Autonaprawy dla całej firmy.',
        ],
      },
      {
        heading: 'Niewypłacalność i Egzekucja Komornicza',
        points: [
          'Głębokie ujemne saldo uruchamia 12-turowe Ostateczne Wezwanie do Zapłaty (widoczne w górnym pasku). Po upływie czasu komornik licytuje Twoje najdroższe aktywa, aż spłacisz dług lub ogłosisz upadłość!',
        ],
      },
    ],
    tip: 'Śmigłowce ratownicze w Remizach, Szpitalach i Bazach HAZMAT dolatują nad zniszczonymi lub zablokowanymi drogami.',
  },
  {
    id: 'tech_trees',
    icon: '🌳',
    title: '6. Drzewko Prezesa, Patenty i Projekty Flagowe',
    subtitle: 'Interaktywne drzewko do przesuwania (Pan & Zoom) oraz elitarne Projekty Flagowe.',
    sections: [
      {
        heading: 'Drzewko Prezesa (40 umiejętności, 5 gałęzi)',
        points: [
          'Chwytaj tło drzewka myszką lub palcem, aby przesuwać widok, oraz używaj kółka/przycisków +/− do przybliżania.',
          'Najwyższe szczeble (Tier 5–8) oferują potężne bonusy końca gry, ale wymagają wysokiego Poziomu Korporacji, gotówki, punktów wpływów i zbadanych technologii.',
        ],
      },
      {
        heading: 'Wyłączne Patenty i Projekty Flagowe (Tier 4)',
        points: [
          'Kto pierwszy ukończy przełomową technologię globalną (np. Litografia EUV, Recykling, Reaktor Fuzyjny), zdobywa wyłączny Patent generujący stałe tantiemy przez 140 tur.',
          'Każdy budynek posiada końcowy moduł „Projekt Flagowy” oznaczony złotą aurą na mapie.',
        ],
      },
    ],
    tip: 'Wyścig po pierwszy Patent R&D potrafi zapewnić stały dochód pasywny już we wczesnym etapie gry.',
  },
  {
    id: 'diplomacy_nuke',
    icon: '☢️',
    title: '7. Koalicje, Polityka i Tajny Program Jądrowy',
    subtitle: 'Dyplomacja, sankcje celne, taktyczne rakiety 3×3 oraz ściśle tajny arsenał atomowy.',
    sections: [
      {
        heading: 'Koalicje, Pakty NAP i Embarga',
        points: [
          'W panelu Wpływy możesz utworzyć Koalicję (z limitem miejsc zależnym od liczby graczy), wysyłać zaproszenia, zawierać Pakty o Nieagresji (80 tur ochrony przed sabotażem/wykupem) oraz nakładać Embarga handlowe (blokada B2B i dróg).',
          'Przymusowy wykup wymaga min. 4. Poziomu Korporacji, dużych wpływów oraz kapitału i może zostać zablokowany przez dział prawny lub kontrwywiad ofiary!',
        ],
      },
      {
        heading: 'Baza PMC, Rakiety 3×3 i Broń Jądrowa 5×5',
        points: [
          'Budowa Bazy Wojskowej PMC wymaga min. 75% poparcia społecznego. Projekt Flagowy Bazy PMC odblokowuje taktyczne uderzenie rakietowe 3×3 zamieniające cel w ruiny.',
          'Posiadanie jednocześnie Kopalni Uranu, Wzbogacania Uranu, Uniwersytetu, R&D i Bazy PMC ujawnia Tajny Program Jądrowy. Budowa głowicy może zostać wykryta przez wrogie Centra Wywiadu, a wybuch 5×5 niszczy wszystko i skaża teren na 180 tur!',
        ],
      },
    ],
    tip: 'Jeśli budujesz potęgę militarną, najpierw zadbaj o poparcie społeczne (Parki, Szpitale, Kampanie Medialne) powyżej 75%.',
  },
  {
    id: 'finance_win',
    icon: '👑',
    title: '8. Bankowość, Cykle Rynkowe i Warunki Zwycięstwa',
    subtitle: 'Uważaj na bańki spekulacyjne, krachy i limit 3 kredytów w Multiplayerze.',
    sections: [
      {
        heading: 'Cykle koniunkturalne (Hossa → Bańka → Krach)',
        points: [
          'Kliknij pasek notowań u góry ekranu lub otwórz Pełny Rynek i Indeksy, aby śledzić 5 indeksów sektorowych. Krach po bańce potrafi zbić wyceny surowców o ponad 45–55%!',
          'Możesz przypinać ulubione surowce gwiazdką ★ na pasek Live Ticker.',
        ],
      },
      {
        heading: 'Finanse i Zwycięstwo',
        points: [
          'W trybie Multiplayer limit zadłużenia to twarde 3 aktywne kredyty (spłać istniejący w całości, aby wziąć kolejny).',
          'Wygrywasz poprzez Dominację Solową (osiągnięcie wybranego progu dominacji 65–85%, domyślnie 75% + wycena netto), wygaśnięcie zegara wyzwania z najwyższym wynikiem, bankructwo rywali lub wspólne zwycięstwo w trybie Dominacji Koalicji!',
        ],
      },
    ],
    tip: 'W hossie zbieraj rezerwy gotówki i skracaj długi, aby podczas krachu tanio wykupywać działki i akcje konkurentów.',
  },
];

const CHAPTERS_EN: TutorialChapter[] = [
  {
    id: 'geo',
    icon: '🪨',
    title: '1. Launch & Geological Surveys',
    subtitle: 'All underground resource seams start 100% hidden beneath the map.',
    sections: [
      {
        heading: 'Uncovering Hidden Deposits',
        points: [
          'Before building a Coal, Iron, Copper, Gold, Oil, Uranium, Lithium, or Diamond Mine, survey the tile first (🔎 Geological Survey).',
          'Researching "Deposit Geophysics & GPR" unlocks 3×3 Area Surveys that cut scanning cost and time.',
          'Inside a Coalition, share geological maps so discoveries made by allies immediately reveal deposits to you too.',
        ],
      },
      {
        heading: 'Site Selection',
        points: [
          'Mountains harbor coal, iron, copper, gold, uranium, rare earths & rare diamonds; deserts hide deep oil, copper & lithium; forests and plains may conceal valuable seams too.',
          'Sewage Plants, Incinerators, and Recycling Facilities can also operate on forest plots outside the city core.',
        ],
      },
    ],
    tip: 'Open with 1–2 affordable mines or power stations close to roads before pushing deep into mountain ridges.',
  },
  {
    id: 'roads',
    icon: '🛣️',
    title: '2. Logistics, Roads & Toll Highways',
    subtitle: 'Network connectivity governs shipping costs, utility reach, and emergency speed.',
    sections: [
      {
        heading: 'Building Roads & Tolls',
        points: [
          'Buy neighboring plots and lay Standard Roads or fast Toll Highways (higher throughput, zero congestion, plus passive toll cash).',
          'Road owners control toll tariffs (Free → Prohibitive) and can selectively deny passage or enforce full transit blockades.',
          'Coalition members drive across allied toll highways completely FREE (0% toll).',
        ],
      },
      {
        heading: 'Maritime & Air Freight',
        points: [
          'Across oceans or rival roadblocks, construct coastal Cargo Ports or Cargo Airports to bypass land choke points.',
        ],
      },
    ],
    tip: 'A well-placed toll highway through a narrow chokepoint can subsidize half an empire.',
  },
  {
    id: 'utilities',
    icon: '⚡',
    title: '3. Utilities: Power, Water, Sewage & Waste',
    subtitle: 'Non-linear power or water deficit curves rapidly throttle factory output.',
    sections: [
      {
        heading: 'Critical Power (MW) & Water (m³) Grids',
        points: [
          'Deficits compound steeply: 50% grid coverage drops output down to ~26%!',
          'Below 20% coverage halts industrial plants completely (0% revenue) while wages and fixed upkeep still drain cash.',
          'Mix Renewables (Wind, Solar), Gas, Geothermal (weather-proof!), Nuclear, and Fusion Reactors — keeping physical coal/oil/uranium fuel supplied by trucks.',
        ],
      },
      {
        heading: 'Sewage & Waste Disposal',
        points: [
          'Factories produce sewage (m³) and solid waste (t). Leaving them untreated hurts output, adds sanitary fines, and angers voters.',
          'Choose between budget Waste Incinerators (bonus power at smog/approval cost) or University-backed Recycling Plants reclaiming Steel, Copper, Lithium & Rare Earths into your warehouse.',
        ],
      },
    ],
    tip: 'Click the ⚡ 💧 🚰 🗑️ utility pill in the top bar anytime to inspect live network balances.',
  },
  {
    id: 'economy_mp',
    icon: '🤝',
    title: '4. Closed MP Economy & B2B Contracts',
    subtitle: 'In Multiplayer, NPC input supply is disabled — goods come strictly from players.',
    sections: [
      {
        heading: 'Closed Player-Driven Supply (Multiplayer)',
        points: [
          'Construction costs only cash, research, terrain & voter approval (zero commodity materials needed to place buildings).',
          'Ongoing factory inputs in Multiplayer CANNOT be bought off-map from NPCs — mine them yourself ("Store %" slider) or secure B2B contracts with rivals and allies.',
        ],
      },
      {
        heading: 'Contracts, Barter & State Tenders',
        points: [
          'The B2B Contracts panel handles recurring deliveries, instant Spot lots, Barter swaps, and public Open Order Boards.',
          'Fulfill State Tenders out of warehouse stock for lump-sum cash, political influence & voter approval.',
        ],
      },
    ],
    tip: 'Short on factory inputs in PvP? Post an open buy order or barter deal on the B2B Exchange immediately.',
  },
  {
    id: 'hazards',
    icon: '🚒',
    title: '5. Hazards, Ruins, Responders & Bailiff',
    subtitle: 'Unchecked fires turn plants into ruins, and chronic deficits trigger asset auctions.',
    sections: [
      {
        heading: 'Emergency Services & Wreckage',
        points: [
          'Fires and HAZMAT leaks strike high-risk plants (power stations, refineries, smelters, chemicals, nuclear).',
          'Without free Fire or HAZMAT units, damage climbs to 100% and turns facilities into Ruins requiring paid demolition.',
          'Use "Eyedropper (Clone)" inside Building Panels or enable global Auto-Repair.',
        ],
      },
      {
        heading: 'Insolvency & Bailiff Seizure',
        points: [
          'Deep negative balances start a 12-tick Final Payment Warning countdown in the top bar. If unpaid, bailiffs auction your prized assets until debt clears or bankruptcy hits!',
        ],
      },
    ],
    tip: 'Rescue helicopters at upgraded Fire Stations, Hospitals & HAZMAT Bases fly straight over blocked roads.',
  },
  {
    id: 'tech_trees',
    icon: '🌳',
    title: '6. CEO Skill Tree, Patents & Flagship Projects',
    subtitle: 'Interactive Pan & Zoom skill graph, exclusive Patents, and Flagship upgrades.',
    sections: [
      {
        heading: 'CEO Tree (40 Skills across 5 Branches)',
        points: [
          'Drag the canvas to pan and use the mouse wheel or +/− controls to zoom.',
          'Late-game Tiers 5–8 deliver massive empire bonuses gated by Corporate Level, cash, influence & tech unlocks.',
        ],
      },
      {
        heading: 'Exclusive Patents & Flagship Nodes',
        points: [
          'Being first to research breakthrough global techs (e.g. EUV Lithography, Recycling, Fusion) grants an exclusive Patent paying passive royalties for 140 ticks.',
          'Every building concludes its upgrade path in an elite "Flagship Project" marked by a golden aura on the map.',
        ],
      },
    ],
    tip: 'Racing for an early R&D Patent funds your mid-game research budget almost effortlessly.',
  },
  {
    id: 'diplomacy_nuke',
    icon: '☢️',
    title: '7. Coalitions, Politics & Secret Nuclear Program',
    subtitle: 'Diplomacy, trade embargoes, 3×3 tactical missiles, and covert nuclear arsenals.',
    sections: [
      {
        heading: 'Coalitions, Non-Aggression Pacts & Embargoes',
        points: [
          'Open Influence to form Coalitions, send invitations, sign 80-tick Non-Aggression Pacts, or slap rivals with trade & road embargoes.',
          'Hostile buyouts require Corporate Level 4+, heavy influence & capital — and can be blocked by corporate counsel or counterintelligence!',
        ],
      },
      {
        heading: 'PMC Base, 3×3 Strikes & 5×5 Nuclear Warheads',
        points: [
          'PMC Military Bases require ≥ 75% voter approval; their Flagship unlocks 3×3 tactical rocket strikes turning target blocks into rubble.',
          'Controlling Uranium Mine + Uranium Enrichment + University + R&D + PMC Base unlocks the Secret Nuclear Program. Warhead assembly may be detected by enemy Intelligence Centers, and a 5×5 detonation irradiates land for 180 ticks!',
        ],
      },
    ],
    tip: 'Raise voter approval above 75% via Parks, Hospitals & Media Campaigns before constructing military bases.',
  },
  {
    id: 'finance_win',
    icon: '👑',
    title: '8. Banking, Market Cycles & Victory Conditions',
    subtitle: 'Watch out for speculative bubbles, crashes, and the 3-loan cap in Multiplayer.',
    sections: [
      {
        heading: 'Sector Cycles (Boom → Bubble → Crash)',
        points: [
          'Click the top quote strip or open Full Market & Indexes to track 5 sector benchmarks. Post-bubble crashes slash commodity prices by 45–55%!',
          'Pin favorite commodities with ★ to keep them on your Live Ticker.',
        ],
      },
      {
        heading: 'Finance & Winning the Match',
        points: [
          'Multiplayer limits debt to 3 active loans at once (pay one off in full to borrow again).',
          'Win via Solo Domination (crossing the configured 65–85% threshold, default 75%), leading Net Worth at Challenge timeout, eliminating all rivals, or winning together in Coalition Domination!',
        ],
      },
    ],
    tip: 'Build cash reserves and pay down debt during Booms so you can snap up cheap land and shares during Crashes.',
  },
];

export const TutorialModal: React.FC<TutorialModalProps> = ({
  onClose,
  onStartTrainingMap,
  inLobby = false,
}) => {
  const { lang } = useI18n();
  const chapters = lang === 'en' ? CHAPTERS_EN : CHAPTERS_PL;
  const [activeIdx, setActiveIdx] = useState(0);
  const chapter = chapters[activeIdx];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-[#0e1420] border border-sky-500/40 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 md:px-6 py-3.5 bg-[#0b0f17] border-b border-[#243044] flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono text-sky-400 uppercase tracking-wider">
              {lang === 'en'
                ? 'STRATEGY COMPENDIUM · MARKET DOMINION'
                : 'KOMPENDIUM STRATEGICZNE · MARKET DOMINION'}
            </div>
            <h2 className="text-lg md:text-xl font-extrabold text-white">
              {lang === 'en'
                ? '🎓 Complete Gameplay Guide & Handbook'
                : '🎓 Kompletny Przewodnik i Samouczek Rozgrywki'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {onStartTrainingMap && !inLobby && (
              <button
                type="button"
                onClick={onStartTrainingMap}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow"
              >
                {lang === 'en' ? '▶ Launch Training Map' : '▶ Uruchom Mapę Treningową'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#1a2438] hover:bg-[#24314a] border border-[#2d3b52] text-slate-200 text-xs font-semibold"
            >
              {lang === 'en' ? '✕ Close' : '✕ Zamknij'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Spis rozdziałów */}
          <aside className="md:w-64 shrink-0 bg-[#0b0f17] border-b md:border-b-0 md:border-r border-[#243044] p-2.5 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto">
            {chapters.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`shrink-0 md:shrink text-left px-3 py-2 rounded-xl border text-xs transition-all flex items-center gap-2 ${
                  idx === activeIdx
                    ? 'bg-sky-950/50 border-sky-400/70 text-white font-semibold'
                    : 'bg-[#111827]/70 border-[#1e293b] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <span className="text-base shrink-0">{ch.icon}</span>
                <span className="line-clamp-2">{ch.title}</span>
              </button>
            ))}
          </aside>

          {/* Treść aktywnego rozdziału */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#243044] pb-3">
              <div>
                <div className="flex items-center gap-2 text-2xl font-extrabold text-white">
                  <span>{chapter.icon}</span>
                  <h3>{chapter.title}</h3>
                </div>
                <p className="text-xs md:text-sm text-sky-300 mt-1">{chapter.subtitle}</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#161f30] border border-[#243044] font-mono text-[11px] text-slate-300 shrink-0">
                {lang === 'en'
                  ? `Chapter ${activeIdx + 1} / ${chapters.length}`
                  : `Rozdział ${activeIdx + 1} / ${chapters.length}`}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {chapter.sections.map((sec) => (
                <div
                  key={sec.heading}
                  className="p-3.5 rounded-xl bg-[#111827] border border-[#243044] space-y-2"
                >
                  <div className="text-sm font-bold text-amber-300">{sec.heading}</div>
                  <ul className="space-y-1.5 text-xs md:text-[13px] text-slate-200 leading-relaxed">
                    {sec.points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-sky-400 font-bold mt-0.5">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
              <span className="text-base leading-none">💡</span>
              <div>
                <strong>{lang === 'en' ? 'Tactical tip:' : 'Wskazówka taktyczna:'}</strong>{' '}
                {chapter.tip}
              </div>
            </div>
          </main>
        </div>

        {/* Footer nawigacji */}
        <div className="px-4 md:px-6 py-3 bg-[#0b0f17] border-t border-[#243044] flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            disabled={activeIdx === 0}
            onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
            className="px-3.5 py-2 rounded-lg bg-[#161f30] border border-[#243044] text-slate-200 disabled:opacity-40"
          >
            {lang === 'en' ? '← Previous chapter' : '← Poprzedni rozdział'}
          </button>
          <div className="text-[11px] text-slate-400 hidden sm:block">
            {inLobby
              ? lang === 'en'
                ? 'Reading handbook without leaving your Multiplayer room'
                : 'Przeglądasz przewodnik bez opuszczania pokoju Multiplayer'
              : lang === 'en'
                ? 'Available anytime from Main Menu, Lobby, and Top Bar'
                : 'Dostępny w każdej chwili z Menu, Lobby i paska gry'}
          </div>
          {activeIdx < chapters.length - 1 ? (
            <button
              type="button"
              onClick={() => setActiveIdx((i) => Math.min(chapters.length - 1, i + 1))}
              className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
            >
              {lang === 'en' ? 'Next chapter →' : 'Następny rozdział →'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {lang === 'en' ? 'Got It — Close' : 'Zrozumiałem — Powrót'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
