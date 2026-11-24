import React from 'react';
import type { SaveSlotId, SaveSlotMeta } from '../../engine/types';
import { formatCompactMoney, formatTimeRemaining } from '../../utils/formatters';

interface PauseSaveModalProps {
  saveSlots: SaveSlotMeta[];
  isMultiplayer: boolean;
  onSaveToSlot: (slotId: SaveSlotId) => void;
  onLoadFromSlot: (slotId: SaveSlotId) => void;
  onExitToMenu: () => void;
  onClose: () => void;
}

const SLOTS: { id: SaveSlotId; title: string; subtitle: string }[] = [
  { id: 'autosave', title: 'Autozapis', subtitle: 'Aktualizowany automatycznie co 15 s i po akcjach' },
  { id: 'slot1', title: 'Slot 1 (Ręczny)', subtitle: 'Trwały zapis kampanii' },
  { id: 'slot2', title: 'Slot 2 (Ręczny)', subtitle: 'Punkt kontrolny przed większą inwestycją' },
  { id: 'slot3', title: 'Slot 3 (Ręczny)', subtitle: 'Rezerwowy zapis strategiczny' },
];

export const PauseSaveModal: React.FC<PauseSaveModalProps> = ({
  saveSlots,
  isMultiplayer,
  onSaveToSlot,
  onLoadFromSlot,
  onExitToMenu,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden animate-scaleIn">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100">
              💾 Zapis, Sloty i Menu Rozgrywki
            </h2>
            <p className="text-xs text-slate-400">
              Stan gry jest przechowywany bezpiecznie lokalnie w Twojej przeglądarce
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

        <div className="p-4 space-y-3 text-xs">
          {isMultiplayer ? (
            <div className="p-3 rounded-lg bg-sky-950/35 border border-sky-500/40 text-sky-200">
              🌐 W trybie Multiplayer stan jest synchronizowany na żywo przez Hosta pokoju. Ręczne sloty działają w kampaniach Single Player.
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSaveToSlot('slot1')}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
            >
              💾 Zapisz Teraz (Slot 1)
            </button>
          )}

          {!isMultiplayer && (
            <div className="space-y-2">
              {SLOTS.map((slot) => {
                const meta = saveSlots.find((m) => m.slotId === slot.id);
                return (
                  <div
                    key={slot.id}
                    className="p-3 rounded-lg bg-[#0b0f17] border border-[#243044] flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100">{slot.title}</div>
                      {meta ? (
                        <div className="text-[11px] text-slate-400">
                          {meta.companyName} · {meta.gameDateLabel} ·{' '}
                          <span className="text-amber-300 font-mono">
                            {formatCompactMoney(meta.netWorth)}
                          </span>
                          {meta.challengeTimeRemaining > 0 &&
                            ` · ${formatTimeRemaining(meta.challengeTimeRemaining)}`}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500">{slot.subtitle}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {slot.id !== 'autosave' && (
                        <button
                          type="button"
                          onClick={() => onSaveToSlot(slot.id)}
                          className="px-2.5 py-1.5 rounded bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/40 text-sky-200 font-semibold"
                        >
                          Zapisz
                        </button>
                      )}
                      {meta && (
                        <button
                          type="button"
                          onClick={() => onLoadFromSlot(slot.id)}
                          className="px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 font-semibold"
                        >
                          Wczytaj
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-[#243044] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onExitToMenu}
              className="px-3.5 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 font-semibold"
            >
              🚪 Wyjdź do Menu Głównego
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#1c2434] hover:bg-[#253147] text-slate-200 font-semibold"
            >
              Wróć do gry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
