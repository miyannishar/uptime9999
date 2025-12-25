// Main simulation engine

import { GameState } from './types';
import { SeededRNG } from './rng';
import {
  getActivityRate,
  computeLatency,
  computeErrorRate,
  computeNodeCapacity,
  computeRevenue,
  computeGrowthRate,
  computeChurnRate,
  computeReputationDelta,
  computeAlertFatigueGrowth,
  computeHazardMultiplier,
  computeDifficultyMultiplier,
} from './formulas';
import { INCIDENTS } from '../data/incidents';
import { createInitialArchitecture } from '../data/architecture';
import { GAME_CONFIG } from '../config/gameConfig';

export function createInitialState(seed: string): GameState {
  const architecture = createInitialArchitecture();
  const startTime = Date.now();

  return {
    seed,
    startTime,
    currentTime: startTime,
    dayOfWeek: 1,
    hourOfDay: 9,
    paused: false,
    speed: 1,

    architecture,

    users: GAME_CONFIG.starting.users,
    peakUsers: GAME_CONFIG.starting.users,
    rps: 0,
    cash: GAME_CONFIG.starting.cash,
    revenue: 0,
    costs: 0,
    pricing: GAME_CONFIG.starting.pricing,
    reputation: GAME_CONFIG.starting.reputation,

    globalErrorRate: 0,
    globalLatencyP95: 0,
    uptime: 1.0,
    uptimeWindow: Array(GAME_CONFIG.simulation.uptimeWindowSize).fill(1),
    uptimeStreak: 0,
    longestStreak: 0,

    techDebt: GAME_CONFIG.starting.techDebt,
    alertFatigue: GAME_CONFIG.starting.alertFatigue,
    burnout: 0,

    observabilityLevel: GAME_CONFIG.starting.observabilityLevel,

    activeIncidents: [],
    resolvedIncidents: 0,

    actionsInProgress: [],
    actionCooldowns: new Map(),

    unlockedFeatures: new Set(),

    fundingRound: 'bootstrap',
    investorPressure: 0,

    gameOver: false,

    totalProfit: 0,
    totalIncidents: 0,
  };
}

export function tickSimulation(state: GameState, rng: SeededRNG, dt: number = 1): GameState {
  if (state.paused || state.gameOver) return state;

  const newState = { ...state };
  const elapsed = (Date.now() - state.startTime) / 1000;

  // Update time
  newState.currentTime = Date.now();
  newState.hourOfDay = Math.floor((elapsed / 3600) % 24);
  newState.dayOfWeek = Math.floor((elapsed / 86400) % 7);

  // === 1. TRAFFIC GENERATION ===
  const activityRate = getActivityRate(newState.hourOfDay, newState.dayOfWeek);
  const baseRPS = newState.users * activityRate * 0.01; // 1% of users active
  newState.rps = Math.max(0, baseRPS);

  // === 2. PROPAGATE LOAD THROUGH ARCHITECTURE ===
  propagateLoad(newState, newState.rps);

  // === 3. APPLY INCIDENT EFFECTS ===
  applyIncidentEffects(newState, dt);

  // === 4. COMPUTE GLOBAL METRICS ===
  computeGlobalMetrics(newState);

  // === 5. UPDATE UPTIME ===
  updateUptime(newState, dt);

  // === 6. BUSINESS LOGIC ===
  updateBusiness(newState, dt);

  // === 7. SPAWN INCIDENTS ===
  spawnIncidents(newState, rng, dt);

  // === 8. RESOLVE INCIDENTS ===
  updateIncidents(newState, dt);

  // === 9. UPDATE ACTIONS ===
  updateActions(newState, dt);

  // === 10. CHECK GAME OVER ===
  checkGameOver(newState);

  // === 11. UPDATE STRESS ===
  updateStress(newState, dt);

  return newState;
}

function propagateLoad(state: GameState, ingressRPS: number) {
  const { nodes, edges } = state.architecture;

  // Reset load
  nodes.forEach(node => {
    node.loadIn = 0;
    node.loadOut = 0;
  });

  // Start at DNS
  const dnsNode = nodes.get('dns');
  if (dnsNode) {
    dnsNode.loadIn = ingressRPS;
  }

  // Topological propagation (simplified BFS)
  const visited = new Set<string>();
  const queue = ['dns'];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const current = nodes.get(currentId);
    if (!current || !current.enabled) continue;

    // Compute output load
    const capacity = computeNodeCapacity(current);
    const utilization = capacity > 0 ? current.loadIn / capacity : 0;
    current.utilization = utilization;

    // Compute latency and error rate
    current.latency = computeLatency(current.baseLatency, utilization);
    current.errorRate = computeErrorRate(current.baseError, utilization, current.health);

    // Update operational mode
    if (current.health < 0.3 || utilization > 3) {
      current.operationalMode = 'down';
    } else if (current.health < 0.7 || utilization > 1.5) {
      current.operationalMode = 'degraded';
    } else {
      current.operationalMode = 'normal';
    }

    // Propagate to downstream
    const outgoingEdges = edges.filter(e => e.from === currentId);
    for (const edge of outgoingEdges) {
      const target = nodes.get(edge.to);
      if (target && target.enabled) {
        const propagatedLoad = current.loadIn * edge.weight * (1 - current.errorRate);
        target.loadIn += propagatedLoad;
        current.loadOut += propagatedLoad;
        
        if (!visited.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }
  }
}

function applyIncidentEffects(state: GameState, dt: number) {
  const { nodes } = state.architecture;

  for (const incident of state.activeIncidents) {
    const incidentDef = INCIDENTS.find(i => i.id === incident.definitionId);
    if (!incidentDef) continue;

    const targetNode = nodes.get(incident.targetNodeId);
    if (!targetNode) continue;

    const effects = incidentDef.effects;
    const mitigationFactor = 1 - incident.mitigationLevel * 0.7; // Max 70% reduction

    // Apply effects
    if (effects.utilizationMultiplier) {
      targetNode.utilization *= effects.utilizationMultiplier * mitigationFactor;
    }
    if (effects.latencyMultiplier) {
      targetNode.latency *= effects.latencyMultiplier * mitigationFactor;
    }
    if (effects.errorMultiplier) {
      targetNode.errorRate *= effects.errorMultiplier * mitigationFactor;
    }
    if (effects.healthDecayPerSec) {
      targetNode.health = Math.max(0, targetNode.health - effects.healthDecayPerSec * dt * mitigationFactor);
    }
    if (effects.capacityMultiplier) {
      targetNode.capacity *= effects.capacityMultiplier;
    }

    // Escalation timer
    if (incidentDef.escalationTimeSeconds && incident.escalationTimer > 0) {
      incident.escalationTimer -= dt;
      if (incident.escalationTimer <= 0 && incidentDef.escalatesTo) {
        // Spawn escalated incident
        const escalatedDef = INCIDENTS.find(i => i.id === incidentDef.escalatesTo);
        if (escalatedDef) {
          state.activeIncidents.push({
            id: `incident_${Date.now()}_${Math.random()}`,
            definitionId: escalatedDef.id,
            targetNodeId: incident.targetNodeId,
            severity: escalatedDef.severity,
            startTime: Date.now(),
            escalationTimer: escalatedDef.escalationTimeSeconds || 0,
            outagetimer: escalatedDef.timeToOutageSeconds || 0,
            mitigationLevel: 0,
            mitigationProgress: 0,
          });
        }
      }
    }

    // Outage timer
    if (incidentDef.timeToOutageSeconds && incident.outagetimer > 0) {
      incident.outagetimer -= dt;
      if (incident.outagetimer <= 0) {
        targetNode.operationalMode = 'down';
        targetNode.health = 0;
      }
    }
  }
}

function computeGlobalMetrics(state: GameState) {
  const { nodes } = state.architecture;

  let totalError = 0;
  let totalLatency = 0;
  let count = 0;

  nodes.forEach(node => {
    if (node.enabled && node.type !== 'OBSERVABILITY') {
      totalError += node.errorRate;
      totalLatency += node.latency;
      count++;
    }
  });

  state.globalErrorRate = count > 0 ? totalError / count : 0;
  state.globalLatencyP95 = count > 0 ? totalLatency / count : 0;
}

function updateUptime(state: GameState, dt: number) {
  // Check if system is up - check critical nodes too
  const { nodes } = state.architecture;
  
  // Critical nodes that must be up
  const criticalNodes = ['dns', 'app', 'db_primary'];
  const criticalNodesUp = criticalNodes.every(id => {
    const node = nodes.get(id);
    return node && node.enabled && node.operationalMode !== 'down' && node.health > 0.1;
  });
  
  // System is up if error rate is reasonable, latency is acceptable, and critical nodes are healthy
  const isUp = criticalNodesUp && 
               state.globalErrorRate < 0.5 && 
               state.globalLatencyP95 < 5000;
  
  const uptimeValue = isUp ? 1 : 0;

  // Update window
  state.uptimeWindow.shift();
  state.uptimeWindow.push(uptimeValue);

  // Compute rolling uptime
  const sum = state.uptimeWindow.reduce((a, b) => a + b, 0);
  state.uptime = sum / state.uptimeWindow.length;

  // Update streak
  if (isUp) {
    state.uptimeStreak += dt;
    state.longestStreak = Math.max(state.longestStreak, state.uptimeStreak);
  } else {
    state.uptimeStreak = 0;
  }
}

function updateBusiness(state: GameState, dt: number) {
  // Compute costs
  let infrastructureCost = 0;
  state.architecture.nodes.forEach(node => {
    if (node.enabled) {
      infrastructureCost += node.costPerSec * node.scaling.current;
    }
  });

  state.costs = infrastructureCost;

  // Compute revenue
  state.revenue = computeRevenue(state.users, state.pricing, state.reputation, state.uptime);

  // Update cash
  const cashDelta = (state.revenue - state.costs) * dt;
  state.cash += cashDelta;
  state.totalProfit += cashDelta;

  // User growth
  const growthRate = computeGrowthRate(
    state.reputation,
    state.globalLatencyP95,
    state.globalErrorRate,
    1.0
  );
  const churnRate = computeChurnRate(
    state.globalLatencyP95,
    state.globalErrorRate,
    state.uptime < 0.9
  );

  const userDelta = (growthRate - churnRate) * state.users * dt / 1000;
  state.users = Math.max(0, state.users + userDelta);
  state.peakUsers = Math.max(state.peakUsers, state.users);

  // Reputation
  const severityScore = state.activeIncidents.reduce((sum, inc) => {
    return sum + (inc.severity === 'CRIT' ? 3 : inc.severity === 'WARN' ? 2 : 1);
  }, 0);
  const reputationDelta = computeReputationDelta(state.uptime, state.globalErrorRate, severityScore / 10);
  state.reputation = Math.max(0, Math.min(100, state.reputation + reputationDelta * dt));
}

function spawnIncidents(state: GameState, rng: SeededRNG, dt: number) {
  const elapsed = (Date.now() - state.startTime) / 1000;
  const difficultyMultiplier = computeDifficultyMultiplier(
    elapsed,
    state.peakUsers,
    state.uptimeStreak,
    state.cash
  );

  for (const incidentDef of INCIDENTS) {
    // Check preconditions
    const targets = Array.from(state.architecture.nodes.values()).filter(node => {
      if (!node.enabled) return false;
      if (!incidentDef.targetTypes.includes(node.type)) return false;

      const pre = incidentDef.preconditions;
      if (pre.minUtilization && node.utilization < pre.minUtilization) return false;
      if (pre.maxUtilization && node.utilization > pre.maxUtilization) return false;
      if (pre.featureDisabled && node.features[pre.featureDisabled as keyof typeof node.features]) return false;
      if (pre.minTechDebt && state.techDebt < pre.minTechDebt) return false;
      if (pre.minErrorRate && node.errorRate < pre.minErrorRate) return false;

      return true;
    });

    if (targets.length === 0) continue;

    // Compute spawn chance
    const target = rng.pick(targets);
    const hazardMult = computeHazardMultiplier(
      target.utilization,
      target.errorRate,
      state.techDebt,
      target.securityScore,
      difficultyMultiplier
    );

    const spawnChance = incidentDef.baseRatePerMinute * hazardMult * (dt / 60);

    if (rng.chance(spawnChance)) {
      // Spawn incident
      state.activeIncidents.push({
        id: `incident_${Date.now()}_${Math.random()}`,
        definitionId: incidentDef.id,
        targetNodeId: target.id,
        severity: incidentDef.severity,
        startTime: Date.now(),
        escalationTimer: incidentDef.escalationTimeSeconds || 0,
        outagetimer: incidentDef.timeToOutageSeconds || 0,
        mitigationLevel: 0,
        mitigationProgress: 0,
      });
      state.totalIncidents++;
    }
  }
}

function updateIncidents(state: GameState, _dt: number) {
  state.activeIncidents = state.activeIncidents.filter(incident => {
    const incidentDef = INCIDENTS.find(i => i.id === incident.definitionId);
    if (!incidentDef) return false;

    const elapsed = (Date.now() - incident.startTime) / 1000;

    // Auto-resolve
    if (incidentDef.autoResolveSeconds && elapsed > incidentDef.autoResolveSeconds) {
      state.resolvedIncidents++;
      return false;
    }

    // Fully mitigated
    if (incident.mitigationLevel >= 1.0) {
      state.resolvedIncidents++;
      return false;
    }

    return true;
  });
}

function updateActions(state: GameState, _dt: number) {
  const now = Date.now();
  const mitigationPerAction = GAME_CONFIG.incidents.mitigationPerAction;

  // Update mitigation progress for incidents
  state.activeIncidents.forEach(incident => {
    // Find the active (in-progress) mitigation action for this incident
    const activeAction = state.actionsInProgress.find(
      a => a.mitigatingIncidentId === incident.id && now < a.endTime
    );
    
    if (activeAction) {
      const duration = activeAction.endTime - activeAction.startTime;
      const elapsed = Math.max(0, now - activeAction.startTime);
      const progress = Math.min(1.0, elapsed / duration);
      
      // Show real-time progress: base mitigation + current action progress
      // Use config for mitigation amount
      incident.mitigationProgress = Math.min(1.0, incident.mitigationLevel + (progress * mitigationPerAction));
    } else {
      // No active action, progress equals base level
      incident.mitigationProgress = incident.mitigationLevel;
    }
  });

  // Remove completed actions and finalize their mitigation
  state.actionsInProgress = state.actionsInProgress.filter(action => {
    if (now >= action.endTime) {
      // Action complete - finalize mitigation if it was mitigating an incident
      if (action.mitigatingIncidentId) {
        const incident = state.activeIncidents.find(i => i.id === action.mitigatingIncidentId);
        if (incident) {
          // Permanently add to base mitigation level using config
          incident.mitigationLevel = Math.min(1.0, incident.mitigationLevel + mitigationPerAction);
          incident.mitigationProgress = incident.mitigationLevel;
        }
      }
      return false; // Remove completed action
    }
    return true; // Keep in-progress action
  });
}

function updateStress(state: GameState, dt: number) {
  // Alert fatigue
  const fatigueGrowth = computeAlertFatigueGrowth(state.activeIncidents.length, 5);
  state.alertFatigue = Math.min(100, Math.max(0, state.alertFatigue + (fatigueGrowth - GAME_CONFIG.stress.alertFatigueDecay) * dt));

  // Burnout
  const burnoutGrowth = state.activeIncidents.filter(i => i.severity === 'CRIT').length * GAME_CONFIG.stress.burnoutPerCritIncident;
  state.burnout = Math.min(100, Math.max(0, state.burnout + (burnoutGrowth - GAME_CONFIG.stress.burnoutDecay) * dt));

  // Tech debt natural decay
  state.techDebt = Math.max(0, state.techDebt - GAME_CONFIG.stress.techDebtDecay * dt);
}

function checkGameOver(state: GameState) {
  if (state.cash < GAME_CONFIG.economy.bankruptcyThreshold) {
    state.gameOver = true;
    state.gameOverReason = 'Bankruptcy - Cash depleted';
  }

  if (state.reputation <= 0) {
    // Initialize reputation zero timer if not exists
    if (!(state as any).reputationZeroTimer) {
      (state as any).reputationZeroTimer = 0;
    }
    
    (state as any).reputationZeroTimer += 1;
    
    // Game over only if reputation stays at 0 for configured grace period
    if ((state as any).reputationZeroTimer >= GAME_CONFIG.economy.reputationGameOverGracePeriod) {
      state.gameOver = true;
      state.gameOverReason = 'Reputation destroyed - users lost trust';
    }
  } else {
    // Reset timer if reputation recovers
    (state as any).reputationZeroTimer = 0;
  }

  if (state.uptime < 0.5 && state.uptimeStreak === 0) {
    const critIncidents = state.activeIncidents.filter(i => i.severity === 'CRIT').length;
    if (critIncidents >= 3) {
      state.gameOver = true;
      state.gameOverReason = 'Multiple critical outages - system collapse';
    }
  }
}

