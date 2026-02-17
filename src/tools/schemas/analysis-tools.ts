/**
 * Analysis Tool Schemas
 * 
 * Tool schemas for code analysis endpoints.
 */

import { ToolSchema, ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '../types.js';

/**
 * Code Quality Analysis Tool Schema
 * Maps to: POST /api/analyze/quality
 */
export const analyzeCodeQualitySchema: ToolSchema = {
  name: 'analyze_code_quality',
  description: 'Analyze code quality and detect issues in a file. Returns quality score, complexity metrics, maintainability index, and list of issues with suggestions. Use this when you need to check code quality, find code smells, or get improvement suggestions for a specific file.',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the file to analyze (e.g., "src/api/chat.ts"). This is used for context and reporting.',
      },
      sourceCode: {
        type: 'string',
        description: 'Source code content to analyze. Provide the complete file content.',
      },
    },
    required: ['filePath', 'sourceCode'],
  },
};

/**
 * Execute code quality analysis
 */
export async function executeCodeQualityAnalysis(
  args: { filePath: string; sourceCode: string },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:4242/api/analyze/quality', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath: args.filePath,
        sourceCode: args.sourceCode,
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
        endpoint: '/api/analyze/quality',
        filePath: args.filePath,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during code quality analysis',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Technical Debt Detection Tool Schema
 * Maps to: POST /api/analyze/debt
 */
export const detectTechnicalDebtSchema: ToolSchema = {
  name: 'detect_technical_debt',
  description: 'Detect technical debt in a codebase. Returns summary of debt items including TODO comments, deprecated APIs, outdated dependencies, and missing tests with estimated effort and priorities. Use this to identify areas that need refactoring or improvement.',
  parameters: {
    type: 'object',
    properties: {
      codebasePath: {
        type: 'string',
        description: 'Path to the codebase directory to analyze (e.g., "./src" or ".")',
      },
      options: {
        type: 'object',
        description: 'Analysis options to customize what types of debt to detect',
        properties: {
          includeOutdatedDeps: {
            type: 'boolean',
            description: 'Include outdated dependencies in the analysis',
          },
          includeTodoComments: {
            type: 'boolean',
            description: 'Include TODO/FIXME comments in the analysis',
          },
          includeMissingTests: {
            type: 'boolean',
            description: 'Include files with missing test coverage',
          },
          minPriority: {
            type: 'number',
            description: 'Minimum priority level to include (1-5, where 5 is highest priority)',
          },
        },
      },
    },
    required: ['codebasePath'],
  },
};

/**
 * Execute technical debt detection
 */
export async function executeTechnicalDebtDetection(
  args: { codebasePath: string; options?: any },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:4242/api/analyze/debt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        codebasePath: args.codebasePath,
        options: args.options || {},
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
        endpoint: '/api/analyze/debt',
        codebasePath: args.codebasePath,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during technical debt detection',
      executionTime: Date.now() - startTime,
    };
  }
}

/**
 * Analysis tool definitions
 */
export const analysisTools: ToolDefinition[] = [
  {
    schema: analyzeCodeQualitySchema,
    executor: executeCodeQualityAnalysis,
    category: 'analysis',
  },
  {
    schema: detectTechnicalDebtSchema,
    executor: executeTechnicalDebtDetection,
    category: 'analysis',
  },
];
