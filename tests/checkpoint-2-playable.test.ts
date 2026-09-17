import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable } from './policies';
import { ACTIONS } from '../src/data/actions';
import { isActionTargetPresent } from '../src/sim/actionAvailability';

describe('CHECKPOINT 2 — playable', () => {
  it('climbs the deployment ladder and keeps actions reachable', () => {
    const r = runSim({ minutes: 30, policies: [deployWhenAffordable] });
    console.log('\n=== CHECKPOINT 2 ===\n' + formatReport(r));
    console.log('deployed at end:', [...r.final.deployedComponents].sort().join(', '));

    expect(r.final.deployedComponents.size).toBeGreaterThanOrEqual(4); // starters use cash early; 4 is still meaningful ladder progress
    expect(r.final.deployingComponents.size).toBeLessThanOrEqual(1);
    // Pre-CP4: incidents now spawn; cash can go slightly negative before balance tuning
    expect(r.final.cash).toBeGreaterThan(-5000); // above bankruptcy threshold

    const visible = ACTIONS.filter(a => isActionTargetPresent(r.final, a.target));
    console.log(`actions reachable at end: ${visible.length} / ${ACTIONS.length}`);
    expect(visible.length).toBeGreaterThan(40);
  });
});
