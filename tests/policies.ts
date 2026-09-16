import { COMPONENT_BLUEPRINTS, blueprintStatus } from '../src/config/progressionConfig';
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

/**
 * Replicates App.tsx's deployment completion. Needed only until Task 3 moves this
 * into tickSimulation — Task 3 deletes this policy.
 */
export const completeDeploymentsLikeApp: Policy = (s: GameState): GameAction[] => {
  const out: GameAction[] = [];
  s.deployingComponents.forEach((info, id) => {
    if ((Date.now() - info.startTime) / 1000 >= info.durationSec) {
      out.push({ type: 'DEPLOYMENT_COMPLETE', componentId: id });
    }
  });
  return out;
};
