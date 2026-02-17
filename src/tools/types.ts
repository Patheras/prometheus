/**
 * Tool System Types
 * 
 * Core TypeScript interfaces for the function calling system.
 */

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  required?: boolean;
  properties?: Record<string, ToolParameter>; // For nested objects
  items?: ToolParameter; // For arrays
}

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
 * Tool execution context
 */
export interface ToolExecutionContext {
  conversationId: string;
  userId?: string;
  timestamp: number;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  metadata?: Record<string, any>;
}

/**
 * Tool executor function type
 */
export type ToolExecutor = (
  args: Record<string, any>,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

/**
 * Tool definition with schema and executor
 */
export interface ToolDefinition {
  schema: ToolSchema;
  executor: ToolExecutor;
  category: 'analysis' | 'repository' | 'evolution' | 'workspace' | 'system' | 'browser';
}
