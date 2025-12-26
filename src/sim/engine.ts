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
} from './formulas';
import { INCIDENTS } from '../data/incidents';
import { createInitialArchitecture } from '../data/architecture';
import { GAME_CONFIG } from '../config/gameConfig';
import { clampMetric, clampAllMetrics } from './clampMetrics';

export function createInitialState(seed: string): GameState {
  const architecture = createInitialArchitecture();
  const startTime = Date.now();

  // Initialize component counters based on initial architecture
  const componentCounters = new Map<string, number>();
  architecture.nodes.forEach((node) => {
    const baseType = node.type.toLowerCase();
    const current = componentCounters.get(baseType) || 0;
    componentCounters.set(baseType, current + 1);
  });

  return {
    seed,
    startTime,
    currentTime: startTime,
    dayOfWeek: 1,
    hourOfDay: 9,
    paused: false,
    speed: 1,

    aiSessionActive: false, // Will be set to true when AI initializes
    recentIncidentTargets: [], // Track recently targeted nodes for diversity

    architecture,
    componentCounters,

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

export function tickSimulation(state: GameState, _rng: SeededRNG, dt: number = 1): GameState {
  if (state.paused || state.gameOver) return state;

  // CRITICAL: Deep clone state to prevent mutations
  // Maps and nested objects are NOT cloned by spread operator!
  const newState = {
    ...state,
    architecture: {
      nodes: new Map(state.architecture.nodes),
      edges: [...state.architecture.edges],
    },
    componentCounters: new Map(state.componentCounters),
    actionCooldowns: new Map(state.actionCooldowns),
    unlockedFeatures: new Set(state.unlockedFeatures),
    recentIncidentTargets: [...state.recentIncidentTargets],
    activeIncidents: state.activeIncidents.map(inc => ({ ...inc })),
    actionsInProgress: state.actionsInProgress.map(act => ({ ...act })),
    uptimeWindow: [...state.uptimeWindow],
  };
  
  // Deep clone nodes (they contain nested objects)
  newState.architecture.nodes = new Map(
    Array.from(state.architecture.nodes.entries()).map(([id, node]) => [
      id,
      {
        ...node,
        scaling: { ...node.scaling },
        specificMetrics: { ...node.specificMetrics },
        features: { ...node.features },
      },
    ])
  );
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

  // === 7. INCIDENTS ===
  // All incidents are now AI-generated based on system metrics
  
  // === 8. CLEANUP OLD INCIDENT TARGETS ===
  // Remove targets older than 60 seconds to allow re-targeting
  const now = Date.now();
  newState.recentIncidentTargets = newState.recentIncidentTargets.filter(
    t => now - t.timestamp < 60000
  );

  // === 9. RESOLVE INCIDENTS ===
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

    // Update operational mode and play sound if critical node goes down
    const previousMode = current.operationalMode;
    const isCriticalNode = ['dns', 'app', 'db_primary'].includes(currentId);
    
    if (current.health < 0.3 || utilization > 3) {
      current.operationalMode = 'down';
      // Play sound when critical node transitions to down (but not if it was already down)
      if (previousMode !== 'down' && isCriticalNode) {
        import('../utils/soundNotifications').then(({ soundNotifications }) => {
          soundNotifications.playSystemDown();
        });
      }
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
        
        // Check if target has redundancy group - distribute load across all instances
        if (target.redundancyGroup) {
          const groupInstances = Array.from(nodes.values()).filter(
            n => n.redundancyGroup === target.redundancyGroup && n.enabled && n.health > 0.3
          );
          
          if (groupInstances.length > 0) {
            // Distribute load evenly across healthy instances in the group
            const loadPerInstance = propagatedLoad / groupInstances.length;
            groupInstances.forEach(instance => {
              instance.loadIn += loadPerInstance;
              if (!visited.has(instance.id)) {
                queue.push(instance.id);
              }
            });
            current.loadOut += propagatedLoad;
          } else {
            // No healthy instances - load is lost (system degraded)
            target.loadIn += propagatedLoad;
            current.loadOut += propagatedLoad;
            if (!visited.has(edge.to)) {
              queue.push(edge.to);
            }
          }
        } else {
          // No redundancy group - normal propagation
          target.loadIn += propagatedLoad;
          current.loadOut += propagatedLoad;
          
          if (!visited.has(edge.to)) {
            queue.push(edge.to);
          }
        }
      }
    }
  }
}

function applyIncidentEffects(state: GameState, dt: number) {
  const { nodes } = state.architecture;

  // Track cumulative effects per node to prevent stacking
  const nodeHealthDecay = new Map<string, number>();
  const nodeErrorMult = new Map<string, number>();
  const nodeLatencyMult = new Map<string, number>();
  const nodeUtilMult = new Map<string, number>();

  // First pass: collect all effects
  for (const incident of state.activeIncidents) {
    // Handle AI-generated incidents
    if (incident.aiGenerated) {
      const targetNode = nodes.get(incident.targetNodeId);
      if (!targetNode) continue;

      // OPTIMIZATION incidents have no negative effects - skip applying effects
      const aiCategory = (incident as any).aiCategory;
      if (aiCategory === 'OPTIMIZATION') {
        continue; // Skip applying effects for optimization opportunities
      }

      // Check if there's an action in progress mitigating this incident
      const hasMitigatingAction = state.actionsInProgress.some(
        action => action.mitigatingIncidentId === incident.id
      );
      
      // Apply immediate mitigation if action is in progress
      const immediateMitigation = hasMitigatingAction 
        ? GAME_CONFIG.incidents.immediateMitigationOnActionStart 
        : 0;
      const mitigationFactor = 1 - Math.min(1.0, incident.mitigationLevel * 0.7 + immediateMitigation);

      // Get AI-specified effects from the original incident data
      const aiEffects = (incident as any).aiEffects;
      
      // Apply AI-specified effects if available
      if (aiEffects) {
        if (aiEffects.errorMultiplier) {
          const effectiveMultiplier = 1 + (aiEffects.errorMultiplier - 1) * mitigationFactor;
          const current = nodeErrorMult.get(incident.targetNodeId) || 1;
          nodeErrorMult.set(incident.targetNodeId, current * effectiveMultiplier);
        }
        if (aiEffects.latencyMultiplier) {
          const effectiveMultiplier = 1 + (aiEffects.latencyMultiplier - 1) * mitigationFactor;
          const current = nodeLatencyMult.get(incident.targetNodeId) || 1;
          nodeLatencyMult.set(incident.targetNodeId, current * effectiveMultiplier);
        }
        if (aiEffects.utilizationMultiplier) {
          const effectiveMultiplier = 1 + (aiEffects.utilizationMultiplier - 1) * mitigationFactor;
          const current = nodeUtilMult.get(incident.targetNodeId) || 1;
          nodeUtilMult.set(incident.targetNodeId, current * effectiveMultiplier);
        }
        if (aiEffects.healthDecayPerSec) {
          const decay = aiEffects.healthDecayPerSec * mitigationFactor;
          const current = nodeHealthDecay.get(incident.targetNodeId) || 0;
          nodeHealthDecay.set(incident.targetNodeId, current + decay);
        }
        
        // Apply component-specific metric effects
        // IMPORTANT: Effects are applied gradually over time, not instantly
        // AI provides "target change" values, we apply them gradually over seconds
        if (aiEffects.metricEffects && targetNode.specificMetrics) {
          for (const [metricKey, effectValue] of Object.entries(aiEffects.metricEffects)) {
            if (metricKey in targetNode.specificMetrics) {
              const currentValue = targetNode.specificMetrics[metricKey];
              if (typeof currentValue === 'number' && typeof effectValue === 'number') {
                // Clamp effect value to reasonable bounds first
                let clampedEffect = effectValue;
                if (metricKey.includes('Percent') || metricKey === 'avgCPUPercent' || metricKey === 'avgMemoryPercent') {
                  clampedEffect = Math.max(-50, Math.min(50, effectValue)); // Max ±50% change
                } else if (metricKey === 'connections' || metricKey === 'concurrentConnections') {
                  clampedEffect = Math.max(-100, Math.min(100, effectValue)); // Max ±100 connections
                } else if (metricKey === 'evictionRate') {
                  clampedEffect = Math.max(-500, Math.min(500, effectValue)); // Max ±500 keys/sec
                } else if (metricKey === 'queueBacklog' || metricKey === 'messagesQueued') {
                  clampedEffect = Math.max(-5000, Math.min(5000, effectValue)); // Max ±5k messages
                } else if (metricKey === 'hitRate' || metricKey.includes('Rate')) {
                  clampedEffect = Math.max(-0.5, Math.min(0.5, effectValue)); // Max ±0.5 (50%)
                }
                
                // Apply gradually over time (effectValue represents target change over ~10 seconds)
                // So we apply 10% of the effect per second
                const effectiveChange = (clampedEffect * 0.1) * mitigationFactor * dt;
                const newValue = currentValue + effectiveChange;
                targetNode.specificMetrics[metricKey] = clampMetric(targetNode, metricKey, newValue);
              }
            }
          }
        }
      } else {
        // Fallback: Apply effects based on severity
        if (incident.severity === 'CRIT') {
          const currentErr = nodeErrorMult.get(incident.targetNodeId) || 1;
          nodeErrorMult.set(incident.targetNodeId, currentErr * (1 + 3.0 * mitigationFactor));
          const currentLat = nodeLatencyMult.get(incident.targetNodeId) || 1;
          nodeLatencyMult.set(incident.targetNodeId, currentLat * (1 + 2.5 * mitigationFactor));
          const currentDecay = nodeHealthDecay.get(incident.targetNodeId) || 0;
          nodeHealthDecay.set(incident.targetNodeId, currentDecay + 0.02 * mitigationFactor);
        } else if (incident.severity === 'WARN') {
          const currentErr = nodeErrorMult.get(incident.targetNodeId) || 1;
          nodeErrorMult.set(incident.targetNodeId, currentErr * (1 + 1.5 * mitigationFactor));
          const currentLat = nodeLatencyMult.get(incident.targetNodeId) || 1;
          nodeLatencyMult.set(incident.targetNodeId, currentLat * (1 + 1.3 * mitigationFactor));
        } else if (incident.severity === 'INFO') {
          const currentLat = nodeLatencyMult.get(incident.targetNodeId) || 1;
          nodeLatencyMult.set(incident.targetNodeId, currentLat * (1 + 1.1 * mitigationFactor));
        }
      }
      
      continue;
    }

    const incidentDef = INCIDENTS.find(i => i.id === incident.definitionId);
    if (!incidentDef) continue;

    const targetNodeId = incident.targetNodeId;
    const targetNode = nodes.get(targetNodeId);
    if (!targetNode) continue;

    // Check if there's an action in progress mitigating this incident
    const hasMitigatingAction = state.actionsInProgress.some(
      action => action.mitigatingIncidentId === incident.id
    );
    
    // Apply immediate mitigation if action is in progress
    const immediateMitigation = hasMitigatingAction 
      ? GAME_CONFIG.incidents.immediateMitigationOnActionStart 
      : 0;
    const mitigationFactor = 1 - Math.min(1.0, incident.mitigationLevel * 0.7 + immediateMitigation);

    const effects = incidentDef.effects;

    // Collect effects (to be applied in second pass with caps)
    if (effects.utilizationMultiplier) {
      const current = nodeUtilMult.get(targetNodeId) || 1;
      nodeUtilMult.set(targetNodeId, current * (effects.utilizationMultiplier * mitigationFactor));
    }
    if (effects.latencyMultiplier) {
      const current = nodeLatencyMult.get(targetNodeId) || 1;
      nodeLatencyMult.set(targetNodeId, current * (effects.latencyMultiplier * mitigationFactor));
    }
    if (effects.errorMultiplier) {
      const current = nodeErrorMult.get(targetNodeId) || 1;
      nodeErrorMult.set(targetNodeId, current * (effects.errorMultiplier * mitigationFactor));
    }
    if (effects.healthDecayPerSec) {
      const decay = effects.healthDecayPerSec * mitigationFactor;
      const current = nodeHealthDecay.get(targetNodeId) || 0;
      nodeHealthDecay.set(targetNodeId, current + decay);
    }
    if (effects.capacityMultiplier) {
      // Capacity changes are applied immediately (not multiplicative)
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

  // Second pass: Apply collected effects with caps to prevent death spiral
  const caps = GAME_CONFIG.incidents.aiEffectCaps;
  
  nodes.forEach((node, nodeId) => {
    // Apply error multiplier (capped)
    const errorMult = nodeErrorMult.get(nodeId);
    if (errorMult) {
      const cappedMult = Math.min(errorMult, caps.maxErrorMultiplier);
      node.errorRate *= cappedMult;
    }

    // Apply latency multiplier (capped)
    const latencyMult = nodeLatencyMult.get(nodeId);
    if (latencyMult) {
      const cappedMult = Math.min(latencyMult, caps.maxLatencyMultiplier);
      node.latency *= cappedMult;
    }

    // Apply utilization multiplier (capped)
    const utilMult = nodeUtilMult.get(nodeId);
    if (utilMult) {
      const cappedMult = Math.min(utilMult, caps.maxUtilizationMultiplier);
      node.utilization *= cappedMult;
    }

    // Apply health decay (capped per second, not per incident)
    const healthDecay = nodeHealthDecay.get(nodeId);
    if (healthDecay) {
      const cappedDecay = Math.min(healthDecay, caps.maxHealthDecayPerSec);
      node.health = Math.max(0, node.health - cappedDecay * dt);
    } else if (node.health < 1.0) {
      // Natural health recovery when no incidents are affecting this node
      // Recover 5% health per second (slower if under load)
      const recoveryRate = 0.05 * (1 - Math.min(0.7, node.utilization));
      node.health = Math.min(1.0, node.health + recoveryRate * dt);
    }
    
    // Clamp all metrics to prevent unrealistic values
    clampAllMetrics(node);
  });
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
  // Check if system is up - with redundancy support
  const { nodes } = state.architecture;
  
  // Check critical component groups (with redundancy support)
  const criticalGroups = [
    { group: 'dns_cluster', fallback: ['dns'] },
    { group: 'app_cluster', fallback: ['app'] },
    { group: 'db_replicas', fallback: ['db_primary', 'db_replica'] },
  ];
  
  let criticalNodesHealth = 1.0;
  
  criticalGroups.forEach(({ group, fallback }) => {
    // Find all instances in redundancy group
    const groupInstances = Array.from(nodes.values()).filter(
      n => n.redundancyGroup === group && n.enabled
    );
    
    // If no redundancy group, fall back to specific nodes
    const instancesToCheck = groupInstances.length > 0 
      ? groupInstances 
      : fallback.map(id => nodes.get(id)).filter(n => n && n.enabled);
    
    if (instancesToCheck.length === 0) {
      // No instances at all - system is down
      criticalNodesHealth = 0;
      return;
    }
    
    // Check if at least one instance is healthy
    const healthyInstances = instancesToCheck.filter(
      n => n && n.operationalMode !== 'down' && n.health >= 0.3
    );
    
    if (healthyInstances.length === 0) {
      // All instances down - system is down
      criticalNodesHealth = 0;
    } else {
      // At least one instance is up - use best health
      const bestHealth = Math.max(...healthyInstances.map(n => n!.health));
      if (bestHealth < 0.7) {
        // Degraded but operational
        criticalNodesHealth = Math.min(criticalNodesHealth, bestHealth / 0.7);
      }
      // If bestHealth >= 0.7, no degradation (full redundancy working)
    }
  });
  
  // System is up if error rate is reasonable, latency is acceptable, and critical nodes are healthy
  // Use gradual degradation instead of binary
  const errorFactor = state.globalErrorRate < 0.5 ? 1.0 : Math.max(0, 1 - (state.globalErrorRate - 0.5) * 2);
  const latencyFactor = state.globalLatencyP95 < 5000 ? 1.0 : Math.max(0, 1 - (state.globalLatencyP95 - 5000) / 10000);
  
  // Uptime value is a combination of factors (gradual degradation)
  const uptimeValue = criticalNodesHealth * errorFactor * latencyFactor;

  // Update window
  state.uptimeWindow.shift();
  state.uptimeWindow.push(uptimeValue);

  // Compute rolling uptime
  const sum = state.uptimeWindow.reduce((a, b) => a + b, 0);
  state.uptime = sum / state.uptimeWindow.length;

  // Update streak - use threshold for "up"
  const isUp = uptimeValue > 0.7; // Consider "up" if above 70%
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

  // Compute base revenue
  let revenue = computeRevenue(state.users, state.pricing, state.reputation, state.uptime);
  
  // BOOST: Resolving incidents improves service quality → users pay more!
  // If you've resolved more incidents than active, you're maintaining quality
  if (state.resolvedIncidents > state.activeIncidents.length * 2) {
    // Resolved 2x more than currently active = excellent maintenance
    revenue *= 1.1; // +10% revenue boost!
  }
  
  // BOOST: High resolution rate = premium service perception
  if (state.resolvedIncidents > 10 && state.activeIncidents.length === 0) {
    // Resolved many incidents and currently clean = premium reputation
    revenue *= 1.15; // +15% revenue boost!
  }
  
  state.revenue = revenue;

  // Update cash
  const cashDelta = (state.revenue - state.costs) * dt;
  state.cash += cashDelta;
  state.totalProfit += cashDelta;

  // User growth
  let growthRate = computeGrowthRate(
    state.reputation,
    state.globalLatencyP95,
    state.globalErrorRate,
    1.0
  );
  
  // BOOST: Resolving incidents increases user trust → more growth!
  // Calculate incidents resolved recently (last 60 seconds)
  const recentResolutions = state.resolvedIncidents; // Total resolved
  const activeIncidentCount = state.activeIncidents.length;
  
  // If resolving incidents faster than they appear, users trust you more!
  if (recentResolutions > 0 && activeIncidentCount < 3) {
    // Low active incidents + high resolution rate = trust boost
    const resolutionRate = recentResolutions / Math.max(1, state.totalIncidents);
    if (resolutionRate > 0.7) { // Resolved 70%+ of incidents
      growthRate *= 1.2; // +20% growth boost!
    }
  }
  
  // BOOST: High reputation + low incidents = strong growth
  if (state.reputation > 80 && activeIncidentCount === 0) {
    growthRate *= 1.3; // +30% growth when reputation high and no incidents!
  }
  
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
  let reputationDelta = computeReputationDelta(state.uptime, state.globalErrorRate, severityScore / 10);
  
  // REWARD: Bonus reputation for good performance!
  // High uptime streak gives reputation bonus
  if (state.uptimeStreak > 300) { // 5+ minutes of good uptime
    reputationDelta += 0.5; // Bonus reputation!
  }
  if (state.uptimeStreak > 600) { // 10+ minutes
    reputationDelta += 1.0; // Even more bonus!
  }
  
  // BOOST: Resolving incidents actively improves reputation
  // If you're resolving incidents faster than they appear, reputation grows
  if (state.resolvedIncidents > state.totalIncidents * 0.8) {
    // Resolved 80%+ of all incidents = excellent track record
    reputationDelta += 0.3; // Continuous reputation boost!
  }
  
  // BOOST: Clean slate (no active incidents) = reputation recovery
  if (state.activeIncidents.length === 0 && state.uptime > 0.9) {
    reputationDelta += 0.5; // Strong reputation recovery when clean!
  }
  
  state.reputation = Math.max(0, Math.min(100, state.reputation + reputationDelta * dt));
}

// DEPRECATED: Old hardcoded incident spawning removed
// All incidents are now AI-generated based on real system metrics

function updateIncidents(state: GameState, _dt: number) {
  let incidentsResolvedThisTick = 0;
  
  state.activeIncidents = state.activeIncidents.filter(incident => {
    let wasResolved = false;
    
    // AI-generated incidents
    if (incident.aiGenerated) {
      const elapsed = (Date.now() - incident.startTime) / 1000;
      
      // Auto-resolve after 300s if not specified
      const autoResolveTime = incident.outagetimer || 300;
      if (elapsed > autoResolveTime) {
        state.resolvedIncidents++;
        incidentsResolvedThisTick++;
        wasResolved = true;
        console.log('🔄 AI incident auto-resolved:', (incident as any).aiIncidentName);
      }

      // Fully mitigated (player resolved it!)
      if (!wasResolved && incident.mitigationLevel >= 1.0) {
        state.resolvedIncidents++;
        incidentsResolvedThisTick++;
        wasResolved = true;
        console.log('✅ AI incident mitigated:', (incident as any).aiIncidentName);
        
        // REWARD: Player resolved it - give bonus!
        import('../utils/terminalLog').then(({ tlog }) => {
          tlog.success(`🎉 Incident resolved! Reputation +${incident.severity === 'CRIT' ? '5' : incident.severity === 'WARN' ? '3' : '1'}`);
        });
      }

      return !wasResolved;
    }
    
    // Regular incidents
    const incidentDef = INCIDENTS.find(i => i.id === incident.definitionId);
    if (!incidentDef) return false;

    const elapsed = (Date.now() - incident.startTime) / 1000;

    // Auto-resolve
    if (incidentDef.autoResolveSeconds && elapsed > incidentDef.autoResolveSeconds) {
      state.resolvedIncidents++;
      incidentsResolvedThisTick++;
      return false;
    }

    // Fully mitigated (player resolved it!)
    if (incident.mitigationLevel >= 1.0) {
      state.resolvedIncidents++;
      incidentsResolvedThisTick++;
      return false;
    }

    return true;
  });

  // REWARD: Positive effects for resolving incidents!
  if (incidentsResolvedThisTick > 0) {
    // Reputation boost (more for critical incidents)
    const reputationBoost = incidentsResolvedThisTick * 2; // +2 per incident
    state.reputation = Math.min(100, state.reputation + reputationBoost);
    
    // User growth boost (users trust the service more)
    // This will be applied in updateBusiness via growth multiplier
    
    // Log the reward
    import('../utils/terminalLog').then(({ tlog }) => {
      tlog.success(`✨ Resolved ${incidentsResolvedThisTick} incident(s)! Reputation +${reputationBoost}`);
    });
  }
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
      // Play completion sound
      import('../utils/soundNotifications').then(({ soundNotifications }) => {
        soundNotifications.playActionComplete();
      });
      
      // Use dynamic import for terminal logger
      import('../utils/terminalLog').then(({ tlog }) => {
        tlog.success('═══════════════════════════════════════════════');
        tlog.success(`✅ ACTION COMPLETED: ${action.actionId}`);
        tlog.success('═══════════════════════════════════════════════');
      });
      
      // Action complete - finalize mitigation if it was mitigating an incident
      if (action.mitigatingIncidentId) {
        const incident = state.activeIncidents.find(i => i.id === action.mitigatingIncidentId);
        if (incident) {
          // Permanently add to base mitigation level using config
          incident.mitigationLevel = Math.min(1.0, incident.mitigationLevel + mitigationPerAction);
          incident.mitigationProgress = incident.mitigationLevel;
          
          // Apply FULL mitigation to related incidents (shared root cause = same fix works for all!)
          if (incident.relatedIncidentIds && incident.relatedIncidentIds.length > 0) {
            const sharedMitigation = mitigationPerAction; // 100% mitigation for related incidents (same root cause!)
            const linkedIds = incident.relatedIncidentIds; // Store in const for TypeScript
            linkedIds.forEach(relatedId => {
              const relatedIncident = state.activeIncidents.find(i => i.id === relatedId);
              if (relatedIncident) {
                relatedIncident.mitigationLevel = Math.min(1.0, relatedIncident.mitigationLevel + sharedMitigation);
                relatedIncident.mitigationProgress = relatedIncident.mitigationLevel;
              }
            });
            import('../utils/terminalLog').then(({ tlog }) => {
              tlog.success(`🔗 Fully mitigated ${linkedIds.length} related incident(s) (100% - shared root cause!)`);
            });
          }
          
          // Apply remaining metric improvements from AI actions (70% on completion)
          if (action.actionId.startsWith('ai_') && incident.aiSuggestedActions) {
            const actionName = action.actionId.replace(/^ai_/, '').replace(/_/g, ' ');
            const aiAction = incident.aiSuggestedActions.find(a => 
              a.actionName.toLowerCase().includes(actionName.toLowerCase().substring(0, 15))
            );
            
            if (aiAction && (aiAction as any).metricImprovements) {
              const targetNode = state.architecture.nodes.get(incident.targetNodeId);
              if (targetNode && targetNode.specificMetrics) {
                const improvements = (aiAction as any).metricImprovements;
                
                // Import terminal logger dynamically
                import('../utils/terminalLog').then(({ tlog }) => {
                  tlog.info(`📈 Applying metric improvements for ${targetNode.name}:`);
                });
                
                for (const [metricKey, improvement] of Object.entries(improvements)) {
                  if (metricKey in targetNode.specificMetrics) {
                    if (typeof improvement === 'number') {
                      const currentValue = targetNode.specificMetrics[metricKey];
                      if (typeof currentValue === 'number') {
                        // Apply remaining 70% improvement on completion (30% was applied on start)
                        const finalImprovement = improvement * 0.7;
                        let newValue = currentValue + finalImprovement;
                        
                        // Use proper clampMetric function
                        targetNode.specificMetrics[metricKey] = clampMetric(targetNode, metricKey, newValue);
                        
                        // Log to terminal
                        const change = newValue - currentValue;
                        const sign = change > 0 ? '+' : '';
                        import('../utils/terminalLog').then(({ tlog }) => {
                          tlog.info(`   ${metricKey}: ${currentValue.toFixed(2)} → ${newValue.toFixed(2)} (${sign}${change.toFixed(2)})`);
                        });
                      }
                    } else if (typeof improvement === 'boolean') {
                      // Boolean toggles
                      const oldValue = targetNode.specificMetrics[metricKey];
                      targetNode.specificMetrics[metricKey] = improvement;
                      import('../utils/terminalLog').then(({ tlog }) => {
                        tlog.info(`   ${metricKey}: ${oldValue} → ${improvement}`);
                      });
                    } else if (typeof improvement === 'number') {
                      // Direct value set
                      const oldValue = targetNode.specificMetrics[metricKey];
                      targetNode.specificMetrics[metricKey] = improvement;
                      import('../utils/terminalLog').then(({ tlog }) => {
                        tlog.info(`   ${metricKey}: ${oldValue} → ${improvement}`);
                      });

                    }
                  }
                }
              }
            }
          }
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

