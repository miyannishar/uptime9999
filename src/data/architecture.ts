// Architecture graph definition

import { ComponentNode, ArchitectureEdge } from '../sim/types';
import type {
  DNSMetrics,
  CDNMetrics,
  WAFMetrics,
  LoadBalancerMetrics,
  APIGatewayMetrics,
  AppClusterMetrics,
  CacheMetrics,
  QueueMetrics,
  WorkersMetrics,
  DatabaseMetrics,
  StorageMetrics,
  ServiceMeshMetrics,
  ObservabilityMetrics,
} from '../sim/componentMetrics';

export function createInitialArchitecture(): {
  nodes: Map<string, ComponentNode>;
  edges: ArchitectureEdge[];
} {
  const nodes = new Map<string, ComponentNode>();

  // DNS
  const dnsMetrics: DNSMetrics = {
    queriesPerSecond: 0,
    cacheHitRate: 0.85,
    ttl: 300,
    propagationDelay: 5,
    zonesConfigured: 3,
    dnssec: true,
    anycast: true,
  };
  
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
    specificMetrics: dnsMetrics,
    features: {},
    redundancyGroup: 'dns_cluster',
    isPrimary: true,
    instanceNumber: 1,
  });

  // CDN
  const cdnMetrics: CDNMetrics = {
    edgeLocations: 15,
    cacheHitRate: 0.75,
    bandwidthGbps: 10,
    cacheSizeGB: 500,
    ttl: 300,
    requestsPerSecond: 0,
    compressionEnabled: true,
    http2Enabled: true,
  };
  
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
    costPerSec: 0.05,
    operationalMode: 'normal',
    specificMetrics: cdnMetrics,
    features: {
      cacheTTL: 300,
    },
  });

  // WAF
  const wafMetrics: WAFMetrics = {
    requestsPerSecond: 0,
    blockedRequestsPercent: 0.01,
    rulesetVersion: '1.0.0',
    inspectionLatency: 5,
    falsePositiveRate: 0.001,
    botProtection: false,
    rateLimitRPS: 0,
    geoBlocking: [],
  };
  
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
    specificMetrics: wafMetrics,
    features: {
      rateLimit: 0,
      botProtection: false,
    },
  });

  // Global Load Balancer
  const glbMetrics: LoadBalancerMetrics = {
    instances: 1,
    connectionsPerInstance: 0,
    maxConnectionsPerInstance: 10000,
    healthCheckInterval: 5,
    failedHealthChecks: 0,
    requestsPerSecond: 0,
    algorithm: 'round-robin',
    stickySession: false,
  };
  
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
    specificMetrics: glbMetrics,
    features: {},
  });

  // Regional Load Balancer
  const rlbMetrics: LoadBalancerMetrics = {
    instances: 1,
    connectionsPerInstance: 0,
    maxConnectionsPerInstance: 5000,
    healthCheckInterval: 3,
    failedHealthChecks: 0,
    requestsPerSecond: 0,
    algorithm: 'least-connections',
    stickySession: true,
  };
  
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
    specificMetrics: rlbMetrics,
    features: {},
  });

  // API Gateway
  const apigwMetrics: APIGatewayMetrics = {
    requestsPerSecond: 0,
    concurrentConnections: 0,
    maxConnections: 5000,
    rateLimitHitRate: 0.01,
    transformationLatency: 5,
    rateLimitingEnabled: false,
    authenticationMethod: 'jwt',
    cachingEnabled: false,
  };
  
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
    scaling: { min: 1, max: 10, current: 1, cooldownUntil: 0 },
    utilization: 0,
    latency: 15,
    errorRate: 0.002,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.2,
    operationalMode: 'normal',
    specificMetrics: apigwMetrics,
    features: {
      rateLimit: 0,
    },
  });

  // App Cluster
  const appMetrics: AppClusterMetrics = {
    instances: 2,
    cpuCoresPerInstance: 4,
    memoryGBPerInstance: 8,
    avgCPUPercent: 30,
    avgMemoryPercent: 40,
    requestsPerSecond: 0,
    activeConnections: 0,
    deploymentVersion: 'v1.0.0',
    autoscaling: false,
    minInstances: 2,
    maxInstances: 50,
  };
  
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
    scaling: { min: 2, max: 50, current: 2, cooldownUntil: 0 },
    utilization: 0,
    latency: 50,
    errorRate: 0.005,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.3,
    operationalMode: 'normal',
    specificMetrics: appMetrics,
    redundancyGroup: 'app_cluster',
    isPrimary: true,
    instanceNumber: 1,
    features: {
      autoscaling: false,
      circuitBreaker: false,
      retries: false,
      canaryDeploy: false,
    },
  });

  // Service Mesh (locked at start)
  const servicemeshMetrics: ServiceMeshMetrics = {
    servicesManaged: 5,
    requestsPerSecond: 0,
    circuitBreakersOpen: 0,
    retryRate: 0,
    mutualTLSPercent: 1.0,
    sidecarOverhead: 3,
    tracingEnabled: false,
    rateLimitingEnabled: false,
    circuitBreakerEnabled: false,
  };
  
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
    specificMetrics: servicemeshMetrics,
    features: {},
  });

  // Cache (Redis)
  const cacheMetrics: CacheMetrics = {
    sizeGB: 8,
    maxSizeGB: 16,
    hitRate: 0.80,
    evictionRate: 10,
    keysStored: 50000,
    avgTTL: 300,
    memoryFragmentation: 0.15,
    connectionsActive: 50,
    evictionPolicy: 'lru',
    persistenceEnabled: false,
    clusteringEnabled: false,
  };
  
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
    costPerSec: 0.1,
    operationalMode: 'normal',
    specificMetrics: cacheMetrics,
    features: {},
  });

  // Queue
  const queueMetrics: QueueMetrics = {
    messagesQueued: 0,
    maxQueueDepth: 10000,
    enqueuedPerSecond: 0,
    dequeuedPerSecond: 0,
    avgMessageAge: 2,
    deadLetterQueueSize: 0,
    consumerCount: 1,
    durability: 'disk',
    retryPolicy: 'exponential',
    maxRetries: 3,
  };
  
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
    costPerSec: 0.08,
    operationalMode: 'normal',
    specificMetrics: queueMetrics,
    features: {},
  });

  // Workers
  const workersMetrics: WorkersMetrics = {
    instances: 2,
    cpuCoresPerWorker: 2,
    memoryGBPerWorker: 4,
    jobsProcessedPerSec: 10,
    avgJobDuration: 10,
    failedJobsPercent: 0.01,
    queueBacklog: 0,
    concurrency: 4,
    timeout: 300,
    autoScaling: false,
  };
  
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
    scaling: { min: 1, max: 30, current: 2, cooldownUntil: 0 },
    utilization: 0,
    latency: 100,
    errorRate: 0.01,
    loadIn: 0,
    loadOut: 0,
    costPerSec: 0.25,
    operationalMode: 'normal',
    specificMetrics: workersMetrics,
    redundancyGroup: 'worker_pool',
    isPrimary: true,
    instanceNumber: 1,
    features: {},
  });

  // Database Primary
  const dbPrimaryMetrics: DatabaseMetrics = {
    storageGB: 50,
    maxStorageGB: 500,
    connections: 20,
    maxConnections: 100,
    queriesPerSecond: 0,
    avgQueryLatency: 20,
    slowQueriesPercent: 0.05,
    replicationLag: 0,
    cacheHitRate: 0.70,
    indexEfficiency: 0.85,
    replicationType: 'async',
    backupsEnabled: true,
    connectionPoolSize: 100,
  };
  
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
    costPerSec: 0.5,
    operationalMode: 'normal',
    specificMetrics: dbPrimaryMetrics,
    redundancyGroup: 'db_replicas',
    isPrimary: true,
    instanceNumber: 1,
    features: {
      connectionPool: false,
      maxConnections: 100,
    },
  });

  // Database Read Replica (starts with low capacity)
  const dbReplicaMetrics: DatabaseMetrics = {
    storageGB: 50,
    maxStorageGB: 500,
    connections: 10,
    maxConnections: 100,
    queriesPerSecond: 0,
    avgQueryLatency: 25,
    slowQueriesPercent: 0.05,
    replicationLag: 100,
    cacheHitRate: 0.70,
    indexEfficiency: 0.85,
    replicationType: 'async',
    backupsEnabled: false,
    connectionPoolSize: 100,
  };
  
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
    specificMetrics: dbReplicaMetrics,
    redundancyGroup: 'db_replicas',
    isPrimary: false,
    instanceNumber: 1,
    features: {},
  });

  // Object Storage
  const storageMetrics: StorageMetrics = {
    storedGB: 100,
    maxStorageGB: 10000,
    requestsPerSecond: 0,
    bandwidthGbps: 1,
    avgObjectSizeKB: 500,
    objectCount: 200000,
    coldStoragePercent: 0.2,
    replication: 3,
    lifecycle: true,
    encryption: true,
  };
  
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
    specificMetrics: storageMetrics,
    features: {},
  });

  // Observability Stack (global capability)
  const observabilityMetrics: ObservabilityMetrics = {
    metricsPerSecond: 1000,
    logsPerSecond: 500,
    tracesPerSecond: 0,
    retentionDays: 7,
    storageGB: 50,
    queryLatency: 100,
    alertsConfigured: 5,
    dashboardsCount: 3,
    level: 'BASIC',
    samplingRate: 0.1,
    retentionPolicy: '7d',
  };
  
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
    costPerSec: 0.05,
    operationalMode: 'normal',
    specificMetrics: observabilityMetrics,
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

