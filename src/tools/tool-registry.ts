/**
 * Tool Registry
 * 
 * Centralized registry for all available tools with their schemas.
 * Provides registration, retrieval, and validation of tool schemas.
 */

import { ToolDefinition, ToolSchema } from './types.js';

/**
 * Tool Registry class
 * 
 * Manages tool registration and retrieval.
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    // Tools will be registered by calling registerTool()
  }

  /**
   * Register a new tool
   * 
   * @param definition Tool definition with schema and executor
   * @throws Error if tool name already exists
   */
  registerTool(definition: ToolDefinition): void {
    if (this.tools.has(definition.schema.name)) {
      throw new Error(`Tool "${definition.schema.name}" is already registered`);
    }

    // Validate schema format
    this.validateSchema(definition.schema);

    this.tools.set(definition.schema.name, definition);
  }

  /**
   * Get tool definition by name
   * 
   * @param name Tool name
   * @returns Tool definition or undefined if not found
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool schemas for LLM
   * 
   * @returns Array of tool schemas
   */
  getAllSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map(def => def.schema);
  }

  /**
   * Get tools by category
   * 
   * @param category Tool category
   * @returns Array of tool definitions in the category
   */
  getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(def => def.category === category);
  }

  /**
   * Check if tool exists
   * 
   * @param name Tool name
   * @returns True if tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tool names
   * 
   * @returns Array of tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool count
   * 
   * @returns Number of registered tools
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Validate tool schema against OpenAI format
   * 
   * @param schema Tool schema to validate
   * @throws Error if schema is invalid
   */
  private validateSchema(schema: ToolSchema): void {
    // Check required fields
    if (!schema.name || typeof schema.name !== 'string') {
      throw new Error('Tool schema must have a name (string)');
    }

    if (!schema.description || typeof schema.description !== 'string') {
      throw new Error(`Tool "${schema.name}" must have a description (string)`);
    }

    if (!schema.parameters || typeof schema.parameters !== 'object') {
      throw new Error(`Tool "${schema.name}" must have parameters (object)`);
    }

    if (schema.parameters.type !== 'object') {
      throw new Error(`Tool "${schema.name}" parameters.type must be "object"`);
    }

    if (!schema.parameters.properties || typeof schema.parameters.properties !== 'object') {
      throw new Error(`Tool "${schema.name}" must have parameters.properties (object)`);
    }

    if (!Array.isArray(schema.parameters.required)) {
      throw new Error(`Tool "${schema.name}" must have parameters.required (array)`);
    }

    // Validate that all required parameters exist in properties
    for (const requiredParam of schema.parameters.required) {
      if (!schema.parameters.properties[requiredParam]) {
        throw new Error(
          `Tool "${schema.name}" requires parameter "${requiredParam}" but it's not defined in properties`
        );
      }
    }

    // Validate parameter definitions
    for (const [paramName, paramDef] of Object.entries(schema.parameters.properties)) {
      this.validateParameter(schema.name, paramName, paramDef);
    }
  }

  /**
   * Validate a parameter definition
   * 
   * @param toolName Tool name (for error messages)
   * @param paramName Parameter name
   * @param paramDef Parameter definition
   * @throws Error if parameter is invalid
   */
  private validateParameter(toolName: string, paramName: string, paramDef: any): void {
    if (!paramDef.type) {
      throw new Error(`Tool "${toolName}" parameter "${paramName}" must have a type`);
    }

    const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
    if (!validTypes.includes(paramDef.type)) {
      throw new Error(
        `Tool "${toolName}" parameter "${paramName}" has invalid type "${paramDef.type}". Must be one of: ${validTypes.join(', ')}`
      );
    }

    if (!paramDef.description || typeof paramDef.description !== 'string') {
      throw new Error(`Tool "${toolName}" parameter "${paramName}" must have a description (string)`);
    }

    // Validate enum if present
    if (paramDef.enum) {
      if (!Array.isArray(paramDef.enum)) {
        throw new Error(`Tool "${toolName}" parameter "${paramName}" enum must be an array`);
      }
      if (paramDef.enum.length === 0) {
        throw new Error(`Tool "${toolName}" parameter "${paramName}" enum must not be empty`);
      }
    }

    // Validate nested object properties
    if (paramDef.type === 'object' && paramDef.properties) {
      for (const [nestedName, nestedDef] of Object.entries(paramDef.properties)) {
        this.validateParameter(toolName, `${paramName}.${nestedName}`, nestedDef);
      }
    }

    // Validate array items
    if (paramDef.type === 'array' && paramDef.items) {
      this.validateParameter(toolName, `${paramName}[]`, paramDef.items);
    }
  }
}

// Singleton instance
let registryInstance: ToolRegistry | null = null;

/**
 * Get the tool registry instance
 * 
 * @returns Tool registry singleton
 */
export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}

/**
 * Reset the registry (for testing)
 */
export function resetToolRegistry(): void {
  registryInstance = null;
}
