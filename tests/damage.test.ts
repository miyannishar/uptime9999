import { describe, it, expect, vi, afterEach } from 'vitest';
import { createInitialState, tickSimulation } from '../src/sim/engine';
import { SeededRNG } from '../src/sim/rng';
import { GAME_CONFIG } from '../src/config/gameConfig';
import type { ActiveIncident } from '../src/sim/types';

afterEach(() => vi.useRealTimers());

// Injects a template-style incident directly into state (no reducer needed)
function withIncident(s: ReturnType<typeof createInitialState>): ReturnType<typeof createInitialState> {
  const inc: ActiveIncident = {
    id: 'test_leak', definitionId: 'memory_leak', targetNodeId: 'app',
    severity: 'CRIT', startTime: Date.now(), startSim: s.elapsedSim,
    escalationTimer: 0, outagetimer: 0, mitigationLevel: 0, mitigationProgress: 0,
    aiGenerated: true, aiIncidentName: 'Memory leak',
    aiEffects: { healthDecayPerSec: 0.02, errorMultiplier: 2 },
  };
  return { ...s, activeIncidents: [...s.activeIncidents, inc], totalIncidents: s.totalIncidents + 1 };
}

describe('incident damage', () => {
  it('reduces node health while unmitigated', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
    const rng = new SeededRNG('dmg');
    let s = withIncident(createInitialState('dmg'));
    const before = s.architecture.nodes.get('app')!.health;
    for (let i = 1; i <= 300; i++) { // 30 simulated seconds
      vi.setSystemTime(1_700_000_000_000 + i * 100);
      s = tickSimulation(s, rng, 0.1);
    }
    expect(s.architecture.nodes.get('app')!.health).toBeLessThan(before - 0.05);
  });

  it('recovers health once the incident is gone', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
    const rng = new SeededRNG('rec');
    let s = createInitialState('rec');
    const app = s.architecture.nodes.get('app')!;
    app.health = 0.5;
    for (let i = 1; i <= 300; i++) {
      vi.setSystemTime(1_700_000_000_000 + i * 100);
      s = tickSimulation(s, rng, 0.1);
    }
    expect(s.architecture.nodes.get('app')!.health).toBeGreaterThan(0.7);
  });

  it('pays less for letting an incident auto-resolve than for fixing it', () => {
    expect(GAME_CONFIG.incidents.autoResolveReputationReward)
      .toBeLessThan(GAME_CONFIG.incidents.mitigatedReputationReward);
  });
});
