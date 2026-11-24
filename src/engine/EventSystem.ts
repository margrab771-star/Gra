import { EVENT_TEMPLATES } from '../data/events';
import { formatGameDate } from '../utils/formatters';
import type { GameEvent, GameState, NewsArticle } from './types';

export function processEventsTick(state: GameState): void {
  // 1. Odliczaj aktywne zdarzenia
  for (let i = state.activeEvents.length - 1; i >= 0; i--) {
    const ev = state.activeEvents[i];
    ev.remainingTicks -= 1;
    if (ev.remainingTicks <= 0) {
      state.activeEvents.splice(i, 1);
    }
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
        applyImmediateEventSideEffects(state, pf);
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
              : tmpl.category === 'weather' || tmpl.category === 'labor'
                ? 'negative'
                : 'neutral',
          dateLabel: formatGameDate(state.time),
          tick: state.time.tick,
          read: false,
          relatedResource: tmpl.relatedResource,
        };
        state.news = [article, ...state.news].slice(0, 40);
      }
    }
  }

  // 3. Generuj nowe prognozy lub zdarzenia cyklicznie (co ~18-24 ticki)
  if (state.time.tick > 4 && state.time.tick % 20 === 0 && state.activeEvents.length + state.pendingForecasts.length < 3) {
    triggerNewEventOrForecast(state);
  }
}

export function triggerNewEventOrForecast(state: GameState): void {
  const activeIds = new Set([
    ...state.activeEvents.map((e) => e.templateId),
    ...state.pendingForecasts.map((e) => e.templateId),
  ]);
  const pool = EVENT_TEMPLATES.filter((t) => !activeIds.has(t.id));
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
    applyImmediateEventSideEffects(state, ev);
    const article: NewsArticle = {
      id: `news_${state.time.tick}_${tmpl.id}`,
      headline: tmpl.headline,
      brief: tmpl.body,
      fullText: tmpl.body,
      analysis: tmpl.analysis,
      hints: tmpl.hints,
      type: tmpl.category === 'opportunity' ? 'opportunity' : 'positive',
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
      relatedResource: tmpl.relatedResource,
    };
    state.news = [article, ...state.news].slice(0, 40);
  }
}

function applyImmediateEventSideEffects(state: GameState, ev: GameEvent): void {
  for (const eff of ev.effects) {
    if (eff.kind === 'voterMoodDelta') {
      state.voterMood = Math.max(-100, Math.min(100, state.voterMood + eff.value));
    }
  }
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
  const lawTaxCut = state.activeLaws.includes('corporate_deregulation') ? -0.02 : 0;
  return {
    effectiveTaxRate: Math.max(0.08, Math.min(0.35, state.taxRate + taxDelta + lawTaxCut)),
    effectiveZusMult: Math.max(0.75, Math.min(1.65, 1.0 + zusDelta)),
  };
}
