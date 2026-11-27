const SPLASH_SESSION_KEY = 'md_splash_seen';

export function shouldShowSplashIntro(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(SPLASH_SESSION_KEY);
  } catch {
    return false;
  }
}

export function markSplashIntroSeen(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
    }
  } catch {
    // ignoruj brak sessionStorage
  }
}
