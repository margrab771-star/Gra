import { useCallback, useSyncExternalStore } from 'react';
import {
  getCurrentLanguage,
  setLanguage,
  subscribeLanguage,
  translate,
  type Language,
  type TranslationKey,
} from './index';

export function useI18n(): {
  lang: Language;
  setLang: (next: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
} {
  const lang = useSyncExternalStore(
    subscribeLanguage,
    getCurrentLanguage,
    getCurrentLanguage
  );

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(key, params, lang),
    [lang]
  );

  return { lang, setLang: setLanguage, t };
}
