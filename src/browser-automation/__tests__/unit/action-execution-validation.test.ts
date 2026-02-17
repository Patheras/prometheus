/**
 * Unit tests for Browser Manager action execution validation
 * 
 * Tests action validation logic without requiring a real browser.
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
import { NavigateAction, ClickAction, TypeAction, WaitAction, ScrollAction } from '../../types/index';

describe('BrowserManager - Action Validation', () => {
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

  describe('validateAction - navigate', () => {
    it('should return error when URL is missing', async () => {
      const action = {
        type: 'navigate',
        url: '',
      } as NavigateAction;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('URL is required');
    });

    it('should return error when URL lacks protocol', async () => {
      const action: NavigateAction = {
        type: 'navigate',
        url: 'example.com',
      };

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('must start with http');
    });

    it('should accept valid http URL', async () => {
      const action: NavigateAction = {
        type: 'navigate',
        url: 'http://example.com',
      };

      const result = await browserManager.executeAction(action);

      // Will fail with no browser, but validation should pass
      expect(result.error?.message).not.toContain('URL is required');
      expect(result.error?.message).not.toContain('must start with http');
    });

    it('should accept valid https URL', async () => {
      const action: NavigateAction = {
        type: 'navigate',
        url: 'https://example.com',
      };

      const result = await browserManager.executeAction(action);

      // Will fail with no browser, but validation should pass
      expect(result.error?.message).not.toContain('URL is required');
      expect(result.error?.message).not.toContain('must start with http');
    });
  });

  describe('validateAction - click', () => {
    it('should return error when selector is missing', async () => {
      const action = {
        type: 'click',
        selector: '',
      } as ClickAction;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Selector is required');
    });
  });

  describe('validateAction - type', () => {
    it('should return error when selector is missing', async () => {
      const action = {
        type: 'type',
        selector: '',
        text: 'test',
      } as TypeAction;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Selector is required');
    });

    it('should return error when text is missing', async () => {
      const action = {
        type: 'type',
        selector: 'input',
        text: undefined,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Text is required');
    });

    it('should accept empty string as text', async () => {
      const action: TypeAction = {
        type: 'type',
        selector: 'input',
        text: '',
      };

      const result = await browserManager.executeAction(action);

      // Will fail with no browser, but validation should pass
      expect(result.error?.message).not.toContain('Text is required');
    });
  });

  describe('validateAction - wait', () => {
    it('should return error when condition is missing', async () => {
      const action = {
        type: 'wait',
        condition: undefined,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Condition is required');
    });

    it('should return error when selector condition lacks selector', async () => {
      const action = {
        type: 'wait',
        condition: 'selector',
        selector: '',
      } as WaitAction;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Selector is required');
    });

    it('should return error when load_state condition lacks loadState', async () => {
      const action = {
        type: 'wait',
        condition: 'load_state',
        loadState: undefined,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('loadState is required');
    });
  });

  describe('validateAction - scroll', () => {
    it('should return error when target is missing', async () => {
      const action = {
        type: 'scroll',
        target: undefined,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Target is required');
    });

    it('should return error when element target lacks selector', async () => {
      const action = {
        type: 'scroll',
        target: 'element',
        selector: '',
      } as ScrollAction;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Selector is required');
    });

    it('should return error when coordinates target lacks x', async () => {
      const action = {
        type: 'scroll',
        target: 'coordinates',
        x: undefined,
        y: 100,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('x and y coordinates are required');
    });

    it('should return error when coordinates target lacks y', async () => {
      const action = {
        type: 'scroll',
        target: 'coordinates',
        x: 100,
        y: undefined,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('x and y coordinates are required');
    });
  });

  describe('validateAction - execute_js', () => {
    it('should return error when script is missing', async () => {
      const action = {
        type: 'execute_js',
        script: '',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Script is required');
    });
  });

  describe('no active browser', () => {
    it('should return BROWSER_DISCONNECTED error', async () => {
      const action: NavigateAction = {
        type: 'navigate',
        url: 'https://example.com',
      };

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BROWSER_DISCONNECTED');
      expect(result.error?.message).toContain('No active browser');
    });
  });

  describe('result structure', () => {
    it('should include executionTime and timestamp', async () => {
      const action: NavigateAction = {
        type: 'navigate',
        url: 'https://example.com',
      };

      const result = await browserManager.executeAction(action);

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.action).toEqual(action);
    });
  });
});
