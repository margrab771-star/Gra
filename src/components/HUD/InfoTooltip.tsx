import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface InfoTooltipProps {
  title?: string;
  description?: string;
  bullets?: string[];
  pros?: string[];
  cons?: string[];
  ariaLabel?: string;
}

interface TooltipPopupProps extends InfoTooltipProps {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onCancelClose: () => void;
  onScheduleClose: () => void;
}

const TooltipPopup: React.FC<TooltipPopupProps> = ({
  triggerRef,
  title,
  description,
  bullets,
  pros,
  cons,
  onCancelClose,
  onScheduleClose,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number; ready: boolean }>({
    left: 0,
    top: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    const tr = triggerRef.current?.getBoundingClientRect();
    const pr = popupRef.current?.getBoundingClientRect();
    if (!tr || !pr) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 10;

    let left = tr.left + tr.width / 2 - pr.width / 2;
    left = Math.max(margin, Math.min(vw - pr.width - margin, left));

    let top = tr.top - pr.height - 8;
    if (top < margin) {
      top = tr.bottom + 8;
    }
    if (top + pr.height > vh - margin) {
      top = Math.max(margin, vh - pr.height - margin);
    }

    setCoords({ left, top, ready: true });
  }, [triggerRef, title, description, bullets, pros, cons]);

  return (
    <div
      ref={popupRef}
      role="tooltip"
      onMouseEnter={onCancelClose}
      onMouseLeave={onScheduleClose}
      style={{
        position: 'fixed',
        left: `${coords.left}px`,
        top: `${coords.top}px`,
        visibility: coords.ready ? 'visible' : 'hidden',
      }}
      className="z-[90] w-64 max-w-[calc(100vw-20px)] rounded-xl bg-[#0d1421] border border-[#2d3b52] p-2.5 shadow-2xl text-[11px] text-slate-200 leading-relaxed pointer-events-auto"
    >
      {title && <div className="font-bold text-sky-300 mb-1 text-[11px] leading-tight">{title}</div>}
      {description && <div className="text-slate-300">{description}</div>}

      {bullets && bullets.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-slate-300">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-1">
              <span className="text-sky-400 shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {pros && pros.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-emerald-300">
          {pros.map((p) => (
            <li key={p} className="flex items-start gap-1">
              <span className="font-bold shrink-0">+</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}

      {cons && cons.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-rose-300">
          {cons.map((c) => (
            <li key={c} className="flex items-start gap-1">
              <span className="font-bold shrink-0">−</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  description,
  bullets,
  pros,
  cons,
  ariaLabel = 'Więcej informacji',
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 110);
  };

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || wrapRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);

    document.addEventListener('pointerdown', onOutside);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className="inline-flex items-center align-middle"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          clearCloseTimer();
          setOpen((v) => !v);
        }}
        className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[12px] leading-none text-slate-400 hover:text-sky-400 focus:text-sky-400 focus:outline-none transition-colors cursor-help select-none"
      >
        ⓘ
      </button>

      {open && (
        <TooltipPopup
          triggerRef={triggerRef}
          title={title}
          description={description}
          bullets={bullets}
          pros={pros}
          cons={cons}
          onCancelClose={clearCloseTimer}
          onScheduleClose={handleMouseLeave}
        />
      )}
    </span>
  );
};
