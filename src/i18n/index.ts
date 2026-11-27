import { en } from './en';
import { pl, type TranslationKey } from './pl';

export type Language = 'pl' | 'en';
export type { TranslationKey };

const LANGUAGE_STORAGE_KEY = 'md_language';
const DICTS: Record<Language, Record<TranslationKey, string>> = { pl, en };
const listeners = new Set<() => void>();

export function detectInitialLanguage(): Language {
  try {
    const saved =
      typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
    if (saved === 'pl' || saved === 'en') return saved;
    const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
    if (!nav) return 'pl';
    return nav.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  } catch {
    return 'pl';
  }
}

let currentLanguage: Language = detectInitialLanguage();

function syncHtmlLang(lang: Language): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

syncHtmlLang(currentLanguage);

export function getCurrentLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(next: Language): void {
  if (next === currentLanguage) return;
  currentLanguage = next;
  syncHtmlLang(next);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    }
  } catch {
    // ignoruj brak localStorage
  }
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>,
  overrideLang?: Language
): string {
  const lang = overrideLang ?? currentLanguage;
  const template = DICTS[lang][key] ?? DICTS.pl[key] ?? String(key);
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}
