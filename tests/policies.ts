import { COMPONENT_BLUEPRINTS, blueprintStatus } from '../src/config/progressionConfig';
import { ACTIONS } from '../src/data/actions';
import type { GameAction } from '../src/sim/reducer';
import type { GameState } from '../src/sim/types';
import type { Policy } from './harness';

/** Deploys the cheapest unlocked, affordable blueprint. Mirrors what a competent player does. */
export const deployWhenAffordable: Policy = (s: GameState, t: number): GameAction[] => {
  if (s.deployingComponents.size > 0) return [];
  const candidates = COMPONENT_BLUEPRINTS
    .filter(bp => !s.deployedComponents.has(bp.id))
    .filter(bp => blueprintStatus(bp, s.deployedComponents, s.users, t, s.totalIncidents).unlocked)
    .filter(bp => s.cash >= bp.deployCost)
    .sort((a, b) => a.deployCost - b.deployCost);
  return candidates.length ? [{ type: 'DEPLOY_COMPONENT', componentId: candidates[0].id }] : [];
};

import { SeededRNG } from '../src/sim/rng';
import { INCIDENTS } from '../src/data/incidents';

const _policyRng = new SeededRNG('policy-rng');

/**
 * Mitigates the highest-severity active incident using its first affordable resolution option.
 * Mirrors what a competent player does when an incident fires.
 */
export const resolveIncidents: Policy = (s: GameState): GameAction[] => {
  // Don't queue if already executing an action for an incident
  const incident = [...s.activeIncidents]
    .sort((a, b) => ({ CRIT: 2, WARN: 1, INFO: 0 }[b.severity] ?? 0) - ({ CRIT: 2, WARN: 1, INFO: 0 }[a.severity] ?? 0))
    .find(i => i.mitigationLevel < 0.5 && !s.actionsInProgress.some(a => a.mitigatingIncidentId === i.id));

  if (!incident) return [];

  const def = INCIDENTS.find(d => d.id === incident.definitionId);
  if (!def?.resolutionOptions?.length) return [];

  const action = def.resolutionOptions
    .map(id => ACTIONS.find(a => a.id === id))
    .find(a => a && s.cash >= (a.oneTimeCost ?? 0) && !s.actionCooldowns.has(a.id));

  if (!action) return [];
  return [{ type: 'EXECUTE_ACTION', actionId: action.id, rng: _policyRng, mitigatingIncidentId: incident.id }];
};

