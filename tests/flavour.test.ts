import { describe, it, expect } from 'vitest';
import { shouldFlavour } from '../src/services/incidentFlavour';

describe('incident flavour gating', () => {
  it('skips INFO incidents to save budget', () => {
    expect(shouldFlavour('INFO', 'key')).toBe(false);
  });
  it('flavours WARN and CRIT when a key is present', () => {
    expect(shouldFlavour('WARN', 'key')).toBe(true);
    expect(shouldFlavour('CRIT', 'key')).toBe(true);
  });
  it('never flavours without a key', () => {
    expect(shouldFlavour('CRIT', undefined)).toBe(false);
  });
});
