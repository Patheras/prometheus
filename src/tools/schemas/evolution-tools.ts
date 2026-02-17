/**
 * Evolution Tool Schemas
 * 
 * Tool schemas for self-evolution endpoints.
 */

import { ToolSchema, ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '../types.js';

/**
 * Run Self-Analysis Tool Schema
 * Maps to: POST /api/evolution/analysis/run
 */
export const runSelfAnalysisSchema: ToolSchema = {
  name: 'run_self_analysis',
  description: 'Run self-analysis on Prometheus codebase to identify improvement opportunities. Returns quality metrics, detected issues, and improvement suggestions. Use this when you want to analyze and improve Prometheus itself.',
  parameters: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        description: 'Analysis scope to focus on specific aspects',
        enum: ['full', 'quality', 'performance', 'security'],
      },
    },
    required: [],
  },
};

/**
 * Execute run self-analysis
 */
export async function executeRunSelfAnalysis(
  args: { scope?: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:4242/api/evolution/analysis/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scope: args.scope || 'full',
      }),
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
        endpoint: '/api/evolution/analysis/run',
        scope: args.scope || 'full',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error running self-analysis',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Get Evolution Stats Tool Schema
 * Maps to: GET /api/evolution/stats
 */
export const getEvolutionStatsSchema: ToolSchema = {
  name: 'get_evolution_stats',
  description: 'Get evolution system statistics including total improvements, success rate, quality trends, and circuit breaker status. Use this to check the health and progress of the self-evolution system.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/**
 * Execute get evolution stats
 */
export async function executeGetEvolutionStats(
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:4242/api/evolution/stats', {
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
        endpoint: '/api/evolution/stats',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting evolution stats',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Get Pending Promotions Tool Schema
 * Maps to: GET /api/evolution/promotions/pending
 */
export const getPendingPromotionsSchema: ToolSchema = {
  name: 'get_pending_promotions',
  description: 'Get pending promotion requests awaiting approval. Returns list of improvements that have been tested in dev and are ready for production deployment. Use this to see what changes are waiting for approval.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/**
 * Execute get pending promotions
 */
export async function executeGetPendingPromotions(
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:4242/api/evolution/promotions/pending', {
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
        endpoint: '/api/evolution/promotions/pending',
        promotionCount: result.promotions?.length || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting pending promotions',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Evolution tool definitions
 */
export const evolutionTools: ToolDefinition[] = [
  {
    schema: runSelfAnalysisSchema,
    executor: executeRunSelfAnalysis,
    category: 'evolution',
  },
  {
    schema: getEvolutionStatsSchema,
    executor: executeGetEvolutionStats,
    category: 'evolution',
  },
  {
    schema: getPendingPromotionsSchema,
    executor: executeGetPendingPromotions,
    category: 'evolution',
  },
];
