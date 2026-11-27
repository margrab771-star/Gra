import { getCurrentLanguage } from '../i18n';
import { formatGameDate, formatMoney } from '../utils/formatters';
import type { Coalition, GameState, NonAggressionPact, Player } from './types';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function addDiplomacyNews(
  state: GameState,
  headline: string,
  brief: string,
  type: 'positive' | 'negative' | 'neutral'
): void {
  state.news.unshift({
    id: uid('news'),
    headline,
    brief,
    fullText: brief,
    analysis: 'Relacje dyplomatyczne i sojusze wpływają na myta autostradowe, kontrakty B2B i ochronę przed atakami.',
    hints: ['Sprawdź szczegóły paktów i koalicji w panelu Wpływy i Dyplomacja.'],
    type,
    dateLabel: formatGameDate(state.time),
    tick: state.time.tick,
    read: false,
  });
  if (state.news.length > 40) state.news.pop();
}

export function getPlayerCoalition(state: GameState, playerId: string): Coalition | undefined {
  const coalitions = state.coalitions ?? [];
  return coalitions.find((c) => c.memberIds.includes(playerId));
}

export function arePlayersAllied(state: GameState, playerAId: string | null, playerBId: string | null): boolean {
  if (!playerAId || !playerBId) return false;
  if (playerAId === playerBId) return true;
  const colA = getPlayerCoalition(state, playerAId);
  if (!colA) return false;
  return colA.memberIds.includes(playerBId);
}

export function getMaxCoalitionMembers(state: GameState): number {
  const activeCount = Math.max(2, state.players.filter((p) => !p.isEliminated).length);
  return Math.max(2, Math.min(4, Math.floor(activeCount / 2)));
}

export function hasActiveNAP(state: GameState, playerAId: string, playerBId: string): boolean {
  if (playerAId === playerBId) return true;
  if (arePlayersAllied(state, playerAId, playerBId)) return true;
  const naps = state.naps ?? [];
  return naps.some(
    (n) =>
      n.status === 'active' &&
      n.expiresTick >= state.time.tick &&
      ((n.playerAId === playerAId && n.playerBId === playerBId) ||
        (n.playerAId === playerBId && n.playerBId === playerAId))
  );
}

export function hasActiveEmbargo(state: GameState, playerAId: string, playerBId: string): boolean {
  if (playerAId === playerBId) return false;
  const embargoes = state.embargoes ?? [];
  return embargoes.some(
    (e) =>
      e.expiresTick >= state.time.tick &&
      ((e.issuerId === playerAId && e.targetId === playerBId) ||
        (e.issuerId === playerBId && e.targetId === playerAId))
  );
}

export function createCoalitionForPlayer(
  state: GameState,
  player: Player,
  name: string,
  tag: string,
  color: string
): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  if (player.isEliminated) {
    return {
      ok: false,
      error: en ? 'An eliminated player cannot form a coalition.' : 'Zbankrutowany gracz nie może tworzyć koalicji.',
    };
  }
  if (getPlayerCoalition(state, player.id)) {
    return {
      ok: false,
      error: en
        ? 'You already belong to a coalition. Leave it first.'
        : 'Należysz już do koalicji. Najpierw z niej wystąp.',
    };
  }
  if ((player.leftCoalitionCooldown ?? 0) > 0) {
    return {
      ok: false,
      error: en
        ? `Diplomatic cooldown: wait ${player.leftCoalitionCooldown} more ticks after leaving your previous coalition.`
        : `Karencja dyplomatyczna: odczekaj jeszcze ${player.leftCoalitionCooldown} tur po opuszczeniu poprzedniej koalicji.`,
    };
  }
  const cleanName = name.trim().slice(0, 28);
  const cleanTag = tag.trim().toUpperCase().slice(0, 5) || 'KLC';
  if (cleanName.length < 3) {
    return {
      ok: false,
      error: en
        ? 'Coalition name must be at least 3 characters long.'
        : 'Nazwa koalicji musi mieć co najmniej 3 znaki.',
    };
  }

  state.coalitions = state.coalitions ?? [];
  const coalition: Coalition = {
    id: uid('coal'),
    name: cleanName,
    tag: cleanTag,
    color: color || player.color,
    leaderId: player.id,
    memberIds: [player.id],
    invitedPlayerIds: [],
    shareGeology: true,
    createdTick: state.time.tick,
  };
  state.coalitions.push(coalition);
  player.coalitionId = coalition.id;
  state.networkRevision = (state.networkRevision ?? 0) + 1;

  addDiplomacyNews(
    state,
    `🤝 Powstała koalicja [${coalition.tag}] ${coalition.name}`,
    `${player.companyName} zawiązał nowy blok strategiczny. Członkowie korzystają z darmowych autostrad, wspólnej ochrony przed rakietami oraz (opcjonalnie) wspólnych map geologicznych.`,
    'neutral'
  );

  return { ok: true };
}

export function inviteToCoalitionForPlayer(
  state: GameState,
  player: Player,
  targetPlayerId: string
): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  const coalition = getPlayerCoalition(state, player.id);
  if (!coalition) {
    return {
      ok: false,
      error: en ? 'You do not belong to any coalition.' : 'Nie należysz do żadnej koalicji.',
    };
  }
  if (coalition.leaderId !== player.id) {
    return {
      ok: false,
      error: en
        ? 'Only the coalition leader can invite new members.'
        : 'Tylko lider koalicji może zapraszać nowych członków.',
    };
  }
  const maxMembers = getMaxCoalitionMembers(state);
  if (coalition.memberIds.length >= maxMembers) {
    return {
      ok: false,
      error: en
        ? `Coalition reached the cap of ${maxMembers} members for this player count.`
        : `Koalicja osiągnęła maksymalny limit ${maxMembers} członków dla tej liczby graczy.`,
    };
  }
  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!target || target.isEliminated) {
    return { ok: false, error: en ? 'Selected player is unavailable.' : 'Wybrany gracz jest niedostępny.' };
  }
  if (getPlayerCoalition(state, targetPlayerId)) {
    return {
      ok: false,
      error: en ? 'That player already belongs to a coalition.' : 'Ten gracz należy już do koalicji.',
    };
  }
  if ((target.leftCoalitionCooldown ?? 0) > 0) {
    return {
      ok: false,
      error: en
        ? `${target.companyName} is still on diplomatic cooldown.`
        : `${target.companyName} odbywa jeszcze karencję dyplomatyczną.`,
    };
  }
  if (coalition.invitedPlayerIds.includes(targetPlayerId)) {
    return {
      ok: false,
      error: en ? 'An invitation has already been sent to this player.' : 'Zaproszenie do tego gracza zostało już wysłane.',
    };
  }
  coalition.invitedPlayerIds.push(targetPlayerId);

  // AI auto-decision when invited by human
  if (target.isAI) {
    const acceptAI = target.netWorth <= player.netWorth * 1.4 && (target.leftCoalitionCooldown ?? 0) === 0;
    respondToCoalitionInvite(state, target, coalition.id, acceptAI);
  }
  return { ok: true };
}

export function respondToCoalitionInvite(
  state: GameState,
  player: Player,
  coalitionId: string,
  accept: boolean
): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  const coalitions = state.coalitions ?? [];
  const coalition = coalitions.find((c) => c.id === coalitionId);
  if (!coalition) {
    return { ok: false, error: en ? 'Coalition no longer exists.' : 'Koalicja już nie istnieje.' };
  }

  coalition.invitedPlayerIds = coalition.invitedPlayerIds.filter((id) => id !== player.id);
  if (!accept) return { ok: true };

  if (getPlayerCoalition(state, player.id)) {
    return {
      ok: false,
      error: en ? 'You already belong to another coalition.' : 'Należysz już do innej koalicji.',
    };
  }
  const maxMembers = getMaxCoalitionMembers(state);
  if (coalition.memberIds.length >= maxMembers) {
    return {
      ok: false,
      error: en ? `Coalition reached the ${maxMembers}-member limit.` : `Koalicja osiągnęła limit ${maxMembers} członków.`,
    };
  }

  coalition.memberIds.push(player.id);
  player.coalitionId = coalition.id;
  state.networkRevision = (state.networkRevision ?? 0) + 1;

  addDiplomacyNews(
    state,
    `🤝 ${player.companyName} dołącza do [${coalition.tag}] ${coalition.name}`,
    `Sojusz liczy teraz ${coalition.memberIds.length} korporacji i współdzieli korytarze transportowe bez opłat drogowych.`,
    'positive'
  );

  return { ok: true };
}

export function leaveCoalitionForPlayer(state: GameState, player: Player): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  const coalitions = state.coalitions ?? [];
  const coalition = coalitions.find((c) => c.memberIds.includes(player.id));
  if (!coalition) {
    return {
      ok: false,
      error: en ? 'You do not belong to any coalition.' : 'Nie należysz do żadnej koalicji.',
    };
  }

  coalition.memberIds = coalition.memberIds.filter((id) => id !== player.id);
  player.coalitionId = null;
  player.leftCoalitionCooldown = 25;
  state.networkRevision = (state.networkRevision ?? 0) + 1;

  if (coalition.memberIds.length === 0) {
    state.coalitions = coalitions.filter((c) => c.id !== coalition.id);
  } else if (coalition.leaderId === player.id) {
    coalition.leaderId = coalition.memberIds[0];
  }

  addDiplomacyNews(
    state,
    `💔 ${player.companyName} opuszcza koalicję [${coalition.tag}]`,
    `Były sojusznik utracił dostęp do darmowych autostrad koalicji i objęto go 25-turową karencją dyplomatyczną.`,
    'neutral'
  );

  return { ok: true };
}

export function toggleCoalitionGeology(state: GameState, player: Player): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  const coalition = getPlayerCoalition(state, player.id);
  if (!coalition) {
    return {
      ok: false,
      error: en ? 'You do not belong to any coalition.' : 'Nie należysz do żadnej koalicji.',
    };
  }
  if (coalition.leaderId !== player.id) {
    return {
      ok: false,
      error: en
        ? 'Only the coalition leader can toggle shared geology.'
        : 'Tylko lider koalicji może zmienić współdzielenie geologii.',
    };
  }
  coalition.shareGeology = !coalition.shareGeology;
  return { ok: true };
}

export function proposeNAPForPlayer(
  state: GameState,
  player: Player,
  targetPlayerId: string
): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  if (player.id === targetPlayerId) {
    return {
      ok: false,
      error: en ? 'You cannot sign a pact with yourself.' : 'Nie można zawrzeć paktu z samym sobą.',
    };
  }
  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!target || target.isEliminated) {
    return { ok: false, error: en ? 'Target does not exist.' : 'Cel nie istnieje.' };
  }
  if (hasActiveNAP(state, player.id, targetPlayerId)) {
    return {
      ok: false,
      error: en ? 'An active non-aggression pact is already in force.' : 'Aktywny pakt o nieagresji już obowiązuje.',
    };
  }
  if (hasActiveEmbargo(state, player.id, targetPlayerId)) {
    return {
      ok: false,
      error: en
        ? 'Mutual trade embargoes must expire first.'
        : 'Najpierw musi wygasnąć wzajemne embargo handlowe.',
    };
  }

  state.naps = state.naps ?? [];
  const existing = state.naps.find(
    (n) =>
      n.status === 'proposed' &&
      n.playerAId === player.id &&
      n.playerBId === targetPlayerId
  );
  if (existing) {
    return {
      ok: false,
      error: en ? 'A pact proposal is already pending decision.' : 'Propozycja paktu oczekuje już na decyzję.',
    };
  }

  const nap: NonAggressionPact = {
    id: uid('nap'),
    playerAId: player.id,
    playerBId: targetPlayerId,
    status: target.isAI ? 'active' : 'proposed',
    expiresTick: state.time.tick + 80,
  };
  state.naps.push(nap);

  addDiplomacyNews(
    state,
    target.isAI
      ? `🕊️ Pakt o Nieagresji: ${player.companyName} ↔ ${target.companyName}`
      : `🕊️ Propozycja Paktu o Nieagresji dla ${target.companyName}`,
    `${player.companyName} ${target.isAI ? 'zawarł 80-turowy Pakt o Nieagresji z' : 'zaproponował Pakt o Nieagresji firmie'} ${target.companyName} (blokada sabotaży, przejęć i rakiet).`,
    'neutral'
  );

  return { ok: true };
}

export function acceptNAPForPlayer(state: GameState, player: Player, napId: string): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  const naps = state.naps ?? [];
  const nap = naps.find((n) => n.id === napId);
  if (!nap) return { ok: false, error: en ? 'Pact proposal not found.' : 'Propozycja paktu nie istnieje.' };
  if (nap.playerBId !== player.id) {
    return {
      ok: false,
      error: en ? 'You cannot accept another player’s proposal.' : 'Nie możesz zaakceptować cudzej propozycji.',
    };
  }

  nap.status = 'active';
  nap.expiresTick = state.time.tick + 80;
  return { ok: true };
}

export function imposeEmbargoForPlayer(
  state: GameState,
  player: Player,
  targetPlayerId: string
): { ok: boolean; error?: string } {
  const en = getCurrentLanguage() === 'en';
  if (player.id === targetPlayerId) {
    return {
      ok: false,
      error: en ? 'You cannot embargo yourself.' : 'Nie możesz nałożyć embarga na siebie.',
    };
  }
  const target = state.players.find((p) => p.id === targetPlayerId);
  if (!target || target.isEliminated) {
    return { ok: false, error: en ? 'Selected company is inactive.' : 'Wybrana firma jest nieaktywna.' };
  }
  if (arePlayersAllied(state, player.id, targetPlayerId)) {
    return {
      ok: false,
      error: en
        ? 'You cannot embargo a member of your own coalition.'
        : 'Nie możesz nałożyć embarga na członka własnej koalicji.',
    };
  }
  const cost = 120_000;
  if (player.cash < cost) {
    return {
      ok: false,
      error: en
        ? `Trade embargo and customs sanctions cost ${formatMoney(cost)}.`
        : `Nałożenie embarga i sankcji celnych kosztuje ${formatMoney(cost)}.`,
    };
  }
  player.cash -= cost;

  state.embargoes = (state.embargoes ?? []).filter(
    (e) => !(e.issuerId === player.id && e.targetId === targetPlayerId)
  );
  state.embargoes.push({
    issuerId: player.id,
    targetId: targetPlayerId,
    expiresTick: state.time.tick + 50,
  });

  // Zerwij aktywne pakt o nieagresji między nimi
  state.naps = (state.naps ?? []).filter(
    (n) =>
      !(
        (n.playerAId === player.id && n.playerBId === targetPlayerId) ||
        (n.playerAId === targetPlayerId && n.playerBId === player.id)
      )
  );
  state.networkRevision = (state.networkRevision ?? 0) + 1;

  addDiplomacyNews(
    state,
    `🚫 Embargo handlowe: ${player.companyName} vs ${target.companyName}`,
    `Wstrzymano rozliczenia B2B i nałożono blokadę tranzytu na okres 50 tur.`,
    'negative'
  );

  return { ok: true };
}

export function processDiplomacyExpiryTick(state: GameState): void {
  for (const p of state.players) {
    if ((p.leftCoalitionCooldown ?? 0) > 0) {
      p.leftCoalitionCooldown = (p.leftCoalitionCooldown ?? 0) - 1;
    }
  }
  if (state.naps && state.naps.length > 0) {
    state.naps = state.naps.filter((n) => n.expiresTick >= state.time.tick);
  }
  if (state.embargoes && state.embargoes.length > 0) {
    const before = state.embargoes.length;
    state.embargoes = state.embargoes.filter((e) => e.expiresTick >= state.time.tick);
    if (state.embargoes.length !== before) {
      state.networkRevision = (state.networkRevision ?? 0) + 1;
    }
  }
}

export function getCoalitionCombinedNetWorth(state: GameState, coalition: Coalition): number {
  let sum = 0;
  for (const id of coalition.memberIds) {
    const member = state.players.find((p) => p.id === id && !p.isEliminated);
    if (member) sum += Math.max(0, member.netWorth);
  }
  return sum;
}
