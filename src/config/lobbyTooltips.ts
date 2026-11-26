import { getArchetypeDefinition } from '../data/archetypes';
import type { ArchetypeId, DifficultyPreset, ScenarioId } from '../engine/types';
import { DIFFICULTY_PRESETS, SCENARIO_DEFINITIONS } from './gameConfig';

export interface TooltipSpec {
  title: string;
  description?: string;
  bullets?: string[];
  pros?: string[];
  cons?: string[];
}

export function getTempoTooltip(mode: 'mp_fast' | 'mp_long' | 'challenge1h' | 'endless'): TooltipSpec {
  switch (mode) {
    case 'mp_fast':
      return {
        title: '⚡ Tryb Przyspieszony (~1h)',
        description:
          'Dynamiczny mecz z zegarem 60 minut. Po upływie czasu wygrywa lider wyceny netto lub pierwsza dominacja.',
        bullets: ['Czas wyzwania: 60 min', 'Idealny na wieczorną sesję PvP'],
      };
    case 'mp_long':
      return {
        title: '🏛️ Kampania Długa (Głęboka)',
        description:
          'Pełnoskalowa rozgrywka bez limitu czasowego — do osiągnięcia wybranego progu dominacji (domyślnie 75%) lub eliminacji rywali.',
        bullets: ['Czas: bez limitu', 'Pełny rozwój Etapu 5 i koalicji'],
      };
    case 'challenge1h':
      return {
        title: '⏱️ Wyzwanie 1-Godzinne',
        description:
          '60 minut na maksymalizację wyceny netto i zapis wyniku w Rankingu. Po zakończeniu możesz grać dalej.',
        bullets: ['Zegar: 60 min', 'Później tryb Endless'],
      };
    default:
      return {
        title: '♾️ Tryb Bez Limitu (Endless)',
        description:
          'Rozgrywka strategiczna bez presji czasu — wygrywa pierwsza korporacja lub koalicja przekraczająca próg dominacji.',
      };
  }
}

export function getMapSizeTooltip(mapSize: number): TooltipSpec {
  const tiles = mapSize * mapSize;
  const recs: Record<number, { name: string; players: string; pacing: string }> = {
    20: { name: 'Kompaktowa 20×20', players: '1–4 graczy', pacing: 'Szybki kontakt i ostra walka o surowce' },
    24: { name: 'Standardowa 24×24', players: '2–5 graczy', pacing: 'Zbalansowana ekonomia i sieci dróg' },
    32: { name: 'Duża 32×32', players: '4–8 graczy', pacing: 'Rozbudowana logistyka i autostrady płatne' },
    40: { name: 'Kontynentalna 40×40', players: '6–8 graczy', pacing: 'Długa ekspansja, porty i terminale lotnicze' },
  };
  const info = recs[mapSize] ?? {
    name: `Mapa ${mapSize}×${mapSize}`,
    players: '1–8 graczy',
    pacing: 'Niestandardowy obszar operacyjny',
  };
  return {
    title: `🗺️ ${info.name} (${tiles.toLocaleString('pl-PL')} pól)`,
    description: info.pacing,
    bullets: [`Zalecana liczba podmiotów: ${info.players}`],
  };
}

export function getAiDifficultyTooltip(aiDifficulty: number): TooltipSpec {
  const details: Record<number, { title: string; desc: string }> = {
    1: {
      title: '🤖 Bot AI: Łatwy',
      desc: 'Rozwija się powoli, rzadko blokuje autostrady i nie prowadzi agresywnych operacji wywiadu.',
    },
    2: {
      title: '🤖 Bot AI: Normalny',
      desc: 'Systematycznie buduje łańcuchy dostaw i podstawową infrastrukturę, bez gwałtownego wykupywania graczy.',
    },
    3: {
      title: '🤖 Bot AI: Ambitny',
      desc: 'Aktywnie bada złoża, rozwija technologie oraz zabezpiecza media i służby w swoich sektorach.',
    },
    4: {
      title: '🤖 Bot AI: Ekspert',
      desc: 'Optymalizuje synergie dzielnic, licytuje aktywa komornicze i sprawnie reaguje na cykle giełdowe.',
    },
    5: {
      title: '🤖 Bot AI: Rekin Biznesu',
      desc: 'Maksymalna presja strategiczna: stawia płatne autostrady, skupuje akcje rywali, lobbuje rząd i inwestuje w atom.',
    },
  };
  const picked = details[aiDifficulty] ?? details[2];
  return { title: picked.title, description: picked.desc };
}

export function getDifficultyPresetTooltip(presetId: DifficultyPreset): TooltipSpec {
  const p = DIFFICULTY_PRESETS[presetId] ?? DIFFICULTY_PRESETS.standard;
  const cashPct = Math.round((p.startingCashMult - 1) * 100);
  const taxPct = Math.round(p.taxMult * 100);
  const maintPct = Math.round(p.maintenanceMult * 100);
  const utilPct = Math.round(p.utilityPenaltyMult * 100);
  const intPct = (p.interestDelta * 100).toFixed(1);
  return {
    title: `${p.badge} ${p.label}`,
    bullets: [
      `Gotówka startowa: ${cashPct === 0 ? '100% (baza)' : `${cashPct > 0 ? '+' : ''}${cashPct}%`}`,
      `Podatki: ${taxPct}% · Utrzymanie: ${maintPct}%`,
      `Kary mediów: ${utilPct}% · Odsetki: ${p.interestDelta >= 0 ? `+${intPct}` : intPct} p.p.`,
      `Komornik po ${p.bailiffGraceTicks} turach deficytu`,
    ],
  };
}

export function getScenarioTooltip(scenarioId: ScenarioId): TooltipSpec {
  const sc = SCENARIO_DEFINITIONS.find((s) => s.id === scenarioId) ?? SCENARIO_DEFINITIONS[0];
  return {
    title: `${sc.icon} ${sc.name}`,
    description: sc.description,
    bullets: [`Rekomendacja: ${sc.recommendedPlayers}`],
  };
}

export function getDisastersTooltip(enabled: boolean): TooltipSpec {
  return enabled
    ? {
        title: '🌪️ Katastrofy Naturalne: WŁĄCZONE',
        description:
          'Występują pożary, napady, wycieki HAZMAT, susze, powodzie i burze niszczące niezabezpieczone zakłady.',
        bullets: [
          'Ochrona: Remizy, Szpitale, Bazy HAZMAT, Policja',
          'Polisa ubezpieczeniowa zwraca 65% wartości przy szkodzie',
        ],
      }
    : {
        title: '🛡️ Katastrofy Naturalne: WYŁĄCZONE',
        description:
          'Wyłączone globalne klęski pogodowe i trzęsienia ziemi. Nadal działają standardowe wymogi bezpieczeństwa i utrzymania.',
      };
}

export function getVictoryTooltip(
  victoryMode: 'solo' | 'coalition',
  dominationThreshold = 75
): TooltipSpec {
  return victoryMode === 'coalition'
    ? {
        title: '🤝 Dominacja Koalicji',
        description: `Wygrywa koalicja, która osiągnie ${dominationThreshold}% dominacji rynkowej i zbuduje wspólne zaplecze kapitałowe.`,
        bullets: [
          `Próg dominacji koalicji: ${dominationThreshold}%`,
          '0% myta między sojusznikami i wspólne zwycięstwo sojuszu',
        ],
      }
    : {
        title: '👑 Dominacja Solowa',
        description: `Wygrywa gracz, który samodzielnie osiągnie ${dominationThreshold}% dominacji rynkowej.`,
        bullets: [
          `Próg dominacji: ${dominationThreshold}%`,
          'Sojusze ułatwiają handel i bezpieczeństwo, ale wygrywa lider',
        ],
      };
}

export function getArchetypeTooltip(archetypeId: ArchetypeId): TooltipSpec {
  const arch = getArchetypeDefinition(archetypeId);
  return {
    title: `${arch.icon} ${arch.name}`,
    description: arch.tagline,
    pros: arch.pros,
    cons: arch.cons,
  };
}
