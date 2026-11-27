import React, { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ title, onClose, children }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useI18n();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-[#111827] border-t border-[#2d3b52] rounded-t-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.65)] transition-all duration-200"
         style={{ maxHeight: expanded ? '88vh' : '58vh' }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between border-b border-[#243044] cursor-pointer select-none shrink-0"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="w-8 h-1 rounded-full bg-slate-600 inline-block" />
          <h3 className="text-sm font-semibold text-slate-100 truncate max-w-[220px]">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="px-2 py-1 text-xs rounded bg-[#1a2232] text-slate-300"
          >
            {expanded ? t('bs.collapse') : t('bs.expand')}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-7 h-7 rounded bg-[#1c2434] text-slate-300 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-3.5">{children}</div>
    </div>
  );
};
