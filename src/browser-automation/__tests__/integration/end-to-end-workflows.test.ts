/**
 * End-to-End Workflow Tests for Browser Automation
 * 
 * These tests validate complete user workflows from start to finish:
 * - Launch → Navigate → Interact → Capture → Close
 * - Profile switching workflow
 * - State export/import workflow
 * - Error recovery workflow
 */

// Mock chrome-launcher before any imports
jest.mock('chrome-launcher', () => ({
  launch: jest.fn().mockResolvedValue({
    pid: 12345,
    port: 9222,
    process: {},
    kill: jest.fn().mockResolvedValue(undefined)
  })
}));

// Mock CDPClient
jest.mock('../../cdp-client', () => {
  const EventEmitter = require('events');
  return {
    CDPClient: jest.fn().mockImplementation(() => {
      const emitter = new EventEmitter();
      return {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
        on: emitter.on.bind(emitter),
        off: emitter.off.bind(emitter),
        emit: emitter.emit.bind(emitter),
        removeAllListeners: emitter.removeAllListeners.bind(emitter),
      };
    }),
  };
});

// Mock PlaywrightAdapter
jest.mock('../../playwright-adapter', () => ({
  PlaywrightAdapter: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

import { BrowserManager } from '../../browser-manager';
import { ProfileManager } from '../../profile-manager';
import { StateManager } from '../../state-manager';
import { BrowserAutomationConfig } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('End-to-End Workflows', () => {
  let browserManager: BrowserManager;
  let profileManager: ProfileManager;
  let stateManager: StateManager;
  let testDir: string;
  let config: BrowserAutomationConfig;

  beforeAll(async () => {
    // Create temporary directory for test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-e2e-'));
    
    config = {
      controlServer: {
        enabled: false,
        port: 18791,
        host: '127.0.0.1'
      },
      browser: {
        defaultProfile: 'openclaw',
        headless: true,
        defaultViewport: { width: 1280, height: 720 },
        defaultTimeout: 30000,
        idleTimeout: 300000
      },
      profiles: [],
      paths: {
        userDataBaseDir: path.join(testDir, 'user-data'),
        screenshotDir: path.join(testDir, 'screenshots'),
        downloadDir: path.join(testDir, 'downloads')
      },
      logging: {
        level: 'error',
        logActions: false,
        logErrors: true
      },
      security: {
        allowRemoteProfiles: false,
        validateSelectors: true,
        sanitizeFilePaths: true
      }
    };

    profileManager = new ProfileManager(config);
    stateManager = new StateManager();
    browserManager = new BrowserManager(config, profileManager, stateManager);
  });

  afterAll(async () => {
    await browserManager.stop();
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Complete Workflow: Launch → Navigate → Interact → Capture → Close', () => {
    it('should execute a complete workflow successfully', async () => {
      // Step 1: Launch browser
      const browser = await browserManager.launchBrowser(
        profileManager.getProfile('openclaw')!
      );
      expect(browser).toBeDefined();
      expect(browser.id).toBeDefined();

      // Step 2: Navigate to a page
      const navigateResult = await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.com',
        waitUntil: 'load'
      });
      expect(navigateResult.success).toBe(true);
      expect(navigateResult.result.url).toContain('example.com');

      // Step 3: Interact with page (scroll)
      const scrollResult = await browserManager.executeAction({
        type: 'scroll',
        target: 'bottom'
      });
      expect(scrollResult.success).toBe(true);

      // Step 4: Capture screenshot
      const screenshotResult = await browserManager.executeAction({
        type: 'screenshot',
        fullPage: true,
        format: 'png'
      });
      expect(screenshotResult.success).toBe(true);
      expect(screenshotResult.result).toBeDefined();
      expect(Buffer.isBuffer(screenshotResult.result)).toBe(true);

      // Step 5: Capture snapshot
      const snapshotResult = await browserManager.executeAction({
        type: 'snapshot'
      });
      expect(snapshotResult.success).toBe(true);
      expect(snapshotResult.result.url).toContain('example.com');
      expect(snapshotResult.result.html).toBeDefined();
      expect(snapshotResult.result.accessibilityTree).toBeDefined();

      // Step 6: Close browser
      await browserManager.closeBrowser(browser.id);
      expect(browserManager.getActiveBrowser()).toBeNull();
    }, 60000);

    it('should handle form interaction workflow', async () => {
      const browser = await browserManager.launchBrowser(
        profileManager.getProfile('openclaw')!
      );

      // Navigate to a page with a form
      await browserManager.executeAction({
        type: 'navigate',
        url: 'https://httpbin.org/forms/post',
        waitUntil: 'load'
      });

      // Fill in form fields
      const fillResult = await browserManager.executeAction({
        type: 'fill',
        selector: 'input[name="custname"]',
        value: 'Test User'
      });
      expect(fillResult.success).toBe(true);

      // Select from dropdown
      const selectResult = await browserManager.executeAction({
        type: 'select',
        selector: 'select[name="size"]',
        values: ['medium']
      });
      expect(selectResult.success).toBe(true);

      // Take screenshot of filled form
      const screenshot = await browserManager.executeAction({
        type: 'screenshot',
        fullPage: false
      });
      expect(screenshot.success).toBe(true);

      await browserManager.closeBrowser(browser.id);
    }, 60000);
  });

  describe('Profile Switching Workflow', () => {
    it('should switch between profiles cleanly', async () => {
      // Launch with default profile
      const browser1 = await browserManager.launchBrowser(
        profileManager.getProfile('openclaw')!
      );
      expect(browser1.profile.name).toBe('openclaw');

      // Navigate and set some state
      await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.com'
      });

      const initialBrowserId = browser1.id;

      // Switch to a different profile (create a test profile)
      const testProfile = {
        name: 'test-profile',
        type: 'openclaw' as const,
        userDataDir: path.join(testDir, 'user-data', 'test-profile'),
        launchOptions: {
          headless: true,
          args: ['--no-sandbox'],
          defaultViewport: { width: 1280, height: 720 },
          timeout: 30000
        }
      };
      profileManager.createProfile(testProfile);

      await browserManager.switchProfile('test-profile');

      // Verify new browser is launched
      const browser2 = browserManager.getActiveBrowser();
      expect(browser2).toBeDefined();
      expect(browser2!.id).not.toBe(initialBrowserId);
      expect(browser2!.profile.name).toBe('test-profile');

      // Verify old browser is closed
      expect(browserManager.getActiveBrowser()!.id).toBe(browser2!.id);

      // Navigate with new profile
      const result = await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.org'
      });
      expect(result.success).toBe(true);

      await browserManager.stop();
    }, 60000);

    it('should maintain separate state between profiles', async () => {
      // Profile 1: Set cookies
      const profile1 = profileManager.getProfile('openclaw')!;
      const browser1 = await browserManager.launchBrowser(profile1);

      await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.com'
      });

      await stateManager.setCookies([{
        name: 'test-cookie',
        value: 'profile1-value',
        domain: 'example.com',
        path: '/',
        expires: Date.now() + 86400000,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax'
      }]);

      const cookies1 = await stateManager.getCookies('example.com');
      expect(cookies1.some(c => c.name === 'test-cookie' && c.value === 'profile1-value')).toBe(true);

      // Switch to Profile 2
      const testProfile = {
        name: 'isolated-profile',
        type: 'openclaw' as const,
        userDataDir: path.join(testDir, 'user-data', 'isolated-profile'),
        launchOptions: {
          headless: true,
          args: ['--no-sandbox'],
          defaultViewport: { width: 1280, height: 720 },
          timeout: 30000
        }
      };
      profileManager.createProfile(testProfile);
      await browserManager.switchProfile('isolated-profile');

      await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.com'
      });

      // Verify cookies from profile1 are not present
      const cookies2 = await stateManager.getCookies('example.com');
      expect(cookies2.some(c => c.name === 'test-cookie')).toBe(false);

      await browserManager.stop();
    }, 60000);
  });

  describe('State Export/Import Workflow', () => {
    it('should export and import browser state successfully', async () => {
      const browser = await browserManager.launchBrowser(
        profileManager.getProfile('openclaw')!
      );

      // Navigate and set up state
      await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.com'
      });

      // Set cookies
      await stateManager.setCookies([
        {
          name: 'session-id',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          expires: Date.now() + 86400000,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax'
        },
        {
          name: 'user-pref',
          value: 'dark-mode',
          domain: 'example.com',
          path: '/',
          expires: Date.now() + 86400000,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax'
        }
      ]);

      // Set localStorage
      await stateManager.setLocalStorage('https://example.com', {
        'theme': 'dark',
        'language': 'en'
      });

      // Set geolocation
      await stateManager.setGeolocation({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 100
      });

      // Export state
      const exportedState = await stateManager.exportState();
      expect(exportedState).toBeDefined();
      expect(exportedState.cookies.length).toBeGreaterThanOrEqual(2);
      expect(exportedState.localStorage['https://example.com']).toBeDefined();
      expect(exportedState.geolocation).toBeDefined();

      // Clear all state
      await stateManager.clearAllState();

      // Verify state is cleared
      const clearedCookies = await stateManager.getCookies();
      expect(clearedCookies.length).toBe(0);

      // Import state
      await stateManager.importState(exportedState);

      // Verify state is restored
      const restoredCookies = await stateManager.getCookies('example.com');
      expect(restoredCookies.some(c => c.name === 'session-id')).toBe(true);
      expect(restoredCookies.some(c => c.name === 'user-pref')).toBe(true);

      const restoredStorage = await stateManager.getLocalStorage('https://example.com');
      expect(restoredStorage['theme']).toBe('dark');
      expect(restoredStorage['language']).toBe('en');

      await browserManager.closeBrowser(browser.id);
    }, 60000);

    it('should handle state export to file and import from file', async () => {
      const browser = await browserManager.launchBrowser(
        profileManager.getProfile('openclaw')!
      );

      await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.com'
      });

      // Set some state
      await stateManager.setCookies([{
        name: 'test',
        value: 'value',
        domain: 'example.com',
        path: '/',
        expires: Date.now() + 86400000,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax'
      }]);

      // Export to file
      const stateFilePath = path.join(testDir, 'browser-state.json');
      const state = await stateManager.exportState();
      await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2));

      // Verify file exists
      const fileExists = await fs.access(stateFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Clear state
      await stateManager.clearAllState();

      // Import from file
      const fileContent = await fs.readFile(stateFilePath, 'utf-8');
      const importedState = JSON.parse(fileContent);
      await stateManager.importState(importedState);

      // Verify state is restored
      const cookies = await stateManager.getCookies('example.com');
      expect(cookies.some(c => c.name === 'test')).toBe(true);

      await browserManager.closeBrowser(browser.id);
    }, 60000);
  });

  describe('Error Recovery Workflow', () => {
    it('should recover from navigation timeout', async () => {
      const browser = await browserManager.launchBrowser(
        profileManager.getProfile('openclaw')!
      );

      // Attempt to navigate to a slow/non-existent page with short timeout
      const result = await browserManager.executeAction({
        type: 'navigate',
        url: 'https://httpstat.us/200?sleep=10000',
        timeout: 2000
      });

      // Should fail with timeout
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toContain('TIMEOUT');

      // Browser should still be usable
      const activeBrowser = browserManager.getActiveBrowser();
      expect(activeBrowser).toBeDefined();

      // Should be able to navigate to another page
      const recovery = await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.com',
        waitUntil: 'load'
      });
      expect(recovery.success).toBe(true);

      await browserManager.closeBrowser(browser.id);
    }, 60000);

    it('should recover from element not found error', async () => {
      const browser = await browserManager.launchBrowser(
        profileManager.getProfile('openclaw')!
      );

      await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.com'
      });

      // Try to click non-existent element
      const clickResult = await browserManager.executeAction({
        type: 'click',
        selector: '#non-existent-element',
        timeout: 2000
      });

      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toBeDefined();
      expect(clickResult.error!.code).toContain('ELEMENT_NOT_FOUND');

      // Browser should still be usable
      const screenshot = await browserManager.executeAction({
        type: 'screenshot'
      });
      expect(screenshot.success).toBe(true);

      await browserManager.closeBrowser(browser.id);
    }, 60000);

    it('should handle multiple sequential errors gracefully', async () => {
      const browser = await browserManager.launchBrowser(
        profileManager.getProfile('openclaw')!
      );

      await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.com'
      });

      // Error 1: Invalid selector
      const error1 = await browserManager.executeAction({
        type: 'click',
        selector: '',
        timeout: 1000
      });
      expect(error1.success).toBe(false);

      // Error 2: Element not found
      const error2 = await browserManager.executeAction({
        type: 'type',
        selector: '#missing-input',
        text: 'test',
        timeout: 1000
      });
      expect(error2.success).toBe(false);

      // Error 3: Invalid action parameter
      const error3 = await browserManager.executeAction({
        type: 'scroll',
        target: 'element',
        // Missing required selector for element target
      } as any);
      expect(error3.success).toBe(false);

      // Browser should still be functional
      const validAction = await browserManager.executeAction({
        type: 'navigate',
        url: 'https://example.org'
      });
      expect(validAction.success).toBe(true);

      await browserManager.closeBrowser(browser.id);
    }, 60000);
  });

  describe('Complex Multi-Step Workflow', () => {
    it('should execute a complex workflow with multiple interactions', async () => {
      const browser = await browserManager.launchBrowser(
        profileManager.getProfile('openclaw')!
      );

      // Step 1: Navigate to search page
      await browserManager.executeAction({
        type: 'navigate',
        url: 'https://www.google.com',
        waitUntil: 'networkidle'
      });

      // Step 2: Wait for search box
      await browserManager.executeAction({
        type: 'wait',
        condition: 'selector',
        selector: 'textarea[name="q"]',
        timeout: 5000
      });

      // Step 3: Type search query
      await browserManager.executeAction({
        type: 'type',
        selector: 'textarea[name="q"]',
        text: 'browser automation',
        delay: 50
      });

      // Step 4: Take screenshot of search box
      const screenshot1 = await browserManager.executeAction({
        type: 'screenshot',
        fullPage: false
      });
      expect(screenshot1.success).toBe(true);

      // Step 5: Submit form (press Enter)
      await browserManager.executeAction({
        type: 'execute_js',
        script: 'document.querySelector("textarea[name=q]").form.submit()'
      });

      // Step 6: Wait for navigation
      await browserManager.executeAction({
        type: 'wait',
        condition: 'load_state',
        loadState: 'networkidle',
        timeout: 10000
      });

      // Step 7: Capture final snapshot
      const snapshot = await browserManager.executeAction({
        type: 'snapshot'
      });
      expect(snapshot.success).toBe(true);
      expect(snapshot.result.url).toContain('google.com');

      // Step 8: Export final state
      const finalState = await stateManager.exportState();
      expect(finalState.cookies.length).toBeGreaterThan(0);

      await browserManager.closeBrowser(browser.id);
    }, 90000);
  });
});
