/**
 * Tool Metrics
 * 
 * Tracks tool execution metrics for monitoring and performance analysis.
 */

export interface ToolMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  callsByTool: Record<string, number>;
  errorsByTool: Record<string, number>;
  executionTimesByTool: Record<string, number[]>;
  lastUpdated: number;
}

export class ToolMetricsTracker {
  private metrics: ToolMetrics = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    averageExecutionTime: 0,
    callsByTool: {},
    errorsByTool: {},
    executionTimesByTool: {},
    lastUpdated: Date.now(),
  };

  /**
   * Record a tool execution
   */
  recordExecution(toolName: string, success: boolean, executionTime: number): void {
    this.metrics.totalCalls++;
    
    if (success) {
      this.metrics.successfulCalls++;
    } else {
      this.metrics.failedCalls++;
      this.metrics.errorsByTool[toolName] = (this.metrics.errorsByTool[toolName] || 0) + 1;
    }

    // Track calls by tool
    this.metrics.callsByTool[toolName] = (this.metrics.callsByTool[toolName] || 0) + 1;

    // Track execution times
    if (!this.metrics.executionTimesByTool[toolName]) {
      this.metrics.executionTimesByTool[toolName] = [];
    }
    this.metrics.executionTimesByTool[toolName].push(executionTime);

    // Update average execution time
    this.updateAverageExecutionTime();

    this.metrics.lastUpdated = Date.now();
  }

  /**
   * Update average execution time across all tools
   */
  private updateAverageExecutionTime(): void {
    const allTimes = Object.values(this.metrics.executionTimesByTool).flat();
    if (allTimes.length > 0) {
      this.metrics.averageExecutionTime = 
        allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ToolMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics for a specific tool
   */
  getToolMetrics(toolName: string): {
    calls: number;
    errors: number;
    averageExecutionTime: number;
    successRate: number;
  } {
    const calls = this.metrics.callsByTool[toolName] || 0;
    const errors = this.metrics.errorsByTool[toolName] || 0;
    const times = this.metrics.executionTimesByTool[toolName] || [];
    const averageExecutionTime = times.length > 0
      ? times.reduce((sum, time) => sum + time, 0) / times.length
      : 0;
    const successRate = calls > 0 ? ((calls - errors) / calls) * 100 : 0;

    return {
      calls,
      errors,
      averageExecutionTime,
      successRate,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageExecutionTime: 0,
      callsByTool: {},
      errorsByTool: {},
      executionTimesByTool: {},
      lastUpdated: Date.now(),
    };
  }
}
