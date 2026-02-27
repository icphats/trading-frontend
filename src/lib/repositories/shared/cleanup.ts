/**
 * Cache Cleanup Manager
 *
 * Consolidates periodic cache cleanup into a single interval
 * instead of each repository having its own cleanup timer.
 */

type CleanupCallback = () => void;

class CacheCleanupManager {
  private callbacks = new Set<CleanupCallback>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;

  constructor(intervalMs: number = 300_000) {
    // Default: 5 minutes
    this.intervalMs = intervalMs;
  }

  /**
   * Register a cleanup callback
   * Starts the cleanup interval if this is the first callback
   */
  register(callback: CleanupCallback): void {
    this.callbacks.add(callback);

    // Start interval on first registration (browser only)
    if (this.callbacks.size === 1 && typeof window !== 'undefined') {
      this.start();
    }
  }

  /**
   * Unregister a cleanup callback
   * Stops the interval if no callbacks remain
   */
  unregister(callback: CleanupCallback): void {
    this.callbacks.delete(callback);

    if (this.callbacks.size === 0) {
      this.stop();
    }
  }

  /**
   * Manually trigger cleanup for all registered callbacks
   */
  runCleanup(): void {
    this.callbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[CacheCleanupManager] Cleanup callback failed:', error);
      }
    });
  }

  /**
   * Start the cleanup interval
   */
  private start(): void {
    if (this.intervalId !== null) return;

    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, this.intervalMs);
  }

  /**
   * Stop the cleanup interval
   */
  private stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get the number of registered callbacks
   */
  get size(): number {
    return this.callbacks.size;
  }

  /**
   * Check if the cleanup interval is running
   */
  get isRunning(): boolean {
    return this.intervalId !== null;
  }
}

// Singleton instance with 5-minute interval
export const cacheCleanupManager = new CacheCleanupManager(300_000);
