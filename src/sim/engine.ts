// Main simulation engine

import { GameState, ComponentNode, ArchitectureEdge } from './types';
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
import { cloneGameState } from '../utils/stateUtils';
import { tlog } from '../utils/terminalLog';
import { soundNotifications } from '../utils/soundNotifications';
import { applyRelatedMitigation } from './reducer';

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
    autoPaused: false,

    aiSessionActive: false, // Will be set to true when AI initializes
    recentIncidentTargets: [], // Track recently targeted nodes for diversity
    lastCalmPeriodEnd: 0,
    tokenUsage: { totalCalls: 0, estimatedTokens: 0, estimatedCostUSD: 0 },

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

    reputationZeroTimer: 0,

    totalProfit: 0,
    totalIncidents: 0,
  };
}

// Default metric baselines for recovery (derived from architecture.ts initial values)
const DEFAULT_METRIC_BASELINES: Record<string, Record<string, number>> = {
  DNS: { cacheHitRate: 0.85, ttl: 300, propagationDelay: 5 },
  CDN: { cacheHitRate: 0.75, bandwidthGbps: 10, cacheSizeGB: 500, ttl: 300 },
  WAF: { blockedRequestsPercent: 0.01, inspectionLatency: 5, falsePositiveRate: 0.001 },
  GLB: { healthCheckInterval: 5, failedHealthChecks: 0 },
  RLB: { healthCheckInterval: 3, failedHealthChecks: 0 },
  APIGW: { rateLimitHitRate: 0.01, transformationLatency: 5 },
  APP: { avgCPUPercent: 30, avgMemoryPercent: 40 },
  CACHE: { hitRate: 0.80, evictionRate: 10, memoryFragmentation: 0.15, avgTTL: 300 },
  QUEUE: { messagesQueued: 0, avgMessageAge: 2, deadLetterQueueSize: 0 },
  WORKERS: { failedJobsPercent: 0.01, queueBacklog: 0, avgJobDuration: 10 },
  DB_PRIMARY: { slowQueriesPercent: 0.05, replicationLag: 0, cacheHitRate: 0.70, indexEfficiency: 0.85 },
  DB_REPLICA: { slowQueriesPercent: 0.05, replicationLag: 100, cacheHitRate: 0.70, indexEfficiency: 0.85 },
  OBJECT_STORAGE: { coldStoragePercent: 0.2 },
  OBSERVABILITY: { queryLatency: 100 },
  SERVICE_MESH: { circuitBreakersOpen: 0, retryRate: 0, sidecarOverhead: 3 },
};

function getDefaultMetricValue(nodeType: string, metricKey: string): number | null {
  const baselines = DEFAULT_METRIC_BASELINES[nodeType];
  if (baselines && metricKey in baselines) {
    return baselines[metricKey];
  }
  return null;
}

/** O2/O6: Build a map from redundancy group name → nodes in that group (reused by propagateLoad + updateUptime) */
function buildRedundancyGroupMap(nodes: Map<string, ComponentNode>): Map<string, ComponentNode[]> {
  const groups = new Map<string, ComponentNode[]>();
  nodes.forEach(node => {
    if (node.redundancyGroup) {
      const list = groups.get(node.redundancyGroup);
      if (list) {
        list.push(node);
      } else {
        groups.set(node.redundancyGroup, [node]);
      }
    }
  });
  return groups;
}

export function tickSimulation(state: GameState, _rng: SeededRNG, dt: number = 1): GameState {
  if (state.paused || state.gameOver) return state;

  // O1: Use centralized deep-clone utility instead of inline copy-paste
  const newState = cloneGameState(state);

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

  // O2: Pre-build adjacency list for O(1) edge lookups (instead of O(E) filter per node)
  const adjacency = new Map<string, ArchitectureEdge[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from);
    if (list) {
      list.push(edge);
    } else {
      adjacency.set(edge.from, [edge]);
    }
  }

  // O2: Pre-build redundancy group map for O(1) group lookups
  const redundancyGroups = buildRedundancyGroupMap(nodes);

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
    const isCriticalNode = currentId === 'dns' || currentId === 'app' || currentId === 'db_primary';
    
    if (current.health < 0.3 || utilization > 3) {
      current.operationalMode = 'down';
      // O4: Direct call instead of dynamic import
      if (previousMode !== 'down' && isCriticalNode) {
        soundNotifications.playSystemDown();
      }
    } else if (current.health < 0.7 || utilization > 1.5) {
      current.operationalMode = 'degraded';
    } else {
      current.operationalMode = 'normal';
    }

    // O2: Use pre-built adjacency list for O(1) lookup
    const outgoingEdges = adjacency.get(currentId) || [];
    for (const edge of outgoingEdges) {
      const target = nodes.get(edge.to);
      if (target && target.enabled) {
        const propagatedLoad = current.loadIn * edge.weight * (1 - current.errorRate);
        
        // O2: Use pre-built redundancy group map
        if (target.redundancyGroup) {
          const allGroupInstances = redundancyGroups.get(target.redundancyGroup) || [];
          const healthyInstances = allGroupInstances.filter(n => n.enabled && n.health > 0.3);
          
          if (healthyInstances.length > 0) {
            const loadPerInstance = propagatedLoad / healthyInstances.length;
            healthyInstances.forEach(instance => {
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

  // O2: Pre-build set of incident IDs currently being mitigated for O(1) lookups
  const mitigatedIncidentIds = new Set<string>(
    state.actionsInProgress
      .filter(a => a.mitigatingIncidentId)
      .map(a => a.mitigatingIncidentId!)
  );

  // First pass: collect all effects
  for (const incident of state.activeIncidents) {
    // Handle AI-generated incidents
    if (incident.aiGenerated) {
      const targetNode = nodes.get(incident.targetNodeId);
      if (!targetNode) continue;

      // O5: aiCategory is already typed on ActiveIncident — no cast needed
      if (incident.aiCategory === 'OPTIMIZATION') {
        continue;
      }

      // O2: Use pre-built set instead of scanning actionsInProgress
      const hasMitigatingAction = mitigatedIncidentIds.has(incident.id);
      
      // Apply immediate mitigation if action is in progress
      const immediateMitigation = hasMitigatingAction 
        ? GAME_CONFIG.incidents.immediateMitigationOnActionStart 
        : 0;
      const mitigationFactor = 1 - Math.min(1.0, incident.mitigationLevel * 0.7 + immediateMitigation);

      // O5: aiEffects is already typed on ActiveIncident — no cast needed
      const aiEffects = incident.aiEffects;
      
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

    // O2: Use pre-built set instead of scanning actionsInProgress
    const hasMitigatingAction = mitigatedIncidentIds.has(incident.id);
    
    // Apply immediate mitigation if action is in progress
    const immediateMitigation = hasMitigatingAction 
      ? GAME_CONFIG.incidents.immediateMitigationOnActionStart 
      : 0;
    const mitigationFactor = 1 - Math.min(1.0, incident.mitigationLevel * 0.7 + immediateMitigation);

    const effects = incidentDef.effects;

    // Collect effects (to be applied in second pass with caps)
    if (effects.utilizationMultiplier) {
      const effectiveMultiplier = 1 + (effects.utilizationMultiplier - 1) * mitigationFactor;
      const current = nodeUtilMult.get(targetNodeId) || 1;
      nodeUtilMult.set(targetNodeId, current * effectiveMultiplier);
    }
    if (effects.latencyMultiplier) {
      const effectiveMultiplier = 1 + (effects.latencyMultiplier - 1) * mitigationFactor;
      const current = nodeLatencyMult.get(targetNodeId) || 1;
      nodeLatencyMult.set(targetNodeId, current * effectiveMultiplier);
    }
    if (effects.errorMultiplier) {
      const effectiveMultiplier = 1 + (effects.errorMultiplier - 1) * mitigationFactor;
      const current = nodeErrorMult.get(targetNodeId) || 1;
      nodeErrorMult.set(targetNodeId, current * effectiveMultiplier);
    }
    if (effects.healthDecayPerSec) {
      const decay = effects.healthDecayPerSec * mitigationFactor;
      const current = nodeHealthDecay.get(targetNodeId) || 0;
      nodeHealthDecay.set(targetNodeId, current + decay);
    }
    if (effects.capacityMultiplier) {
      // Store original capacity for restoration (only once)
      if (targetNode._originalCapacity == null) {
        targetNode._originalCapacity = targetNode.capacity;
      }
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
      
      // M3 FIX: Allow partial health recovery even during incidents
      // Recover at 30% of normal rate so nodes don't stay permanently damaged
      if (node.health < 1.0) {
        const partialRecovery = 0.05 * GAME_CONFIG.metricRecovery.healthRecoveryDuringIncident * (1 - Math.min(0.7, node.utilization));
        node.health = Math.min(1.0, node.health + partialRecovery * dt);
      }
    } else if (node.health < 1.0) {
      // Natural health recovery when no incidents are affecting this node
      // Recover 5% health per second (slower if under load)
      const recoveryRate = 0.05 * (1 - Math.min(0.7, node.utilization));
      node.health = Math.min(1.0, node.health + recoveryRate * dt);
    }
    
    // C1 FIX: Natural metric recovery toward baselines when no incident targets this node
    // This prevents permanent metric damage from resolved incidents
    if (!healthDecay && node.specificMetrics) {
      const recoveryRate = GAME_CONFIG.metricRecovery.baseRecoveryRate;
      for (const [key, value] of Object.entries(node.specificMetrics)) {
        if (typeof value !== 'number') continue;
        const baseline = getDefaultMetricValue(node.type, key);
        if (baseline === null) continue;
        
        const delta = (baseline - value) * recoveryRate * dt;
        // Only recover if delta would move toward baseline (not away)
        if (Math.abs(delta) > 0.0001) {
          node.specificMetrics[key] = clampMetric(node, key, value + delta);
        }
      }
    } else if (healthDecay && node.specificMetrics) {
      // Partial metric recovery even during incidents (slower)
      const recoveryRate = GAME_CONFIG.metricRecovery.incidentRecoveryRate;
      for (const [key, value] of Object.entries(node.specificMetrics)) {
        if (typeof value !== 'number') continue;
        const baseline = getDefaultMetricValue(node.type, key);
        if (baseline === null) continue;
        
        const delta = (baseline - value) * recoveryRate * dt;
        if (Math.abs(delta) > 0.0001) {
          node.specificMetrics[key] = clampMetric(node, key, value + delta);
        }
      }
    }
    
    // I5 FIX: Restore original capacity when no incident is degrading it
    // O5: Use typed _originalCapacity field instead of (node as any) cast
    if (!healthDecay && node._originalCapacity != null && node.capacity !== node._originalCapacity) {
      node.capacity = node._originalCapacity;
      delete node._originalCapacity;
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
  
  // O6: Use pre-built redundancy group map instead of repeated Array.from scans
  const redundancyGroups = buildRedundancyGroupMap(nodes);
  
  // Check critical component groups (with redundancy support)
  const criticalGroups = [
    { group: 'dns_cluster', fallback: ['dns'] },
    { group: 'app_cluster', fallback: ['app'] },
    { group: 'db_replicas', fallback: ['db_primary', 'db_replica'] },
  ];
  
  let criticalNodesHealth = 1.0;
  
  criticalGroups.forEach(({ group, fallback }) => {
    // O6: Use cached group map for O(1) lookup
    const groupInstances = (redundancyGroups.get(group) || []).filter(n => n.enabled);
    
    // If no redundancy group, fall back to specific nodes
    const instancesToCheck = groupInstances.length > 0 
      ? groupInstances 
      : fallback.map(id => nodes.get(id)).filter((n): n is ComponentNode => !!n && n.enabled);
    
    if (instancesToCheck.length === 0) {
      criticalNodesHealth = 0;
      return;
    }
    
    // Check if at least one instance is healthy
    const healthyInstances = instancesToCheck.filter(
      n => n.operationalMode !== 'down' && n.health >= 0.3
    );
    
    if (healthyInstances.length === 0) {
      criticalNodesHealth = 0;
    } else {
      const bestHealth = Math.max(...healthyInstances.map(n => n.health));
      if (bestHealth < 0.7) {
        criticalNodesHealth = Math.min(criticalNodesHealth, bestHealth / 0.7);
      }
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
    revenue *= 1.05; // +5% revenue boost (reduced from 10%)
  }
  
  // BOOST: High resolution rate = premium service perception
  if (state.resolvedIncidents > 10 && state.activeIncidents.length === 0) {
    // Resolved many incidents and currently clean = premium reputation
    revenue *= 1.08; // +8% revenue boost (reduced from 15%)
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

  // BAL-3 FIX: Logarithmic dampener prevents exponential runaway at high user counts
  const growthDampener = 1000 / (1000 + state.users * 0.01);
  const userDelta = (growthRate - churnRate) * state.users * growthDampener * dt / 1000;
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
    reputationDelta += 0.2; // Bonus reputation (reduced from 0.5)
  }
  if (state.uptimeStreak > 600) { // 10+ minutes
    reputationDelta += 0.3; // Additional bonus (reduced from 1.0)
  }
  
  // BOOST: Resolving incidents actively improves reputation
  if (state.resolvedIncidents > state.totalIncidents * 0.8) {
    reputationDelta += 0.15; // Continuous reputation boost (reduced from 0.3)
  }
  
  // BOOST: Clean slate (no active incidents) = reputation recovery
  if (state.activeIncidents.length === 0 && state.uptime > 0.9) {
    reputationDelta += 0.2; // Recovery when clean (reduced from 0.5)
  }
  
  // BAL-1 FIX: Cap total positive reputation delta to prevent instant recovery
  if (reputationDelta > 0) {
    reputationDelta = Math.min(reputationDelta, 0.5); // Max +0.5/sec before diminishing returns
  }
  
  // M6 FIX: Diminishing returns on positive reputation recovery
  // Recovery slows as reputation approaches 100 to prevent instant max
  if (reputationDelta > 0) {
    const diminishingFactor = Math.max(0.1, 1 - (state.reputation / 100));
    reputationDelta *= diminishingFactor;
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
      
      // Auto-resolve AI incidents after 300s (outagetimer is for node-down countdown, not auto-resolve)
      const autoResolveTime = 300;
      if (elapsed > autoResolveTime) {
        state.resolvedIncidents++;
        incidentsResolvedThisTick++;
        wasResolved = true;
      }

      // Fully mitigated (player resolved it!)
      if (!wasResolved && incident.mitigationLevel >= 1.0) {
        state.resolvedIncidents++;
        incidentsResolvedThisTick++;
        wasResolved = true;
        
        // O4: Direct call instead of dynamic import
        tlog.success(`🎉 Incident resolved! Reputation +${incident.severity === 'CRIT' ? '5' : incident.severity === 'WARN' ? '3' : '1'}`);
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
    
    // O4: Direct call instead of dynamic import
    tlog.success(`✨ Resolved ${incidentsResolvedThisTick} incident(s)! Reputation +${reputationBoost}`);
  }
  
  // BREATHER MECHANIC: After resolving incidents, suppress new ones for 30s
  // BAL-7 FIX: Trigger when no CRIT/WARN remain (ignore lingering INFO incidents)
  const hasSeriousIncidents = state.activeIncidents.some(i => i.severity === 'CRIT' || i.severity === 'WARN');
  if (incidentsResolvedThisTick > 0 && !hasSeriousIncidents) {
    state.lastCalmPeriodEnd = Date.now() + GAME_CONFIG.session.calmPeriodAfterCritMs;
    tlog.info(`😌 All clear! 30 second breather before next incident wave.`);
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
      // O4: Direct calls instead of dynamic imports
      soundNotifications.playActionComplete();
      tlog.success('═══════════════════════════════════════════════');
      tlog.success(`✅ ACTION COMPLETED: ${action.actionId}`);
      tlog.success('═══════════════════════════════════════════════');
      
      // Action complete - finalize mitigation if it was mitigating an incident
      if (action.mitigatingIncidentId) {
        const incident = state.activeIncidents.find(i => i.id === action.mitigatingIncidentId);
        if (incident) {
          // Permanently add to base mitigation level using config
          incident.mitigationLevel = Math.min(1.0, incident.mitigationLevel + mitigationPerAction);
          incident.mitigationProgress = incident.mitigationLevel;
          
          // O3: Use helper for related incident mitigation
          applyRelatedMitigation(state.activeIncidents, incident, mitigationPerAction);
          
          // Apply remaining metric improvements from AI actions (70% on completion)
          if (action.actionId.startsWith('ai_') && incident.aiSuggestedActions) {
            const actionName = action.actionId.replace(/^ai_/, '').replace(/_/g, ' ');
            const aiAction = incident.aiSuggestedActions.find(a => 
              a.actionName.toLowerCase().includes(actionName.toLowerCase().substring(0, 15))
            );
            
            // O5: metricImprovements is now typed on the action interface
            const metricImprovements = aiAction?.metricImprovements;
            if (metricImprovements) {
              const targetNode = state.architecture.nodes.get(incident.targetNodeId);
              if (targetNode && targetNode.specificMetrics) {
                tlog.info(`📈 Applying metric improvements for ${targetNode.name}:`);
                
                for (const [metricKey, improvement] of Object.entries(metricImprovements)) {
                  if (metricKey in targetNode.specificMetrics) {
                    if (typeof improvement === 'number') {
                      const currentValue = targetNode.specificMetrics[metricKey];
                      if (typeof currentValue === 'number') {
                        const finalImprovement = improvement * 0.7;
                        const newValue = currentValue + finalImprovement;
                        targetNode.specificMetrics[metricKey] = clampMetric(targetNode, metricKey, newValue);
                        
                        const change = newValue - currentValue;
                        const sign = change > 0 ? '+' : '';
                        tlog.info(`   ${metricKey}: ${currentValue.toFixed(2)} → ${newValue.toFixed(2)} (${sign}${change.toFixed(2)})`);
                      }
                    } else if (typeof improvement === 'boolean') {
                      const oldValue = targetNode.specificMetrics[metricKey];
                      targetNode.specificMetrics[metricKey] = improvement;
                      tlog.info(`   ${metricKey}: ${oldValue} → ${improvement}`);
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
    // O5: Use typed field instead of (state as any) cast
    state.reputationZeroTimer += 1;
    
    // Game over only if reputation stays at 0 for configured grace period
    if (state.reputationZeroTimer >= GAME_CONFIG.economy.reputationGameOverGracePeriod) {
      state.gameOver = true;
      state.gameOverReason = 'Reputation destroyed - users lost trust';
    }
  } else {
    // Reset timer if reputation recovers
    state.reputationZeroTimer = 0;
  }

  if (state.uptime < 0.5 && state.uptimeStreak === 0) {
    const critIncidents = state.activeIncidents.filter(i => i.severity === 'CRIT').length;
    if (critIncidents >= 3) {
      state.gameOver = true;
      state.gameOverReason = 'Multiple critical outages - system collapse';
    }
  }
}

