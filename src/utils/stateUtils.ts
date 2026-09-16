// State utilities for safe state cloning and validation

import { GameState, ComponentNode, Architecture } from '../sim/types';

/**
 * Deep clone a GameState to prevent mutations
 * This is critical because Maps and nested objects are not cloned by spread operator
 */
export function cloneGameState(state: GameState): GameState {
  // Clone Maps properly
  const clonedArchitecture: Architecture = {
    nodes: new Map(state.architecture.nodes),
    edges: [...state.architecture.edges],
  };

  // Deep clone nodes (they contain nested objects)
  clonedArchitecture.nodes = new Map(
    Array.from(state.architecture.nodes.entries()).map(([id, node]) => [
      id,
      cloneComponentNode(node),
    ])
  );

  return {
    ...state,
    architecture: clonedArchitecture,
    componentCounters: new Map(state.componentCounters),
    actionCooldowns: new Map(state.actionCooldowns),
    unlockedFeatures: new Set(state.unlockedFeatures),
    recentIncidentTargets: [...state.recentIncidentTargets],
    activeIncidents: state.activeIncidents.map(inc => ({ ...inc })),
    actionsInProgress: state.actionsInProgress.map(act => ({ ...act })),
    uptimeWindow: [...state.uptimeWindow],
    // Enhancement features
    achievements: new Set(state.achievements),
    stakeholderMessages: state.stakeholderMessages.map(m => ({ ...m, responses: [...m.responses] })),
    postMortemQueue: state.postMortemQueue.map(p => ({ ...p })),
    statusPageHistory: [...state.statusPageHistory],
    incidentHistory: state.incidentHistory.map(h => ({ ...h })),
    // Progressive architecture
    deployedComponents: new Set(state.deployedComponents),
    deployingComponents: new Map(
      Array.from(state.deployingComponents.entries()).map(([k, v]) => [k, { ...v }])
    ),
    componentDeploymentHistory: state.componentDeploymentHistory.map(d => ({ ...d })),
  };
}

/**
 * Clone a ComponentNode with all nested objects
 */
function cloneComponentNode(node: ComponentNode): ComponentNode {
  return {
    ...node,
    scaling: { ...node.scaling },
    specificMetrics: { ...node.specificMetrics },
    features: { ...node.features },
  };
}



