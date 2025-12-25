// Game state reducer

import { GameState, ActiveIncident } from './types';
import { SeededRNG } from './rng';
import { ACTIONS } from '../data/actions';
import { INCIDENTS } from '../data/incidents';
import { GAME_CONFIG } from '../config/gameConfig';

export type GameAction =
  | { type: 'TICK'; dt: number; rng: SeededRNG }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'EXECUTE_ACTION'; actionId: string; rng: SeededRNG; mitigatingIncidentId?: string }
  | { type: 'MITIGATE_INCIDENT'; incidentId: string; actionId: string }
  | { type: 'NEW_GAME'; seed: string }
  | { type: 'LOAD_GAME'; state: GameState }
  | { type: 'DEBUG_SPAWN_INCIDENT'; incidentId: string; targetNodeId: string };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TOGGLE_PAUSE':
      return { ...state, paused: !state.paused };

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    case 'EXECUTE_ACTION':
      return executeAction(state, action.actionId, action.rng, action.mitigatingIncidentId);

    case 'MITIGATE_INCIDENT':
      return mitigateIncident(state, action.incidentId, action.actionId);

    case 'NEW_GAME':
      return state; // Handled in App component

    case 'LOAD_GAME':
      return action.state;

    case 'DEBUG_SPAWN_INCIDENT':
      return debugSpawnIncident(state, action.incidentId, action.targetNodeId);

    default:
      return state;
  }
}

function executeAction(
  state: GameState, 
  actionId: string, 
  rng: SeededRNG,
  mitigatingIncidentId?: string
): GameState {
  const actionDef = ACTIONS.find(a => a.id === actionId);
  if (!actionDef) return state;

  // Check cooldown
  const cooldownEnd = state.actionCooldowns.get(actionId);
  if (cooldownEnd && Date.now() < cooldownEnd) {
    return state;
  }

  // Check requirements
  if (actionDef.requires) {
    const req = actionDef.requires;
    if (req.minCash && state.cash < req.minCash) return state;
    if (req.minUsers && state.users < req.minUsers) return state;
    if (req.nodeEnabled) {
      const node = state.architecture.nodes.get(req.nodeEnabled);
      if (!node || !node.enabled) return state;
    }
    if (req.observabilityLevel && state.observabilityLevel !== req.observabilityLevel) {
      return state;
    }
  }

  // Check cost
  if (state.cash < actionDef.oneTimeCost) {
    return state;
  }

  // Success check
  if (!rng.chance(actionDef.successChance)) {
    // Failed - still pay cost and set cooldown
    return {
      ...state,
      cash: state.cash - actionDef.oneTimeCost,
      actionCooldowns: new Map(state.actionCooldowns).set(
        actionId,
        Date.now() + actionDef.cooldownSeconds * 1000
      ),
    };
  }

  const newState = { ...state };

  // Pay cost
  newState.cash -= actionDef.oneTimeCost;

  // Set cooldown
  newState.actionCooldowns = new Map(newState.actionCooldowns);
  newState.actionCooldowns.set(actionId, Date.now() + actionDef.cooldownSeconds * 1000);

  // Apply effects
  if (actionDef.effects) {
    const effects = actionDef.effects;

    // Stat changes
    if (effects.statChanges) {
      const targetNode = actionDef.target === 'global' 
        ? null 
        : state.architecture.nodes.get(actionDef.target);

      if (targetNode) {
        const changes = effects.statChanges;
        if (changes.capacity) targetNode.capacity += changes.capacity;
        if (changes.reliability) targetNode.reliabilityScore += changes.reliability;
        if (changes.security) targetNode.securityScore += changes.security;
        if (changes.latency) targetNode.baseLatency += changes.latency;
        if (changes.errorRate) targetNode.baseError += changes.errorRate;
      }
    }

    // Feature toggle
    if (effects.featureToggle) {
      const targetNode = actionDef.target === 'global'
        ? null
        : state.architecture.nodes.get(actionDef.target);

      if (targetNode) {
        targetNode.features = {
          ...targetNode.features,
          [effects.featureToggle.feature]: effects.featureToggle.value,
        };
      }
    }

    // Tech debt
    if (effects.techDebt) {
      newState.techDebt = Math.max(0, Math.min(100, newState.techDebt + effects.techDebt));
    }

    // Reputation
    if (effects.reputationDelta) {
      newState.reputation = Math.max(0, Math.min(100, newState.reputation + effects.reputationDelta));
    }

    // Enable node
    if (effects.enableNode) {
      const node = state.architecture.nodes.get(effects.enableNode);
      if (node) {
        node.enabled = true;
        node.locked = false;
      }
    }

    // Scale node
    if (effects.scaleNode) {
      const node = state.architecture.nodes.get(effects.scaleNode.nodeId);
      if (node) {
        const newCurrent = node.scaling.current + effects.scaleNode.delta;
        node.scaling.current = Math.max(
          node.scaling.min,
          Math.min(node.scaling.max, newCurrent)
        );
      }
    }

    // Downtime risk
    if (effects.downtimeRisk && rng.chance(effects.downtimeRisk)) {
      // Cause brief outage
      const targetNode = actionDef.target === 'global'
        ? null
        : state.architecture.nodes.get(actionDef.target);
      if (targetNode) {
        targetNode.health = Math.max(0.3, targetNode.health - 0.5);
        targetNode.operationalMode = 'degraded';
      }
    }
  }

  // Special action handlers
  if (actionId === 'upgrade_observability_metrics') {
    newState.observabilityLevel = 'METRICS';
  }
  if (actionId === 'upgrade_observability_traces') {
    newState.observabilityLevel = 'TRACES';
  }
  if (actionId === 'increase_price') {
    newState.pricing *= 1.2;
  }

  // Add action to in-progress if it has duration
  if (actionDef.durationSeconds > 0) {
    newState.actionsInProgress = [
      ...newState.actionsInProgress,
      {
        id: `action_${Date.now()}`,
        actionId,
        startTime: Date.now(),
        endTime: Date.now() + actionDef.durationSeconds * 1000,
        targetNodeId: actionDef.target !== 'global' ? actionDef.target : undefined,
        mitigatingIncidentId,
      },
    ];
  } else if (mitigatingIncidentId) {
    // Instant action mitigating an incident - apply immediately
    const incident = newState.activeIncidents.find(i => i.id === mitigatingIncidentId);
    if (incident) {
      // Use config for mitigation amount
      const mitigationAmount = GAME_CONFIG.incidents.mitigationPerAction;
      incident.mitigationLevel = Math.min(1.0, incident.mitigationLevel + mitigationAmount);
      incident.mitigationProgress = incident.mitigationLevel;
    }
  }

  return newState;
}

function mitigateIncident(state: GameState, incidentId: string, actionId: string): GameState {
  const incident = state.activeIncidents.find(i => i.id === incidentId);
  if (!incident) return state;

  const incidentDef = INCIDENTS.find(i => i.id === incident.definitionId);
  if (!incidentDef) return state;

  // Check if action helps
  if (!incidentDef.resolutionOptions.includes(actionId)) {
    return state;
  }

  // Note: Mitigation progress will be tracked by the action in progress
  // and applied gradually in the engine tick
  return state;
}

function debugSpawnIncident(state: GameState, incidentId: string, targetNodeId: string): GameState {
  const incidentDef = INCIDENTS.find(i => i.id === incidentId);
  if (!incidentDef) return state;

  const targetNode = state.architecture.nodes.get(targetNodeId);
  if (!targetNode) return state;

  const newIncident: ActiveIncident = {
    id: `incident_${Date.now()}_${Math.random()}`,
    definitionId: incidentId,
    targetNodeId,
    severity: incidentDef.severity,
    startTime: Date.now(),
    escalationTimer: incidentDef.escalationTimeSeconds || 0,
    outagetimer: incidentDef.timeToOutageSeconds || 0,
    mitigationLevel: 0,
    mitigationProgress: 0,
  };

  return {
    ...state,
    activeIncidents: [...state.activeIncidents, newIncident],
    totalIncidents: state.totalIncidents + 1,
  };
}

