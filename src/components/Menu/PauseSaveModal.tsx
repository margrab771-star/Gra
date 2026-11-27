import React, { useEffect } from 'react';
import type { SaveSlotId, SaveSlotMeta } from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';
import { formatCompactMoney, formatTimeRemaining } from '../../utils/formatters';
import { LanguageSwitcher } from '../HUD/LanguageSwitcher';

interface PauseSaveModalProps {
  saveSlots: SaveSlotMeta[];
  isMultiplayer: boolean;
  onSaveToSlot: (slotId: SaveSlotId) => void;
  onLoadFromSlot: (slotId: SaveSlotId) => void;
  onExitToMenu: () => void;
  onClose: () => void;
}

export const PauseSaveModal: React.FC<PauseSaveModalProps> = ({
  saveSlots,
  isMultiplayer,
  onSaveToSlot,
  onLoadFromSlot,
  onExitToMenu,
  onClose,
}) => {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const SLOTS: { id: SaveSlotId; title: string; subtitle: string }[] = [
    { id: 'autosave', title: t('pause.slotAuto'), subtitle: t('pause.slotAutoSub') },
    { id: 'slot1', title: t('pause.slot1'), subtitle: t('pause.slot1Sub') },
    { id: 'slot2', title: t('pause.slot2'), subtitle: t('pause.slot2Sub') },
    { id: 'slot3', title: t('pause.slot3'), subtitle: t('pause.slot3Sub') },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-[#243044] shadow-2xl overflow-hidden animate-scaleIn">
        <div className="px-4 py-3 border-b border-[#243044] bg-[#0b0f17] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-100">{t('pause.title')}</h2>
            <p className="text-xs text-slate-400">{t('pause.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {/* Przełącznik języka w trakcie gry */}
          <div className="p-2.5 rounded-lg bg-[#0b0f17] border border-[#243044] flex items-center justify-between gap-2">
            <span className="text-slate-200 font-semibold">{t('pause.langLabel')}</span>
            <LanguageSwitcher />
          </div>

          {isMultiplayer ? (
            <div className="p-3 rounded-lg bg-sky-950/35 border border-sky-500/40 text-sky-200">
              {t('pause.mpNotice')}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSaveToSlot('slot1')}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
            >
              {t('pause.saveNow')}
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
                          {t('common.save')}
                        </button>
                      )}
                      {meta && (
                        <button
                          type="button"
                          onClick={() => onLoadFromSlot(slot.id)}
                          className="px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 font-semibold"
                        >
                          {t('common.load')}
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
              {t('pause.exitToMenu')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#1c2434] hover:bg-[#253147] text-slate-200 font-semibold"
            >
              {t('pause.resumeGame')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
