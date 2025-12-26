// State synchronization utilities to prevent race conditions

import { GameState } from '../sim/types';

/**
 * State synchronization manager to prevent race conditions
 * Ensures state updates are applied in order and not overwritten
 */
export class StateSyncManager {
  private updateQueue: Array<{ state: GameState; timestamp: number }> = [];
  private isProcessing = false;
  private lastAppliedTimestamp = 0;

  /**
   * Queue a state update - returns true if it should be applied
   */
  shouldApplyUpdate(state: GameState, timestamp: number): boolean {
    // Only apply if this update is newer than the last one
    if (timestamp <= this.lastAppliedTimestamp) {
      return false;
    }

    // Add to queue
    this.updateQueue.push({ state, timestamp });
    this.updateQueue.sort((a, b) => a.timestamp - b.timestamp);

    // Process queue
    this.processQueue();

    return timestamp > this.lastAppliedTimestamp;
  }

  /**
   * Process queued updates in order
   */
  private processQueue(): void {
    if (this.isProcessing || this.updateQueue.length === 0) return;

    this.isProcessing = true;

    // Apply updates in order
    while (this.updateQueue.length > 0) {
      const update = this.updateQueue.shift()!;
      if (update.timestamp > this.lastAppliedTimestamp) {
        this.lastAppliedTimestamp = update.timestamp;
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get the latest timestamp
   */
  getLastTimestamp(): number {
    return this.lastAppliedTimestamp;
  }

  /**
   * Reset the sync manager
   */
  reset(): void {
    this.updateQueue = [];
    this.isProcessing = false;
    this.lastAppliedTimestamp = 0;
  }
}

/**
 * Global state sync manager instance
 */
export const stateSyncManager = new StateSyncManager();

