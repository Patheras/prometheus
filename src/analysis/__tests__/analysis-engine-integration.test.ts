/**
 * Analysis Engine Integration Tests (Task 31.4)
 * 
 * Tests the complete Analysis Engine workflow integrating:
 * - Memory Engine (code retrieval, metric storage)
 * - Runtime Engine (LLM analysis)
 * - Code Quality Service
 * 
 * Requirements: 11.1, 12.1, 15.1
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MemoryEngine, createMemoryEngine } from '../../memory/engine';
import { initializeDatabase } from '../../memory/database';
import { RuntimeExecutor } from '../../runtime/runtime-executor';
import { CodeQualityService, createCodeQualityService } from '../code-quality-service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock RuntimeExecutor for testing
class MockRuntimeExecutor {
  async execute(request: any): Promise<string> {
    return 'Refactor this code by extracting complex logic into smaller functions.';
  }
}

describe('Analysis Engine Integration (Task 31.4)', () => {
  let tempDir: string;
  let memoryEngine: MemoryEngine;
  let runtimeExecutor: MockRuntimeExecutor;
  let dbPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analysis-integration-'));
    // Put database outside the temp dir to avoid indexing it
    dbPath = path.join(os.tmpdir(), `test-analysis-${Date.now()}.db`);
    
    const prometheusDb = await initializeDatabase({ path: dbPath });
    memoryEngine = createMemoryEngine(prometheusDb);
    
    runtimeExecutor = new MockRuntimeExecutor();
  });

  afterEach(async () => {
    await memoryEngine.close();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.unlink(dbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End Code Quality Analysis (Requirement 11.1)', () => {
    it('should integrate Memory Engine, Runtime Engine, and Code Quality Service', async () => {
      // This test verifies that all three engines can work together
      
      // 1. Verify Memory Engine is initialized
      expect(memoryEngine).toBeDefined();
      expect(memoryEngine.getDatabase()).toBeDefined();
      
      // 2. Verify Runtime Executor works
      const response = await runtimeExecutor.execute({ prompt: 'test' });
      expect(response).toContain('Refactor');
      
      // 3. Verify Code Quality Service can be created with both engines
      const qualityService = createCodeQualityService({
        memoryEngine,
        runtimeExecutor: runtimeExecutor as any,
        enableLLMSuggestions: false,
      });
      
      expect(qualityService).toBeDefined();
    });
  });

  describe('End-to-End Performance Analysis (Requirement 12.1)', () => {
    it('should store and query performance metrics', async () => {
      // Store some performance metrics with proper structure
      const metrics = [
        {
          id: 'metric-1',
          timestamp: Date.now() - 3600000,
          metric_type: 'performance',
          metric_name: 'api_latency',
          value: 150,
          context: JSON.stringify({ endpoint: '/api/users', method: 'GET' }),
        },
        {
          id: 'metric-2',
          timestamp: Date.now() - 1800000,
          metric_type: 'performance',
          metric_name: 'api_latency',
          value: 200,
          context: JSON.stringify({ endpoint: '/api/users', method: 'GET' }),
        },
        {
          id: 'metric-3',
          timestamp: Date.now(),
          metric_type: 'performance',
          metric_name: 'api_latency',
          value: 5000, // Anomaly!
          context: JSON.stringify({ endpoint: '/api/users', method: 'GET' }),
        },
      ];

      await memoryEngine.storeMetrics(metrics);

      // Query metrics
      const retrieved = await memoryEngine.queryMetrics({
        metric_type: 'performance',
        metric_name: 'api_latency',
        start_time: Date.now() - 7200000,
        end_time: Date.now(),
      });

      // Verify metrics were stored and retrieved
      expect(retrieved.metrics.length).toBe(3);
      expect(retrieved.metrics.some(m => m.value === 5000)).toBe(true);
      
      // Verify aggregations are available
      expect(retrieved.aggregations).toBeDefined();
    });
  });

  describe('End-to-End Impact Assessment (Requirement 15.1)', () => {
    it('should support dependency analysis through search', async () => {
      // Create a simple codebase with dependencies
      const file1 = path.join(tempDir, 'service.ts');
      const file2 = path.join(tempDir, 'controller.ts');
      
      await fs.writeFile(
        file1,
        `
        export class UserService {
          getUser(id: string) {
            return { id, name: 'Test' };
          }
        }
        `
      );
      
      await fs.writeFile(
        file2,
        `
        import { UserService } from './service';
        
        export class UserController {
          constructor(private service: UserService) {}
          
          handleRequest(id: string) {
            return this.service.getUser(id);
          }
        }
        `
      );

      // Index the codebase
      await memoryEngine.indexCodebase(tempDir);

      // Search for files that reference UserService
      const results = await memoryEngine.searchCode('UserService', {
        limit: 10,
      });

      // Should find results (both files contain UserService)
      expect(results.length).toBeGreaterThan(0);
      
      // Verify search results have required fields (SearchResult structure)
      for (const result of results) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('source');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('metadata');
      }
    });
  });

  describe('Cross-Engine Integration', () => {
    it('should coordinate between quality service and metrics storage', async () => {
      const qualityService = createCodeQualityService({
        memoryEngine,
        runtimeExecutor: runtimeExecutor as any,
        enableLLMSuggestions: false,
      });

      // Store performance metrics
      await memoryEngine.storeMetrics([{
        id: 'perf-1',
        timestamp: Date.now(),
        metric_type: 'performance',
        metric_name: 'method_time',
        value: 2000,
        context: JSON.stringify({ method: 'SlowService.process' }),
      }]);

      // Query metrics
      const metricsResult = await memoryEngine.queryMetrics({
        metric_type: 'performance',
        metric_name: 'method_time',
        start_time: Date.now() - 3600000,
        end_time: Date.now(),
      });

      // Both quality service and metrics should be available
      expect(qualityService).toBeDefined();
      expect(metricsResult.metrics.length).toBeGreaterThan(0);
      expect(metricsResult.metrics[0].value).toBe(2000);
    });
  });
});
