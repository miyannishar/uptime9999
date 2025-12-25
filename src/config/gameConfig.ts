// SINGLE SOURCE OF TRUTH for all game configuration and balance

export const GAME_CONFIG = {
  // === STARTING STATE ===
  starting: {
    users: 10000,
    cash: 4000, // Reduced from 20000 - makes spending decisions meaningful
    pricing: 25, // $ per user per day
    reputation: 80,
    techDebt: 0,
    alertFatigue: 0,
    observabilityLevel: 'BASIC' as const,
  },

  // === ECONOMIC BALANCE ===
  economy: {
    revenuePerUserPerDay: 25,
    bankruptcyThreshold: -2000,
    reputationGameOverGracePeriod: 60, // seconds at 0 before game over
  },

  // === USER GROWTH ===
  growth: {
    baseGrowthRate: 1.0, // users/sec per 1000 users
    reputationMultipliers: {
      excellent: { threshold: 70, multiplier: 2.5 },
      good: { threshold: 50, multiplier: 2.0 },
      decent: { threshold: 30, multiplier: 1.5 },
      poor: { threshold: 0, multiplier: 1.0 },
    },
    performancePenalties: {
      highLatencyThreshold: 3000, // ms
      highLatencyMultiplier: 0.8,
      highErrorThreshold: 0.2,
      highErrorMultiplier: 0.8,
    },
    baseChurnRate: 0.05, // % per sec per 1000 users
    downtimeChurnBonus: 0.3,
  },

  // === REPUTATION ===
  reputation: {
    baseRecovery: 0.05, // per second when stable
    uptimeThresholds: {
      excellent: { threshold: 0.999, bonus: 0.5 },
      good: { threshold: 0.99, bonus: 0.3 },
      acceptable: { threshold: 0.95, bonus: 0.1 },
      poor: { threshold: 0.90, penalty: -0.8 },
      bad: { threshold: 0, penalty: -0.3 },
    },
    errorPenalties: {
      veryHigh: { threshold: 0.2, penalty: -0.3 },
      high: { threshold: 0.1, penalty: -0.1 },
    },
    incidentSeverityMultiplier: 0.2, // per severity point
  },

  // === INCIDENT SYSTEM ===
  incidents: {
    baseDifficultyMultiplier: 1.0,
    maxDifficultyMultiplier: 1.5,
    difficultyTimeScale: 3600, // seconds to max difficulty
    difficultyUserThresholds: {
      high: { users: 200000, multiplier: 1.2 },
      medium: { users: 100000, multiplier: 1.1 },
    },
    hazardMultipliers: {
      maxHazardCap: 3.0, // prevent death spiral
      utilizationThreshold: 0.9,
      utilizationFactor: 1.5,
      errorThreshold: 0.1,
      errorFactor: 2.0,
      techDebtFactor: 0.5, // per 100 debt
      securityFactor: 0.5,
    },
    mitigationPerAction: 1.0, // 100% mitigation per action (1 action = full resolution)
    // AI Incident effect caps (prevent death spiral)
    aiEffectCaps: {
      maxHealthDecayPerSec: 0.003, // Max 0.3% health loss per second per node (even with multiple incidents)
      maxErrorMultiplier: 3.0, // Cap error multiplier from all incidents combined
      maxLatencyMultiplier: 2.5, // Cap latency multiplier from all incidents combined
      maxUtilizationMultiplier: 2.0, // Cap utilization multiplier from all incidents combined
    },
    // Immediate mitigation when action starts (gives player hope)
    immediateMitigationOnActionStart: 0.3, // 30% mitigation applied immediately when action starts
  },

  // === ACTION TIMINGS ===
  actions: {
    // Fast actions (scale, config changes)
    fastDuration: 10,
    fastCooldown: 30,

    // Medium actions (deploys, patches)
    mediumDuration: 30,
    mediumCooldown: 120,

    // Slow actions (major upgrades)
    slowDuration: 60,
    slowCooldown: 300,

    // Very slow actions (region deployment, hiring)
    verySlowDuration: 120,
    verySlowCooldown: 1800,
  },

  // === SIMULATION ===
  simulation: {
    tickIntervalMs: 100, // real time between ticks
    defaultSimDt: 1, // simulated seconds per tick
    uptimeWindowSize: 300, // 5 minutes
    autosaveIntervalSec: 30,
  },

  // === ACTIVITY RATE (time of day) ===
  activity: {
    baselineRate: 0.5,
    weekdayBonus: 0.2,
    businessHoursBonus: 0.3,
    eveningBonus: 0.4,
    nightPenalty: 0.3,
    businessHoursStart: 9,
    businessHoursEnd: 17,
    eveningStart: 18,
    eveningEnd: 22,
    nightStart: 1,
    nightEnd: 6,
  },

  // === STRESS SYSTEM ===
  stress: {
    alertFatiguePerIncident: 0.1,
    alertFatigueDecay: 1.0, // per second
    burnoutPerCritIncident: 0.5,
    burnoutDecay: 0.5, // per second
    techDebtDecay: 0.1, // per second
  },

  // === LATENCY & ERROR CALCULATIONS ===
  performance: {
    latencyThresholds: {
      normal: 0.7, // utilization below this = no penalty
      stressed: 1.0, // linear increase up to here
      overloadFactor: 5, // exponential factor above 1.0
    },
    errorThresholds: {
      utilization: 0.8, // errors start increasing here
      overloadFactor: 5,
    },
  },

  // === UI DEFAULTS ===
  ui: {
    leftPanelWidth: 350,
    leftPanelMin: 250,
    leftPanelMax: 500,
    rightPanelWidth: 380,
    rightPanelMin: 300,
    rightPanelMax: 600,
    bottomPanelHeight: 200,
    bottomPanelMin: 150,
    bottomPanelMax: 0.6, // 60% of window height
    activityLogWidth: 350,
  },

  // === MILESTONES ===
  milestones: {
    canaryDeploy: { users: 10000 },
    dbReplica: { users: 50000 },
    multiRegion: { users: 100000 },
    advancedObservability: { uptimeStreak: 1200 }, // 20 minutes
  },
};

// Helper to get action timing preset
export function getActionTiming(speed: 'fast' | 'medium' | 'slow' | 'verySlow') {
  const timings = GAME_CONFIG.actions;
  switch (speed) {
    case 'fast':
      return { duration: timings.fastDuration, cooldown: timings.fastCooldown };
    case 'medium':
      return { duration: timings.mediumDuration, cooldown: timings.mediumCooldown };
    case 'slow':
      return { duration: timings.slowDuration, cooldown: timings.slowCooldown };
    case 'verySlow':
      return { duration: timings.verySlowDuration, cooldown: timings.verySlowCooldown };
  }
}

