import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/engine';
import { isActionTargetPresent } from '../src/sim/actionAvailability';
import { ACTIONS } from '../src/data/actions';

describe('action target availability', () => {
  it('treats global as always present', () => {
    const s = createInitialState('a');
    expect(isActionTargetPresent(s, 'global')).toBe(true);
  });

  it('accepts deployed components and rejects undeployed ones', () => {
    const s = createInitialState('a');
    expect(isActionTargetPresent(s, 'app')).toBe(true);
    expect(isActionTargetPresent(s, 'cache')).toBe(false);
  });

  it('accepts scaled instances that exist in the architecture but not in deployedComponents', () => {
    const s = createInitialState('a');
    const app = s.architecture.nodes.get('app')!;
    s.architecture.nodes.set('app_2', { ...app, id: 'app_2', instanceNumber: 2 });
    expect(isActionTargetPresent(s, 'app_2')).toBe(true);
  });

  it('exposes a usable number of actions at session start', () => {
    const s = createInitialState('a');
    const visible = ACTIONS.filter(a => isActionTargetPresent(s, a.target));
    expect(visible.length).toBeGreaterThan(20);
  });
});
