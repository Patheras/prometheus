/**
 * System Tool Schemas
 * 
 * Tool schemas for system statistics endpoints.
 */

import { ToolSchema, ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '../types.js';

/**
 * Get System Stats Tool Schema
 * Maps to: GET /api/stats/*
 */
export const getSystemStatsSchema: ToolSchema = {
  name: 'get_system_stats',
  description: 'Get Prometheus system statistics including memory engine stats, runtime executor stats, and queue system stats. Use this to check system health, performance metrics, or resource usage.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Stats category to retrieve. "all" returns all stats, or specify a specific category.',
        enum: ['memory', 'runtime', 'queue', 'all'],
      },
    },
    required: [],
  },
};

/**
 * Execute get system stats
 */
export async function executeGetSystemStats(
  args: { category?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const category = args.category || 'all';
    const endpoint = category === 'all' ? '/api/stats' : `/api/stats/${category}`;

    const response = await fetch(`http://localhost:4242${endpoint}`, {
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
        endpoint,
        category,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting system stats',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * System tool definitions
 */
export const systemTools: ToolDefinition[] = [
  {
    schema: getSystemStatsSchema,
    executor: executeGetSystemStats,
    category: 'system',
  },
];
