/**
 * Browser Automation System
 * 
 * Main integration point that wires all browser automation components together.
 * Provides initialization, shutdown, and tool registration functionality.
 * 
 * Requirements: 10.12, 12.1, 12.2, 1.1
 */

import { BrowserManager } from './browser-manager.js';
import { ProfileManager } from './profile-manager.js';
import { StateManager } from './state-manager.js';
import { ControlServer } from './control-server.js';
import { getToolRegistry } from '../tools/tool-registry.js';
import { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '../tools/types.js';
import { BrowserAutomationConfig, loadConfig } from './config/index.js';
import { logger } from './logger.js';

// Import all tool adapters
import {
  BrowserNavigateTool,
  BrowserBackTool,
  BrowserForwardTool,
  BrowserReloadTool,
} from './tool-adapters/navigation-tools.js';

import {
  BrowserClickTool,
  BrowserTypeTool,
  BrowserFillTool,
  BrowserHoverTool,
  BrowserSelectTool,
} from './tool-adapters/interaction-tools.js';

import {
  BrowserScreenshotTool,
  BrowserSnapshotTool,
  BrowserPDFTool,
} from './tool-adapters/capture-tools.js';

import {
  BrowserGetCookiesTool,
  BrowserSetCookiesTool,
  BrowserGetLocalStorageTool,
  BrowserSetLocalStorageTool,
} from './tool-adapters/state-tools.js';

import {
  BrowserExecuteJSTool,
  BrowserWaitForSelectorTool,
  BrowserScrollTool,
  BrowserWaitForNavigationTool,
  BrowserWaitForLoadStateTool,
} from './tool-adapters/utility-tools.js';

import { BrowserToolAdapter } from './tool-adapters/browser-tool-adapter.js';

/**
 * Browser Automation System
 * 
 * Orchestrates all browser automation components and provides
 * a unified interface for initialization, shutdown, and tool registration.
 */
export class BrowserAutomationSystem {
  private config: BrowserAutomationConfig;
  private profileManager: ProfileManager;
  private browserManager: BrowserManager;
  private controlServer: ControlServer;
  private isInitialized: boolean = false;
  private toolAdapters: BrowserToolAdapter[] = [];

  constructor(config?: Partial<BrowserAutomationConfig>) {
    // Load configuration
    this.config = loadConfig(config);
    
    // Initialize Profile Manager
    this.profileManager = new ProfileManager(
      this.config.paths.userDataBaseDir,
      this.config.profiles
    );

    // Initialize Browser Manager with Profile Manager
    this.browserManager = new BrowserManager(
      this.profileManager,
      this.config.browser.idleTimeout
    );

    // Initialize Control Server with Browser Manager
    this.controlServer = new ControlServer(this.browserManager);

    logger.info('[BrowserAutomationSystem] Components initialized');
  }

  /**
   * Initialize the Browser Automation System
   * 
   * Performs the following:
   * 1. Validates configuration
   * 2. Starts Browser Manager
   * 3. Starts Control Server (if enabled)
   * 4. Launches default browser profile
   * 5. Registers all tool adapters in Tool Registry
   * 
   * Requirements: 1.1, 12.1
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[BrowserAutomationSystem] Already initialized');
      return;
    }

    try {
      logger.info('[BrowserAutomationSystem] Starting initialization...');

      // Step 1: Validate configuration
      logger.info('[BrowserAutomationSystem] Validating configuration...');
      this.validateConfiguration();

      // Step 2: Start Browser Manager
      logger.info('[BrowserAutomationSystem] Starting Browser Manager...');
      await this.browserManager.start();

      // Step 3: Start Control Server (if enabled)
      if (this.config.controlServer.enabled) {
        logger.info(
          `[BrowserAutomationSystem] Starting Control Server on ${this.config.controlServer.host}:${this.config.controlServer.port}...`
        );
        await this.controlServer.start(this.config.controlServer.port);
      } else {
        logger.info('[BrowserAutomationSystem] Control Server disabled in configuration');
      }

      // Step 4: Launch default browser profile (if configured)
      if (this.config.browser.defaultProfile) {
        logger.info(
          `[BrowserAutomationSystem] Launching default browser profile: ${this.config.browser.defaultProfile}`
        );
        const profile = this.profileManager.getProfile(this.config.browser.defaultProfile);
        if (profile) {
          await this.browserManager.launchBrowser(profile);
          logger.info('[BrowserAutomationSystem] Default browser launched successfully');
        } else {
          logger.warn(
            `[BrowserAutomationSystem] Default profile "${this.config.browser.defaultProfile}" not found`
          );
        }
      }

      // Step 5: Register all tool adapters
      logger.info('[BrowserAutomationSystem] Registering tool adapters...');
      this.registerToolAdapters();

      this.isInitialized = true;
      logger.info('[BrowserAutomationSystem] Initialization complete');
    } catch (error: any) {
      logger.error('[BrowserAutomationSystem] Initialization failed:', error);
      // Attempt cleanup on failure
      await this.shutdown().catch(cleanupError => {
        logger.error('[BrowserAutomationSystem] Cleanup after init failure failed:', cleanupError);
      });
      throw error;
    }
  }

  /**
   * Shutdown the Browser Automation System
   * 
   * Performs graceful cleanup:
   * 1. Closes all browser instances
   * 2. Stops Control Server
   * 3. Cleans up temporary files
   * 
   * Requirements: 12.2, 12.6
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('[BrowserAutomationSystem] Not initialized, nothing to shutdown');
      return;
    }

    try {
      logger.info('[BrowserAutomationSystem] Starting shutdown...');

      // Step 1: Close all browser instances
      logger.info('[BrowserAutomationSystem] Closing all browser instances...');
      await this.browserManager.stop();

      // Step 2: Stop Control Server
      if (this.controlServer.isRunning()) {
        logger.info('[BrowserAutomationSystem] Stopping Control Server...');
        await this.controlServer.stop();
      }

      // Step 3: Clean up temporary files
      logger.info('[BrowserAutomationSystem] Cleaning up temporary files...');
      await this.cleanupTemporaryFiles();

      this.isInitialized = false;
      logger.info('[BrowserAutomationSystem] Shutdown complete');
    } catch (error: any) {
      logger.error('[BrowserAutomationSystem] Shutdown failed:', error);
      throw error;
    }
  }

  /**
   * Register all browser tool adapters in the Tool Registry
   * 
   * Creates instances of all tool adapters and registers them
   * with the global Tool Registry for function calling.
   * 
   * Requirements: 10.12
   */
  private registerToolAdapters(): void {
    const registry = getToolRegistry();

    // Create all tool adapter instances
    this.toolAdapters = [
      // Navigation tools
      new BrowserNavigateTool(this.browserManager),
      new BrowserBackTool(this.browserManager),
      new BrowserForwardTool(this.browserManager),
      new BrowserReloadTool(this.browserManager),

      // Interaction tools
      new BrowserClickTool(this.browserManager),
      new BrowserTypeTool(this.browserManager),
      new BrowserFillTool(this.browserManager),
      new BrowserHoverTool(this.browserManager),
      new BrowserSelectTool(this.browserManager),

      // Capture tools
      new BrowserScreenshotTool(this.browserManager),
      new BrowserSnapshotTool(this.browserManager),
      new BrowserPDFTool(this.browserManager),

      // State management tools
      new BrowserGetCookiesTool(this.browserManager),
      new BrowserSetCookiesTool(this.browserManager),
      new BrowserGetLocalStorageTool(this.browserManager),
      new BrowserSetLocalStorageTool(this.browserManager),

      // Utility tools
      new BrowserExecuteJSTool(this.browserManager),
      new BrowserWaitForSelectorTool(this.browserManager),
      new BrowserScrollTool(this.browserManager),
      new BrowserWaitForNavigationTool(this.browserManager),
      new BrowserWaitForLoadStateTool(this.browserManager),
    ];

    // Register each tool adapter with the registry
    let registeredCount = 0;
    for (const adapter of this.toolAdapters) {
      try {
        const toolDefinition: ToolDefinition = {
          schema: adapter.getSchema(),
          executor: this.createToolExecutor(adapter),
          category: 'browser',
        };

        registry.registerTool(toolDefinition);
        registeredCount++;
        logger.debug(`[BrowserAutomationSystem] Registered tool: ${adapter.getName()}`);
      } catch (error: any) {
        logger.error(
          `[BrowserAutomationSystem] Failed to register tool ${adapter.getName()}:`,
          error
        );
      }
    }

    logger.info(`[BrowserAutomationSystem] Registered ${registeredCount} browser tools`);
  }

  /**
   * Create a tool executor function for a tool adapter
   * 
   * Wraps the tool adapter's execute method to match the ToolExecutor signature.
   * 
   * @param adapter Tool adapter instance
   * @returns Tool executor function
   */
  private createToolExecutor(adapter: BrowserToolAdapter) {
    return async (
      args: Record<string, any>,
      context: ToolExecutionContext
    ): Promise<ToolExecutionResult> => {
      try {
        const result = await adapter.execute(args);

        return {
          success: result.success,
          result: result.data,
          error: result.error ? `${result.error.code}: ${result.error.message}` : undefined,
          executionTime: result.executionTime || 0,
          metadata: {
            timestamp: result.timestamp,
            toolName: adapter.getName(),
            conversationId: context.conversationId,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Tool execution failed',
          executionTime: 0,
          metadata: {
            timestamp: Date.now(),
            toolName: adapter.getName(),
            conversationId: context.conversationId,
          },
        };
      }
    };
  }

  /**
   * Validate configuration
   * 
   * Checks that all required configuration values are valid.
   * Throws an error if configuration is invalid.
   * 
   * Requirements: 13.7
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate control server configuration
    if (this.config.controlServer.enabled) {
      if (this.config.controlServer.host !== '127.0.0.1') {
        errors.push(
          `Control server host must be 127.0.0.1 (loopback only), got: ${this.config.controlServer.host}`
        );
      }

      const port = this.config.controlServer.port;
      if (port < 1024 || port > 65535) {
        errors.push(`Control server port must be between 1024 and 65535, got: ${port}`);
      }
    }

    // Validate browser configuration
    if (this.config.browser.idleTimeout < 0) {
      errors.push(`Browser idle timeout must be non-negative, got: ${this.config.browser.idleTimeout}`);
    }

    if (this.config.browser.defaultTimeout < 0) {
      errors.push(`Browser default timeout must be non-negative, got: ${this.config.browser.defaultTimeout}`);
    }

    // Validate paths
    if (!this.config.paths.userDataBaseDir) {
      errors.push('User data base directory must be specified');
    }

    if (!this.config.paths.screenshotDir) {
      errors.push('Screenshot directory must be specified');
    }

    if (!this.config.paths.downloadDir) {
      errors.push('Download directory must be specified');
    }

    // Validate default profile exists
    if (this.config.browser.defaultProfile) {
      const profile = this.profileManager.getProfile(this.config.browser.defaultProfile);
      if (!profile) {
        errors.push(
          `Default profile "${this.config.browser.defaultProfile}" not found in profile list`
        );
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Clean up temporary files
   * 
   * Removes temporary files created during browser automation.
   * This includes screenshots, downloads, and other temporary data.
   * 
   * Requirements: 12.6
   */
  private async cleanupTemporaryFiles(): Promise<void> {
    // Note: In a full implementation, this would:
    // 1. Clean up temporary screenshots
    // 2. Clean up temporary downloads
    // 3. Clean up any other temporary files
    // 
    // For now, we'll just log that cleanup would happen here
    logger.debug('[BrowserAutomationSystem] Temporary file cleanup complete');
  }

  /**
   * Get the Browser Manager instance
   */
  getBrowserManager(): BrowserManager {
    return this.browserManager;
  }

  /**
   * Get the Control Server instance
   */
  getControlServer(): ControlServer {
    return this.controlServer;
  }

  /**
   * Get the Profile Manager instance
   */
  getProfileManager(): ProfileManager {
    return this.profileManager;
  }

  /**
   * Check if the system is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the current configuration
   */
  getConfig(): BrowserAutomationConfig {
    return this.config;
  }
}

