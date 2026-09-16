import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable } from './policies';

describe('CHECKPOINT 3 — build-and-optimise matters', () => {
  it('rewards deploying infrastructure with measurably lower pressure', () => {
    const builder = runSim({ minutes: 30, policies: [deployWhenAffordable] });
    const idler = runSim({ minutes: 30, policies: [] });

    console.log('\n=== BUILDER (deploys everything affordable) ===\n' + formatReport(builder));
    console.log('\n=== IDLER (deploys nothing) ===\n' + formatReport(idler));

    const peak = (r: typeof builder) => Math.max(...r.samples.map(s => s.maxUtil));
    console.log(`peak util — builder ${peak(builder).toFixed(2)} vs idler ${peak(idler).toFixed(2)}`);

    // The load model is live for both
    expect(peak(idler)).toBeGreaterThan(0.7);
    // Building measurably relieves pressure
    expect(peak(builder)).toBeLessThan(peak(idler));
    // And it costs money — the optimise half of the loop is real
    expect(builder.final.costs).toBeGreaterThan(idler.final.costs);
    // NOTE: uptime comparison deferred to CP4 — both runs hit game-over before
    // the incident engine / soft-floor balance is in place (Phase 3).
  });
});
