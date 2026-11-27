import { getArchetypeDefinition } from '../data/archetypes';
import type { ArchetypeId, DifficultyPreset, ScenarioId } from '../engine/types';
import { getCurrentLanguage } from '../i18n';
import {
  localizeArchetype,
  localizeDifficultyPreset,
  localizeScenario,
} from '../i18n/dataTranslations';
import { DIFFICULTY_PRESETS, SCENARIO_DEFINITIONS } from './gameConfig';

export interface TooltipSpec {
  title: string;
  description?: string;
  bullets?: string[];
  pros?: string[];
  cons?: string[];
}

export function getTempoTooltip(mode: 'mp_fast' | 'mp_long' | 'challenge1h' | 'endless'): TooltipSpec {
  const en = getCurrentLanguage() === 'en';
  switch (mode) {
    case 'mp_fast':
      return en
        ? {
            title: '⚡ Accelerated Mode (~1h)',
            description:
              'Dynamic 60-minute match timer. When time expires, highest net worth or earliest domination wins.',
            bullets: ['Match duration: 60 min', 'Ideal for intense evening PvP sessions'],
          }
        : {
            title: '⚡ Tryb Przyspieszony (~1h)',
            description:
              'Dynamiczny mecz z zegarem 60 minut. Po upływie czasu wygrywa lider wyceny netto lub pierwsza dominacja.',
            bullets: ['Czas wyzwania: 60 min', 'Idealny na wieczorną sesję PvP'],
          };
    case 'mp_long':
      return en
        ? {
            title: '🏛️ Long Campaign (Deep)',
            description:
              'Full-scale match without a clock — play until reaching the configured domination threshold (default 75%) or eliminating rivals.',
            bullets: ['Time limit: none', 'Full Tier 5 expansion & late-game coalitions'],
          }
        : {
            title: '🏛️ Kampania Długa (Głęboka)',
            description:
              'Pełnoskalowa rozgrywka bez limitu czasowego — do osiągnięcia wybranego progu dominacji (domyślnie 75%) lub eliminacji rywali.',
            bullets: ['Czas: bez limitu', 'Pełny rozwój Etapu 5 i koalicji'],
          };
    case 'challenge1h':
      return en
        ? {
            title: '⏱️ 1-Hour Challenge',
            description:
              '60 minutes to maximize your net worth and post a ranked score. Afterward you can keep playing in Endless mode.',
            bullets: ['Clock: 60 min', 'Continues into Endless afterward'],
          }
        : {
            title: '⏱️ Wyzwanie 1-Godzinne',
            description:
              '60 minut na maksymalizację wyceny netto i zapis wyniku w Rankingu. Po zakończeniu możesz grać dalej.',
            bullets: ['Zegar: 60 min', 'Później tryb Endless'],
          };
    default:
      return en
        ? {
            title: '♾️ Endless Strategic Mode',
            description:
              'Strategic simulation with no timer — the first corporation or coalition exceeding the domination threshold wins.',
          }
        : {
            title: '♾️ Tryb Bez Limitu (Endless)',
            description:
              'Rozgrywka strategiczna bez presji czasu — wygrywa pierwsza korporacja lub koalicja przekraczająca próg dominacji.',
          };
  }
}

export function getMapSizeTooltip(mapSize: number): TooltipSpec {
  const en = getCurrentLanguage() === 'en';
  const tiles = mapSize * mapSize;
  const recs: Record<number, { name: string; players: string; pacing: string }> = en
    ? {
        20: { name: 'Compact 20×20', players: '1–4 players', pacing: 'Fast border contact & fierce resource competition' },
        24: { name: 'Standard 24×24', players: '2–5 players', pacing: 'Balanced economy and road networks' },
        32: { name: 'Large 32×32', players: '4–8 players', pacing: 'Deep logistics chains & profitable toll highways' },
        40: { name: 'Continental 40×40', players: '6–8 players', pacing: 'Long-term expansion, cargo ports & air terminals' },
      }
    : {
        20: { name: 'Kompaktowa 20×20', players: '1–4 graczy', pacing: 'Szybki kontakt i ostra walka o surowce' },
        24: { name: 'Standardowa 24×24', players: '2–5 graczy', pacing: 'Zbalansowana ekonomia i sieci dróg' },
        32: { name: 'Duża 32×32', players: '4–8 graczy', pacing: 'Rozbudowana logistyka i autostrady płatne' },
        40: { name: 'Kontynentalna 40×40', players: '6–8 graczy', pacing: 'Długa ekspansja, porty i terminale lotnicze' },
      };
  const info = recs[mapSize] ?? (en
    ? { name: `Map ${mapSize}×${mapSize}`, players: '1–8 players', pacing: 'Custom operational territory' }
    : { name: `Mapa ${mapSize}×${mapSize}`, players: '1–8 graczy', pacing: 'Niestandardowy obszar operacyjny' });
  return {
    title: en
      ? `🗺️ ${info.name} (${tiles.toLocaleString('en-US')} tiles)`
      : `🗺️ ${info.name} (${tiles.toLocaleString('pl-PL')} pól)`,
    description: info.pacing,
    bullets: [
      en
        ? `Recommended entities: ${info.players}`
        : `Zalecana liczba podmiotów: ${info.players}`,
    ],
  };
}

export function getAiDifficultyTooltip(aiDifficulty: number): TooltipSpec {
  const en = getCurrentLanguage() === 'en';
  const details: Record<number, { title: string; desc: string }> = en
    ? {
        1: {
          title: '🤖 AI Bot: Easy',
          desc: 'Expands cautiously, rarely builds toll blockades or runs aggressive intelligence ops.',
        },
        2: {
          title: '🤖 AI Bot: Normal',
          desc: 'Methodically builds supply chains and core utilities without sudden hostile buyouts.',
        },
        3: {
          title: '🤖 AI Bot: Ambitious',
          desc: 'Probes deep deposits, pursues tech upgrades, and secures municipal utilities across its districts.',
        },
        4: {
          title: '🤖 AI Bot: Expert',
          desc: 'Optimizes district synergies, bids aggressively at bailiff auctions, and times market cycles.',
        },
        5: {
          title: '🤖 AI Bot: Market Shark',
          desc: 'Maximum strategic pressure: erects toll highways, scoops up rival shares, lobbies cabinets & builds nuclear power.',
        },
      }
    : {
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
  const lang = getCurrentLanguage();
  const raw = DIFFICULTY_PRESETS[presetId] ?? DIFFICULTY_PRESETS.standard;
  const p = localizeDifficultyPreset(raw, lang);
  const cashPct = Math.round((p.startingCashMult - 1) * 100);
  const taxPct = Math.round(p.taxMult * 100);
  const maintPct = Math.round(p.maintenanceMult * 100);
  const utilPct = Math.round(p.utilityPenaltyMult * 100);
  const intPct = (p.interestDelta * 100).toFixed(1);
  return lang === 'en'
    ? {
        title: `${p.badge} ${p.label}`,
        bullets: [
          `Starting cash: ${cashPct === 0 ? '100% (base)' : `${cashPct > 0 ? '+' : ''}${cashPct}%`}`,
          `Taxes: ${taxPct}% · Maintenance: ${maintPct}%`,
          `Utility penalties: ${utilPct}% · Interest: ${p.interestDelta >= 0 ? `+${intPct}` : intPct} pp`,
          `Bailiff after ${p.bailiffGraceTicks} deficit ticks`,
        ],
      }
    : {
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
  const lang = getCurrentLanguage();
  const raw = SCENARIO_DEFINITIONS.find((s) => s.id === scenarioId) ?? SCENARIO_DEFINITIONS[0];
  const sc = localizeScenario(raw, lang);
  return {
    title: `${sc.icon} ${sc.name}`,
    description: sc.description,
    bullets: [
      lang === 'en'
        ? `Recommended: ${sc.recommendedPlayers}`
        : `Rekomendacja: ${sc.recommendedPlayers}`,
    ],
  };
}

export function getDisastersTooltip(enabled: boolean): TooltipSpec {
  const en = getCurrentLanguage() === 'en';
  return enabled
    ? en
      ? {
          title: '🌪️ Natural Disasters: ENABLED',
          description:
            'Fires, robberies, HAZMAT spills, droughts, floods, and storms hit unprotected facilities.',
          bullets: [
            'Protection: Fire Stations, Hospitals, HAZMAT Bases, Police',
            'Insurance policy refunds 65% of damage costs',
          ],
        }
      : {
          title: '🌪️ Katastrofy Naturalne: WŁĄCZONE',
          description:
            'Występują pożary, napady, wycieki HAZMAT, susze, powodzie i burze niszczące niezabezpieczone zakłady.',
          bullets: [
            'Ochrona: Remizy, Szpitale, Bazy HAZMAT, Policja',
            'Polisa ubezpieczeniowa zwraca 65% wartości przy szkodzie',
          ],
        }
    : en
      ? {
          title: '🛡️ Natural Disasters: DISABLED',
          description:
            'Weather disasters and earthquakes are turned off. Standard safety and maintenance rules still apply.',
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
  const en = getCurrentLanguage() === 'en';
  return victoryMode === 'coalition'
    ? en
      ? {
          title: '🤝 Coalition Domination',
          description: `The coalition that reaches ${dominationThreshold}% market domination with shared infrastructure wins.`,
          bullets: [
            `Coalition domination threshold: ${dominationThreshold}%`,
            '0% road tolls between allies and shared alliance victory',
          ],
        }
      : {
          title: '🤝 Dominacja Koalicji',
          description: `Wygrywa koalicja, która osiągnie ${dominationThreshold}% dominacji rynkowej i zbuduje wspólne zaplecze kapitałowe.`,
          bullets: [
            `Próg dominacji koalicji: ${dominationThreshold}%`,
            '0% myta między sojusznikami i wspólne zwycięstwo sojuszu',
          ],
        }
    : en
      ? {
          title: '👑 Solo Domination',
          description: `The single player who independently reaches ${dominationThreshold}% market domination wins.`,
          bullets: [
            `Domination threshold: ${dominationThreshold}%`,
            'Alliances aid trade & security, yet only the leader wins',
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
  const lang = getCurrentLanguage();
  const arch = localizeArchetype(getArchetypeDefinition(archetypeId), lang);
  return {
    title: `${arch.icon} ${arch.name}`,
    description: arch.tagline,
    pros: arch.pros,
    cons: arch.cons,
  };
}
