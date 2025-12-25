// Architecture graph definition

import { ComponentNode, ArchitectureEdge } from '../sim/types';

export function createInitialArchitecture(): {
  nodes: Map<string, ComponentNode>;
  edges: ArchitectureEdge[];
} {
  const nodes = new Map<string, ComponentNode>();

  // DNS
  nodes.set('dns', {
    id: 'dns',
    type: 'DNS',
    name: 'DNS',
    enabled: true,
    locked: false,
    capacity: 100000,
    baseLatency: 5,
    baseError: 0.0001,
    health: 1,
    reliabilityScore: 0.999,
    securityScore: 0.9,
    scaling: { min: 1, max: 1, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 5,
    errorRate: 0.0001,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.01,
    operationalMode: 'normal',
    features: {},
  });

  // CDN
  nodes.set('cdn', {
    id: 'cdn',
    type: 'CDN',
    name: 'CDN',
    enabled: true,
    locked: false,
    capacity: 50000,
    baseLatency: 20,
    baseError: 0.001,
    health: 1,
    reliabilityScore: 0.99,
    securityScore: 0.8,
    scaling: { min: 1, max: 5, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 20,
    errorRate: 0.001,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.05, // Reduced from 0.1
    operationalMode: 'normal',
    features: {
      cacheTTL: 300,
    },
  });

  // WAF
  nodes.set('waf', {
    id: 'waf',
    type: 'WAF',
    name: 'WAF',
    enabled: true,
    locked: false,
    capacity: 30000,
    baseLatency: 5,
    baseError: 0.001,
    health: 1,
    reliabilityScore: 0.98,
    securityScore: 0.95,
    scaling: { min: 1, max: 3, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 5,
    errorRate: 0.001,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.15,
    operationalMode: 'normal',
    features: {
      rateLimit: 0, // disabled at start
      botProtection: false,
    },
  });

  // Global Load Balancer
  nodes.set('glb', {
    id: 'glb',
    type: 'GLB',
    name: 'Global LB',
    enabled: true,
    locked: false,
    capacity: 50000,
    baseLatency: 10,
    baseError: 0.0005,
    health: 1,
    reliabilityScore: 0.999,
    securityScore: 0.85,
    scaling: { min: 1, max: 3, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 10,
    errorRate: 0.0005,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.2,
    operationalMode: 'normal',
    features: {},
  });

  // Regional Load Balancer
  nodes.set('rlb', {
    id: 'rlb',
    type: 'RLB',
    name: 'Regional LB',
    enabled: true,
    locked: false,
    capacity: 30000,
    baseLatency: 5,
    baseError: 0.001,
    health: 1,
    reliabilityScore: 0.995,
    securityScore: 0.85,
    scaling: { min: 1, max: 5, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 5,
    errorRate: 0.001,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.1,
    operationalMode: 'normal',
    features: {},
  });

  // API Gateway
  nodes.set('apigw', {
    id: 'apigw',
    type: 'APIGW',
    name: 'API Gateway',
    enabled: true,
    locked: false,
    capacity: 20000,
    baseLatency: 15,
    baseError: 0.002,
    health: 1,
    reliabilityScore: 0.99,
    securityScore: 0.9,
    scaling: { min: 1, max: 10, current: 1, cooldownUntil: 0 }, // Start with 1 instead of 2
    utilization: 0,
    latency: 15,
    errorRate: 0.002,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.2, // Reduced from 0.3
    operationalMode: 'normal',
    features: {
      rateLimit: 0,
    },
  });

  // App Cluster
  nodes.set('app', {
    id: 'app',
    type: 'APP',
    name: 'App Cluster',
    enabled: true,
    locked: false,
    capacity: 5000,
    baseLatency: 50,
    baseError: 0.005,
    health: 1,
    reliabilityScore: 0.95,
    securityScore: 0.8,
    scaling: { min: 2, max: 50, current: 2, cooldownUntil: 0 }, // Start with 2 instead of 3
    utilization: 0,
    latency: 50,
    errorRate: 0.005,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.3, // Reduced from 0.5
    operationalMode: 'normal',
    features: {
      autoscaling: false,
      circuitBreaker: false,
      retries: false,
      canaryDeploy: false,
    },
  });

  // Service Mesh (locked at start)
  nodes.set('servicemesh', {
    id: 'servicemesh',
    type: 'SERVICE_MESH',
    name: 'Service Mesh',
    enabled: false,
    locked: true,
    capacity: 50000,
    baseLatency: 3,
    baseError: 0.0001,
    health: 1,
    reliabilityScore: 0.995,
    securityScore: 0.95,
    scaling: { min: 1, max: 1, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 3,
    errorRate: 0.0001,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.5,
    operationalMode: 'normal',
    features: {},
  });

  // Cache (Redis)
  nodes.set('cache', {
    id: 'cache',
    type: 'CACHE',
    name: 'Redis Cache',
    enabled: true,
    locked: false,
    capacity: 10000,
    baseLatency: 2,
    baseError: 0.001,
    health: 1,
    reliabilityScore: 0.98,
    securityScore: 0.85,
    scaling: { min: 1, max: 10, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 2,
    errorRate: 0.001,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.1, // Reduced from 0.2
    operationalMode: 'normal',
    features: {},
  });

  // Queue
  nodes.set('queue', {
    id: 'queue',
    type: 'QUEUE',
    name: 'Message Queue',
    enabled: true,
    locked: false,
    capacity: 5000,
    baseLatency: 10,
    baseError: 0.002,
    health: 1,
    reliabilityScore: 0.97,
    securityScore: 0.85,
    scaling: { min: 1, max: 5, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 10,
    errorRate: 0.002,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.08, // Reduced from 0.15
    operationalMode: 'normal',
    features: {},
  });

  // Workers
  nodes.set('workers', {
    id: 'workers',
    type: 'WORKERS',
    name: 'Workers',
    enabled: true,
    locked: false,
    capacity: 2000,
    baseLatency: 100,
    baseError: 0.01,
    health: 1,
    reliabilityScore: 0.95,
    securityScore: 0.8,
    scaling: { min: 1, max: 30, current: 2, cooldownUntil: 0 }, // Start with 2 instead of 3
    utilization: 0,
    latency: 100,
    errorRate: 0.01,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.25, // Reduced from 0.4
    operationalMode: 'normal',
    features: {},
  });

  // Database Primary
  nodes.set('db_primary', {
    id: 'db_primary',
    type: 'DB_PRIMARY',
    name: 'DB Primary',
    enabled: true,
    locked: false,
    capacity: 3000,
    baseLatency: 20,
    baseError: 0.003,
    health: 1,
    reliabilityScore: 0.99,
    securityScore: 0.9,
    scaling: { min: 1, max: 1, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 20,
    errorRate: 0.003,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.5, // Reduced from 0.8
    operationalMode: 'normal',
    features: {
      connectionPool: false,
      maxConnections: 100,
    },
  });

  // Database Read Replica (starts with low capacity)
  nodes.set('db_replica', {
    id: 'db_replica',
    type: 'DB_REPLICA',
    name: 'DB Replica',
    enabled: true,
    locked: false,
    capacity: 1000,
    baseLatency: 25,
    baseError: 0.003,
    health: 1,
    reliabilityScore: 0.98,
    securityScore: 0.9,
    scaling: { min: 0, max: 3, current: 0, cooldownUntil: 0 },
    utilization: 0,
    latency: 25,
    errorRate: 0.003,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.4,
    operationalMode: 'normal',
    features: {},
  });

  // Object Storage
  nodes.set('storage', {
    id: 'storage',
    type: 'OBJECT_STORAGE',
    name: 'Object Storage',
    enabled: true,
    locked: false,
    capacity: 10000,
    baseLatency: 30,
    baseError: 0.001,
    health: 1,
    reliabilityScore: 0.9999,
    securityScore: 0.95,
    scaling: { min: 1, max: 1, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 30,
    errorRate: 0.001,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.05,
    operationalMode: 'normal',
    features: {},
  });

  // Observability Stack (global capability)
  nodes.set('observability', {
    id: 'observability',
    type: 'OBSERVABILITY',
    name: 'Observability',
    enabled: true,
    locked: false,
    capacity: 100000,
    baseLatency: 0,
    baseError: 0,
    health: 1,
    reliabilityScore: 0.98,
    securityScore: 0.9,
    scaling: { min: 1, max: 1, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 0,
    errorRate: 0,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.05, // Reduced from 0.1
    operationalMode: 'normal',
    features: {},
  });

  // Define edges (load flow)
  const edges: ArchitectureEdge[] = [
    // Main request path
    { from: 'dns', to: 'cdn', weight: 1.0 },
    { from: 'cdn', to: 'waf', weight: 0.7 }, // CDN reduces 30% of load
    { from: 'waf', to: 'glb', weight: 0.95 }, // WAF blocks 5%
    { from: 'glb', to: 'rlb', weight: 1.0 },
    { from: 'rlb', to: 'apigw', weight: 1.0 },
    { from: 'apigw', to: 'app', weight: 1.0 },

    // App dependencies
    { from: 'app', to: 'cache', weight: 0.6 }, // 60% of requests hit cache
    { from: 'app', to: 'db_primary', weight: 0.5 }, // 50% need DB
    { from: 'app', to: 'queue', weight: 0.2 }, // 20% enqueue jobs
    { from: 'app', to: 'storage', weight: 0.1 }, // 10% use storage

    // Async processing
    { from: 'queue', to: 'workers', weight: 1.0 },
    { from: 'workers', to: 'db_primary', weight: 0.8 },

    // DB replication
    { from: 'db_primary', to: 'db_replica', weight: 1.0 },
  ];

  return { nodes, edges };
}

