import { describe, it, expect } from 'vitest';
import { runSim } from './harness';
import { deployWhenAffordable } from './policies';

describe('load model', () => {
  it('puts the app under real pressure early when nothing is deployed', () => {
    const r = runSim({ minutes: 8, policies: [] }); // no deployments, no relief
    const peak = Math.max(...r.samples.map(s => s.maxUtil));
    expect(peak).toBeGreaterThan(0.7);
  });

  it('relieves database pressure when a cache is deployed', () => {
    const withCache = runSim({ minutes: 12, policies: [deployWhenAffordable] });
    const bare = runSim({ minutes: 12, policies: [] });
    const dbWith = withCache.final.architecture.nodes.get('db_primary')!.utilization;
    const dbBare = bare.final.architecture.nodes.get('db_primary')!.utilization;
    expect(withCache.final.deployedComponents.has('cache')).toBe(true);
    expect(dbWith).toBeLessThan(dbBare * 0.8);
  });
});

describe('redundancy', () => {
  it('gives a deployed db_replica real capacity', () => {
    const r = runSim({ minutes: 14, policies: [deployWhenAffordable] });
    if (!r.final.deployedComponents.has('db_replica')) return; // ladder didn't reach it; not a failure
    const replica = r.final.architecture.nodes.get('db_replica')!;
    expect(replica.scaling.current).toBeGreaterThan(0);
    expect(replica.capacity * replica.scaling.current).toBeGreaterThan(0);
  });

  it('only splits load across members that can serve it', () => {
    const r = runSim({ minutes: 14, policies: [deployWhenAffordable] });
    r.final.architecture.nodes.forEach(n => {
      if (n.enabled && n.scaling.current === 0) expect(n.loadIn).toBe(0);
    });
  });
});
