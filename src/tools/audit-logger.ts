/**
 * Audit Logger
 * 
 * Logs all tool executions for security auditing and compliance.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AuditLogEntry {
  timestamp: number;
  conversationId: string;
  toolName: string;
  arguments: Record<string, any>;
  result: {
    success: boolean;
    error?: string;
    executionTime: number;
  };
  securityViolations?: string[];
  rateLimitViolation?: boolean;
  metadata?: Record<string, any>;
}

export interface AuditLoggerConfig {
  enabled: boolean;
  logFilePath: string;
  logToConsole: boolean;
  logToFile: boolean;
}

/**
 * Audit Logger for tool executions
 */
export class AuditLogger {
  private config: AuditLoggerConfig;
  private logBuffer: AuditLogEntry[];
  private flushInterval: NodeJS.Timeout | null;

  constructor(config: Partial<AuditLoggerConfig> = {}) {
    this.config = {
      enabled: config.enabled !== undefined ? config.enabled : true,
      logFilePath: config.logFilePath || path.join(process.cwd(), 'data', 'audit-logs', 'tool-executions.jsonl'),
      logToConsole: config.logToConsole !== undefined ? config.logToConsole : true,
      logToFile: config.logToFile !== undefined ? config.logToFile : true,
    };

    this.logBuffer = [];
    this.flushInterval = null;

    // Start auto-flush every 5 seconds
    if (this.config.enabled && this.config.logToFile) {
      this.startAutoFlush();
    }
  }

  /**
   * Log a tool execution
   * 
   * @param entry Audit log entry
   */
  log(entry: AuditLogEntry): void {
    if (!this.config.enabled) {
      return;
    }

    // Add to buffer
    this.logBuffer.push(entry);

    // Log to console if enabled
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }

    // Flush if buffer is large
    if (this.logBuffer.length >= 100) {
      this.flush();
    }
  }

  /**
   * Log to console
   * 
   * @param entry Audit log entry
   */
  private logToConsole(entry: AuditLogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const status = entry.result.success ? '✓' : '✗';
    const securityFlag = entry.securityViolations ? ' [SECURITY]' : '';
    const rateLimitFlag = entry.rateLimitViolation ? ' [RATE_LIMIT]' : '';

    console.log(
      `[Audit] ${timestamp} ${status} ${entry.toolName} (${entry.conversationId})${securityFlag}${rateLimitFlag}`
    );

    if (entry.securityViolations) {
      console.error(`  Security violations:`, entry.securityViolations);
    }

    if (!entry.result.success && entry.result.error) {
      console.error(`  Error: ${entry.result.error}`);
    }
  }

  /**
   * Flush log buffer to file
   */
  flush(): void {
    if (!this.config.enabled || !this.config.logToFile || this.logBuffer.length === 0) {
      return;
    }

    try {
      // Ensure directory exists
      const logDir = path.dirname(this.config.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append to log file (JSONL format - one JSON object per line)
      const logLines = this.logBuffer.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      fs.appendFileSync(this.config.logFilePath, logLines, 'utf-8');

      // Clear buffer
      this.logBuffer = [];
    } catch (error) {
      console.error('[Audit] Failed to write audit log:', error);
    }
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Stop auto-flush timer
   */
  private stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Query audit logs
   * 
   * @param filter Filter criteria
   * @returns Matching audit log entries
   */
  query(filter: {
    conversationId?: string;
    toolName?: string;
    startTime?: number;
    endTime?: number;
    successOnly?: boolean;
    failuresOnly?: boolean;
    securityViolationsOnly?: boolean;
  }): AuditLogEntry[] {
    if (!this.config.enabled || !this.config.logToFile) {
      return [];
    }

    try {
      // Read log file
      if (!fs.existsSync(this.config.logFilePath)) {
        return [];
      }

      const logContent = fs.readFileSync(this.config.logFilePath, 'utf-8');
      const lines = logContent.trim().split('\n');

      // Parse and filter entries
      const entries: AuditLogEntry[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line) as AuditLogEntry;

          // Apply filters
          if (filter.conversationId && entry.conversationId !== filter.conversationId) {
            continue;
          }

          if (filter.toolName && entry.toolName !== filter.toolName) {
            continue;
          }

          if (filter.startTime && entry.timestamp < filter.startTime) {
            continue;
          }

          if (filter.endTime && entry.timestamp > filter.endTime) {
            continue;
          }

          if (filter.successOnly && !entry.result.success) {
            continue;
          }

          if (filter.failuresOnly && entry.result.success) {
            continue;
          }

          if (filter.securityViolationsOnly && !entry.securityViolations) {
            continue;
          }

          entries.push(entry);
        } catch (parseError) {
          console.error('[Audit] Failed to parse log entry:', parseError);
        }
      }

      return entries;
    } catch (error) {
      console.error('[Audit] Failed to query audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit statistics
   * 
   * @returns Audit statistics
   */
  getStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    securityViolations: number;
    rateLimitViolations: number;
    executionsByTool: Record<string, number>;
  } {
    const entries = this.query({});

    const stats = {
      totalExecutions: entries.length,
      successfulExecutions: 0,
      failedExecutions: 0,
      securityViolations: 0,
      rateLimitViolations: 0,
      executionsByTool: {} as Record<string, number>,
    };

    for (const entry of entries) {
      if (entry.result.success) {
        stats.successfulExecutions++;
      } else {
        stats.failedExecutions++;
      }

      if (entry.securityViolations) {
        stats.securityViolations++;
      }

      if (entry.rateLimitViolation) {
        stats.rateLimitViolations++;
      }

      stats.executionsByTool[entry.toolName] = (stats.executionsByTool[entry.toolName] || 0) + 1;
    }

    return stats;
  }

  /**
   * Close audit logger and flush remaining logs
   */
  close(): void {
    this.stopAutoFlush();
    this.flush();
  }

  /**
   * Get configuration
   */
  getConfig(): AuditLoggerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AuditLoggerConfig>): void {
    const wasEnabled = this.config.enabled && this.config.logToFile;
    this.config = { ...this.config, ...config };
    const isEnabled = this.config.enabled && this.config.logToFile;

    // Restart auto-flush if needed
    if (!wasEnabled && isEnabled) {
      this.startAutoFlush();
    } else if (wasEnabled && !isEnabled) {
      this.stopAutoFlush();
    }
  }
}

/**
 * Global audit logger instance
 */
let globalAuditLogger: AuditLogger | null = null;

/**
 * Get or create global audit logger
 */
export function getAuditLogger(): AuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new AuditLogger();
  }
  return globalAuditLogger;
}

/**
 * Initialize audit logger with custom config
 */
export function initializeAuditLogger(config?: Partial<AuditLoggerConfig>): AuditLogger {
  globalAuditLogger = new AuditLogger(config);
  return globalAuditLogger;
}
