import React, { useState } from 'react';
import { PROFILE_AVATARS } from '../../data/achievements';
import {
  importProfileTransferCode,
  loginAccount,
  registerAccount,
  switchToGuestAccount,
} from '../../engine/profileManager';
import type { UserAccountProfile } from '../../engine/types';

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
  const [tab, setTab] = useState<'login' | 'register' | 'import'>('login');
  const [nick, setNick] = useState('');
  const [pin, setPin] = useState('');
  const [avatar, setAvatar] = useState(PROFILE_AVATARS[0]);
  const [transferCode, setTransferCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = loginAccount(nick, pin);
    if (!res.ok || !res.profile) {
      setError(res.error ?? 'Błąd logowania.');
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
      setError(res.error ?? 'Błąd rejestracji.');
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
      setError(res.error ?? 'Nieprawidłowy kod przenoszenia profilu.');
      return;
    }
    onAuthenticated(res.profile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-[#243044] p-5 md:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#243044] pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">Konto Prezesa & Logowanie</h2>
            <p className="text-[11px] text-slate-400">
              Aktywny: <span className="text-amber-300 font-semibold">{currentProfile.nick}</span> (Poz. {currentProfile.level})
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
            Logowanie
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
            Nowe Konto
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
            Kod Profilu
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
              <label className="block text-slate-400 mb-1">Pseudonim (Nick)</label>
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="Wpisz swój nick"
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Hasło / PIN</label>
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
              🔑 Zaloguj się
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Twój Pseudonim (2–24 znaki)</label>
              <input
                type="text"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="np. WilkParkietu"
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Kod PIN / Hasło (min. 3 znaki)</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="min. 3 znaki"
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1.5">Wybierz Avatar Prezesa</label>
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
              ✨ Załóż Konto i Zapisz Postępy
            </button>
          </form>
        )}

        {tab === 'import' && (
          <form onSubmit={handleImport} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">
                Wklej Kod Przenoszenia Profilu (JSON/Base64 z innego urządzenia)
              </label>
              <textarea
                rows={4}
                value={transferCode}
                onChange={(e) => setTransferCode(e.target.value)}
                placeholder="MDPROF1:eyJpZCI6..."
                className="w-full px-3 py-2 rounded-lg bg-[#0b0f17] border border-[#243044] text-amber-200 font-mono text-[11px]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm"
            >
              📥 Importuj Konto i Odznaki
            </button>
          </form>
        )}

        <div className="pt-2 border-t border-[#243044] flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              const guest = switchToGuestAccount();
              onAuthenticated(guest);
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg bg-[#0b0f17] hover:bg-[#1a2438] border border-[#243044] text-slate-300"
          >
            👤 Graj jako Gość
          </button>
          <span className="text-[10px] text-slate-500">Dane zapisane lokalnie + gotowe pod eksport</span>
        </div>
      </div>
    </div>
  );
};
