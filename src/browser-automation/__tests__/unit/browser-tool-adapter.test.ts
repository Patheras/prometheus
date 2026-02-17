/**
 * Browser Tool Adapter Tests
 * 
 * Unit tests for the BrowserToolAdapter base class.
 */

import { BrowserToolAdapter, ToolSchema } from '../../tool-adapters/browser-tool-adapter';
import { BrowserManager } from '../../browser-manager';
import { BrowserAction, ActionResult, NavigateAction } from '../../types/index';

// Mock BrowserManager
class MockBrowserManager {
  executeAction = jest.fn();
}

// Concrete implementation for testing
class TestToolAdapter extends BrowserToolAdapter {
  protected convertToAction(params: Record<string, any>): BrowserAction {
    return {
      type: 'navigate',
      url: params.url,
      waitUntil: params.waitUntil,
      timeout: params.timeout,
    } as NavigateAction;
  }
}

describe('BrowserToolAdapter', () => {
  let mockBrowserManager: MockBrowserManager;
  let adapter: TestToolAdapter;
  let schema: ToolSchema;

  beforeEach(() => {
    mockBrowserManager = new MockBrowserManager();
    
    schema = {
      name: 'test_navigate',
      description: 'Test navigation tool',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to navigate to',
          },
          waitUntil: {
            type: 'string',
            description: 'Wait until condition',
            enum: ['load', 'domcontentloaded', 'networkidle'],
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds',
          },
        },
        required: ['url'],
      },
    };

    adapter = new TestToolAdapter(mockBrowserManager as any, schema);
  });

  describe('getSchema', () => {
    it('should return the tool schema', () => {
      expect(adapter.getSchema()).toEqual(schema);
    });
  });

  describe('getName', () => {
    it('should return the tool name', () => {
      expect(adapter.getName()).toBe('test_navigate');
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid parameters', async () => {
      const params = {
        url: 'https://example.com',
        waitUntil: 'load',
        timeout: 30000,
      };

      const actionResult: ActionResult = {
        success: true,
        action: {
          type: 'navigate',
          url: 'https://example.com',
          waitUntil: 'load',
          timeout: 30000,
        },
        result: {
          url: 'https://example.com',
          status: 200,
          title: 'Example Domain',
          loadTime: 500,
        },
        executionTime: 500,
        timestamp: Date.now(),
      };

      mockBrowserManager.executeAction.mockResolvedValue(actionResult);

      const result = await adapter.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(actionResult.result);
      expect(result.executionTime).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(mockBrowserManager.executeAction).toHaveBeenCalledWith({
        type: 'navigate',
        url: 'https://example.com',
        waitUntil: 'load',
        timeout: 30000,
      });
    });

    it('should fail validation when required parameter is missing', async () => {
      const params = {
        waitUntil: 'load',
      };

      const result = await adapter.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('Parameter validation failed');
      expect(result.error?.details).toContainEqual(
        expect.objectContaining({
          field: 'url',
          message: expect.stringContaining('Required parameter "url" is missing'),
        })
      );
      expect(mockBrowserManager.executeAction).not.toHaveBeenCalled();
    });

    it('should fail validation when parameter has wrong type', async () => {
      const params = {
        url: 123, // Should be string
      };

      const result = await adapter.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.details).toContainEqual(
        expect.objectContaining({
          field: 'url',
          message: expect.stringContaining('must be a string'),
        })
      );
      expect(mockBrowserManager.executeAction).not.toHaveBeenCalled();
    });

    it('should fail validation when enum value is invalid', async () => {
      const params = {
        url: 'https://example.com',
        waitUntil: 'invalid',
      };

      const result = await adapter.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.details).toContainEqual(
        expect.objectContaining({
          field: 'waitUntil',
          message: expect.stringContaining('must be one of'),
        })
      );
      expect(mockBrowserManager.executeAction).not.toHaveBeenCalled();
    });

    it('should fail when action validation fails', async () => {
      const params = {
        url: 'not-a-valid-url', // Invalid URL format
      };

      const result = await adapter.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACTION_VALIDATION_ERROR');
      expect(result.error?.message).toContain('Action validation failed');
      expect(mockBrowserManager.executeAction).not.toHaveBeenCalled();
    });

    it('should handle action execution errors', async () => {
      const params = {
        url: 'https://example.com',
      };

      const actionResult: ActionResult = {
        success: false,
        action: {
          type: 'navigate',
          url: 'https://example.com',
        },
        error: {
          code: 'TIMEOUT',
          message: 'Navigation timeout exceeded',
          details: 'Timeout of 30000ms exceeded',
        },
        executionTime: 30000,
        timestamp: Date.now(),
      };

      mockBrowserManager.executeAction.mockResolvedValue(actionResult);

      const result = await adapter.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
      expect(result.error?.message).toBe('Navigation timeout exceeded');
      expect(result.error?.details).toBe('Timeout of 30000ms exceeded');
    });

    it('should handle unexpected errors', async () => {
      const params = {
        url: 'https://example.com',
      };

      mockBrowserManager.executeAction.mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await adapter.execute(params);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNEXPECTED_ERROR');
      expect(result.error?.message).toBe('Unexpected error');
    });

    it('should validate array parameters', async () => {
      const schemaWithArray: ToolSchema = {
        name: 'test_select',
        description: 'Test select tool',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'Element selector',
            },
            values: {
              type: 'array',
              description: 'Values to select',
              items: { type: 'string' },
            },
          },
          required: ['selector', 'values'],
        },
      };

      class TestSelectAdapter extends BrowserToolAdapter {
        protected convertToAction(params: Record<string, any>): BrowserAction {
          return {
            type: 'select',
            selector: params.selector,
            values: params.values,
          };
        }
      }

      const selectAdapter = new TestSelectAdapter(mockBrowserManager as any, schemaWithArray);

      // Valid array
      let result = await selectAdapter.execute({
        selector: 'select#options',
        values: ['option1', 'option2'],
      });

      expect(result.error?.code).not.toBe('VALIDATION_ERROR');

      // Invalid array (not an array)
      result = await selectAdapter.execute({
        selector: 'select#options',
        values: 'not-an-array',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.details).toContainEqual(
        expect.objectContaining({
          field: 'values',
          message: expect.stringContaining('must be an array'),
        })
      );

      // Invalid array items (wrong type)
      result = await selectAdapter.execute({
        selector: 'select#options',
        values: ['option1', 123], // Second item is not a string
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.details).toContainEqual(
        expect.objectContaining({
          field: 'values[1]',
          message: expect.stringContaining('must be a string'),
        })
      );
    });

    it('should validate object parameters', async () => {
      const schemaWithObject: ToolSchema = {
        name: 'test_pdf',
        description: 'Test PDF tool',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Output path',
            },
            margin: {
              type: 'object',
              description: 'Page margins',
              properties: {
                top: { type: 'string', description: 'Top margin' },
                bottom: { type: 'string', description: 'Bottom margin' },
              },
            },
          },
          required: ['path'],
        },
      };

      class TestPDFAdapter extends BrowserToolAdapter {
        protected convertToAction(params: Record<string, any>): BrowserAction {
          return {
            type: 'pdf',
            path: params.path,
            margin: params.margin,
          };
        }
      }

      const pdfAdapter = new TestPDFAdapter(mockBrowserManager as any, schemaWithObject);

      // Valid object
      let result = await pdfAdapter.execute({
        path: 'output.pdf',
        margin: { top: '1cm', bottom: '1cm' },
      });

      expect(result.error?.code).not.toBe('VALIDATION_ERROR');

      // Invalid object (not an object)
      result = await pdfAdapter.execute({
        path: 'output.pdf',
        margin: 'not-an-object',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.details).toContainEqual(
        expect.objectContaining({
          field: 'margin',
          message: expect.stringContaining('must be an object'),
        })
      );
    });

    it('should handle non-object params', async () => {
      const result = await adapter.execute('not-an-object' as any);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.details).toContainEqual(
        expect.objectContaining({
          field: 'params',
          message: 'Parameters must be an object',
        })
      );
    });
  });
});
