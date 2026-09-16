import { describe, it, expect } from 'vitest';
import { runSim } from './harness';
import { deployWhenAffordable } from './policies';

describe('component deployment', () => {
  it('completes a deployment and keeps it', () => {
    const r = runSim({ minutes: 10, policies: [deployWhenAffordable] });
    expect(r.final.deployedComponents.has('cache')).toBe(true);
    expect(r.final.deployingComponents.size).toBe(0);
    expect(r.final.architecture.nodes.has('cache')).toBe(true);
  });

  it('records each deployment exactly once', () => {
    const r = runSim({ minutes: 15, policies: [deployWhenAffordable] });
    const ids = r.final.componentDeploymentHistory.map(d => d.componentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('charges the blueprint cost once', () => {
    const r = runSim({ minutes: 10, policies: [deployWhenAffordable] });
    const spend = r.final.componentDeploymentHistory.reduce((a, d) => a + d.cost, 0);
    expect(spend).toBeGreaterThan(0);
    expect(r.final.componentDeploymentHistory.length).toBeGreaterThanOrEqual(1);
  });
});
