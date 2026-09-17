import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable } from './policies';

describe('CHECKPOINT 4 — pressure with a soft floor', () => {
  it('punishes neglect, rewards competence, and avoids death spirals', () => {
    const competent = runSim({ minutes: 30, policies: [deployWhenAffordable] });
    const negligent = runSim({ minutes: 30, policies: [] });

    console.log('\n=== COMPETENT ===\n' + formatReport(competent));
    console.log('\n=== NEGLIGENT ===\n' + formatReport(negligent));

    // Both runs see real incidents — engine is firing
    expect(competent.final.totalIncidents).toBeGreaterThan(5);
    // The competent player resolves incidents; the negligent player does not
    expect(competent.final.resolvedIncidents).toBeGreaterThan(negligent.final.resolvedIncidents);

    // Soft floor: a competent player never dies
    expect(competent.gameOver).toBe(false);

    // Reproducible
    const again = runSim({ minutes: 30, seed: 'plan-seed', policies: [deployWhenAffordable] });
    expect(again.final.totalIncidents).toBe(competent.final.totalIncidents);
  });
});
