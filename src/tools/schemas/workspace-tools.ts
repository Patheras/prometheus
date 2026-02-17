/**
 * Workspace Tool Schemas
 * 
 * Tool schemas for workspace file access endpoints.
 */

import { ToolSchema, ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '../types.js';

/**
 * Read Workspace File Tool Schema
 * Maps to: GET /api/workspace/:repoId/files/*
 */
export const readWorkspaceFileSchema: ToolSchema = {
  name: 'read_workspace_file',
  description: 'Read a file from a repository workspace. Returns file content and metadata. Use this to read source code files, configuration files, or any other files in a repository.',
  parameters: {
    type: 'object',
    properties: {
      repoId: {
        type: 'string',
        description: 'Repository identifier (e.g., "prometheus" for the main repository)',
      },
      filePath: {
        type: 'string',
        description: 'Path to file within repository (e.g., "src/api/chat.ts"). Use forward slashes for path separators.',
      },
    },
    required: ['repoId', 'filePath'],
  },
};

/**
 * Execute read workspace file
 */
export async function executeReadWorkspaceFile(
  args: { repoId: string; filePath: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    // Sanitize file path to prevent directory traversal
    const sanitizedPath = args.filePath.replace(/\\/g, '/').replace(/\.\.+/g, '');
    
    const response = await fetch(
      `http://localhost:4242/api/workspace/${encodeURIComponent(args.repoId)}/files/${sanitizedPath}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

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
        endpoint: '/api/workspace',
        repoId: args.repoId,
        filePath: sanitizedPath,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error reading workspace file',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Workspace tool definitions
 */
export const workspaceTools: ToolDefinition[] = [
  {
    schema: readWorkspaceFileSchema,
    executor: executeReadWorkspaceFile,
    category: 'workspace',
  },
];
