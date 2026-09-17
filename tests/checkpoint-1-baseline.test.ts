import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable } from './policies';

describe('CHECKPOINT 1 — baseline', () => {
  it('prints a 30-minute run and stays numerically sane', () => {
    const r = runSim({ minutes: 30, policies: [deployWhenAffordable] });
    console.log('\n=== BASELINE ===\n' + formatReport(r));

    const peakUtil = Math.max(...r.samples.map(s => s.maxUtil));
    const minHealth = Math.min(...[...r.final.architecture.nodes.values()].map(n => n.health));
    console.log(`peak utilization: ${peakUtil.toFixed(4)} (knee is 0.7)`);
    console.log(`min node health : ${minHealth.toFixed(4)}`);
    console.log(`deployed        : ${[...r.final.deployedComponents].sort().join(', ')}`);
    console.log(`incidents       : ${r.final.totalIncidents} total, ${r.final.resolvedIncidents} resolved`);

    // Permanent invariants only
    expect(r.samples.length).toBeGreaterThan(10);
    expect(Number.isFinite(r.final.users)).toBe(true);
    expect(Number.isFinite(r.final.cash)).toBe(true);
    expect(r.final.users).toBeGreaterThan(0);
  });
});
