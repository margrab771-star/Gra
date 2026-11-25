import React, { useState } from 'react';
import { GAME_CONFIG } from '../../config/gameConfig';
import type { ArticleType, GameState, NewsArticle } from '../../engine/types';

interface NewspaperPanelProps {
  gameState: GameState;
  onMarkRead: (id: string) => void;
  onFocusPlot?: (plotId: string) => void;
  onClose: () => void;
}

export const NewspaperPanel: React.FC<NewspaperPanelProps> = ({
  gameState,
  onMarkRead,
  onFocusPlot,
  onClose,
}) => {
  const [filter, setFilter] = useState<ArticleType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(gameState.news[0]?.id ?? null);

  const filtered = gameState.news.filter((n) => filter === 'all' || n.type === filter);
  const selected: NewsArticle | undefined =
    filtered.find((n) => n.id === selectedId) ?? filtered[0];

  const badgeClass = (t: ArticleType) => {
    switch (t) {
      case 'forecast':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'opportunity':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'negative':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'positive':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
    }
  };

  const labelPL = (t: ArticleType) => {
    switch (t) {
      case 'forecast':
        return 'PROGNOZA TRENDU';
      case 'opportunity':
        return 'OKAZJA RYNKOWA';
      case 'negative':
        return 'RYZYKO / KRYZYS';
      case 'positive':
        return 'IMPULS WZROSTOWY';
      default:
        return 'WIADOMOŚCI';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-amber-400 uppercase tracking-widest">
              {GAME_CONFIG.title} · Dziennik Ekonomiczny i Analiza Makro
            </div>
            <h2 className="text-lg font-bold text-slate-100">📰 Głos Kapitału & Prognozy Rynkowe</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Aktywne zjawiska i nadchodzące prognozy */}
        {(gameState.activeEvents.length > 0 || gameState.pendingForecasts.length > 0) && (
          <div className="px-4 py-2 bg-[#0e1420] border-b border-[#243044] flex flex-wrap gap-2 text-xs">
            {gameState.pendingForecasts.map((pf) => (
              <span
                key={pf.id}
                className="px-2 py-1 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300"
              >
                🔮 Nadchodzi: {pf.name} (za {pf.forecastTicksRemaining} cykli)
              </span>
            ))}
            {gameState.activeEvents.map((ev) => (
              <span
                key={ev.id}
                className="px-2 py-1 rounded bg-sky-500/15 border border-sky-500/35 text-sky-300"
              >
                ⚡ Aktywne: {ev.name} ({ev.remainingTicks} cykli)
              </span>
            ))}
          </div>
        )}

        {/* Filtry */}
        <div className="px-4 py-2 border-b border-[#243044] flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { k: 'all', l: 'Wszystkie' },
            { k: 'forecast', l: '🔮 Prognozy' },
            { k: 'opportunity', l: '💰 Okazje' },
            { k: 'negative', l: '⚠️ Kryzysy' },
            { k: 'positive', l: '📈 Wzrosty' },
          ].map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFilter(f.k as ArticleType | 'all')}
              className={`px-2.5 py-1 rounded text-xs font-medium shrink-0 ${
                filter === f.k
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50'
                  : 'bg-[#0b0f17] text-slate-400 hover:text-slate-200 border border-[#243044]'
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>

        {/* Lista + Treść */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-[#243044] overflow-y-auto p-3 space-y-2 max-h-52 md:max-h-none">
            {filtered.map((art) => (
              <button
                key={art.id}
                type="button"
                onClick={() => {
                  setSelectedId(art.id);
                  if (!art.read) onMarkRead(art.id);
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                  selected?.id === art.id
                    ? 'bg-[#1a2438] border-amber-400/60'
                    : 'bg-[#0b0f17] border-[#243044] hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeClass(art.type)}`}>
                    {labelPL(art.type)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {!art.read && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                    <span className="font-mono text-[10px] text-slate-500">{art.dateLabel}</span>
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-100 line-clamp-2">{art.headline}</div>
              </button>
            ))}
          </div>

          <div className="md:col-span-7 overflow-y-auto p-4 md:p-5 space-y-4">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass(selected.type)}`}>
                      {labelPL(selected.type)}
                    </span>
                    <span className="font-mono text-xs text-slate-400">{selected.dateLabel}</span>
                  </div>
                  {selected.focusPlotId && onFocusPlot && (
                    <button
                      type="button"
                      onClick={() => onFocusPlot(selected.focusPlotId!)}
                      className="px-2.5 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 border border-sky-400/50 text-sky-200 text-xs font-semibold"
                    >
                      📍 Pokaż miejsce zdarzenia na mapie
                    </button>
                  )}
                </div>
                <h3 className="text-lg md:text-xl font-bold text-slate-100 leading-snug">
                  {selected.headline}
                </h3>
                <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                  {selected.fullText}
                </p>

                <div className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-2">
                  <div className="text-xs font-semibold text-sky-400 uppercase tracking-wide">
                    Analiza Analityków Giełdowych
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{selected.analysis}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                  <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">
                    Rekomendowane Działania Wyprzedzające
                  </div>
                  <ul className="list-disc list-inside text-xs text-emerald-100 space-y-1">
                    {selected.hints.map((h, idx) => (
                      <li key={idx}>{h}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Wybierz wydanie z listy po lewej stronie.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
