// Metric bounds checking to prevent unrealistic values

import { ComponentNode } from './types';

/**
 * Clamp a metric value to realistic bounds based on metric name and component type
 */
export function clampMetric(node: ComponentNode, metricKey: string, value: number): number {
  const metrics = node.specificMetrics;

  // Percentages (0-100)
  if (metricKey.includes('Percent') && !metricKey.includes('Rate')) {
    return Math.max(0, Math.min(100, value));
  }

  // Rates (0-1)
  if (metricKey.includes('Rate') || metricKey === 'hitRate' || metricKey === 'cacheHitRate' || 
      metricKey === 'falsePositiveRate' || metricKey === 'indexEfficiency') {
    return Math.max(0, Math.min(1, value));
  }

  // CPU/Memory percentages (0-100)
  if (metricKey === 'avgCPUPercent' || metricKey === 'avgMemoryPercent') {
    return Math.max(0, Math.min(100, value));
  }

  // Connections - must be <= maxConnections
  if (metricKey === 'connections' && 'maxConnections' in metrics && typeof metrics.maxConnections === 'number') {
    return Math.max(0, Math.min(metrics.maxConnections, Math.round(value)));
  }
  if (metricKey === 'concurrentConnections' && 'maxConnections' in metrics && typeof metrics.maxConnections === 'number') {
    return Math.max(0, Math.min(metrics.maxConnections, Math.round(value)));
  }

  // Size metrics - must be <= maxSize
  if (metricKey === 'sizeGB' && 'maxSizeGB' in metrics && typeof metrics.maxSizeGB === 'number') {
    return Math.max(0, Math.min(metrics.maxSizeGB, value));
  }
  if (metricKey === 'storageGB' && 'maxStorageGB' in metrics && typeof metrics.maxStorageGB === 'number') {
    return Math.max(0, Math.min(metrics.maxStorageGB, value));
  }

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

  // Memory fragmentation (0-1)
  if (metricKey === 'memoryFragmentation') {
    return Math.max(0, Math.min(1, value));
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

