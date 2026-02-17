/**
 * Unit tests for Browser Manager action execution routing
 * 
 * Tests the executeAction method with various action types,
 * validation, and error handling.
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

import { BrowserManager } from '../../browser-manager.js';
import { ProfileManager } from '../../profile-manager.js';
import { PlaywrightAdapter } from '../../playwright-adapter.js';
import { BrowserAction, NavigateAction, ClickAction, TypeAction } from '../../types/index.js';

describe('BrowserManager - Action Execution', () => {
  let browserManager: BrowserManager;
  let profileManager: ProfileManager;

  beforeEach(async () => {
    profileManager = new ProfileManager();
    browserManager = new BrowserManager(profileManager);
    await browserManager.start();
  });

  afterEach(async () => {
    await browserManager.stop();
  });

  describe('executeAction - validation', () => {
    it('should return error when no active browser', async () => {
      // Mock fetch to fail so browser launch fails
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));
      
      const action: NavigateAction = {
        type: 'navigate',
        url: 'https://example.com',
      };

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BROWSER_DISCONNECTED');
      expect(result.error?.message).toContain('Failed to ensure browser availability');
    });

    it('should validate navigate action requires URL', async () => {
      // Mock a browser without actually launching one
      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: {
          isInitialized: () => true,
        } as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore - accessing private property for testing
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore - accessing private property for testing
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'navigate',
        url: '',
      } as NavigateAction;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('URL is required');
    });

    it('should validate navigate action URL has protocol', async () => {
      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: {
          isInitialized: () => true,
        } as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action: NavigateAction = {
        type: 'navigate',
        url: 'example.com',
      };

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('must start with http');
    });

    it('should validate click action requires selector', async () => {
      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: {
          isInitialized: () => true,
        } as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'click',
        selector: '',
      } as ClickAction;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('Selector is required');
    });

    it('should validate type action requires text', async () => {
      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: {
          isInitialized: () => true,
        } as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'type',
        selector: 'input',
        text: undefined,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('Text is required');
    });

    it('should validate wait action with selector condition', async () => {
      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: {
          isInitialized: () => true,
        } as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'wait',
        condition: 'selector',
        selector: '',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('Selector is required');
    });

    it('should validate scroll action with element target', async () => {
      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: {
          isInitialized: () => true,
        } as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'scroll',
        target: 'element',
        selector: '',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('Selector is required');
    });
  });

  describe('executeAction - result formatting', () => {
    it('should return success result with execution time and timestamp', async () => {
      const mockAdapter = {
        isInitialized: () => true,
        navigate: jest.fn().mockResolvedValue({
          url: 'https://example.com',
          status: 200,
          title: 'Example',
          loadTime: 100,
        }),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action: NavigateAction = {
        type: 'navigate',
        url: 'https://example.com',
      };

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(true);
      expect(result.action).toEqual(action);
      expect(result.result).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should return error result with proper error structure', async () => {
      const mockAdapter = {
        isInitialized: () => true,
        click: jest.fn().mockRejectedValue(new Error('Element not found: button#submit')),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action: ClickAction = {
        type: 'click',
        selector: 'button#submit',
      };

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.action).toEqual(action);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('ELEMENT_NOT_FOUND');
      expect(result.error?.message).toContain('Element not found');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should classify timeout errors correctly', async () => {
      const mockAdapter = {
        isInitialized: () => true,
        navigate: jest.fn().mockRejectedValue(new Error('Timeout 30000ms exceeded')),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action: NavigateAction = {
        type: 'navigate',
        url: 'https://example.com',
      };

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });

    it('should classify navigation errors correctly', async () => {
      const mockAdapter = {
        isInitialized: () => true,
        navigate: jest.fn().mockRejectedValue(new Error('Navigation failed: net::ERR_NAME_NOT_RESOLVED')),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action: NavigateAction = {
        type: 'navigate',
        url: 'https://invalid-domain-that-does-not-exist.com',
      };

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NAVIGATION_FAILED');
    });
  });

  describe('executeAction - action routing', () => {
    it('should route navigate action to adapter', async () => {
      const mockAdapter = {
        isInitialized: () => true,
        navigate: jest.fn().mockResolvedValue({
          url: 'https://example.com',
          status: 200,
          title: 'Example',
          loadTime: 100,
        }),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action: NavigateAction = {
        type: 'navigate',
        url: 'https://example.com',
        waitUntil: 'networkidle',
        timeout: 5000,
      };

      await browserManager.executeAction(action);

      expect(mockAdapter.navigate).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
        timeout: 5000,
      });
    });

    it('should route click action to adapter', async () => {
      const mockAdapter = {
        isInitialized: () => true,
        click: jest.fn().mockResolvedValue(undefined),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action: ClickAction = {
        type: 'click',
        selector: 'button#submit',
        button: 'left',
        clickCount: 2,
      };

      await browserManager.executeAction(action);

      expect(mockAdapter.click).toHaveBeenCalledWith('button#submit', {
        button: 'left',
        clickCount: 2,
        timeout: undefined,
      });
    });

    it('should route type action to adapter', async () => {
      const mockAdapter = {
        isInitialized: () => true,
        type: jest.fn().mockResolvedValue(undefined),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action: TypeAction = {
        type: 'type',
        selector: 'input#username',
        text: 'testuser',
        delay: 50,
      };

      await browserManager.executeAction(action);

      expect(mockAdapter.type).toHaveBeenCalledWith('input#username', 'testuser', {
        delay: 50,
        timeout: undefined,
      });
    });

    it('should route screenshot action to adapter', async () => {
      const mockBuffer = Buffer.from('fake-screenshot-data');
      const mockAdapter = {
        isInitialized: () => true,
        screenshot: jest.fn().mockResolvedValue(mockBuffer),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'screenshot',
        fullPage: true,
        format: 'png',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(mockAdapter.screenshot).toHaveBeenCalledWith({
        type: 'png',
        quality: undefined,
        fullPage: true,
        path: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.result?.screenshot).toBeDefined();
    });

    it('should route execute_js action to adapter', async () => {
      const mockAdapter = {
        isInitialized: () => true,
        evaluate: jest.fn().mockResolvedValue({ result: 'success' }),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'execute_js',
        script: 'return document.title',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(mockAdapter.evaluate).toHaveBeenCalledWith('return document.title');
      expect(result.success).toBe(true);
    });
  });

  describe('executeAction - updates last used timestamp', () => {
    it('should update browser last used timestamp on action execution', async () => {
      const mockAdapter = {
        isInitialized: () => true,
        navigate: jest.fn().mockResolvedValue({
          url: 'https://example.com',
          status: 200,
          title: 'Example',
          loadTime: 100,
        }),
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: profileManager.getProfile('openclaw')!,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter as any,
        createdAt: Date.now(),
        lastUsedAt: Date.now() - 10000, // 10 seconds ago
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const initialLastUsed = mockBrowser.lastUsedAt;

      const action: NavigateAction = {
        type: 'navigate',
        url: 'https://example.com',
      };

      await browserManager.executeAction(action);

      const updatedBrowser = browserManager.getBrowser(mockBrowser.id);
      expect(updatedBrowser?.lastUsedAt).toBeGreaterThan(initialLastUsed);
    });
  });
});
