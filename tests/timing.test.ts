import { describe, it, expect, vi, afterEach } from 'vitest';
import { createInitialState, tickSimulation } from '../src/sim/engine';
import { SeededRNG } from '../src/sim/rng';
import { GAME_CONFIG } from '../src/config/gameConfig';

afterEach(() => vi.useRealTimers());

describe('timing', () => {
  it('holds the reputation grace period for the configured number of seconds', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
    const rng = new SeededRNG('t');
    let s = createInitialState('t');
    s = { ...s, reputation: 0 };
    const grace = GAME_CONFIG.economy.reputationGameOverGracePeriod;
    const ticks = Math.floor((grace - 5) / 0.1); // 5 seconds short of the limit
    for (let i = 1; i <= ticks; i++) {
      vi.setSystemTime(1_700_000_000_000 + i * 100);
      s = tickSimulation(s, rng, 0.1);
      if (s.gameOver) break;
    }
    expect(s.gameOver).toBe(false);
  });

  it('sizes the uptime window to the configured number of seconds', () => {
    const s = createInitialState('u');
    expect(s.uptimeWindow.length)
      .toBe(Math.round(GAME_CONFIG.simulation.uptimeWindowSeconds / 0.1));
  });
});
