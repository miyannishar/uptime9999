import { describe, it, expect, vi, afterEach } from 'vitest';
import { createInitialState, tickSimulation } from '../src/sim/engine';
import { SeededRNG } from '../src/sim/rng';

afterEach(() => vi.useRealTimers());

describe('engine is headless-importable', () => {
  it('creates initial state with the documented starting values', () => {
    const s = createInitialState('smoke');
    expect(s.users).toBe(200);
    expect(s.cash).toBe(5000);
    expect(s.reputation).toBe(80);
    expect(s.architecture.nodes.size).toBe(3);
    expect([...s.deployedComponents].sort()).toEqual(['app', 'db_primary', 'dns']);
  });

  it('advances one tick without touching window or the network', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
    const s0 = createInitialState('smoke');
    vi.setSystemTime(1_700_000_000_100);
    const s1 = tickSimulation(s0, new SeededRNG('smoke'), 0.1);
    expect(s1).not.toBe(s0);
    expect(Number.isFinite(s1.rps)).toBe(true);
    expect(Number.isFinite(s1.cash)).toBe(true);
  });
});
