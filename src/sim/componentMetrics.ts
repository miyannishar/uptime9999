// Component-specific metrics for realistic infrastructure modeling

// === DNS ===
export interface DNSMetrics {
  queriesPerSecond: number;
  cacheHitRate: number; // 0-1
  ttl: number; // seconds
  propagationDelay: number; // seconds
  zonesConfigured: number;
  dnssec: boolean;
  anycast: boolean;
}

// === CDN ===
export interface CDNMetrics {
  edgeLocations: number;
  cacheHitRate: number; // 0-1
  bandwidthGbps: number;
  cacheSizeGB: number;
  ttl: number;
  requestsPerSecond: number;
  compressionEnabled: boolean;
  http2Enabled: boolean;
}

// === WAF ===
export interface WAFMetrics {
  requestsPerSecond: number;
  blockedRequestsPercent: number; // 0-1
  rulesetVersion: string;
  inspectionLatency: number; // ms
  falsePositiveRate: number; // 0-1
  botProtection: boolean;
  rateLimitRPS: number; // 0 = disabled
  geoBlocking: string[];
}

// === Load Balancer ===
export interface LoadBalancerMetrics {
  instances: number;
  connectionsPerInstance: number;
  maxConnectionsPerInstance: number;
  healthCheckInterval: number; // seconds
  failedHealthChecks: number;
  requestsPerSecond: number;
  algorithm: 'round-robin' | 'least-connections' | 'ip-hash';
  stickySession: boolean;
}

// === API Gateway ===
export interface APIGatewayMetrics {
  requestsPerSecond: number;
  concurrentConnections: number;
  maxConnections: number;
  rateLimitHitRate: number; // 0-1
  transformationLatency: number; // ms
  rateLimitingEnabled: boolean;
  authenticationMethod: 'jwt' | 'api-key' | 'oauth';
  cachingEnabled: boolean;
}

// === App Cluster ===
export interface AppClusterMetrics {
  instances: number;
  cpuCoresPerInstance: number;
  memoryGBPerInstance: number;
  avgCPUPercent: number; // 0-100
  avgMemoryPercent: number; // 0-100
  requestsPerSecond: number;
  activeConnections: number;
  deploymentVersion: string;
  autoscaling: boolean;
  minInstances: number;
  maxInstances: number;
}

// === Cache (Redis) ===
export interface CacheMetrics {
  sizeGB: number;
  maxSizeGB: number;
  hitRate: number; // 0-1
  evictionRate: number; // keys/sec
  keysStored: number;
  avgTTL: number; // seconds
  memoryFragmentation: number; // 0-1
  connectionsActive: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
  persistenceEnabled: boolean;
  clusteringEnabled: boolean;
}

// === Queue ===
export interface QueueMetrics {
  messagesQueued: number;
  maxQueueDepth: number;
  enqueuedPerSecond: number;
  dequeuedPerSecond: number;
  avgMessageAge: number; // seconds
  deadLetterQueueSize: number;
  consumerCount: number;
  durability: 'disk' | 'memory';
  retryPolicy: 'exponential' | 'fixed';
  maxRetries: number;
}

// === Workers ===
export interface WorkersMetrics {
  instances: number;
  cpuCoresPerWorker: number;
  memoryGBPerWorker: number;
  jobsProcessedPerSec: number;
  avgJobDuration: number; // seconds
  failedJobsPercent: number; // 0-1
  queueBacklog: number; // jobs waiting
  concurrency: number; // jobs per worker
  timeout: number; // seconds
  autoScaling: boolean;
}

// === Database ===
export interface DatabaseMetrics {
  storageGB: number;
  maxStorageGB: number;
  connections: number;
  maxConnections: number;
  queriesPerSecond: number;
  avgQueryLatency: number; // ms
  slowQueriesPercent: number; // 0-1
  replicationLag: number; // ms (0 for primary)
  cacheHitRate: number; // 0-1
  indexEfficiency: number; // 0-1
  replicationType: 'async' | 'sync' | 'none';
  backupsEnabled: boolean;
  connectionPoolSize: number;
}

// === Storage ===
export interface StorageMetrics {
  storedGB: number;
  maxStorageGB: number;
  requestsPerSecond: number;
  bandwidthGbps: number;
  avgObjectSizeKB: number;
  objectCount: number;
  coldStoragePercent: number; // 0-1
  replication: number; // copies
  lifecycle: boolean; // auto-tiering
  encryption: boolean;
}

// === Service Mesh ===
export interface ServiceMeshMetrics {
  servicesManaged: number;
  requestsPerSecond: number;
  circuitBreakersOpen: number;
  retryRate: number; // retries/sec
  mutualTLSPercent: number; // 0-1
  sidecarOverhead: number; // ms
  tracingEnabled: boolean;
  rateLimitingEnabled: boolean;
  circuitBreakerEnabled: boolean;
}

// === Observability ===
export interface ObservabilityMetrics {
  metricsPerSecond: number;
  logsPerSecond: number;
  tracesPerSecond: number;
  retentionDays: number;
  storageGB: number;
  queryLatency: number; // ms
  alertsConfigured: number;
  dashboardsCount: number;
  level: 'BASIC' | 'METRICS' | 'TRACES';
  samplingRate: number; // 0-1
  retentionPolicy: string;
}

// Union type for all component-specific metrics
export type ComponentSpecificMetrics = 
  | DNSMetrics
  | CDNMetrics
  | WAFMetrics
  | LoadBalancerMetrics
  | APIGatewayMetrics
  | AppClusterMetrics
  | CacheMetrics
  | QueueMetrics
  | WorkersMetrics
  | DatabaseMetrics
  | StorageMetrics
  | ServiceMeshMetrics
  | ObservabilityMetrics;



