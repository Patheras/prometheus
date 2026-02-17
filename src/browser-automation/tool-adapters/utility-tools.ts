/**
 * Utility Tool Adapters
 * 
 * Tool adapters for utility browser actions (execute JS, wait, scroll).
 * 
 * Requirements: 10.7, 6.10, 18.1
 */

import { BrowserToolAdapter, ToolSchema } from './browser-tool-adapter.js';
import { BrowserManager } from '../browser-manager.js';
import { BrowserAction, ExecuteJSAction, WaitAction, ScrollAction } from '../types/index.js';

/**
 * Browser Execute JS Tool
 * 
 * Executes JavaScript code in the page context.
 */
export class BrowserExecuteJSTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_execute_js',
      description: 'Execute JavaScript code in the page context',
      parameters: {
        type: 'object',
        properties: {
          script: {
            type: 'string',
            description: 'JavaScript code to execute',
          },
          args: {
            type: 'array',
            description: 'Arguments to pass to the script (optional)',
            items: { type: 'string' },
          },
        },
        required: ['script'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: ExecuteJSAction = {
      type: 'execute_js',
      script: params.script,
      args: params.args || [],
    };

    return action;
  }
}

/**
 * Browser Wait For Selector Tool
 * 
 * Waits for an element to appear on the page.
 */
export class BrowserWaitForSelectorTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_wait_for_selector',
      description: 'Wait for an element to appear on the page',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector or XPath for the element',
          },
          state: {
            type: 'string',
            description: 'State to wait for (default: visible)',
            enum: ['attached', 'detached', 'visible', 'hidden'],
            default: 'visible',
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: ['selector'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: WaitAction = {
      type: 'wait',
      condition: 'selector',
      selector: params.selector,
      state: params.state || 'visible',
      timeout: params.timeout || 30000,
    };

    return action;
  }
}

/**
 * Browser Scroll Tool
 * 
 * Scrolls the page to a specific location.
 */
export class BrowserScrollTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_scroll',
      description: 'Scroll the page to a specific location',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Scroll target type',
            enum: ['element', 'coordinates', 'top', 'bottom'],
          },
          selector: {
            type: 'string',
            description: 'CSS selector for element (required if target is "element")',
          },
          x: {
            type: 'number',
            description: 'X coordinate (required if target is "coordinates")',
          },
          y: {
            type: 'number',
            description: 'Y coordinate (required if target is "coordinates")',
          },
        },
        required: ['target'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: ScrollAction = {
      type: 'scroll',
      target: params.target,
      selector: params.selector,
      x: params.x,
      y: params.y,
    };

    return action;
  }
}

/**
 * Browser Wait For Navigation Tool
 * 
 * Waits for a navigation event to complete.
 */
export class BrowserWaitForNavigationTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_wait_for_navigation',
      description: 'Wait for a navigation event to complete',
      parameters: {
        type: 'object',
        properties: {
          timeout: {
            type: 'number',
            description: 'Maximum time to wait in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: [],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: WaitAction = {
      type: 'wait',
      condition: 'navigation',
      timeout: params.timeout || 30000,
    };

    return action;
  }
}

/**
 * Browser Wait For Load State Tool
 * 
 * Waits for the page to reach a specific load state.
 */
export class BrowserWaitForLoadStateTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_wait_for_load_state',
      description: 'Wait for the page to reach a specific load state',
      parameters: {
        type: 'object',
        properties: {
          state: {
            type: 'string',
            description: 'Load state to wait for',
            enum: ['load', 'domcontentloaded', 'networkidle'],
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: ['state'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: WaitAction = {
      type: 'wait',
      condition: 'load_state',
      loadState: params.state,
      timeout: params.timeout || 30000,
    };

    return action;
  }
}
