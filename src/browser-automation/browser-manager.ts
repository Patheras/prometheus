/**
 * Browser Manager
 * 
 * Central orchestrator for browser lifecycle and operations.
 * Manages browser instances, profiles, and action execution.
 * 
 * Requirements: 12.1, 12.2, 12.5
 */

import { launch as chromeLaunch, LaunchedChrome } from 'chrome-launcher';
import { EventEmitter } from 'events';
import { CDPClient } from './cdp-client.js';
import { PlaywrightAdapter } from './playwright-adapter.js';
import { ProfileManager } from './profile-manager.js';
import { ExtensionRelayClient, ExtensionTab } from './extension-relay-client.js';
import { RemoteBrowserConnector } from './remote-browser-connector.js';
import { Browser, BrowserProfile, BrowserAction, ActionResult, ActionError, ErrorCode } from './types/index.js';
import { randomUUID } from 'crypto';
import { getLogger } from './logger.js';
import { getMetricsCollector } from './metrics-collector.js';

/**
 * Browser Manager for lifecycle management and browser operations
 */
export class BrowserManager extends EventEmitter {
  private profileManager: ProfileManager;
  private browsers: Map<string, Browser> = new Map();
  private activeBrowserId: string | null = null;
  private chromeInstances: Map<string, LaunchedChrome> = new Map();
  private cdpClients: Map<string, CDPClient> = new Map();
  private extensionRelayClients: Map<string, ExtensionRelayClient> = new Map();
  private remoteBrowserConnectors: Map<string, RemoteBrowserConnector> = new Map();
  private started = false;
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private idleTimeoutMs: number;
  private readonly IDLE_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
  
  // Crash recovery tracking
  private crashRecoveryAttempts: Map<string, number> = new Map();
  private readonly MAX_CRASH_RECOVERY_ATTEMPTS = 3;
  private readonly CRASH_RECOVERY_BACKOFF_BASE = 1000; // 1 second base
  private readonly CRASH_RECOVERY_MAX_DELAY = 30000; // 30 seconds max

  constructor(profileManager: ProfileManager, idleTimeoutMs: number = 300000) {
    super();
    this.profileManager = profileManager;
    this.idleTimeoutMs = idleTimeoutMs;

    // Set up logging and metrics for browser manager events
    this.setupLoggingAndMetrics();
  }

  /**
   * Set up logging and metrics collection for browser manager events
   */
  private setupLoggingAndMetrics(): void {
    const logger = getLogger();
    const metrics = getMetricsCollector();

    // Log and track browser launches
    this.on('browser-launched', (info) => {
      logger.logConnection('connected', info.browserId, info.profile);
      metrics.recordBrowserLaunch();
      metrics.recordConnection('connected');
    });

    // Log and track browser closes
    this.on('browser-closed', (info) => {
      logger.logConnection('disconnected', info.browserId, info.profile);
      metrics.recordBrowserClose();
      metrics.recordConnection('disconnected');
    });

    // Log and track browser crashes
    this.on('browser-crashed', (info) => {
      logger.logError(
        new Error(`Browser crashed: ${info.reason}`),
        { code: info.code, reason: info.reason },
        info.browserId,
        info.profile
      );
      metrics.recordBrowserCrash();
    });

    // Log idle timeouts
    this.on('browser-idle-timeout', (info) => {
      logger.log('info', `Browser idle timeout`, {
        browserId: info.browserId,
        profile: info.profile,
        idleTime: info.idleTime,
      });
      metrics.recordIdleTimeout();
    });

    // Log browser restarts after idle
    this.on('browser-restarted-after-idle', (info) => {
      logger.log('info', `Browser restarted after idle timeout`, {
        browserId: info.browserId,
        profile: info.profile,
      });
    });

    // Log remote connection events
    this.on('remote-connection-lost', (info) => {
      logger.logError(
        new Error('Remote connection lost'),
        { reconnectAttempts: info.reconnectAttempts },
        info.browserId,
        info.profile
      );
    });

    this.on('remote-connection-restored', (info) => {
      logger.logConnection('reconnected', info.browserId, info.profile);
      metrics.recordConnection('reconnected');
    });

    this.on('remote-reconnection-failed', (info) => {
      logger.logError(
        new Error('Remote reconnection failed after maximum attempts'),
        {},
        info.browserId,
        info.profile
      );
      metrics.recordConnection('failed');
    });

    // Log extension tab events
    this.on('extension-tab-closed', (info) => {
      logger.log('info', `Extension tab closed`, {
        browserId: info.browserId,
        profile: info.profile,
        tabId: info.tabId,
      });
    });

    this.on('extension-relay-disconnected', (info) => {
      logger.logError(
        new Error(`Extension relay disconnected: ${info.reason}`),
        { code: info.code, reason: info.reason },
        info.browserId,
        info.profile
      );
    });
  }

  /**
   * Start the browser manager
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('BrowserManager is already started');
    }

    this.started = true;
    
    // Start idle timeout checker
    this.startIdleTimeoutChecker();
    
    this.emit('started');
  }

  /**
   * Stop the browser manager and clean up all resources
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Stop idle timeout checker
    this.stopIdleTimeoutChecker();

    // Close all browser instances
    const browserIds = Array.from(this.browsers.keys());
    for (const browserId of browserIds) {
      try {
        await this.closeBrowser(browserId);
      } catch (error) {
        console.error(`Error closing browser ${browserId}:`, error);
      }
    }

    this.started = false;
    this.activeBrowserId = null;
    this.emit('stopped');
  }

  /**
   * Launch a browser with the specified profile
   * @param profile Browser profile to use
   * @returns Browser instance
   */
  async launchBrowser(profile: BrowserProfile): Promise<Browser> {
    if (!this.started) {
      throw new Error('BrowserManager is not started. Call start() first.');
    }

    // Handle different profile types
    if (profile.type === 'chrome-extension') {
      return this.launchExtensionBrowser(profile);
    } else if (profile.type === 'remote') {
      return this.launchRemoteBrowser(profile);
    }

    // Default: openclaw profile - launch new Chrome instance
    return this.launchOpenclawBrowser(profile);
  }

  /**
   * Launch a browser with openclaw profile (new Chrome instance)
   * @param profile Browser profile
   * @returns Browser instance
   */
  private async launchOpenclawBrowser(profile: BrowserProfile): Promise<Browser> {
    // Ensure user data directory exists
    await this.profileManager.ensureUserDataDir(profile);

    try {
      // Launch Chrome with chrome-launcher
      const chrome = await chromeLaunch({
        chromePath: profile.launchOptions.executablePath,
        chromeFlags: [
          ...profile.launchOptions.args,
          `--user-data-dir=${profile.userDataDir}`,
          '--remote-debugging-port=0', // Use dynamic port
        ],
        handleSIGINT: false,
        startingUrl: 'about:blank',
      });

      // Get the CDP endpoint
      const cdpEndpoint = `http://localhost:${chrome.port}`;

      // Wait for CDP to be ready (Chrome needs time to start the debugging server)
      // Connect CDP client to get WebSocket endpoint with retries
      const cdpClient = new CDPClient();
      try {
        // Connect to the browser target with retries
        let versionInfo: any;
        let retries = 10;
        let lastError: any;
        
        while (retries > 0) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const response = await fetch(`${cdpEndpoint}/json/version`, {
              signal: AbortSignal.timeout(5000)
            });
            versionInfo = await response.json();
            break;
          } catch (error) {
            lastError = error;
            retries--;
            if (retries === 0) {
              throw new Error(`Failed to connect to Chrome CDP after 10 retries: ${lastError}`);
            }
          }
        }
        const wsEndpoint = versionInfo.webSocketDebuggerUrl;

        await cdpClient.connect(wsEndpoint);

        // Initialize Playwright adapter
        const playwrightAdapter = new PlaywrightAdapter();
        await playwrightAdapter.initialize(wsEndpoint);

        // Create browser instance
        const browserId = randomUUID();
        const browser: Browser = {
          id: browserId,
          profile,
          cdpEndpoint: wsEndpoint,
          playwrightBrowser: playwrightAdapter,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
        };

        // Store browser instance, Chrome process, and CDP client
        this.browsers.set(browserId, browser);
        this.chromeInstances.set(browserId, chrome);
        this.cdpClients.set(browserId, cdpClient);

        // Set up crash detection via CDP disconnection
        this.setupCrashDetection(browserId, cdpClient, profile);

        // Reset crash recovery attempts on successful launch
        this.crashRecoveryAttempts.delete(browserId);

        // Set as active browser if no active browser exists
        if (!this.activeBrowserId) {
          this.activeBrowserId = browserId;
        }

        this.emit('browser-launched', { browserId, profile: profile.name });

        return browser;
      } catch (error) {
        // Clean up CDP client on error
        await cdpClient.disconnect();
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to launch browser with profile "${profile.name}": ${error}`);
    }
  }

  /**
   * Launch a browser with chrome-extension profile (connect to existing tab)
   * @param profile Browser profile
   * @returns Browser instance
   */
  private async launchExtensionBrowser(profile: BrowserProfile): Promise<Browser> {
    if (!profile.connectionOptions?.wsEndpoint) {
      throw new Error(
        'Extension relay WebSocket endpoint is required for chrome-extension profile. ' +
        'Set connectionOptions.wsEndpoint in the profile configuration.\n\n' +
        ExtensionRelayClient.getInstallationInstructions()
      );
    }

    try {
      // Create extension relay client
      const relayClient = new ExtensionRelayClient({
        extensionId: profile.connectionOptions.extensionId,
        wsEndpoint: profile.connectionOptions.wsEndpoint,
      });

      // Connect to extension relay
      try {
        await relayClient.connect(profile.connectionOptions.wsEndpoint);
      } catch (error) {
        throw new Error(
          `Failed to connect to extension relay: ${error}\n\n` +
          ExtensionRelayClient.getInstallationInstructions()
        );
      }

      // Discover available tabs
      let tabs: ExtensionTab[];
      try {
        tabs = await relayClient.discoverTabs();
      } catch (error) {
        await relayClient.disconnect();
        throw new Error(`Failed to discover tabs from extension: ${error}`);
      }

      if (tabs.length === 0) {
        await relayClient.disconnect();
        throw new Error('No tabs available from extension. Please open at least one tab in your browser.');
      }

      // Select the first active tab, or the first tab if no active tab
      const selectedTab = tabs.find(tab => tab.active) || tabs[0];

      // Connect to the selected tab
      let wsEndpoint: string;
      try {
        wsEndpoint = await relayClient.connectTab(selectedTab.tabId);
      } catch (error) {
        await relayClient.disconnect();
        throw new Error(`Failed to connect to tab ${selectedTab.tabId}: ${error}`);
      }

      // Connect CDP client
      const cdpClient = new CDPClient();
      try {
        await cdpClient.connect(wsEndpoint);
      } catch (error) {
        await relayClient.disconnectTab(selectedTab.tabId);
        await relayClient.disconnect();
        throw error;
      }

      // Initialize Playwright adapter
      const playwrightAdapter = new PlaywrightAdapter();
      try {
        await playwrightAdapter.initialize(wsEndpoint);
      } catch (error) {
        await cdpClient.disconnect();
        await relayClient.disconnectTab(selectedTab.tabId);
        await relayClient.disconnect();
        throw error;
      }

      // Create browser instance
      const browserId = randomUUID();
      const browser: Browser = {
        id: browserId,
        profile,
        cdpEndpoint: wsEndpoint,
        playwrightBrowser: playwrightAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // Store browser instance, CDP client, and extension relay client
      this.browsers.set(browserId, browser);
      this.cdpClients.set(browserId, cdpClient);
      this.extensionRelayClients.set(browserId, relayClient);

      // Set up tab closure detection
      this.setupExtensionTabClosureDetection(browserId, relayClient, selectedTab.tabId);

      // Set up crash detection via CDP disconnection
      this.setupCrashDetection(browserId, cdpClient, profile);

      // Reset crash recovery attempts on successful launch
      this.crashRecoveryAttempts.delete(browserId);

      // Set as active browser if no active browser exists
      if (!this.activeBrowserId) {
        this.activeBrowserId = browserId;
      }

      this.emit('browser-launched', {
        browserId,
        profile: profile.name,
        tabId: selectedTab.tabId,
        tabTitle: selectedTab.title,
        tabUrl: selectedTab.url,
      });

      return browser;
    } catch (error) {
      throw new Error(`Failed to launch browser with chrome-extension profile "${profile.name}": ${error}`);
    }
  }

  /**
   * Launch a browser with remote profile (connect to remote browser)
   * @param profile Browser profile
   * @returns Browser instance
   */
  private async launchRemoteBrowser(profile: BrowserProfile): Promise<Browser> {
    if (!profile.connectionOptions) {
      throw new Error(
        'Connection options are required for remote profile. ' +
        'Set connectionOptions.wsEndpoint (and optionally gatewayUrl and authToken) in the profile configuration.'
      );
    }

    const { wsEndpoint, gatewayUrl, authToken } = profile.connectionOptions;

    if (!wsEndpoint && !gatewayUrl) {
      throw new Error(
        'Either wsEndpoint or gatewayUrl must be provided in connectionOptions for remote profile'
      );
    }

    try {
      // Create remote browser connector
      const remoteConnector = new RemoteBrowserConnector();

      // Connect to remote browser
      const connectionResult = await remoteConnector.connect({
        wsEndpoint: wsEndpoint || '',
        gatewayUrl,
        authToken,
        timeout: profile.launchOptions.timeout || 30000,
      });

      if (!connectionResult.success) {
        throw new Error(
          `Failed to connect to remote browser: ${connectionResult.error?.message}\n\n` +
          `Retry suggestions:\n${connectionResult.error?.retrySuggestions?.map(s => `  - ${s}`).join('\n')}`
        );
      }

      const authenticatedEndpoint = connectionResult.wsEndpoint!;

      // Connect CDP client
      const cdpClient = new CDPClient();
      try {
        await cdpClient.connect(authenticatedEndpoint);
      } catch (error) {
        remoteConnector.disconnect();
        throw error;
      }

      // Initialize Playwright adapter
      const playwrightAdapter = new PlaywrightAdapter();
      try {
        await playwrightAdapter.initialize(authenticatedEndpoint);
      } catch (error) {
        await cdpClient.disconnect();
        remoteConnector.disconnect();
        throw error;
      }

      // Create browser instance
      const browserId = randomUUID();
      const browser: Browser = {
        id: browserId,
        profile,
        cdpEndpoint: authenticatedEndpoint,
        playwrightBrowser: playwrightAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // Store browser instance, CDP client, and remote connector
      this.browsers.set(browserId, browser);
      this.cdpClients.set(browserId, cdpClient);
      this.remoteBrowserConnectors.set(browserId, remoteConnector);

      // Set up network interruption detection and reconnection
      this.setupRemoteNetworkInterruptionHandling(browserId, remoteConnector, profile);

      // Set up crash detection via CDP disconnection
      this.setupCrashDetection(browserId, cdpClient, profile);

      // Reset crash recovery attempts on successful launch
      this.crashRecoveryAttempts.delete(browserId);

      // Set as active browser if no active browser exists
      if (!this.activeBrowserId) {
        this.activeBrowserId = browserId;
      }

      this.emit('browser-launched', {
        browserId,
        profile: profile.name,
        browserVersion: connectionResult.browserVersion,
        remote: true,
      });

      return browser;
    } catch (error) {
      throw new Error(`Failed to launch browser with remote profile "${profile.name}": ${error}`);
    }
  }

  /**
   * Close a browser instance
   * @param browserId Browser ID to close
   */
  async closeBrowser(browserId: string): Promise<void> {
    const browser = this.browsers.get(browserId);
    if (!browser) {
      throw new Error(`Browser with ID "${browserId}" not found`);
    }

    try {
      // Close Playwright adapter
      const playwrightAdapter = browser.playwrightBrowser as PlaywrightAdapter;
      if (playwrightAdapter) {
        await playwrightAdapter.close();
      }

      // Disconnect CDP client
      const cdpClient = this.cdpClients.get(browserId);
      if (cdpClient) {
        await cdpClient.disconnect();
        this.cdpClients.delete(browserId);
      }

      // Disconnect extension relay client if present
      const relayClient = this.extensionRelayClients.get(browserId);
      if (relayClient) {
        await relayClient.disconnect();
        this.extensionRelayClients.delete(browserId);
      }

      // Disconnect remote browser connector if present
      const remoteConnector = this.remoteBrowserConnectors.get(browserId);
      if (remoteConnector) {
        remoteConnector.disconnect();
        this.remoteBrowserConnectors.delete(browserId);
      }

      // Kill Chrome process (only for openclaw profile)
      const chrome = this.chromeInstances.get(browserId);
      if (chrome) {
        await chrome.kill();
        this.chromeInstances.delete(browserId);
      }

      // Remove from active browser if this was the active one
      if (this.activeBrowserId === browserId) {
        this.activeBrowserId = null;
      }

      // Clean up crash recovery tracking
      this.crashRecoveryAttempts.delete(browserId);

      // Remove browser instance
      this.browsers.delete(browserId);

      this.emit('browser-closed', { browserId, profile: browser.profile.name });
    } catch (error) {
      throw new Error(`Failed to close browser "${browserId}": ${error}`);
    }
  }

  /**
   * Get the currently active browser
   * @returns Active browser instance or null if no browser is active
   */
  getActiveBrowser(): Browser | null {
    if (!this.activeBrowserId) {
      return null;
    }
    return this.browsers.get(this.activeBrowserId) || null;
  }

  /**
   * Get a browser by ID
   * @param browserId Browser ID
   * @returns Browser instance or null if not found
   */
  getBrowser(browserId: string): Browser | null {
    return this.browsers.get(browserId) || null;
  }

  /**
   * List all active browser instances
   * @returns Array of browser instances
   */
  listBrowsers(): Browser[] {
    return Array.from(this.browsers.values());
  }

  /**
   * Set the active browser
   * @param browserId Browser ID to set as active
   */
  setActiveBrowser(browserId: string): void {
    const browser = this.browsers.get(browserId);
    if (!browser) {
      throw new Error(`Browser with ID "${browserId}" not found`);
    }

    this.activeBrowserId = browserId;
    browser.lastUsedAt = Date.now();
    this.emit('active-browser-changed', { browserId, profile: browser.profile.name });
  }

  /**
   * Update the last used timestamp for a browser
   * @param browserId Browser ID
   */
  updateLastUsed(browserId: string): void {
    const browser = this.browsers.get(browserId);
    if (browser) {
      browser.lastUsedAt = Date.now();
    }
  }

  /**
   * Switch to a different browser profile
   * Closes the current browser and launches a new one with the specified profile
   * @param profileName Name of the profile to switch to
   */
  async switchProfile(profileName: string): Promise<void> {
    if (!this.started) {
      throw new Error('BrowserManager is not started. Call start() first.');
    }

    // Get the profile
    const profile = this.profileManager.getProfile(profileName);
    if (!profile) {
      throw new Error(`Profile "${profileName}" not found`);
    }

    // Close the current active browser if one exists
    if (this.activeBrowserId) {
      const currentBrowser = this.browsers.get(this.activeBrowserId);
      const currentProfileName = currentBrowser?.profile.name;
      
      await this.closeBrowser(this.activeBrowserId);
      
      this.emit('profile-switched', { 
        from: currentProfileName, 
        to: profileName 
      });
    }

    // Launch a new browser with the new profile
    const browser = await this.launchBrowser(profile);
    this.activeBrowserId = browser.id;
  }

  /**
   * Get the current active profile
   * @returns Current browser profile or null if no browser is active
   */
  getCurrentProfile(): BrowserProfile | null {
    const activeBrowser = this.getActiveBrowser();
    return activeBrowser ? activeBrowser.profile : null;
  }

  /**
   * List all available profiles
   * @returns Array of browser profiles
   */
  listProfiles(): BrowserProfile[] {
    return this.profileManager.listProfiles();
  }

  /**
   * Check if the manager is started
   */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Get the profile manager
   */
  getProfileManager(): ProfileManager {
    return this.profileManager;
  }

  /**
   * Execute a browser action
   * Routes the action to the Playwright adapter with validation and error handling
   * @param action Browser action to execute
   * @returns Action result with success status, result data, or error
   */
  async executeAction(action: BrowserAction): Promise<ActionResult> {
    const startTime = Date.now();
    const timestamp = Date.now();
    const logger = getLogger();
    const metrics = getMetricsCollector();

    try {
      // Ensure we have an active browser (will restart if closed due to idle timeout)
      let activeBrowser: Browser;
      try {
        activeBrowser = await this.ensureBrowserAvailable();
      } catch (error: any) {
        const result = this.createErrorResult(
          action,
          'BROWSER_DISCONNECTED',
          `Failed to ensure browser availability: ${error.message}`,
          startTime,
          timestamp
        );
        
        // Log error and record metrics
        logger.logAction(action, result, undefined, undefined);
        metrics.recordAction(action, result);
        
        return result;
      }

      // Update last used timestamp
      this.updateLastUsed(activeBrowser.id);

      // Get the Playwright adapter
      const adapter = activeBrowser.playwrightBrowser as PlaywrightAdapter;
      if (!adapter || !adapter.isInitialized()) {
        const result = this.createErrorResult(
          action,
          'BROWSER_DISCONNECTED',
          'Browser adapter is not initialized',
          startTime,
          timestamp
        );
        
        // Log error and record metrics
        logger.logAction(action, result, activeBrowser.id, activeBrowser.profile.name);
        metrics.recordAction(action, result);
        
        return result;
      }

      // Validate action parameters
      const validationError = this.validateAction(action);
      if (validationError) {
        const result = this.createErrorResult(
          action,
          'INVALID_SELECTOR',
          validationError,
          startTime,
          timestamp
        );
        
        // Log error and record metrics
        logger.logAction(action, result, activeBrowser.id, activeBrowser.profile.name);
        metrics.recordAction(action, result);
        
        return result;
      }

      // Route action to appropriate adapter method
      let result: any;
      
      switch (action.type) {
        case 'navigate':
          result = await adapter.navigate(action.url, {
            waitUntil: action.waitUntil,
            timeout: action.timeout,
          });
          break;

        case 'click':
          await adapter.click(action.selector, {
            button: action.button,
            clickCount: action.clickCount,
            timeout: action.timeout,
          });
          result = { clicked: action.selector };
          break;

        case 'type':
          await adapter.type(action.selector, action.text, {
            delay: action.delay,
            timeout: action.timeout,
          });
          result = { typed: action.text, selector: action.selector };
          break;

        case 'screenshot':
          const screenshotBuffer = await adapter.screenshot({
            type: action.format,
            quality: action.quality,
            fullPage: action.fullPage,
            path: action.path,
          });
          result = {
            screenshot: screenshotBuffer.toString('base64'),
            format: action.format || 'png',
            path: action.path,
          };
          break;

        case 'snapshot':
          result = await adapter.snapshot();
          break;

        case 'pdf':
          const pdfBuffer = await adapter.pdf({
            path: action.path,
            format: action.format,
            width: action.width,
            height: action.height,
            margin: action.margin,
            printBackground: action.printBackground,
          });
          result = {
            pdf: pdfBuffer.toString('base64'),
            path: action.path,
          };
          break;

        case 'execute_js':
          result = await adapter.evaluate(action.script);
          break;

        case 'wait':
          await this.executeWaitAction(adapter, action);
          result = { waited: action.condition };
          break;

        case 'scroll':
          await adapter.scroll(action.target, {
            selector: action.selector,
            x: action.x,
            y: action.y,
          });
          result = { scrolled: action.target };
          break;

        case 'select':
          await adapter.select(action.selector, action.values);
          result = { selected: action.values, selector: action.selector };
          break;

        case 'upload':
          // Upload is not directly supported by our adapter yet
          // This would require additional implementation
          throw new Error('Upload action is not yet implemented');

        default:
          const errorResult = this.createErrorResult(
            action,
            'UNKNOWN_ERROR',
            `Unknown action type: ${(action as any).type}`,
            startTime,
            timestamp
          );
          
          // Log error and record metrics
          logger.logAction(action, errorResult, activeBrowser.id, activeBrowser.profile.name);
          metrics.recordAction(action, errorResult);
          
          return errorResult;
      }

      const executionTime = Date.now() - startTime;

      const successResult: ActionResult = {
        success: true,
        action,
        result,
        executionTime,
        timestamp,
      };

      // Log successful action and record metrics
      logger.logAction(action, successResult, activeBrowser.id, activeBrowser.profile.name);
      metrics.recordAction(action, successResult);

      return successResult;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      // Determine error code based on error message
      let errorCode: ErrorCode = 'UNKNOWN_ERROR';
      const errorMessage = error.message || String(error);

      if (errorMessage.includes('Timeout') || errorMessage.includes('timeout')) {
        errorCode = 'TIMEOUT';
      } else if (errorMessage.includes('not found') || errorMessage.includes('No element')) {
        errorCode = 'ELEMENT_NOT_FOUND';
      } else if (errorMessage.includes('Navigation') || errorMessage.includes('navigation')) {
        errorCode = 'NAVIGATION_FAILED';
      } else if (errorMessage.includes('selector')) {
        errorCode = 'INVALID_SELECTOR';
      } else if (errorMessage.includes('Script') || errorMessage.includes('evaluate')) {
        errorCode = 'SCRIPT_ERROR';
      } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
        errorCode = 'NETWORK_ERROR';
      }

      const errorResult: ActionResult = {
        success: false,
        action,
        error: {
          code: errorCode,
          message: errorMessage,
          details: error.stack,
          stack: error.stack,
        },
        executionTime,
        timestamp,
      };

      // Get active browser for logging context
      const activeBrowser = this.getActiveBrowser();

      // Log error and record metrics
      logger.logAction(action, errorResult, activeBrowser?.id, activeBrowser?.profile.name);
      logger.logError(error, { action: action.type, errorCode }, activeBrowser?.id, activeBrowser?.profile.name);
      metrics.recordAction(action, errorResult);

      return errorResult;
    }
  }

  /**
   * Execute a wait action
   * @param adapter Playwright adapter
   * @param action Wait action
   */
  private async executeWaitAction(adapter: PlaywrightAdapter, action: any): Promise<void> {
    switch (action.condition) {
      case 'selector':
        if (!action.selector) {
          throw new Error('Selector is required for wait condition "selector"');
        }
        await adapter.waitForSelector(action.selector, {
          state: action.state,
          timeout: action.timeout,
        });
        break;

      case 'navigation':
        await adapter.waitForNavigation({
          timeout: action.timeout,
        });
        break;

      case 'load_state':
        if (!action.loadState) {
          throw new Error('loadState is required for wait condition "load_state"');
        }
        await adapter.waitForLoadState(action.loadState);
        break;

      case 'timeout':
        if (!action.timeout) {
          throw new Error('timeout is required for wait condition "timeout"');
        }
        await new Promise(resolve => setTimeout(resolve, action.timeout));
        break;

      default:
        throw new Error(`Unknown wait condition: ${action.condition}`);
    }
  }

  /**
   * Validate action parameters
   * @param action Browser action to validate
   * @returns Error message if validation fails, null otherwise
   */
  private validateAction(action: BrowserAction): string | null {
    switch (action.type) {
      case 'navigate':
        if (!action.url) {
          return 'URL is required for navigate action';
        }
        if (!action.url.startsWith('http://') && !action.url.startsWith('https://')) {
          return 'URL must start with http:// or https://';
        }
        break;

      case 'click':
      case 'select':
        if (!action.selector) {
          return `Selector is required for ${action.type} action`;
        }
        break;

      case 'type':
        if (!action.selector) {
          return 'Selector is required for type action';
        }
        if (action.text === undefined || action.text === null) {
          return 'Text is required for type action';
        }
        break;

      case 'execute_js':
        if (!action.script) {
          return 'Script is required for execute_js action';
        }
        break;

      case 'wait':
        if (!action.condition) {
          return 'Condition is required for wait action';
        }
        if (action.condition === 'selector' && !action.selector) {
          return 'Selector is required for wait condition "selector"';
        }
        if (action.condition === 'load_state' && !action.loadState) {
          return 'loadState is required for wait condition "load_state"';
        }
        break;

      case 'scroll':
        if (!action.target) {
          return 'Target is required for scroll action';
        }
        if (action.target === 'element' && !action.selector) {
          return 'Selector is required for scroll target "element"';
        }
        if (action.target === 'coordinates' && (action.x === undefined || action.y === undefined)) {
          return 'x and y coordinates are required for scroll target "coordinates"';
        }
        break;

      case 'select':
        if (!action.values || action.values.length === 0) {
          return 'Values are required for select action';
        }
        break;

      case 'upload':
        if (!action.selector) {
          return 'Selector is required for upload action';
        }
        if (!action.filePaths || action.filePaths.length === 0) {
          return 'File paths are required for upload action';
        }
        break;
    }

    return null;
  }

  /**
   * Create an error result
   * @param action The action that failed
   * @param code Error code
   * @param message Error message
   * @param startTime Start time of the action
   * @param timestamp Timestamp of the action
   * @returns Action result with error
   */
  private createErrorResult(
    action: BrowserAction,
    code: ErrorCode,
    message: string,
    startTime: number,
    timestamp: number
  ): ActionResult {
    return {
      success: false,
      action,
      error: {
        code,
        message,
      },
      executionTime: Date.now() - startTime,
      timestamp,
    };
  }

  /**
   * Start the idle timeout checker
   * Runs every 30 seconds to check for idle browsers and close them
   */
  private startIdleTimeoutChecker(): void {
    if (this.idleCheckInterval) {
      return; // Already running
    }

    this.idleCheckInterval = setInterval(() => {
      this.checkIdleBrowsers();
    }, this.IDLE_CHECK_INTERVAL_MS);
  }

  /**
   * Stop the idle timeout checker
   */
  private stopIdleTimeoutChecker(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  /**
   * Check for idle browsers and close them
   * A browser is considered idle if it hasn't been used for longer than the configured timeout
   */
  private checkIdleBrowsers(): void {
    const now = Date.now();
    const browsersToClose: string[] = [];

    for (const [browserId, browser] of this.browsers.entries()) {
      const idleTime = now - browser.lastUsedAt;
      
      if (idleTime > this.idleTimeoutMs) {
        browsersToClose.push(browserId);
        this.emit('browser-idle-timeout', {
          browserId,
          profile: browser.profile.name,
          idleTime,
        });
      }
    }

    // Close idle browsers
    for (const browserId of browsersToClose) {
      this.closeBrowser(browserId).catch((error) => {
        console.error(`Error closing idle browser ${browserId}:`, error);
      });
    }
  }

  /**
   * Ensure a browser is available for the given profile
   * If no browser exists or the active browser was closed due to idle timeout,
   * launch a new browser instance
   * @param profileName Profile name (optional, uses current profile if not specified)
   * @returns Browser instance
   */
  private async ensureBrowserAvailable(profileName?: string): Promise<Browser> {
    // If we have an active browser and no specific profile is requested, use it
    if (!profileName && this.activeBrowserId) {
      const browser = this.browsers.get(this.activeBrowserId);
      if (browser) {
        return browser;
      }
    }

    // Determine which profile to use
    let profile: BrowserProfile | null = null;
    
    if (profileName) {
      profile = this.profileManager.getProfile(profileName);
      if (!profile) {
        throw new Error(`Profile "${profileName}" not found`);
      }
    } else {
      // Try to get the default profile, or use the first available profile
      try {
        const defaultProfile = this.profileManager.getDefaultProfile();
        profile = defaultProfile;
      } catch (error) {
        // If no default profile, use the first available profile
        const profiles = this.profileManager.listProfiles();
        if (profiles.length === 0) {
          throw new Error('No browser profiles available');
        }
        profile = profiles[0];
      }
    }

    // Launch a new browser with the profile
    const browser = await this.launchBrowser(profile);
    this.activeBrowserId = browser.id;
    
    this.emit('browser-restarted-after-idle', {
      browserId: browser.id,
      profile: profile.name,
    });

    return browser;
  }

  /**
   * Set up network interruption detection and automatic reconnection for remote browsers
   * Monitors connection status and attempts reconnection with exponential backoff
   * @param browserId Browser ID
   * @param remoteConnector Remote browser connector instance
   * @param profile Browser profile
   */
  private setupRemoteNetworkInterruptionHandling(
    browserId: string,
    remoteConnector: RemoteBrowserConnector,
    profile: BrowserProfile
  ): void {
    // The RemoteBrowserConnector already handles automatic reconnection internally
    // We just need to monitor the connection status and emit events

    // Check connection status periodically
    const checkInterval = setInterval(() => {
      const browser = this.browsers.get(browserId);
      if (!browser) {
        // Browser was cleaned up, stop checking
        clearInterval(checkInterval);
        return;
      }

      if (!remoteConnector.isConnected()) {
        // Connection lost, emit event
        this.emit('remote-connection-lost', {
          browserId,
          profile: profile.name,
          reconnectAttempts: remoteConnector.getReconnectAttempts(),
          timestamp: Date.now(),
        });

        // If max reconnection attempts reached, clean up the browser
        if (remoteConnector.getReconnectAttempts() >= 5) {
          console.error(
            `Remote browser ${browserId} failed to reconnect after maximum attempts. Cleaning up.`
          );
          
          clearInterval(checkInterval);
          
          this.emit('remote-reconnection-failed', {
            browserId,
            profile: profile.name,
            timestamp: Date.now(),
          });

          // Clean up the browser
          this.closeBrowser(browserId).catch((error) => {
            console.error(`Error closing remote browser ${browserId} after reconnection failure:`, error);
          });
        }
      } else if (remoteConnector.getReconnectAttempts() > 0) {
        // Connection restored after interruption
        this.emit('remote-connection-restored', {
          browserId,
          profile: profile.name,
          timestamp: Date.now(),
        });
      }
    }, 5000); // Check every 5 seconds

    // Store the interval so we can clean it up later
    // We'll use a WeakMap or store it in the browser object metadata
    // For simplicity, we'll just let it run until the browser is closed
  }

  /**
   * Set up crash detection for a browser instance
   * Monitors CDP disconnection events and triggers automatic recovery
   * @param browserId Browser ID
   * @param cdpClient CDP client instance
   * @param profile Browser profile
   */
  private setupCrashDetection(browserId: string, cdpClient: CDPClient, profile: BrowserProfile): void {
    // Listen for CDP disconnection events
    cdpClient.on('disconnected', async (info: { code: number; reason: string }) => {
      const browser = this.browsers.get(browserId);
      if (!browser) {
        // Browser was already cleaned up, no need to recover
        return;
      }

      // Log the crash event
      const crashInfo = {
        browserId,
        profile: profile.name,
        code: info.code,
        reason: info.reason,
        timestamp: Date.now(),
      };

      console.error(`Browser crash detected for ${browserId} (${profile.name}):`, crashInfo);
      
      // Emit crash event for user notification
      this.emit('browser-crashed', crashInfo);

      // Attempt automatic recovery
      await this.attemptCrashRecovery(browserId, profile);
    });

    // Listen for CDP errors
    cdpClient.on('error', (error: Error) => {
      console.error(`CDP error for browser ${browserId}:`, error);
      this.emit('browser-cdp-error', {
        browserId,
        profile: profile.name,
        error: error.message,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Attempt to recover from a browser crash
   * Implements exponential backoff with a maximum number of attempts
   * @param browserId Browser ID that crashed
   * @param profile Browser profile to restart
   */
  private async attemptCrashRecovery(browserId: string, profile: BrowserProfile): Promise<void> {
    // Get current attempt count
    const attempts = this.crashRecoveryAttempts.get(browserId) || 0;

    // Check if we've exceeded max attempts
    if (attempts >= this.MAX_CRASH_RECOVERY_ATTEMPTS) {
      console.error(
        `Max crash recovery attempts (${this.MAX_CRASH_RECOVERY_ATTEMPTS}) reached for browser ${browserId}. Giving up.`
      );
      
      this.emit('browser-recovery-failed', {
        browserId,
        profile: profile.name,
        attempts,
        timestamp: Date.now(),
      });

      // Clean up the crashed browser
      try {
        await this.cleanupCrashedBrowser(browserId);
      } catch (error) {
        console.error(`Error cleaning up crashed browser ${browserId}:`, error);
      }

      return;
    }

    // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const delay = Math.min(
      this.CRASH_RECOVERY_BACKOFF_BASE * Math.pow(2, attempts),
      this.CRASH_RECOVERY_MAX_DELAY
    );

    // Increment attempt count
    this.crashRecoveryAttempts.set(browserId, attempts + 1);

    console.log(
      `Attempting crash recovery for browser ${browserId} (attempt ${attempts + 1}/${this.MAX_CRASH_RECOVERY_ATTEMPTS}) after ${delay}ms delay...`
    );

    this.emit('browser-recovery-attempt', {
      browserId,
      profile: profile.name,
      attempt: attempts + 1,
      maxAttempts: this.MAX_CRASH_RECOVERY_ATTEMPTS,
      delay,
      timestamp: Date.now(),
    });

    // Wait for backoff delay
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Clean up the crashed browser first
      await this.cleanupCrashedBrowser(browserId);

      // Launch a new browser with the same profile
      const newBrowser = await this.launchBrowser(profile);

      // If the crashed browser was the active one, set the new browser as active
      if (this.activeBrowserId === browserId || this.activeBrowserId === null) {
        this.activeBrowserId = newBrowser.id;
      }

      console.log(
        `Successfully recovered from crash. New browser ${newBrowser.id} launched for profile ${profile.name}`
      );

      this.emit('browser-recovery-success', {
        oldBrowserId: browserId,
        newBrowserId: newBrowser.id,
        profile: profile.name,
        attempt: attempts + 1,
        timestamp: Date.now(),
      });

      // Reset crash recovery attempts for the old browser ID
      this.crashRecoveryAttempts.delete(browserId);

    } catch (error) {
      console.error(`Crash recovery attempt ${attempts + 1} failed for browser ${browserId}:`, error);

      this.emit('browser-recovery-attempt-failed', {
        browserId,
        profile: profile.name,
        attempt: attempts + 1,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });

      // Retry with next attempt (will be triggered by the next disconnection or manually)
      // For now, we just log the failure. The next action attempt will trigger ensureBrowserAvailable
    }
  }

  /**
   * Set up tab closure detection for extension-controlled tabs
   * Monitors tab closure events and handles cleanup
   * @param browserId Browser ID
   * @param relayClient Extension relay client instance
   * @param tabId Tab ID being controlled
   */
  private setupExtensionTabClosureDetection(
    browserId: string,
    relayClient: ExtensionRelayClient,
    tabId: number
  ): void {
    // Listen for tab closed events
    relayClient.on('tab-closed', async (info: { tabId: number }) => {
      if (info.tabId !== tabId) {
        return; // Not our tab
      }

      const browser = this.browsers.get(browserId);
      if (!browser) {
        return; // Browser already cleaned up
      }

      // Log the tab closure event
      const closureInfo = {
        browserId,
        profile: browser.profile.name,
        tabId: info.tabId,
        timestamp: Date.now(),
      };

      console.log(`Extension tab ${tabId} was closed for browser ${browserId}`);
      
      // Emit tab closure event for user notification
      this.emit('extension-tab-closed', closureInfo);

      // Clean up the browser instance since the tab is no longer available
      try {
        await this.closeBrowser(browserId);
      } catch (error) {
        console.error(`Error closing browser after tab closure for ${browserId}:`, error);
      }
    });

    // Listen for relay disconnection
    relayClient.on('disconnected', async (info: { code: number; reason: string }) => {
      const browser = this.browsers.get(browserId);
      if (!browser) {
        return; // Browser already cleaned up
      }

      console.log(`Extension relay disconnected for browser ${browserId}:`, info);
      
      this.emit('extension-relay-disconnected', {
        browserId,
        profile: browser.profile.name,
        code: info.code,
        reason: info.reason,
        timestamp: Date.now(),
      });

      // Clean up the browser instance
      try {
        await this.closeBrowser(browserId);
      } catch (error) {
        console.error(`Error closing browser after relay disconnection for ${browserId}:`, error);
      }
    });
  }

  /**
   * Clean up a crashed browser instance
   * Removes the browser from tracking without attempting graceful shutdown
   * @param browserId Browser ID to clean up
   */
  private async cleanupCrashedBrowser(browserId: string): Promise<void> {
    const browser = this.browsers.get(browserId);
    if (!browser) {
      return; // Already cleaned up
    }

    try {
      // Try to close Playwright adapter (may fail if already crashed)
      const playwrightAdapter = browser.playwrightBrowser as PlaywrightAdapter;
      if (playwrightAdapter) {
        try {
          await playwrightAdapter.close();
        } catch (error) {
          // Ignore errors during cleanup of crashed browser
          console.debug(`Error closing Playwright adapter during crash cleanup:`, error);
        }
      }

      // Try to disconnect CDP client (may already be disconnected)
      const cdpClient = this.cdpClients.get(browserId);
      if (cdpClient) {
        try {
          await cdpClient.disconnect();
        } catch (error) {
          // Ignore errors during cleanup
          console.debug(`Error disconnecting CDP client during crash cleanup:`, error);
        }
        this.cdpClients.delete(browserId);
      }

      // Try to disconnect extension relay client (if present)
      const relayClient = this.extensionRelayClients.get(browserId);
      if (relayClient) {
        try {
          await relayClient.disconnect();
        } catch (error) {
          // Ignore errors during cleanup
          console.debug(`Error disconnecting extension relay during crash cleanup:`, error);
        }
        this.extensionRelayClients.delete(browserId);
      }

      // Try to disconnect remote browser connector (if present)
      const remoteConnector = this.remoteBrowserConnectors.get(browserId);
      if (remoteConnector) {
        try {
          remoteConnector.disconnect();
        } catch (error) {
          // Ignore errors during cleanup
          console.debug(`Error disconnecting remote browser connector during crash cleanup:`, error);
        }
        this.remoteBrowserConnectors.delete(browserId);
      }

      // Try to kill Chrome process (may already be dead)
      const chrome = this.chromeInstances.get(browserId);
      if (chrome) {
        try {
          await chrome.kill();
        } catch (error) {
          // Ignore errors during cleanup
          console.debug(`Error killing Chrome process during crash cleanup:`, error);
        }
        this.chromeInstances.delete(browserId);
      }

      // Remove from active browser if this was the active one
      if (this.activeBrowserId === browserId) {
        this.activeBrowserId = null;
      }

      // Remove browser instance
      this.browsers.delete(browserId);

      console.log(`Cleaned up crashed browser ${browserId}`);

    } catch (error) {
      console.error(`Error during crashed browser cleanup for ${browserId}:`, error);
      // Force cleanup even if errors occurred
      this.browsers.delete(browserId);
      this.cdpClients.delete(browserId);
      this.extensionRelayClients.delete(browserId);
      this.remoteBrowserConnectors.delete(browserId);
      this.chromeInstances.delete(browserId);
      if (this.activeBrowserId === browserId) {
        this.activeBrowserId = null;
      }
    }
  }

  /**
   * Discover available tabs from extension relay
   * Only works when using chrome-extension profile
   * @returns List of available tabs
   */
  async discoverExtensionTabs(): Promise<ExtensionTab[]> {
    const activeBrowser = this.getActiveBrowser();
    if (!activeBrowser) {
      throw new Error('No active browser. Launch a browser first.');
    }

    if (activeBrowser.profile.type !== 'chrome-extension') {
      throw new Error('Tab discovery is only available for chrome-extension profile');
    }

    const relayClient = this.extensionRelayClients.get(activeBrowser.id);
    if (!relayClient) {
      throw new Error('Extension relay client not found for active browser');
    }

    return relayClient.discoverTabs();
  }

  /**
   * Switch to a different tab in the extension
   * Only works when using chrome-extension profile
   * @param tabId Tab ID to switch to
   */
  async switchExtensionTab(tabId: number): Promise<void> {
    const activeBrowser = this.getActiveBrowser();
    if (!activeBrowser) {
      throw new Error('No active browser. Launch a browser first.');
    }

    if (activeBrowser.profile.type !== 'chrome-extension') {
      throw new Error('Tab switching is only available for chrome-extension profile');
    }

    const relayClient = this.extensionRelayClients.get(activeBrowser.id);
    if (!relayClient) {
      throw new Error('Extension relay client not found for active browser');
    }

    // Disconnect from current tab
    const currentTabId = relayClient.getConnectedTabId();
    if (currentTabId !== null) {
      await relayClient.disconnectTab(currentTabId);
    }

    // Connect to new tab
    const wsEndpoint = await relayClient.connectTab(tabId);

    // Reconnect CDP client and Playwright adapter
    const cdpClient = this.cdpClients.get(activeBrowser.id);
    if (cdpClient) {
      await cdpClient.disconnect();
      await cdpClient.connect(wsEndpoint);
    }

    const playwrightAdapter = activeBrowser.playwrightBrowser as PlaywrightAdapter;
    if (playwrightAdapter) {
      await playwrightAdapter.close();
      await playwrightAdapter.initialize(wsEndpoint);
    }

    // Update browser CDP endpoint
    activeBrowser.cdpEndpoint = wsEndpoint;
    activeBrowser.lastUsedAt = Date.now();

    this.emit('extension-tab-switched', {
      browserId: activeBrowser.id,
      fromTabId: currentTabId,
      toTabId: tabId,
    });
  }
}
