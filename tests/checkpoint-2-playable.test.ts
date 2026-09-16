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

    expect(r.final.deployedComponents.size).toBeGreaterThanOrEqual(5); // 7 in typical run; 5 gives room for economy changes
    expect(r.final.deployingComponents.size).toBeLessThanOrEqual(1);
    expect(r.final.cash).toBeGreaterThan(0);

    const visible = ACTIONS.filter(a => isActionTargetPresent(r.final, a.target));
    console.log(`actions reachable at end: ${visible.length} / ${ACTIONS.length}`);
    expect(visible.length).toBeGreaterThan(40);
  });
});
