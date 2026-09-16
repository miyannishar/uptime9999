import { describe, it, expect } from 'vitest';
import { clampMetric } from '../src/sim/clampMetrics';
import { createInitialState } from '../src/sim/engine';

const node = () => createInitialState('c').architecture.nodes.get('app')!;

describe('clampMetric', () => {
  it('treats fraction rates as 0..1', () => {
    expect(clampMetric(node(), 'hitRate', 1.4)).toBe(1);
    expect(clampMetric(node(), 'errorRate', -0.2)).toBe(0);
  });

  it('does not crush counter metrics that merely end in Rate', () => {
    expect(clampMetric(node(), 'evictionRate', 250)).toBe(250);
    expect(clampMetric(node(), 'retryRate', 40)).toBe(40);
  });

  it('rejects non-finite values instead of propagating them', () => {
    expect(clampMetric(node(), 'hitRate', NaN)).toBe(0);
    expect(clampMetric(node(), 'evictionRate', Infinity)).toBe(0);
  });
});
