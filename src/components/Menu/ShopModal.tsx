import React, { useEffect, useState } from 'react';
import { SHOP_ITEMS, type ShopCategory } from '../../data/shopCatalog';
import { purchaseShopItem, updateProfileCosmetics } from '../../engine/profileManager';
import type { UserAccountProfile } from '../../engine/types';
import { MCoinIcon } from '../HUD/MCoinIcon';

interface ShopModalProps {
  profile: UserAccountProfile;
  onUpdateProfile: (profile: UserAccountProfile) => void;
  onClose: () => void;
}

const SHOP_TABS: { key: ShopCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'scenario', label: '🎬 Scenariusze' },
  { key: 'archetype', label: '🧬 Archetypy' },
  { key: 'theme', label: '🎨 Motywy UI' },
  { key: 'hq', label: '🏛️ Skórki HQ' },
  { key: 'frame', label: '💠 Ramki Anim.' },
  { key: 'monument', label: '🗽 Pomniki 2.5D' },
];

export const ShopModal: React.FC<ShopModalProps> = ({
  profile,
  onUpdateProfile,
  onClose,
}) => {
  const [category, setCategory] = useState<ShopCategory | 'all'>('all');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = SHOP_ITEMS.filter((it) => category === 'all' || it.category === category);

  const handleBuy = (itemId: string) => {
    const res = purchaseShopItem(profile, itemId);
    if (res.ok) {
      onUpdateProfile(res.profile);
      setFeedback({ ok: true, text: res.message ?? 'Zakup zrealizowany!' });
    } else {
      setFeedback({ ok: false, text: res.error ?? 'Nie udało się odblokować.' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111827] border border-amber-500/45 shadow-2xl flex flex-col">
        <div className="sticky top-0 z-20 px-5 py-4 bg-[#0b0f17]/95 backdrop-blur-md border-b border-[#243044] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <span>🏦 Sklep Prezesa</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono">
                ZERO PAY-TO-WIN
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Wydawaj Złote Monety „M” za rozegrane partie, osiągnięcia i zadania
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-400/50 flex items-center gap-2 font-mono font-bold text-amber-200 text-sm">
              <MCoinIcon size={18} />
              <span>{profile.mCoins} M</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#1c2434] hover:bg-[#2a364d] border border-[#2d3b52] text-xs font-semibold text-slate-200"
            >
              ✕ Zamknij
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/35 text-sky-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span>
              ⚖️ <strong>Uczciwy balans 0% P2W:</strong> kosmetyki i pomniki 2.5D nie dają żadnej przewagi liczbowej (pomniki działają 1:1 jak Park Miejski). Scenariusze Hosta działają dla wszystkich gości w pokoju!
            </span>
          </div>

          {feedback && (
            <div
              className={`p-2.5 rounded-xl border text-xs font-semibold ${
                feedback.ok
                  ? 'bg-emerald-950/40 border-emerald-400/50 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-400/50 text-rose-200'
              }`}
            >
              {feedback.ok ? '✅' : '⚠️'} {feedback.text}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {SHOP_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setCategory(t.key)}
                className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                  category === t.key
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-[#0b0f17] border-[#243044] text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => {
              const owned = item.unlockIdsGranted.every((id) =>
                profile.unlockedCosmetics.includes(id)
              );
              const isEquipped =
                (item.uiThemeId && profile.uiThemeId === item.uiThemeId) ||
                (item.hqVariantId && profile.hqVariant === item.hqVariantId) ||
                (item.frameId && profile.frameId === item.frameId);
              const canAfford = profile.mCoins >= item.priceMCoins;

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                    owned
                      ? 'bg-[#0b131e] border-emerald-500/45'
                      : 'bg-[#0b0f17] border-[#243044]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-2xl">{item.preview}</div>
                      {owned ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold">
                          ✓ POSIADANE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200 font-mono text-[11px] font-bold flex items-center gap-1">
                          <MCoinIcon size={13} />
                          {item.priceMCoins}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-slate-100 text-sm">{item.name}</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{item.description}</p>
                    <p className="text-[10px] text-sky-300/85">{item.zeroP2WNote}</p>
                  </div>

                  {owned ? (
                    item.uiThemeId || item.hqVariantId || item.frameId ? (
                      <button
                        type="button"
                        disabled={Boolean(isEquipped)}
                        onClick={() => {
                          const next = updateProfileCosmetics(profile, {
                            uiThemeId: item.uiThemeId,
                            hqVariant: item.hqVariantId,
                            frameId: item.frameId,
                          });
                          onUpdateProfile(next);
                          setFeedback({ ok: true, text: `Aktywowano: ${item.name}` });
                        }}
                        className={`w-full py-2 rounded-lg font-bold text-xs ${
                          isEquipped
                            ? 'bg-amber-500/20 border border-amber-400/50 text-amber-200'
                            : 'bg-sky-600 hover:bg-sky-500 text-white'
                        }`}
                      >
                        {isEquipped ? '✓ Aktywne w grze' : 'Aktywuj Teraz'}
                      </button>
                    ) : (
                      <div className="w-full py-2 text-center rounded-lg bg-emerald-950/35 border border-emerald-500/30 text-emerald-300 font-semibold text-xs">
                        ✓ Gotowe do użycia w Lobby/Grze
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => handleBuy(item.id)}
                      className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-[#1a2233] disabled:text-slate-500 disabled:border disabled:border-[#243044] text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MCoinIcon size={14} />
                      <span>
                        {canAfford ? `Odblokuj za ${item.priceMCoins} M` : `Brakuje ${item.priceMCoins - profile.mCoins} M`}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
