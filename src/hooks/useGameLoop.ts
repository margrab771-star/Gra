import { useEffect, useRef } from 'react';
import { GAME_CONFIG } from '../config/gameConfig';
import type { GamePhase, GameSpeed } from '../engine/types';

export function useGameLoop(
  phase: GamePhase,
  speed: GameSpeed,
  isAuthoritative: boolean,
  onSimulationTick: () => void,
  onSecondElapsed: () => void
) {
  const tickRef = useRef(onSimulationTick);
  const secRef = useRef(onSecondElapsed);

  useEffect(() => {
    tickRef.current = onSimulationTick;
    secRef.current = onSecondElapsed;
  }, [onSimulationTick, onSecondElapsed]);

  // Główny timer symulacji zależny od prędkości gry (1x, 2x, 5x, 10x)
  useEffect(() => {
    if (phase !== 'Playing' || speed === 0 || !isAuthoritative) return;
    const intervalMs = Math.max(95, Math.round(GAME_CONFIG.tickIntervalMs / speed));
    const id = window.setInterval(() => {
      tickRef.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [phase, speed, isAuthoritative]);

  // Zegar rzeczywisty dla trybu Wyzwanie 1h / MP Tryb Przyspieszony (~1h)
  useEffect(() => {
    if (phase !== 'Playing' || speed === 0 || !isAuthoritative) return;
    const id = window.setInterval(() => {
      secRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [phase, speed, isAuthoritative]);
}
