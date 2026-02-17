/**
 * Capture Tool Adapters
 * 
 * Tool adapters for browser capture actions (screenshot, snapshot, PDF).
 * 
 * Requirements: 10.5, 10.6, 4.1, 5.1, 8.1
 */

import { BrowserToolAdapter, ToolSchema } from './browser-tool-adapter.js';
import { BrowserManager } from '../browser-manager.js';
import { BrowserAction, ScreenshotAction, SnapshotAction, PDFAction } from '../types/index.js';

/**
 * Browser Screenshot Tool
 * 
 * Takes a screenshot of the current page.
 */
export class BrowserScreenshotTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current page',
      parameters: {
        type: 'object',
        properties: {
          fullPage: {
            type: 'boolean',
            description: 'Capture the full scrollable page (default: false)',
            default: false,
          },
          type: {
            type: 'string',
            description: 'Image format (default: png)',
            enum: ['png', 'jpeg'],
            default: 'png',
          },
          quality: {
            type: 'number',
            description: 'Image quality for JPEG (0-100, default: 80)',
            default: 80,
          },
          path: {
            type: 'string',
            description: 'File path to save screenshot (optional, returns base64 if not provided)',
          },
        },
        required: [],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: ScreenshotAction = {
      type: 'screenshot',
      fullPage: params.fullPage || false,
      format: params.type || 'png',
      quality: params.quality || 80,
      path: params.path,
    };

    return action;
  }
}

/**
 * Browser Snapshot Tool
 * 
 * Captures a snapshot of the page including DOM and accessibility tree.
 */
export class BrowserSnapshotTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_snapshot',
      description: 'Capture a snapshot of the page including DOM and accessibility tree',
      parameters: {
        type: 'object',
        properties: {
          includeIframes: {
            type: 'boolean',
            description: 'Include iframe content in snapshot (default: false)',
            default: false,
          },
        },
        required: [],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: SnapshotAction = {
      type: 'snapshot',
      includeIframes: params.includeIframes || false,
    };

    return action;
  }
}

/**
 * Browser PDF Tool
 * 
 * Generates a PDF from the current page.
 */
export class BrowserPDFTool extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_pdf',
      description: 'Generate a PDF from the current page',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to save PDF (optional, returns buffer if not provided)',
          },
          format: {
            type: 'string',
            description: 'Page format (default: Letter)',
            default: 'Letter',
          },
          width: {
            type: 'string',
            description: 'Page width (e.g., "8.5in", "210mm")',
          },
          height: {
            type: 'string',
            description: 'Page height (e.g., "11in", "297mm")',
          },
          margin: {
            type: 'object',
            description: 'Page margins',
            properties: {
              top: { type: 'string', description: 'Top margin (e.g., "1in")' },
              right: { type: 'string', description: 'Right margin (e.g., "1in")' },
              bottom: { type: 'string', description: 'Bottom margin (e.g., "1in")' },
              left: { type: 'string', description: 'Left margin (e.g., "1in")' },
            },
          },
          printBackground: {
            type: 'boolean',
            description: 'Include background graphics (default: false)',
            default: false,
          },
        },
        required: [],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    const action: PDFAction = {
      type: 'pdf',
      path: params.path,
      format: params.format || 'Letter',
      width: params.width,
      height: params.height,
      margin: params.margin,
      printBackground: params.printBackground || false,
    };

    return action;
  }
}
