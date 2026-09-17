import { INCIDENTS } from '../data/incidents';
import { GAME_CONFIG } from '../config/gameConfig';
import { tlog } from '../utils/terminalLog';
import type { SeededRNG } from './rng';
import type { ActiveIncident, ComponentNode, GameState, IncidentDefinition } from './types';

function preconditionsMet(def: IncidentDefinition, node: ComponentNode, state: GameState): boolean {
  const p = def.preconditions;
  if (p.minUtilization !== undefined && node.utilization < p.minUtilization) return false;
  if (p.maxUtilization !== undefined && node.utilization > p.maxUtilization) return false;
  if (p.minErrorRate !== undefined && node.errorRate < p.minErrorRate) return false;
  if (p.minTechDebt !== undefined && state.techDebt < p.minTechDebt) return false;
  if (p.featureDisabled && (node.features as Record<string, unknown>)[p.featureDisabled]) return false;
  return true;
}

function eligibleTargets(def: IncidentDefinition, state: GameState): ComponentNode[] {
  const out: ComponentNode[] = [];
  state.architecture.nodes.forEach(node => {
    if (!node.enabled) return;
    if (!def.targetTypes.includes(node.type)) return;
    if (!preconditionsMet(def, node, state)) return;
    if (state.activeIncidents.some(i => i.targetNodeId === node.id && i.definitionId === def.id)) return;
    out.push(node);
  });
  return out;
}

/**
 * Rolls each template's per-minute hazard rate against the elapsed tick. Incidents fire
 * because of system state, so investing in capacity and features measurably reduces them.
 */
export function spawnFromTemplates(state: GameState, rng: SeededRNG, dt: number): void {
  const cfg = GAME_CONFIG.incidents;
  if (state.activeIncidents.length >= cfg.maxConcurrent) return;
  if (state.lastCalmPeriodEnd && Date.now() < state.lastCalmPeriodEnd) return;

  // Keep concurrent CRITs below the 3-CRIT collapse threshold — pre-CP4 balance measure.
  const activeCrits = state.activeIncidents.filter(i => i.severity === 'CRIT').length;

  for (const def of INCIDENTS) {
    const perSecond = (def.baseRatePerMinute / 60) * cfg.spawnRateMultiplier;
    if (rng.next() >= perSecond * dt) continue;

    if (def.severity === 'CRIT' && activeCrits >= 2) continue;

    const targets = eligibleTargets(def, state);
    if (!targets.length) continue;
    const target = targets[Math.floor(rng.next() * targets.length)];

    const incident: ActiveIncident = {
      id: `inc_${def.id}_${Date.now()}_${Math.round(rng.next() * 1e6)}`,
      definitionId: def.id,
      targetNodeId: target.id,
      severity: def.severity,
      startTime: Date.now(),
      startSim: state.elapsedSim,
      escalationTimer: 0,
      outagetimer: def.timeToOutageSeconds ?? 0,
      mitigationLevel: 0,
      mitigationProgress: 0,
    };
    state.activeIncidents.push(incident);
    state.totalIncidents++;
    tlog.warn(`🚨 ${def.severity} | ${def.name} → ${target.name} (util ${target.utilization.toFixed(2)})`);
    if (state.activeIncidents.length >= cfg.maxConcurrent) return;
  }
}
