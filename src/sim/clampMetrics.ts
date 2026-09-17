// Metric bounds checking to prevent unrealistic values

import { ComponentNode } from './types';

/** Metrics that are 0..1 fractions. Everything else is a counter or a real 0..100 percent. */
const FRACTION_METRICS = new Set([
  'hitRate', 'cacheHitRate', 'errorRate', 'falsePositiveRate', 'indexEfficiency',
  'memoryFragmentation', 'rateLimitHitRate', 'slowQueriesPercent', 'failedJobsPercent',
  'blockedRequestsPercent', 'coldStoragePercent',
]);

/** Metrics measured 0..100. */
const PERCENT_METRICS = new Set(['avgCPUPercent', 'avgMemoryPercent']);

/**
 * Clamp a metric value to realistic bounds based on metric name and component type
 */
export function clampMetric(node: ComponentNode, metricKey: string, value: number): number {
  // Guard against non-finite values first
  if (!Number.isFinite(value)) return 0;

  const metrics = node.specificMetrics;

  // Fraction metrics (0-1)
  if (FRACTION_METRICS.has(metricKey)) {
    return Math.max(0, Math.min(1, value));
  }

  // Percent metrics (0-100)
  if (PERCENT_METRICS.has(metricKey)) {
    return Math.max(0, Math.min(100, value));
  }

  // Capped metrics: value must not exceed a sibling field on the same node
  const capTo = (capKey: string, round = false) => {
    const cap = metrics[capKey];
    if (typeof cap !== 'number') return null;
    const clamped = Math.max(0, Math.min(cap, value));
    return round ? Math.round(clamped) : clamped;
  };
  if (metricKey === 'connections' || metricKey === 'concurrentConnections') {
    const c = capTo('maxConnections', true); if (c !== null) return c;
  }
  if (metricKey === 'sizeGB') { const c = capTo('maxSizeGB'); if (c !== null) return c; }
  if (metricKey === 'storageGB') { const c = capTo('maxStorageGB'); if (c !== null) return c; }

  // Queue depth - must be <= maxQueueDepth
  if (metricKey === 'messagesQueued' && 'maxQueueDepth' in metrics && typeof metrics.maxQueueDepth === 'number') {
    return Math.max(0, Math.min(metrics.maxQueueDepth, Math.round(value)));
  }
  if (metricKey === 'queueBacklog' && typeof value === 'number') {
    // Allow up to 10x max queue depth for extreme scenarios, but cap it
    const maxBacklog = 100000; // Reasonable upper bound
    return Math.max(0, Math.min(maxBacklog, Math.round(value)));
  }

  // Instances - must respect min/max
  if (metricKey === 'instances' && 'minInstances' in metrics && 'maxInstances' in metrics) {
    const min = typeof metrics.minInstances === 'number' ? metrics.minInstances : 1;
    const max = typeof metrics.maxInstances === 'number' ? metrics.maxInstances : 50;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  // Whole number metrics
  if (metricKey.includes('GB') || metricKey.includes('instances') ||
      metricKey.includes('Count') || metricKey === 'keysStored' ||
      metricKey === 'zonesConfigured' || metricKey === 'edgeLocations') {
    return Math.max(0, Math.round(value));
  }

  // Time-based metrics (seconds/ms) - reasonable bounds
  if (metricKey.includes('Latency') || metricKey.includes('Duration') ||
      metricKey === 'propagationDelay' || metricKey === 'replicationLag' ||
      metricKey === 'ttl' || metricKey === 'avgTTL' || metricKey === 'avgMessageAge' ||
      metricKey === 'timeout' || metricKey === 'healthCheckInterval') {
    return Math.max(0, Math.min(3600000, value)); // Max 1 hour
  }

  // Eviction rate - reasonable bounds (0 to 100k keys/sec)
  if (metricKey === 'evictionRate') {
    return Math.max(0, Math.min(100000, Math.round(value)));
  }

  // Just ensure non-negative for everything else
  return Math.max(0, value);
}

/**
 * Clamp all metrics on a node to realistic bounds
 */
export function clampAllMetrics(node: ComponentNode): void {
  for (const [key, value] of Object.entries(node.specificMetrics)) {
    if (typeof value === 'number') {
      node.specificMetrics[key] = clampMetric(node, key, value);
    }
  }
}

