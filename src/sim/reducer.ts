// Game state reducer

import { GameState, ActiveIncident, ComponentNode } from './types';
import { SeededRNG } from './rng';
import { ACTIONS } from '../data/actions';
import { INCIDENTS } from '../data/incidents';
import { applyStakeholderEffect } from '../data/stakeholders';
import { GAME_CONFIG } from '../config/gameConfig';
import { clampMetric } from './clampMetrics';
import { soundNotifications } from '../utils/soundNotifications';
import { createComponentNode } from './componentInitializer';
import { cloneGameState } from '../utils/stateUtils';
import { tlog } from '../utils/terminalLog';
import { COMPONENT_BLUEPRINTS } from '../config/progressionConfig';
import { deployComponent } from '../data/architecture';

/**
 * O3: Shared helper for applying mitigation to related incidents (same root cause).
 * Used in 4 places: action start, instant action, AI action, and action completion.
 */
export function applyRelatedMitigation(
  activeIncidents: ActiveIncident[],
  incident: ActiveIncident,
  mitigationAmount: number
): void {
  if (!incident.relatedIncidentIds || incident.relatedIncidentIds.length === 0) return;
  
  incident.relatedIncidentIds.forEach(relatedId => {
    const relatedIncident = activeIncidents.find(i => i.id === relatedId);
    if (relatedIncident) {
      relatedIncident.mitigationLevel = Math.min(1.0, relatedIncident.mitigationLevel + mitigationAmount);
      relatedIncident.mitigationProgress = relatedIncident.mitigationLevel;
    }
  });
  
  tlog.success(`🔗 Fully mitigated ${incident.relatedIncidentIds.length} related incident(s) (100% - shared root cause!)`);
}

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
  | { type: 'DEBUG_SPAWN_INCIDENT'; incidentId: string; targetNodeId: string }
  // Enhancement features
  | { type: 'UPDATE_STATUS_PAGE'; level: GameState['statusPageLevel']; message: string }
  | { type: 'RESPOND_STAKEHOLDER'; messageId: string; responseIndex: number }
  | { type: 'DISMISS_STAKEHOLDER'; messageId: string }
  | { type: 'ACKNOWLEDGE_PAGER' }
  | { type: 'COMPLETE_POSTMORTEM'; actionItems: string[] }
  | { type: 'SKIP_POSTMORTEM' }
  | { type: 'UNLOCK_ACHIEVEMENT'; achievementId: string }
  // Progressive architecture
  | { type: 'DEPLOY_COMPONENT'; componentId: string }
  | { type: 'DEPLOYMENT_COMPLETE'; componentId: string };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TICK':
      return state; // Handled in App component via tickSimulation

    case 'TOGGLE_PAUSE':
      return { ...state, paused: !state.paused };

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    case 'DEPLOY_COMPONENT': {
      const blueprint = COMPONENT_BLUEPRINTS.find(b => b.id === action.componentId);
      if (!blueprint) return state;
      if (state.deployedComponents.has(action.componentId)) return state;
      if (state.deployingComponents.has(action.componentId)) return state;
      if (state.cash < blueprint.deployCost) return state;

      // Check prerequisites
      if (blueprint.prerequisites.some(req => !state.deployedComponents.has(req))) return state;

      const newState = cloneGameState(state);
      newState.cash -= blueprint.deployCost;
      newState.deployingComponents.set(action.componentId, {
        startTime: Date.now(),
        durationSec: blueprint.deployDurationSec,
      });
      tlog.info(`🚀 Deploying ${blueprint.name} ($${blueprint.deployCost})...`);
      return newState;
    }

    case 'DEPLOYMENT_COMPLETE': {
      const blueprint = COMPONENT_BLUEPRINTS.find(b => b.id === action.componentId);
      if (!blueprint) return state;

      const newState = cloneGameState(state);
      newState.deployingComponents.delete(action.componentId);
      newState.deployedComponents.add(action.componentId);

      // Add the component to the architecture
      deployComponent(newState.architecture, action.componentId, blueprint.edges);

      // Add recurring cost
      newState.costs += blueprint.ongoingCostPerSec;

      // Record deployment history
      newState.componentDeploymentHistory.push({
        componentId: action.componentId,
        deployedAt: Date.now(),
        cost: blueprint.deployCost,
      });

      tlog.success(`✅ ${blueprint.name} is now live!`);
      return newState;
    }

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

    // === Enhancement Feature Handlers ===

    case 'UPDATE_STATUS_PAGE':
      return {
        ...state,
        statusPageLevel: action.level,
        statusPageLastUpdated: Date.now(),
        statusPageHistory: [
          ...state.statusPageHistory,
          { level: action.level, message: action.message, timestamp: Date.now() },
        ].slice(-20), // Keep last 20
      };

    case 'RESPOND_STAKEHOLDER': {
      const msg = state.stakeholderMessages.find(m => m.id === action.messageId);
      if (!msg || action.responseIndex >= msg.responses.length) return state;
      const effect = applyStakeholderEffect(msg.responses[action.responseIndex].effect);
      return {
        ...state,
        reputation: Math.max(0, Math.min(100, state.reputation + effect.reputationDelta)),
        burnout: Math.max(0, Math.min(100, state.burnout + effect.burnoutDelta)),
        techDebt: Math.max(0, Math.min(100, state.techDebt + effect.techDebtDelta)),
        cash: state.cash + effect.cashDelta,
        stakeholderMessages: state.stakeholderMessages.map(m =>
          m.id === action.messageId ? { ...m, selectedResponse: action.responseIndex } : m
        ),
      };
    }

    case 'DISMISS_STAKEHOLDER':
      return {
        ...state,
        reputation: Math.max(0, state.reputation - 3), // Ignoring has consequences
        burnout: Math.max(0, state.burnout - 2),
        stakeholderMessages: state.stakeholderMessages.filter(m => m.id !== action.messageId),
      };

    case 'ACKNOWLEDGE_PAGER':
      return {
        ...state,
        pagerAcknowledged: true,
        reputation: Math.min(100, state.reputation + 2), // Prompt acknowledgement bonus
      };

    case 'COMPLETE_POSTMORTEM': {
      const effects = {
        reputationDelta: 5,
        techDebtDelta: 0,
        burnoutDelta: 0,
      };
      // Apply action item benefits
      action.actionItems.forEach(item => {
        switch (item) {
          case 'circuit_breakers': effects.techDebtDelta -= 5; break;
          case 'redundant_region': effects.reputationDelta += 5; break;
          case 'chaos_testing': effects.techDebtDelta -= 3; break;
          case 'runbook_update': effects.burnoutDelta -= 5; break;
          case 'alert_tuning': break; // Alert fatigue handled separately
          case 'capacity_planning': effects.reputationDelta += 3; break;
          case 'postmortem_review': effects.reputationDelta += 2; effects.burnoutDelta -= 3; break;
        }
      });
      return {
        ...state,
        postMortemQueue: state.postMortemQueue.slice(1),
        postMortemsCompleted: state.postMortemsCompleted + 1,
        reputation: Math.max(0, Math.min(100, state.reputation + effects.reputationDelta)),
        techDebt: Math.max(0, Math.min(100, state.techDebt + effects.techDebtDelta)),
        burnout: Math.max(0, Math.min(100, state.burnout + effects.burnoutDelta)),
        alertFatigue: action.actionItems.includes('alert_tuning')
          ? Math.max(0, state.alertFatigue - 5)
          : state.alertFatigue,
      };
    }

    case 'SKIP_POSTMORTEM':
      return {
        ...state,
        postMortemQueue: state.postMortemQueue.slice(1),
      };

    case 'UNLOCK_ACHIEVEMENT':
      if (state.achievements.has(action.achievementId)) return state;
      return {
        ...state,
        achievements: new Set([...state.achievements, action.achievementId]),
        recentAchievement: action.achievementId,
        recentAchievementTime: Date.now(),
      };

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
    // CRITICAL: Deep clone to prevent mutation!
    const failedState = {
      ...state,
      actionCooldowns: new Map(state.actionCooldowns),
    };
    failedState.actionCooldowns.set(actionId, Date.now() + actionDef.cooldownSeconds * 1000);
    return failedState;
  }

  // O1: Use centralized deep-clone utility instead of inline copy-paste
  const newState = cloneGameState(state);

  // Deduct cash AFTER cloning
  newState.cash -= actionDef.oneTimeCost; // For negative costs, this adds money

  newState.actionCooldowns.set(actionId, Date.now() + actionDef.cooldownSeconds * 1000);

  // Special handling for specific actions
  if (actionId === 'price_increase') {
    newState.pricing *= 1.1; // 10% price increase
    tlog.success(`💰 Pricing increased to $${newState.pricing.toFixed(2)}/user/day`);
  }

  if (actionId === 'marketing_campaign') {
    // Temporary user growth boost (handled in growth calculation)
    // Add a temporary flag or multiplier
    newState.reputation += 15;
    tlog.success(`📣 Marketing campaign launched! User growth +50% for 2 minutes`);
  }

  // Apply effects
  if (actionDef.effects) {
    const effects = actionDef.effects;

    // Stat changes
    if (effects.statChanges) {
      const targetNode = actionDef.target === 'global' 
        ? null 
        : newState.architecture.nodes.get(actionDef.target);
      if (targetNode) {
        const changes = effects.statChanges;
        if (changes.capacity) {
          targetNode.capacity += changes.capacity;
          // Capacity improvements also help recover health
          const oldHealth = targetNode.health;
          targetNode.health = Math.min(1.0, targetNode.health + 0.1);
          if (targetNode.health > oldHealth) {
            tlog.success(`💚 ${targetNode.name} health improved: ${(oldHealth * 100).toFixed(0)}% → ${(targetNode.health * 100).toFixed(0)}%`);
          }
        }
        if (changes.reliability) {
          targetNode.reliabilityScore += changes.reliability;
          // Reliability improvements help recover health
          const oldHealth = targetNode.health;
          targetNode.health = Math.min(1.0, targetNode.health + 0.05);
          if (targetNode.health > oldHealth) {
            tlog.success(`💚 ${targetNode.name} health improved: ${(oldHealth * 100).toFixed(0)}% → ${(targetNode.health * 100).toFixed(0)}%`);
          }
        }
        if (changes.security) targetNode.securityScore += changes.security;
        if (changes.latency) targetNode.baseLatency += changes.latency;
        if (changes.errorRate) targetNode.baseError += changes.errorRate;
        
        // Auto-recover from degraded/down states if health improves enough
        if (targetNode.operationalMode === 'degraded' && targetNode.health >= 0.7) {
          targetNode.operationalMode = 'normal';
          tlog.success(`✅ ${targetNode.name} operational mode: degraded → normal`);
        } else if (targetNode.operationalMode === 'down' && targetNode.health >= 0.5) {
          targetNode.operationalMode = 'degraded';
          tlog.success(`⚠️ ${targetNode.name} operational mode: down → degraded`);
        }
      }
    }

    // Feature toggle
    if (effects.featureToggle) {
      const targetNode = actionDef.target === 'global'
        ? null
        : newState.architecture.nodes.get(actionDef.target);

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
      const node = newState.architecture.nodes.get(effects.enableNode);
      if (node) {
        node.enabled = true;
        node.locked = false;
      }
    }

    // Scale node
    if (effects.scaleNode) {
      const node = newState.architecture.nodes.get(effects.scaleNode.nodeId);
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
          tlog.success(`💚 ${node.name} health recovered: ${(oldHealth * 100).toFixed(0)}% → ${(node.health * 100).toFixed(0)}%`);
        }
        
        // Auto-recover from degraded/down states if health improves enough
        if (node.operationalMode === 'degraded' && node.health >= 0.7) {
          node.operationalMode = 'normal';
          tlog.success(`✅ ${node.name} operational mode: degraded → normal`);
        } else if (node.operationalMode === 'down' && node.health >= 0.5) {
          node.operationalMode = 'degraded';
          tlog.success(`⚠️ ${node.name} operational mode: down → degraded`);
        }
        
        tlog.system(`📊 ${node.name} scaled: ×${oldScaling} → ×${node.scaling.current}`);
        
        // Update component-specific metrics when scaling
        if (node.specificMetrics) {
          if ('instances' in node.specificMetrics) {
            const oldInstances = node.specificMetrics.instances;
            node.specificMetrics.instances = node.scaling.current;
            tlog.info(`   instances: ${oldInstances} → ${node.specificMetrics.instances}`);
          }
          // Scaling increases capacity, reduces queue backlog
          if ('queueBacklog' in node.specificMetrics && effects.scaleNode.delta > 0) {
            const oldBacklog = node.specificMetrics.queueBacklog;
            node.specificMetrics.queueBacklog = Math.max(0, node.specificMetrics.queueBacklog * 0.7);
            tlog.info(`   queueBacklog: ${oldBacklog} → ${node.specificMetrics.queueBacklog} (-${Math.round((1 - 0.7) * 100)}%)`);
          }
        }
      }
    }

    // Downtime risk
    if (effects.downtimeRisk && rng.next() < effects.downtimeRisk) {
      // Cause brief outage
      const targetNode = actionDef.target === 'global'
        ? null
        : newState.architecture.nodes.get(actionDef.target);
      if (targetNode) {
        targetNode.health = Math.max(0.3, targetNode.health - 0.5);
        targetNode.operationalMode = 'degraded';
      }
    }

    // Add component (dynamic architecture)
    if (effects.addComponent) {
      const { type, baseNodeId, redundancyGroup, isPrimary, connections } = effects.addComponent;
      const baseNode = state.architecture.nodes.get(baseNodeId);
      
      if (baseNode) {
        // Generate new instance ID
        const baseType = type.toLowerCase();
        const counter = newState.componentCounters.get(baseType) || 0;
        const newCounter = counter + 1;
        newState.componentCounters.set(baseType, newCounter);
        
        const newNodeId = newCounter === 1 ? baseType : `${baseType}_${newCounter}`;
        
        // Use component initializer to ensure proper metrics
        
        // Create new node with proper metrics initialization
        const newNode = createComponentNode(
          type,
          newNodeId,
          newCounter === 1 ? baseNode.name : `${baseNode.name} ${newCounter}`,
          baseNode
        );
        
        // Override specific properties
        newNode.redundancyGroup = redundancyGroup || baseNode.redundancyGroup;
        newNode.isPrimary = isPrimary !== undefined ? isPrimary : false;
        newNode.instanceNumber = newCounter;
        
        // Add to architecture
        newState.architecture.nodes.set(newNodeId, newNode);
        
        // Add connections
        if (connections) {
          connections.forEach(conn => {
            // Resolve 'source' or 'target' placeholders to the new node ID
            const from = (conn.from === 'source' || conn.from === 'target') ? newNodeId : conn.from;
            const to = (conn.to === 'target' || conn.to === 'source') ? newNodeId : conn.to;
            newState.architecture.edges.push({ from, to, weight: conn.weight });
          });
        }
        
        tlog.success(`✨ Added component: ${newNode.name} (${newNodeId})`);
        tlog.info(`   Type: ${type} | Group: ${redundancyGroup || 'none'}`);
        tlog.info(`   Cost: $${newNode.costPerSec.toFixed(3)}/sec`);
      }
    }

    // Remove component (dynamic architecture)
    if (effects.removeComponent) {
      const { nodeId } = effects.removeComponent;
      const node = state.architecture.nodes.get(nodeId);
      
      if (node) {
        // Remove node
        newState.architecture.nodes.delete(nodeId);
        
        // Remove all edges connected to this node
        newState.architecture.edges = newState.architecture.edges.filter(
          edge => edge.from !== nodeId && edge.to !== nodeId
        );
        
        // Update counter
        const baseType = node.type.toLowerCase();
        const counter = newState.componentCounters.get(baseType) || 1;
        newState.componentCounters.set(baseType, Math.max(0, counter - 1));
        
        tlog.warn(`🗑️ Removed component: ${node.name} (${nodeId})`);
        tlog.info(`   Saved: $${node.costPerSec.toFixed(3)}/sec`);
      }
    }

    // Split service (microservices pattern)
    if (effects.splitService) {
      const { serviceName, type, trafficPercentage } = effects.splitService;
      const serviceId = serviceName.toLowerCase();
      
      // Check if service already exists
      if (!state.architecture.nodes.has(serviceId)) {
        // Find app node as template
        const appNode = state.architecture.nodes.get('app');
        
        if (appNode) {
          // Create new service node
          const newNode: ComponentNode = {
            id: serviceId,
            type,
            name: `${serviceName} Service`,
            enabled: true,
            locked: false,
            capacity: appNode.capacity * 0.5, // 50% of app capacity
            baseLatency: appNode.baseLatency * 0.8, // 20% faster (specialized)
            baseError: appNode.baseError * 0.7, // 30% fewer errors (focused)
            health: 1.0,
            reliabilityScore: 0.95,
            securityScore: serviceName === 'auth' || serviceName === 'payment' ? 0.98 : 0.9,
            scaling: { min: 1, max: 5, current: 1, cooldownUntil: 0 },
            utilization: 0,
            latency: appNode.baseLatency * 0.8,
            errorRate: appNode.baseError * 0.7,
            loadIn: 0,
            loadOut: 0,
            costPerSec: appNode.costPerSec * 0.6, // 60% of app cost
            operationalMode: 'normal',
            specificMetrics: { ...appNode.specificMetrics }, // Clone metrics
            features: { ...appNode.features },
            redundancyGroup: `${serviceId}_cluster`,
            isPrimary: true,
            instanceNumber: 1,
          };
          
          newState.architecture.nodes.set(serviceId, newNode);
          
          // Add connections: app -> service (for delegated requests)
          newState.architecture.edges.push({
            from: 'app',
            to: serviceId,
            weight: trafficPercentage / 100,
          });
          
          // Service needs DB access
          if (serviceName === 'auth' || serviceName === 'payment') {
            newState.architecture.edges.push({
              from: serviceId,
              to: 'db_primary',
              weight: 0.3,
            });
          }
          
          // Service might need cache
          if (serviceName !== 'notification') {
            newState.architecture.edges.push({
              from: serviceId,
              to: 'cache',
              weight: 0.4,
            });
          }
          
          // Update counter
          const baseType = type.toLowerCase();
          const counter = newState.componentCounters.get(baseType) || 0;
          newState.componentCounters.set(baseType, counter + 1);
          
          tlog.success(`🚀 Split ${serviceName} Service from monolith`);
          tlog.info(`   Handles ${trafficPercentage}% of app traffic`);
          tlog.info(`   Microservices architecture enabled`);
        }
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
  // I1 FIX: Removed duplicate increase_price handler (price_increase at line 167 already handles 10%)

  // Dynamic remove operations - find and remove highest instance number
  if (actionId === 'remove_app_instance') {
    const appInstances = Array.from(newState.architecture.nodes.values())
      .filter(n => n.type === 'APP' && n.redundancyGroup === 'app_cluster')
      .sort((a, b) => (b.instanceNumber || 0) - (a.instanceNumber || 0));
    
    if (appInstances.length > 1) {
      const toRemove = appInstances[0];
      newState.architecture.nodes.delete(toRemove.id);
      newState.architecture.edges = newState.architecture.edges.filter(
        e => e.from !== toRemove.id && e.to !== toRemove.id
      );
      const counter = newState.componentCounters.get('app') || 1;
      newState.componentCounters.set('app', Math.max(1, counter - 1));
      
      tlog.warn(`🗑️ Removed ${toRemove.name} - saving $${toRemove.costPerSec.toFixed(3)}/sec`);
    }
  }

  if (actionId === 'remove_worker_instance') {
    const workerInstances = Array.from(newState.architecture.nodes.values())
      .filter(n => n.type === 'WORKERS' && n.redundancyGroup === 'worker_pool')
      .sort((a, b) => (b.instanceNumber || 0) - (a.instanceNumber || 0));
    
    if (workerInstances.length > 1) {
      const toRemove = workerInstances[0];
      newState.architecture.nodes.delete(toRemove.id);
      newState.architecture.edges = newState.architecture.edges.filter(
        e => e.from !== toRemove.id && e.to !== toRemove.id
      );
      const counter = newState.componentCounters.get('workers') || 1;
      newState.componentCounters.set('workers', Math.max(1, counter - 1));
      
      tlog.warn(`🗑️ Removed ${toRemove.name} - saving $${toRemove.costPerSec.toFixed(3)}/sec`);
    }
  }

  if (actionId === 'remove_cache_emergency') {
    const cacheNode = newState.architecture.nodes.get('cache');
    if (cacheNode) {
      cacheNode.enabled = false;
      tlog.warn(`⚠️ Cache DISABLED - DB load will increase 3x!`);
    }
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
        
        // O3: Use shared helper instead of inline duplicate
        applyRelatedMitigation(newState.activeIncidents, incident, immediateMitigation);
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
      
      // O3: Use shared helper instead of inline duplicate
      applyRelatedMitigation(newState.activeIncidents, incident, mitigationAmount);
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
  // Check cost first
  if (state.cash < cost) return state;

  // O1: Use centralized deep-clone utility
  const newState = cloneGameState(state);

  // Apply immediate mitigation when AI action starts
  if (mitigatingIncidentId) {
    const incident = newState.activeIncidents.find(i => i.id === mitigatingIncidentId);
    if (incident) {
      const immediateMitigation = GAME_CONFIG.incidents.immediateMitigationOnActionStart;
      incident.mitigationLevel = Math.min(1.0, incident.mitigationLevel + immediateMitigation);
      incident.mitigationProgress = incident.mitigationLevel;
      
      // O3: Use shared helper instead of inline duplicate
      applyRelatedMitigation(newState.activeIncidents, incident, immediateMitigation);
      
      // O5: metricImprovements is now typed on the action interface
      const action = incident.aiSuggestedActions?.find(a => a.actionName === actionName);
      if (action?.metricImprovements) {
        const targetNode = newState.architecture.nodes.get(incident.targetNodeId);
        if (targetNode && targetNode.specificMetrics) {
          const improvements = action.metricImprovements;
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

  // Play sound when action starts
  soundNotifications.playActionStart();

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
  
  // O5: aiIncidentName is typed on ActiveIncident
  const exists = state.activeIncidents.some(i => 
    i.aiGenerated && i.aiIncidentName === aiIncident.incidentName
  );
  
  if (exists) {
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
  
  // M5 FIX: Link related incidents bidirectionally on cloned incident array
  // We must not mutate the old state's incidents
  if (relatedIncidents.length > 0) {
    // spawnAIIncident returns a new state with cloned incidents, so we build it here
    const clonedIncidents = state.activeIncidents.map(inc => {
      const isRelated = relatedIncidents.some(r => r.id === inc.id);
      if (isRelated) {
        return {
          ...inc,
          relatedIncidentIds: [...(inc.relatedIncidentIds || []), uniqueId],
          rootCauseShared: true,
        };
      }
      return { ...inc };
    });
    
    return {
      ...state,
      activeIncidents: [...clonedIncidents, newIncident],
      totalIncidents: state.totalIncidents + 1,
    };
  }
  
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
