/**
 * Browser Automation Metrics Collector
 * 
 * Collects and exposes metrics for monitoring browser automation activities.
 * Tracks action count, error rate, execution time, and other performance metrics.
 * Integrates with Prometheus metrics system.
 * 
 * Requirements: 14.6
 */

import { EventEmitter } from 'events';
import { BrowserAction, ActionResult } from './types/index.js';

/**
 * Metrics data structure
 */
export interface Metrics {
  // Action metrics
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  actionsByType: Record<string, number>;

  // Error metrics
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsByClass: Record<string, number>;

  // Performance metrics
  totalExecutionTime: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  executionTimeByAction: Record<string, {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
  }>;

  // Connection metrics
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  reconnections: number;

  // Browser metrics
  activeBrowsers: number;
  totalBrowserLaunches: number;
  browserCrashes: number;
  idleTimeouts: number;

  // Timestamp
  lastUpdated: number;
  startTime: number;
  uptime: number;
}

/**
 * Metrics collector configuration
 */
export interface MetricsCollectorConfig {
  enabled: boolean;
  resetOnRead: boolean;
  trackDetailedMetrics: boolean;
}

/**
 * Default metrics collector configuration
 */
const DEFAULT_CONFIG: MetricsCollectorConfig = {
  enabled: true,
  resetOnRead: false,
  trackDetailedMetrics: true,
};

/**
 * Browser Automation Metrics Collector
 * 
 * Collects and aggregates metrics for monitoring and observability
 */
export class MetricsCollector extends EventEmitter {
  private config: MetricsCollectorConfig;
  private metrics: Metrics;
  private startTime: number;

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Record an action execution
   * @param action The browser action that was executed
   * @param result The result of the action execution
   */
  recordAction(action: BrowserAction, result: ActionResult): void {
    if (!this.config.enabled) {
      return;
    }

    // Update action counts
    this.metrics.totalActions++;
    if (result.success) {
      this.metrics.successfulActions++;
    } else {
      this.metrics.failedActions++;
    }

    // Update actions by type
    const actionType = action.type;
    this.metrics.actionsByType[actionType] = (this.metrics.actionsByType[actionType] || 0) + 1;

    // Update execution time metrics
    const executionTime = result.executionTime;
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / this.metrics.totalActions;

    if (this.metrics.minExecutionTime === 0 || executionTime < this.metrics.minExecutionTime) {
      this.metrics.minExecutionTime = executionTime;
    }

    if (executionTime > this.metrics.maxExecutionTime) {
      this.metrics.maxExecutionTime = executionTime;
    }

    // Update detailed execution time by action type
    if (this.config.trackDetailedMetrics) {
      if (!this.metrics.executionTimeByAction[actionType]) {
        this.metrics.executionTimeByAction[actionType] = {
          count: 0,
          total: 0,
          average: 0,
          min: executionTime,
          max: executionTime,
        };
      }

      const actionMetrics = this.metrics.executionTimeByAction[actionType];
      actionMetrics.count++;
      actionMetrics.total += executionTime;
      actionMetrics.average = actionMetrics.total / actionMetrics.count;

      if (executionTime < actionMetrics.min) {
        actionMetrics.min = executionTime;
      }

      if (executionTime > actionMetrics.max) {
        actionMetrics.max = executionTime;
      }
    }

    // Update error metrics if action failed
    if (!result.success && result.error) {
      this.recordError(result.error.code, this.classifyError(result.error.message));
    }

    // Update timestamp
    this.metrics.lastUpdated = Date.now();
    this.metrics.uptime = this.metrics.lastUpdated - this.startTime;

    this.emit('action-recorded', { action, result });
  }

  /**
   * Record an error
   * @param errorCode Error code
   * @param errorClass Error classification
   */
  recordError(errorCode: string, errorClass: string): void {
    if (!this.config.enabled) {
      return;
    }

    this.metrics.totalErrors++;

    // Update errors by code
    this.metrics.errorsByCode[errorCode] = (this.metrics.errorsByCode[errorCode] || 0) + 1;

    // Update errors by class
    this.metrics.errorsByClass[errorClass] = (this.metrics.errorsByClass[errorClass] || 0) + 1;

    // Update timestamp
    this.metrics.lastUpdated = Date.now();
    this.metrics.uptime = this.metrics.lastUpdated - this.startTime;

    this.emit('error-recorded', { errorCode, errorClass });
  }

  /**
   * Record a browser connection event
   * @param event Connection event type
   */
  recordConnection(event: 'connected' | 'disconnected' | 'reconnected' | 'failed'): void {
    if (!this.config.enabled) {
      return;
    }

    switch (event) {
      case 'connected':
        this.metrics.totalConnections++;
        this.metrics.activeConnections++;
        break;

      case 'disconnected':
        this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
        break;

      case 'reconnected':
        this.metrics.reconnections++;
        this.metrics.activeConnections++;
        break;

      case 'failed':
        this.metrics.failedConnections++;
        break;
    }

    // Update timestamp
    this.metrics.lastUpdated = Date.now();
    this.metrics.uptime = this.metrics.lastUpdated - this.startTime;

    this.emit('connection-recorded', { event });
  }

  /**
   * Record a browser launch
   */
  recordBrowserLaunch(): void {
    if (!this.config.enabled) {
      return;
    }

    this.metrics.totalBrowserLaunches++;
    this.metrics.activeBrowsers++;

    // Update timestamp
    this.metrics.lastUpdated = Date.now();
    this.metrics.uptime = this.metrics.lastUpdated - this.startTime;

    this.emit('browser-launch-recorded');
  }

  /**
   * Record a browser close
   */
  recordBrowserClose(): void {
    if (!this.config.enabled) {
      return;
    }

    this.metrics.activeBrowsers = Math.max(0, this.metrics.activeBrowsers - 1);

    // Update timestamp
    this.metrics.lastUpdated = Date.now();
    this.metrics.uptime = this.metrics.lastUpdated - this.startTime;

    this.emit('browser-close-recorded');
  }

  /**
   * Record a browser crash
   */
  recordBrowserCrash(): void {
    if (!this.config.enabled) {
      return;
    }

    this.metrics.browserCrashes++;
    this.metrics.activeBrowsers = Math.max(0, this.metrics.activeBrowsers - 1);

    // Update timestamp
    this.metrics.lastUpdated = Date.now();
    this.metrics.uptime = this.metrics.lastUpdated - this.startTime;

    this.emit('browser-crash-recorded');
  }

  /**
   * Record an idle timeout
   */
  recordIdleTimeout(): void {
    if (!this.config.enabled) {
      return;
    }

    this.metrics.idleTimeouts++;

    // Update timestamp
    this.metrics.lastUpdated = Date.now();
    this.metrics.uptime = this.metrics.lastUpdated - this.startTime;

    this.emit('idle-timeout-recorded');
  }

  /**
   * Get current metrics
   * @param reset Whether to reset metrics after reading
   * @returns Current metrics snapshot
   */
  getMetrics(reset: boolean = false): Metrics {
    const snapshot = { ...this.metrics };

    if (reset || this.config.resetOnRead) {
      this.resetMetrics();
    }

    return snapshot;
  }

  /**
   * Get metrics in Prometheus format
   * @returns Metrics formatted for Prometheus
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Action metrics
    lines.push('# HELP browser_automation_actions_total Total number of browser actions executed');
    lines.push('# TYPE browser_automation_actions_total counter');
    lines.push(`browser_automation_actions_total ${this.metrics.totalActions}`);

    lines.push('# HELP browser_automation_actions_successful_total Total number of successful actions');
    lines.push('# TYPE browser_automation_actions_successful_total counter');
    lines.push(`browser_automation_actions_successful_total ${this.metrics.successfulActions}`);

    lines.push('# HELP browser_automation_actions_failed_total Total number of failed actions');
    lines.push('# TYPE browser_automation_actions_failed_total counter');
    lines.push(`browser_automation_actions_failed_total ${this.metrics.failedActions}`);

    // Actions by type
    lines.push('# HELP browser_automation_actions_by_type_total Total actions by type');
    lines.push('# TYPE browser_automation_actions_by_type_total counter');
    for (const [type, count] of Object.entries(this.metrics.actionsByType)) {
      lines.push(`browser_automation_actions_by_type_total{type="${type}"} ${count}`);
    }

    // Error metrics
    lines.push('# HELP browser_automation_errors_total Total number of errors');
    lines.push('# TYPE browser_automation_errors_total counter');
    lines.push(`browser_automation_errors_total ${this.metrics.totalErrors}`);

    // Errors by code
    lines.push('# HELP browser_automation_errors_by_code_total Total errors by code');
    lines.push('# TYPE browser_automation_errors_by_code_total counter');
    for (const [code, count] of Object.entries(this.metrics.errorsByCode)) {
      lines.push(`browser_automation_errors_by_code_total{code="${code}"} ${count}`);
    }

    // Performance metrics
    lines.push('# HELP browser_automation_execution_time_ms_total Total execution time in milliseconds');
    lines.push('# TYPE browser_automation_execution_time_ms_total counter');
    lines.push(`browser_automation_execution_time_ms_total ${this.metrics.totalExecutionTime}`);

    lines.push('# HELP browser_automation_execution_time_ms_average Average execution time in milliseconds');
    lines.push('# TYPE browser_automation_execution_time_ms_average gauge');
    lines.push(`browser_automation_execution_time_ms_average ${this.metrics.averageExecutionTime}`);

    lines.push('# HELP browser_automation_execution_time_ms_min Minimum execution time in milliseconds');
    lines.push('# TYPE browser_automation_execution_time_ms_min gauge');
    lines.push(`browser_automation_execution_time_ms_min ${this.metrics.minExecutionTime}`);

    lines.push('# HELP browser_automation_execution_time_ms_max Maximum execution time in milliseconds');
    lines.push('# TYPE browser_automation_execution_time_ms_max gauge');
    lines.push(`browser_automation_execution_time_ms_max ${this.metrics.maxExecutionTime}`);

    // Connection metrics
    lines.push('# HELP browser_automation_connections_total Total number of connections');
    lines.push('# TYPE browser_automation_connections_total counter');
    lines.push(`browser_automation_connections_total ${this.metrics.totalConnections}`);

    lines.push('# HELP browser_automation_connections_active Active connections');
    lines.push('# TYPE browser_automation_connections_active gauge');
    lines.push(`browser_automation_connections_active ${this.metrics.activeConnections}`);

    lines.push('# HELP browser_automation_connections_failed_total Total failed connections');
    lines.push('# TYPE browser_automation_connections_failed_total counter');
    lines.push(`browser_automation_connections_failed_total ${this.metrics.failedConnections}`);

    lines.push('# HELP browser_automation_reconnections_total Total reconnections');
    lines.push('# TYPE browser_automation_reconnections_total counter');
    lines.push(`browser_automation_reconnections_total ${this.metrics.reconnections}`);

    // Browser metrics
    lines.push('# HELP browser_automation_browsers_active Active browsers');
    lines.push('# TYPE browser_automation_browsers_active gauge');
    lines.push(`browser_automation_browsers_active ${this.metrics.activeBrowsers}`);

    lines.push('# HELP browser_automation_browser_launches_total Total browser launches');
    lines.push('# TYPE browser_automation_browser_launches_total counter');
    lines.push(`browser_automation_browser_launches_total ${this.metrics.totalBrowserLaunches}`);

    lines.push('# HELP browser_automation_browser_crashes_total Total browser crashes');
    lines.push('# TYPE browser_automation_browser_crashes_total counter');
    lines.push(`browser_automation_browser_crashes_total ${this.metrics.browserCrashes}`);

    lines.push('# HELP browser_automation_idle_timeouts_total Total idle timeouts');
    lines.push('# TYPE browser_automation_idle_timeouts_total counter');
    lines.push(`browser_automation_idle_timeouts_total ${this.metrics.idleTimeouts}`);

    // Uptime
    lines.push('# HELP browser_automation_uptime_ms Uptime in milliseconds');
    lines.push('# TYPE browser_automation_uptime_ms counter');
    lines.push(`browser_automation_uptime_ms ${this.metrics.uptime}`);

    return lines.join('\n') + '\n';
  }

  /**
   * Reset all metrics to initial state
   */
  resetMetrics(): void {
    this.metrics = this.createEmptyMetrics();
    this.startTime = Date.now();
    this.emit('metrics-reset');
  }

  /**
   * Update collector configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<MetricsCollectorConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }

  /**
   * Get current configuration
   * @returns Current collector configuration
   */
  getConfig(): MetricsCollectorConfig {
    return { ...this.config };
  }

  /**
   * Create an empty metrics object
   * @returns Empty metrics
   */
  private createEmptyMetrics(): Metrics {
    return {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      actionsByType: {},
      totalErrors: 0,
      errorsByCode: {},
      errorsByClass: {},
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      minExecutionTime: 0,
      maxExecutionTime: 0,
      executionTimeByAction: {},
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      reconnections: 0,
      activeBrowsers: 0,
      totalBrowserLaunches: 0,
      browserCrashes: 0,
      idleTimeouts: 0,
      lastUpdated: Date.now(),
      startTime: this.startTime,
      uptime: 0,
    };
  }

  /**
   * Classify an error message into a category
   * @param message Error message
   * @returns Error classification
   */
  private classifyError(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('timeout')) {
      return 'timeout';
    } else if (lowerMessage.includes('not found') || lowerMessage.includes('no element')) {
      return 'element_not_found';
    } else if (lowerMessage.includes('navigation') || lowerMessage.includes('navigate')) {
      return 'navigation';
    } else if (lowerMessage.includes('connection') || lowerMessage.includes('disconnect')) {
      return 'connection';
    } else if (lowerMessage.includes('selector')) {
      return 'selector';
    } else if (lowerMessage.includes('script') || lowerMessage.includes('evaluate')) {
      return 'script';
    } else if (lowerMessage.includes('network')) {
      return 'network';
    } else if (lowerMessage.includes('permission') || lowerMessage.includes('denied')) {
      return 'permission';
    } else {
      return 'unknown';
    }
  }
}

/**
 * Global metrics collector instance
 */
let globalCollector: MetricsCollector | null = null;

/**
 * Get or create the global metrics collector instance
 * @returns Global metrics collector instance
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalCollector) {
    globalCollector = new MetricsCollector();
  }
  return globalCollector;
}

/**
 * Initialize the metrics collector with custom configuration
 * @param config Metrics collector configuration
 * @returns Metrics collector instance
 */
export function initializeMetricsCollector(config?: Partial<MetricsCollectorConfig>): MetricsCollector {
  globalCollector = new MetricsCollector(config);
  return globalCollector;
}
