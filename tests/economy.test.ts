import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../src/sim/engine';
import { gameReducer } from '../src/sim/reducer';
import { SeededRNG } from '../src/sim/rng';
import { ACTIONS } from '../src/data/actions';
import { vi, afterEach } from 'vitest';
import type { GameState } from '../src/sim/types';

afterEach(() => vi.useRealTimers());

const T0 = 1_700_000_000_000;

/**
 * Advances `seconds` of simulated time in 0.1s ticks starting at T0+fromSec.
 * Ticking (rather than jumping the clock and ticking once) keeps these tests valid
 * after Task 15 moves timers onto simulated time.
 */
function advance(s: GameState, rng: SeededRNG, fromSec: number, seconds: number): GameState {
  const steps = Math.round(seconds / 0.1);
  for (let i = 1; i <= steps; i++) {
    vi.setSystemTime(T0 + (fromSec + i * 0.1) * 1000);
    s = tickSimulation(s, rng, 0.1);
  }
  return s;
}

describe('cost model', () => {
  it('lets a cost-saving action reduce recurring costs', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    const rng = new SeededRNG('econ');
    let s = createInitialState('econ');
    s = advance(s, rng, 0, 1);
    const before = s.costs;

    const saver = ACTIONS.find(a => a.recurringCostDelta < 0 && a.target === 'global')!;
    expect(saver).toBeDefined();
    s = { ...s, cash: 100_000 };
    s = gameReducer(s, { type: 'EXECUTE_ACTION', actionId: saver.id, rng });
    s = advance(s, rng, 1, saver.durationSeconds + 2);

    expect(s.recurringCostAdjustment).toBeLessThan(0);
    expect(s.costs).toBeLessThan(before);
  });

  it('charges blueprint ongoing cost after deployment', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    const rng = new SeededRNG('econ2');
    let s = createInitialState('econ2');
    s = { ...s, users: 5_000, cash: 100_000 };
    s = advance(s, rng, 0, 1);
    const before = s.costs;
    s = gameReducer(s, { type: 'DEPLOY_COMPONENT', componentId: 'cache' });
    s = advance(s, rng, 1, 40); // cache deployDurationSec is 20
    expect(s.deployedComponents.has('cache')).toBe(true);
    expect(s.costs).toBeGreaterThan(before);
  });
});
