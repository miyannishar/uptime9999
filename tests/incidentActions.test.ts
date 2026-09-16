import { describe, it, expect } from 'vitest';
import { INCIDENTS } from '../src/data/incidents';
import { getResolutionActions } from '../src/sim/incidentActions';

describe('resolution options', () => {
  it('resolves every template resolutionOption to a real action', () => {
    for (const def of INCIDENTS) {
      const actions = getResolutionActions({
        id: 'x', definitionId: def.id, targetNodeId: 'app', severity: def.severity,
        startTime: 0, escalationTimer: 0, outagetimer: 0, mitigationLevel: 0, mitigationProgress: 0,
      });
      expect(actions.length).toBe(def.resolutionOptions.length);
    }
  });

  it('returns AI-suggested actions untouched for AI incidents', () => {
    const actions = getResolutionActions({
      id: 'y', definitionId: 'nope', targetNodeId: 'app', severity: 'WARN',
      startTime: 0, escalationTimer: 0, outagetimer: 0, mitigationLevel: 0, mitigationProgress: 0,
      aiGenerated: true, aiSuggestedActions: [],
    });
    expect(actions).toEqual([]);
  });
});
