/**
 * Menu Sync Background Job
 * Periodically syncs menu items from POS systems to La Carta database
 *
 * This job runs on a configurable interval and syncs menus for all
 * restaurants that have POS integration enabled and auto-sync configured.
 */

import { db } from '../lib/db';
import { posService } from '../services/posService';
import { Logger } from '../lib/logger';
import { formatError } from '../utils/errorFormat';

/**
 * Menu sync job configuration
 */
interface MenuSyncJobConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxConcurrentSyncs: number;
}

const DEFAULT_CONFIG: MenuSyncJobConfig = {
  enabled: process.env.MENU_SYNC_ENABLED !== 'false',
  intervalMinutes: parseInt(process.env.MENU_SYNC_INTERVAL_MINUTES || '60'),
  maxConcurrentSyncs: parseInt(process.env.MENU_SYNC_MAX_CONCURRENT || '3'),
};

/**
 * Menu Sync Job Manager
 */
export class MenuSyncJob {
  private config: MenuSyncJobConfig;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<MenuSyncJobConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the menu sync job
   */
  start(): void {
    if (!this.config.enabled) {
      Logger.info('Menu sync job is disabled');
      return;
    }

    if (this.intervalHandle) {
      Logger.warn('Menu sync job is already running');
      return;
    }

    Logger.info('Starting menu sync job', {
      intervalMinutes: this.config.intervalMinutes,
      maxConcurrentSyncs: this.config.maxConcurrentSyncs,
    });

    // Run immediately on start
    this.runSync().catch((error) => {
      Logger.error('Initial menu sync failed', {
        error: formatError(error),
      });
    });

    // Schedule periodic sync
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.intervalHandle = setInterval(() => {
      this.runSync().catch((error) => {
        Logger.error('Scheduled menu sync failed', {
          error: formatError(error),
        });
      });
    }, intervalMs);

    Logger.info('Menu sync job started successfully');
  }

  /**
   * Stop the menu sync job
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      Logger.info('Menu sync job stopped');
    }
  }

  /**
   * Run menu sync for all eligible restaurants
   */
  private async runSync(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('Menu sync already in progress, skipping this run');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      Logger.info('Starting menu sync run');

      // Find all restaurants with POS integration and auto-sync enabled
      const restaurants = await db.restaurant.findMany({
        where: {
          posType: {
            in: ['toast', 'square'],
          },
        },
        select: {
          id: true,
          name: true,
          posType: true,
          settingsJson: true,
        },
      });

      // Filter restaurants that have auto-sync enabled
      const eligibleRestaurants = restaurants.filter((restaurant: { id: string; name: string; posType: string | null; settingsJson: unknown }) => {
        const settings = (restaurant.settingsJson as any) || {};
        const posConfig = settings.posConfig || {};
        return posConfig.autoSyncMenu !== false;
      });

      Logger.info('Found eligible restaurants for menu sync', {
        total: restaurants.length,
        eligible: eligibleRestaurants.length,
      });

      if (eligibleRestaurants.length === 0) {
        Logger.info('No restaurants eligible for menu sync');
        return;
      }

      // Sync menus in batches to avoid overwhelming POS APIs
      const results = await this.syncRestaurantsInBatches(eligibleRestaurants);

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      const duration = Date.now() - startTime;
      Logger.info('Menu sync run completed', {
        total: eligibleRestaurants.length,
        success: successCount,
        failed: failureCount,
        durationMs: duration,
      });
    } catch (error) {
      Logger.error('Menu sync run failed', {
        error: formatError(error),
        durationMs: Date.now() - startTime,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync restaurant menus in batches to control concurrency
   */
  private async syncRestaurantsInBatches(
    restaurants: Array<{ id: string; name: string; posType: string | null }>
  ): Promise<Array<{ restaurantId: string; success: boolean }>> {
    const results: Array<{ restaurantId: string; success: boolean }> = [];

    for (let i = 0; i < restaurants.length; i += this.config.maxConcurrentSyncs) {
      const batch = restaurants.slice(i, i + this.config.maxConcurrentSyncs);

      Logger.info('Processing menu sync batch', {
        batchNumber: Math.floor(i / this.config.maxConcurrentSyncs) + 1,
        batchSize: batch.length,
      });

      const batchPromises = batch.map(async (restaurant) => {
        try {
          const result = await posService.syncMenu(restaurant.id);
          return {
            restaurantId: restaurant.id,
            success: result.success,
          };
        } catch (error) {
          Logger.error('Restaurant menu sync failed', {
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            error: formatError(error),
          });
          return {
            restaurantId: restaurant.id,
            success: false,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add a small delay between batches to be nice to POS APIs
      if (i + this.config.maxConcurrentSyncs < restaurants.length) {
        await this.delay(2000); // 2 second delay between batches
      }
    }

    return results;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get job status
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    config: MenuSyncJobConfig;
  } {
    return {
      enabled: this.config.enabled,
      running: this.intervalHandle !== null,
      config: this.config,
    };
  }
}

// Export singleton instance
export const menuSyncJob = new MenuSyncJob();
