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

// Helper to get bottleneck status based on specific metrics
export function getBottleneckStatus(type: string, metrics: any): {
  isBottleneck: boolean;
  reason?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
} {
  switch (type) {
    case 'CACHE':
      if (metrics.hitRate < 0.4) return { isBottleneck: true, reason: 'Low cache hit rate', severity: 'high' };
      if (metrics.evictionRate > 100) return { isBottleneck: true, reason: 'High eviction rate', severity: 'medium' };
      if (metrics.sizeGB / metrics.maxSizeGB > 0.9) return { isBottleneck: true, reason: 'Cache near capacity', severity: 'medium' };
      return { isBottleneck: false, severity: 'low' };
    
    case 'WORKERS':
      if (metrics.queueBacklog > 200) return { isBottleneck: true, reason: 'High queue backlog', severity: 'critical' };
      if (metrics.failedJobsPercent > 0.1) return { isBottleneck: true, reason: 'High job failure rate', severity: 'high' };
      if (metrics.avgJobDuration > 60) return { isBottleneck: true, reason: 'Slow job processing', severity: 'medium' };
      return { isBottleneck: false, severity: 'low' };
    
    case 'DB_PRIMARY':
    case 'DB_REPLICA':
      if (metrics.connections / metrics.maxConnections > 0.9) return { isBottleneck: true, reason: 'Connection pool exhaustion', severity: 'critical' };
      if (metrics.slowQueriesPercent > 0.2) return { isBottleneck: true, reason: 'High slow query rate', severity: 'high' };
      if (metrics.storageGB / metrics.maxStorageGB > 0.9) return { isBottleneck: true, reason: 'Storage near capacity', severity: 'high' };
      if (metrics.replicationLag > 1000) return { isBottleneck: true, reason: 'High replication lag', severity: 'medium' };
      return { isBottleneck: false, severity: 'low' };
    
    case 'QUEUE':
      if (metrics.messagesQueued / metrics.maxQueueDepth > 0.8) return { isBottleneck: true, reason: 'Queue near capacity', severity: 'critical' };
      if (metrics.avgMessageAge > 60) return { isBottleneck: true, reason: 'Messages aging in queue', severity: 'high' };
      if (metrics.deadLetterQueueSize > 100) return { isBottleneck: true, reason: 'High dead letter queue', severity: 'medium' };
      return { isBottleneck: false, severity: 'low' };
    
    case 'APP':
      if (metrics.avgCPUPercent > 85) return { isBottleneck: true, reason: 'High CPU usage', severity: 'high' };
      if (metrics.avgMemoryPercent > 85) return { isBottleneck: true, reason: 'High memory usage', severity: 'high' };
      if (metrics.instances >= metrics.maxInstances) return { isBottleneck: true, reason: 'At max scaling', severity: 'medium' };
      return { isBottleneck: false, severity: 'low' };
    
    case 'APIGW':
      if (metrics.concurrentConnections / metrics.maxConnections > 0.9) return { isBottleneck: true, reason: 'Connection limit reached', severity: 'critical' };
      if (metrics.rateLimitHitRate > 0.3) return { isBottleneck: true, reason: 'High rate limit hits', severity: 'medium' };
      return { isBottleneck: false, severity: 'low' };
    
    case 'CDN':
      if (metrics.cacheHitRate < 0.5) return { isBottleneck: true, reason: 'Poor cache performance', severity: 'medium' };
      if (metrics.bandwidthGbps > 80) return { isBottleneck: true, reason: 'Bandwidth saturation', severity: 'high' };
      return { isBottleneck: false, severity: 'low' };
    
    default:
      return { isBottleneck: false, severity: 'low' };
  }
}

// Helper to serialize metrics for AI
export function serializeMetricsForAI(type: string, metrics: any): Record<string, any> {
  // Return only the most important metrics for AI decision making
  switch (type) {
    case 'CACHE':
      return {
        sizeGB: metrics.sizeGB,
        maxSizeGB: metrics.maxSizeGB,
        hitRate: Math.round(metrics.hitRate * 100) / 100,
        evictionRate: Math.round(metrics.evictionRate),
        keysStored: metrics.keysStored,
        memoryFragmentation: Math.round(metrics.memoryFragmentation * 100) / 100,
      };
    
    case 'WORKERS':
      return {
        instances: metrics.instances,
        queueBacklog: metrics.queueBacklog,
        jobsProcessedPerSec: Math.round(metrics.jobsProcessedPerSec * 10) / 10,
        avgJobDuration: Math.round(metrics.avgJobDuration),
        failedJobsPercent: Math.round(metrics.failedJobsPercent * 100) / 100,
        concurrency: metrics.concurrency,
      };
    
    case 'DB_PRIMARY':
    case 'DB_REPLICA':
      return {
        connections: metrics.connections,
        maxConnections: metrics.maxConnections,
        queriesPerSecond: Math.round(metrics.queriesPerSecond),
        avgQueryLatency: Math.round(metrics.avgQueryLatency),
        slowQueriesPercent: Math.round(metrics.slowQueriesPercent * 100) / 100,
        replicationLag: Math.round(metrics.replicationLag),
        storageGB: Math.round(metrics.storageGB),
        maxStorageGB: metrics.maxStorageGB,
      };
    
    case 'QUEUE':
      return {
        messagesQueued: metrics.messagesQueued,
        maxQueueDepth: metrics.maxQueueDepth,
        enqueuedPerSecond: Math.round(metrics.enqueuedPerSecond),
        dequeuedPerSecond: Math.round(metrics.dequeuedPerSecond),
        avgMessageAge: Math.round(metrics.avgMessageAge),
        deadLetterQueueSize: metrics.deadLetterQueueSize,
      };
    
    case 'APP':
      return {
        instances: metrics.instances,
        maxInstances: metrics.maxInstances,
        avgCPUPercent: Math.round(metrics.avgCPUPercent),
        avgMemoryPercent: Math.round(metrics.avgMemoryPercent),
        requestsPerSecond: Math.round(metrics.requestsPerSecond),
        activeConnections: metrics.activeConnections,
      };
    
    case 'APIGW':
      return {
        requestsPerSecond: Math.round(metrics.requestsPerSecond),
        concurrentConnections: metrics.concurrentConnections,
        maxConnections: metrics.maxConnections,
        rateLimitHitRate: Math.round(metrics.rateLimitHitRate * 100) / 100,
        transformationLatency: Math.round(metrics.transformationLatency),
      };
    
    case 'CDN':
      return {
        cacheHitRate: Math.round(metrics.cacheHitRate * 100) / 100,
        bandwidthGbps: Math.round(metrics.bandwidthGbps * 10) / 10,
        cacheSizeGB: metrics.cacheSizeGB,
        requestsPerSecond: Math.round(metrics.requestsPerSecond),
      };
    
    default:
      return {};
  }
}

