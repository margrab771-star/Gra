import React from 'react';
import type { PriceCandle } from '../../engine/types';

interface MiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export const MiniChart: React.FC<MiniChartProps> = ({
  data,
  width = 56,
  height = 18,
  positive,
}) => {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const isUp = positive ?? data[data.length - 1] >= data[0];
  const color = isUp ? '#10b981' : '#f43f5e';

  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 2 - ((v - min) / range) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
};

interface CandlestickChartProps {
  candles: PriceCandle[];
  width?: number;
  height?: number;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  width = 520,
  height = 200,
}) => {
  if (!candles || candles.length === 0) return null;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const minVal = Math.min(...candles.map((c) => c.low));
  const maxVal = Math.max(...candles.map((c) => c.high));
  const span = Math.max(1, maxVal - minVal);

  const toY = (val: number) => padT + plotH - ((val - minVal) / span) * plotH;
  const stepX = plotW / Math.max(1, candles.length);
  const bodyW = Math.max(4, Math.min(12, stepX * 0.62));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padT + plotH * t;
        const val = Math.round(maxVal - span * t);
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#1f2937" strokeDasharray="3 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
              {val}
            </text>
          </g>
        );
      })}

      {candles.map((c, idx) => {
        const cx = padL + idx * stepX + stepX / 2;
        const isUp = c.close >= c.open;
        const color = isUp ? '#10b981' : '#f43f5e';
        const yHigh = toY(c.high);
        const yLow = toY(c.low);
        const yOpen = toY(c.open);
        const yClose = toY(c.close);
        const top = Math.min(yOpen, yClose);
        const boxH = Math.max(2, Math.abs(yOpen - yClose));

        return (
          <g key={idx}>
            <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth="1.2" />
            <rect
              x={cx - bodyW / 2}
              y={top}
              width={bodyW}
              height={boxH}
              fill={color}
              rx="1"
            />
          </g>
        );
      })}
    </svg>
  );
};
