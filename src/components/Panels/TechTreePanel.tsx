import React, { useState } from 'react';
import type { GameState, Player, TechBranch, TechNode } from '../../engine/types';
import { formatMoney } from '../../utils/formatters';

interface TechTreePanelProps {
  gameState: GameState;
  currentPlayer: Player;
  onResearchTech: (nodeId: string) => void;
  onClose: () => void;
}

const BRANCHES: { key: TechBranch; label: string; desc: string }[] = [
  { key: 'industrial', label: '🏭 Przemysł i Wydobycie', desc: 'Kopalnie, metalurgia, automatyzacja i przemysł ciężki.' },
  { key: 'modern', label: '⚛️ Nauka i Energetyka', desc: 'Krzem, fotowoltaika, reaktory atomowe i centrum kosmiczne.' },
  { key: 'logistics', label: '🚢 Logistyka i Handel', desc: 'Drogi, porty morskie, lotniska cargo i sieci B2B.' },
  { key: 'safety', label: '🚒 BHP, Medycyna i Atrakcje', desc: 'Straż pożarna, HAZMAT, szpitale i parki rozrywki.' },
  { key: 'military', label: '🛡️ Nauka Militarna', desc: 'Wywiad, ochrona korporacyjna, sabotaż i zamach stanu.' },
];

export const TechTreePanel: React.FC<TechTreePanelProps> = ({
  gameState,
  currentPlayer,
  onResearchTech,
  onClose,
}) => {
  const [branch, setBranch] = useState<TechBranch>('industrial');
  const [zoom, setZoom] = useState<number>(1);
  const nodes = gameState.globalTechDefs.filter((n) => n.branch === branch);
  const [selectedId, setSelectedId] = useState<string>(nodes[0]?.id ?? '');

  const selectedNode: TechNode | undefined =
    nodes.find((n) => n.id === selectedId) ?? nodes[0];

  const getStatus = (id: string) => currentPlayer.globalTech[id]?.status ?? 'locked';
  const getProgress = (id: string) => currentPlayer.globalTech[id]?.progress ?? 0;
  const maxX = Math.max(760, ...nodes.map((n) => n.position.x + 190));
  const maxY = Math.max(320, ...nodes.map((n) => n.position.y + 110));

  return (
    <div id="tech-tree" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 animate-fadeIn">
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden animate-scaleIn">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              🔬 Globalne Drzewka Technologiczne (5 Gałęzi)
            </h2>
            <p className="text-xs text-slate-400">
              Zasilane przez Szkoły Średnie, Uniwersytety, Szpitale i Laboratoria R&D
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1 bg-[#151c28] border border-[#243044] rounded-lg px-1.5 py-0.5 text-[11px]">
              {[0.8, 1, 1.15].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={`px-1.5 py-0.5 rounded font-mono ${
                    zoom === z ? 'bg-sky-500/25 text-sky-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
            <div className="px-3 py-1 rounded-lg bg-sky-500/15 border border-sky-400/40 font-mono text-xs text-sky-300">
              Punkty Badań: <strong>{Math.floor(currentPlayer.researchPoints)} RP</strong>
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

        {/* Zakładki gałęzi */}
        <div className="px-4 py-2 border-b border-[#243044] flex flex-wrap gap-1.5">
          {BRANCHES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => {
                setBranch(b.key);
                const first = gameState.globalTechDefs.find((n) => n.branch === b.key);
                if (first) setSelectedId(first.id);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                branch === b.key
                  ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-sm'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Graf węzłów z krzywymi Beziera SVG i skalowaniem */}
          <div className="lg:col-span-8 p-4 overflow-auto touch-pan-x touch-pan-y bg-[#0b0f17]">
            <div
              className="relative origin-top-left transition-transform"
              style={{ width: maxX, height: maxY, transform: `scale(${zoom})` }}
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {nodes.map((node) =>
                  node.prerequisites.map((preId) => {
                    const pre = gameState.globalTechDefs.find((x) => x.id === preId);
                    if (!pre || pre.branch !== branch) return null;
                    const done = getStatus(pre.id) === 'done';
                    const x1 = pre.position.x + 156;
                    const y1 = pre.position.y + 34;
                    const x2 = node.position.x;
                    const y2 = node.position.y + 34;
                    const mx = (x1 + x2) / 2;

                    return (
                      <path
                        key={`${pre.id}_${node.id}`}
                        d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={done ? '#10b981' : '#334155'}
                        strokeWidth={done ? 2.6 : 1.6}
                        strokeDasharray={done ? undefined : '5 4'}
                      />
                    );
                  })
                )}
              </svg>

              {nodes.map((node) => {
                const st = getStatus(node.id);
                const prog = getProgress(node.id);
                const isSel = selectedNode?.id === node.id;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                    style={{ left: node.position.x, top: node.position.y }}
                    className={`absolute w-[156px] p-2.5 rounded-xl border text-left transition-all duration-150 ${
                      st === 'done'
                        ? 'bg-emerald-950/60 border-emerald-400 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.22)]'
                        : st === 'researching'
                          ? 'bg-sky-950/70 border-sky-400 text-sky-100'
                          : st === 'available'
                            ? 'bg-[#151c28] border-amber-400/75 text-slate-100 animate-node-avail hover:scale-[1.03]'
                            : 'bg-[#101520] border-[#243044] text-slate-500 opacity-70'
                    } ${isSel ? 'ring-2 ring-white/80' : ''}`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span>
                        {st === 'done'
                          ? '✅ ZBADANO'
                          : st === 'researching'
                            ? `⚙️ ${Math.round(prog)}%`
                            : st === 'available'
                              ? `✨ ${node.cost} RP`
                              : `🔒 ${node.cost} RP`}
                      </span>
                      <span className="text-amber-300">{Math.round(node.moneyCost / 1000)}k</span>
                    </div>
                    <div className="text-xs font-semibold leading-tight">{node.name}</div>
                    {st === 'researching' && (
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-sky-400 transition-all" style={{ width: `${prog}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel szczegółów wybranej technologii */}
          <div className="lg:col-span-4 p-4 border-t lg:border-t-0 lg:border-l border-[#243044] bg-[#111827] flex flex-col justify-between gap-4 overflow-y-auto">
            {selectedNode && (
              <div className="space-y-3">
                <div className="text-xs font-mono text-sky-400 uppercase">
                  {BRANCHES.find((b) => b.key === selectedNode.branch)?.label}
                </div>
                <h3 className="text-lg font-bold text-slate-100">{selectedNode.name}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedNode.description}</p>
                {(() => {
                  const patent = (gameState.patents ?? []).find((p) => p.techId === selectedNode.id);
                  if (!patent) return null;
                  return (
                    <div className="p-2 rounded bg-amber-950/40 border border-amber-400/50 text-[11px] text-amber-200">
                      🏅 <strong>Patent Wyłączny:</strong> Właściciel <strong>{patent.ownerName}</strong> pobiera{' '}
                      {formatMoney(patent.royaltyPerTick)}/T tantiem (do tury #{patent.expiresTick}).
                    </div>
                  );
                })()}
                {currentPlayer.secretNuclearRevealed && branch === 'military' && (
                  <div className="p-2.5 rounded bg-lime-950/35 border border-lime-400/50 text-[11px] text-lime-200">
                    ☢️ <strong>Odblokowano Tajny Program Jądrowy!</strong> Zarządzaj produkcją głowicy w oknie{' '}
                    <strong>🏛️ Wpływy → Arsenał</strong>.
                  </div>
                )}

                <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Koszt Naukowy:</span>
                    <span className="font-mono text-sky-300">{selectedNode.cost} RP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Budżet Wdrożenia:</span>
                    <span className="font-mono text-amber-300">{formatMoney(selectedNode.moneyCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Czas Badań:</span>
                    <span className="font-mono text-slate-200">{selectedNode.researchTicks} cykli</span>
                  </div>
                </div>

                {selectedNode.prerequisites.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#1e293b] space-y-1 text-xs">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">Wymagane Technologie</div>
                    {selectedNode.prerequisites.map((pid) => {
                      const pre = gameState.globalTechDefs.find((t) => t.id === pid);
                      const ok = getStatus(pid) === 'done';
                      return (
                        <div key={pid} className={ok ? 'text-emerald-400' : 'text-rose-400'}>
                          {ok ? '✓' : '✕'} {pre?.name ?? pid}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-emerald-300">Efekty Strategiczne:</div>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                    {selectedNode.effects.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {selectedNode && (
              <div>
                {getStatus(selectedNode.id) === 'done' ? (
                  <div className="w-full py-2.5 text-center rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-xs">
                    ✅ Technologia Wdrożona
                  </div>
                ) : getStatus(selectedNode.id) === 'researching' ? (
                  <div className="w-full py-2.5 text-center rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 font-semibold text-xs">
                    ⚙️ Badania w toku ({Math.round(getProgress(selectedNode.id))}%)
                  </div>
                ) : getStatus(selectedNode.id) === 'available' ? (
                  <button
                    type="button"
                    disabled={
                      currentPlayer.researchPoints < selectedNode.cost ||
                      currentPlayer.cash < selectedNode.moneyCost
                    }
                    onClick={() => onResearchTech(selectedNode.id)}
                    className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm disabled:opacity-40 transition-colors"
                  >
                    Rozpocznij Badania ({selectedNode.cost} RP)
                  </button>
                ) : (
                  <div className="w-full py-2.5 text-center rounded-lg bg-slate-800/70 text-slate-400 text-xs">
                    🔒 Zbadaj najpierw technologie poprzedzające
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
