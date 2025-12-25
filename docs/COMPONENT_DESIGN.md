# Component System Design

## Core Philosophy
Each component type should have **realistic, specific metrics** that reflect its actual infrastructure role, not just generic "health/capacity/utilization".

---

## Component Class Hierarchy

### Base Component (All components inherit)
```typescript
interface BaseComponent {
  id: string;
  type: ComponentType;
  name: string;
  enabled: boolean;
  
  // Financial
  costPerSecond: number;
  
  // Operational
  operationalMode: 'normal' | 'degraded' | 'down';
  health: number; // 0-1 (overall health score)
  
  // Performance
  latency: number; // ms
  errorRate: number; // 0-1
  
  // Common
  lastIncidentTime: number; // For AI diversity
}
```

---

## Specific Component Types

### 1. **DNS**
```typescript
interface DNSComponent extends BaseComponent {
  type: 'DNS';
  metrics: {
    queriesPerSecond: number;
    cacheHitRate: number; // 0-1
    ttl: number; // seconds
    propagationDelay: number; // seconds
    zonesConfigured: number;
  };
  config: {
    dnssec: boolean;
    anycast: boolean;
  };
}
```
**Bottleneck indicators**: QPS near limit, low cache hit rate

---

### 2. **CDN**
```typescript
interface CDNComponent extends BaseComponent {
  type: 'CDN';
  metrics: {
    edgeLocations: number; // Number of PoPs
    cacheHitRate: number; // 0-1
    bandwidth: number; // Gbps
    cacheSizeGB: number;
    ttl: number; // seconds
    requestsPerSecond: number;
  };
  config: {
    compressionEnabled: boolean;
    http2Enabled: boolean;
  };
}
```
**Bottleneck indicators**: Low cache hit rate, bandwidth saturation

---

### 3. **WAF (Web Application Firewall)**
```typescript
interface WAFComponent extends BaseComponent {
  type: 'WAF';
  metrics: {
    requestsPerSecond: number;
    blockedRequestsPercent: number; // 0-1
    rulesetVersion: string;
    inspectionLatency: number; // ms
    falsePositiveRate: number; // 0-1
  };
  config: {
    botProtection: boolean;
    rateLimitRPS: number; // 0 = disabled
    geoBlocking: string[]; // country codes
  };
}
```
**Bottleneck indicators**: High latency, high false positive rate

---

### 4. **Load Balancer (Global & Regional)**
```typescript
interface LoadBalancerComponent extends BaseComponent {
  type: 'GLB' | 'RLB';
  metrics: {
    instances: number;
    connectionsPerInstance: number;
    maxConnectionsPerInstance: number;
    healthCheckInterval: number; // seconds
    failedHealthChecks: number;
    requestsPerSecond: number;
  };
  config: {
    algorithm: 'round-robin' | 'least-connections' | 'ip-hash';
    stickySession: boolean;
  };
}
```
**Bottleneck indicators**: Connections near max, failed health checks

---

### 5. **API Gateway**
```typescript
interface APIGatewayComponent extends BaseComponent {
  type: 'APIGW';
  metrics: {
    requestsPerSecond: number;
    concurrentConnections: number;
    maxConnections: number;
    apiCallsPerEndpoint: Map<string, number>;
    rateLimitHitRate: number; // 0-1
    transformationLatency: number; // ms
  };
  config: {
    rateLimitingEnabled: boolean;
    authenticationMethod: 'jwt' | 'api-key' | 'oauth';
    cachingEnabled: boolean;
  };
}
```
**Bottleneck indicators**: Connections near max, high rate limit hits

---

### 6. **App Cluster**
```typescript
interface AppClusterComponent extends BaseComponent {
  type: 'APP';
  metrics: {
    instances: number;
    cpuCoresPerInstance: number;
    memoryGBPerInstance: number;
    avgCPUPercent: number; // 0-100
    avgMemoryPercent: number; // 0-100
    requestsPerSecond: number;
    activeConnections: number;
    deploymentVersion: string;
  };
  config: {
    autoscaling: boolean;
    minInstances: number;
    maxInstances: number;
    healthCheckPath: string;
  };
}
```
**Bottleneck indicators**: CPU >80%, Memory >80%, instances near max

---

### 7. **Cache (Redis/Memcached)**
```typescript
interface CacheComponent extends BaseComponent {
  type: 'CACHE';
  metrics: {
    sizeGB: number;
    maxSizeGB: number;
    hitRate: number; // 0-1
    evictionRate: number; // keys/sec
    keysStored: number;
    avgTTL: number; // seconds
    memoryFragmentation: number; // 0-1
    connectionsActive: number;
  };
  config: {
    evictionPolicy: 'lru' | 'lfu' | 'ttl';
    persistenceEnabled: boolean;
    clusteringEnabled: boolean;
  };
}
```
**Bottleneck indicators**: Low hit rate, high eviction, size near max

---

### 8. **Queue (Message Queue)**
```typescript
interface QueueComponent extends BaseComponent {
  type: 'QUEUE';
  metrics: {
    messagesQueued: number;
    maxQueueDepth: number;
    enqueuedPerSecond: number;
    dequeuedPerSecond: number;
    avgMessageAge: number; // seconds
    deadLetterQueueSize: number;
    consumerCount: number;
  };
  config: {
    durability: 'disk' | 'memory';
    retryPolicy: 'exponential' | 'fixed';
    maxRetries: number;
  };
}
```
**Bottleneck indicators**: Queue depth near max, high message age, low dequeue rate

---

### 9. **Workers (Background Jobs)**
```typescript
interface WorkersComponent extends BaseComponent {
  type: 'WORKERS';
  metrics: {
    instances: number;
    cpuCoresPerWorker: number;
    memoryGBPerWorker: number;
    jobsProcessedPerSec: number;
    avgJobDuration: number; // seconds
    failedJobsPercent: number; // 0-1
    queueBacklog: number; // jobs waiting
  };
  config: {
    concurrency: number; // jobs per worker
    timeout: number; // seconds
    autoScaling: boolean;
  };
}
```
**Bottleneck indicators**: High backlog, long job duration, high failure rate

---

### 10. **Database (Primary & Replica)**
```typescript
interface DatabaseComponent extends BaseComponent {
  type: 'DB_PRIMARY' | 'DB_REPLICA';
  metrics: {
    storageGB: number;
    maxStorageGB: number;
    connections: number;
    maxConnections: number;
    queriesPerSecond: number;
    avgQueryLatency: number; // ms
    slowQueriesPercent: number; // 0-1
    replicationLag: number; // ms (0 for primary)
    cacheHitRate: number; // 0-1 (query cache)
    indexEfficiency: number; // 0-1
  };
  config: {
    replicationType: 'async' | 'sync' | 'none';
    backupsEnabled: boolean;
    connectionPoolSize: number;
  };
}
```
**Bottleneck indicators**: Connections near max, high slow queries, high replication lag

---

### 11. **Object Storage**
```typescript
interface StorageComponent extends BaseComponent {
  type: 'STORAGE';
  metrics: {
    storedGB: number;
    maxStorageGB: number;
    requestsPerSecond: number;
    bandwidth: number; // Gbps
    avgObjectSize: number; // KB
    objectCount: number;
    coldStoragePercent: number; // 0-1
  };
  config: {
    replication: number; // copies
    lifecycle: boolean; // auto-tiering
    encryption: boolean;
  };
}
```
**Bottleneck indicators**: Storage near max, bandwidth saturation

---

### 12. **Service Mesh**
```typescript
interface ServiceMeshComponent extends BaseComponent {
  type: 'SERVICEMESH';
  metrics: {
    servicesManaged: number;
    requestsPerSecond: number;
    circuitBreakersOpen: number;
    retryRate: number; // retries/sec
    mutualTLSPercent: number; // 0-1
    sidecarOverhead: number; // ms
  };
  config: {
    tracingEnabled: boolean;
    rateLimitingEnabled: boolean;
    circuitBreakerEnabled: boolean;
  };
}
```
**Bottleneck indicators**: Many circuit breakers open, high retry rate

---

### 13. **Observability**
```typescript
interface ObservabilityComponent extends BaseComponent {
  type: 'OBSERVABILITY';
  metrics: {
    metricsPerSecond: number;
    logsPerSecond: number;
    tracesPerSecond: number;
    retentionDays: number;
    storageGB: number;
    queryLatency: number; // ms
    alertsConfigured: number;
    dashboardsCount: number;
  };
  config: {
    level: 'BASIC' | 'METRICS' | 'TRACES';
    samplingRate: number; // 0-1
    retentionPolicy: string;
  };
}
```
**Bottleneck indicators**: High ingest rates, slow queries, storage near limit

---

## Implementation Benefits

### For Gameplay:
1. **Meaningful actions**: "Increase cache size" actually increases `cache.sizeGB`
2. **Visible impact**: See numbers change in real-time
3. **Strategic depth**: Different bottlenecks require different solutions
4. **Learning**: Understand real infrastructure concepts

### For AI:
1. **Better targeting**: AI can identify specific bottlenecks (e.g., "workers have 500 job backlog")
2. **Contextual incidents**: "Cache hit rate dropped to 30%" is more specific than "cache degraded"
3. **Realistic suggestions**: AI can suggest "Increase connection pool" when `db.connections/maxConnections > 0.9`
4. **Narrative coherence**: "You scaled workers to ×3 but queue backlog is still growing" → suggests queue is the real bottleneck

### For System:
1. **Composable**: Easy to add new component types
2. **Extensible**: Can add new metrics without breaking existing code
3. **Type-safe**: TypeScript ensures all metrics are defined
4. **Testable**: Each component's state is self-contained

---

## Migration Strategy

1. Create component class definitions (`src/sim/components/*.ts`)
2. Add factory functions for each type
3. Update `Architecture` to use typed components
4. Migrate existing generic metrics to specific ones
5. Update AI serialization to include specific metrics
6. Update UI to display specific metrics (tooltips, detail panel)

---

## Example AI Prompt (With New Metrics)

```
SYSTEM STATE:
{
  "cache": {
    "hitRate": 0.35,        ← LOW! Problem!
    "sizeGB": 8,
    "maxSizeGB": 16,
    "evictionRate": 150,    ← HIGH! Cache thrashing
    "isBottleneck": true
  },
  "workers": {
    "instances": 3,         ← Scaled up
    "queueBacklog": 50,     ← Still has backlog
    "jobsPerSec": 12,
    "isStrengthened": true
  }
}

AI → "Cache thrashing detected - hit rate 35%, high evictions. Suggest: 1) Increase cache size, 2) Adjust TTL, 3) Review caching strategy"
```

Much more specific and actionable!

---

Should I proceed with implementing this component class system?

