import React from 'react';
import type { DisconnectAlert } from '../../engine/types';
import { useI18n } from '../../i18n/useI18n';

interface DisconnectModalProps {
  alert: DisconnectAlert;
  isHost: boolean;
  onPause: () => void;
  onTakeoverByAI: (playerId: string) => void;
  onDismiss: () => void;
}

export const DisconnectModal: React.FC<DisconnectModalProps> = ({
  alert,
  isHost,
  onPause,
  onTakeoverByAI,
  onDismiss,
}) => {
  const { lang, t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-rose-500/50 p-5 shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
          <span>⚠️ {t('disc.title')}</span>
        </div>
        <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
          {lang === 'en' ? (
            <>
              Player <strong>{alert.playerName}</strong> ({alert.companyName}) lost WebRTC connection to the room.
            </>
          ) : (
            <>
              Gracz <strong>{alert.playerName}</strong> ({alert.companyName}) utracił połączenie WebRTC z pokojem.
            </>
          )}
        </p>

        {isHost ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onTakeoverByAI(alert.playerId)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs md:text-sm"
            >
              {t('disc.aiTakeover')}
            </button>
            <button
              type="button"
              onClick={onPause}
              className="w-full py-2.5 rounded-xl bg-[#1a2438] hover:bg-[#22304a] border border-sky-500/40 text-sky-300 font-semibold text-xs md:text-sm"
            >
              {t('disc.pauseGame')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl bg-[#1a2438] text-slate-200 font-semibold text-xs"
          >
            {t('disc.backToGame')}
          </button>
        )}
      </div>
    </div>
  );
};
