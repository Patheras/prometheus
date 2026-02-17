/**
 * Browser Automation Module
 * 
 * Main entry point for the browser automation system.
 * Provides browser control capabilities via CDP and Playwright.
 */

// Export types
export * from './types/index.js';

// Export configuration
export * from './config/index.js';

// Export CDP Client
export { CDPClient } from './cdp-client.js';

// Export Playwright Adapter
export { PlaywrightAdapter } from './playwright-adapter.js';

// Export State Manager
export { StateManager } from './state-manager.js';

// Export Profile Manager
export { ProfileManager } from './profile-manager.js';

// Export Browser Manager
export { BrowserManager } from './browser-manager.js';

// Export Extension Relay Client
export { ExtensionRelayClient, ExtensionTab } from './extension-relay-client.js';

// Export Control Server
export { ControlServer } from './control-server.js';

// Export Tool Adapters
export * from './tool-adapters/index.js';

// Export Browser Automation System (main integration point)
export { BrowserAutomationSystem } from './browser-automation-system.js';

// Export initialization functions
export {
  initializeBrowserAutomation,
  getBrowserAutomationSystem,
  isBrowserAutomationInitialized,
  shutdownBrowserAutomation,
  quickStart,
} from './init.js';

// Export shutdown functions
export {
  gracefulShutdown,
  registerShutdownHandlers,
} from './shutdown.js';

// Version
export const VERSION = '0.1.0';
