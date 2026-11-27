import React, { useEffect, useState } from 'react';
import { RESOURCE_DEFINITIONS } from '../../data/resources';
import type { ResourcePrice } from '../../engine/types';
import {
  localizeResourceDescription,
  localizeResourceName,
  localizeResourceUnit,
} from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
import { formatMoney, formatPercent } from '../../utils/formatters';
import { CandlestickChart } from './MiniChart';

interface PriceChartModalProps {
  resource: ResourcePrice;
  onClose: () => void;
}

export const PriceChartModal: React.FC<PriceChartModalProps> = ({ resource, onClose }) => {
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const { lang, t } = useI18n();
  const def = RESOURCE_DEFINITIONS[resource.type];
  const resName = localizeResourceName(resource.type, resource.name, lang);
  const resUnit = localizeResourceUnit(resource.unit, lang);
  const resDesc = localizeResourceDescription(resource.type, def.description, lang);
  const isUp = resource.changePercent >= 0;
  const spreadFromBase = ((resource.price - resource.basePrice) / resource.basePrice) * 100;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#243044] flex items-center justify-between bg-[#0d131f]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{resource.emoji}</span>
            <div>
              <div className="font-semibold text-slate-100 text-sm md:text-base">
                {resName} ({resUnit})
              </div>
              <div className="text-xs text-slate-400">{resDesc}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
              <div className="text-[11px] text-slate-400">{t('chart.currentRate')}</div>
              <div className="font-mono text-base font-bold text-slate-100">
                {formatMoney(resource.price)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
              <div className="text-[11px] text-slate-400">{t('chart.change1T')}</div>
              <div className={`font-mono text-base font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPercent(resource.changePercent)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
              <div className="text-[11px] text-slate-400">{t('chart.vsBase')}</div>
              <div className={`font-mono text-base font-bold ${spreadFromBase >= 0 ? 'text-amber-400' : 'text-sky-400'}`}>
                {formatPercent(spreadFromBase)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044]">
              <div className="text-[11px] text-slate-400">{t('chart.supplyDemand')}</div>
              <div className="font-mono text-sm font-semibold text-slate-200">
                {resource.supply} / {resource.demand}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              {t('chart.historyHeader', { count: resource.history.length })}
            </span>
            <div className="flex gap-1 bg-[#0b0f17] p-0.5 rounded-lg border border-[#243044]">
              <button
                type="button"
                onClick={() => setChartType('candle')}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  chartType === 'candle' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('chart.ohlcMode')}
              </button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  chartType === 'line' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('chart.lineMode')}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044]">
            {chartType === 'candle' ? (
              <CandlestickChart candles={resource.candles} />
            ) : (
              <LineHistoryChart data={resource.history} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const LineHistoryChart: React.FC<{ data: number[] }> = ({ data }) => {
  const width = 520;
  const height = 200;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);
  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? '#10b981' : '#f43f5e';

  const pts = data
    .map((v, i) => {
      const x = padL + (i / Math.max(1, data.length - 1)) * plotW;
      const y = padT + plotH - ((v - min) / span) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + plotH * t;
        const val = Math.round(max - span * t);
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#1f2937" strokeDasharray="3 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
              {val}
            </text>
          </g>
        );
      })}
      <polyline fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" points={pts} />
    </svg>
  );
};
