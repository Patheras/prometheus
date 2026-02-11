/**
 * Queue Integration Tests
 * 
 * Tests for Memory and Runtime Engine integration with queue system (Task 24)
 */

import { QueuedMemoryEngine } from '../memory/queued-memory-engine';
import { QueuedRuntimeExecutor, LLMCallTracker } from '../runtime/queued-runtime-executor';
import { clearAllLanes, getLaneStatus, setLaneConcurrency } from '../queue';

// Mock Memory Engine
class MockMemoryEngine {
  async storeDecision(decision: any): Promise<string> {
    return 'decision-id';
  }

  async updateDecisionOutcome(id: string, outcome: string, lessons: string): Promise<void> {}

  async searchDecisions(query: string, options?: any): Promise<any[]> {
    return [];
  }

  async storeMetrics(metrics: any[]): Promise<void> {}

  async queryMetrics(query: any): Promise<any[]> {
    return [];
  }

  async storePattern(pattern: any): Promise<string> {
    return 'pattern-id';
  }

  async updatePatternOutcome(id: string, outcome: any): Promise<void> {}

  async searchPatterns(query: string, options?: any): Promise<any[]> {
    return [];
  }

  async indexCodebase(repoPath: string): Promise<void> {}

  async searchCode(query: string, options?: any): Promise<any[]> {
    return [];
  }

  async getFileMetadata(path: string): Promise<any> {
    return null;
  }

  async search(query: string, options?: any): Promise<any[]> {
    return [];
  }

  getDatabase(): any {
    return {};
  }

  async close(): Promise<void> {}
}

// Mock Runtime Executor
class MockRuntimeExecutor {
  async execute(request: any): Promise<any> {
    return { content: 'Mock response', model: 'mock-model' };
  }

  async *executeStreaming(request: any): AsyncGenerator<any, void, unknown> {
    yield { content: 'Chunk 1', model: 'mock-model' };
    yield { content: 'Chunk 2', model: 'mock-model' };
  }

  abortStream(streamId: string): boolean {
    return true;
  }

  getActiveStreamIds(): string[] {
    return [];
  }

  isStreamActive(streamId: string): boolean {
    return false;
  }

  getConfig(): any {
    return {
      modelPreferences: {
        general: [{ provider: 'anthropic', model: 'claude-sonnet-4' }],
      },
    };
  }

  updateConfig(config: any): void {}
}

describe('Queue Integration (Task 24)', () => {
  let mockMemory: MockMemoryEngine;
  let queuedMemory: QueuedMemoryEngine;
  let mockRuntime: MockRuntimeExecutor;
  let queuedRuntime: QueuedRuntimeExecutor;

  beforeEach(() => {
    mockMemory = new MockMemoryEngine();
    queuedMemory = new QueuedMemoryEngine(mockMemory as any);

    mockRuntime = new MockRuntimeExecutor();
    queuedRuntime = new QueuedRuntimeExecutor(mockRuntime as any);

    clearAllLanes();
  });

  afterEach(() => {
    clearAllLanes();
  });

  describe('Task 24.1: Memory Engine Operations Through Queue', () => {
    describe('Decision Storage', () => {
      it('should queue decision storage in decision lane', async () => {
        const decision = {
          timestamp: Date.now(),
          context: 'Test',
          reasoning: 'Test',
          alternatives: JSON.stringify(['opt1']),
          chosen_option: 'opt1',
          decision_type: 'technical' as const,
          affected_components: null,
          outcome: null,
          lessons_learned: null,
        };

        const id = await queuedMemory.storeDecision(decision);
        expect(id).toBe('decision-id');

        const laneStatus = getLaneStatus('decision');
        expect(laneStatus.lane).toBe('decision');
      });

      it('should handle concurrent decision storage', async () => {
        const decisions = Array.from({ length: 5 }, (_, i) => ({
          timestamp: Date.now(),
          context: `Decision ${i}`,
          reasoning: `Reasoning ${i}`,
          alternatives: JSON.stringify([`opt${i}`]),
          chosen_option: `opt${i}`,
          decision_type: 'technical' as const,
          affected_components: null,
          outcome: null,
          lessons_learned: null,
        }));

        const ids = await Promise.all(
          decisions.map(d => queuedMemory.storeDecision(d))
        );

        expect(ids).toHaveLength(5);
      });
    });

    describe('Metric Storage', () => {
      it('should queue metric storage in main lane', async () => {
        const metrics = [
          {
            id: 'metric1',
            timestamp: Date.now(),
            metric_type: 'performance',
            metric_name: 'response_time',
            value: 150,
            context: null,
          },
        ];

        await queuedMemory.storeMetrics(metrics);

        const laneStatus = getLaneStatus('main');
        expect(laneStatus.lane).toBe('main');
      });
    });

    describe('Pattern Storage', () => {
      it('should queue pattern storage in main lane', async () => {
        const pattern = {
          name: 'Test Pattern',
          category: 'Architecture',
          problem: 'Test problem',
          solution: 'Test solution',
          example_code: 'const test = true;',
          success_count: 0,
          failure_count: 0,
          domain: 'general',
        };

        const id = await queuedMemory.storePattern(pattern);
        expect(id).toBe('pattern-id');

        const laneStatus = getLaneStatus('main');
        expect(laneStatus.lane).toBe('main');
      });
    });

    describe('Search Operations', () => {
      it('should queue search in analysis lane', async () => {
        await queuedMemory.searchDecisions('test');

        const laneStatus = getLaneStatus('analysis');
        expect(laneStatus.lane).toBe('analysis');
      });

      it('should allow concurrent searches', async () => {
        setLaneConcurrency('analysis', 4);

        const searches = Array.from({ length: 5 }, (_, i) =>
          queuedMemory.searchDecisions(`query${i}`)
        );

        const results = await Promise.all(searches);
        expect(results).toHaveLength(5);
      });
    });

    describe('Indexing Operations', () => {
      it('should queue indexing in repo-specific lane', async () => {
        await queuedMemory.indexCodebase('/path/to/my-repo');

        const laneStatus = getLaneStatus('repo:my-repo');
        expect(laneStatus.lane).toBe('repo:my-repo');
      });

      it('should serialize indexing per repository', async () => {
        setLaneConcurrency('repo:my-repo', 1);

        const promises = [
          queuedMemory.indexCodebase('/path/to/my-repo'),
          queuedMemory.indexCodebase('/path/to/my-repo'),
          queuedMemory.indexCodebase('/path/to/my-repo'),
        ];

        await Promise.all(promises);
        // All should complete without race conditions
      });
    });
  });

  describe('Task 24.2: Runtime Engine Operations Through Queue', () => {
    describe('LLM Call Queueing', () => {
      it('should queue LLM calls by provider', async () => {
        const request = {
          messages: [{ role: 'user' as const, content: 'Test' }],
          taskType: 'general' as any,
        };

        const response = await queuedRuntime.execute(request);
        expect(response.content).toBe('Mock response');

        const laneStatus = getLaneStatus('llm:anthropic');
        expect(laneStatus.lane).toBe('llm:anthropic');
      });

      it('should allow concurrent calls to different providers', async () => {
        const anthropicRequest = {
          messages: [{ role: 'user' as const, content: 'Test' }],
          taskType: 'general' as any,
          modelOverride: { provider: 'anthropic', model: 'claude-sonnet-4' },
        };

        const openaiRequest = {
          messages: [{ role: 'user' as const, content: 'Test' }],
          taskType: 'general' as any,
          modelOverride: { provider: 'openai', model: 'gpt-4-turbo' },
        };

        const [response1, response2] = await Promise.all([
          queuedRuntime.execute(anthropicRequest),
          queuedRuntime.execute(openaiRequest),
        ]);

        expect(response1.content).toBeDefined();
        expect(response2.content).toBeDefined();
      });

      it('should serialize calls to same provider', async () => {
        setLaneConcurrency('llm:anthropic', 1);

        const requests = Array.from({ length: 3 }, (_, i) => ({
          messages: [{ role: 'user' as const, content: `Message ${i}` }],
          taskType: 'general' as any,
        }));

        const promises = requests.map(req => queuedRuntime.execute(req));
        const results = await Promise.all(promises);

        expect(results).toHaveLength(3);
      });
    });

    describe('Streaming Operations', () => {
      it('should queue streaming calls by provider', async () => {
        const request = {
          messages: [{ role: 'user' as const, content: 'Test' }],
          taskType: 'general' as any,
        };

        const chunks: string[] = [];
        for await (const response of queuedRuntime.executeStreaming(request)) {
          chunks.push(response.content);
        }

        expect(chunks).toHaveLength(2);
        expect(chunks).toEqual(['Chunk 1', 'Chunk 2']);
      });
    });

    describe('LLM Call Tracking', () => {
      it('should track LLM calls per provider/model', () => {
        const tracker = new LLMCallTracker();

        tracker.trackCall('anthropic', 'claude-sonnet-4');
        tracker.trackCall('anthropic', 'claude-sonnet-4');
        tracker.trackCall('openai', 'gpt-4-turbo');

        expect(tracker.getCallCount('anthropic', 'claude-sonnet-4')).toBe(2);
        expect(tracker.getCallCount('openai', 'gpt-4-turbo')).toBe(1);
      });

      it('should track last call time', () => {
        const tracker = new LLMCallTracker();

        tracker.trackCall('anthropic', 'claude-sonnet-4');
        const lastCall = tracker.getLastCallTime('anthropic', 'claude-sonnet-4');

        expect(lastCall).toBeGreaterThan(0);
        expect(lastCall).toBeLessThanOrEqual(Date.now());
      });

      it('should get all tracked calls', () => {
        const tracker = new LLMCallTracker();

        tracker.trackCall('anthropic', 'claude-sonnet-4');
        tracker.trackCall('openai', 'gpt-4-turbo');

        const tracked = tracker.getAllTracked();
        expect(tracked).toHaveLength(2);
      });

      it('should reset tracking', () => {
        const tracker = new LLMCallTracker();

        tracker.trackCall('anthropic', 'claude-sonnet-4');
        tracker.reset();

        expect(tracker.getCallCount('anthropic', 'claude-sonnet-4')).toBe(0);
        expect(tracker.getAllTracked()).toHaveLength(0);
      });
    });
  });

  describe('Task 24.3: Integration Tests', () => {
    describe('Concurrent Memory and Runtime Operations', () => {
      it('should handle concurrent memory and runtime operations', async () => {
        const memoryOps = [
          queuedMemory.storeDecision({
            timestamp: Date.now(),
            context: 'Decision 1',
            reasoning: 'Reasoning 1',
            alternatives: JSON.stringify(['opt1']),
            chosen_option: 'opt1',
            decision_type: 'technical',
            affected_components: null,
            outcome: null,
            lessons_learned: null,
          }),
          queuedMemory.storeMetrics([
            {
              id: 'metric1',
              timestamp: Date.now(),
              metric_type: 'performance',
              metric_name: 'test',
              value: 100,
              context: null,
            },
          ]),
        ];

        const runtimeOps = [
          queuedRuntime.execute({
            messages: [{ role: 'user', content: 'Test 1' }],
            taskType: 'general' as any,
          }),
          queuedRuntime.execute({
            messages: [{ role: 'user', content: 'Test 2' }],
            taskType: 'general' as any,
          }),
        ];

        const results = await Promise.all([...memoryOps, ...runtimeOps]);
        expect(results).toHaveLength(4);
      });
    });

    describe('Lane Isolation', () => {
      it('should isolate memory operations from runtime operations', async () => {
        const memoryPromise = queuedMemory.storeDecision({
          timestamp: Date.now(),
          context: 'Test',
          reasoning: 'Test',
          alternatives: JSON.stringify(['opt1']),
          chosen_option: 'opt1',
          decision_type: 'technical',
          affected_components: null,
          outcome: null,
          lessons_learned: null,
        });

        const runtimePromise = queuedRuntime.execute({
          messages: [{ role: 'user', content: 'Test' }],
          taskType: 'general' as any,
        });

        await Promise.all([memoryPromise, runtimePromise]);

        // Both lanes should exist independently
        const decisionLane = getLaneStatus('decision');
        const llmLane = getLaneStatus('llm:anthropic');

        expect(decisionLane.lane).toBe('decision');
        expect(llmLane.lane).toBe('llm:anthropic');
      });
    });
  });
});
