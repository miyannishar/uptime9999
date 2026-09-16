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
