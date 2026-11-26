import { DIFFICULTY_PRESETS, GOVERNMENT_CONFIGS } from '../config/gameConfig';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { EVENT_TEMPLATES } from '../data/events';
import { RESOURCE_DEFINITIONS } from '../data/resources';
import { formatGameDate } from '../utils/formatters';
import { recalculateSpatialNetwork } from './PlotSystem';
import type {
  GameEvent,
  GameState,
  GovernmentKind,
  GovernmentTender,
  NewsArticle,
  Player,
  Plot,
  ResourceType,
  VisualBlastEffect,
} from './types';

const PATENT_ELIGIBLE_TECHS: Record<string, { royaltyBase: number; label: string }> = {
  ind_mega_extraction: { royaltyBase: 4800, label: 'Patent: Głębinowa Ekstrakcja Złóż' },
  ind_recycling: { royaltyBase: 4200, label: 'Patent: Przemysłowy Odzysk Metali' },
  mod_semiconductors: { royaltyBase: 6400, label: 'Patent: Litografia Krzemowa EUV' },
  mod_ai_erp: { royaltyBase: 5800, label: 'Patent: Przemysłowe Sieci AI & Ogniwa' },
  mod_fusion: { royaltyBase: 9200, label: 'Patent: Reaktor Fuzyjny Tokamak' },
  mod_enrichment: { royaltyBase: 6800, label: 'Patent: Wirówki Izotopowe' },
  saf_hazmat: { royaltyBase: 3900, label: 'Patent: Neutralizacja Zagrożeń HAZMAT' },
  mil_cyber: { royaltyBase: 5400, label: 'Patent: Systemy Cyberobrony Kwantowej' },
};

export function processEventsTick(state: GameState): void {
  // 1. Odliczaj aktywne zdarzenia
  for (let i = state.activeEvents.length - 1; i >= 0; i--) {
    const ev = state.activeEvents[i];
    ev.remainingTicks -= 1;
    if (ev.remainingTicks <= 0) {
      state.activeEvents.splice(i, 1);
    }
  }

  // 1b. Odliczaj efekty zniszczeń, skażenia i fal uderzeniowych na mapie
  let radiationCleared = false;
  for (const p of state.plots) {
    if ((p.disasterDamagedTicks ?? 0) > 0) {
      p.disasterDamagedTicks = (p.disasterDamagedTicks ?? 0) - 1;
      if (p.disasterDamagedTicks <= 0 && p.building) {
        p.building.status.disasterStruck = false;
      }
    }
    if ((p.irradiatedTicks ?? 0) > 0) {
      p.irradiatedTicks = (p.irradiatedTicks ?? 0) - 1;
      if ((p.irradiatedTicks ?? 0) <= 0) {
        p.irradiatedTicks = 0;
        p.purchasable = p.ownerId === null && p.terrain !== 'water';
        radiationCleared = true;
      }
    }
  }
  if (radiationCleared) {
    state.networkRevision = (state.networkRevision ?? 0) + 1;
    recalculateSpatialNetwork(state.plots);
  }
  if (state.blastEffects && state.blastEffects.length > 0) {
    for (const fx of state.blastEffects) {
      fx.ticksRemaining -= 1;
    }
    state.blastEffects = state.blastEffects.filter((fx) => fx.ticksRemaining > 0);
  }

  // 2. Odliczaj zapowiedziane w Gazecie prognozy -> w momencie 0 aktywuj realny skutek!
  for (let i = state.pendingForecasts.length - 1; i >= 0; i--) {
    const pf = state.pendingForecasts[i];
    pf.forecastTicksRemaining = (pf.forecastTicksRemaining ?? 1) - 1;
    if ((pf.forecastTicksRemaining ?? 0) <= 0) {
      state.pendingForecasts.splice(i, 1);
      pf.isForecastPending = false;
      state.activeEvents.push(pf);

      const tmpl = EVENT_TEMPLATES.find((t) => t.id === pf.templateId);
      if (tmpl) {
        const focusPlotId = applyImmediateEventSideEffects(state, pf);
        const article: NewsArticle = {
          id: `news_${state.time.tick}_${pf.templateId}`,
          headline: tmpl.headline,
          brief: tmpl.body,
          fullText: tmpl.body,
          analysis: tmpl.analysis,
          hints: tmpl.hints,
          type:
            tmpl.category === 'opportunity'
              ? 'opportunity'
              : tmpl.category === 'weather' || tmpl.category === 'labor' || tmpl.category === 'disaster'
                ? 'negative'
                : 'neutral',
          dateLabel: formatGameDate(state.time),
          tick: state.time.tick,
          read: false,
          relatedResource: tmpl.relatedResource,
          focusPlotId,
        };
        state.news = [article, ...state.news].slice(0, 40);
      }
    }
  }

  // 3. Generuj nowe prognozy lub zdarzenia cyklicznie (co ~20 ticków, częściej w Extreme Climate / Szalonej Giełdzie)
  const evInterval = state.settings.mutators?.extremeClimate ? 14 : 20;
  if (state.time.tick > 4 && state.time.tick % evInterval === 0 && state.activeEvents.length + state.pendingForecasts.length < 3) {
    triggerNewEventOrForecast(state);
  }

  // 4. Wybory rządowe, Zielona Transformacja & Licytacje na Żywo
  processGovernmentElectionsTick(state);
  processGreenTransitionScenarioTick(state);
  processLiveAuctionTick(state);
}

export function triggerNewEventOrForecast(state: GameState): void {
  const activeIds = new Set([
    ...state.activeEvents.map((e) => e.templateId),
    ...state.pendingForecasts.map((e) => e.templateId),
  ]);
  const disastersOn = Boolean(state.settings.disastersEnabled);
  const extremeClimate = Boolean(state.settings.mutators?.extremeClimate);
  const recentDisaster = state.activeEvents.some((e) => e.category === 'disaster') ||
    state.pendingForecasts.some((e) => e.category === 'disaster');

  // Katastrofy wyłączone -> zero katastrof; Ekstremalny Klimat podwaja częstość po okresie rozruchu
  const disasterChance = extremeClimate ? 0.56 : 0.28;
  const minDisasterTick = extremeClimate ? 36 : 20;
  const allowDisasterRoll = disastersOn && (!recentDisaster || extremeClimate) && state.time.tick >= minDisasterTick && Math.random() < disasterChance;
  const pool = EVENT_TEMPLATES.filter((t) => {
    if (activeIds.has(t.id)) return false;
    if (t.category === 'disaster' && !allowDisasterRoll) return false;
    return true;
  });
  if (pool.length === 0) return;

  const tmpl = pool[Math.floor(Math.random() * pool.length)];
  const ev: GameEvent = {
    id: `ev_${state.time.tick}_${tmpl.id}`,
    templateId: tmpl.id,
    name: tmpl.name,
    description: tmpl.body,
    category: tmpl.category,
    effects: tmpl.effects,
    durationTicks: tmpl.durationTicks,
    remainingTicks: tmpl.durationTicks,
    isForecastPending: tmpl.forecastLeadTicks > 0,
    forecastTicksRemaining: tmpl.forecastLeadTicks,
    mitigationHint: tmpl.mitigationHint,
  };

  if (tmpl.forecastLeadTicks > 0 && tmpl.forecastHeadline) {
    state.pendingForecasts.push(ev);
    const forecastArticle: NewsArticle = {
      id: `forecast_${state.time.tick}_${tmpl.id}`,
      headline: `[PROGNOZA] ${tmpl.forecastHeadline}`,
      brief: tmpl.forecastBody ?? tmpl.body,
      fullText: `${tmpl.forecastBody ?? tmpl.body}\n\nOkno wyprzedzenia: ~${tmpl.forecastLeadTicks} cykli rynkowych przed wejściem zjawiska w życie.`,
      analysis: tmpl.analysis,
      hints: tmpl.hints,
      type: 'forecast',
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
      relatedResource: tmpl.relatedResource,
    };
    state.news = [forecastArticle, ...state.news].slice(0, 40);
  } else {
    state.activeEvents.push(ev);
    const focusPlotId = applyImmediateEventSideEffects(state, ev);
    const article: NewsArticle = {
      id: `news_${state.time.tick}_${tmpl.id}`,
      headline: tmpl.headline,
      brief: tmpl.body,
      fullText: tmpl.body,
      analysis: tmpl.analysis,
      hints: tmpl.hints,
      type: tmpl.category === 'opportunity' ? 'opportunity' : tmpl.category === 'disaster' ? 'negative' : 'positive',
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
      relatedResource: tmpl.relatedResource,
      focusPlotId,
    };
    state.news = [article, ...state.news].slice(0, 40);
  }
}

function applyImmediateEventSideEffects(state: GameState, ev: GameEvent): string | undefined {
  let focusPlotId: string | undefined;

  for (const eff of ev.effects) {
    if (eff.kind === 'voterMoodDelta') {
      state.voterMood = Math.max(-100, Math.min(100, state.voterMood + eff.value));
    }
    if (eff.kind === 'disasterDamage' && state.plots.length > 0) {
      const size = Math.max(8, state.settings.mapSize || Math.round(Math.sqrt(state.plots.length)));
      let targets: Plot[] = [];
      let blastKind: VisualBlastEffect['kind'] = 'earthquake';
      let centerX = Math.floor(size / 2);
      let centerY = Math.floor(size / 2);

      if (ev.templateId === 'disaster_flood') {
        blastKind = 'flood';
        targets = state.plots.filter((p) => (p.terrain === 'coastal' || p.terrain === 'grass') && p.building && !p.building.destroyedRuins);
        const anchor = targets[Math.floor(Math.random() * Math.max(1, targets.length))] ?? state.plots.find((p) => p.terrain === 'coastal');
        if (anchor) {
          centerX = anchor.gridX;
          centerY = anchor.gridY;
          targets = state.plots.filter((p) => Math.hypot(p.gridX - centerX, p.gridY - centerY) <= 4 && p.building && !p.building.destroyedRuins);
        }
      } else if (ev.templateId === 'disaster_tornado') {
        blastKind = 'tornado';
        const bPlots = state.plots.filter((p) => p.building && !p.building.destroyedRuins && p.terrain !== 'mountain');
        const anchor = bPlots[Math.floor(Math.random() * Math.max(1, bPlots.length))] ?? state.plots[Math.floor(state.plots.length / 2)];
        centerX = anchor.gridX;
        centerY = anchor.gridY;
        targets = state.plots.filter((p) => Math.abs(p.gridX - centerX) <= 2 && Math.abs(p.gridY - centerY) <= 1 && p.building && !p.building.destroyedRuins);
      } else {
        blastKind = 'earthquake';
        const bPlots = state.plots.filter((p) => p.building && !p.building.destroyedRuins);
        const anchor = bPlots[Math.floor(Math.random() * Math.max(1, bPlots.length))] ?? state.plots[Math.floor(state.plots.length / 2)];
        centerX = anchor.gridX;
        centerY = anchor.gridY;
        targets = state.plots.filter((p) => Math.hypot(p.gridX - centerX, p.gridY - centerY) <= 3.5 && p.building && !p.building.destroyedRuins);
      }

      if (targets.length > 0) focusPlotId = targets[0].id;
      const climatePowerMult = state.settings.mutators?.extremeClimate ? 1.45 : 1.0;
      for (const p of targets) {
        if (!p.building) continue;
        p.disasterDamagedTicks = ev.durationTicks;
        p.building.status.disasterStruck = true;
        p.building.damagePercent = Math.min(100, Number((p.building.damagePercent + eff.value * climatePowerMult).toFixed(1)));
        p.building.condition = Math.max(0, Number((100 - p.building.damagePercent).toFixed(1)));
        if (p.building.damagePercent >= 100) {
          p.building.destroyedRuins = true;
          p.building.isActive = false;
          p.building.workers = 0;
          p.building.efficiency = 0;
          p.building.revenue = 0;
          state.networkRevision = (state.networkRevision ?? 0) + 1;
        }
      }

      state.blastEffects = state.blastEffects ?? [];
      state.blastEffects.push({
        id: `fx_${state.time.tick}_${ev.id}`,
        kind: blastKind,
        centerX,
        centerY,
        radius: ev.templateId === 'disaster_tornado' ? 2 : 3.5,
        createdTick: state.time.tick,
        ticksRemaining: 8,
      });
    }
  }

  return focusPlotId;
}

export function computeDynamicTaxAndZUS(state: GameState): { effectiveTaxRate: number; effectiveZusMult: number } {
  let taxDelta = 0;
  let zusDelta = 0;
  for (const ev of state.activeEvents) {
    for (const eff of ev.effects) {
      if (eff.kind === 'taxDelta') taxDelta += eff.value;
      if (eff.kind === 'zusDelta') zusDelta += eff.value;
    }
  }
  const preset = DIFFICULTY_PRESETS[state.settings.difficultyPreset ?? 'standard'] ?? DIFFICULTY_PRESETS.standard;
  const govCfg = state.government ? GOVERNMENT_CONFIGS[state.government.currentGov] : undefined;
  const govTax = govCfg?.taxDelta ?? 0;
  const govZus = govCfg ? govCfg.zusMult - 1 : 0;
  const lawTaxCut = state.activeLaws.includes('corporate_deregulation') ? -0.02 : 0;
  return {
    effectiveTaxRate: Math.max(0.06, Math.min(0.42, state.taxRate * preset.taxMult + taxDelta + govTax + lawTaxCut)),
    effectiveZusMult: Math.max(0.7, Math.min(1.75, 1.0 + zusDelta + govZus)),
  };
}

// ─── Patenty Technologiczne i Przetargi Rządowe (v4.5) ────────────────────────

export function processPatentsAndTendersTick(state: GameState): void {
  state.patents = state.patents ?? [];
  state.tenders = state.tenders ?? [];

  // 1. Przyznaj patenty pierwszym odkrywcom kluczowych technologii + wypłać tantiemy
  for (const [techId, spec] of Object.entries(PATENT_ELIGIBLE_TECHS)) {
    const existing = state.patents.find((pt) => pt.techId === techId);
    if (!existing) {
      const winner = state.players.find((p) => !p.isEliminated && p.globalTech[techId]?.status === 'done');
      if (winner) {
        const royalty = spec.royaltyBase;
        state.patents.push({
          techId,
          techName: spec.label,
          ownerId: winner.id,
          ownerName: winner.companyName,
          royaltyPerTick: royalty,
          grantedTick: state.time.tick,
          expiresTick: state.time.tick + 140,
          totalRoyaltiesEarned: 0,
        });
        state.news = [
          {
            id: `pat_${state.time.tick}_${techId}`,
            headline: `🏅 Przyznano wyłączny ${spec.label} (${winner.companyName})`,
            brief: `Koncern jako pierwszy ukończył przełomowe badania i będzie pobierać ${royalty.toLocaleString('pl-PL')} zł/T tantiem patentowych przez 140 cykli!`,
            fullText: `${winner.companyName} uzyskał ochronę patentową w Urzędzie Patentowym dla ${spec.label}. Konkurenci korzystający z podobnych technologii zasilają fundusz patentowy wynalazcy.`,
            analysis: 'Pierwszeństwo w badaniach R&D daje długofalową rentę patentową.',
            hints: ['Sprawdź aktywne patenty w panelu Technologie oraz Finanse.'],
            type: 'opportunity' as const,
            dateLabel: formatGameDate(state.time),
            tick: state.time.tick,
            read: false,
          },
          ...state.news,
        ].slice(0, 40);
      }
    } else if (existing.expiresTick >= state.time.tick) {
      const owner = state.players.find((p) => p.id === existing.ownerId && !p.isEliminated);
      if (owner) {
        const rivalsUsingTech = Math.max(
          1,
          state.players.filter((p) => p.id !== owner.id && !p.isEliminated && p.globalTech[techId]?.status === 'done').length + 1
        );
        const payout = existing.royaltyPerTick * (0.7 + rivalsUsingTech * 0.35);
        owner.cash += payout;
        owner.totalRevenueEarned += payout;
        owner.lastTickRevenueByCategory['Tantiemy Patentowe i Przetargi'] =
          (owner.lastTickRevenueByCategory['Tantiemy Patentowe i Przetargi'] ?? 0) + payout;
        existing.totalRoyaltiesEarned += Math.round(payout);
      }
    }
  }

  // 2. Generuj i rozliczaj Przetargi Rządowe (co ~26 cykli)
  for (const t of state.tenders) {
    if (t.status !== 'open') continue;
    if (t.kind === 'clean_energy') {
      // Rozstrzygnij przetarg OZE na deadlineTick
      if (state.time.tick >= t.deadlineTick) {
        let bestPlayer: Player | undefined;
        let bestMW = 0;
        for (const p of state.players) {
          if (p.isEliminated) continue;
          const cleanMW = state.plots
            .filter(
              (pl) =>
                pl.ownerId === p.id &&
                pl.building?.isActive &&
                !pl.building.destroyedRuins &&
                (pl.building.type === 'solarFarm' ||
                  pl.building.type === 'windFarm' ||
                  pl.building.type === 'hydroPowerPlant' ||
                  pl.building.type === 'geothermalPlant' ||
                  pl.building.type === 'fusionReactor')
            )
            .reduce((s, pl) => s + Math.abs(BUILDING_DEFINITIONS[pl.building!.type].electricityUsage), 0);
          if (cleanMW >= (t.requiredCleanMW ?? 80) && cleanMW > bestMW) {
            bestMW = cleanMW;
            bestPlayer = p;
          }
        }
        if (bestPlayer) {
          awardTenderToPlayer(state, t, bestPlayer);
        } else {
          t.status = 'expired';
        }
      }
    } else if (state.time.tick > t.deadlineTick) {
      t.status = 'expired';
    }
  }

  const openTenders = state.tenders.filter((t) => t.status === 'open');
  if (state.time.tick >= 10 && state.time.tick % 24 === 10 && openTenders.length < 2) {
    const newTender = buildRandomGovernmentTender(state);
    state.tenders.unshift(newTender);
    if (state.tenders.length > 10) state.tenders.pop();
    state.news = [
      {
        id: `tnd_news_${newTender.id}`,
        headline: `📜 Nowy Przetarg Rządowy: ${newTender.title}`,
        brief: `${newTender.description} Nagroda: ${newTender.cashReward.toLocaleString('pl-PL')} zł + ${newTender.influenceReward} pkt wpływów.`,
        fullText: `${newTender.description} Zgłoś dostawę z magazynu w zakładce Giełda B2B → Przetargi Rządowe przed cyklem ${newTender.deadlineTick}.`,
        analysis: 'Kontrakty publiczne błyskawicznie poprawiają relacje z rządem i wizerunek wśród wyborców.',
        hints: ['Otwórz panel Kontrakty B2B → Przetargi, aby dostarczyć surowce z magazynu.'],
        type: 'opportunity' as const,
        dateLabel: formatGameDate(state.time),
        tick: state.time.tick,
        read: false,
      },
      ...state.news,
    ].slice(0, 40);
  }
}

function buildRandomGovernmentTender(state: GameState): GovernmentTender {
  const specs: Array<{
    title: string;
    description: string;
    kind: 'resource_delivery' | 'clean_energy';
    requirements: Partial<Record<ResourceType, number>>;
    requiredCleanMW?: number;
    cashReward: number;
    influenceReward: number;
    voterMoodReward: number;
  }> = [
    {
      title: 'Krajowa Rezerwa Paliwowo-Stalowa',
      description: 'Dostawa strategiczna 35 t Stali oraz 28 m³ Paliwa dla rezerw państwowych.',
      kind: 'resource_delivery',
      requirements: { steel: 35, fuel: 28 },
      cashReward: 480_000,
      influenceReward: 18,
      voterMoodReward: 6,
    },
    {
      title: 'Program Elektryfikacji Transportu Publicznego',
      description: 'Dostawa 18 szt. Baterii Litowych oraz 25 szt. Elektroniki Przemysłowej.',
      kind: 'resource_delivery',
      requirements: { batteries: 18, electronics: 25 },
      cashReward: 690_000,
      influenceReward: 22,
      voterMoodReward: 8,
    },
    {
      title: 'Krajowy Program Prefabrykacji i Wodociągów',
      description: 'Zabezpieczenie dostawy 45 szt. Prefabrykatów oraz 30 t Kruszywa do projektów państwowych.',
      kind: 'resource_delivery',
      requirements: { prefabs: 45, gravel: 30 },
      cashReward: 420_000,
      influenceReward: 14,
      voterMoodReward: 10,
    },
    {
      title: 'Czysta Sieć Zielonej Energii OZE',
      description: 'Posiadaj największą aktywną moc z odnawialnych/czystych źródeł (min. 90 MW) na dzień zamknięcia przetargu.',
      kind: 'clean_energy',
      requirements: {},
      requiredCleanMW: 90,
      cashReward: 560_000,
      influenceReward: 24,
      voterMoodReward: 12,
    },
  ];

  const chosen = specs[Math.floor(Math.random() * specs.length)];
  const tenderMult = state.government ? GOVERNMENT_CONFIGS[state.government.currentGov].tenderBonusMult : 1;
  return {
    id: `tnd_${state.time.tick}_${Math.random().toString(36).slice(2, 6)}`,
    title: chosen.title,
    description: chosen.description,
    kind: chosen.kind,
    requirements: chosen.requirements,
    requiredCleanMW: chosen.requiredCleanMW,
    deliveredByPlayer: {},
    cashReward: Math.round(chosen.cashReward * tenderMult),
    influenceReward: chosen.influenceReward,
    voterMoodReward: chosen.voterMoodReward,
    deadlineTick: state.time.tick + 34,
    status: 'open',
  };
}

function awardTenderToPlayer(state: GameState, tender: GovernmentTender, winner: Player): void {
  tender.status = 'awarded';
  tender.winnerId = winner.id;
  tender.winnerName = winner.companyName;
  winner.cash += tender.cashReward;
  winner.totalRevenueEarned += tender.cashReward;
  winner.lastTickRevenueByCategory['Tantiemy Patentowe i Przetargi'] =
    (winner.lastTickRevenueByCategory['Tantiemy Patentowe i Przetargi'] ?? 0) + tender.cashReward;
  winner.influence.financial += Math.round(tender.influenceReward * 0.5);
  winner.influence.social += Math.round(tender.influenceReward * 0.5);
  winner.influence.voterApproval = Math.min(100, winner.influence.voterApproval + tender.voterMoodReward);
  state.voterMood = Math.min(100, state.voterMood + tender.voterMoodReward);

  state.news = [
    {
      id: `tnd_win_${tender.id}`,
      headline: `🏆 ${winner.companyName} wygrywa przetarg "${tender.title}"`,
      brief: `Spółka zrealizowała zamówienie publiczne, inkasując ${tender.cashReward.toLocaleString('pl-PL')} zł oraz +${tender.influenceReward} pkt wpływów.`,
      fullText: `Komisja przetargowa przyznała kontrakt koncernowi ${winner.companyName}.`,
      analysis: 'Wygrane przetargi wzmacniają mandat społeczny pod inwestycje strategiczne.',
      hints: ['Śledź kolejne zamówienia rządowe w zakładce Przetargi.'],
      type: 'positive' as const,
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
    },
    ...state.news,
  ].slice(0, 40);
}

export function submitTenderDelivery(
  state: GameState,
  player: Player,
  tenderId: string
): { ok: boolean; error?: string; completed?: boolean } {
  const t = (state.tenders ?? []).find((tn) => tn.id === tenderId);
  if (!t || t.status !== 'open') {
    return { ok: false, error: 'Ten przetarg nie jest już aktywny.' };
  }
  if (t.kind === 'clean_energy') {
    return { ok: false, error: 'Przetarg OZE rozstrzyga się automatycznie według mocy MW w terminie zamknięcia.' };
  }

  const playerProg = t.deliveredByPlayer[player.id] ?? {};
  let deliveredAnything = false;

  for (const [rKey, neededRaw] of Object.entries(t.requirements)) {
    const res = rKey as ResourceType;
    const needed = neededRaw ?? 0;
    const already = playerProg[res] ?? 0;
    const remaining = Math.max(0, needed - already);
    if (remaining <= 0) continue;

    const stock = player.warehouseStockpile[res] ?? 0;
    const transfer = Math.min(stock, remaining);
    if (transfer > 0) {
      player.warehouseStockpile[res] = Number((stock - transfer).toFixed(2));
      playerProg[res] = Number((already + transfer).toFixed(2));
      deliveredAnything = true;
    }
  }

  t.deliveredByPlayer[player.id] = playerProg;
  if (!deliveredAnything) {
    const missingSummary = Object.entries(t.requirements)
      .map(([r, req]) => `${RESOURCE_DEFINITIONS[r as ResourceType]?.name ?? r}: ${(playerProg[r as ResourceType] ?? 0).toFixed(0)}/${req}`)
      .join(', ');
    return { ok: false, error: `Brak potrzebnych zapasów w magazynie głównym (${missingSummary}).` };
  }

  const allMet = Object.entries(t.requirements).every(
    ([r, req]) => (playerProg[r as ResourceType] ?? 0) >= (req ?? 0) - 0.01
  );
  if (allMet) {
    awardTenderToPlayer(state, t, player);
    return { ok: true, completed: true };
  }

  return { ok: true, completed: false };
}

// ─── Wybory Rządowe, Specjalne Strefy Ekonomiczne (SSE) i Aukcje na Żywo ────

export function processGovernmentElectionsTick(state: GameState): void {
  if (!state.government) {
    state.government = {
      currentGov: 'free_market',
      nextElectionTick: 72,
      lastElectionTick: 0,
      lobbyVotes: { free_market: 2, ecological: 1, interventionist: 2 },
    };
  }
  if (state.time.tick < state.government.nextElectionTick) return;

  const votes: Record<GovernmentKind, number> = {
    free_market: state.government.lobbyVotes.free_market + Math.random() * 2.5,
    ecological:
      state.government.lobbyVotes.ecological +
      (state.settings.scenarioId === 'green_transition' ? 3.5 : 0) +
      Math.random() * 2.5,
    interventionist:
      state.government.lobbyVotes.interventionist +
      (state.voterMood < 0 ? 1.8 : 0.4) +
      Math.random() * 2.5,
  };

  const ordered = (Object.entries(votes) as [GovernmentKind, number][]).sort((a, b) => b[1] - a[1]);
  const winner = ordered[0][0];
  const cfg = GOVERNMENT_CONFIGS[winner];

  state.government = {
    currentGov: winner,
    lastElectionTick: state.time.tick,
    nextElectionTick: state.time.tick + 72,
    lobbyVotes: { free_market: 1, ecological: 1, interventionist: 1 },
    lastWinnerSummary: `${cfg.badge} ${cfg.name}`,
  };

  state.news = [
    {
      id: `gov_elec_${state.time.tick}`,
      headline: `🗳️ Wyniki Wyborów Parlamentarnych: Władzę obejmuje ${cfg.name}`,
      brief: cfg.summary,
      fullText: `Wybory zakończone! Nowy gabinet (${cfg.name}) zmienia warunki podatkowe, dotacje oraz klimat pracowniczy na najbliższe lata.`,
      analysis: 'Kolejne wybory odbędą się za ~2.4 roku gry. Możesz wpływać na wynik w panelu Wpływy.',
      hints: ['Dostosuj miks energetyczny i politykę kadrową do programu rządu.'],
      type: 'neutral' as const,
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
    },
    ...state.news,
  ].slice(0, 40);
}

export function lobbyGovernmentElection(
  state: GameState,
  player: Player,
  govKind: GovernmentKind,
  useInfluence: boolean
): { ok: boolean; message: string } {
  if (!state.government) {
    state.government = {
      currentGov: 'free_market',
      nextElectionTick: state.time.tick + 72,
      lastElectionTick: 0,
      lobbyVotes: { free_market: 1, ecological: 1, interventionist: 1 },
    };
  }
  const cashCost = 220_000;
  const infCost = 18;
  if (useInfluence) {
    const totalInf = player.influence.financial + player.influence.social;
    if (totalInf < infCost) {
      return { ok: false, message: `Lobbing polityczny wymaga min. ${infCost} pkt wpływów.` };
    }
    player.influence.financial = Math.max(0, player.influence.financial - Math.ceil(infCost * 0.5));
    player.influence.social = Math.max(0, player.influence.social - Math.floor(infCost * 0.5));
  } else {
    if (player.cash < cashCost) {
      return { ok: false, message: `Kampania lobbingowa wymaga ${cashCost.toLocaleString('pl-PL')} zł.` };
    }
    player.cash -= cashCost;
  }

  state.government.lobbyVotes[govKind] = (state.government.lobbyVotes[govKind] ?? 0) + 3;
  const cfg = GOVERNMENT_CONFIGS[govKind];
  return {
    ok: true,
    message: `Zasilono kampanię ugrupowania ${cfg.name} (+3 głosy poparcia do najbliższych wyborów)!`,
  };
}

export function processGreenTransitionScenarioTick(state: GameState): void {
  if (state.settings.scenarioId !== 'green_transition') return;
  if (!state.greenTransitionEntered && state.time.tick >= 65) {
    state.greenTransitionEntered = true;
    state.carbonTaxActive = true;
    if (state.government) {
      state.government.currentGov = 'ecological';
    }
    state.news = [
      {
        id: `scn_green_${state.time.tick}`,
        headline: '🌿 SCENARIUSZ: Pakiet Zielonej Transformacji wszedł w życie!',
        brief: 'Wprowadzono surowy podatek CO₂ na energetykę węglową i zakaz nowych spalarni odpadów. Wygrywają OZE, recykling, lit, baterie i fuzja!',
        fullText: 'Od tej tury zakłady węglowe i spalarnie ponoszą ogromne opłaty emisyjne, a Rząd Ekologiczny wspiera zielone inwestycje.',
        analysis: 'Przestaw gospodarkę na farmy wiatrowe/słoneczne, fuzję oraz zakłady recyklingu.',
        hints: ['Wyłącz lub wyburz stare kotły węglowe zanim kary CO₂ pochłoną gotówkę.'],
        type: 'negative' as const,
        dateLabel: formatGameDate(state.time),
        tick: state.time.tick,
        read: false,
      },
      ...state.news,
    ].slice(0, 40);
  }
}

export function processLiveAuctionTick(state: GameState): void {
  // Scenariusz Upadek Giganta: okresowo wyprzedaje porzucone/upadające aktywa centralne na aukcji na żywo
  if (
    state.settings.scenarioId === 'fallen_giant' &&
    !state.liveAuction &&
    state.time.tick >= 12 &&
    state.time.tick % 32 === 12
  ) {
    const giantAsset = state.plots.find(
      (p) => p.ownerId === null && p.building?.ownerId === 'fallen_giant_pool'
    );
    if (giantAsset && giantAsset.building) {
      const startBid = Math.max(85_000, Math.round((giantAsset.price + 180_000) * 0.55));
      const now = Date.now();
      state.liveAuction = {
        id: `fg_auc_${state.time.tick}_${giantAsset.id}`,
        plotId: giantAsset.id,
        gridX: giantAsset.gridX,
        gridY: giantAsset.gridY,
        title: `Upadek Giganta · Licytacja: ${giantAsset.building.name}`,
        description: `Komornik wystawia gotowy majątek po dawnym monopolu w centrum (${giantAsset.gridX}, ${giantAsset.gridY})!`,
        startingBid: startBid,
        currentBid: startBid,
        highestBidderId: null,
        highestBidderName: null,
        minIncrement: 25_000,
        secondsRemaining: 30,
        startedAtMs: now,
        expiresAtMs: now + 30_000,
        bidsCount: 0,
        sellerPlayerId: null,
        status: 'active',
      };
    }
  }

  const auc = state.liveAuction;
  if (!auc || auc.status !== 'active') return;

  const wallRemaining = Math.ceil((auc.expiresAtMs - Date.now()) / 1000);
  auc.secondsRemaining = Math.max(0, Math.min(auc.secondsRemaining - 3, wallRemaining));

  // Proste przebijanie przez AI, jeśli cena atrakcyjna
  if (auc.secondsRemaining > 4 && Math.random() < 0.38) {
    const aiBidders = state.players.filter(
      (p) =>
        p.isAI &&
        !p.isEliminated &&
        p.id !== auc.highestBidderId &&
        p.cash > auc.currentBid + auc.minIncrement * 2 &&
        auc.currentBid < auc.startingBid * 1.65
    );
    if (aiBidders.length > 0) {
      const bidder = aiBidders[Math.floor(Math.random() * aiBidders.length)];
      auc.currentBid += auc.minIncrement;
      auc.highestBidderId = bidder.id;
      auc.highestBidderName = bidder.companyName;
      auc.bidsCount += 1;
      auc.expiresAtMs = Math.max(auc.expiresAtMs, Date.now() + 6_000);
      auc.secondsRemaining = Math.max(auc.secondsRemaining, 6);
    }
  }

  if (auc.secondsRemaining <= 0) {
    const plot = state.plots.find((p) => p.id === auc.plotId);
    const winner = auc.highestBidderId
      ? state.players.find((p) => p.id === auc.highestBidderId && !p.isEliminated)
      : undefined;

    if (plot) {
      if (winner && winner.cash >= auc.currentBid) {
        winner.cash -= auc.currentBid;
        if (winner.statsAccum) {
          winner.statsAccum.auctionsWon = (winner.statsAccum.auctionsWon ?? 0) + 1;
        }
        plot.ownerId = winner.id;
        plot.purchasable = false;
        if (plot.building) {
          plot.building.ownerId = winner.id;
          plot.building.damagePercent = Math.min(plot.building.damagePercent, 25);
          plot.building.condition = 100 - plot.building.damagePercent;
        }
        state.news = [
          {
            id: `auc_win_${auc.id}`,
            headline: `🔨 Licytacja Zakończona: ${winner.companyName} przejmuje (${plot.gridX}, ${plot.gridY})!`,
            brief: `Wygrana aukcja na żywo za ${auc.currentBid.toLocaleString('pl-PL')} zł (${auc.bidsCount} ofert).`,
            fullText: `Obiekt przeszedł na własność ${winner.companyName}.`,
            analysis: 'Przejmowanie gotowych zakładów na licytacjach pozwala błyskawicznie zdobyć przewagę.',
            hints: [],
            type: 'positive' as const,
            dateLabel: formatGameDate(state.time),
            tick: state.time.tick,
            read: false,
            focusPlotId: plot.id,
          },
          ...state.news,
        ].slice(0, 40);
      } else {
        plot.ownerId = null;
        plot.building = null;
        plot.purchasable = plot.terrain !== 'water' && (plot.irradiatedTicks ?? 0) <= 0;
      }
      state.networkRevision = (state.networkRevision ?? 0) + 1;
      recalculateSpatialNetwork(state.plots);
    }
    state.liveAuction = null;
  }
}

export function placeLiveAuctionBid(
  state: GameState,
  player: Player,
  auctionId: string,
  bidAmount: number
): { ok: boolean; message: string } {
  const auc = state.liveAuction;
  if (!auc || auc.id !== auctionId || auc.status !== 'active') {
    return { ok: false, message: 'Licytacja wygasła lub nie jest już aktywna.' };
  }
  if (auc.highestBidderId === player.id) {
    return { ok: false, message: 'Twoja oferta jest obecnie najwyższa!' };
  }
  const minRequired = auc.bidsCount === 0 ? auc.startingBid : auc.currentBid + auc.minIncrement;
  const cleanBid = Math.round(Math.max(bidAmount, minRequired));
  if (cleanBid < minRequired) {
    return {
      ok: false,
      message: `Minimalne przebicie wynosi ${minRequired.toLocaleString('pl-PL')} zł.`,
    };
  }
  if (player.cash < cleanBid) {
    return { ok: false, message: `Brak środków w gotówce (${cleanBid.toLocaleString('pl-PL')} zł).` };
  }

  auc.currentBid = cleanBid;
  auc.highestBidderId = player.id;
  auc.highestBidderName = player.companyName;
  auc.bidsCount += 1;
  // Anty-sniping: dorzuć do min. 8 sekund po każdym przebiciu
  auc.expiresAtMs = Math.max(auc.expiresAtMs, Date.now() + 8_000);
  auc.secondsRemaining = Math.max(auc.secondsRemaining, 8);
  return {
    ok: true,
    message: `Prowadzisz w licytacji ofertą ${cleanBid.toLocaleString('pl-PL')} zł!`,
  };
}
