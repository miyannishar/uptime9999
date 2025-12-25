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

    aiSessionActive: false, // Will be set to true when AI initializes
    recentIncidentTargets: [], // Track recently targeted nodes for diversity

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

export function tickSimulation(state: GameState, _rng: SeededRNG, dt: number = 1): GameState {
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
        if (aiEffects.metricEffects && targetNode.specificMetrics) {
          for (const [metricKey, effectValue] of Object.entries(aiEffects.metricEffects)) {
            if (metricKey in targetNode.specificMetrics) {
              const currentValue = targetNode.specificMetrics[metricKey];
              if (typeof currentValue === 'number' && typeof effectValue === 'number') {
                // Apply effect with mitigation factor
                const effectiveChange = effectValue * mitigationFactor;
                targetNode.specificMetrics[metricKey] = Math.max(0, currentValue + effectiveChange);
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
    }
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
  // Check if system is up - check critical nodes too
  const { nodes } = state.architecture;
  
  // Critical nodes that must be up - use gradual health thresholds
  const criticalNodes = ['dns', 'app', 'db_primary'];
  let criticalNodesHealth = 1.0;
  criticalNodes.forEach(id => {
    const node = nodes.get(id);
    if (!node || !node.enabled || node.operationalMode === 'down') {
      criticalNodesHealth = 0;
    } else if (node.health < 0.3) {
      // Start degrading uptime gradually when health < 30%
      criticalNodesHealth = Math.min(criticalNodesHealth, node.health / 0.3);
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

// DEPRECATED: Old hardcoded incident spawning removed
// All incidents are now AI-generated based on real system metrics

function updateIncidents(state: GameState, _dt: number) {
  state.activeIncidents = state.activeIncidents.filter(incident => {
    // AI-generated incidents
    if (incident.aiGenerated) {
      const elapsed = (Date.now() - incident.startTime) / 1000;
      
      // Auto-resolve after 300s if not specified
      const autoResolveTime = incident.outagetimer || 300;
      if (elapsed > autoResolveTime) {
        state.resolvedIncidents++;
        console.log('🔄 AI incident auto-resolved:', (incident as any).aiIncidentName);
        return false;
      }

      // Fully mitigated
      if (incident.mitigationLevel >= 1.0) {
        state.resolvedIncidents++;
        console.log('✅ AI incident mitigated:', (incident as any).aiIncidentName);
        return false;
      }

      return true;
    }
    
    // Regular incidents
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
                        
                        // Clamp values appropriately
                        if (metricKey.includes('Percent') || metricKey.includes('Rate') || metricKey === 'hitRate') {
                          newValue = Math.max(0, Math.min(1, newValue)); // Rates: 0-1
                        } else if (metricKey.includes('GB') || metricKey.includes('connections') || metricKey.includes('instances')) {
                          newValue = Math.max(0, Math.round(newValue)); // Whole numbers
                        } else {
                          newValue = Math.max(0, newValue); // Just positive
                        }
                        
                        targetNode.specificMetrics[metricKey] = newValue;
                        
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

