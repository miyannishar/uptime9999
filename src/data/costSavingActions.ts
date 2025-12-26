// Cost-saving and profit-boosting actions for positive gameplay

import { ActionDefinition } from '../sim/types';

export const COST_SAVING_ACTIONS: ActionDefinition[] = [
  // ===== SCALE DOWN ACTIONS (Save Money) =====
  
  {
    id: 'scale_down_app',
    name: '⬇️ Scale Down App -1',
    description: 'Reduce app instances to save costs (if load permits)',
    category: 'COST_OPTIMIZATION',
    target: 'app',
    oneTimeCost: 0,
    recurringCostDelta: -0.15, // SAVES $0.15/sec
    durationSeconds: 30,
    successChance: 1.0,
    cooldownSeconds: 60,
    effects: {
      scaleNode: {
        nodeId: 'app',
        delta: -1,
      },
    },
  },

  {
    id: 'scale_down_workers',
    name: '⬇️ Scale Down Workers -1',
    description: 'Reduce worker instances to cut costs',
    category: 'COST_OPTIMIZATION',
    target: 'workers',
    oneTimeCost: 0,
    recurringCostDelta: -0.12,
    durationSeconds: 30,
    successChance: 1.0,
    cooldownSeconds: 60,
    effects: {
      scaleNode: {
        nodeId: 'workers',
        delta: -1,
      },
    },
  },

  {
    id: 'optimize_db_queries',
    name: '🚀 Optimize Database Queries',
    description: 'Refactor slow queries → reduce DB load → can scale down',
    category: 'OPTIMIZATION',
    target: 'db_primary',
    oneTimeCost: 500,
    recurringCostDelta: 0,
    durationSeconds: 60,
    successChance: 1.0,
    cooldownSeconds: 300,
    effects: {
      statChanges: {
        capacity: 500, // More efficient queries = more capacity
        latency: -5,
      },
      reputationDelta: 10, // Users notice faster queries!
    },
  },

  {
    id: 'compress_assets',
    name: '📦 Compress Static Assets',
    description: 'Enable gzip/brotli → reduce bandwidth costs',
    category: 'OPTIMIZATION',
    target: 'cdn',
    oneTimeCost: 200,
    recurringCostDelta: -0.08, // SAVES bandwidth costs
    durationSeconds: 30,
    successChance: 1.0,
    cooldownSeconds: 600,
    effects: {
      statChanges: {
        latency: -10, // Faster downloads
      },
    },
  },

  {
    id: 'optimize_cache_ttl',
    name: '⏱️ Optimize Cache TTL',
    description: 'Tune cache expiration → better hit rate → less DB load',
    category: 'OPTIMIZATION',
    target: 'cache',
    oneTimeCost: 100,
    recurringCostDelta: 0,
    durationSeconds: 20,
    successChance: 1.0,
    cooldownSeconds: 180,
    effects: {
      statChanges: {
        capacity: 200, // Better hit rate = effective capacity boost
      },
      reputationDelta: 5,
    },
  },

  {
    id: 'consolidate_instances',
    name: '🔧 Consolidate Instances',
    description: 'Merge underutilized instances → reduce costs',
    category: 'COST_OPTIMIZATION',
    target: 'global',
    oneTimeCost: 300,
    recurringCostDelta: -0.25, // BIG savings!
    durationSeconds: 90,
    successChance: 0.9, // Slight risk
    cooldownSeconds: 300,
    effects: {
      techDebt: 5, // Small tech debt increase
    },
  },

  // ===== REVENUE BOOSTERS =====

  {
    id: 'price_increase',
    name: '💰 Increase Pricing +10%',
    description: 'Raise prices if reputation is high (may lose some users)',
    category: 'REVENUE',
    target: 'global',
    oneTimeCost: 0,
    recurringCostDelta: 0,
    durationSeconds: 0, // Instant
    successChance: 1.0,
    cooldownSeconds: 600,
    requires: {
      minCash: 0,
    },
    effects: {
      statChanges: {}, // Handled in reducer
    },
  },

  {
    id: 'marketing_campaign',
    name: '📣 Marketing Campaign',
    description: 'Boost user acquisition (costs money but grows users)',
    category: 'REVENUE',
    target: 'global',
    oneTimeCost: 1000,
    recurringCostDelta: 0,
    durationSeconds: 120,
    successChance: 1.0,
    cooldownSeconds: 180,
    effects: {
      reputationDelta: 15, // Marketing increases awareness
      // Growth boost handled in reducer
    },
  },

  {
    id: 'code_cleanup',
    name: '🧹 Code Cleanup Sprint',
    description: 'Reduce tech debt → more reliable system → better reputation',
    category: 'OPTIMIZATION',
    target: 'global',
    oneTimeCost: 400,
    recurringCostDelta: 0,
    durationSeconds: 60,
    successChance: 1.0,
    cooldownSeconds: 180,
    effects: {
      techDebt: -30, // Reduces tech debt
      reputationDelta: 10,
    },
  },

  {
    id: 'performance_audit',
    name: '🔍 Performance Audit',
    description: 'Identify bottlenecks → optimize critical paths',
    category: 'OPTIMIZATION',
    target: 'global',
    oneTimeCost: 600,
    recurringCostDelta: 0,
    durationSeconds: 90,
    successChance: 1.0,
    cooldownSeconds: 300,
    effects: {
      statChanges: {
        latency: -20,
      },
      reputationDelta: 15, // Users love faster apps!
    },
  },
];

