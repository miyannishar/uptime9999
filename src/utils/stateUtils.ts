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

/**
 * Validate GameState structure
 */
export function validateGameState(state: GameState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate architecture
  if (!state.architecture || !state.architecture.nodes || !state.architecture.edges) {
    errors.push('Architecture is missing or invalid');
  }

  // Validate nodes
  if (state.architecture?.nodes) {
    state.architecture.nodes.forEach((node, id) => {
      if (!node.id || node.id !== id) {
        errors.push(`Node ID mismatch: ${id} vs ${node.id}`);
      }
      if (node.health < 0 || node.health > 1) {
        errors.push(`Node ${id} has invalid health: ${node.health}`);
      }
      if (node.utilization < 0) {
        errors.push(`Node ${id} has negative utilization: ${node.utilization}`);
      }
    });
  }

  // Validate business metrics
  if (state.cash < 0) {
    errors.push(`Cash is negative: ${state.cash}`);
  }
  if (state.users < 0) {
    errors.push(`Users is negative: ${state.users}`);
  }
  if (state.uptime < 0 || state.uptime > 1) {
    errors.push(`Uptime is out of bounds: ${state.uptime}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize GameState - fix common issues
 */
export function sanitizeGameState(state: GameState): GameState {
  const sanitized = cloneGameState(state);

  // Clamp values to valid ranges
  sanitized.cash = Math.max(0, sanitized.cash);
  sanitized.users = Math.max(0, sanitized.users);
  sanitized.uptime = Math.max(0, Math.min(1, sanitized.uptime));
  sanitized.reputation = Math.max(0, Math.min(100, sanitized.reputation));

  // Sanitize nodes
  sanitized.architecture.nodes.forEach(node => {
    node.health = Math.max(0, Math.min(1, node.health));
    node.utilization = Math.max(0, node.utilization);
    node.errorRate = Math.max(0, Math.min(1, node.errorRate));
    node.latency = Math.max(0, node.latency);
  });

  return sanitized;
}

