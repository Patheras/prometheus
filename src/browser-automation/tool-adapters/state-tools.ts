/**
 * State Management Tool Adapters
 * 
 * Tool adapters for browser state management (cookies, localStorage, sessionStorage).
 * 
 * Requirements: 10.8, 10.9, 7.1, 7.2, 7.4, 7.5
 */

import { BrowserToolAdapter, ToolSchema, ToolResult } from './browser-tool-adapter.js';
import { BrowserManager } from '../browser-manager.js';
import { BrowserAction, Cookie } from '../types/index.js';

/**
 * Browser Get Cookies Tool
 * 
 * Gets cookies for the current domain or all domains.
 */
export class BrowserGetCookiesTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_get_cookies',
      description: 'Get cookies for the current domain or all domains',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Filter cookies by domain (optional, returns all cookies if not provided)',
          },
        },
        required: [],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    // Cookie operations are not standard browser actions
    // We need to handle this differently by calling StateManager directly
    throw new Error('Cookie operations should be handled via StateManager, not as browser actions');
  }

  /**
   * Override execute to call StateManager directly
   */
  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const timestamp = Date.now();

    try {
      // Validate parameters
      const validationResult = this.validateParameters(params);
      if (!validationResult.valid) {
        return this.formatErrorResult(
          'VALIDATION_ERROR',
          'Parameter validation failed',
          validationResult.errors,
          startTime,
          timestamp
        );
      }

      // Get the active browser's state manager
      const browser = this.browserManager.getActiveBrowser();
      if (!browser) {
        return this.formatErrorResult(
          'NO_ACTIVE_BROWSER',
          'No active browser instance',
          null,
          startTime,
          timestamp
        );
      }

      // Get state manager from browser manager
      const stateManager = (this.browserManager as any).stateManager;
      if (!stateManager) {
        return this.formatErrorResult(
          'STATE_MANAGER_NOT_AVAILABLE',
          'State manager is not available',
          null,
          startTime,
          timestamp
        );
      }

      // Get cookies
      const cookies = await stateManager.getCookies(params.domain);

      return this.formatSuccessResult(
        { cookies },
        Date.now() - startTime,
        timestamp
      );
    } catch (error: any) {
      return this.formatErrorResult(
        'EXECUTION_ERROR',
        error.message || 'Failed to get cookies',
        error.stack,
        startTime,
        timestamp
      );
    }
  }
}

/**
 * Browser Set Cookies Tool
 * 
 * Sets one or more cookies.
 */
export class BrowserSetCookiesTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_set_cookies',
      description: 'Set one or more cookies',
      parameters: {
        type: 'object',
        properties: {
          cookies: {
            type: 'array',
            description: 'Array of cookies to set',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Cookie name' },
                value: { type: 'string', description: 'Cookie value' },
                domain: { type: 'string', description: 'Cookie domain' },
                path: { type: 'string', description: 'Cookie path (default: /)' },
                expires: { type: 'number', description: 'Expiration timestamp (default: session)' },
                httpOnly: { type: 'boolean', description: 'HTTP only flag (default: false)' },
                secure: { type: 'boolean', description: 'Secure flag (default: false)' },
                sameSite: {
                  type: 'string',
                  description: 'SameSite attribute (default: Lax)',
                  enum: ['Strict', 'Lax', 'None'],
                },
              },
            },
          },
        },
        required: ['cookies'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    throw new Error('Cookie operations should be handled via StateManager, not as browser actions');
  }

  /**
   * Override execute to call StateManager directly
   */
  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const timestamp = Date.now();

    try {
      // Validate parameters
      const validationResult = this.validateParameters(params);
      if (!validationResult.valid) {
        return this.formatErrorResult(
          'VALIDATION_ERROR',
          'Parameter validation failed',
          validationResult.errors,
          startTime,
          timestamp
        );
      }

      // Get the active browser's state manager
      const browser = this.browserManager.getActiveBrowser();
      if (!browser) {
        return this.formatErrorResult(
          'NO_ACTIVE_BROWSER',
          'No active browser instance',
          null,
          startTime,
          timestamp
        );
      }

      // Get state manager from browser manager
      const stateManager = (this.browserManager as any).stateManager;
      if (!stateManager) {
        return this.formatErrorResult(
          'STATE_MANAGER_NOT_AVAILABLE',
          'State manager is not available',
          null,
          startTime,
          timestamp
        );
      }

      // Set cookies
      await stateManager.setCookies(params.cookies as Cookie[]);

      return this.formatSuccessResult(
        { success: true, count: params.cookies.length },
        Date.now() - startTime,
        timestamp
      );
    } catch (error: any) {
      return this.formatErrorResult(
        'EXECUTION_ERROR',
        error.message || 'Failed to set cookies',
        error.stack,
        startTime,
        timestamp
      );
    }
  }
}

/**
 * Browser Get Local Storage Tool
 * 
 * Gets localStorage items for the current origin.
 */
export class BrowserGetLocalStorageTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_get_local_storage',
      description: 'Get localStorage items for the current origin',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    throw new Error('Storage operations should be handled via StateManager, not as browser actions');
  }

  /**
   * Override execute to call StateManager directly
   */
  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const timestamp = Date.now();

    try {
      // Get the active browser's state manager
      const browser = this.browserManager.getActiveBrowser();
      if (!browser) {
        return this.formatErrorResult(
          'NO_ACTIVE_BROWSER',
          'No active browser instance',
          null,
          startTime,
          timestamp
        );
      }

      // Get state manager from browser manager
      const stateManager = (this.browserManager as any).stateManager;
      if (!stateManager) {
        return this.formatErrorResult(
          'STATE_MANAGER_NOT_AVAILABLE',
          'State manager is not available',
          null,
          startTime,
          timestamp
        );
      }

      // Get current page URL to determine origin
      const page = await browser.playwrightBrowser.contexts()[0]?.pages()[0];
      if (!page) {
        return this.formatErrorResult(
          'NO_ACTIVE_PAGE',
          'No active page',
          null,
          startTime,
          timestamp
        );
      }

      const url = page.url();
      const origin = new URL(url).origin;

      // Get localStorage
      const localStorage = await stateManager.getLocalStorage(origin);

      return this.formatSuccessResult(
        { localStorage },
        Date.now() - startTime,
        timestamp
      );
    } catch (error: any) {
      return this.formatErrorResult(
        'EXECUTION_ERROR',
        error.message || 'Failed to get localStorage',
        error.stack,
        startTime,
        timestamp
      );
    }
  }
}

/**
 * Browser Set Local Storage Tool
 * 
 * Sets localStorage items for the current origin.
 */
export class BrowserSetLocalStorageTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_set_local_storage',
      description: 'Set localStorage items for the current origin',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'object',
            description: 'Key-value pairs to set in localStorage',
          },
        },
        required: ['items'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    throw new Error('Storage operations should be handled via StateManager, not as browser actions');
  }

  /**
   * Override execute to call StateManager directly
   */
  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const timestamp = Date.now();

    try {
      // Validate parameters
      const validationResult = this.validateParameters(params);
      if (!validationResult.valid) {
        return this.formatErrorResult(
          'VALIDATION_ERROR',
          'Parameter validation failed',
          validationResult.errors,
          startTime,
          timestamp
        );
      }

      // Get the active browser's state manager
      const browser = this.browserManager.getActiveBrowser();
      if (!browser) {
        return this.formatErrorResult(
          'NO_ACTIVE_BROWSER',
          'No active browser instance',
          null,
          startTime,
          timestamp
        );
      }

      // Get state manager from browser manager
      const stateManager = (this.browserManager as any).stateManager;
      if (!stateManager) {
        return this.formatErrorResult(
          'STATE_MANAGER_NOT_AVAILABLE',
          'State manager is not available',
          null,
          startTime,
          timestamp
        );
      }

      // Get current page URL to determine origin
      const page = await browser.playwrightBrowser.contexts()[0]?.pages()[0];
      if (!page) {
        return this.formatErrorResult(
          'NO_ACTIVE_PAGE',
          'No active page',
          null,
          startTime,
          timestamp
        );
      }

      const url = page.url();
      const origin = new URL(url).origin;

      // Set localStorage
      await stateManager.setLocalStorage(origin, params.items);

      return this.formatSuccessResult(
        { success: true, count: Object.keys(params.items).length },
        Date.now() - startTime,
        timestamp
      );
    } catch (error: any) {
      return this.formatErrorResult(
        'EXECUTION_ERROR',
        error.message || 'Failed to set localStorage',
        error.stack,
        startTime,
        timestamp
      );
    }
  }
}
