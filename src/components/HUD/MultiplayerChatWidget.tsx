import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Plot } from '../../engine/types';
import { BUILDINGS_EN } from '../../i18n/buildingsEn';
import { useI18n } from '../../i18n/useI18n';

interface MultiplayerChatWidgetProps {
  messages: ChatMessage[];
  selectedPlot: Plot | null;
  onSendMessage: (
    text: string,
    pingPlot?: { plotId: string; gridX: number; gridY: number; label: string }
  ) => void;
  onFocusPlot: (plotId: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideCollapsedToggle?: boolean;
}

export const MultiplayerChatWidget: React.FC<MultiplayerChatWidgetProps> = ({
  messages,
  selectedPlot,
  onSendMessage,
  onFocusPlot,
  isOpen: controlledOpen,
  onOpenChange,
  hideCollapsedToggle = false,
}) => {
  const { lang, t } = useI18n();
  const [internalOpen, setInternalOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [seenCount, setSeenCount] = useState(messages.length);
  const listRef = useRef<HTMLDivElement>(null);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    setSeenCount(messages.length);
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages.length]);

  const unreadCount = open ? 0 : Math.max(0, messages.length - seenCount);

  const handleSend = () => {
    const clean = draft.trim();
    if (!clean) return;
    onSendMessage(clean);
    setDraft('');
  };

  const handlePingSelected = () => {
    if (!selectedPlot) return;
    const bName = selectedPlot.building
      ? lang === 'en'
        ? BUILDINGS_EN[selectedPlot.building.type]?.name ?? selectedPlot.building.name
        : selectedPlot.building.name
      : null;
    const label = bName
      ? `${bName} (${selectedPlot.gridX},${selectedPlot.gridY})`
      : `${t('chat.plotLabel')} (${selectedPlot.gridX},${selectedPlot.gridY})`;
    onSendMessage(
      draft.trim() ||
        (lang === 'en'
          ? `Check this point on the map: ${label}`
          : `Sprawdź ten punkt na mapie: ${label}`),
      {
        plotId: selectedPlot.id,
        gridX: selectedPlot.gridX,
        gridY: selectedPlot.gridY,
        label,
      }
    );
    setDraft('');
  };

  if (!open) {
    if (hideCollapsedToggle) {
      return null;
    }
    return (
      <div className="fixed bottom-20 left-3 z-30">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative px-3 py-2 rounded-xl bg-[#0e1522]/95 border border-[#2d3b52] hover:border-sky-400 text-xs font-semibold text-slate-200 shadow-2xl flex items-center gap-2 backdrop-blur-md"
        >
          <span>{t('chat.toggleBtn')}</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-3 z-30 w-80 max-w-[calc(100vw-24px)] rounded-2xl bg-[#0b0f17]/95 border border-[#2d3b52] shadow-2xl backdrop-blur-md flex flex-col overflow-hidden">
      <div className="px-3 py-2 bg-[#111827] border-b border-[#243044] flex items-center justify-between text-xs">
        <span className="font-bold text-slate-100">{t('chat.title')}</span>
        <button
          type="button"
          onClick={() => {
            setSeenCount(messages.length);
            setOpen(false);
          }}
          className="text-slate-400 hover:text-white px-1.5"
        >
          —
        </button>
      </div>

      <div
        ref={listRef}
        className="h-48 overflow-y-auto p-2.5 space-y-2 text-xs bg-[#090d14]"
      >
        {messages.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-6">
            {t('chat.empty')}
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="p-2 rounded-lg bg-[#111827] border border-[#1e293b] space-y-1"
            >
              <div className="flex items-center justify-between gap-1 text-[10px]">
                <span className="font-bold truncate" style={{ color: m.color }}>
                  {m.companyName} ({m.senderName})
                </span>
                <span className="font-mono text-slate-500 shrink-0">#{m.tick}</span>
              </div>
              <div className="text-slate-200 break-words">{m.text}</div>
              {m.pingPlot && (
                <button
                  type="button"
                  onClick={() => onFocusPlot(m.pingPlot!.plotId)}
                  className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/40 text-sky-300 text-[10px] hover:bg-sky-900/60"
                >
                  {t('chat.goToPlot', { x: m.pingPlot.gridX, y: m.pingPlot.gridY })}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-2 bg-[#0b0f17] border-t border-[#243044] space-y-1.5">
        {selectedPlot && (
          <button
            type="button"
            onClick={handlePingSelected}
            className="w-full py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-200 text-[11px] font-semibold"
          >
            {t('chat.pingPlotBtn', { x: selectedPlot.gridX, y: selectedPlot.gridY })}
          </button>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder={t('chat.placeholder')}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#111827] border border-[#243044] text-xs text-slate-100"
          />
          <button
            type="button"
            onClick={handleSend}
            className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shrink-0"
          >
            {t('chat.sendBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
