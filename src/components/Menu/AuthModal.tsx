import React, { useEffect, useState } from 'react';
import { PROFILE_AVATARS } from '../../data/achievements';
import {
  importProfileTransferCode,
  loginAccount,
  registerAccount,
  switchToGuestAccount,
} from '../../engine/profileManager';
import { useI18n } from '../../i18n/useI18n';
import type { UserAccountProfile } from '../../engine/types';
import { LanguageSwitcher } from '../HUD/LanguageSwitcher';

interface AuthModalProps {
  currentProfile: UserAccountProfile;
  onAuthenticated: (profile: UserAccountProfile) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentProfile,
  onAuthenticated,
  onClose,
}) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'login' | 'register' | 'import'>('login');
  const [nick, setNick] = useState('');
  const [pin, setPin] = useState('');
  const [avatar, setAvatar] = useState(PROFILE_AVATARS[0]);
  const [transferCode, setTransferCode] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = loginAccount(nick, pin);
    if (!res.ok || !res.profile) {
      setError(res.error ?? t('auth.loginError'));
      return;
    }
    onAuthenticated(res.profile);
    onClose();
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = registerAccount(nick, pin, avatar);
    if (!res.ok || !res.profile) {
      setError(res.error ?? t('auth.registerError'));
      return;
    }
    onAuthenticated(res.profile);
    onClose();
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = importProfileTransferCode(transferCode);
    if (!res.ok || !res.profile) {
      setError(res.error ?? t('auth.importError'));
      return;
    }
    onAuthenticated(res.profile);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-[#243044] p-5 md:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#243044] pb-3 gap-2">
          <div>
            <h2 className="text-lg font-bold text-white">{t('auth.title')}</h2>
            <p className="text-[11px] text-slate-400">
              {t('auth.activeLine', { nick: currentProfile.nick, level: currentProfile.level })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#1c2434] text-slate-300 hover:text-white flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`py-2 rounded-lg font-semibold border ${
              tab === 'login'
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400'
            }`}
          >
            {t('auth.tabLogin')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`py-2 rounded-lg font-semibold border ${
              tab === 'register'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400'
            }`}
          >
            {t('auth.tabRegister')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('import');
              setError(null);
            }}
            className={`py-2 rounded-lg font-semibold border ${
              tab === 'import'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#0b0f17] border-[#243044] text-slate-400'
            }`}
          >
            {t('auth.tabImport')}
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/50 text-xs text-rose-200">
            ⚠️ {error}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">{t('auth.nickLabel')}</label>
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder={t('auth.nickPlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t('auth.pinLabel')}</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm"
            >
              {t('auth.loginSubmit')}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">{t('auth.nickLabel')}</label>
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder={t('auth.registerNickPlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">{t('auth.pinLabel')}</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={t('auth.pinPlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1.5">{t('auth.chooseAvatar')}</label>
              <div className="flex flex-wrap gap-1.5">
                {PROFILE_AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center ${
                      avatar === av
                        ? 'bg-emerald-500/25 border-emerald-400 scale-105'
                        : 'bg-[#0b0f17] border-[#243044] opacity-75 hover:opacity-100'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
            >
              {t('auth.createSubmit')}
            </button>
          </form>
        )}

        {tab === 'import' && (
          <form onSubmit={handleImport} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">{t('auth.transferLabel')}</label>
              <textarea
                rows={4}
                value={transferCode}
                onChange={(e) => setTransferCode(e.target.value)}
                placeholder={t('auth.transferPlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-amber-200 font-mono text-[11px]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm"
            >
              {t('auth.importSubmit')}
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-[#243044] space-y-2 text-xs">
          <button
            type="button"
            onClick={() => {
              const guest = switchToGuestAccount();
              onAuthenticated(guest);
              onClose();
            }}
            className="w-full py-1.5 rounded-lg bg-[#0b0f17] hover:bg-[#1a2438] border border-[#243044] text-slate-300"
          >
            👤 {t('auth.switchToGuest')}
          </button>
          <p className="text-[10px] text-slate-500 leading-snug">{t('auth.localNote')}</p>
        </div>
      </div>
    </div>
  );
};
