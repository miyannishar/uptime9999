import type { GameState } from './types';

/**
 * True when an action's declared target can be acted on: 'global' actions always can,
 * component-scoped ones need either a deployed blueprint or a live architecture node
 * (which covers scaled instances like `app_2`).
 */
export function isActionTargetPresent(state: GameState, target: string): boolean {
  if (!target || target === 'global') return true;
  return state.deployedComponents.has(target) || state.architecture.nodes.has(target);
}
