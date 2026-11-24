# Market Dominion

Przeglądarkowa gra strategiczno-ekonomiczna (realistyczny tycoon biznesowy) z izometryczną mapą **2.5D**, interfejsem terminala giełdowego, pełną symulacją łańcuchów dostaw i kadr **HR/ZUS**, trzema filarami wpływu na państwo oraz trybem **Multiplayer WebRTC (PeerJS)** działającym bezpośrednio na **GitHub Pages** bez własnego serwera backendowego.

## Główne Funkcjonalności
- **Izometryczna Mapa 2.5D (Canvas)**: płaska architektura low-poly, animowane ciężarówki towarowe i autobusy pracownicze, ikony statusów nad budynkami (`⚡`, `💧`, `⚠️`, `📦`, `✨`), obsługa myszy oraz gestów dotykowych (pan + pinch-to-zoom).
- **33 Struktury z Własnymi Drzewkami Tech**: kopalnie, huty, rafinerie, półprzewodniki, elektrownie (węglowa, wodna, OZE, atomowa), kosmodrom, magazyny spekulacyjne, hotele, kurorty, biurowce z lądowiskami, banki, szkoły, uniwersytety, fundacje kościelne, media i wywiad.
- **6 Strategii Zwycięstwa**: Baron Surowcowy, Monopolista Atomowy, Magnat Nieruchomości, Szara Eminencja, Korporacyjny Kondotier, Architekt Łańcuchów B2B.
- **Giełda, Wykresy Świecowe i Gazeta**: dynamiczna elastyczność cen, prognozy trendów wyprzedzające skoki rynkowe (np. kryzys naftowy, susza uderzająca w hydroenergetykę), wykresy świecowe OHLC oraz Monopol Meter.
- **Tryby Gry**:
  - **Single Player Offline**: Wyzwanie 1h z kontynuacją Endless + boty AI o 6 osobowościach.
  - **Multiplayer Online (PeerJS WebRTC)**: pokoje z krótkim kodem (np. `MD-4821`), kopiowanie linku zaproszenia (`?room=MD-4821`), synchronizacja Host-Authoritative, obsługa rozłączeń (pauza lub przejęcie przez AI), tempo *Tryb Przyspieszony (~1h)* oraz *Kampania Długa*.

## Uruchomienie Lokalne

```bash
cd market-dominion
npm install
npm run dev
```

Weryfikacja typów i build produkcyjny:
```bash
npx tsc --noEmit
npm run build
```

## Publikacja na GitHub Pages

Projekt jest skonfigurowany z `base: './'` w `vite.config.ts` jako czysta aplikacja statyczna:

1. Wypchnij zawartość folderu `market-dominion` do repozytorium na GitHubie.
2. Zbuduj projekt komendą `npm run build` (wynik trafia do `dist/`).
3. Wdróż folder `dist/` na gałąź `gh-pages` (np. przez `npx gh-pages -d dist` lub GitHub Actions `actions/deploy-pages` z artefaktem `./dist`).
4. W ustawieniach repozytorium (`Settings -> Pages`) wskaż źródło publikacji — gra wraz z multiplayerem WebRTC i linkami `?room=MD-XXXX` będzie działać od razu bez dodatkowego serwera!

## Opcjonalna Chmurowa Tabela Wyników (Supabase)

Gra działa bez żadnej konfiguracji (zapis lokalny w `localStorage`). Jeśli chcesz włączyć globalną tabelę wyników w chmurze:
1. Utwórz darmowy projekt na [Supabase](https://supabase.com) i tabelę `leaderboard` z kolumnami: `id (uuid)`, `player_name (text)`, `company_name (text)`, `net_worth (numeric)`, `strategy (text)`, `score (int)`, `mode (text)`, `created_at (timestamptz)`.
2. Skopiuj `.env.example` do `.env` i uzupełnij `VITE_SUPABASE_URL` oraz `VITE_SUPABASE_ANON_KEY`.
