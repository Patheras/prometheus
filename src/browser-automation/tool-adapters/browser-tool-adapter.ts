/**
 * Browser Tool Adapter Base Class
 * 
 * Base class for browser automation tool adapters that expose browser
 * capabilities as function calling tools. Provides parameter validation,
 * error handling, and result formatting.
 * 
 * Requirements: 10.1, 10.10, 10.11
 */

import { BrowserManager } from '../browser-manager.js';
import { BrowserAction, ActionResult, ErrorCode } from '../types/index.js';
import { RequestValidator, ValidationResult } from '../validation/request-validator.js';

/**
 * Tool schema following OpenAI function calling format
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
  properties?: Record<string, ToolParameter>;
  default?: any;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  executionTime?: number;
  timestamp: number;
}

/**
 * Base class for browser tool adapters
 * 
 * Provides:
 * - Parameter validation against JSON schema
 * - Conversion of tool parameters to BrowserAction
 * - Error handling and result formatting
 * - Integration with BrowserManager
 */
export abstract class BrowserToolAdapter {
  protected browserManager: BrowserManager;
  protected schema: ToolSchema;

  constructor(browserManager: BrowserManager, schema: ToolSchema) {
    this.browserManager = browserManager;
    this.schema = schema;
  }

  /**
   * Get the tool schema
   */
  getSchema(): ToolSchema {
    return this.schema;
  }

  /**
   * Get the tool name
   */
  getName(): string {
    return this.schema.name;
  }

  /**
   * Execute the tool with the given parameters
   * 
   * @param params Tool parameters
   * @returns Tool execution result
   */
  async execute(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const timestamp = Date.now();

    try {
      // Step 1: Validate parameters against schema
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

      // Step 2: Convert parameters to BrowserAction
      let action: BrowserAction;
      try {
        action = this.convertToAction(params);
      } catch (error: any) {
        return this.formatErrorResult(
          'CONVERSION_ERROR',
          `Failed to convert parameters to action: ${error.message}`,
          error,
          startTime,
          timestamp
        );
      }

      // Step 3: Validate the action using RequestValidator
      const actionValidation = RequestValidator.validateAction(action);
      if (!actionValidation.valid) {
        return this.formatErrorResult(
          'ACTION_VALIDATION_ERROR',
          'Action validation failed',
          actionValidation.errors,
          startTime,
          timestamp
        );
      }

      // Step 4: Execute the action via BrowserManager
      const actionResult = await this.browserManager.executeAction(action);

      // Step 5: Format and return the result
      if (actionResult.success) {
        return this.formatSuccessResult(
          actionResult.result,
          actionResult.executionTime,
          timestamp
        );
      } else {
        return this.formatErrorResult(
          actionResult.error?.code || 'EXECUTION_ERROR',
          actionResult.error?.message || 'Action execution failed',
          actionResult.error?.details,
          startTime,
          timestamp
        );
      }
    } catch (error: any) {
      // Catch any unexpected errors
      return this.formatErrorResult(
        'UNEXPECTED_ERROR',
        error.message || 'An unexpected error occurred',
        error.stack,
        startTime,
        timestamp
      );
    }
  }

  /**
   * Validate parameters against the tool schema
   * 
   * @param params Parameters to validate
   * @returns Validation result
   */
  protected validateParameters(params: Record<string, any>): ValidationResult {
    const errors: Array<{ field: string; message: string; value?: any }> = [];

    // Check if params is an object
    if (!params || typeof params !== 'object') {
      errors.push({
        field: 'params',
        message: 'Parameters must be an object',
        value: params,
      });
      return { valid: false, errors };
    }

    // Validate required parameters
    for (const requiredField of this.schema.parameters.required) {
      if (!(requiredField in params)) {
        errors.push({
          field: requiredField,
          message: `Required parameter "${requiredField}" is missing`,
        });
      }
    }

    // Validate parameter types and constraints
    for (const [fieldName, fieldValue] of Object.entries(params)) {
      const paramSchema = this.schema.parameters.properties[fieldName];
      
      if (!paramSchema) {
        // Unknown parameter - warn but don't fail
        console.warn(`Unknown parameter "${fieldName}" for tool "${this.schema.name}"`);
        continue;
      }

      // Validate type
      const typeError = this.validateParameterType(fieldName, fieldValue, paramSchema);
      if (typeError) {
        errors.push(typeError);
      }

      // Validate enum constraints
      if (paramSchema.enum && !paramSchema.enum.includes(fieldValue)) {
        errors.push({
          field: fieldName,
          message: `Parameter "${fieldName}" must be one of: ${paramSchema.enum.join(', ')}`,
          value: fieldValue,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate parameter type
   * 
   * @param fieldName Field name
   * @param fieldValue Field value
   * @param paramSchema Parameter schema
   * @returns Error object if validation fails, null otherwise
   */
  protected validateParameterType(
    fieldName: string,
    fieldValue: any,
    paramSchema: ToolParameter
  ): { field: string; message: string; value?: any } | null {
    const actualType = Array.isArray(fieldValue) ? 'array' : typeof fieldValue;

    switch (paramSchema.type) {
      case 'string':
        if (typeof fieldValue !== 'string') {
          return {
            field: fieldName,
            message: `Parameter "${fieldName}" must be a string`,
            value: fieldValue,
          };
        }
        break;

      case 'number':
        if (typeof fieldValue !== 'number') {
          return {
            field: fieldName,
            message: `Parameter "${fieldName}" must be a number`,
            value: fieldValue,
          };
        }
        break;

      case 'boolean':
        if (typeof fieldValue !== 'boolean') {
          return {
            field: fieldName,
            message: `Parameter "${fieldName}" must be a boolean`,
            value: fieldValue,
          };
        }
        break;

      case 'array':
        if (!Array.isArray(fieldValue)) {
          return {
            field: fieldName,
            message: `Parameter "${fieldName}" must be an array`,
            value: fieldValue,
          };
        }
        // Validate array items if schema specifies item type
        if (paramSchema.items) {
          for (let i = 0; i < fieldValue.length; i++) {
            const itemError = this.validateParameterType(
              `${fieldName}[${i}]`,
              fieldValue[i],
              paramSchema.items as ToolParameter
            );
            if (itemError) {
              return itemError;
            }
          }
        }
        break;

      case 'object':
        if (typeof fieldValue !== 'object' || fieldValue === null || Array.isArray(fieldValue)) {
          return {
            field: fieldName,
            message: `Parameter "${fieldName}" must be an object`,
            value: fieldValue,
          };
        }
        // Validate object properties if schema specifies them
        if (paramSchema.properties) {
          for (const [propName, propValue] of Object.entries(fieldValue)) {
            const propSchema = paramSchema.properties[propName];
            if (propSchema) {
              const propError = this.validateParameterType(
                `${fieldName}.${propName}`,
                propValue,
                propSchema
              );
              if (propError) {
                return propError;
              }
            }
          }
        }
        break;

      default:
        // Unknown type - skip validation
        console.warn(`Unknown parameter type "${paramSchema.type}" for field "${fieldName}"`);
    }

    return null;
  }

  /**
   * Convert tool parameters to a BrowserAction
   * Must be implemented by subclasses
   * 
   * @param params Tool parameters
   * @returns BrowserAction
   */
  protected abstract convertToAction(params: Record<string, any>): BrowserAction;

  /**
   * Format a successful result
   * 
   * @param data Result data
   * @param executionTime Execution time in milliseconds
   * @param timestamp Timestamp
   * @returns Formatted tool result
   */
  protected formatSuccessResult(
    data: any,
    executionTime: number,
    timestamp: number
  ): ToolResult {
    return {
      success: true,
      data,
      executionTime,
      timestamp,
    };
  }

  /**
   * Format an error result
   * 
   * @param code Error code
   * @param message Error message
   * @param details Error details
   * @param startTime Start time
   * @param timestamp Timestamp
   * @returns Formatted tool result
   */
  protected formatErrorResult(
    code: string,
    message: string,
    details: any,
    startTime: number,
    timestamp: number
  ): ToolResult {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      executionTime: Date.now() - startTime,
      timestamp,
    };
  }
}
