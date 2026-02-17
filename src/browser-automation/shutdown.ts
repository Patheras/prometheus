/**
 * Browser Automation Shutdown Script
 * 
 * Provides graceful shutdown functionality for the Browser Automation System.
 * Ensures all resources are properly cleaned up.
 * 
 * Requirements: 12.2, 12.6
 */

import { getBrowserAutomationSystem } from './init.js';
import { logger } from './logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Graceful shutdown of the Browser Automation System
 * 
 * This function performs the following cleanup steps:
 * 1. Closes all browser instances
 * 2. Stops the Control Server
 * 3. Cleans up temporary files
 * 4. Releases all resources
 * 
 * @param options Shutdown options
 * @returns Promise that resolves when shutdown is complete
 * 
 * @example
 * ```typescript
 * // Graceful shutdown with default timeout
 * await gracefulShutdown();
 * 
 * // Shutdown with custom timeout
 * await gracefulShutdown({ timeout: 60000 });
 * 
 * // Force shutdown (skip cleanup)
 * await gracefulShutdown({ force: true });
 * ```
 */
export async function gracefulShutdown(options: {
  timeout?: number;
  force?: boolean;
  cleanupTempFiles?: boolean;
} = {}): Promise<void> {
  const {
    timeout = 30000, // 30 seconds default
    force = false,
    cleanupTempFiles = true,
  } = options;

  try {
    logger.info('[Shutdown] Starting graceful shutdown...');

    const system = getBrowserAutomationSystem();
    if (!system) {
      logger.warn('[Shutdown] No Browser Automation System instance found');
      return;
    }

    if (force) {
      logger.warn('[Shutdown] Force shutdown requested - skipping graceful cleanup');
      await forceShutdown(system);
      return;
    }

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Shutdown timeout after ${timeout}ms`));
      }, timeout);
    });

    // Create shutdown promise
    const shutdownPromise = performShutdown(system, cleanupTempFiles);

    // Race between shutdown and timeout
    await Promise.race([shutdownPromise, timeoutPromise]);

    logger.info('[Shutdown] Graceful shutdown complete');
  } catch (error: any) {
    logger.error('[Shutdown] Shutdown failed:', error);
    
    // If graceful shutdown fails, attempt force shutdown
    logger.warn('[Shutdown] Attempting force shutdown...');
    const system = getBrowserAutomationSystem();
    if (system) {
      await forceShutdown(system).catch(forceError => {
        logger.error('[Shutdown] Force shutdown also failed:', forceError);
      });
    }
    
    throw error;
  }
}

/**
 * Perform the actual shutdown steps
 * 
 * @param system Browser Automation System instance
 * @param cleanupTempFiles Whether to clean up temporary files
 */
async function performShutdown(
  system: any,
  cleanupTempFiles: boolean
): Promise<void> {
  // Step 1: Close all browser instances
  logger.info('[Shutdown] Closing all browser instances...');
  const browserManager = system.getBrowserManager();
  const browsers = browserManager.listBrowsers();
  
  for (const browser of browsers) {
    try {
      await browserManager.closeBrowser(browser.id);
      logger.debug(`[Shutdown] Closed browser: ${browser.id}`);
    } catch (error: any) {
      logger.error(`[Shutdown] Failed to close browser ${browser.id}:`, error);
    }
  }

  // Step 2: Stop Browser Manager
  logger.info('[Shutdown] Stopping Browser Manager...');
  await browserManager.stop();

  // Step 3: Stop Control Server
  const controlServer = system.getControlServer();
  if (controlServer.isRunning()) {
    logger.info('[Shutdown] Stopping Control Server...');
    await controlServer.stop();
  }

  // Step 4: Clean up temporary files
  if (cleanupTempFiles) {
    logger.info('[Shutdown] Cleaning up temporary files...');
    await cleanupTemporaryFiles(system);
  }

  logger.info('[Shutdown] All components stopped successfully');
}

/**
 * Force shutdown without graceful cleanup
 * 
 * @param system Browser Automation System instance
 */
async function forceShutdown(system: any): Promise<void> {
  try {
    // Just call the system's shutdown method
    await system.shutdown();
  } catch (error: any) {
    logger.error('[Shutdown] Force shutdown error:', error);
    // Continue anyway - we're forcing shutdown
  }
}

/**
 * Clean up temporary files created during browser automation
 * 
 * This includes:
 * - Temporary screenshots
 * - Temporary downloads
 * - Temporary user data directories (if configured)
 * - Other temporary files
 * 
 * Requirements: 12.6
 * 
 * @param system Browser Automation System instance
 */
async function cleanupTemporaryFiles(system: any): Promise<void> {
  try {
    const config = system.getConfig();
    const cleanupTasks: Promise<void>[] = [];

    // Clean up screenshot directory (only temp files)
    if (config.paths.screenshotDir) {
      cleanupTasks.push(
        cleanupDirectory(config.paths.screenshotDir, 'screenshot-temp-*')
      );
    }

    // Clean up download directory (only temp files)
    if (config.paths.downloadDir) {
      cleanupTasks.push(
        cleanupDirectory(config.paths.downloadDir, 'download-temp-*')
      );
    }

    // Wait for all cleanup tasks
    await Promise.allSettled(cleanupTasks);

    logger.info('[Shutdown] Temporary file cleanup complete');
  } catch (error: any) {
    logger.error('[Shutdown] Temporary file cleanup failed:', error);
    // Don't throw - cleanup is best effort
  }
}

/**
 * Clean up files in a directory matching a pattern
 * 
 * @param dirPath Directory path
 * @param pattern File pattern (glob-style)
 */
async function cleanupDirectory(dirPath: string, pattern: string): Promise<void> {
  try {
    // Check if directory exists
    try {
      await fs.access(dirPath);
    } catch {
      // Directory doesn't exist, nothing to clean
      return;
    }

    // Read directory contents
    const files = await fs.readdir(dirPath);

    // Convert glob pattern to regex
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );

    // Delete matching files
    const deleteTasks = files
      .filter(file => regex.test(file))
      .map(async file => {
        const filePath = path.join(dirPath, file);
        try {
          await fs.unlink(filePath);
          logger.debug(`[Shutdown] Deleted temp file: ${filePath}`);
        } catch (error: any) {
          logger.warn(`[Shutdown] Failed to delete ${filePath}:`, error.message);
        }
      });

    await Promise.allSettled(deleteTasks);
  } catch (error: any) {
    logger.error(`[Shutdown] Failed to cleanup directory ${dirPath}:`, error);
  }
}

/**
 * Register shutdown handlers for process signals
 * 
 * Ensures graceful shutdown when the process receives termination signals.
 * 
 * @example
 * ```typescript
 * // Register handlers at application startup
 * registerShutdownHandlers();
 * ```
 */
export function registerShutdownHandlers(): void {
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    logger.info('[Shutdown] Received SIGINT signal');
    try {
      await gracefulShutdown({ timeout: 10000 });
      process.exit(0);
    } catch (error) {
      logger.error('[Shutdown] Shutdown failed on SIGINT');
      process.exit(1);
    }
  });

  // Handle SIGTERM (kill command)
  process.on('SIGTERM', async () => {
    logger.info('[Shutdown] Received SIGTERM signal');
    try {
      await gracefulShutdown({ timeout: 10000 });
      process.exit(0);
    } catch (error) {
      logger.error('[Shutdown] Shutdown failed on SIGTERM');
      process.exit(1);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.error('[Shutdown] Uncaught exception:', error);
    try {
      await gracefulShutdown({ timeout: 5000, force: true });
    } catch {
      // Ignore errors during emergency shutdown
    }
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('[Shutdown] Unhandled promise rejection:', reason);
    try {
      await gracefulShutdown({ timeout: 5000, force: true });
    } catch {
      // Ignore errors during emergency shutdown
    }
    process.exit(1);
  });

  logger.info('[Shutdown] Shutdown handlers registered');
}

