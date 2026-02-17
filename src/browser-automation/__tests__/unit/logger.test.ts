/**
 * Unit tests for BrowserAutomationLogger
 * 
 * Tests action logging, error logging, connection event logging, and log management.
 */

import { BrowserAutomationLogger, LogLevel } from '../../logger.js';
import { BrowserAction, ActionResult } from '../../types/index.js';

describe('BrowserAutomationLogger', () => {
  let logger: BrowserAutomationLogger;

  beforeEach(() => {
    logger = new BrowserAutomationLogger({
      level: 'debug',
      logActions: true,
      logErrors: true,
      logConnections: true,
      enableConsole: false, // Disable console output for tests
    });
  });

  describe('Action Logging', () => {
    it('should log successful action execution', () => {
      const action: BrowserAction = {
        type: 'navigate',
        url: 'https://example.com',
        waitUntil: 'load',
      };

      const result: ActionResult = {
        success: true,
        action,
        result: { url: 'https://example.com', status: 200, title: 'Example', loadTime: 500 },
        executionTime: 500,
        timestamp: Date.now(),
      };

      logger.logAction(action, result, 'browser-123', 'openclaw');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.type).toBe('action');
      if (log.type === 'action') {
        expect(log.actionType).toBe('navigate');
        expect(log.success).toBe(true);
        expect(log.executionTime).toBe(500);
        expect(log.browserId).toBe('browser-123');
        expect(log.profileName).toBe('openclaw');
        expect(log.parameters).toHaveProperty('url', 'https://example.com');
      }
    });

    it('should log failed action execution with error', () => {
      const action: BrowserAction = {
        type: 'click',
        selector: '#missing-button',
      };

      const result: ActionResult = {
        success: false,
        action,
        error: {
          code: 'ELEMENT_NOT_FOUND',
          message: 'Element not found: #missing-button',
        },
        executionTime: 100,
        timestamp: Date.now(),
      };

      logger.logAction(action, result, 'browser-456', 'openclaw');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.type).toBe('action');
      if (log.type === 'action') {
        expect(log.actionType).toBe('click');
        expect(log.success).toBe(false);
        expect(log.error).toBeDefined();
        expect(log.error?.code).toBe('ELEMENT_NOT_FOUND');
        expect(log.error?.message).toContain('Element not found');
      }
    });

    it('should extract parameters from different action types', () => {
      const actions: BrowserAction[] = [
        { type: 'navigate', url: 'https://example.com' },
        { type: 'click', selector: '#button' },
        { type: 'type', selector: '#input', text: 'test text' },
        { type: 'screenshot', fullPage: true, format: 'png' },
        { type: 'execute_js', script: 'return document.title;' },
      ];

      actions.forEach((action) => {
        const result: ActionResult = {
          success: true,
          action,
          result: {},
          executionTime: 100,
          timestamp: Date.now(),
        };

        logger.logAction(action, result);
      });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(5);

      // Check that parameters were extracted
      const actionLogs = logs.filter(log => log.type === 'action');
      expect(actionLogs).toHaveLength(5);
      
      actionLogs.forEach((log) => {
        if (log.type === 'action') {
          expect(log.parameters).toBeDefined();
          expect(Object.keys(log.parameters).length).toBeGreaterThan(0);
        }
      });
    });

    it('should not log actions when logActions is disabled', () => {
      logger.updateConfig({ logActions: false });

      const action: BrowserAction = {
        type: 'navigate',
        url: 'https://example.com',
      };

      const result: ActionResult = {
        success: true,
        action,
        result: {},
        executionTime: 100,
        timestamp: Date.now(),
      };

      logger.logAction(action, result);

      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('Error Logging', () => {
    it('should log error with context and stack trace', () => {
      const error = new Error('Test error');
      const context = {
        code: 'TEST_ERROR',
        action: 'navigate',
        url: 'https://example.com',
      };

      logger.logError(error, context, 'browser-789', 'openclaw');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.type).toBe('error');
      if (log.type === 'error') {
        expect(log.errorCode).toBe('TEST_ERROR');
        expect(log.errorMessage).toBe('Test error');
        expect(log.context).toEqual(context);
        expect(log.stackTrace).toBeDefined();
        expect(log.browserId).toBe('browser-789');
        expect(log.profileName).toBe('openclaw');
      }
    });

    it('should classify errors correctly', () => {
      const errorCases = [
        { message: 'Timeout waiting for element', expectedClass: 'timeout' },
        { message: 'Element not found', expectedClass: 'element_not_found' },
        { message: 'Navigation failed', expectedClass: 'navigation' },
        { message: 'Connection lost', expectedClass: 'connection' },
        { message: 'Invalid selector', expectedClass: 'selector' },
        { message: 'Script evaluation failed', expectedClass: 'script' },
        { message: 'Network error', expectedClass: 'network' },
        { message: 'Permission denied', expectedClass: 'permission' },
        { message: 'Unknown error', expectedClass: 'unknown' },
      ];

      errorCases.forEach(({ message, expectedClass }) => {
        logger.clearLogs();
        logger.logError(new Error(message), {});

        const logs = logger.getLogs();
        expect(logs).toHaveLength(1);
        
        const log = logs[0];
        if (log.type === 'error') {
          expect(log.errorClass).toBe(expectedClass);
        }
      });
    });

    it('should handle string errors', () => {
      logger.logError('String error message', { code: 'STRING_ERROR' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.type).toBe('error');
      if (log.type === 'error') {
        expect(log.errorMessage).toBe('String error message');
        expect(log.errorCode).toBe('STRING_ERROR');
      }
    });

    it('should not log errors when logErrors is disabled', () => {
      logger.updateConfig({ logErrors: false });

      logger.logError(new Error('Test error'), {});

      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('Connection Event Logging', () => {
    it('should log browser connection event', () => {
      logger.logConnection('connected', 'browser-123', 'openclaw', {
        browser: 'Chrome/120.0.0.0',
        protocolVersion: '1.3',
        userAgent: 'Mozilla/5.0...',
        v8Version: '12.0.0',
        webKitVersion: '537.36',
      });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.type).toBe('connection');
      if (log.type === 'connection') {
        expect(log.event).toBe('connected');
        expect(log.browserId).toBe('browser-123');
        expect(log.profileName).toBe('openclaw');
        expect(log.browserMetadata).toBeDefined();
        expect(log.browserMetadata?.version).toBe('Chrome/120.0.0.0');
      }
    });

    it('should log browser disconnection event with reason', () => {
      logger.logConnection('disconnected', 'browser-456', 'openclaw', undefined, 'User closed browser');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.type).toBe('connection');
      if (log.type === 'connection') {
        expect(log.event).toBe('disconnected');
        expect(log.reason).toBe('User closed browser');
      }
    });

    it('should log all connection event types', () => {
      const events: Array<'connected' | 'disconnected' | 'reconnected' | 'failed'> = [
        'connected',
        'disconnected',
        'reconnected',
        'failed',
      ];

      events.forEach((event) => {
        logger.logConnection(event, 'browser-123', 'openclaw');
      });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);

      const connectionLogs = logs.filter(log => log.type === 'connection');
      expect(connectionLogs).toHaveLength(4);
      
      events.forEach((event, index) => {
        const log = connectionLogs[index];
        if (log.type === 'connection') {
          expect(log.event).toBe(event);
        }
      });
    });

    it('should not log connections when logConnections is disabled', () => {
      logger.updateConfig({ logConnections: false });

      logger.logConnection('connected', 'browser-123', 'openclaw');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('Generic Logging', () => {
    it('should log generic messages with level and context', () => {
      logger.log('info', 'Test message', { key: 'value' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.type).toBe('generic');
      if (log.type === 'generic') {
        expect(log.level).toBe('info');
        expect(log.message).toBe('Test message');
        expect(log.context).toEqual({ key: 'value' });
      }
    });

    it('should respect log level filtering', () => {
      logger.updateConfig({ level: 'warn' });

      logger.log('debug', 'Debug message');
      logger.log('info', 'Info message');
      logger.log('warn', 'Warn message');
      logger.log('error', 'Error message');

      const logs = logger.getLogs();
      // Only warn and error should be logged
      expect(logs).toHaveLength(2);
      
      const genericLogs = logs.filter(log => log.type === 'generic');
      expect(genericLogs).toHaveLength(2);
      
      if (genericLogs[0].type === 'generic') {
        expect(genericLogs[0].level).toBe('warn');
      }
      if (genericLogs[1].type === 'generic') {
        expect(genericLogs[1].level).toBe('error');
      }
    });
  });

  describe('Log Management', () => {
    it('should retrieve logs by type', () => {
      // Add different types of logs
      logger.log('info', 'Generic log');
      logger.logError(new Error('Test error'), {});
      logger.logConnection('connected', 'browser-123', 'openclaw');

      const action: BrowserAction = { type: 'navigate', url: 'https://example.com' };
      const result: ActionResult = {
        success: true,
        action,
        result: {},
        executionTime: 100,
        timestamp: Date.now(),
      };
      logger.logAction(action, result);

      // Get all logs
      const allLogs = logger.getLogs();
      expect(allLogs).toHaveLength(4);

      // Get logs by type
      const actionLogs = logger.getLogsByType('action');
      expect(actionLogs).toHaveLength(1);

      const errorLogs = logger.getLogsByType('error');
      expect(errorLogs).toHaveLength(1);

      const connectionLogs = logger.getLogsByType('connection');
      expect(connectionLogs).toHaveLength(1);

      const genericLogs = logger.getLogsByType('generic');
      expect(genericLogs).toHaveLength(1);
    });

    it('should clear logs', () => {
      logger.log('info', 'Test message');
      logger.logError(new Error('Test error'), {});

      expect(logger.getLogs()).toHaveLength(2);

      logger.clearLogs();

      expect(logger.getLogs()).toHaveLength(0);
    });

    it('should emit events when logging', (done) => {
      let eventCount = 0;

      logger.on('log', (entry) => {
        eventCount++;
        expect(entry).toBeDefined();
        
        if (eventCount === 3) {
          done();
        }
      });

      logger.log('info', 'Test 1');
      logger.logError(new Error('Test 2'), {});
      logger.logConnection('connected', 'browser-123', 'openclaw');
    });

    it('should limit buffer size', () => {
      // Create logger with small buffer for testing
      const smallLogger = new BrowserAutomationLogger({
        enableConsole: false,
      });

      // Add more logs than the buffer size (1000)
      for (let i = 0; i < 1100; i++) {
        smallLogger.log('info', `Message ${i}`);
      }

      const logs = smallLogger.getLogs();
      // Should be limited to 1000
      expect(logs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const initialConfig = logger.getConfig();
      expect(initialConfig.level).toBe('debug');

      logger.updateConfig({ level: 'error' });

      const updatedConfig = logger.getConfig();
      expect(updatedConfig.level).toBe('error');
    });

    it('should emit config-updated event', (done) => {
      logger.on('config-updated', (config) => {
        expect(config.level).toBe('warn');
        done();
      });

      logger.updateConfig({ level: 'warn' });
    });

    it('should get current configuration', () => {
      const config = logger.getConfig();
      
      expect(config).toHaveProperty('level');
      expect(config).toHaveProperty('logActions');
      expect(config).toHaveProperty('logErrors');
      expect(config).toHaveProperty('logConnections');
      expect(config).toHaveProperty('enableConsole');
      expect(config).toHaveProperty('enableFile');
    });
  });
});
