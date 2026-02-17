/**
 * Unit tests for MetricsCollector
 * 
 * Tests action metrics, error metrics, connection metrics, browser metrics, and Prometheus format.
 */

import { MetricsCollector } from '../../metrics-collector.js';
import { BrowserAction, ActionResult } from '../../types/index.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({
      enabled: true,
      resetOnRead: false,
      trackDetailedMetrics: true,
    });
  });

  describe('Action Metrics', () => {
    it('should record successful action', () => {
      const action: BrowserAction = {
        type: 'navigate',
        url: 'https://example.com',
      };

      const result: ActionResult = {
        success: true,
        action,
        result: {},
        executionTime: 500,
        timestamp: Date.now(),
      };

      collector.recordAction(action, result);

      const metrics = collector.getMetrics();
      expect(metrics.totalActions).toBe(1);
      expect(metrics.successfulActions).toBe(1);
      expect(metrics.failedActions).toBe(0);
      expect(metrics.actionsByType['navigate']).toBe(1);
      expect(metrics.totalExecutionTime).toBe(500);
      expect(metrics.averageExecutionTime).toBe(500);
    });

    it('should record failed action', () => {
      const action: BrowserAction = {
        type: 'click',
        selector: '#button',
      };

      const result: ActionResult = {
        success: false,
        action,
        error: {
          code: 'ELEMENT_NOT_FOUND',
          message: 'Element not found',
        },
        executionTime: 100,
        timestamp: Date.now(),
      };

      collector.recordAction(action, result);

      const metrics = collector.getMetrics();
      expect(metrics.totalActions).toBe(1);
      expect(metrics.successfulActions).toBe(0);
      expect(metrics.failedActions).toBe(1);
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.errorsByCode['ELEMENT_NOT_FOUND']).toBe(1);
    });

    it('should track actions by type', () => {
      const actions: BrowserAction[] = [
        { type: 'navigate', url: 'https://example.com' },
        { type: 'navigate', url: 'https://example.org' },
        { type: 'click', selector: '#button' },
        { type: 'type', selector: '#input', text: 'test' },
        { type: 'screenshot' },
      ];

      actions.forEach((action) => {
        const result: ActionResult = {
          success: true,
          action,
          result: {},
          executionTime: 100,
          timestamp: Date.now(),
        };
        collector.recordAction(action, result);
      });

      const metrics = collector.getMetrics();
      expect(metrics.totalActions).toBe(5);
      expect(metrics.actionsByType['navigate']).toBe(2);
      expect(metrics.actionsByType['click']).toBe(1);
      expect(metrics.actionsByType['type']).toBe(1);
      expect(metrics.actionsByType['screenshot']).toBe(1);
    });

    it('should track execution time statistics', () => {
      const executionTimes = [100, 200, 300, 400, 500];

      executionTimes.forEach((time) => {
        const action: BrowserAction = { type: 'navigate', url: 'https://example.com' };
        const result: ActionResult = {
          success: true,
          action,
          result: {},
          executionTime: time,
          timestamp: Date.now(),
        };
        collector.recordAction(action, result);
      });

      const metrics = collector.getMetrics();
      expect(metrics.totalActions).toBe(5);
      expect(metrics.totalExecutionTime).toBe(1500);
      expect(metrics.averageExecutionTime).toBe(300);
      expect(metrics.minExecutionTime).toBe(100);
      expect(metrics.maxExecutionTime).toBe(500);
    });

    it('should track detailed execution time by action type', () => {
      // Record navigate actions
      [100, 200, 300].forEach((time) => {
        const action: BrowserAction = { type: 'navigate', url: 'https://example.com' };
        const result: ActionResult = {
          success: true,
          action,
          result: {},
          executionTime: time,
          timestamp: Date.now(),
        };
        collector.recordAction(action, result);
      });

      // Record click actions
      [50, 150].forEach((time) => {
        const action: BrowserAction = { type: 'click', selector: '#button' };
        const result: ActionResult = {
          success: true,
          action,
          result: {},
          executionTime: time,
          timestamp: Date.now(),
        };
        collector.recordAction(action, result);
      });

      const metrics = collector.getMetrics();
      
      // Check navigate metrics
      expect(metrics.executionTimeByAction['navigate']).toBeDefined();
      expect(metrics.executionTimeByAction['navigate'].count).toBe(3);
      expect(metrics.executionTimeByAction['navigate'].total).toBe(600);
      expect(metrics.executionTimeByAction['navigate'].average).toBe(200);
      expect(metrics.executionTimeByAction['navigate'].min).toBe(100);
      expect(metrics.executionTimeByAction['navigate'].max).toBe(300);

      // Check click metrics
      expect(metrics.executionTimeByAction['click']).toBeDefined();
      expect(metrics.executionTimeByAction['click'].count).toBe(2);
      expect(metrics.executionTimeByAction['click'].total).toBe(200);
      expect(metrics.executionTimeByAction['click'].average).toBe(100);
      expect(metrics.executionTimeByAction['click'].min).toBe(50);
      expect(metrics.executionTimeByAction['click'].max).toBe(150);
    });
  });

  describe('Error Metrics', () => {
    it('should record errors by code', () => {
      collector.recordError('TIMEOUT', 'timeout');
      collector.recordError('TIMEOUT', 'timeout');
      collector.recordError('ELEMENT_NOT_FOUND', 'element_not_found');

      const metrics = collector.getMetrics();
      expect(metrics.totalErrors).toBe(3);
      expect(metrics.errorsByCode['TIMEOUT']).toBe(2);
      expect(metrics.errorsByCode['ELEMENT_NOT_FOUND']).toBe(1);
    });

    it('should record errors by class', () => {
      collector.recordError('TIMEOUT_1', 'timeout');
      collector.recordError('TIMEOUT_2', 'timeout');
      collector.recordError('NOT_FOUND', 'element_not_found');

      const metrics = collector.getMetrics();
      expect(metrics.errorsByClass['timeout']).toBe(2);
      expect(metrics.errorsByClass['element_not_found']).toBe(1);
    });
  });

  describe('Connection Metrics', () => {
    it('should record connection events', () => {
      collector.recordConnection('connected');
      collector.recordConnection('connected');
      collector.recordConnection('disconnected');

      const metrics = collector.getMetrics();
      expect(metrics.totalConnections).toBe(2);
      expect(metrics.activeConnections).toBe(1);
    });

    it('should track reconnections', () => {
      collector.recordConnection('connected');
      collector.recordConnection('disconnected');
      collector.recordConnection('reconnected');

      const metrics = collector.getMetrics();
      expect(metrics.reconnections).toBe(1);
      expect(metrics.activeConnections).toBe(1);
    });

    it('should track failed connections', () => {
      collector.recordConnection('failed');
      collector.recordConnection('failed');

      const metrics = collector.getMetrics();
      expect(metrics.failedConnections).toBe(2);
    });

    it('should not allow negative active connections', () => {
      collector.recordConnection('disconnected');
      collector.recordConnection('disconnected');

      const metrics = collector.getMetrics();
      expect(metrics.activeConnections).toBe(0);
    });
  });

  describe('Browser Metrics', () => {
    it('should record browser launches', () => {
      collector.recordBrowserLaunch();
      collector.recordBrowserLaunch();

      const metrics = collector.getMetrics();
      expect(metrics.totalBrowserLaunches).toBe(2);
      expect(metrics.activeBrowsers).toBe(2);
    });

    it('should record browser closes', () => {
      collector.recordBrowserLaunch();
      collector.recordBrowserLaunch();
      collector.recordBrowserClose();

      const metrics = collector.getMetrics();
      expect(metrics.activeBrowsers).toBe(1);
    });

    it('should record browser crashes', () => {
      collector.recordBrowserLaunch();
      collector.recordBrowserCrash();

      const metrics = collector.getMetrics();
      expect(metrics.browserCrashes).toBe(1);
      expect(metrics.activeBrowsers).toBe(0);
    });

    it('should record idle timeouts', () => {
      collector.recordIdleTimeout();
      collector.recordIdleTimeout();

      const metrics = collector.getMetrics();
      expect(metrics.idleTimeouts).toBe(2);
    });

    it('should not allow negative active browsers', () => {
      collector.recordBrowserClose();
      collector.recordBrowserClose();

      const metrics = collector.getMetrics();
      expect(metrics.activeBrowsers).toBe(0);
    });
  });

  describe('Prometheus Format', () => {
    it('should generate Prometheus format metrics', () => {
      // Record some metrics
      const action: BrowserAction = { type: 'navigate', url: 'https://example.com' };
      const result: ActionResult = {
        success: true,
        action,
        result: {},
        executionTime: 500,
        timestamp: Date.now(),
      };
      collector.recordAction(action, result);
      collector.recordBrowserLaunch();
      collector.recordConnection('connected');

      const prometheusMetrics = collector.getPrometheusMetrics();

      // Check format
      expect(prometheusMetrics).toContain('# HELP');
      expect(prometheusMetrics).toContain('# TYPE');
      
      // Check specific metrics
      expect(prometheusMetrics).toContain('browser_automation_actions_total 1');
      expect(prometheusMetrics).toContain('browser_automation_actions_successful_total 1');
      expect(prometheusMetrics).toContain('browser_automation_browsers_active 1');
      expect(prometheusMetrics).toContain('browser_automation_connections_active 1');
      
      // Check action by type
      expect(prometheusMetrics).toContain('browser_automation_actions_by_type_total{type="navigate"} 1');
      
      // Check execution time metrics
      expect(prometheusMetrics).toContain('browser_automation_execution_time_ms_total 500');
      expect(prometheusMetrics).toContain('browser_automation_execution_time_ms_average 500');
    });

    it('should include all metric types in Prometheus format', () => {
      const prometheusMetrics = collector.getPrometheusMetrics();

      // Check that all metric categories are present
      expect(prometheusMetrics).toContain('browser_automation_actions_total');
      expect(prometheusMetrics).toContain('browser_automation_errors_total');
      expect(prometheusMetrics).toContain('browser_automation_execution_time_ms');
      expect(prometheusMetrics).toContain('browser_automation_connections_total');
      expect(prometheusMetrics).toContain('browser_automation_browsers_active');
      expect(prometheusMetrics).toContain('browser_automation_uptime_ms');
    });
  });

  describe('Metrics Management', () => {
    it('should reset metrics', () => {
      // Record some metrics
      const action: BrowserAction = { type: 'navigate', url: 'https://example.com' };
      const result: ActionResult = {
        success: true,
        action,
        result: {},
        executionTime: 500,
        timestamp: Date.now(),
      };
      collector.recordAction(action, result);
      collector.recordBrowserLaunch();

      let metrics = collector.getMetrics();
      expect(metrics.totalActions).toBe(1);
      expect(metrics.activeBrowsers).toBe(1);

      // Reset metrics
      collector.resetMetrics();

      metrics = collector.getMetrics();
      expect(metrics.totalActions).toBe(0);
      expect(metrics.activeBrowsers).toBe(0);
    });

    it('should emit events when recording metrics', (done) => {
      let eventCount = 0;

      collector.on('action-recorded', () => {
        eventCount++;
        if (eventCount === 1) {
          done();
        }
      });

      const action: BrowserAction = { type: 'navigate', url: 'https://example.com' };
      const result: ActionResult = {
        success: true,
        action,
        result: {},
        executionTime: 100,
        timestamp: Date.now(),
      };
      collector.recordAction(action, result);
    });

    it('should track uptime', (done) => {
      // Record an action to update metrics
      const action: BrowserAction = { type: 'navigate', url: 'https://example.com' };
      const result: ActionResult = {
        success: true,
        action,
        result: {},
        executionTime: 100,
        timestamp: Date.now(),
      };
      
      setTimeout(() => {
        collector.recordAction(action, result);
        const metrics = collector.getMetrics();
        expect(metrics.uptime).toBeGreaterThan(0);
        expect(metrics.lastUpdated).toBeGreaterThan(metrics.startTime);
        done();
      }, 100);
    });

    it('should not record metrics when disabled', () => {
      collector.updateConfig({ enabled: false });

      const action: BrowserAction = { type: 'navigate', url: 'https://example.com' };
      const result: ActionResult = {
        success: true,
        action,
        result: {},
        executionTime: 100,
        timestamp: Date.now(),
      };
      collector.recordAction(action, result);

      const metrics = collector.getMetrics();
      expect(metrics.totalActions).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const initialConfig = collector.getConfig();
      expect(initialConfig.enabled).toBe(true);

      collector.updateConfig({ enabled: false });

      const updatedConfig = collector.getConfig();
      expect(updatedConfig.enabled).toBe(false);
    });

    it('should emit config-updated event', (done) => {
      collector.on('config-updated', (config) => {
        expect(config.enabled).toBe(false);
        done();
      });

      collector.updateConfig({ enabled: false });
    });

    it('should get current configuration', () => {
      const config = collector.getConfig();
      
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('resetOnRead');
      expect(config).toHaveProperty('trackDetailedMetrics');
    });

    it('should reset metrics on read when configured', () => {
      collector.updateConfig({ resetOnRead: true });

      const action: BrowserAction = { type: 'navigate', url: 'https://example.com' };
      const result: ActionResult = {
        success: true,
        action,
        result: {},
        executionTime: 100,
        timestamp: Date.now(),
      };
      collector.recordAction(action, result);

      let metrics = collector.getMetrics();
      expect(metrics.totalActions).toBe(1);

      // Should be reset after read
      metrics = collector.getMetrics();
      expect(metrics.totalActions).toBe(0);
    });
  });
});
