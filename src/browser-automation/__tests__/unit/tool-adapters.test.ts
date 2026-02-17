/**
 * Unit Tests for Browser Tool Adapters
 * 
 * Tests all tool adapters for parameter validation, action conversion,
 * and error handling.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  BrowserNavigateTool,
  BrowserClickTool,
  BrowserTypeTool,
  BrowserFillTool,
  BrowserSelectTool,
  BrowserScreenshotTool,
  BrowserSnapshotTool,
  BrowserPDFTool,
  BrowserGetCookiesTool,
  BrowserSetCookiesTool,
  BrowserGetLocalStorageTool,
  BrowserSetLocalStorageTool,
  BrowserExecuteJSTool,
  BrowserWaitForSelectorTool,
  BrowserScrollTool,
  BrowserWaitForNavigationTool,
  BrowserWaitForLoadStateTool,
} from '../../tool-adapters/index.js';
import { BrowserManager } from '../../browser-manager.js';

// Mock BrowserManager
const createMockBrowserManager = () => {
  return {
    executeAction: jest.fn().mockResolvedValue({
      success: true,
      result: { data: 'test' },
      executionTime: 100,
      timestamp: Date.now(),
    }),
    getActiveBrowser: jest.fn().mockReturnValue({
      id: 'test-browser',
      playwrightBrowser: {
        contexts: () => [{
          pages: () => [{
            url: () => 'https://example.com',
          }],
        }],
      },
    }),
    stateManager: {
      getCookies: jest.fn().mockResolvedValue([]),
      setCookies: jest.fn().mockResolvedValue(undefined),
      getLocalStorage: jest.fn().mockResolvedValue({}),
      setLocalStorage: jest.fn().mockResolvedValue(undefined),
    },
  } as any;
};

describe('Navigation Tools', () => {
  let browserManager: BrowserManager;

  beforeEach(() => {
    browserManager = createMockBrowserManager();
  });

  describe('BrowserNavigateTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserNavigateTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_navigate');
      expect(schema.description).toContain('Navigate');
      expect(schema.parameters.required).toContain('url');
      expect(schema.parameters.properties.url).toBeDefined();
      expect(schema.parameters.properties.waitUntil).toBeDefined();
      expect(schema.parameters.properties.timeout).toBeDefined();
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserNavigateTool(browserManager);
      const result = await tool.execute({
        url: 'https://example.com',
        waitUntil: 'load',
        timeout: 30000,
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'navigate',
        url: 'https://example.com',
        waitUntil: 'load',
        timeout: 30000,
      });
    });

    it('should use default values for optional parameters', async () => {
      const tool = new BrowserNavigateTool(browserManager);
      await tool.execute({ url: 'https://example.com' });

      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'navigate',
        url: 'https://example.com',
        waitUntil: 'load',
        timeout: 30000,
      });
    });

    it('should fail validation when url is missing', async () => {
      const tool = new BrowserNavigateTool(browserManager);
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('validation failed');
    });

    it('should fail validation when url is not a string', async () => {
      const tool = new BrowserNavigateTool(browserManager);
      const result = await tool.execute({ url: 123 });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should fail validation when waitUntil is invalid', async () => {
      const tool = new BrowserNavigateTool(browserManager);
      const result = await tool.execute({
        url: 'https://example.com',
        waitUntil: 'invalid',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('Interaction Tools', () => {
  let browserManager: BrowserManager;

  beforeEach(() => {
    browserManager = createMockBrowserManager();
  });

  describe('BrowserClickTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserClickTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_click');
      expect(schema.parameters.required).toContain('selector');
      expect(schema.parameters.properties.selector).toBeDefined();
      expect(schema.parameters.properties.button).toBeDefined();
      expect(schema.parameters.properties.clickCount).toBeDefined();
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserClickTool(browserManager);
      const result = await tool.execute({
        selector: '#button',
        button: 'left',
        clickCount: 1,
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'click',
        selector: '#button',
        button: 'left',
        clickCount: 1,
        timeout: 30000,
      });
    });

    it('should use default values', async () => {
      const tool = new BrowserClickTool(browserManager);
      await tool.execute({ selector: '#button' });

      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'click',
        selector: '#button',
        button: 'left',
        clickCount: 1,
        timeout: 30000,
      });
    });

    it('should fail validation when selector is missing', async () => {
      const tool = new BrowserClickTool(browserManager);
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('BrowserTypeTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserTypeTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_type');
      expect(schema.parameters.required).toContain('selector');
      expect(schema.parameters.required).toContain('text');
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserTypeTool(browserManager);
      const result = await tool.execute({
        selector: '#input',
        text: 'Hello World',
        delay: 50,
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'type',
        selector: '#input',
        text: 'Hello World',
        delay: 50,
        timeout: 30000,
      });
    });

    it('should fail validation when text is missing', async () => {
      const tool = new BrowserTypeTool(browserManager);
      const result = await tool.execute({ selector: '#input' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('BrowserFillTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserFillTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_fill');
      expect(schema.parameters.required).toContain('selector');
      expect(schema.parameters.required).toContain('value');
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserFillTool(browserManager);
      const result = await tool.execute({
        selector: '#input',
        value: 'Test Value',
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'type',
        selector: '#input',
        text: 'Test Value',
        delay: 0,
        timeout: 30000,
      });
    });
  });

  describe('BrowserSelectTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserSelectTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_select');
      expect(schema.parameters.required).toContain('selector');
      expect(schema.parameters.required).toContain('values');
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserSelectTool(browserManager);
      const result = await tool.execute({
        selector: '.my-list',
        values: ['option1', 'option2'],
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'select',
        selector: '.my-list',
        values: ['option1', 'option2'],
      });
    });

    it('should validate array type for values', async () => {
      const tool = new BrowserSelectTool(browserManager);
      const result = await tool.execute({
        selector: '#select',
        values: 'not-an-array',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('Capture Tools', () => {
  let browserManager: BrowserManager;

  beforeEach(() => {
    browserManager = createMockBrowserManager();
  });

  describe('BrowserScreenshotTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserScreenshotTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_screenshot');
      expect(schema.parameters.properties.fullPage).toBeDefined();
      expect(schema.parameters.properties.type).toBeDefined();
      expect(schema.parameters.properties.quality).toBeDefined();
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserScreenshotTool(browserManager);
      const result = await tool.execute({
        fullPage: true,
        type: 'png',
        quality: 90,
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'screenshot',
        fullPage: true,
        format: 'png',
        quality: 90,
        path: undefined,
      });
    });

    it('should use default values', async () => {
      const tool = new BrowserScreenshotTool(browserManager);
      await tool.execute({});

      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'screenshot',
        fullPage: false,
        format: 'png',
        quality: 80,
        path: undefined,
      });
    });
  });

  describe('BrowserSnapshotTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserSnapshotTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_snapshot');
      expect(schema.parameters.properties.includeIframes).toBeDefined();
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserSnapshotTool(browserManager);
      const result = await tool.execute({ includeIframes: true });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'snapshot',
        includeIframes: true,
      });
    });
  });

  describe('BrowserPDFTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserPDFTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_pdf');
      expect(schema.parameters.properties.format).toBeDefined();
      expect(schema.parameters.properties.printBackground).toBeDefined();
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserPDFTool(browserManager);
      const result = await tool.execute({
        format: 'A4',
        printBackground: true,
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'pdf',
        path: undefined,
        format: 'A4',
        width: undefined,
        height: undefined,
        margin: undefined,
        printBackground: true,
      });
    });
  });
});

describe('State Management Tools', () => {
  let browserManager: BrowserManager;

  beforeEach(() => {
    browserManager = createMockBrowserManager();
  });

  describe('BrowserGetCookiesTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserGetCookiesTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_get_cookies');
      expect(schema.parameters.properties.domain).toBeDefined();
    });

    it('should execute and get cookies', async () => {
      const tool = new BrowserGetCookiesTool(browserManager);
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(browserManager.stateManager.getCookies).toHaveBeenCalled();
    });

    it('should filter by domain', async () => {
      const tool = new BrowserGetCookiesTool(browserManager);
      await tool.execute({ domain: 'example.com' });

      expect(browserManager.stateManager.getCookies).toHaveBeenCalledWith('example.com');
    });
  });

  describe('BrowserSetCookiesTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserSetCookiesTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_set_cookies');
      expect(schema.parameters.required).toContain('cookies');
    });

    it('should execute and set cookies', async () => {
      const tool = new BrowserSetCookiesTool(browserManager);
      const cookies = [
        {
          name: 'test',
          value: 'value',
          domain: 'example.com',
          path: '/',
          expires: Date.now() + 86400000,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ];

      const result = await tool.execute({ cookies });

      expect(result.success).toBe(true);
      expect(browserManager.stateManager.setCookies).toHaveBeenCalledWith(cookies);
    });

    it('should fail validation when cookies is missing', async () => {
      const tool = new BrowserSetCookiesTool(browserManager);
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('BrowserGetLocalStorageTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserGetLocalStorageTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_get_local_storage');
    });

    it('should execute and get localStorage', async () => {
      const tool = new BrowserGetLocalStorageTool(browserManager);
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(browserManager.stateManager.getLocalStorage).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('BrowserSetLocalStorageTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserSetLocalStorageTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_set_local_storage');
      expect(schema.parameters.required).toContain('items');
    });

    it('should execute and set localStorage', async () => {
      const tool = new BrowserSetLocalStorageTool(browserManager);
      const items = { key1: 'value1', key2: 'value2' };

      const result = await tool.execute({ items });

      expect(result.success).toBe(true);
      expect(browserManager.stateManager.setLocalStorage).toHaveBeenCalledWith('https://example.com', items);
    });
  });
});

describe('Utility Tools', () => {
  let browserManager: BrowserManager;

  beforeEach(() => {
    browserManager = createMockBrowserManager();
  });

  describe('BrowserExecuteJSTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserExecuteJSTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_execute_js');
      expect(schema.parameters.required).toContain('script');
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserExecuteJSTool(browserManager);
      const result = await tool.execute({
        script: 'return document.title;',
        args: [],
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'execute_js',
        script: 'return document.title;',
        args: [],
      });
    });
  });

  describe('BrowserWaitForSelectorTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserWaitForSelectorTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_wait_for_selector');
      expect(schema.parameters.required).toContain('selector');
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserWaitForSelectorTool(browserManager);
      const result = await tool.execute({
        selector: '#element',
        state: 'visible',
        timeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'wait',
        condition: 'selector',
        selector: '#element',
        state: 'visible',
        timeout: 5000,
      });
    });
  });

  describe('BrowserScrollTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserScrollTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_scroll');
      expect(schema.parameters.required).toContain('target');
    });

    it('should execute with element target', async () => {
      const tool = new BrowserScrollTool(browserManager);
      const result = await tool.execute({
        target: 'element',
        selector: '#footer',
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'scroll',
        target: 'element',
        selector: '#footer',
        x: undefined,
        y: undefined,
      });
    });

    it('should execute with coordinates target', async () => {
      const tool = new BrowserScrollTool(browserManager);
      const result = await tool.execute({
        target: 'coordinates',
        x: 0,
        y: 500,
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'scroll',
        target: 'coordinates',
        selector: undefined,
        x: 0,
        y: 500,
      });
    });
  });

  describe('BrowserWaitForNavigationTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserWaitForNavigationTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_wait_for_navigation');
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserWaitForNavigationTool(browserManager);
      const result = await tool.execute({ timeout: 10000 });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'wait',
        condition: 'navigation',
        timeout: 10000,
      });
    });
  });

  describe('BrowserWaitForLoadStateTool', () => {
    it('should have correct schema', () => {
      const tool = new BrowserWaitForLoadStateTool(browserManager);
      const schema = tool.getSchema();

      expect(schema.name).toBe('browser_wait_for_load_state');
      expect(schema.parameters.required).toContain('state');
    });

    it('should execute with valid parameters', async () => {
      const tool = new BrowserWaitForLoadStateTool(browserManager);
      const result = await tool.execute({
        state: 'networkidle',
        timeout: 15000,
      });

      expect(result.success).toBe(true);
      expect(browserManager.executeAction).toHaveBeenCalledWith({
        type: 'wait',
        condition: 'load_state',
        loadState: 'networkidle',
        timeout: 15000,
      });
    });
  });
});

describe('Error Handling', () => {
  let browserManager: BrowserManager;

  beforeEach(() => {
    browserManager = createMockBrowserManager();
  });

  it('should handle browser manager execution errors', async () => {
    browserManager.executeAction = jest.fn().mockResolvedValue({
      success: false,
      error: {
        code: 'ELEMENT_NOT_FOUND',
        message: 'Element not found',
        details: { selector: '#missing' },
      },
      executionTime: 100,
      timestamp: Date.now(),
    });

    const tool = new BrowserClickTool(browserManager);
    const result = await tool.execute({ selector: '#missing' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('ELEMENT_NOT_FOUND');
    expect(result.error?.message).toContain('Element not found');
  });

  it('should handle unexpected errors', async () => {
    browserManager.executeAction = jest.fn().mockRejectedValue(new Error('Unexpected error'));

    const tool = new BrowserNavigateTool(browserManager);
    const result = await tool.execute({ url: 'https://example.com' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNEXPECTED_ERROR');
    expect(result.error?.message).toContain('Unexpected error');
  });

  it('should handle missing browser for state operations', async () => {
    browserManager.getActiveBrowser = jest.fn().mockReturnValue(null);

    const tool = new BrowserGetCookiesTool(browserManager);
    const result = await tool.execute({});

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NO_ACTIVE_BROWSER');
  });
});
