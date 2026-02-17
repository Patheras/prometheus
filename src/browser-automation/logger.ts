/**
 * Browser Automation Logger
 * 
 * Comprehensive logging system for browser automation activities.
 * Integrates with Prometheus logging infrastructure and provides
 * structured logging for actions, errors, and connection events.
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { EventEmitter } from 'events';
import { BrowserAction, ActionResult, BrowserVersion } from './types/index.js';

/**
 * Log levels for browser automation
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Action log entry
 */
export interface ActionLogEntry {
  type: 'action';
  timestamp: number;
  actionType: string;
  parameters: Record<string, any>;
  executionTime: number;
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
  browserId?: string;
  profileName?: string;
}

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  type: 'error';
  timestamp: number;
  errorCode: string;
  errorMessage: string;
  errorClass: string;
  context: Record<string, any>;
  stackTrace?: string;
  browserId?: string;
  profileName?: string;
}

/**
 * Connection event log entry
 */
export interface ConnectionLogEntry {
  type: 'connection';
  timestamp: number;
  event: 'connected' | 'disconnected' | 'reconnected' | 'failed';
  browserId: string;
  profileName: string;
  browserMetadata?: {
    version?: string;
    userAgent?: string;
    protocolVersion?: string;
  };
  reason?: string;
}

/**
 * Generic log entry
 */
export interface GenericLogEntry {
  type: 'generic';
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

/**
 * Union type for all log entries
 */
export type LogEntry = ActionLogEntry | ErrorLogEntry | ConnectionLogEntry | GenericLogEntry;

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  logActions: boolean;
  logErrors: boolean;
  logConnections: boolean;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  logActions: true,
  logErrors: true,
  logConnections: true,
  enableConsole: true,
  enableFile: false,
};

/**
 * Browser Automation Logger
 * 
 * Provides structured logging for all browser automation activities
 */
export class BrowserAutomationLogger extends EventEmitter {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;

  constructor(config: Partial<LoggerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log a browser action execution
   * @param action The browser action that was executed
   * @param result The result of the action execution
   * @param browserId Optional browser ID
   * @param profileName Optional profile name
   */
  logAction(
    action: BrowserAction,
    result: ActionResult,
    browserId?: string,
    profileName?: string
  ): void {
    if (!this.config.logActions) {
      return;
    }

    const entry: ActionLogEntry = {
      type: 'action',
      timestamp: result.timestamp,
      actionType: action.type,
      parameters: this.extractActionParameters(action),
      executionTime: result.executionTime,
      success: result.success,
      browserId,
      profileName,
    };

    if (!result.success && result.error) {
      entry.error = {
        code: result.error.code,
        message: result.error.message,
      };
    }

    this.addToBuffer(entry);
    this.emitLog('action', entry);

    // Log to console based on level
    if (this.config.enableConsole) {
      const level = result.success ? 'info' : 'error';
      if (this.shouldLog(level)) {
        this.logToConsole(level, this.formatActionLog(entry));
      }
    }
  }

  /**
   * Log an error with full context and stack trace
   * @param error The error object
   * @param context Additional context information
   * @param browserId Optional browser ID
   * @param profileName Optional profile name
   */
  logError(
    error: Error | string,
    context: Record<string, any> = {},
    browserId?: string,
    profileName?: string
  ): void {
    if (!this.config.logErrors) {
      return;
    }

    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const errorClass = this.classifyError(errorObj);

    const entry: ErrorLogEntry = {
      type: 'error',
      timestamp: Date.now(),
      errorCode: context.code || 'UNKNOWN_ERROR',
      errorMessage: errorObj.message,
      errorClass,
      context,
      stackTrace: errorObj.stack,
      browserId,
      profileName,
    };

    this.addToBuffer(entry);
    this.emitLog('error', entry);

    // Always log errors to console if enabled
    if (this.config.enableConsole && this.shouldLog('error')) {
      this.logToConsole('error', this.formatErrorLog(entry));
    }
  }

  /**
   * Log a browser connection event
   * @param event The connection event type
   * @param browserId Browser ID
   * @param profileName Profile name
   * @param browserMetadata Optional browser metadata
   * @param reason Optional reason for disconnection/failure
   */
  logConnection(
    event: 'connected' | 'disconnected' | 'reconnected' | 'failed',
    browserId: string,
    profileName: string,
    browserMetadata?: BrowserVersion,
    reason?: string
  ): void {
    if (!this.config.logConnections) {
      return;
    }

    const entry: ConnectionLogEntry = {
      type: 'connection',
      timestamp: Date.now(),
      event,
      browserId,
      profileName,
      reason,
    };

    if (browserMetadata) {
      entry.browserMetadata = {
        version: browserMetadata.browser,
        userAgent: browserMetadata.userAgent,
        protocolVersion: browserMetadata.protocolVersion,
      };
    }

    this.addToBuffer(entry);
    this.emitLog('connection', entry);

    // Log to console based on event type
    if (this.config.enableConsole) {
      const level = event === 'failed' || event === 'disconnected' ? 'warn' : 'info';
      if (this.shouldLog(level)) {
        this.logToConsole(level, this.formatConnectionLog(entry));
      }
    }
  }

  /**
   * Log a generic message with level and context
   * @param level Log level
   * @param message Log message
   * @param context Optional context information
   */
  log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: GenericLogEntry = {
      type: 'generic',
      timestamp: Date.now(),
      level,
      message,
      context,
    };

    this.addToBuffer(entry);
    this.emitLog('log', entry);

    if (this.config.enableConsole) {
      this.logToConsole(level, this.formatGenericLog(entry));
    }
  }

  /**
   * Get all log entries from the buffer
   * @returns Array of log entries
   */
  getLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Get log entries filtered by type
   * @param type Log entry type
   * @returns Filtered log entries
   */
  getLogsByType(type: LogEntry['type']): LogEntry[] {
    return this.logBuffer.filter(entry => entry.type === type);
  }

  /**
   * Clear the log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
    this.emit('logs-cleared');
  }

  /**
   * Update logger configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }

  /**
   * Get current configuration
   * @returns Current logger configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Extract parameters from a browser action for logging
   * @param action Browser action
   * @returns Parameters object
   */
  private extractActionParameters(action: BrowserAction): Record<string, any> {
    const params: Record<string, any> = {};

    switch (action.type) {
      case 'navigate':
        params.url = action.url;
        params.waitUntil = action.waitUntil;
        params.timeout = action.timeout;
        break;

      case 'click':
        params.selector = action.selector;
        params.button = action.button;
        params.clickCount = action.clickCount;
        params.timeout = action.timeout;
        break;

      case 'type':
        params.selector = action.selector;
        params.textLength = action.text?.length || 0;
        params.delay = action.delay;
        params.timeout = action.timeout;
        break;

      case 'screenshot':
        params.fullPage = action.fullPage;
        params.format = action.format;
        params.quality = action.quality;
        params.hasPath = !!action.path;
        break;

      case 'snapshot':
        params.includeIframes = action.includeIframes;
        break;

      case 'pdf':
        params.format = action.format;
        params.width = action.width;
        params.height = action.height;
        params.hasPath = !!action.path;
        break;

      case 'execute_js':
        params.scriptLength = action.script.length;
        params.argsCount = action.args?.length || 0;
        break;

      case 'wait':
        params.condition = action.condition;
        params.selector = action.selector;
        params.state = action.state;
        params.loadState = action.loadState;
        params.timeout = action.timeout;
        break;

      case 'scroll':
        params.target = action.target;
        params.selector = action.selector;
        params.x = action.x;
        params.y = action.y;
        break;

      case 'select':
        params.selector = action.selector;
        params.valuesCount = action.values.length;
        break;

      case 'upload':
        params.selector = action.selector;
        params.fileCount = action.filePaths.length;
        break;
    }

    return params;
  }

  /**
   * Classify an error into a category
   * @param error Error object
   * @returns Error classification
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) {
      return 'timeout';
    } else if (message.includes('not found') || message.includes('no element')) {
      return 'element_not_found';
    } else if (message.includes('navigation') || message.includes('navigate')) {
      return 'navigation';
    } else if (message.includes('connection') || message.includes('disconnect')) {
      return 'connection';
    } else if (message.includes('selector')) {
      return 'selector';
    } else if (message.includes('script') || message.includes('evaluate')) {
      return 'script';
    } else if (message.includes('network')) {
      return 'network';
    } else if (message.includes('permission') || message.includes('denied')) {
      return 'permission';
    } else {
      return 'unknown';
    }
  }

  /**
   * Check if a log level should be logged based on configuration
   * @param level Log level to check
   * @returns True if should log
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= configLevelIndex;
  }

  /**
   * Add an entry to the log buffer
   * @param entry Log entry to add
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Trim buffer if it exceeds max size
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer = this.logBuffer.slice(-this.MAX_BUFFER_SIZE);
    }
  }

  /**
   * Emit a log event
   * @param eventName Event name
   * @param entry Log entry
   */
  private emitLog(eventName: string, entry: LogEntry): void {
    // Don't emit 'error' as an event name to avoid triggering error handlers
    // Use 'log-error' instead for error log entries
    const safeEventName = eventName === 'error' ? 'log-error' : eventName;
    this.emit(safeEventName, entry);
    this.emit('log', entry);
  }

  /**
   * Log to console with appropriate formatting
   * @param level Log level
   * @param message Formatted message
   */
  private logToConsole(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [browser-automation] [${level.toUpperCase()}]`;

    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${message}`);
        break;
      case 'info':
        console.info(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
    }
  }

  /**
   * Format an action log entry for console output
   * @param entry Action log entry
   * @returns Formatted message
   */
  private formatActionLog(entry: ActionLogEntry): string {
    const status = entry.success ? 'SUCCESS' : 'FAILED';
    const params = JSON.stringify(entry.parameters);
    let message = `Action ${entry.actionType} ${status} (${entry.executionTime}ms)`;

    if (entry.browserId) {
      message += ` [browser: ${entry.browserId.substring(0, 8)}]`;
    }

    if (entry.profileName) {
      message += ` [profile: ${entry.profileName}]`;
    }

    message += ` params: ${params}`;

    if (entry.error) {
      message += ` error: ${entry.error.code} - ${entry.error.message}`;
    }

    return message;
  }

  /**
   * Format an error log entry for console output
   * @param entry Error log entry
   * @returns Formatted message
   */
  private formatErrorLog(entry: ErrorLogEntry): string {
    let message = `Error [${entry.errorClass}] ${entry.errorCode}: ${entry.errorMessage}`;

    if (entry.browserId) {
      message += ` [browser: ${entry.browserId.substring(0, 8)}]`;
    }

    if (entry.profileName) {
      message += ` [profile: ${entry.profileName}]`;
    }

    if (Object.keys(entry.context).length > 0) {
      message += ` context: ${JSON.stringify(entry.context)}`;
    }

    if (entry.stackTrace) {
      message += `\n${entry.stackTrace}`;
    }

    return message;
  }

  /**
   * Format a connection log entry for console output
   * @param entry Connection log entry
   * @returns Formatted message
   */
  private formatConnectionLog(entry: ConnectionLogEntry): string {
    let message = `Browser ${entry.event.toUpperCase()}`;
    message += ` [browser: ${entry.browserId.substring(0, 8)}]`;
    message += ` [profile: ${entry.profileName}]`;

    if (entry.browserMetadata) {
      message += ` [version: ${entry.browserMetadata.version}]`;
    }

    if (entry.reason) {
      message += ` reason: ${entry.reason}`;
    }

    return message;
  }

  /**
   * Format a generic log entry for console output
   * @param entry Generic log entry
   * @returns Formatted message
   */
  private formatGenericLog(entry: GenericLogEntry): string {
    let message = entry.message;

    if (entry.context && Object.keys(entry.context).length > 0) {
      message += ` ${JSON.stringify(entry.context)}`;
    }

    return message;
  }
}

/**
 * Global logger instance
 */
let globalLogger: BrowserAutomationLogger | null = null;

/**
 * Get or create the global logger instance
 * @returns Global logger instance
 */
export function getLogger(): BrowserAutomationLogger {
  if (!globalLogger) {
    globalLogger = new BrowserAutomationLogger();
  }
  return globalLogger;
}

/**
 * Initialize the logger with custom configuration
 * @param config Logger configuration
 * @returns Logger instance
 */
export function initializeLogger(config?: Partial<LoggerConfig>): BrowserAutomationLogger {
  globalLogger = new BrowserAutomationLogger(config);
  return globalLogger;
}
