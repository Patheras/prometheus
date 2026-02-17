/**
 * Navigation Tool Adapters
 * 
 * Tool adapters for browser navigation actions.
 * 
 * Requirements: 10.2, 6.1
 */

import { BrowserToolAdapter, ToolSchema } from './browser-tool-adapter.js';
import { BrowserManager } from '../browser-manager.js';
import { BrowserAction, NavigateAction } from '../types/index.js';

/**
 * Browser Navigate Tool
 * 
 * Navigates the browser to a specified URL.
 */
export class BrowserNavigateTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_navigate',
      description: 'Navigate the browser to a specified URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to (must include protocol, e.g., https://example.com)',
          },
          waitUntil: {
            type: 'string',
            description: 'When to consider navigation complete (default: load)',
            enum: ['load', 'domcontentloaded', 'networkidle'],
            default: 'load',
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: ['url'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: NavigateAction = {
      type: 'navigate',
      url: params.url,
      waitUntil: params.waitUntil || 'load',
      timeout: params.timeout || 30000,
    };

    return action;
  }
}

/**
 * Browser Back Tool
 * 
 * Navigates the browser back in history.
 */
export class BrowserBackTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_back',
      description: 'Navigate the browser back in history',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    // For back/forward/reload, we'll use navigate with special URLs
    // This is a simplified approach - in a full implementation,
    // we'd add specific action types for these
    throw new Error('Browser back action not yet implemented in BrowserManager');
  }
}

/**
 * Browser Forward Tool
 * 
 * Navigates the browser forward in history.
 */
export class BrowserForwardTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_forward',
      description: 'Navigate the browser forward in history',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    throw new Error('Browser forward action not yet implemented in BrowserManager');
  }
}

/**
 * Browser Reload Tool
 * 
 * Reloads the current page.
 */
export class BrowserReloadTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_reload',
      description: 'Reload the current page',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    throw new Error('Browser reload action not yet implemented in BrowserManager');
  }
}
