/**
 * Repository Tool Schemas
 * 
 * Tool schemas for repository management endpoints.
 */

import { ToolSchema, ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '../types.js';

/**
 * List Repositories Tool Schema
 * Maps to: GET /api/repositories
 */
export const listRepositoriesSchema: ToolSchema = {
  name: 'list_repositories',
  description: 'List all repositories managed by Prometheus. Returns array of repositories with their status, health, last activity, and issue counts. Use this to see what repositories are being tracked.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/**
 * Execute list repositories
 */
export async function executeListRepositories(
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:4242/api/repositories', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API request failed with status ${response.status}: ${errorText}`,
        executionTime: Date.now() - startTime,
      };
    }

    const result = await response.json();

    return {
      success: true,
      result,
      executionTime: Date.now() - startTime,
      metadata: {
        endpoint: '/api/repositories',
        repositoryCount: result.repositories?.length || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error listing repositories',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Repository tool definitions
 */
export const repositoryTools: ToolDefinition[] = [
  {
    schema: listRepositoriesSchema,
    executor: executeListRepositories,
    category: 'repository',
  },
];
