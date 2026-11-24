import React from 'react';
import type { GameState, Player } from '../../engine/types';
import { formatMoney } from '../../utils/formatters';

interface VictoryModalProps {
  gameState: GameState;
  currentPlayer: Player;
  onContinueEndless: () => void;
  onOpenLeaderboard: () => void;
  onExitToMenu: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  gameState,
  currentPlayer,
  onContinueEndless,
  onOpenLeaderboard,
  onExitToMenu,
}) => {
  const winner = gameState.winnerId
    ? gameState.players.find((p) => p.id === gameState.winnerId)
    : null;
  const isChallengeDone = gameState.challengeCompleted && !winner;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-amber-400/60 p-6 shadow-2xl space-y-5 text-center">
        <div className="text-3xl">{winner ? '👑' : '⏱️'}</div>
        <h2 className="text-xl md:text-2xl font-extrabold text-white">
          {winner
            ? winner.id === currentPlayer.id
              ? 'DOMINACJA RYNKOWA OSIĄGNIĘTA!'
              : `Koniec Partii — Zwycięzca: ${winner.companyName}`
            : 'Wyzwanie 1-Godzinne Zakończone!'}
        </h2>

        <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
          {gameState.victoryReason ??
            'Twój wynik wyceny netto oraz wypracowana strategia zostały zapisane w Światowej Tabeli Wyników!'}
        </p>

        <div className="p-4 rounded-xl bg-[#0b0f17] border border-[#243044] grid grid-cols-2 gap-3 text-left text-xs">
          <div>
            <div className="text-slate-400">Wycena Netto</div>
            <div className="font-mono text-base font-bold text-emerald-400">
              {formatMoney(currentPlayer.netWorth)}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Rozpoznana Strategia</div>
            <div className="font-semibold text-amber-300">{currentPlayer.dominantStrategy}</div>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onContinueEndless}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
          >
            {isChallengeDone
              ? '♾️ Kontynuuj Grę Bez Limitu (Endless)'
              : '♾️ Graj Dalej w Trybie Wolnym'}
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="py-2.5 rounded-xl bg-[#1a2438] border border-amber-500/40 text-amber-300 text-xs font-semibold"
            >
              🏆 Tabela Wyników
            </button>
            <button
              type="button"
              onClick={onExitToMenu}
              className="py-2.5 rounded-xl bg-[#1a2438] border border-[#243044] text-slate-300 text-xs font-semibold"
            >
              Menu Główne
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
