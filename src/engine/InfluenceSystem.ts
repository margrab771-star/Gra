import { INFLUENCE_ACTIONS } from '../data/influenceActions';
import { formatGameDate } from '../utils/formatters';
import { getPlayerEntrepreneurModifiers, getPlayerGlobalTechModifiers } from './EconomyEngine';
import { recalculateSpatialNetwork } from './PlotSystem';
import type { GameState, Player } from './types';

export function executeInfluenceAction(
  state: GameState,
  player: Player,
  actionId: string,
  targetPlayerId?: string,
  targetPlotId?: string,
  targetBuildingId?: string
): { ok: boolean; message: string } {
  const action = INFLUENCE_ACTIONS.find((a) => a.id === actionId);
  if (!action) return { ok: false, message: 'Nieznana operacja wpływu.' };

  const cd = player.actionCooldowns[actionId] ?? 0;
  if (cd > 0) return { ok: false, message: `Operacja w trakcie odnowienia (${cd} tur).` };

  if (action.requiredTech && player.globalTech[action.requiredTech]?.status !== 'done') {
    return { ok: false, message: 'Wymaga odblokowania odpowiedniej technologii w drzewku.' };
  }

  const pillarScore =
    action.pillar === 'financial'
      ? player.influence.financial
      : action.pillar === 'military'
        ? player.influence.military
        : player.influence.social;

  if (pillarScore < action.requiredScore) {
    return {
      ok: false,
      message: `Wymaga min. ${action.requiredScore} pkt w tym Filarze (masz ${Math.round(pillarScore)}).`,
    };
  }

  const entMods = getPlayerEntrepreneurModifiers(state, player);
  const stockStake = targetPlayerId
    ? state.stocks?.find((s) => s.companyId === targetPlayerId)?.holdings[player.id] ?? 0
    : 0;
  const majorityHostileDiscount = stockStake >= 50 ? 0.45 : 0;
  const effectiveCost =
    action.id === 'forced_buyout' || action.id === 'corporate_raid'
      ? Math.round(action.cost * Math.max(0.2, 1 - entMods.buyoutDiscount - majorityHostileDiscount))
      : action.cost;

  if (player.cash < effectiveCost) {
    return {
      ok: false,
      message: `Brak środków (${effectiveCost.toLocaleString('pl-PL')} zł).`,
    };
  }

  const powerMult = 1 + entMods.influencePowerBonus;
  const targetPlayer = targetPlayerId ? state.players.find((p) => p.id === targetPlayerId) : undefined;
  const techMods = getPlayerGlobalTechModifiers(state, player);

  switch (actionId) {
    case 'bribery': {
      player.cash -= effectiveCost;
      player.influence.financial += Math.round(12 * powerMult);
      player.actionCooldowns['env_shield'] = 10;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Urzędnicy przyjęli argumenty finansowe — 10 tur ochrony przed karami.' };
    }

    case 'lobbying': {
      player.cash -= effectiveCost;
      player.influence.financial += Math.round(15 * powerMult);
      player.activeTaxReliefTicks = 20;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Lobbing zakończony sukcesem: -40% CIT przez 20 tur.' };
    }

    case 'buy_law': {
      player.cash -= effectiveCost;
      player.influence.financial += Math.round(25 * powerMult);
      if (!state.activeLaws.includes('corporate_deregulation')) {
        state.activeLaws.push('corporate_deregulation');
      }
      state.taxRate = Math.max(0.11, Number((state.taxRate - 0.02).toFixed(2)));
      player.actionCooldowns[actionId] = action.cooldownTicks;
      pushInfluenceNews(
        state,
        'Przełomowa ustawa deregulacyjna uchwalona przez parlament',
        `${player.companyName} przeforsowała korzystne regulacje obniżające podatek CIT w gospodarce.`
      );
      return { ok: true, message: 'Ustawa przeszła! CIT w gospodarce spadł o 2 p.p.' };
    }

    case 'forced_buyout': {
      if (!targetPlayer || !targetPlotId) {
        return { ok: false, message: 'Wybierz rywala oraz działkę do przymusowego wykupu.' };
      }
      const plot = state.plots.find((p) => p.id === targetPlotId && p.ownerId === targetPlayer.id);
      if (!plot) return { ok: false, message: 'Wybrana działka nie należy do wskazanego rywala.' };

      const statutoryCompensation = Math.round(plot.price * 0.65);
      const total = effectiveCost + statutoryCompensation;
      if (player.cash < total) {
        return {
          ok: false,
          message: `Łączny koszt przejęcia z odszkodowaniem to ${total.toLocaleString('pl-PL')} zł.`,
        };
      }
      player.cash -= total;
      targetPlayer.cash += statutoryCompensation;
      plot.ownerId = player.id;
      if (plot.building) {
        plot.building.ownerId = player.id;
      }
      recalculateSpatialNetwork(state.plots);
      player.actionCooldowns[actionId] = action.cooldownTicks;
      pushInfluenceNews(
        state,
        `PRZYMUSOWY WYKUP! ${player.companyName} przejmuje aktywa ${targetPlayer.companyName}`,
        `Na mocy nowej ustawy specinwestycyjnej działka (${plot.gridX},${plot.gridY}) zmieniła właściciela bez prawa weta.`
      );
      return { ok: true, message: `Przejęto działkę (${plot.gridX},${plot.gridY}) od ${targetPlayer.companyName}!` };
    }

    case 'espionage': {
      if (!targetPlayer) return { ok: false, message: 'Wybierz cel wywiadowczy.' };
      player.cash -= effectiveCost;
      player.spiedPlayers[targetPlayer.id] = 20;
      player.researchPoints += 15;
      player.influence.military += Math.round(14 * powerMult);
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return {
        ok: true,
        message: `Wywiad zinfiltrował ${targetPlayer.companyName} (+15 pkt badań, wgląd w finanse).`,
      };
    }

    case 'sabotage': {
      if (!targetPlayer || !targetBuildingId) {
        return { ok: false, message: 'Wybierz rywala i konkretny budynek do sabotażu.' };
      }
      const targetPlot = state.plots.find(
        (p) => p.ownerId === targetPlayer.id && p.building?.id === targetBuildingId
      );
      if (!targetPlot || !targetPlot.building) {
        return { ok: false, message: 'Nie znaleziono wskazanego budynku przeciwnika.' };
      }
      const enemySecurityDefense = state.plots
        .filter(
          (p) =>
            p.ownerId === targetPlayer.id &&
            p.building?.isActive &&
            (p.building.type === 'policeStation' || p.building.type === 'militaryBase')
        )
        .reduce((acc, p) => {
          const b = p.building!;
          const mod = b.techTree.reduce(
            (s, t) => s + (t.status === 'done' ? t.effects.espionageDefenseBonus ?? 0 : 0),
            0
          );
          return acc + 0.08 + mod;
        }, 0);
      const enemyDefense =
        getPlayerGlobalTechModifiers(state, targetPlayer).sabotageDefense +
        Math.min(0.45, enemySecurityDefense);
      const successChance = Math.max(0.2, Math.min(0.95, 0.72 + techMods.sabotageAttack - enemyDefense));

      player.cash -= effectiveCost;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      player.influence.military += Math.round(12 * powerMult);

      if (Math.random() <= successChance) {
        targetPlot.building.condition = Math.max(15, targetPlot.building.condition - 45);
        targetPlot.building.sabotagedTicks = 8;
        targetPlot.building.status.breakdown = true;
        pushInfluenceNews(
          state,
          `Awaria i podejrzenie sabotażu w zakładzie ${targetPlot.building.name}!`,
          `Obiekt należący do ${targetPlayer.companyName} stanął w miejscu na skutek tajemniczej usterki sieci sterującej.`
        );
        return { ok: true, message: `Sabotaż udany! ${targetPlot.building.name} wstrzymany na 8 tur.` };
      }
      return { ok: false, message: 'Kontrwywiad rywala udaremnił akcję dywersyjną.' };
    }

    case 'corporate_raid': {
      if (!targetPlayer || !targetBuildingId) {
        return { ok: false, message: 'Wybierz rywala oraz obiekt do abordażu.' };
      }
      const targetPlot = state.plots.find(
        (p) => p.ownerId === targetPlayer.id && p.building?.id === targetBuildingId
      );
      if (!targetPlot || !targetPlot.building) {
        return { ok: false, message: 'Nie znaleziono wskazanego obiektu przeciwnika.' };
      }
      player.cash -= effectiveCost;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      const milRatio = (player.militaryPower + 30) / Math.max(25, targetPlayer.militaryPower + 25);
      if (milRatio >= 0.9 || Math.random() < 0.75) {
        targetPlot.ownerId = player.id;
        targetPlot.building.ownerId = player.id;
        recalculateSpatialNetwork(state.plots);
        pushInfluenceNews(
          state,
          `KORPORACYJNY ABORDAŻ! ${player.companyName} siłowo przejmuje ${targetPlot.building.name}`,
          `Oddziały kondotierów i komorników korporacyjnych zajęły obiekt firmy ${targetPlayer.companyName}.`
        );
        return { ok: true, message: `Abordaż zakończony przejęciem ${targetPlot.building.name}!` };
      }
      return { ok: false, message: 'Ochrona obiektu odparła próbę korporacyjnego abordażu.' };
    }

    case 'coup_attempt': {
      player.cash -= effectiveCost;
      player.actionCooldowns[actionId] = action.cooldownTicks;
      if (player.militaryPower < 100 && player.influence.military < 95) {
        return { ok: false, message: 'Zbyt słabe zaplecze militarne na udany zamach stanu.' };
      }
      // Przejmij znaczącą część rynku / wyeliminuj najsilniejszego lub ogłoś dominację
      player.influence.financial += 120;
      player.influence.military += 120;
      player.influence.social += 80;
      state.taxRate = 0.08;
      // Wymuś przejęcie 2 budynków konkurentów
      let seized = 0;
      for (const p of state.plots) {
        if (p.ownerId && p.ownerId !== player.id && p.building) {
          p.ownerId = player.id;
          p.building.ownerId = player.id;
          seized++;
          if (seized >= 3) break;
        }
      }
      recalculateSpatialNetwork(state.plots);
      pushInfluenceNews(
        state,
        `ZAMACH STANU! Konsorcjum ${player.companyName} przejmuje władzę w państwie!`,
        `Siły korporacyjne obaliły dotychczasowy gabinet. Przejęto strategiczne aktywa konkurencji i narzucono nowy ład podatkowy.`
      );
      return { ok: true, message: `Zamach stanu udany! Przejęto ${seized} strategiczne zakłady i obcięto CIT do 8%!` };
    }

    case 'church_donation': {
      player.cash -= effectiveCost;
      player.influence.churchSupport = Math.min(100, player.influence.churchSupport + Math.round(20 * powerMult));
      player.influence.social += Math.round(15 * powerMult);
      state.voterMood = Math.min(100, state.voterMood + 8);
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Sojusz z duchowieństwem umocniony — rośnie poparcie społeczne!' };
    }

    case 'media_campaign': {
      player.cash -= effectiveCost;
      player.influence.mediaControl = Math.min(100, player.influence.mediaControl + Math.round(20 * powerMult));
      player.influence.social += Math.round(18 * powerMult);
      player.reputation = Math.min(100, player.reputation + 10);
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Narracja medialna przechylona na korzyść Twojego imperium.' };
    }

    case 'voter_mobilization': {
      player.cash -= effectiveCost;
      player.influence.social += Math.round(25 * powerMult);
      player.influence.voterApproval = Math.min(100, player.influence.voterApproval + 18);
      if (!state.activeLaws.includes('lower_zus')) {
        state.activeLaws.push('lower_zus');
      }
      player.actionCooldowns[actionId] = action.cooldownTicks;
      return { ok: true, message: 'Wyborcy wymusili na rządzie obniżkę składek ZUS o 10%!' };
    }

    case 'organize_boycott': {
      if (!targetPlayer) return { ok: false, message: 'Wybierz konkurenta do objęcia bojkotem.' };
      player.cash -= effectiveCost;
      player.influence.social += Math.round(12 * powerMult);
      player.actionCooldowns[actionId] = action.cooldownTicks;
      let hitCount = 0;
      for (const p of state.plots) {
        if (p.ownerId === targetPlayer.id && p.building) {
          p.building.boycottedTicks = 12;
          hitCount++;
        }
      }
      pushInfluenceNews(
        state,
        `Masowy bojkot konsumencki uderza w ${targetPlayer.companyName}!`,
        `Organizacje społeczne i media wzywają do unikania usług i towarów koncernu (${hitCount} obiektów objętych presją).`
      );
      return { ok: true, message: `Bojkot ogłoszony! Przychody ${targetPlayer.companyName} spadają o 35% na 12 tur.` };
    }

    default:
      return { ok: false, message: 'Nieobsługiwana operacja.' };
  }
}

function pushInfluenceNews(state: GameState, headline: string, body: string): void {
  state.news = [
    {
      id: `inf_news_${state.time.tick}_${Math.random().toString(36).slice(2, 6)}`,
      headline,
      brief: body,
      fullText: body,
      analysis: 'Działanie z obszaru trzech filarów wpływów zmienia układ sił rynkowych.',
      hints: ['Monitoruj wskaźniki wpływów innych graczy w panelu Wpływy.'],
      type: 'neutral' as const,
      dateLabel: formatGameDate(state.time),
      tick: state.time.tick,
      read: false,
    },
    ...state.news,
  ].slice(0, 40);
}
