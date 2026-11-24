import React from 'react';

interface DarkToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  sublabel?: string;
}

export const DarkToggle: React.FC<DarkToggleProps> = ({
  checked,
  onChange,
  label,
  sublabel,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="w-full flex items-center justify-between gap-2.5 text-left py-1 group"
  >
    <div className="min-w-0">
      <div className="text-xs text-slate-200 group-hover:text-white transition-colors">
        {label}
      </div>
      {sublabel && <div className="text-[10px] text-slate-400">{sublabel}</div>}
    </div>
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
        checked
          ? 'bg-emerald-500/30 border-emerald-400'
          : 'bg-[#151e2e] border-[#2d3b52]'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
          checked
            ? 'translate-x-4 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.65)]'
            : 'translate-x-1 bg-slate-500'
        }`}
      />
    </span>
  </button>
);

interface DarkNumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export const DarkNumberInput: React.FC<DarkNumberInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  className = '',
}) => {
  const clamp = (n: number) => {
    let next = Math.max(min, n);
    if (max !== undefined) next = Math.min(max, next);
    return next;
  };

  return (
    <div
      className={`flex items-center rounded-lg bg-[#151c28] border border-[#2d3b52] overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="px-2 py-1.5 bg-[#1b2538] hover:bg-[#25334d] text-slate-300 hover:text-white font-mono text-xs shrink-0 transition-colors"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
        className="w-full min-w-0 bg-transparent px-2 py-1 font-mono text-slate-100 text-center focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        className="px-2 py-1.5 bg-[#1b2538] hover:bg-[#25334d] text-slate-300 hover:text-white font-mono text-xs shrink-0 transition-colors"
      >
        +
      </button>
    </div>
  );
};
