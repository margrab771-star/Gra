import React, { useState } from 'react';
import { GOVERNMENT_CONFIGS, PLAYER_COLORS } from '../../config/gameConfig';
import { INFLUENCE_ACTIONS } from '../../data/influenceActions';
import {
  arePlayersAllied,
  getMaxCoalitionMembers,
  getPlayerCoalition,
  hasActiveEmbargo,
  hasActiveNAP,
} from '../../engine/CoalitionSystem';
import { isPlotBuildingVisibleToViewer } from '../../engine/PlotSystem';
import type { GameState, GovernmentKind, InfluencePillar, Player } from '../../engine/types';
import { BUILDINGS_EN } from '../../i18n/buildingsEn';
import { localizeGovernment, localizeInfluenceAction } from '../../i18n/dataTranslations';
import { useI18n } from '../../i18n/useI18n';
import { formatCompactMoney, formatMoney } from '../../utils/formatters';

interface InfluencePanelProps {
  gameState: GameState;
  currentPlayer: Player;
  onExecuteAction: (
    actionId: string,
    targetPlayerId?: string,
    targetPlotId?: string,
    targetBuildingId?: string
  ) => void;
  onLobbyElection?: (govKind: GovernmentKind, useInfluence: boolean) => void;
  onStartMissileTarget?: () => void;
  onStartNuclearProject?: () => void;
  onStartNuclearStrikeTarget?: () => void;
  onCreateCoalition?: (name: string, tag: string, color: string) => void;
  onInviteCoalition?: (targetPlayerId: string) => void;
  onRespondCoalitionInvite?: (coalitionId: string, accept: boolean) => void;
  onLeaveCoalition?: () => void;
  onToggleCoalitionGeology?: () => void;
  onProposeNAP?: (targetPlayerId: string) => void;
  onAcceptNAP?: (napId: string) => void;
  onImposeEmbargo?: (targetPlayerId: string) => void;
  onClose: () => void;
}

type InfluenceTab = InfluencePillar | 'diplomacy';

const PILLAR_TABS_PL: { key: InfluenceTab; label: string; desc: string }[] = [
  {
    key: 'financial',
    label: '💰 Filar Finansowy',
    desc: 'Łapówki, lobbing podatkowy, kupowanie ustaw oraz przymusowy wykup majątku rywali.',
  },
  {
    key: 'military',
    label: '⚔️ Filar Militarny & Arsenał',
    desc: 'Szpiegostwo, sabotaż, abordaż, rakiety taktyczne 3×3 i tajny program jądrowy 5×5.',
  },
  {
    key: 'social',
    label: '⛪ Filar Społeczny',
    desc: 'Zarządzanie poparciem wyborców (wymaganym np. pod Bazę PMC 75%), Kościołem i bojkotami.',
  },
  {
    key: 'diplomacy',
    label: '🤝 Koalicje & Dyplomacja',
    desc: 'Twórz sojusze (0% myta na autostradach, wspólne mapy geologiczne), pakty NAP oraz embarga.',
  },
];

const PILLAR_TABS_EN: { key: InfluenceTab; label: string; desc: string }[] = [
  {
    key: 'financial',
    label: '💰 Financial Pillar',
    desc: 'Bribes, tax lobbying, buying legislation, and hostile buyouts of rival assets.',
  },
  {
    key: 'military',
    label: '⚔️ Military & Arsenal',
    desc: 'Espionage, sabotage, boarding ops, 3×3 tactical missiles & covert 5×5 nuclear weapons.',
  },
  {
    key: 'social',
    label: '⛪ Social & Media Pillar',
    desc: 'Manage voter approval (e.g. 75% needed for PMC Base), Church backing & boycotts.',
  },
  {
    key: 'diplomacy',
    label: '🤝 Coalitions & Diplomacy',
    desc: 'Form alliances (0% highway tolls, shared geology maps), NAP treaties & trade embargoes.',
  },
];

export const InfluencePanel: React.FC<InfluencePanelProps> = ({
  gameState,
  currentPlayer,
  onExecuteAction,
  onLobbyElection,
  onStartMissileTarget,
  onStartNuclearProject,
  onStartNuclearStrikeTarget,
  onCreateCoalition,
  onInviteCoalition,
  onRespondCoalitionInvite,
  onLeaveCoalition,
  onToggleCoalitionGeology,
  onProposeNAP,
  onAcceptNAP,
  onImposeEmbargo,
  onClose,
}) => {
  const { lang } = useI18n();
  const pillarTabs = lang === 'en' ? PILLAR_TABS_EN : PILLAR_TABS_PL;
  const [pillar, setPillar] = useState<InfluenceTab>('financial');
  const rivals = gameState.players.filter((p) => p.id !== currentPlayer.id && !p.isEliminated);
  const [targetPlayerId, setTargetPlayerId] = useState<string>(rivals[0]?.id ?? '');

  const [coalName, setCoalName] = useState(lang === 'en' ? 'Northern Pact' : 'Pakt Północny');
  const [coalTag, setCoalTag] = useState(lang === 'en' ? 'PACT' : 'PAKT');
  const [coalColor, setCoalColor] = useState(currentPlayer.color || PLAYER_COLORS[0]);

  const targetPlots = gameState.plots.filter((p) => p.ownerId === targetPlayerId);
  const targetBuildings = targetPlots.filter((p) => p.building !== null && !p.building.destroyedRuins);
  const [targetPlotId, setTargetPlotId] = useState<string>(targetPlots[0]?.id ?? '');
  const [targetBuildingId, setTargetBuildingId] = useState<string>(
    targetBuildings[0]?.building?.id ?? ''
  );

  const actions = INFLUENCE_ACTIONS.filter((a) => a.pillar === pillar).map((a) =>
    localizeInfluenceAction(a, lang)
  );
  const pillarScore =
    pillar === 'financial'
      ? currentPlayer.influence.financial
      : pillar === 'military'
        ? currentPlayer.influence.military
        : currentPlayer.influence.social;

  const myCoalition = getPlayerCoalition(gameState, currentPlayer.id);
  const maxCoalMembers = getMaxCoalitionMembers(gameState);
  const pendingInvites = (gameState.coalitions ?? []).filter((c) =>
    c.invitedPlayerIds.includes(currentPlayer.id)
  );
  const pendingNaps = (gameState.naps ?? []).filter(
    (n) => n.status === 'proposed' && n.playerBId === currentPlayer.id
  );

  const hasMissileBase = gameState.plots.some(
    (p) =>
      p.ownerId === currentPlayer.id &&
      p.building?.type === 'militaryBase' &&
      p.building.isActive &&
      !p.building.destroyedRuins &&
      p.building.techTree.some((t) => t.status === 'done' && t.effects.tacticalMissileUnlocked)
  );
  const missileCooldown = currentPlayer.actionCooldowns['tactical_missile'] ?? 0;

  const detectedNuclearRivals = gameState.players.filter(
    (p) =>
      p.id !== currentPlayer.id &&
      (p.nuclearDetectedByPlayers ?? []).includes(currentPlayer.id) &&
      (p.nuclearProjectActive || (p.nuclearWarheadsReady ?? 0) > 0)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-100">
              {lang === 'en'
                ? '🏛️ Political Influence, Diplomacy & Arsenal'
                : '🏛️ Wpływy Polityczne, Dyplomacja & Arsenał'}
            </h2>
            <p className="text-xs text-slate-400">
              {lang === 'en' ? 'Voter Approval:' : 'Poparcie wyborców:'}{' '}
              <span className="font-mono text-emerald-300">{Math.round(currentPlayer.influence.voterApproval)}%</span> ·{' '}
              {lang === 'en' ? 'Church:' : 'Kościół:'}{' '}
              <span className="font-mono text-purple-300">{Math.round(currentPlayer.influence.churchSupport)}</span> ·{' '}
              {lang === 'en' ? 'Media:' : 'Media:'}{' '}
              <span className="font-mono text-sky-300">{Math.round(currentPlayer.influence.mediaControl)}</span> ·{' '}
              {lang === 'en' ? 'Military Power:' : 'Siła Militar.:'}{' '}
              <span className="font-mono text-rose-300">{Math.round(currentPlayer.militaryPower)}</span>
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
        <div className="px-4 py-2 grid grid-cols-3 gap-2 bg-[#0e1420] border-b border-[#243044]">
          <div className="p-2 rounded bg-[#151c28] border border-[#243044] text-xs">
            <div className="text-slate-400">
              {lang === 'en' ? 'Financial Influence' : 'Wpływy Finansowe'}
            </div>
            <div className="font-mono text-base font-bold text-amber-300">
              {Math.round(currentPlayer.influence.financial)} {lang === 'en' ? 'pts' : 'pkt'}
            </div>
          </div>
          <div className="p-2 rounded bg-[#151c28] border border-[#243044] text-xs">
            <div className="text-slate-400">
              {lang === 'en' ? 'Military Influence' : 'Wpływy Militarne'}
            </div>
            <div className="font-mono text-base font-bold text-rose-400">
              {Math.round(currentPlayer.influence.military)} {lang === 'en' ? 'pts' : 'pkt'}
            </div>
          </div>
          <div className="p-2 rounded bg-[#151c28] border border-[#243044] text-xs">
            <div className="text-slate-400">
              {lang === 'en' ? 'Social Influence' : 'Wpływy Społeczne'}
            </div>
            <div className="font-mono text-base font-bold text-purple-300">
              {Math.round(currentPlayer.influence.social)} {lang === 'en' ? 'pts' : 'pkt'}
            </div>
          </div>
        </div>

        {/* Zakładki filarów */}
        <div className="px-4 py-2 border-b border-[#243044] flex gap-2 overflow-x-auto no-scrollbar">
          {pillarTabs.map((tTab) => (
            <button
              key={tTab.key}
              type="button"
              onClick={() => setPillar(tTab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 border ${
                pillar === tTab.key
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
              }`}
            >
              {tTab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs text-slate-300">
            {pillarTabs.find((tTab) => tTab.key === pillar)?.desc}
          </div>

          {/* Karta Rządu i Wyborów */}
          {pillar === 'financial' && (() => {
            const currentGov = gameState.government?.currentGov ?? 'free_market';
            const locCurrGov = localizeGovernment(GOVERNMENT_CONFIGS[currentGov], lang);

            return (
              <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-amber-500/35 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-amber-300 text-sm">
                      {GOVERNMENT_CONFIGS[currentGov].badge}{' '}
                      {lang === 'en' ? 'Active Cabinet:' : 'Aktualny Rząd:'} {locCurrGov.name}
                    </div>
                    <div className="text-[11px] text-slate-400">{locCurrGov.summary}</div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-300 shrink-0">
                    <div>
                      {lang === 'en' ? 'Election in:' : 'Wybory za:'}{' '}
                      <span className="text-sky-300 font-bold">
                        {Math.max(0, (gameState.government?.nextElectionTick ?? 90) - gameState.time.tick)}T
                      </span>
                    </div>
                  </div>
                </div>

                {onLobbyElection && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {(['free_market', 'ecological', 'interventionist'] as GovernmentKind[]).map((gk) => {
                      const rawGcfg = GOVERNMENT_CONFIGS[gk];
                      const gcfg = localizeGovernment(rawGcfg, lang);
                      const isCurrent = currentGov === gk;
                      return (
                        <div
                          key={gk}
                          className={`p-2 rounded-lg border ${
                            isCurrent
                              ? 'bg-amber-500/15 border-amber-400/60'
                              : 'bg-[#131b2b] border-[#243044]'
                          }`}
                        >
                          <div className="font-semibold text-slate-100 flex items-center justify-between gap-1">
                            <span>
                              {rawGcfg.badge} {gcfg.name}
                            </span>
                            <span className="font-mono text-[10px] text-amber-300">
                              {lang === 'en' ? 'Votes:' : 'Głosy:'} {gameState.government?.lobbyVotes?.[gk] ?? 1}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{gcfg.summary}</div>
                          <div className="flex gap-1.5 mt-2">
                            <button
                              type="button"
                              disabled={currentPlayer.cash < 220_000}
                              onClick={() => onLobbyElection(gk, false)}
                              className="flex-1 py-1 px-1.5 rounded bg-amber-500/20 hover:bg-amber-500/35 disabled:opacity-40 border border-amber-400/40 text-amber-200 text-[10px] font-semibold"
                            >
                              {isCurrent
                                ? lang === 'en'
                                  ? `Bolster (${formatCompactMoney(220_000)})`
                                  : `Umocnij (${formatCompactMoney(220_000)})`
                                : lang === 'en'
                                  ? `Lobby (${formatCompactMoney(220_000)})`
                                  : `Lobbuj (${formatCompactMoney(220_000)})`}
                            </button>
                            <button
                              type="button"
                              disabled={currentPlayer.influence.financial + currentPlayer.influence.social < 18}
                              onClick={() => onLobbyElection(gk, true)}
                              className="flex-1 py-1 px-1.5 rounded bg-sky-500/20 hover:bg-sky-500/35 disabled:opacity-40 border border-sky-400/40 text-sky-200 text-[10px] font-semibold"
                            >
                              {lang === 'en' ? 'Influence (18 pts)' : 'Wpływ (18 pkt)'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── ZAKŁADKA KOALICJE & DYPLOMACJA ── */}
          {pillar === 'diplomacy' && (
            <div className="space-y-4 text-xs">
              {/* Zaproszenia do koalicji i NAP */}
              {(pendingInvites.length > 0 || pendingNaps.length > 0) && (
                <div className="space-y-2">
                  {pendingInvites.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-lg bg-sky-950/35 border border-sky-400/50 flex items-center justify-between gap-2"
                    >
                      <span>
                        {lang === 'en' ? '🤝 Coalition invite:' : '🤝 Zaproszenie do koalicji'}{' '}
                        <strong>[{inv.tag}] {inv.name}</strong> ({inv.memberIds.length}/{maxCoalMembers}{' '}
                        {lang === 'en' ? 'members' : 'członków'})
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onRespondCoalitionInvite?.(inv.id, true)}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold"
                        >
                          {lang === 'en' ? 'Accept' : 'Akceptuj'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRespondCoalitionInvite?.(inv.id, false)}
                          className="px-2.5 py-1 rounded bg-slate-700 text-slate-200"
                        >
                          {lang === 'en' ? 'Decline' : 'Odrzuć'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingNaps.map((nap) => {
                    const sender = gameState.players.find((p) => p.id === nap.playerAId);
                    return (
                      <div
                        key={nap.id}
                        className="p-3 rounded-lg bg-emerald-950/35 border border-emerald-400/50 flex items-center justify-between gap-2"
                      >
                        <span>
                          🕊️ <strong>{sender?.companyName}</strong>{' '}
                          {lang === 'en'
                            ? 'proposes an 80-tick Non-Aggression Pact (NAP)'
                            : 'proponuje 80-turowy Pakt o Nieagresji (NAP)'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAcceptNAP?.(nap.id)}
                          className="px-3 py-1 rounded bg-emerald-600 text-white font-semibold"
                        >
                          {lang === 'en' ? 'Sign Pact' : 'Podpisz Pakt'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Moja Koalicja lub Kreator */}
              {myCoalition ? (
                <div className="p-4 rounded-xl bg-[#0b0f17] border border-sky-500/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: myCoalition.color }} />
                        [{myCoalition.tag}] {myCoalition.name}
                      </div>
                      <div className="text-slate-400">
                        {lang === 'en' ? 'Members:' : 'Członkowie:'} {myCoalition.memberIds.length} / {maxCoalMembers} ·{' '}
                        {lang === 'en' ? '0% toll on allied highways' : '0% myta na autostradach sojuszu'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {myCoalition.leaderId === currentPlayer.id && (
                        <button
                          type="button"
                          onClick={() => onToggleCoalitionGeology?.()}
                          className={`px-2.5 py-1.5 rounded border font-semibold ${
                            myCoalition.shareGeology
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                              : 'bg-slate-800 border-slate-600 text-slate-300'
                          }`}
                        >
                          {myCoalition.shareGeology
                            ? lang === 'en'
                              ? '🔎 Geology Maps: Shared'
                              : '🔎 Mapy Złóż: Wspólne'
                            : lang === 'en'
                              ? '🔎 Geology Maps: Private'
                              : '🔎 Mapy Złóż: Prywatne'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onLeaveCoalition?.()}
                        className="px-2.5 py-1.5 rounded bg-rose-950/50 border border-rose-500/40 text-rose-300"
                      >
                        {lang === 'en' ? 'Leave coalition' : 'Wystąp z koalicji'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {myCoalition.memberIds.map((mId) => {
                      const mem = gameState.players.find((p) => p.id === mId);
                      if (!mem) return null;
                      return (
                        <div
                          key={mId}
                          className="px-2.5 py-1.5 rounded-lg bg-[#151c28] border border-[#243044] flex items-center gap-2"
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: mem.color }} />
                          <span className="font-semibold text-slate-100">{mem.companyName}</span>
                          {mId === myCoalition.leaderId && (
                            <span className="text-[10px] text-amber-300 font-bold">
                              {lang === 'en' ? 'LEADER' : 'LIDER'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] space-y-3">
                  <div className="font-bold text-slate-100 text-sm">
                    {lang === 'en'
                      ? `Found a Strategic Coalition (Max ${maxCoalMembers} corps)`
                      : `Załóż Nową Koalicję Strategiczną (Maks. ${maxCoalMembers} firmy)`}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={coalName}
                      onChange={(e) => setCoalName(e.target.value)}
                      placeholder={lang === 'en' ? 'Coalition name' : 'Nazwa koalicji'}
                      className="sm:col-span-2 px-3 py-2 rounded-lg bg-[#151c28] border border-[#2d3b52] text-slate-100"
                    />
                    <input
                      type="text"
                      maxLength={5}
                      value={coalTag}
                      onChange={(e) => setCoalTag(e.target.value.toUpperCase())}
                      placeholder={lang === 'en' ? 'TAG (e.g. PACT)' : 'TAG (np. PAKT)'}
                      className="px-3 py-2 rounded-lg bg-[#151c28] border border-[#2d3b52] text-slate-100 font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => onCreateCoalition?.(coalName, coalTag, coalColor)}
                      className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold"
                    >
                      {lang === 'en' ? '🤝 Create' : '🤝 Utwórz'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">
                      {lang === 'en' ? 'Alliance color:' : 'Barwa sojuszu:'}
                    </span>
                    {PLAYER_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCoalColor(c)}
                        className={`w-5 h-5 rounded-full border ${
                          coalColor === c ? 'border-white scale-110' : 'border-transparent opacity-65'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Relacje z każdym konkurentem */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-300 uppercase">
                  {lang === 'en' ? 'Bilateral Relations with Competitors' : 'Relacje Dwustronne z Konkurentami'}
                </div>
                {rivals.map((r) => {
                  const allied = arePlayersAllied(gameState, currentPlayer.id, r.id);
                  const nap = hasActiveNAP(gameState, currentPlayer.id, r.id);
                  const embargo = hasActiveEmbargo(gameState, currentPlayer.id, r.id);
                  return (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                        <div>
                          <div className="font-semibold text-slate-100">
                            {r.companyName} ({r.name})
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {allied
                              ? lang === 'en'
                                ? '🤝 Coalition Ally'
                                : '🤝 Sojusznik w koalicji'
                              : embargo
                                ? lang === 'en'
                                  ? '🚫 Active Embargo (trade & transit blocked)'
                                  : '🚫 Aktywne Embargo (brak handlu i tranzytu)'
                                : nap
                                  ? lang === 'en'
                                    ? '🕊️ Non-Aggression Pact (NAP)'
                                    : '🕊️ Pakt o Nieagresji (NAP)'
                                  : lang === 'en'
                                    ? 'Neutral relations'
                                    : 'Neutralne stosunki'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {myCoalition && myCoalition.leaderId === currentPlayer.id && !r.coalitionId && (
                          <button
                            type="button"
                            onClick={() => onInviteCoalition?.(r.id)}
                            className="px-2.5 py-1 rounded bg-sky-600/25 hover:bg-sky-600/45 border border-sky-400/50 text-sky-200 font-semibold"
                          >
                            {lang === 'en' ? '+ Invite to Coalition' : '+ Zaproś do Koalicji'}
                          </button>
                        )}
                        {!allied && !nap && !embargo && (
                          <button
                            type="button"
                            onClick={() => onProposeNAP?.(r.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600/25 hover:bg-emerald-600/45 border border-emerald-400/50 text-emerald-200 font-semibold"
                          >
                            {lang === 'en' ? '🕊️ NAP Treaty' : '🕊️ Pakt NAP'}
                          </button>
                        )}
                        {!allied && !embargo && (
                          <button
                            type="button"
                            onClick={() => onImposeEmbargo?.(r.id)}
                            className="px-2.5 py-1 rounded bg-rose-600/25 hover:bg-rose-600/45 border border-rose-400/50 text-rose-200 font-semibold"
                          >
                            🚫 {lang === 'en' ? 'Embargo' : 'Embargo'} ({formatCompactMoney(120_000)})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ARSENAŁ STRATEGICZNY & TAJNY PROGRAM JĄDROWY W FILARZE MILITARNYM ── */}
          {pillar === 'military' && (
            <div className="space-y-3">
              {detectedNuclearRivals.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-xs text-rose-100">
                  🕵️ <strong>{lang === 'en' ? 'INTEL ALERT:' : 'ALERT WYWIADOWCZY:'}</strong>{' '}
                  {lang === 'en'
                    ? 'Your Intelligence Centers detected covert nuclear buildup at:'
                    : 'Twoje Centra Wywiadu wykryły tajne zbrojenia jądrowe u:'}{' '}
                  <strong>{detectedNuclearRivals.map((d) => d.companyName).join(', ')}</strong>!
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Taktyczna Bateria Rakietowa 3x3 */}
                <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-rose-500/35 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-rose-200 text-sm">
                      {lang === 'en' ? '🚀 Tactical Missile Battery (3×3)' : '🚀 Bateria Rakiet Taktycznych (3×3)'}
                    </h4>
                    <span className="font-mono text-amber-300 font-bold">{formatCompactMoney(1_800_000)}</span>
                  </div>
                  <p className="text-slate-400">
                    {lang === 'en'
                      ? 'Destroys structures and roads in a 3×3 radius, leaving plants in ruins. Requires a PMC Base with Flagship upgrade.'
                      : 'Niszczy obiekty i drogi w obszarze 3×3 zamieniając zakłady w ruiny. Wymaga Bazy PMC z ulepszeniem Flagowym.'}
                  </p>
                  <button
                    type="button"
                    disabled={!hasMissileBase || missileCooldown > 0 || currentPlayer.cash < 1_800_000}
                    onClick={() => {
                      onClose();
                      onStartMissileTarget?.();
                    }}
                    className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold"
                  >
                    {!hasMissileBase
                      ? lang === 'en'
                        ? '🔒 Requires PMC Base + Flagship module'
                        : '🔒 Wymaga Bazy PMC + moduł Flagowy'
                      : missileCooldown > 0
                        ? lang === 'en'
                          ? `Reloading launcher (${missileCooldown}T)`
                          : `Ładowanie wyrzutni (${missileCooldown}T)`
                        : lang === 'en'
                          ? '🎯 Pick 3×3 Target on Map'
                          : '🎯 Wybierz Cel 3×3 na Mapie'}
                  </button>
                </div>

                {/* Tajny Program Jądrowy (ukryty aż do odkrycia!) */}
                {currentPlayer.secretNuclearRevealed && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-lime-950/40 to-[#0b0f17] border border-lime-400/60 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-lime-300 text-sm">
                        {lang === 'en' ? '☢️ Secret Nuclear Program (5×5)' : '☢️ Tajny Program Jądrowy (5×5)'}
                      </h4>
                      <span className="font-mono text-lime-200 font-bold">
                        {lang === 'en' ? 'Warheads:' : 'Głowice:'} {currentPlayer.nuclearWarheadsReady ?? 0}
                      </span>
                    </div>
                    <p className="text-slate-300">
                      {lang === 'en'
                        ? `Levels a 5×5 area and leaves an uninhabitable fallout zone for 180 ticks. Assembly: ${formatCompactMoney(8_500_000)} + 25 kg Uranium.`
                        : `Zrównuje z ziemią obszar 5×5 i pozostawia nieużywalną strefę skażenia na 180 tur. Montaż: ${formatCompactMoney(8_500_000)} + 25 kg Uranu.`}
                    </p>
                    {currentPlayer.nuclearProjectActive ? (
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[11px] text-lime-300">
                          <span>
                            {lang === 'en' ? 'Warhead assembly in progress...' : 'Składanie głowicy w toku...'}
                          </span>
                          <span>{Math.round(currentPlayer.nuclearProjectProgress ?? 0)}%</span>
                        </div>
                        <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-lime-400"
                            style={{ width: `${currentPlayer.nuclearProjectProgress ?? 0}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onStartNuclearProject?.()}
                          className="flex-1 py-2 rounded-lg bg-lime-700 hover:bg-lime-600 text-white font-bold"
                        >
                          🔧 {lang === 'en' ? 'Assemble Warhead' : 'Zbuduj Głowicę'} ({formatCompactMoney(8_500_000)} + 25U)
                        </button>
                        {(currentPlayer.nuclearWarheadsReady ?? 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onStartNuclearStrikeTarget?.();
                            }}
                            className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse"
                          >
                            {lang === 'en' ? '☢️ Launch Strike (5×5)' : '☢️ Odpal na Mapę (5×5)'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selektor celu (konkurent, działka, budynek) dla filarów politycznych */}
          {pillar !== 'diplomacy' && rivals.length > 0 && (
            <div className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">
                  {lang === 'en' ? 'Operation Target (Rival):' : 'Cel Operacji (Rywal):'}
                </label>
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
                <label className="block text-slate-400 mb-1">
                  {lang === 'en' ? 'Plot (for Buyout):' : 'Działka (dla Wykupu):'}
                </label>
                <select
                  value={targetPlotId}
                  onChange={(e) => setTargetPlotId(e.target.value)}
                  className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100"
                >
                  {targetPlots.length === 0 ? (
                    <option value="">{lang === 'en' ? 'No rival plots' : 'Brak działek rywala'}</option>
                  ) : (
                    targetPlots.map((p) => {
                      const vis =
                        !p.building ||
                        isPlotBuildingVisibleToViewer(p, currentPlayer.id, currentPlayer, gameState);
                      const bTitle =
                        p.building && vis
                          ? lang === 'en'
                            ? BUILDINGS_EN[p.building.type]?.name ?? p.building.name
                            : p.building.name
                          : null;
                      return (
                        <option key={p.id} value={p.id}>
                          ({p.gridX},{p.gridY}){' '}
                          {p.building
                            ? vis
                              ? `· ${bTitle}`
                              : lang === 'en'
                                ? '· 🌫️ Unknown Facility'
                                : '· 🌫️ Obiekt Nieznany'
                            : lang === 'en'
                              ? '· Unbuilt Land'
                              : '· Wolny grunt'}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  {lang === 'en' ? 'Structure (Sabotage / Raid):' : 'Obiekt (Sabotaż / Abordaż):'}
                </label>
                <select
                  value={targetBuildingId}
                  onChange={(e) => setTargetBuildingId(e.target.value)}
                  className="w-full bg-[#151c28] border border-[#2d3b52] rounded px-2 py-1.5 text-slate-100"
                >
                  {targetBuildings.length === 0 ? (
                    <option value="">{lang === 'en' ? 'No rival structures' : 'Brak budynków rywala'}</option>
                  ) : (
                    targetBuildings.map((p) => {
                      const vis = isPlotBuildingVisibleToViewer(
                        p,
                        currentPlayer.id,
                        currentPlayer,
                        gameState
                      );
                      const bTitle = vis
                        ? lang === 'en'
                          ? BUILDINGS_EN[p.building!.type]?.name ?? p.building!.name
                          : p.building!.name
                        : '';
                      return (
                        <option key={p.building!.id} value={p.building!.id}>
                          {vis
                            ? `${p.building!.icon} ${bTitle}`
                            : lang === 'en'
                              ? '🌫️ Unknown Facility'
                              : '🌫️ Obiekt Nieznany'}{' '}
                          ({p.gridX},{p.gridY})
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            </div>
          )}

          {/* Karty akcji */}
          {pillar !== 'diplomacy' && (
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
                        <span>
                          {lang === 'en' ? 'Required influence:' : 'Wymagane wpływy:'} {act.requiredScore}{' '}
                          {lang === 'en' ? 'pts' : 'pkt'}
                        </span>
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
                          ? lang === 'en'
                            ? `Cooldown (${cd}T)`
                            : `Odnowienie (${cd}T)`
                          : missingTech
                            ? lang === 'en'
                              ? '🔒 Requires Military Tech'
                              : '🔒 Wymaga technologii militarnej'
                            : lowScore
                              ? lang === 'en'
                                ? `🔒 Low influence (${act.requiredScore} pts)`
                                : `🔒 Za niskie wpływy (${act.requiredScore} pkt)`
                              : missingTarget
                                ? lang === 'en'
                                  ? 'Select target above'
                                  : 'Wybierz cel powyżej'
                                : lang === 'en'
                                  ? 'Execute Operation'
                                  : 'Uruchom Operację'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
