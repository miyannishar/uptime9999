// Dynamic Architecture Operations - 20 operations for Phase 1 & 2
// These operations allow players to modify the architecture in real-time

import { ActionDefinition } from '../sim/types';

export const DYNAMIC_ACTIONS: ActionDefinition[] = [
  // ===== DATABASE OPERATIONS =====
  
  {
    id: 'add_db_replica',
    name: 'Add Database Replica',
    description: 'Deploy read replica for high availability and read scaling',
    category: 'DATABASE',
    target: 'global',
    oneTimeCost: 800,
    recurringCostDelta: 0.08, // $0.08/sec ongoing cost
    durationSeconds: 120,
    successChance: 1.0,
    cooldownSeconds: 120,
    effects: {
      addComponent: {
        type: 'DB_REPLICA',
        baseNodeId: 'db_replica',
        redundancyGroup: 'db_replicas',
        isPrimary: false,
        connections: [
          { from: 'db_primary', to: 'target', weight: 1.0 }, // Replication
          { from: 'app', to: 'target', weight: 0.15 }, // 15% reads to new replica
        ],
      },
      reputationDelta: 5,
    },
  },

  {
    id: 'add_db_pooler',
    name: 'Add Connection Pooler',
    description: 'PgBouncer-style pooler to optimize database connections',
    category: 'DATABASE',
    target: 'global',
    oneTimeCost: 400,
    recurringCostDelta: 0.03,
    durationSeconds: 90,
    successChance: 1.0,
    cooldownSeconds: 180,
    effects: {
      addComponent: {
        type: 'DB_PRIMARY',
        baseNodeId: 'db_primary',
        connections: [
          { from: 'app', to: 'target', weight: 0.5 }, // Route app traffic through pooler
          { from: 'target', to: 'db_primary', weight: 1.0 }, // Pooler to DB
        ],
      },
      techDebt: -5, // Reduces tech debt (better architecture)
    },
  },

  // ===== APPLICATION TIER =====
  
  {
    id: 'add_app_instance',
    name: 'Add App Instance',
    description: 'Horizontal scaling - add another app server',
    category: 'SCALING',
    target: 'global',
    oneTimeCost: 500,
    recurringCostDelta: 0.05,
    durationSeconds: 60,
    successChance: 1.0,
    cooldownSeconds: 60,
    effects: {
      addComponent: {
        type: 'APP',
        baseNodeId: 'app',
        redundancyGroup: 'app_cluster',
        connections: [
          { from: 'apigw', to: 'target', weight: 0.5 }, // API Gateway routes to new instance
          { from: 'target', to: 'cache', weight: 0.6 },
          { from: 'target', to: 'db_primary', weight: 0.5 },
          { from: 'target', to: 'queue', weight: 0.2 },
        ],
      },
      reputationDelta: 3,
    },
  },

  {
    id: 'remove_app_instance',
    name: 'Remove App Instance',
    description: 'Scale down to save costs (requires 2+ instances)',
    category: 'COST_OPTIMIZATION',
    target: 'global',
    oneTimeCost: 0,
    recurringCostDelta: -0.05, // Saves money
    durationSeconds: 45,
    successChance: 1.0,
    cooldownSeconds: 90,
    requires: {
      minCash: 0, // Can always remove
    },
    effects: {
      // Will be handled dynamically - remove highest instance number
      techDebt: 5, // Slightly increases tech debt (less capacity)
    },
  },

  {
    id: 'split_auth_service',
    name: 'Split Auth Service',
    description: 'Extract authentication into microservice',
    category: 'ARCHITECTURE',
    target: 'global',
    oneTimeCost: 1200,
    recurringCostDelta: 0.04,
    durationSeconds: 240,
    successChance: 0.95,
    cooldownSeconds: 300,
    effects: {
      splitService: {
        serviceName: 'Auth',
        type: 'APP',
        trafficPercentage: 30,
      },
      techDebt: 10, // Microservices add complexity
      reputationDelta: 10, // Better security
    },
  },

  {
    id: 'split_payment_service',
    name: 'Split Payment Service',
    description: 'Extract payments into PCI-compliant microservice',
    category: 'ARCHITECTURE',
    target: 'global',
    oneTimeCost: 1500,
    recurringCostDelta: 0.06,
    durationSeconds: 240,
    successChance: 0.92,
    cooldownSeconds: 300,
    effects: {
      splitService: {
        serviceName: 'Payment',
        type: 'APP',
        trafficPercentage: 20,
      },
      techDebt: 12,
      reputationDelta: 15, // Compliance + security
    },
  },

  {
    id: 'split_notification_service',
    name: 'Split Notification Service',
    description: 'Extract notifications into async microservice',
    category: 'ARCHITECTURE',
    target: 'global',
    oneTimeCost: 800,
    recurringCostDelta: 0.03,
    durationSeconds: 180,
    successChance: 0.97,
    cooldownSeconds: 240,
    effects: {
      splitService: {
        serviceName: 'Notification',
        type: 'APP',
        trafficPercentage: 15,
      },
      techDebt: 8,
    },
  },

  // ===== WORKER OPERATIONS =====
  
  {
    id: 'add_worker_instance',
    name: 'Add Worker Instance',
    description: 'Scale async job processing capacity',
    category: 'SCALING',
    target: 'global',
    oneTimeCost: 400,
    recurringCostDelta: 0.04,
    durationSeconds: 45,
    successChance: 1.0,
    cooldownSeconds: 45,
    effects: {
      addComponent: {
        type: 'WORKERS',
        baseNodeId: 'workers',
        redundancyGroup: 'worker_pool',
        connections: [
          { from: 'queue', to: 'target', weight: 0.5 }, // Queue distributes to new worker
          { from: 'target', to: 'db_primary', weight: 0.8 },
        ],
      },
    },
  },

  {
    id: 'remove_worker_instance',
    name: 'Remove Worker Instance',
    description: 'Scale down workers to save costs (requires 2+ instances)',
    category: 'COST_OPTIMIZATION',
    target: 'global',
    oneTimeCost: 0,
    recurringCostDelta: -0.04,
    durationSeconds: 30,
    successChance: 1.0,
    cooldownSeconds: 60,
    effects: {
      // Will be handled dynamically
    },
  },

  // ===== CACHING & PERFORMANCE =====
  
  {
    id: 'add_cache_node',
    name: 'Add Redis Cluster Node',
    description: 'Add cache node for better hit rate and capacity',
    category: 'PERFORMANCE',
    target: 'global',
    oneTimeCost: 600,
    recurringCostDelta: 0.05,
    durationSeconds: 90,
    successChance: 1.0,
    cooldownSeconds: 120,
    effects: {
      addComponent: {
        type: 'CACHE',
        baseNodeId: 'cache',
        redundancyGroup: 'cache_cluster',
        connections: [
          { from: 'app', to: 'target', weight: 0.3 }, // App uses new cache node
        ],
      },
    },
  },

  {
    id: 'add_cdn_edge',
    name: 'Add CDN Edge Location',
    description: 'Deploy CDN edge in new geographic region',
    category: 'PERFORMANCE',
    target: 'cdn',
    oneTimeCost: 400,
    recurringCostDelta: 0.03,
    durationSeconds: 120,
    successChance: 1.0,
    cooldownSeconds: 90,
    effects: {
      statChanges: {
        capacity: 10000,
        latency: -5, // Faster due to geographic distribution
      },
      reputationDelta: 5,
    },
  },

  {
    id: 'remove_cache_emergency',
    name: 'Disable Cache (Emergency)',
    description: 'Turn off cache to save costs - INCREASES DB LOAD 3x!',
    category: 'COST_OPTIMIZATION',
    target: 'cache',
    oneTimeCost: 0,
    recurringCostDelta: -0.05,
    durationSeconds: 30,
    successChance: 1.0,
    cooldownSeconds: 180,
    effects: {
      // Disable cache node
      techDebt: 20, // Major tech debt
      downtimeRisk: 0.3, // 30% chance of brief outage
    },
  },

  // ===== LOAD BALANCING & TRAFFIC =====
  
  {
    id: 'add_apigw_instance',
    name: 'Add API Gateway Instance',
    description: 'Add redundant API Gateway for HA',
    category: 'SCALING',
    target: 'global',
    oneTimeCost: 600,
    recurringCostDelta: 0.04,
    durationSeconds: 90,
    successChance: 1.0,
    cooldownSeconds: 120,
    effects: {
      addComponent: {
        type: 'APIGW',
        baseNodeId: 'apigw',
        redundancyGroup: 'apigw_cluster',
        connections: [
          { from: 'rlb', to: 'target', weight: 0.5 }, // Load balancer routes to new gateway
          { from: 'target', to: 'app', weight: 1.0 },
        ],
      },
      reputationDelta: 5,
    },
  },

  {
    id: 'enable_anycast_dns',
    name: 'Enable Anycast DNS',
    description: 'DNS responds from nearest global location',
    category: 'PERFORMANCE',
    target: 'dns',
    oneTimeCost: 400,
    recurringCostDelta: 0.02,
    durationSeconds: 60,
    successChance: 1.0,
    cooldownSeconds: 90,
    effects: {
      statChanges: {
        latency: -3, // Faster DNS resolution
        reliability: 0.001,
      },
      reputationDelta: 3,
    },
  },

  // ===== OBSERVABILITY =====
  
  {
    id: 'add_distributed_tracing',
    name: 'Add Distributed Tracing',
    description: 'See request flow across services - faster debugging',
    category: 'OBSERVABILITY',
    target: 'observability',
    oneTimeCost: 600,
    recurringCostDelta: 0.03,
    durationSeconds: 90,
    successChance: 1.0,
    cooldownSeconds: 120,
    effects: {
      statChanges: {
        mttrMultiplier: -0.2, // 20% faster incident resolution
      },
      techDebt: -10, // Better visibility reduces tech debt
    },
  },

  {
    id: 'add_log_aggregation',
    name: 'Add Log Aggregation',
    description: 'Centralized logging - find issues faster',
    category: 'OBSERVABILITY',
    target: 'observability',
    oneTimeCost: 500,
    recurringCostDelta: 0.025,
    durationSeconds: 75,
    successChance: 1.0,
    cooldownSeconds: 90,
    effects: {
      statChanges: {
        mttrMultiplier: -0.15, // 15% faster debugging
      },
      techDebt: -8,
    },
  },

  // ===== COST OPTIMIZATION =====
  
  {
    id: 'enable_autoscaling',
    name: 'Enable Auto-Scaling',
    description: 'Instances auto-add/remove based on load',
    category: 'COST_OPTIMIZATION',
    target: 'global',
    oneTimeCost: 500,
    recurringCostDelta: 0, // Neutral - saves money during low traffic
    durationSeconds: 90,
    successChance: 1.0,
    cooldownSeconds: 120,
    effects: {
      featureToggle: {
        feature: 'autoscaling',
        value: true,
      },
      techDebt: -5, // Better resource management
      reputationDelta: 5,
    },
  },

  {
    id: 'compress_static_assets',
    name: 'Compress Static Assets',
    description: 'Reduce CDN bandwidth costs, faster page loads',
    category: 'COST_OPTIMIZATION',
    target: 'cdn',
    oneTimeCost: 100,
    recurringCostDelta: -0.01, // Small savings
    durationSeconds: 30,
    successChance: 1.0,
    cooldownSeconds: 60,
    effects: {
      statChanges: {
        latency: -2, // Faster due to smaller payloads
      },
    },
  },

  // ===== SECURITY =====
  
  {
    id: 'add_ddos_protection',
    name: 'Add DDoS Protection',
    description: 'Layer 7 protection - prevents attacks',
    category: 'SECURITY',
    target: 'waf',
    oneTimeCost: 900,
    recurringCostDelta: 0.06,
    durationSeconds: 120,
    successChance: 1.0,
    cooldownSeconds: 180,
    effects: {
      statChanges: {
        security: 0.05,
        reliability: 0.01,
      },
      reputationDelta: 10,
    },
  },

  {
    id: 'add_rate_limiting',
    name: 'Add Rate Limiting Layer',
    description: 'Prevent abuse and protect from traffic spikes',
    category: 'SECURITY',
    target: 'apigw',
    oneTimeCost: 400,
    recurringCostDelta: 0.02,
    durationSeconds: 60,
    successChance: 1.0,
    cooldownSeconds: 90,
    effects: {
      featureToggle: {
        feature: 'rateLimit',
        value: 1000, // 1000 req/sec per user
      },
      statChanges: {
        security: 0.03,
      },
      reputationDelta: 5,
    },
  },

  {
    id: 'enable_e2e_encryption',
    name: 'Enable End-to-End Encryption',
    description: 'Encrypt data in transit - compliance benefit',
    category: 'SECURITY',
    target: 'global',
    oneTimeCost: 700,
    recurringCostDelta: 0.03,
    durationSeconds: 90,
    successChance: 1.0,
    cooldownSeconds: 120,
    effects: {
      statChanges: {
        security: 0.08,
        latency: 5, // Encryption overhead
      },
      reputationDelta: 12,
    },
  },

  // ===== QUEUE & ASYNC =====
  
  {
    id: 'add_priority_queue',
    name: 'Add Priority Queue',
    description: 'High/low priority lanes - critical jobs first',
    category: 'ARCHITECTURE',
    target: 'global',
    oneTimeCost: 600,
    recurringCostDelta: 0.03,
    durationSeconds: 90,
    successChance: 1.0,
    cooldownSeconds: 120,
    effects: {
      addComponent: {
        type: 'QUEUE',
        baseNodeId: 'queue',
        connections: [
          { from: 'app', to: 'target', weight: 0.15 }, // Priority jobs
          { from: 'target', to: 'workers', weight: 1.0 },
        ],
      },
      reputationDelta: 8,
    },
  },

  {
    id: 'add_dead_letter_queue',
    name: 'Add Dead Letter Queue',
    description: 'Store failed jobs for analysis - reduces data loss',
    category: 'RELIABILITY',
    target: 'global',
    oneTimeCost: 300,
    recurringCostDelta: 0.02,
    durationSeconds: 60,
    successChance: 1.0,
    cooldownSeconds: 90,
    effects: {
      addComponent: {
        type: 'QUEUE',
        baseNodeId: 'queue',
        connections: [
          { from: 'workers', to: 'target', weight: 0.05 }, // Failed jobs
        ],
      },
      techDebt: -5,
      reputationDelta: 5,
    },
  },

  // ===== ADVANCED INFRASTRUCTURE =====
  
  {
    id: 'add_message_bus',
    name: 'Add Message Bus',
    description: 'Kafka-style event streaming - event-driven architecture',
    category: 'ARCHITECTURE',
    target: 'global',
    oneTimeCost: 1400,
    recurringCostDelta: 0.08,
    durationSeconds: 180,
    successChance: 0.95,
    cooldownSeconds: 240,
    effects: {
      addComponent: {
        type: 'QUEUE',
        baseNodeId: 'queue',
        connections: [
          { from: 'app', to: 'target', weight: 0.25 },
          { from: 'target', to: 'workers', weight: 1.0 },
          { from: 'target', to: 'db_primary', weight: 0.2 }, // Event sourcing
        ],
      },
      techDebt: 15, // Complex system
      reputationDelta: 10,
    },
  },

  {
    id: 'add_search_service',
    name: 'Add Search Service',
    description: 'Elasticsearch cluster - offload complex queries from DB',
    category: 'ARCHITECTURE',
    target: 'global',
    oneTimeCost: 1400,
    recurringCostDelta: 0.09,
    durationSeconds: 200,
    successChance: 0.93,
    cooldownSeconds: 300,
    effects: {
      addComponent: {
        type: 'DB_PRIMARY',
        baseNodeId: 'db_primary',
        connections: [
          { from: 'app', to: 'target', weight: 0.2 }, // 20% queries go to search
          { from: 'db_primary', to: 'target', weight: 0.5 }, // Replication for indexing
        ],
      },
      techDebt: 12,
      reputationDelta: 8,
    },
  },

  {
    id: 'add_reverse_proxy',
    name: 'Add Reverse Proxy',
    description: 'Nginx/HAProxy - SSL termination and routing',
    category: 'INFRASTRUCTURE',
    target: 'global',
    oneTimeCost: 300,
    recurringCostDelta: 0.02,
    durationSeconds: 60,
    successChance: 1.0,
    cooldownSeconds: 90,
    effects: {
      addComponent: {
        type: 'RLB',
        baseNodeId: 'rlb',
        connections: [
          { from: 'glb', to: 'target', weight: 1.0 },
          { from: 'target', to: 'apigw', weight: 1.0 },
        ],
      },
      statChanges: {
        security: 0.02,
      },
    },
  },

  // ===== EXPERIMENTAL / ADVANCED =====
  
  {
    id: 'enable_multi_az',
    name: 'Enable Multi-AZ Failover',
    description: 'Deploy DB replica in different availability zone',
    category: 'RELIABILITY',
    target: 'global',
    oneTimeCost: 1200,
    recurringCostDelta: 0.1,
    durationSeconds: 180,
    successChance: 1.0,
    cooldownSeconds: 300,
    effects: {
      addComponent: {
        type: 'DB_REPLICA',
        baseNodeId: 'db_replica',
        redundancyGroup: 'db_replicas',
        isPrimary: false,
        connections: [
          { from: 'db_primary', to: 'target', weight: 1.0 },
        ],
      },
      reputationDelta: 15, // Major reliability boost
    },
  },
];

