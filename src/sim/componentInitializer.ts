// Component Initializer - Ensures all components have proper metrics when created dynamically

import { ComponentNode, ComponentType } from './types';
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
} from './componentMetrics';

/**
 * Initialize component-specific metrics based on component type
 * This ensures all dynamically added components have proper metrics
 */
export function initializeComponentMetrics(
  type: ComponentType,
  baseNode?: ComponentNode
): Record<string, any> {
  // If base node exists, clone its metrics
  if (baseNode?.specificMetrics) {
    return { ...baseNode.specificMetrics };
  }

  // Otherwise, initialize default metrics based on type
  switch (type) {
    case 'DNS':
      return {
        queriesPerSecond: 0,
        cacheHitRate: 0.85,
        ttl: 300,
        propagationDelay: 5,
        zonesConfigured: 3,
        dnssec: true,
        anycast: false,
      } as DNSMetrics;

    case 'CDN':
      return {
        edgeLocations: 5,
        cacheHitRate: 0.75,
        bandwidthGbps: 1.0,
        cacheSizeGB: 10,
        ttl: 3600,
        requestsPerSecond: 0,
        compressionEnabled: true,
        http2Enabled: true,
      } as CDNMetrics;

    case 'WAF':
      return {
        requestsPerSecond: 0,
        blockedRequestsPercent: 0.01,
        rulesetVersion: '1.0',
        inspectionLatency: 2,
        falsePositiveRate: 0.001,
        botProtection: true,
        rateLimitRPS: 1000,
        geoBlocking: [],
      } as WAFMetrics;

    case 'GLB':
    case 'RLB':
      return {
        instances: 1,
        connectionsPerInstance: 0,
        maxConnectionsPerInstance: 10000,
        healthCheckInterval: 5,
        failedHealthChecks: 0,
        requestsPerSecond: 0,
        algorithm: 'round-robin',
        stickySession: false,
      } as LoadBalancerMetrics;

    case 'APIGW':
      return {
        requestsPerSecond: 0,
        concurrentConnections: 0,
        maxConnections: 5000,
        rateLimitHitRate: 0,
        transformationLatency: 5,
        rateLimitingEnabled: false,
        authenticationMethod: 'jwt',
        cachingEnabled: false,
      } as APIGatewayMetrics;

    case 'APP':
      return {
        instances: 1,
        cpuCoresPerInstance: 2,
        memoryGBPerInstance: 4,
        avgCPUPercent: 0,
        avgMemoryPercent: 0,
        requestsPerSecond: 0,
        activeConnections: 0,
        deploymentVersion: '1.0.0',
        autoscaling: false,
        minInstances: 1,
        maxInstances: 10,
      } as AppClusterMetrics;

    case 'CACHE':
      return {
        sizeGB: 8,
        maxSizeGB: 16,
        hitRate: 0.85,
        evictionRate: 0,
        keysStored: 0,
        avgTTL: 300,
        memoryFragmentation: 0.05,
        connectionsActive: 0,
        evictionPolicy: 'lru',
        persistenceEnabled: false,
        clusteringEnabled: false,
      } as CacheMetrics;

    case 'QUEUE':
      return {
        messagesQueued: 0,
        maxQueueDepth: 10000,
        enqueuedPerSecond: 0,
        dequeuedPerSecond: 0,
        avgMessageAge: 0,
        deadLetterQueueSize: 0,
        consumerCount: 1,
        visibilityTimeout: 30,
        durability: 'disk',
        retryPolicy: 'exponential',
        maxRetries: 3,
      } as QueueMetrics;

    case 'WORKERS':
      return {
        instances: 1,
        cpuCoresPerWorker: 2,
        memoryGBPerWorker: 4,
        jobsProcessedPerSec: 0,
        avgJobDuration: 2,
        failedJobsPercent: 0,
        queueBacklog: 0,
        concurrency: 5,
        timeout: 60,
        autoScaling: false,
      } as WorkersMetrics;

    case 'DB_PRIMARY':
    case 'DB_REPLICA':
      return {
        connections: 0,
        maxConnections: 100,
        queriesPerSecond: 0,
        avgQueryLatency: 10,
        slowQueriesPercent: 0,
        replicationLag: 0,
        storageGB: 50,
        maxStorageGB: 500,
        connectionPoolSize: 20,
        indexHitRate: 0.95,
        cacheHitRate: 0.80,
        indexEfficiency: 0.95,
        replicationType: type === 'DB_PRIMARY' ? 'none' : 'async',
        backupsEnabled: true,
      } as DatabaseMetrics;

    case 'OBJECT_STORAGE':
      return {
        storedGB: 100,
        maxStorageGB: 1000,
        requestsPerSecond: 0,
        bandwidthGbps: 1.0,
        avgObjectSizeKB: 100,
        objectCount: 0,
        coldStoragePercent: 0,
        replication: 3,
        lifecycle: false,
        encryption: true,
      } as StorageMetrics;

    case 'SERVICE_MESH':
      return {
        servicesManaged: 0,
        requestsPerSecond: 0,
        circuitBreakersOpen: 0,
        retryRate: 0.05,
        mutualTLSPercent: 0,
        sidecarOverhead: 5,
        tracingEnabled: false,
        rateLimitingEnabled: false,
        circuitBreakerEnabled: false,
      } as ServiceMeshMetrics;

    case 'OBSERVABILITY':
      return {
        metricsPerSecond: 0,
        logsPerSecond: 0,
        tracesPerSecond: 0,
        retentionDays: 7,
        storageGB: 10,
        queryLatency: 50,
        alertsConfigured: 0,
        dashboardsCount: 1,
        level: 'BASIC',
        samplingRate: 1.0,
        retentionPolicy: '7d',
      } as ObservabilityMetrics;

    default:
      return {};
  }
}

/**
 * Create a new component node with proper initialization
 * Used when dynamically adding components
 */
export function createComponentNode(
  type: ComponentType,
  id: string,
  name: string,
  baseNode?: ComponentNode
): ComponentNode {
  const baseCapacity = baseNode?.capacity || 1000;
  const baseLatency = baseNode?.baseLatency || 50;
  const baseError = baseNode?.baseError || 0.01;
  const baseCost = baseNode?.costPerSec || 0.1;

  return {
    id,
    type,
    name,
    enabled: true,
    locked: false,
    capacity: baseCapacity,
    baseLatency,
    baseError,
    health: 1.0,
    reliabilityScore: baseNode?.reliabilityScore || 0.95,
    securityScore: baseNode?.securityScore || 0.9,
    scaling: {
      min: 1,
      max: baseNode?.scaling?.max || 10,
      current: 1,
      cooldownUntil: 0,
    },
    utilization: 0,
    latency: baseLatency,
    errorRate: baseError,
    loadIn: 0,
    loadOut: 0,
    costPerSec: baseCost,
    operationalMode: 'normal',
    specificMetrics: initializeComponentMetrics(type, baseNode),
    features: baseNode?.features || {},
    redundancyGroup: baseNode?.redundancyGroup,
    isPrimary: baseNode?.isPrimary || false,
    instanceNumber: baseNode?.instanceNumber || 1,
  };
}

