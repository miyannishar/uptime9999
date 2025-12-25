// Game formulas and calculations

import { ComponentNode } from './types';
import { GAME_CONFIG } from '../config/gameConfig';

// Activity rate varies by time of day
export function getActivityRate(hourOfDay: number, dayOfWeek: number): number {
  const cfg = GAME_CONFIG.activity;
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isBusinessHours = hourOfDay >= cfg.businessHoursStart && hourOfDay <= cfg.businessHoursEnd;
  
  let rate = cfg.baselineRate;
  
  if (isWeekday) rate += cfg.weekdayBonus;
  if (isBusinessHours) rate += cfg.businessHoursBonus;
  
  // Evening spike
  if (hourOfDay >= cfg.eveningStart && hourOfDay <= cfg.eveningEnd) rate += cfg.eveningBonus;
  
  // Night dip
  if (hourOfDay >= cfg.nightStart && hourOfDay <= cfg.nightEnd) rate -= cfg.nightPenalty;
  
  return Math.max(0.1, rate);
}

// Non-linear latency increase when overloaded
export function computeLatency(baseLatency: number, utilization: number): number {
  const thresholds = GAME_CONFIG.performance.latencyThresholds;
  
  if (utilization <= thresholds.normal) {
    return baseLatency;
  } else if (utilization <= thresholds.stressed) {
    // Linear increase
    const factor = 1 + (utilization - thresholds.normal) * 3;
    return baseLatency * factor;
  } else {
    // Exponential after threshold
    const overload = utilization - thresholds.stressed;
    const factor = 1.9 + Math.pow(overload * thresholds.overloadFactor, 1.5);
    return baseLatency * factor;
  }
}

// Non-linear error rate when overloaded
export function computeErrorRate(baseError: number, utilization: number, health: number): number {
  const thresholds = GAME_CONFIG.performance.errorThresholds;
  let errorRate = baseError;
  
  // Utilization impact
  if (utilization > thresholds.utilization) {
    const overloadFactor = Math.pow((utilization - thresholds.utilization) * thresholds.overloadFactor, 2);
    errorRate += overloadFactor * 0.1;
  }
  
  // Health impact
  if (health < 1.0) {
    errorRate += (1 - health) * 0.3;
  }
  
  return Math.min(1.0, errorRate);
}

// Compute node capacity based on scaling
export function computeNodeCapacity(node: ComponentNode): number {
  return node.capacity * node.scaling.current;
}

// Revenue calculation
export function computeRevenue(
  users: number, 
  pricing: number, 
  reputation: number, 
  uptime: number
): number {
  const reputationFactor = reputation / 100;
  
  // Less harsh uptime penalty - linear instead of quadratic
  // Still get 80% revenue at 80% uptime, 50% at 50% uptime
  const uptimeFactor = Math.max(0.3, uptime); // Never go below 30% revenue
  
  const baseRevenue = users * pricing / 86400; // pricing is per day
  return baseRevenue * reputationFactor * uptimeFactor;
}

// User growth rate
export function computeGrowthRate(
  reputation: number,
  latency: number,
  errorRate: number,
  marketingMultiplier: number
): number {
  const cfg = GAME_CONFIG.growth;
  let growthRate = cfg.baseGrowthRate;
  
  // Reputation impact
  const repMult = cfg.reputationMultipliers;
  if (reputation > repMult.excellent.threshold) growthRate *= repMult.excellent.multiplier;
  else if (reputation > repMult.good.threshold) growthRate *= repMult.good.multiplier;
  else if (reputation > repMult.decent.threshold) growthRate *= repMult.decent.multiplier;
  else growthRate *= repMult.poor.multiplier;
  
  // Performance impact
  const perfPen = cfg.performancePenalties;
  if (latency > perfPen.highLatencyThreshold) growthRate *= perfPen.highLatencyMultiplier;
  if (errorRate > perfPen.highErrorThreshold) growthRate *= perfPen.highErrorMultiplier;
  
  // Marketing
  growthRate *= marketingMultiplier;
  
  return growthRate;
}

// User churn rate
export function computeChurnRate(
  latency: number,
  errorRate: number,
  downtime: boolean
): number {
  const cfg = GAME_CONFIG.growth;
  let churnRate = cfg.baseChurnRate;
  
  if (downtime) churnRate += cfg.downtimeChurnBonus;
  if (latency > cfg.performancePenalties.highLatencyThreshold) churnRate += 0.05;
  if (errorRate > cfg.performancePenalties.highErrorThreshold) churnRate += 0.1;
  
  return churnRate;
}

// Reputation change
export function computeReputationDelta(
  uptime: number,
  errorRate: number,
  incidentSeverity: number // 0=none, 1=INFO, 2=WARN, 3=CRIT
): number {
  const cfg = GAME_CONFIG.reputation;
  let delta = 0;
  
  // Base recovery - slow drift toward neutral if stable
  if (uptime > 0.95 && errorRate < 0.05) {
    delta += cfg.baseRecovery;
  }
  
  // Uptime bonus/penalty
  const uptimeThresh = cfg.uptimeThresholds;
  if (uptime > uptimeThresh.excellent.threshold) delta += uptimeThresh.excellent.bonus;
  else if (uptime > uptimeThresh.good.threshold) delta += uptimeThresh.good.bonus;
  else if (uptime > uptimeThresh.acceptable.threshold) delta += uptimeThresh.acceptable.bonus;
  else if (uptime < uptimeThresh.poor.threshold) delta += uptimeThresh.poor.penalty;
  else if (uptime < uptimeThresh.acceptable.threshold) delta += uptimeThresh.bad.penalty;
  
  // Error rate penalty
  const errorPen = cfg.errorPenalties;
  if (errorRate > errorPen.veryHigh.threshold) delta += errorPen.veryHigh.penalty;
  else if (errorRate > errorPen.high.threshold) delta += errorPen.high.penalty;
  
  // Incident penalty
  delta -= incidentSeverity * cfg.incidentSeverityMultiplier;
  
  return delta;
}

// Tech debt growth
export function computeTechDebtGrowth(
  quickFixes: number,
  riskyActions: number
): number {
  return quickFixes * 0.5 + riskyActions * 1.0;
}

// Alert fatigue growth
export function computeAlertFatigueGrowth(
  activeIncidents: number,
  alertRules: number
): number {
  return Math.min(2.0, activeIncidents * 0.1 + alertRules * 0.05);
}

// MTTR (Mean Time To Repair) multiplier
export function computeMTTRMultiplier(
  observabilityLevel: 'BASIC' | 'METRICS' | 'TRACES',
  alertFatigue: number,
  burnout: number,
  sreHired: boolean
): number {
  let multiplier = 1.0;
  
  // Observability reduces MTTR
  if (observabilityLevel === 'METRICS') multiplier *= 0.7;
  else if (observabilityLevel === 'TRACES') multiplier *= 0.5;
  
  // Fatigue increases MTTR
  multiplier *= 1 + (alertFatigue / 100) * 0.5;
  multiplier *= 1 + (burnout / 100) * 0.8;
  
  // SRE reduces MTTR
  if (sreHired) multiplier *= 0.6;
  
  return multiplier;
}

// Incident spawn rate multiplier
export function computeHazardMultiplier(
  utilization: number,
  errorRate: number,
  techDebt: number,
  securityScore: number,
  difficultyMultiplier: number
): number {
  const cfg = GAME_CONFIG.incidents.hazardMultipliers;
  let multiplier = difficultyMultiplier;
  
  // High utilization increases incidents
  if (utilization > cfg.utilizationThreshold) {
    multiplier *= 1 + (utilization - cfg.utilizationThreshold) * cfg.utilizationFactor;
  }
  
  // High error rate
  if (errorRate > cfg.errorThreshold) {
    multiplier *= 1 + errorRate * cfg.errorFactor;
  }
  
  // Tech debt
  multiplier *= 1 + (techDebt / 100) * cfg.techDebtFactor;
  
  // Security score
  multiplier *= 1.5 - (securityScore * cfg.securityFactor);
  
  // Cap the multiplier to prevent death spiral
  return Math.min(multiplier, cfg.maxHazardCap);
}

// Difficulty scaling over time
export function computeDifficultyMultiplier(
  elapsedSeconds: number,
  peakUsers: number,
  _uptimeStreak: number,
  _cash: number
): number {
  const cfg = GAME_CONFIG.incidents;
  let difficulty = cfg.baseDifficultyMultiplier;
  
  // Time-based increase
  const timeFactor = Math.min(
    cfg.maxDifficultyMultiplier,
    1 + elapsedSeconds / cfg.difficultyTimeScale
  );
  difficulty *= timeFactor;
  
  // User-based increase
  const userThresh = cfg.difficultyUserThresholds;
  if (peakUsers > userThresh.high.users) difficulty *= userThresh.high.multiplier;
  else if (peakUsers > userThresh.medium.users) difficulty *= userThresh.medium.multiplier;
  
  return difficulty;
}

