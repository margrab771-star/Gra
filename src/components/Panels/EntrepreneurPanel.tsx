import React, { useState } from 'react';
import type { EntrepreneurBranch, GameState, Player, SkillNode } from '../../engine/types';
import { formatMoney } from '../../utils/formatters';

interface EntrepreneurPanelProps {
  gameState: GameState;
  currentPlayer: Player;
  onUnlockSkill: (nodeId: string) => void;
  onClose: () => void;
}

const BRANCH_COLORS: Record<EntrepreneurBranch, string> = {
  finance: '#10b981',
  negotiation: '#f59e0b',
  logistics: '#38bdf8',
  technology: '#a855f7',
  influence: '#f43f5e',
};

const BRANCH_NAMES: Record<EntrepreneurBranch, string> = {
  finance: 'Finanse i Podatki',
  negotiation: 'Negocjacje i B2B',
  logistics: 'Logistyka i Zapasy',
  technology: 'Edukacja i Innowacje',
  influence: 'Wpływy i Dyplomacja',
};

export const EntrepreneurPanel: React.FC<EntrepreneurPanelProps> = ({
  gameState,
  currentPlayer,
  onUnlockSkill,
  onClose,
}) => {
  const skills = gameState.entrepreneurSkillDefs;
  const [selectedId, setSelectedId] = useState<string>(skills[0]?.id ?? '');
  const [zoom, setZoom] = useState<number>(0.85);
  const selected: SkillNode | undefined = skills.find((s) => s.id === selectedId) ?? skills[0];

  const cx = 440;
  const cy = 380;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 animate-fadeIn">
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden animate-scaleIn">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              👤 Drzewko Przedsiębiorcy ({currentPlayer.name} · 20 Węzłów)
            </h2>
            <p className="text-xs text-slate-400">
              Przewijaj swobodnie wszystkie 5 gałęzi talentów zarządczych i strategicznych
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1 bg-[#151c28] border border-[#243044] rounded-lg px-1.5 py-0.5 text-[11px]">
              {[0.7, 0.85, 1].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={`px-1.5 py-0.5 rounded font-mono ${
                    zoom === z ? 'bg-amber-500/25 text-amber-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
            <div className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 font-mono text-xs text-amber-300">
              Punkty Rozwoju: <strong>{currentPlayer.skillPoints} SP</strong>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          <div className="lg:col-span-8 bg-[#0b0f17] overflow-auto touch-pan-x touch-pan-y p-3">
            <div
              className="relative w-[880px] h-[760px] shrink-0 origin-top-left transition-transform"
              style={{ transform: `scale(${zoom})` }}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {skills.map((sk) => {
                  const sx = cx + sk.position.x;
                  const sy = cy + sk.position.y;
                  const col = BRANCH_COLORS[sk.branch];
                  if (sk.prerequisites.length === 0) {
                    const done = currentPlayer.entrepreneurSkills[sk.id] === 'done';
                    return (
                      <path
                        key={`root_${sk.id}`}
                        d={`M ${cx} ${cy} Q ${(cx + sx) / 2} ${cy}, ${sx} ${sy}`}
                        fill="none"
                        stroke={col}
                        strokeWidth={done ? 2.8 : 1.8}
                        strokeOpacity={done ? 0.95 : 0.45}
                      />
                    );
                  }
                  return sk.prerequisites.map((pid) => {
                    const parent = skills.find((x) => x.id === pid);
                    if (!parent) return null;
                    const px = cx + parent.position.x;
                    const py = cy + parent.position.y;
                    const done = currentPlayer.entrepreneurSkills[parent.id] === 'done';
                    return (
                      <path
                        key={`${pid}_${sk.id}`}
                        d={`M ${px} ${py} L ${sx} ${sy}`}
                        fill="none"
                        stroke={done ? col : '#334155'}
                        strokeWidth={done ? 2.6 : 1.5}
                        strokeDasharray={done ? undefined : '4 4'}
                      />
                    );
                  });
                })}
              </svg>

              {/* Centralny węzeł Prezesa */}
              <div
                style={{ left: cx - 46, top: cy - 22 }}
                className="absolute w-[92px] h-[44px] rounded-full bg-[#1a2438] border-2 border-amber-400 flex items-center justify-center text-xs font-bold text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.3)]"
              >
                PREZES
              </div>

              {skills.map((sk) => {
                const st = currentPlayer.entrepreneurSkills[sk.id] ?? 'locked';
                const col = BRANCH_COLORS[sk.branch];
                const isSel = selected?.id === sk.id;
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => setSelectedId(sk.id)}
                    style={{
                      left: cx + sk.position.x - 56,
                      top: cy + sk.position.y - 24,
                      borderColor: st === 'done' ? col : st === 'available' ? `${col}cc` : '#243044',
                    }}
                    className={`absolute w-[112px] px-2 py-1.5 rounded-xl border text-center transition-all duration-150 ${
                      st === 'done'
                        ? 'bg-[#162825] text-slate-100 font-semibold shadow-md'
                        : st === 'available'
                          ? 'bg-[#141c2b] text-slate-200 animate-node-avail hover:scale-105'
                          : 'bg-[#0e131d] text-slate-500 opacity-65'
                    } ${isSel ? 'ring-2 ring-white/80' : ''}`}
                  >
                    <div className="text-[10px] font-mono" style={{ color: st === 'locked' ? '#64748b' : col }}>
                      {st === 'done' ? '✅ AKTYWNE' : st === 'available' ? `✨ ${sk.skillPointCost} SP` : `🔒 ${sk.skillPointCost} SP`}
                    </div>
                    <div className="text-[11px] leading-tight truncate">{sk.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 p-4 border-t lg:border-t-0 lg:border-l border-[#243044] bg-[#111827] flex flex-col justify-between gap-4 overflow-y-auto">
            {selected && (
              <div className="space-y-3">
                <span
                  className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                  style={{
                    backgroundColor: `${BRANCH_COLORS[selected.branch]}22`,
                    color: BRANCH_COLORS[selected.branch],
                  }}
                >
                  {BRANCH_NAMES[selected.branch]}
                </span>
                <h3 className="text-lg font-bold text-slate-100">{selected.name}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{selected.description}</p>

                <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Koszt Edukacji / Wdrożenia:</span>
                    <span className="font-mono text-amber-300">{formatMoney(selected.cashCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Wymagane Punkty Rozwoju:</span>
                    <span className="font-mono text-sky-300">{selected.skillPointCost} SP</span>
                  </div>
                </div>

                {selected.prerequisites.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#1e293b] space-y-1 text-xs">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">Wymagany Poprzednik</div>
                    {selected.prerequisites.map((pid) => {
                      const pre = skills.find((s) => s.id === pid);
                      const ok = currentPlayer.entrepreneurSkills[pid] === 'done';
                      return (
                        <div key={pid} className={ok ? 'text-emerald-400' : 'text-rose-400'}>
                          {ok ? '✓' : '✕'} {pre?.name ?? pid}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-emerald-300">Premie Pasywne:</div>
                  <ul className="list-disc list-inside text-xs text-slate-200 space-y-1">
                    {selected.effects.map((ef, i) => (
                      <li key={i}>{ef}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {selected && (
              <div>
                {currentPlayer.entrepreneurSkills[selected.id] === 'done' ? (
                  <div className="w-full py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-center text-xs font-semibold">
                    ✅ Umiejętność Aktywna
                  </div>
                ) : currentPlayer.entrepreneurSkills[selected.id] === 'available' ? (
                  <button
                    type="button"
                    disabled={
                      currentPlayer.skillPoints < selected.skillPointCost ||
                      currentPlayer.cash < selected.cashCost
                    }
                    onClick={() => onUnlockSkill(selected.id)}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm disabled:opacity-40 transition-colors"
                  >
                    Odblokuj ({selected.skillPointCost} SP · {formatMoney(selected.cashCost)})
                  </button>
                ) : (
                  <div className="w-full py-2.5 rounded-lg bg-slate-800/70 text-slate-400 text-center text-xs">
                    🔒 Odblokuj poprzedni poziom w tej gałęzi
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
