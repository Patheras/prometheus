/**
 * Tool Execution Engine Integration Tests
 * 
 * Tests that validate browser tools work correctly through
 * the Tool Execution Engine, simulating real LLM function calling.
 * 
 * Validates: Requirement 10.12 - Tool execution through Tool Execution Engine
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
import {
  BrowserNavigateTool,
  BrowserClickTool,
  BrowserScreenshotTool,
  BrowserSnapshotTool,
  BrowserExecuteJSTool,
  BrowserGetCookiesTool,
  BrowserSetCookiesTool
} from '../../tool-adapters';
import { BrowserAutomationConfig } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Tool Execution Engine Integration', () => {
  let browserManager: BrowserManager;
  let profileManager: ProfileManager;
  let stateManager: StateManager;
  let testDir: string;
  let config: BrowserAutomationConfig;

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-exec-'));
    
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
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Tool Schema Validation', () => {
    it('should have valid OpenAI function calling schema', () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      const schema = navigateTool.getSchema();
      
      expect(schema).toHaveProperty('name');
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('parameters');
      expect(schema.parameters).toHaveProperty('type', 'object');
      expect(schema.parameters).toHaveProperty('properties');
      expect(schema.parameters).toHaveProperty('required');
    });

    it('should have required parameters marked correctly', () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      const clickTool = new BrowserClickTool(browserManager);
      
      expect(navigateTool.getSchema().parameters.required).toContain('url');
      expect(clickTool.getSchema().parameters.required).toContain('selector');
    });
  });

  describe('Tool Parameter Validation', () => {
    beforeEach(async () => {
      await browserManager.launchBrowser(profileManager.getProfile('openclaw')!);
    });

    afterEach(async () => {
      const browser = browserManager.getActiveBrowser();
      if (browser) {
        await browserManager.closeBrowser(browser.id);
      }
    });

    it('should reject missing required parameters', async () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      const result = await navigateTool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('url');
    });

    it('should accept valid parameters', async () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      const result = await navigateTool.execute({
        url: 'https://example.com',
        waitUntil: 'load'
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('Tool Execution Workflow', () => {
    beforeEach(async () => {
      await browserManager.launchBrowser(profileManager.getProfile('openclaw')!);
    });

    afterEach(async () => {
      const browser = browserManager.getActiveBrowser();
      if (browser) {
        await browserManager.closeBrowser(browser.id);
      }
    });

    it('should execute navigation tool successfully', async () => {
      const tool = new BrowserNavigateTool(browserManager);
      const result = await tool.execute({
        url: 'https://example.com',
        waitUntil: 'load'
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.url).toContain('example.com');
    });

    it('should execute screenshot tool successfully', async () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      await navigateTool.execute({ url: 'https://example.com' });
      
      const screenshotTool = new BrowserScreenshotTool(browserManager);
      const result = await screenshotTool.execute({ fullPage: false });
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });

    it('should execute snapshot tool successfully', async () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      await navigateTool.execute({ url: 'https://example.com' });
      
      const snapshotTool = new BrowserSnapshotTool(browserManager);
      const result = await snapshotTool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.result.url).toBeDefined();
      expect(result.result.html).toBeDefined();
      expect(result.result.accessibilityTree).toBeDefined();
    });

    it('should execute JavaScript tool successfully', async () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      await navigateTool.execute({ url: 'https://example.com' });
      
      const jsTool = new BrowserExecuteJSTool(browserManager);
      const result = await jsTool.execute({
        script: 'return document.title'
      });
      
      expect(result.success).toBe(true);
      expect(typeof result.result).toBe('string');
    });

    it('should execute cookie tools successfully', async () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      await navigateTool.execute({ url: 'https://example.com' });
      
      // Set cookies
      const setCookiesTool = new BrowserSetCookiesTool(browserManager);
      const setResult = await setCookiesTool.execute({
        cookies: [{
          name: 'test-cookie',
          value: 'test-value',
          domain: 'example.com',
          path: '/',
          expires: Date.now() + 86400000,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax'
        }]
      });
      expect(setResult.success).toBe(true);
      
      // Get cookies
      const getCookiesTool = new BrowserGetCookiesTool(browserManager);
      const getResult = await getCookiesTool.execute({
        domain: 'example.com'
      });
      expect(getResult.success).toBe(true);
      expect(Array.isArray(getResult.result)).toBe(true);
    });
  });

  describe('Tool Error Handling', () => {
    beforeEach(async () => {
      await browserManager.launchBrowser(profileManager.getProfile('openclaw')!);
    });

    afterEach(async () => {
      const browser = browserManager.getActiveBrowser();
      if (browser) {
        await browserManager.closeBrowser(browser.id);
      }
    });

    it('should return structured error for element not found', async () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      await navigateTool.execute({ url: 'https://example.com' });
      
      const clickTool = new BrowserClickTool(browserManager);
      const result = await clickTool.execute({
        selector: '#non-existent-element',
        timeout: 2000
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBeDefined();
      expect(result.error!.message).toBeDefined();
    });

    it('should handle tool execution after error', async () => {
      const navigateTool = new BrowserNavigateTool(browserManager);
      await navigateTool.execute({ url: 'https://example.com' });
      
      // Fail to click
      const clickTool = new BrowserClickTool(browserManager);
      const clickResult = await clickTool.execute({
        selector: '#non-existent',
        timeout: 1000
      });
      expect(clickResult.success).toBe(false);
      
      // Should still work
      const screenshotTool = new BrowserScreenshotTool(browserManager);
      const screenshotResult = await screenshotTool.execute({});
      expect(screenshotResult.success).toBe(true);
    });
  });

  describe('Tool Execution Sequence', () => {
    beforeEach(async () => {
      await browserManager.launchBrowser(profileManager.getProfile('openclaw')!);
    });

    afterEach(async () => {
      const browser = browserManager.getActiveBrowser();
      if (browser) {
        await browserManager.closeBrowser(browser.id);
      }
    });

    it('should execute multiple tools in sequence', async () => {
      // 1. Navigate
      const navigateTool = new BrowserNavigateTool(browserManager);
      const nav = await navigateTool.execute({ url: 'https://example.com' });
      expect(nav.success).toBe(true);
      
      // 2. Execute JS
      const jsTool = new BrowserExecuteJSTool(browserManager);
      const js = await jsTool.execute({ script: 'return document.title' });
      expect(js.success).toBe(true);
      
      // 3. Screenshot
      const screenshotTool = new BrowserScreenshotTool(browserManager);
      const screenshot = await screenshotTool.execute({ fullPage: true });
      expect(screenshot.success).toBe(true);
      
      // 4. Snapshot
      const snapshotTool = new BrowserSnapshotTool(browserManager);
      const snapshot = await snapshotTool.execute({});
      expect(snapshot.success).toBe(true);
    });
  });
});
