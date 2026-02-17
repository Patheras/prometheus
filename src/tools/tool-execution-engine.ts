/**
 * Tool Execution Engine
 * 
 * Executes tool calls safely with validation, error handling, timeout,
 * circuit breaker, and metrics tracking.
 */

import { ToolRegistry, getToolRegistry } from './tool-registry.js';
import { ToolExecutionContext, ToolExecutionResult } from './types.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { ToolMetricsTracker } from './tool-metrics.js';
import { getSecurityValidator, SecurityValidator } from './security-validator.js';
import { getRateLimiter, RateLimiter } from './rate-limiter.js';
import { getAuditLogger, AuditLogger } from './audit-logger.js';

export interface ToolExecutionEngineConfig {
  timeout: number;  // Milliseconds
  circuitBreakerEnabled: boolean;
  securityValidationEnabled: boolean;
  rateLimitingEnabled: boolean;
  auditLoggingEnabled: boolean;
}

const DEFAULT_CONFIG: ToolExecutionEngineConfig = {
  timeout: 30000, // 30 seconds
  circuitBreakerEnabled: true,
  securityValidationEnabled: true,
  rateLimitingEnabled: true,
  auditLoggingEnabled: true,
};

export class ToolExecutionEngine {
  private registry: ToolRegistry;
  private circuitBreaker: CircuitBreaker;
  private metrics: ToolMetricsTracker;
  private securityValidator: SecurityValidator;
  private rateLimiter: RateLimiter;
  private auditLogger: AuditLogger;
  private config: ToolExecutionEngineConfig;

  constructor(
    registry?: ToolRegistry,
    config: Partial<ToolExecutionEngineConfig> = {}
  ) {
    this.registry = registry || getToolRegistry();
    this.circuitBreaker = new CircuitBreaker();
    this.metrics = new ToolMetricsTracker();
    this.securityValidator = getSecurityValidator();
    this.rateLimiter = getRateLimiter();
    this.auditLogger = getAuditLogger();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a single tool call
   * 
   * @param toolName Tool name
   * @param args Tool arguments
   * @param context Execution context
   * @returns Tool execution result
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Check if tool exists
    const toolDef = this.registry.getTool(toolName);
    if (!toolDef) {
      const result: ToolExecutionResult = {
        success: false,
        error: `Tool "${toolName}" not found`,
        executionTime: Date.now() - startTime,
      };
      this.metrics.recordExecution(toolName, false, result.executionTime);
      return result;
    }

    // Security validation
    if (this.config.securityValidationEnabled) {
      const validationResult = this.securityValidator.validateToolArguments(toolName, args);
      if (!validationResult.valid) {
        const result: ToolExecutionResult = {
          success: false,
          error: `Security validation failed: ${validationResult.error}`,
          executionTime: Date.now() - startTime,
          metadata: {
            securityViolations: validationResult.violations,
          },
        };
        this.metrics.recordExecution(toolName, false, result.executionTime);
        
        // Log security violation
        console.error(`[Security] Tool ${toolName} blocked:`, validationResult.violations);
        
        // Audit log security violation
        if (this.config.auditLoggingEnabled && context.conversationId) {
          this.auditLogger.log({
            timestamp: Date.now(),
            conversationId: context.conversationId,
            toolName,
            arguments: args,
            result: {
              success: false,
              error: result.error,
              executionTime: result.executionTime,
            },
            securityViolations: validationResult.violations,
          });
        }
        
        return result;
      }
    }

    // Rate limiting
    if (this.config.rateLimitingEnabled && context.conversationId) {
      const rateLimitStatus = this.rateLimiter.checkLimit(context.conversationId, toolName);
      if (!rateLimitStatus.allowed) {
        const result: ToolExecutionResult = {
          success: false,
          error: `Rate limit exceeded. Maximum ${rateLimitStatus.totalCalls} calls per minute. Resets at ${new Date(rateLimitStatus.resetTime).toISOString()}`,
          executionTime: Date.now() - startTime,
          metadata: {
            rateLimitStatus,
          },
        };
        this.metrics.recordExecution(toolName, false, result.executionTime);
        
        // Log rate limit violation
        console.warn(`[RateLimit] Tool ${toolName} blocked for conversation ${context.conversationId}`);
        
        // Audit log rate limit violation
        if (this.config.auditLoggingEnabled) {
          this.auditLogger.log({
            timestamp: Date.now(),
            conversationId: context.conversationId,
            toolName,
            arguments: args,
            result: {
              success: false,
              error: result.error,
              executionTime: result.executionTime,
            },
            rateLimitViolation: true,
            metadata: result.metadata,
          });
        }
        
        return result;
      }
    }

    // Check circuit breaker
    if (this.config.circuitBreakerEnabled && !this.circuitBreaker.allowCall(toolName)) {
      const status = this.circuitBreaker.getStatus(toolName);
      const result: ToolExecutionResult = {
        success: false,
        error: `Circuit breaker is OPEN for tool "${toolName}". Too many failures. Retry after ${new Date(status.nextRetryTime).toISOString()}`,
        executionTime: Date.now() - startTime,
        metadata: {
          circuitBreakerState: status.state,
          failureCount: status.failureCount,
          nextRetryTime: status.nextRetryTime,
        },
      };
      this.metrics.recordExecution(toolName, false, result.executionTime);
      return result;
    }

    // Validate arguments
    const validation = this.validateArguments(toolName, args);
    if (!validation.valid) {
      const result: ToolExecutionResult = {
        success: false,
        error: `Invalid arguments for tool "${toolName}": ${validation.errors?.join(', ')}`,
        executionTime: Date.now() - startTime,
        metadata: {
          validationErrors: validation.errors,
        },
      };
      this.metrics.recordExecution(toolName, false, result.executionTime);
      return result;
    }

    // Execute with timeout
    try {
      const result = await this.executeWithTimeout(
        toolDef.executor(args, context),
        this.config.timeout
      );

      // Sanitize result
      if (result.success && result.result) {
        result.result = this.sanitizeResult(result.result);
      }

      // Record metrics and circuit breaker
      this.metrics.recordExecution(toolName, result.success, result.executionTime);
      if (this.config.circuitBreakerEnabled) {
        if (result.success) {
          this.circuitBreaker.recordSuccess(toolName);
        } else {
          this.circuitBreaker.recordFailure(toolName);
        }
      }

      // Record rate limiter
      if (this.config.rateLimitingEnabled && context.conversationId) {
        this.rateLimiter.recordCall(context.conversationId, toolName);
      }

      // Audit logging
      if (this.config.auditLoggingEnabled && context.conversationId) {
        this.auditLogger.log({
          timestamp: Date.now(),
          conversationId: context.conversationId,
          toolName,
          arguments: args,
          result: {
            success: result.success,
            error: result.error,
            executionTime: result.executionTime,
          },
          metadata: result.metadata,
        });
      }

      return result;
    } catch (error) {
      const result: ToolExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during tool execution',
        executionTime: Date.now() - startTime,
      };

      this.metrics.recordExecution(toolName, false, result.executionTime);
      if (this.config.circuitBreakerEnabled) {
        this.circuitBreaker.recordFailure(toolName);
      }

      return result;
    }
  }

  /**
   * Execute multiple tool calls in sequence
   * 
   * @param toolCalls Array of tool calls
   * @param context Execution context
   * @returns Array of tool execution results
   */
  async executeToolSequence(
    toolCalls: Array<{ name: string; args: Record<string, any> }>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeTool(toolCall.name, toolCall.args, context);
      results.push(result);

      // Stop on first failure (optional - could be configurable)
      // if (!result.success) {
      //   break;
      // }
    }

    return results;
  }

  /**
   * Validate tool arguments against schema
   * 
   * @param toolName Tool name
   * @param args Arguments to validate
   * @returns Validation result
   */
  validateArguments(
    toolName: string,
    args: Record<string, any>
  ): { valid: boolean; errors?: string[] } {
    const toolDef = this.registry.getTool(toolName);
    if (!toolDef) {
      return { valid: false, errors: [`Tool "${toolName}" not found`] };
    }

    const schema = toolDef.schema;
    const errors: string[] = [];

    // Check required parameters
    for (const requiredParam of schema.parameters.required) {
      if (!(requiredParam in args)) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Validate parameter types and enums
    for (const [paramName, paramValue] of Object.entries(args)) {
      const paramDef = schema.parameters.properties[paramName];
      
      if (!paramDef) {
        errors.push(`Unknown parameter: ${paramName}`);
        continue;
      }

      // Type validation
      const actualType = typeof paramValue;
      const expectedType = paramDef.type;

      if (expectedType === 'string' && actualType !== 'string') {
        errors.push(`Parameter "${paramName}" must be a string, got ${actualType}`);
      } else if (expectedType === 'number' && actualType !== 'number') {
        errors.push(`Parameter "${paramName}" must be a number, got ${actualType}`);
      } else if (expectedType === 'boolean' && actualType !== 'boolean') {
        errors.push(`Parameter "${paramName}" must be a boolean, got ${actualType}`);
      } else if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(paramValue))) {
        errors.push(`Parameter "${paramName}" must be an object, got ${actualType}`);
      } else if (expectedType === 'array' && !Array.isArray(paramValue)) {
        errors.push(`Parameter "${paramName}" must be an array, got ${actualType}`);
      }

      // Enum validation
      if (paramDef.enum && !paramDef.enum.includes(paramValue as string)) {
        errors.push(
          `Parameter "${paramName}" must be one of: ${paramDef.enum.join(', ')}, got "${paramValue}"`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Sanitize tool results to remove dangerous content and sensitive data
   * 
   * @param result Result to sanitize
   * @returns Sanitized result
   */
  sanitizeResult(result: any): any {
    if (typeof result === 'string') {
      // Remove script tags
      result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      
      // Remove potential SQL injection patterns (basic)
      result = result.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi, '[SQL_KEYWORD]');
      
      // Remove directory traversal sequences
      result = result.replace(/\.\.[\/\\]/g, '');
      
      // Redact sensitive patterns
      result = this.redactSensitiveData(result);
    } else if (typeof result === 'object' && result !== null) {
      // Recursively sanitize objects
      if (Array.isArray(result)) {
        return result.map(item => this.sanitizeResult(item));
      } else {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(result)) {
          sanitized[key] = this.sanitizeResult(value);
        }
        return sanitized;
      }
    }

    return result;
  }

  /**
   * Redact sensitive data patterns
   * 
   * @param text Text to redact
   * @returns Redacted text
   */
  private redactSensitiveData(text: string): string {
    // API keys (various formats)
    text = text.replace(/\b[A-Za-z0-9]{32,}\b/g, (match) => {
      // Check if it looks like an API key
      if (/^(sk|pk|api|key|token)[-_]?[A-Za-z0-9]{20,}$/i.test(match)) {
        return '[REDACTED_API_KEY]';
      }
      return match;
    });

    // AWS keys
    text = text.replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]');
    text = text.replace(/aws_secret_access_key\s*=\s*[^\s]+/gi, 'aws_secret_access_key=[REDACTED]');

    // Azure keys
    text = text.replace(/[a-zA-Z0-9]{88}==/g, '[REDACTED_AZURE_KEY]');

    // GitHub tokens
    text = text.replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]');
    text = text.replace(/gho_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]');

    // Generic tokens
    text = text.replace(/\b(token|bearer|auth|authorization)[\s:=]+[A-Za-z0-9\-._~+\/]+=*/gi, '$1=[REDACTED_TOKEN]');

    // Passwords
    text = text.replace(/\b(password|passwd|pwd)[\s:=]+[^\s]+/gi, '$1=[REDACTED_PASSWORD]');

    // Email addresses (optional - might be needed for debugging)
    // text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');

    // Credit card numbers
    text = text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_CC]');

    // Social Security Numbers (US)
    text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');

    // Private keys
    text = text.replace(/-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |DSA )?PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]');

    // JWT tokens
    text = text.replace(/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '[REDACTED_JWT]');

    return text;
  }

  /**
   * Execute a promise with timeout
   * 
   * @param promise Promise to execute
   * @param timeout Timeout in milliseconds
   * @returns Promise result
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Get execution metrics
   * 
   * @returns Tool metrics
   */
  getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Get circuit breaker statuses
   * 
   * @returns Circuit breaker statuses
   */
  getCircuitBreakerStatuses() {
    return this.circuitBreaker.getAllStatuses();
  }

  /**
   * Reset circuit breaker for a tool
   * 
   * @param toolName Tool name
   */
  resetCircuitBreaker(toolName: string): void {
    this.circuitBreaker.reset(toolName);
  }
}
