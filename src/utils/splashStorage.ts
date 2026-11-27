import { isHomeHashAtBoot } from './hashRouter';

/**
 * Animacja powitalna uruchamia się wyłącznie przy pełnym załadowaniu/odświeżeniu
 * strony głównej (#/ lub #/menu), bez zapisu w sessionStorage.
 */
export function shouldShowSplashIntro(): boolean {
  return typeof window !== 'undefined' && isHomeHashAtBoot();
}
