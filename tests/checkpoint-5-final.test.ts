import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable } from './policies';

describe('CHECKPOINT 5 — final', () => {
  it('produces a coherent 30-minute session across three seeds', () => {
    for (const seed of ['alpha', 'beta', 'gamma']) {
      const r = runSim({ minutes: 30, seed, policies: [deployWhenAffordable] });
      console.log(`\n=== ${seed.toUpperCase()} ===\n` + formatReport(r));

      expect(r.final.deployedComponents.size).toBeGreaterThanOrEqual(5);
      expect(r.final.totalIncidents).toBeGreaterThan(5); // rate=0.5 gives 6-12 in a 30-min run
      expect(Number.isFinite(r.final.uptime)).toBe(true); // just confirm no NaN
      expect(r.final.cash).toBeGreaterThan(BANKRUPTCY);
      expect(r.gameOver).toBe(false);

      // No NaN or Infinity anywhere in key numeric state
      for (const k of ['users', 'cash', 'rps', 'revenue', 'costs', 'reputation', 'uptime'] as const) {
        expect(Number.isFinite(r.final[k]), `${seed}.${k}`).toBe(true);
      }
      r.final.architecture.nodes.forEach(n => {
        expect(Number.isFinite(n.health), `${seed}.${n.id}.health`).toBe(true);
        expect(Number.isFinite(n.utilization), `${seed}.${n.id}.utilization`).toBe(true);
      });
    }
  });
});

const BANKRUPTCY = -5000;
