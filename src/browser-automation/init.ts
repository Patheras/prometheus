/**
 * Browser Automation Initialization Script
 * 
 * Provides a convenient initialization function for the Browser Automation System.
 * Can be used to start the system with custom configuration or defaults.
 * 
 * Requirements: 1.1, 12.1
 */

import { BrowserAutomationSystem } from './browser-automation-system.js';
import { BrowserAutomationConfig } from './config/index.js';
import { logger } from './logger.js';

/**
 * Global instance of the Browser Automation System
 */
let browserAutomationInstance: BrowserAutomationSystem | null = null;

/**
 * Initialize the Browser Automation System
 * 
 * This function:
 * 1. Loads configuration (from file, environment, or provided config)
 * 2. Validates configuration
 * 3. Creates and initializes the Browser Automation System
 * 4. Starts the Control Server
 * 5. Launches the default browser profile
 * 6. Registers all browser tools in the Tool Registry
 * 
 * @param config Optional configuration overrides
 * @returns Initialized Browser Automation System instance
 * 
 * @example
 * ```typescript
 * // Initialize with defaults
 * const system = await initializeBrowserAutomation();
 * 
 * // Initialize with custom config
 * const system = await initializeBrowserAutomation({
 *   controlServer: { port: 18792 },
 *   browser: { headless: true }
 * });
 * ```
 */
export async function initializeBrowserAutomation(
  config?: Partial<BrowserAutomationConfig>
): Promise<BrowserAutomationSystem> {
  try {
    logger.info('[Init] Initializing Browser Automation System...');

    // Check if already initialized
    if (browserAutomationInstance && browserAutomationInstance.isReady()) {
      logger.warn('[Init] Browser Automation System already initialized');
      return browserAutomationInstance;
    }

    // Create new instance
    browserAutomationInstance = new BrowserAutomationSystem(config);

    // Initialize the system
    await browserAutomationInstance.initialize();

    logger.info('[Init] Browser Automation System initialized successfully');
    return browserAutomationInstance;
  } catch (error: any) {
    logger.error('[Init] Failed to initialize Browser Automation System:', error);
    throw new Error(`Browser Automation initialization failed: ${error.message}`);
  }
}

/**
 * Get the current Browser Automation System instance
 * 
 * @returns Current instance or null if not initialized
 */
export function getBrowserAutomationSystem(): BrowserAutomationSystem | null {
  return browserAutomationInstance;
}

/**
 * Check if the Browser Automation System is initialized
 * 
 * @returns True if initialized and ready
 */
export function isBrowserAutomationInitialized(): boolean {
  return browserAutomationInstance !== null && browserAutomationInstance.isReady();
}

/**
 * Shutdown the Browser Automation System
 * 
 * Performs graceful cleanup of all resources.
 * 
 * @returns Promise that resolves when shutdown is complete
 */
export async function shutdownBrowserAutomation(): Promise<void> {
  if (!browserAutomationInstance) {
    logger.warn('[Init] No Browser Automation System instance to shutdown');
    return;
  }

  try {
    logger.info('[Init] Shutting down Browser Automation System...');
    await browserAutomationInstance.shutdown();
    browserAutomationInstance = null;
    logger.info('[Init] Browser Automation System shutdown complete');
  } catch (error: any) {
    logger.error('[Init] Failed to shutdown Browser Automation System:', error);
    throw new Error(`Browser Automation shutdown failed: ${error.message}`);
  }
}

/**
 * Quick start function for development and testing
 * 
 * Initializes the system with sensible defaults for local development.
 * 
 * @returns Initialized Browser Automation System instance
 */
export async function quickStart(): Promise<BrowserAutomationSystem> {
  logger.info('[Init] Quick start: Initializing with development defaults...');

  return initializeBrowserAutomation({
    controlServer: {
      enabled: true,
      port: 18791,
      host: '127.0.0.1',
    },
    browser: {
      headless: false, // Show browser for development
      defaultProfile: 'openclaw',
      defaultTimeout: 30000,
      idleTimeout: 300000, // 5 minutes
    },
    logging: {
      level: 'info',
      logActions: true,
      logErrors: true,
    },
  });
}

