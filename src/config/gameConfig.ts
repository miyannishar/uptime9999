// SINGLE SOURCE OF TRUTH for all game configuration and balance

export const GAME_CONFIG = {
  // === STARTING STATE ===
  starting: {
    users: 200,      // Bootstrap: start small, grow by deploying components
    cash: 5000,      // Enough for 1-2 early component deployments
    pricing: 25, // $ per user per day
    reputation: 80,
    techDebt: 0,
    alertFatigue: 0,
    observabilityLevel: 'BASIC' as const,
  },

  // === ECONOMIC BALANCE ===
  economy: {
    revenuePerUserPerDay: 25,
    bankruptcyThreshold: -5000,
    // Phase 3 soft-floor: reputation must stay at 0 for this many simulated seconds before game over.
    // At dt=0.1s/tick: 3000s / 0.1 = 30,000 ticks = 3000 real seconds (~50 min) — generous enough
    // to weather prolonged incident waves without premature game-over.
    reputationGameOverGracePeriod: 3000,
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
    // Global scale on template baseRatePerMinute (they sum to ~1.36/min unscaled).
    // At 2.0: ~1 eligible incident every 49s early-game, ~27/30min total. Feels active.
    // At 0.5 (old): 1 every 197s — too slow to feel like anything is happening.
    spawnRateMultiplier: 1.5,
    maxConcurrent: 6,
    mitigationPerAction: 1.0, // 100% mitigation per action (1 action = full resolution)
    // Reputation for a resolved incident. Auto-resolve pays less than acting, so
    // ignoring an incident is never as good as fixing it.
    mitigatedReputationReward: 3,
    autoResolveReputationReward: 0,
    // AI Incident effect caps (prevent death spiral)
    aiEffectCaps: {
      maxHealthDecayPerSec: 0.004, // Max 0.4%/s — reaches degraded (0.8) in ~50s, gives time to act
      maxErrorMultiplier: 3.0, // Cap error multiplier from all incidents combined
      maxLatencyMultiplier: 2.5, // Cap latency multiplier from all incidents combined
      maxUtilizationMultiplier: 2.0, // Cap utilization multiplier from all incidents combined
    },
    // Immediate mitigation when action starts (gives player hope)
    immediateMitigationOnActionStart: 0.3, // 30% mitigation applied immediately when action starts
    spreadAfterSeconds: 45,
  },

  // === AI / OPENAI ===
  // Single source of truth for both callers (aiGameMaster + taskGenerator) so the
  // model and its pricing can't drift apart between them.
  ai: {
    model: 'gpt-4.1',
    inputCostPerToken: 2.0 / 1_000_000,  // $2.00 / 1M input tokens
    outputCostPerToken: 8.0 / 1_000_000, // $8.00 / 1M output tokens
    // 1500 truncated the "log" task type (50-100 log lines) mid-JSON; 4000 is only a
    // ceiling, billing follows actual usage (incidents ~1000, log tasks ~1900)
    maxCompletionTokens: 4000,
    // Only flavour WARN/CRIT to keep AI spend reasonable (INFO is too noisy).
    flavourSeverities: ['WARN', 'CRIT'] as ReadonlyArray<'INFO' | 'WARN' | 'CRIT'>,
  },

  // === SESSION MANAGEMENT ===
  session: {
    maxDurationMs: 30 * 60 * 1000, // 30 minute hard cap
    maxApiCalls: 200, // Max OpenAI calls per session
    taskCallShare: 0.25, // fraction of maxApiCalls that interactive tasks may consume
    inactivityTimeoutMs: 5 * 60 * 1000, // 5 min idle → auto-end
    calmPeriodAfterCritMs: 30000, // 30 second breather after resolving CRIT
  },

  // === SUBSYSTEMS (pager, war room, stakeholders, status page) ===
  subsystems: {
    tickMs: 500,
    messageTtlMs: 30000,
    maxPendingMessages: 3,
    ignoredMessagePenalty: 2, // reputation per message left to expire
    pagerTimeoutMs: 30000,
    pagerMissedRepPenalty: 5,
    pagerMissedBurnout: 5,
    warRoomCritThreshold: 3,
    warRoomSurvivedRepBonus: 5,
    statusPageUnderstatedPenalty: 0.05, // reputation per tick while understating an outage
    statusPageGraceSec: 30,
    postMortemEveryNResolved: 3,
    postMortemUserImpactShare: 0.3,
    postMortemRevenueLostShare: 0.5,
  },

  // === METRIC RECOVERY ===
  metricRecovery: {
    baseRecoveryRate: 0.03, // 3%/sec recovery toward baseline when no incident
    incidentRecoveryRate: 0.01, // 1%/sec partial recovery even during incidents
    // Recovery is suppressed entirely while a node is under an active incident;
    // it resumes on the tick after the incident clears.
    healthRecoveryDuringIncident: 0,
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
    uptimeWindowSeconds: 300, // rolling window for the uptime average
    tickSeconds: 0.1,         // real seconds per tick; App's interval must match
  },

  // === TRAFFIC ===
  traffic: {
    // Requests per second contributed by each active user. Tuned so the app cluster
    // reaches its 0.7 latency knee in the first few minutes at starting capacity,
    // making the first cache/CDN deployment feel like relief rather than bookkeeping.
    rpsPerActiveUser: 0.75,
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
    leftPanelWidth: 320,
    leftPanelMin: 240,
    leftPanelMax: 520,
    rightPanelWidth: 300,
    rightPanelMin: 240,
    rightPanelMax: 600,
    bottomPanelHeight: 220,
    bottomPanelMin: 160,
    bottomPanelMax: 0.6, // 60% of window height
    activityLogWidth: 350,
  },

  // === MILESTONES ===
  // Celebrated with a full-screen announcement + cash injection when first crossed.
  milestones: {
    canaryDeploy: { users: 10000 },
    dbReplica: { users: 50000 },
    multiRegion: { users: 100000 },
    advancedObservability: { uptimeStreak: 1200 },
  },

  // === ENGAGEMENT ===
  engagement: {
    // Streak: how long (ms) after a player-mitigated resolve to keep the streak alive
    streakWindowMs: 120_000,
    // Combo cash bonuses per streak level (index = streak count, capped at last entry)
    streakCashBonus: [0, 0, 50, 100, 200, 400, 800, 1500],
    // Streak rep bonus per level (small, feels good)
    streakRepBonus:  [0, 0,  1,   2,   3,   4,   5,    6],
    // User milestones: [userCount, id, label, cashReward, message]
    userMilestones: [
      { users:  1_000, id: 'users_1k',   label: '1,000 Users!',   cash:  500, msg: '🎉 First thousand users! The product is real.' },
      { users:  5_000, id: 'users_5k',   label: '5,000 Users!',   cash: 1000, msg: '🚀 5k users! Word is spreading fast.' },
      { users: 10_000, id: 'users_10k',  label: '10,000 Users!',  cash: 2000, msg: '📈 10k users! We just made TechCrunch.' },
      { users: 25_000, id: 'users_25k',  label: '25,000 Users!',  cash: 4000, msg: '💥 25k users! Series A incoming.' },
      { users: 50_000, id: 'users_50k',  label: '50,000 Users!',  cash: 8000, msg: '🏆 50k users! The investors are calling.' },
      { users: 100_000, id: 'users_100k', label: '100,000 Users!', cash: 15000, msg: '🌟 100k users! We are officially at scale.' },
    ],
    // How long (ms) to display the milestone banner
    milestoneDurationMs: 5000,
    // WARN escalates to CRIT after this many simulated seconds without any mitigation started
    warnEscalateAfterSec: 240,
  },
};


