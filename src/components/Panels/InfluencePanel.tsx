import React, { useState } from 'react';
import { INFLUENCE_ACTIONS } from '../../data/influenceActions';
import type { GameState, InfluencePillar, Player } from '../../engine/types';
import { formatMoney } from '../../utils/formatters';

interface InfluencePanelProps {
  gameState: GameState;
  currentPlayer: Player;
  onExecuteAction: (
    actionId: string,
    targetPlayerId?: string,
    targetPlotId?: string,
    targetBuildingId?: string
  ) => void;
  onClose: () => void;
}

const PILLAR_TABS: { key: InfluencePillar; label: string; desc: string }[] = [
  {
    key: 'financial',
    label: '💰 Filar Finansowy',
    desc: 'Łapówki, lobbing podatkowy, kupowanie ustaw oraz przymusowy wykup majątku rywali.',
  },
  {
    key: 'military',
    label: '⚔️ Filar Militarny',
    desc: 'Szpiegostwo, sabotaż infrastruktury, korporacyjny abordaż i zamach stanu.',
  },
  {
    key: 'social',
    label: '⛪ Filar Społeczny (Wyborcy)',
    desc: 'Zakulisowe sterowanie wyborcami poprzez Kościół, media oraz organizowanie bojkotów.',
  },
];

export const InfluencePanel: React.FC<InfluencePanelProps> = ({
  gameState,
  currentPlayer,
  onExecuteAction,
  onClose,
}) => {
  const [pillar, setPillar] = useState<InfluencePillar>('financial');
  const rivals = gameState.players.filter((p) => p.id !== currentPlayer.id && !p.isEliminated);
  const [targetPlayerId, setTargetPlayerId] = useState<string>(rivals[0]?.id ?? '');

  const targetPlots = gameState.plots.filter((p) => p.ownerId === targetPlayerId);
  const targetBuildings = targetPlots.filter((p) => p.building !== null);
  const [targetPlotId, setTargetPlotId] = useState<string>(targetPlots[0]?.id ?? '');
  const [targetBuildingId, setTargetBuildingId] = useState<string>(
    targetBuildings[0]?.building?.id ?? ''
  );

  const actions = INFLUENCE_ACTIONS.filter((a) => a.pillar === pillar);
  const pillarScore =
    pillar === 'financial'
      ? currentPlayer.influence.financial
      : pillar === 'military'
        ? currentPlayer.influence.military
        : currentPlayer.influence.social;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              🏛️ Trzy Filary Wpływu na Państwo i Rywali
            </h2>
            <p className="text-xs text-slate-400">
              Nastroje Wyborców: <span className="font-mono text-amber-300">{Math.round(gameState.voterMood)}</span> ·
              Kościół: <span className="font-mono text-purple-300">{Math.round(currentPlayer.influence.churchSupport)}</span> ·
              Media: <span className="font-mono text-sky-300">{Math.round(currentPlayer.influence.mediaControl)}</span> ·
              Siła Militar.: <span className="font-mono text-rose-300">{Math.round(currentPlayer.militaryPower)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Paski wyników filarów */}
        <div className="px-4 py-2.5 grid grid-cols-3 gap-2 bg-[#0e1420] border-b border-[#243044]">
          <div className="p-2 rounded bg-[#151c28] border border-[#243044] text-xs">
            <div className="text-slate-400">Wpływy Finansowe</div>
            <div className="font-mono text-base font-bold text-amber-300">
              {Math.round(currentPlayer.influence.financial)} pkt
            </div>
          </div>
          <div className="p-2 rounded bg-[#151c28] border border-[#243044] text-xs">
            <div className="text-slate-400">Wpływy Militarne</div>
            <div className="font-mono text-base font-bold text-rose-400">
              {Math.round(currentPlayer.influence.military)} pkt
            </div>
          </div>
          <div className="p-2 rounded bg-[#151c28] border border-[#243044] text-xs">
            <div className="text-slate-400">Wpływy Społeczne</div>
            <div className="font-mono text-base font-bold text-purple-300">
              {Math.round(currentPlayer.influence.social)} pkt
            </div>
          </div>
        </div>

        {/* Zakładki filarów */}
        <div className="px-4 py-2 border-b border-[#243044] flex gap-2 overflow-x-auto no-scrollbar">
          {PILLAR_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setPillar(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 border ${
                pillar === t.key
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs text-slate-300">
            {PILLAR_TABS.find((t) => t.key === pillar)?.desc}
          </div>

          {/* Selektor celu (konkurent, działka, budynek) */}
          {rivals.length > 0 && (
            <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Cel Operacji (Rywal):</label>
                <select
                  value={targetPlayerId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setTargetPlayerId(pid);
                    const pls = gameState.plots.filter((p) => p.ownerId === pid);
                    setTargetPlotId(pls[0]?.id ?? '');
                    const bld = pls.find((p) => p.building)?.building?.id ?? '';
                    setTargetBuildingId(bld);
                  }}
                  className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100"
                >
                  {rivals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.companyName} ({r.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Działka (dla Wykupu):</label>
                <select
                  value={targetPlotId}
                  onChange={(e) => setTargetPlotId(e.target.value)}
                  className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100"
                >
                  {targetPlots.length === 0 ? (
                    <option value="">Brak działek rywala</option>
                  ) : (
                    targetPlots.map((p) => (
                      <option key={p.id} value={p.id}>
                        ({p.gridX},{p.gridY}) {p.building ? `· ${p.building.name}` : '· Wolny grunt'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Obiekt (Sabotaż / Abordaż):</label>
                <select
                  value={targetBuildingId}
                  onChange={(e) => setTargetBuildingId(e.target.value)}
                  className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100"
                >
                  {targetBuildings.length === 0 ? (
                    <option value="">Brak budynków rywala</option>
                  ) : (
                    targetBuildings.map((p) => (
                      <option key={p.building!.id} value={p.building!.id}>
                        {p.building!.icon} {p.building!.name} ({p.gridX},{p.gridY})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          )}

          {/* Karty akcji */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {actions.map((act) => {
              const cd = currentPlayer.actionCooldowns[act.id] ?? 0;
              const missingTech =
                act.requiredTech && currentPlayer.globalTech[act.requiredTech]?.status !== 'done';
              const lowScore = pillarScore < act.requiredScore;
              const noCash = currentPlayer.cash < act.cost;
              const missingTarget =
                (act.requiresTargetPlayer && !targetPlayerId) ||
                (act.requiresTargetPlot && !targetPlotId) ||
                (act.requiresTargetBuilding && !targetBuildingId);

              const disabled = cd > 0 || Boolean(missingTech) || lowScore || noCash || missingTarget;

              return (
                <div
                  key={act.id}
                  className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#243044] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-slate-100 text-sm">{act.name}</h4>
                      <span className="font-mono text-xs font-bold text-amber-300">
                        {formatMoney(act.cost)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{act.description}</p>
                    <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                      {act.estimatedEffect}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Wymagane wpływy: {act.requiredScore} pkt</span>
                      <span>Cooldown: {act.cooldownTicks}T</span>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onExecuteAction(
                          act.id,
                          targetPlayerId || undefined,
                          targetPlotId || undefined,
                          targetBuildingId || undefined
                        )
                      }
                      className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs transition-colors"
                    >
                      {cd > 0
                        ? `Odnowienie (${cd}T)`
                        : missingTech
                          ? '🔒 Wymaga technologii militarnej'
                          : lowScore
                            ? `🔒 Za niskie wpływy (${act.requiredScore} pkt)`
                            : missingTarget
                              ? 'Wybierz cel powyżej'
                              : 'Uruchom Operację'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
