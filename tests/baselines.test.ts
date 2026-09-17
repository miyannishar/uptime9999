import { describe, it, expect } from 'vitest';
import { METRIC_BASELINES } from '../src/sim/componentMetrics';
import { initializeComponentMetrics } from '../src/sim/componentInitializer';
import type { ComponentType } from '../src/sim/types';

describe('metric baselines', () => {
  it('initialises every component at its own baseline', () => {
    for (const [type, baseline] of Object.entries(METRIC_BASELINES)) {
      const init = initializeComponentMetrics(type as ComponentType);
      for (const [key, value] of Object.entries(baseline)) {
        if (init[key] === undefined) continue;
        expect(init[key], `${type}.${key}`).toBeCloseTo(value, 5);
      }
    }
  });
});
