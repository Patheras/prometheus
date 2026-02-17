/**
 * Interaction Tool Adapters
 * 
 * Tool adapters for browser interaction actions (click, type, fill, hover, select).
 * 
 * Requirements: 10.3, 10.4, 6.2, 6.3, 6.4
 */

import { BrowserToolAdapter, ToolSchema } from './browser-tool-adapter.js';
import { BrowserManager } from '../browser-manager.js';
import { BrowserAction, ClickAction, TypeAction, SelectAction } from '../types/index.js';

/**
 * Browser Click Tool
 * 
 * Clicks an element on the page.
 */
export class BrowserClickTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_click',
      description: 'Click an element on the page',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector or XPath for the element to click',
          },
          button: {
            type: 'string',
            description: 'Mouse button to use (default: left)',
            enum: ['left', 'right', 'middle'],
            default: 'left',
          },
          clickCount: {
            type: 'number',
            description: 'Number of clicks (1 for single, 2 for double, default: 1)',
            default: 1,
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait for element in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: ['selector'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: ClickAction = {
      type: 'click',
      selector: params.selector,
      button: params.button || 'left',
      clickCount: params.clickCount || 1,
      timeout: params.timeout || 30000,
    };

    return action;
  }
}

/**
 * Browser Type Tool
 * 
 * Types text into an input element.
 */
export class BrowserTypeTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_type',
      description: 'Type text into an input element',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector or XPath for the input element',
          },
          text: {
            type: 'string',
            description: 'Text to type into the element',
          },
          delay: {
            type: 'number',
            description: 'Delay between keystrokes in milliseconds (default: 0)',
            default: 0,
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait for element in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: ['selector', 'text'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: TypeAction = {
      type: 'type',
      selector: params.selector,
      text: params.text,
      delay: params.delay || 0,
      timeout: params.timeout || 30000,
    };

    return action;
  }
}

/**
 * Browser Fill Tool
 * 
 * Fills an input element with a value (faster than typing).
 */
export class BrowserFillTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_fill',
      description: 'Fill an input element with a value (faster than typing)',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector or XPath for the input element',
          },
          value: {
            type: 'string',
            description: 'Value to fill into the element',
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait for element in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: ['selector', 'value'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    // Fill is similar to type but without delay
    const action: TypeAction = {
      type: 'type',
      selector: params.selector,
      text: params.value,
      delay: 0,
      timeout: params.timeout || 30000,
    };

    return action;
  }
}

/**
 * Browser Hover Tool
 * 
 * Hovers over an element.
 */
export class BrowserHoverTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_hover',
      description: 'Hover over an element',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector or XPath for the element to hover over',
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait for element in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: ['selector'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    // Hover would need a specific action type, but for now we'll throw an error
    throw new Error('Browser hover action not yet implemented in BrowserManager');
  }
}

/**
 * Browser Select Tool
 * 
 * Selects options in a select element.
 */
export class BrowserSelectTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_select',
      description: 'Select options in a select element',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector or XPath for the select element',
          },
          values: {
            type: 'array',
            description: 'Array of option values to select',
            items: { type: 'string' },
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait for element in milliseconds (default: 30000)',
            default: 30000,
          },
        },
        required: ['selector', 'values'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: SelectAction = {
      type: 'select',
      selector: params.selector,
      values: params.values,
    };

    return action;
  }
}
