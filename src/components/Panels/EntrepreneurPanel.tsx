import React, { useRef, useState } from 'react';
import { BUILDING_DEFINITIONS } from '../../data/buildings';
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

const CANVAS_W = 2640;
const CANVAS_H = 1720;
const CX = 1320;
const CY = 980;

export const EntrepreneurPanel: React.FC<EntrepreneurPanelProps> = ({
  gameState,
  currentPlayer,
  onUnlockSkill,
  onClose,
}) => {
  const skills = gameState.entrepreneurSkillDefs;
  const [selectedId, setSelectedId] = useState<string>(skills[0]?.id ?? '');
  const [zoom, setZoom] = useState<number>(0.62);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: -340, y: -260 });
  const [activeBranchFilter, setActiveBranchFilter] = useState<EntrepreneurBranch | 'all'>('all');

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number; moved: boolean }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    moved: false,
  });

  const selected: SkillNode | undefined = skills.find((s) => s.id === selectedId) ?? skills[0];
  const doneTechCount = Object.values(currentPlayer.globalTech).filter((t) => t.status === 'done').length;

  const focusCenter = (targetWorldX = CX, targetWorldY = CY, nextZoom = zoom) => {
    const el = viewportRef.current;
    const vw = el ? el.clientWidth : 680;
    const vh = el ? el.clientHeight : 520;
    setZoom(nextZoom);
    setPan({
      x: vw / 2 - targetWorldX * nextZoom,
      y: vh / 2 - targetWorldY * nextZoom,
    });
  };

  const jumpToBranch = (branch: EntrepreneurBranch | 'all') => {
    setActiveBranchFilter(branch);
    if (branch === 'all') {
      focusCenter(CX, CY, 0.56);
      return;
    }
    const nodes = skills.filter((s) => s.branch === branch);
    if (nodes.length === 0) return;
    const avgX = CX + nodes.reduce((s, n) => s + n.position.x, 0) / nodes.length;
    const avgY = CY + nodes.reduce((s, n) => s + n.position.y, 0) / nodes.length;
    focusCenter(avgX, avgY, 0.78);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Math.min(1.35, Math.max(0.38, Number((zoom * factor).toFixed(3))));
    const wx = (mx - pan.x) / zoom;
    const wy = (my - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({
      x: mx - wx * nextZoom,
      y: my - wy * nextZoom,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    setPan({
      x: dragRef.current.origX + dx,
      y: dragRef.current.origY + dy,
    });
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  // Ocena wymagań dodatkowych (poziom korporacji, wpływy, badania R&D)
  const extraChecks = selected
    ? [
        ...(selected.requiredCorpLevel
          ? [
              {
                label: `Poziom Korporacji: min. Poz. ${selected.requiredCorpLevel} (masz Poz. ${currentPlayer.corporationLevel})`,
                met: currentPlayer.corporationLevel >= selected.requiredCorpLevel,
              },
            ]
          : []),
        ...(selected.requiredInfluenceScore
          ? (() => {
              const totalInf =
                currentPlayer.influence.financial +
                currentPlayer.influence.military +
                currentPlayer.influence.social;
              return [
                {
                  label: `Łączne Wpływy Polityczne: min. ${selected.requiredInfluenceScore} pkt (masz ${Math.round(totalInf)} pkt)`,
                  met: totalInf >= selected.requiredInfluenceScore,
                },
              ];
            })()
          : []),
        ...(selected.requiredGlobalTechCount
          ? [
              {
                label: `Zbadane technologie R&D: min. ${selected.requiredGlobalTechCount} (masz ${doneTechCount})`,
                met: doneTechCount >= selected.requiredGlobalTechCount,
              },
            ]
          : []),
      ]
    : [];

  const allExtraMet = extraChecks.every((c) => c.met);
  void BUILDING_DEFINITIONS;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 animate-fadeIn">
      <div className="w-full max-w-7xl h-[92vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-[#243044] bg-[#0b0f17] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              👤 Drzewko Przedsiębiorcy ({currentPlayer.name} · {skills.length} Węzłów)
            </h2>
            <p className="text-[11px] text-slate-400">
              Chwytaj i przesuwaj tło (Pan & Zoom kółkiem myszy) lub przeskocz od razu do wybranej gałęzi
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 bg-[#151c28] border border-[#243044] rounded-lg px-1.5 py-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => focusCenter(CX, CY, Math.max(0.4, Number((zoom - 0.12).toFixed(2))))}
                className="px-1.5 py-0.5 text-slate-300 hover:text-white font-mono"
              >
                −
              </button>
              <span className="font-mono text-amber-300 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => focusCenter(CX, CY, Math.min(1.25, Number((zoom + 0.12).toFixed(2))))}
                className="px-1.5 py-0.5 text-slate-300 hover:text-white font-mono"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => focusCenter(CX, CY, 0.58)}
                className="px-1.5 py-0.5 text-sky-300 hover:text-white border-l border-[#243044] ml-0.5"
                title="Wyśrodkuj widok na PREZESIE"
              >
                ⌖ Reset
              </button>
            </div>
            <div className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 font-mono text-xs text-amber-300">
              <strong>{currentPlayer.skillPoints} SP</strong>
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

        {/* Szybki pasek skoków do gałęzi */}
        <div className="px-3 py-1.5 bg-[#0e1522] border-b border-[#1e293b] flex flex-wrap items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => jumpToBranch('all')}
            className={`px-2.5 py-1 rounded-lg border font-medium ${
              activeBranchFilter === 'all'
                ? 'bg-slate-700/60 border-slate-300 text-white'
                : 'bg-[#111827] border-[#243044] text-slate-400 hover:text-slate-200'
            }`}
          >
            🌐 Cała Sieć ({skills.filter((s) => currentPlayer.entrepreneurSkills[s.id] === 'done').length}/{skills.length})
          </button>
          {(Object.keys(BRANCH_NAMES) as EntrepreneurBranch[]).map((br) => (
            <button
              key={br}
              type="button"
              onClick={() => jumpToBranch(br)}
              className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                activeBranchFilter === br ? 'text-white' : 'text-slate-300 hover:text-white'
              }`}
              style={{
                backgroundColor: activeBranchFilter === br ? `${BRANCH_COLORS[br]}30` : '#111827',
                borderColor: activeBranchFilter === br ? BRANCH_COLORS[br] : '#243044',
              }}
            >
              ● {BRANCH_NAMES[br]}
            </button>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Interaktywny canvas Pan & Zoom */}
          <div
            ref={viewportRef}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="lg:col-span-8 bg-[#090d14] relative overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none min-h-[340px]"
            style={{
              backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              }}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {skills.map((sk) => {
                  const sx = CX + sk.position.x;
                  const sy = CY + sk.position.y;
                  const col = BRANCH_COLORS[sk.branch];
                  const dimmed = activeBranchFilter !== 'all' && activeBranchFilter !== sk.branch;
                  if (sk.prerequisites.length === 0) {
                    const done = currentPlayer.entrepreneurSkills[sk.id] === 'done';
                    return (
                      <path
                        key={`root_${sk.id}`}
                        d={`M ${CX} ${CY} Q ${(CX + sx) / 2} ${CY}, ${sx} ${sy}`}
                        fill="none"
                        stroke={col}
                        strokeWidth={done ? 3.2 : 2}
                        strokeOpacity={dimmed ? 0.14 : done ? 0.95 : 0.5}
                      />
                    );
                  }
                  return sk.prerequisites.map((pid) => {
                    const parent = skills.find((x) => x.id === pid);
                    if (!parent) return null;
                    const px = CX + parent.position.x;
                    const py = CY + parent.position.y;
                    const done = currentPlayer.entrepreneurSkills[parent.id] === 'done';
                    return (
                      <path
                        key={`${pid}_${sk.id}`}
                        d={`M ${px} ${py} L ${sx} ${sy}`}
                        fill="none"
                        stroke={done ? col : '#334155'}
                        strokeWidth={done ? 2.8 : 1.7}
                        strokeOpacity={dimmed ? 0.14 : 1}
                        strokeDasharray={done ? undefined : '5 5'}
                      />
                    );
                  });
                })}
              </svg>

              {/* Centralny węzeł Prezesa */}
              <div
                style={{ left: CX - 56, top: CY - 26 }}
                className="absolute w-[112px] h-[52px] rounded-full bg-[#1a2438] border-2 border-amber-400 flex items-center justify-center text-sm font-extrabold text-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.35)]"
              >
                PREZES
              </div>

              {skills.map((sk) => {
                const st = currentPlayer.entrepreneurSkills[sk.id] ?? 'locked';
                const col = BRANCH_COLORS[sk.branch];
                const isSel = selected?.id === sk.id;
                const isApex = Boolean(sk.isApex || sk.tier === 8);
                const dimmed = activeBranchFilter !== 'all' && activeBranchFilter !== sk.branch;
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => setSelectedId(sk.id)}
                    style={{
                      left: CX + sk.position.x - 66,
                      top: CY + sk.position.y - 28,
                      borderColor: isApex && st !== 'locked'
                        ? '#facc15'
                        : st === 'done'
                          ? col
                          : st === 'available'
                            ? `${col}cc`
                            : '#243044',
                      opacity: dimmed ? 0.25 : undefined,
                    }}
                    className={`absolute w-[132px] px-2 py-1.5 rounded-xl border text-center transition-all duration-150 ${
                      st === 'done'
                        ? 'bg-[#162825] text-slate-100 font-semibold shadow-md'
                        : st === 'available'
                          ? 'bg-[#141c2b] text-slate-200 animate-node-avail hover:scale-105'
                          : 'bg-[#0e131d] text-slate-500 opacity-70'
                    } ${isApex ? 'ring-1 ring-amber-400/60 shadow-[0_0_14px_rgba(250,204,21,0.2)]' : ''} ${
                      isSel ? 'ring-2 ring-white' : ''
                    }`}
                  >
                    <div className="text-[10px] font-mono flex items-center justify-between" style={{ color: st === 'locked' ? '#64748b' : col }}>
                      <span>{isApex ? '★ EKSTRA' : `T${sk.tier ?? 1}`}</span>
                      <span>
                        {st === 'done' ? '✅' : st === 'available' ? `✨${sk.skillPointCost}SP` : `🔒${sk.skillPointCost}SP`}
                      </span>
                    </div>
                    <div className="text-[11px] leading-tight line-clamp-2 mt-0.5">{sk.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prawy inspektor węzła */}
          <div className="lg:col-span-4 p-4 border-t lg:border-t-0 lg:border-l border-[#243044] bg-[#111827] flex flex-col justify-between gap-4 overflow-y-auto">
            {selected && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                    style={{
                      backgroundColor: `${BRANCH_COLORS[selected.branch]}22`,
                      color: BRANCH_COLORS[selected.branch],
                    }}
                  >
                    {BRANCH_NAMES[selected.branch]} · Poziom {selected.tier ?? 1}
                  </span>
                  {(selected.isApex || selected.tier === 8) && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-amber-300 text-[10px] font-bold">
                      ★ SZCZYT GAŁĘZI
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-100">{selected.name}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{selected.description}</p>

                <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Koszt wdrożenia:</span>
                    <span
                      className={`font-mono font-semibold ${
                        currentPlayer.cash >= selected.cashCost ? 'text-amber-300' : 'text-rose-400'
                      }`}
                    >
                      {formatMoney(selected.cashCost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Punkty Rozwoju (SP):</span>
                    <span
                      className={`font-mono font-semibold ${
                        currentPlayer.skillPoints >= selected.skillPointCost ? 'text-sky-300' : 'text-rose-400'
                      }`}
                    >
                      {selected.skillPointCost} SP
                    </span>
                  </div>
                </div>

                {(selected.prerequisites.length > 0 || extraChecks.length > 0) && (
                  <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#1e293b] space-y-1 text-xs">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">
                      Wymagania odblokowania
                    </div>
                    {selected.prerequisites.map((pid) => {
                      const pre = skills.find((s) => s.id === pid);
                      const ok = currentPlayer.entrepreneurSkills[pid] === 'done';
                      return (
                        <div key={pid} className={ok ? 'text-emerald-400' : 'text-rose-400'}>
                          {ok ? '✓' : '✕'} Poprzednik: {pre?.name ?? pid}
                        </div>
                      );
                    })}
                    {extraChecks.map((ec) => (
                      <div key={ec.label} className={ec.met ? 'text-emerald-400' : 'text-rose-400'}>
                        {ec.met ? '✓' : '✕'} {ec.label}
                      </div>
                    ))}
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
                      currentPlayer.cash < selected.cashCost ||
                      !allExtraMet
                    }
                    onClick={() => onUnlockSkill(selected.id)}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm disabled:opacity-40 transition-colors"
                  >
                    {!allExtraMet
                      ? 'Niespełnione progi korporacyjne'
                      : `Odblokuj (${selected.skillPointCost} SP · ${formatMoney(selected.cashCost)})`}
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
