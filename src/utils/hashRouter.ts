import { normalizeRoomCode } from '../network/multiplayerManager';

export type MpTabSlug = 'create' | 'open' | 'join';
export type MpModeView = 'choose' | 'browse' | 'join';
export type ModalRouteKey =
  | 'shop'
  | 'battlepass'
  | 'leaderboard'
  | 'profile'
  | 'guide'
  | 'weekly';

export type ParsedHashRoute =
  | { screen: 'menu' }
  | { screen: 'singleplayer' }
  | {
      screen: 'multiplayer';
      mpTab: MpModeView;
      mpSlug: MpTabSlug;
      roomCode: string | null;
    }
  | { screen: 'modal'; modal: ModalRouteKey }
  | { screen: 'play' };

export function mpTabToSlug(tab: MpModeView): MpTabSlug {
  if (tab === 'browse') return 'open';
  if (tab === 'join') return 'join';
  return 'create';
}

export function mpSlugToTab(slug?: string): MpModeView {
  const s = (slug ?? '').toLowerCase();
  if (s === 'open') return 'browse';
  if (s === 'join') return 'join';
  return 'choose';
}

function extractRoomCode(rawHash: string, rawSearch: string): string | null {
  try {
    const searchRoom = new URLSearchParams(rawSearch).get('room');
    if (searchRoom) {
      const n = normalizeRoomCode(searchRoom);
      if (n) return n;
    }
    const qIdx = rawHash.indexOf('?');
    if (qIdx !== -1) {
      const hashRoom = new URLSearchParams(rawHash.slice(qIdx + 1)).get('room');
      if (hashRoom) {
        const n = normalizeRoomCode(hashRoom);
        if (n) return n;
      }
    }
  } catch {
    // ignoruj błędne query stringi
  }
  return null;
}

export function parseHashRoute(
  rawHash = typeof window !== 'undefined' ? window.location.hash : '',
  rawSearch = typeof window !== 'undefined' ? window.location.search : ''
): ParsedHashRoute {
  const roomCode = extractRoomCode(rawHash, rawSearch);
  const hashWithoutPrefix = rawHash.replace(/^#/, '');
  const pathOnly = hashWithoutPrefix.split('?')[0].replace(/^\/+|\/+$/g, '').toLowerCase();

  if (!pathOnly || pathOnly === 'menu') {
    if (roomCode) {
      return {
        screen: 'multiplayer',
        mpTab: 'join',
        mpSlug: 'join',
        roomCode,
      };
    }
    return { screen: 'menu' };
  }

  if (pathOnly === 'singleplayer') {
    return { screen: 'singleplayer' };
  }

  if (pathOnly === 'multiplayer' || pathOnly.startsWith('multiplayer/')) {
    const sub = pathOnly.split('/')[1];
    const mpTab = roomCode && !sub ? 'join' : mpSlugToTab(sub);
    return {
      screen: 'multiplayer',
      mpTab,
      mpSlug: mpTabToSlug(mpTab),
      roomCode,
    };
  }

  if (
    pathOnly === 'shop' ||
    pathOnly === 'battlepass' ||
    pathOnly === 'leaderboard' ||
    pathOnly === 'profile' ||
    pathOnly === 'guide' ||
    pathOnly === 'weekly'
  ) {
    return { screen: 'modal', modal: pathOnly };
  }

  if (pathOnly === 'play') {
    return { screen: 'play' };
  }

  return { screen: 'menu' };
}

export function isHomeHashAtBoot(
  rawHash = typeof window !== 'undefined' ? window.location.hash : '',
  rawSearch = typeof window !== 'undefined' ? window.location.search : ''
): boolean {
  if (extractRoomCode(rawHash, rawSearch)) return false;
  const trimmed = rawHash.trim().toLowerCase();
  return trimmed === '' || trimmed === '#' || trimmed === '#/' || trimmed === '#/menu';
}

export function buildHashForMultiplayer(
  tab: MpModeView,
  roomCode?: string | null
): string {
  const slug = mpTabToSlug(tab);
  if (tab === 'join' && roomCode) {
    const normalized = normalizeRoomCode(roomCode);
    if (normalized) {
      return `#/multiplayer/join?room=${encodeURIComponent(normalized)}`;
    }
  }
  return `#/multiplayer/${slug}`;
}

export function buildHashForModal(modal: ModalRouteKey): string {
  return `#/${modal}`;
}

export function navigateHash(
  targetHash: string,
  options?: { replace?: boolean }
): void {
  if (typeof window === 'undefined') return;
  const normalizedTarget = targetHash.startsWith('#') ? targetHash : `#${targetHash}`;
  if (window.location.hash === normalizedTarget) return;
  if (options?.replace) {
    const nextUrl = `${window.location.pathname}${window.location.search}${normalizedTarget}`;
    window.history.replaceState(null, '', nextUrl);
  } else {
    window.location.hash = normalizedTarget;
  }
}

export function normalizeInitialHashIfEmpty(): void {
  if (typeof window === 'undefined') return;
  const parsed = parseHashRoute(window.location.hash, window.location.search);
  const trimmed = window.location.hash.trim();
  if (parsed.screen === 'multiplayer' && parsed.roomCode && trimmed === '') {
    navigateHash(buildHashForMultiplayer('join', parsed.roomCode), { replace: true });
    return;
  }
  if (trimmed === '' || trimmed === '#' || trimmed === '#/') {
    navigateHash('#/menu', { replace: true });
  } else if (parsed.screen === 'play') {
    navigateHash('#/menu', { replace: true });
  }
}
