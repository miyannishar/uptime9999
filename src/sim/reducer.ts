// Game state reducer

import { GameState, ActiveIncident } from './types';
import { SeededRNG } from './rng';
import { ACTIONS } from '../data/actions';
import { INCIDENTS } from '../data/incidents';
import { GAME_CONFIG } from '../config/gameConfig';
import { clampMetric } from './clampMetrics';
import { soundNotifications } from '../utils/soundNotifications';

export type GameAction =
  | { type: 'TICK'; dt: number; rng: SeededRNG }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'EXECUTE_ACTION'; actionId: string; rng: SeededRNG; mitigatingIncidentId?: string }
  | { type: 'EXECUTE_AI_ACTION'; actionName: string; cost: number; duration: number; mitigatingIncidentId: string }
  | { type: 'MITIGATE_INCIDENT'; incidentId: string; actionId: string }
  | { type: 'SET_AI_SESSION_ACTIVE'; active: boolean }
  | { type: 'TRACK_INCIDENT_TARGET'; nodeId: string }
  | { type: 'SPAWN_AI_INCIDENT'; incident: any }
  | { type: 'NEW_GAME'; seed: string }
  | { type: 'LOAD_GAME'; state: GameState }
  | { type: 'DEBUG_SPAWN_INCIDENT'; incidentId: string; targetNodeId: string };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TICK':
      return state; // Handled in App component via tickSimulation

    case 'TOGGLE_PAUSE':
      return { ...state, paused: !state.paused };

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    case 'EXECUTE_ACTION':
      return executeAction(state, action.actionId, action.rng, action.mitigatingIncidentId);

    case 'SET_AI_SESSION_ACTIVE':
      return { ...state, aiSessionActive: action.active };

    case 'TRACK_INCIDENT_TARGET':
      // Track this node as recently targeted (for AI diversity)
      return {
        ...state,
        recentIncidentTargets: [
          ...state.recentIncidentTargets,
          { nodeId: action.nodeId, timestamp: Date.now() }
        ].slice(-5), // Keep only last 5 targets
      };

    case 'SPAWN_AI_INCIDENT':
      return spawnAIIncident(state, action.incident);

    case 'NEW_GAME':
      return state; // Handled in App component

    case 'LOAD_GAME':
      return action.state;

    case 'DEBUG_SPAWN_INCIDENT':
      return debugSpawnIncident(state, action.incidentId, action.targetNodeId);

    case 'MITIGATE_INCIDENT':
      return mitigateIncident(state, action.incidentId, action.actionId);

    case 'EXECUTE_AI_ACTION':
      return executeAIAction(state, action.actionName, action.cost, action.duration, action.mitigatingIncidentId);

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

  // Check cost (only for positive costs - negative costs add money)
  if (actionDef.oneTimeCost > 0 && state.cash < actionDef.oneTimeCost) return state;

  // Check requirements
  if (actionDef.requires) {
    const req = actionDef.requires;
    if (req.minCash !== undefined && state.cash < req.minCash) return state;
    if (req.minUsers !== undefined && state.users < req.minUsers) return state;
    if (req.nodeEnabled) {
      const node = state.architecture.nodes.get(req.nodeEnabled);
      if (!node || !node.enabled) return state;
    }
    if (req.featureEnabled) {
      // Check if feature is enabled on any node
      let featureFound = false;
      for (const node of state.architecture.nodes.values()) {
        if ((node.features as any)[req.featureEnabled]) {
          featureFound = true;
          break;
        }
      }
      if (!featureFound) return state;
    }
    if (req.observabilityLevel && state.observabilityLevel !== req.observabilityLevel) {
      return state;
    }
  }

  // Check cooldown
  const cooldownEnd = state.actionCooldowns.get(actionId);
  if (cooldownEnd && Date.now() < cooldownEnd) return state;

  // Check success chance (for fundraising and risky actions)
  if (actionDef.successChance < 1.0 && rng.next() > actionDef.successChance) {
    // Action failed - still consume cooldown but don't apply effects
    const failedState = { ...state };
    failedState.actionCooldowns.set(actionId, Date.now() + actionDef.cooldownSeconds * 1000);
    return failedState;
  }

  const newState = { ...state };
  newState.cash -= actionDef.oneTimeCost; // For negative costs, this adds money

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
        if (changes.capacity) {
          targetNode.capacity += changes.capacity;
          // Capacity improvements also help recover health
          const oldHealth = targetNode.health;
          targetNode.health = Math.min(1.0, targetNode.health + 0.1);
          if (targetNode.health > oldHealth) {
            import('../utils/terminalLog').then(({ tlog }) => {
              tlog.success(`💚 ${targetNode.name} health improved: ${(oldHealth * 100).toFixed(0)}% → ${(targetNode.health * 100).toFixed(0)}%`);
            });
          }
        }
        if (changes.reliability) {
          targetNode.reliabilityScore += changes.reliability;
          // Reliability improvements help recover health
          const oldHealth = targetNode.health;
          targetNode.health = Math.min(1.0, targetNode.health + 0.05);
          if (targetNode.health > oldHealth) {
            import('../utils/terminalLog').then(({ tlog }) => {
              tlog.success(`💚 ${targetNode.name} health improved: ${(oldHealth * 100).toFixed(0)}% → ${(targetNode.health * 100).toFixed(0)}%`);
            });
          }
        }
        if (changes.security) targetNode.securityScore += changes.security;
        if (changes.latency) targetNode.baseLatency += changes.latency;
        if (changes.errorRate) targetNode.baseError += changes.errorRate;
        
        // Auto-recover from degraded/down states if health improves enough
        if (targetNode.operationalMode === 'degraded' && targetNode.health >= 0.7) {
          targetNode.operationalMode = 'normal';
          import('../utils/terminalLog').then(({ tlog }) => {
            tlog.success(`✅ ${targetNode.name} operational mode: degraded → normal`);
          });
        } else if (targetNode.operationalMode === 'down' && targetNode.health >= 0.5) {
          targetNode.operationalMode = 'degraded';
          import('../utils/terminalLog').then(({ tlog }) => {
            tlog.success(`⚠️ ${targetNode.name} operational mode: down → degraded`);
          });
        }
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
        const oldScaling = node.scaling.current;
        const newCurrent = node.scaling.current + effects.scaleNode.delta;
        node.scaling.current = Math.max(
          node.scaling.min,
          Math.min(node.scaling.max, newCurrent)
        );
        
        // Recover node health when scaling (scaling improves capacity and reduces load)
        const oldHealth = node.health;
        node.health = Math.min(1.0, node.health + 0.15); // Recover 15% health per scale action
        if (node.health > oldHealth) {
          import('../utils/terminalLog').then(({ tlog }) => {
            tlog.success(`💚 ${node.name} health recovered: ${(oldHealth * 100).toFixed(0)}% → ${(node.health * 100).toFixed(0)}%`);
          });
        }
        
        // Auto-recover from degraded/down states if health improves enough
        if (node.operationalMode === 'degraded' && node.health >= 0.7) {
          node.operationalMode = 'normal';
          import('../utils/terminalLog').then(({ tlog }) => {
            tlog.success(`✅ ${node.name} operational mode: degraded → normal`);
          });
        } else if (node.operationalMode === 'down' && node.health >= 0.5) {
          node.operationalMode = 'degraded';
          import('../utils/terminalLog').then(({ tlog }) => {
            tlog.success(`⚠️ ${node.name} operational mode: down → degraded`);
          });
        }
        
        // Log to terminal
        import('../utils/terminalLog').then(({ tlog }) => {
          tlog.system(`📊 ${node.name} scaled: ×${oldScaling} → ×${node.scaling.current}`);
        });
        
        // Update component-specific metrics when scaling
        if (node.specificMetrics) {
          if ('instances' in node.specificMetrics) {
            const oldInstances = node.specificMetrics.instances;
            node.specificMetrics.instances = node.scaling.current;
            import('../utils/terminalLog').then(({ tlog }) => {
              tlog.info(`   instances: ${oldInstances} → ${node.specificMetrics.instances}`);
            });
          }
          // Scaling increases capacity, reduces queue backlog
          if ('queueBacklog' in node.specificMetrics && effects.scaleNode.delta > 0) {
            const oldBacklog = node.specificMetrics.queueBacklog;
            node.specificMetrics.queueBacklog = Math.max(0, node.specificMetrics.queueBacklog * 0.7);
            import('../utils/terminalLog').then(({ tlog }) => {
              tlog.info(`   queueBacklog: ${oldBacklog} → ${node.specificMetrics.queueBacklog} (-${Math.round((1 - 0.7) * 100)}%)`);
            });
          }
        }
      }
    }

    // Downtime risk
    if (effects.downtimeRisk && rng.next() < effects.downtimeRisk) {
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

  // Play sound when action starts
  soundNotifications.playActionStart();

  // Add action to in-progress if it has duration (including node actions from node tab!)
  // This ensures all actions (incident mitigation, node scaling, etc.) appear in activity log
  if (actionDef.durationSeconds > 0) {
    // Apply immediate mitigation when action starts (gives player hope)
    if (mitigatingIncidentId) {
      const incident = newState.activeIncidents.find(i => i.id === mitigatingIncidentId);
      if (incident) {
        const immediateMitigation = GAME_CONFIG.incidents.immediateMitigationOnActionStart;
        incident.mitigationLevel = Math.min(1.0, incident.mitigationLevel + immediateMitigation);
        incident.mitigationProgress = incident.mitigationLevel;
        
        // Apply FULL mitigation to related incidents (shared root cause = same fix works for all)
        if (incident.relatedIncidentIds && incident.relatedIncidentIds.length > 0) {
          const sharedMitigation = immediateMitigation; // 100% mitigation for related incidents (same root cause!)
          incident.relatedIncidentIds.forEach(relatedId => {
            const relatedIncident = newState.activeIncidents.find(i => i.id === relatedId);
            if (relatedIncident) {
              relatedIncident.mitigationLevel = Math.min(1.0, relatedIncident.mitigationLevel + sharedMitigation);
              relatedIncident.mitigationProgress = relatedIncident.mitigationLevel;
            }
          });
          console.log(`🔗 Applied FULL mitigation to ${incident.relatedIncidentIds.length} related incident(s)`);
        }
      }
    }
    
    // Track ALL actions with duration > 0 in activity log (node actions, incident mitigation, etc.)
    newState.actionsInProgress = [
      ...newState.actionsInProgress,
      {
        id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, // Ensure unique IDs
        actionId,
        startTime: Date.now(),
        endTime: Date.now() + actionDef.durationSeconds * 1000,
        targetNodeId: actionDef.target !== 'global' ? actionDef.target : undefined,
        mitigatingIncidentId, // Optional: only set when mitigating an incident
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
      
      // Apply FULL mitigation to related incidents (shared root cause = same fix works for all)
      if (incident.relatedIncidentIds && incident.relatedIncidentIds.length > 0) {
        const sharedMitigation = mitigationAmount; // 100% mitigation for related incidents (same root cause!)
        incident.relatedIncidentIds.forEach(relatedId => {
          const relatedIncident = newState.activeIncidents.find(i => i.id === relatedId);
          if (relatedIncident) {
            relatedIncident.mitigationLevel = Math.min(1.0, relatedIncident.mitigationLevel + sharedMitigation);
            relatedIncident.mitigationProgress = relatedIncident.mitigationLevel;
          }
        });
        console.log(`🔗 Applied FULL mitigation to ${incident.relatedIncidentIds.length} related incident(s)`);
      }
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

function executeAIAction(
  state: GameState,
  actionName: string,
  cost: number,
  duration: number,
  mitigatingIncidentId: string
): GameState {
  // Apply immediate mitigation when AI action starts
  if (mitigatingIncidentId) {
    const incident = state.activeIncidents.find(i => i.id === mitigatingIncidentId);
    if (incident) {
      const immediateMitigation = GAME_CONFIG.incidents.immediateMitigationOnActionStart;
      incident.mitigationLevel = Math.min(1.0, incident.mitigationLevel + immediateMitigation);
      incident.mitigationProgress = incident.mitigationLevel;
      
      // Apply FULL mitigation to related incidents (shared root cause = same fix works for all)
      if (incident.relatedIncidentIds && incident.relatedIncidentIds.length > 0) {
        const sharedMitigation = immediateMitigation; // 100% mitigation for related incidents (same root cause!)
        incident.relatedIncidentIds.forEach(relatedId => {
          const relatedIncident = state.activeIncidents.find(i => i.id === relatedId);
          if (relatedIncident) {
            relatedIncident.mitigationLevel = Math.min(1.0, relatedIncident.mitigationLevel + sharedMitigation);
            relatedIncident.mitigationProgress = relatedIncident.mitigationLevel;
          }
        });
        console.log(`🔗 Applied FULL mitigation to ${incident.relatedIncidentIds.length} related incident(s)`);
      }
      
      // Apply metric improvements from AI action immediately (partial)
      const action = incident.aiSuggestedActions?.find(a => a.actionName === actionName);
      if (action && (action as any).metricImprovements) {
        const targetNode = state.architecture.nodes.get(incident.targetNodeId);
        if (targetNode && targetNode.specificMetrics) {
          const improvements = (action as any).metricImprovements;
          for (const [metricKey, improvement] of Object.entries(improvements)) {
            if (metricKey in targetNode.specificMetrics && typeof improvement === 'number') {
              const currentValue = targetNode.specificMetrics[metricKey];
              if (typeof currentValue === 'number') {
                // Apply 30% improvement immediately (rest when action completes)
                const newValue = currentValue + (improvement * 0.3);
                targetNode.specificMetrics[metricKey] = clampMetric(targetNode, metricKey, newValue);
              }
            }
          }
        }
      }
    }
  }

  // Check cost
  if (state.cash < cost) return state;

  // Play sound when action starts
  soundNotifications.playActionStart();

  const newState = { ...state };
  newState.cash -= cost;

  // Add to actions in progress
  newState.actionsInProgress = [
    ...newState.actionsInProgress,
    {
      id: `ai_action_${Date.now()}`,
      actionId: `ai_${actionName.replace(/\s+/g, '_').toLowerCase()}`,
      startTime: Date.now(),
      endTime: Date.now() + duration * 1000,
      mitigatingIncidentId,
    },
  ];

  return newState;
}

function spawnAIIncident(state: GameState, aiIncident: any): GameState {
  // Generate truly unique ID using timestamp + random
  const uniqueId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Check if similar incident already exists (same AI ID from GPT)
  const exists = state.activeIncidents.some(i => 
    i.aiGenerated && (i as any).aiIncidentName === aiIncident.incidentName
  );
  
  if (exists) {
    console.warn('⚠️ Similar AI incident already active:', aiIncident.incidentName);
    return state;
  }
  
  // Check for related incidents (same target + similar category within last 60s)
  const now = Date.now();
  const relatedIncidents = state.activeIncidents.filter(i => 
    i.aiGenerated &&
    i.targetNodeId === aiIncident.targetNodeId &&
    (i.aiCategory === aiIncident.category || 
     // Cache/Database incidents are often related
     (aiIncident.category === 'CACHE' && i.aiCategory === 'CACHE') ||
     (aiIncident.category === 'DATABASE' && i.aiCategory === 'DATABASE') ||
     (aiIncident.category === 'COMPUTE' && i.aiCategory === 'COMPUTE') ||
     (aiIncident.category === 'QUEUE' && i.aiCategory === 'QUEUE')
    ) &&
    (now - i.startTime) < 60000 // Within last 60 seconds
  );
  
  const newIncident: ActiveIncident = {
    id: uniqueId,
    definitionId: 'ai_generated',
    targetNodeId: aiIncident.targetNodeId,
    severity: aiIncident.severity,
    startTime: Date.now(),
    escalationTimer: 0,
    outagetimer: aiIncident.autoResolveSeconds || 300,
    mitigationLevel: 0,
    mitigationProgress: 0,
    aiGenerated: true,
    aiIncidentName: aiIncident.incidentName,
    aiDescription: aiIncident.description,
    aiLogs: aiIncident.logs || '',
    aiSuggestedActions: aiIncident.suggestedActions,
    aiEffects: aiIncident.effects,
    aiCategory: aiIncident.category,
    relatedIncidentIds: relatedIncidents.map(i => i.id),
    rootCauseShared: relatedIncidents.length > 0,
  };
  
  // Link related incidents bidirectionally
  if (relatedIncidents.length > 0) {
    console.log(`🔗 Linking incident "${aiIncident.incidentName}" to ${relatedIncidents.length} related incident(s)`);
    relatedIncidents.forEach(relatedIncident => {
      if (!relatedIncident.relatedIncidentIds) {
        relatedIncident.relatedIncidentIds = [];
      }
      if (!relatedIncident.relatedIncidentIds.includes(uniqueId)) {
        relatedIncident.relatedIncidentIds.push(uniqueId);
      }
      relatedIncident.rootCauseShared = true;
    });
  }
  
  console.log('✅ AI Incident Added:', aiIncident.incidentName);
  
  // Play sound based on severity
  if (aiIncident.severity === 'CRIT') {
    soundNotifications.playIncidentCRIT();
  } else if (aiIncident.severity === 'WARN') {
    soundNotifications.playIncidentWARN();
  } else {
    soundNotifications.playIncidentINFO();
  }
  
  return {
    ...state,
    activeIncidents: [...state.activeIncidents, newIncident],
    totalIncidents: state.totalIncidents + 1,
  };
}

function debugSpawnIncident(state: GameState, incidentId: string, targetNodeId: string): GameState {
  const incidentDef = INCIDENTS.find(i => i.id === incidentId);
  if (!incidentDef) return state;

  const newIncident: ActiveIncident = {
    id: `debug_${Date.now()}`,
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
