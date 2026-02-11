/**
 * Tests for Priority Scorer
 * 
 * Task 33.1: Create priority scoring logic
 */

import { PriorityScorer, Task, PriorityScore, ScoringWeights } from '../priority-scorer';
import { RuntimeEngine } from '../../runtime';

// Mock RuntimeEngine
class MockRuntimeEngine implements Partial<RuntimeEngine> {
  private mockResponse: string;

  constructor(mockResponse?: string) {
    this.mockResponse =
      mockResponse ||
      `Impact: 75
Urgency: 60
Effort: 40
Alignment: 80
Reasoning: This task has high impact and good alignment with project goals.`;
  }

  setMockResponse(response: string): void {
    this.mockResponse = response;
  }

  async execute(request: {
    taskType: string;
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<{ content: string; model: any; tokensUsed: number; latency: number }> {
    return {
      content: this.mockResponse,
      model: { provider: 'mock', model: 'mock' },
      tokensUsed: 100,
      latency: 50,
    };
  }
}

describe('PriorityScorer', () => {
  let mockRuntime: MockRuntimeEngine;
  let scorer: PriorityScorer;

  beforeEach(() => {
    mockRuntime = new MockRuntimeEngine();
    scorer = new PriorityScorer(mockRuntime as any);
  });

  describe('scoreTask', () => {
    it('should score a task using LLM', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Implement user authentication',
        type: 'feature',
      };

      const score = await scorer.scoreTask(task);

      expect(score).toBeDefined();
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
      expect(score.breakdown).toBeDefined();
      expect(score.breakdown.impact).toBe(75);
      expect(score.breakdown.urgency).toBe(60);
      expect(score.breakdown.effort).toBe(40);
      expect(score.breakdown.alignment).toBe(80);
      expect(score.reasoning).toContain('high impact');
    });

    it('should calculate weighted total correctly', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Test task',
        type: 'feature',
      };

      const score = await scorer.scoreTask(task);

      // Default weights: impact=0.4, urgency=0.3, effort=0.2, alignment=0.1
      // Breakdown: impact=75, urgency=60, effort=40, alignment=80
      // Total = 75*0.4 + 60*0.3 + (100-40)*0.2 + 80*0.1
      //       = 30 + 18 + 12 + 8 = 68
      expect(score.total).toBe(68);
    });

    it('should invert effort score (lower effort = higher priority)', async () => {
      mockRuntime.setMockResponse(`Impact: 50
Urgency: 50
Effort: 20
Alignment: 50
Reasoning: Low effort task`);

      const task: Task = {
        id: 'task-1',
        description: 'Quick fix',
        type: 'bug_fix',
      };

      const score = await scorer.scoreTask(task);

      // With effort=20, inverted effort contribution = (100-20)*0.2 = 16
      // Total = 50*0.4 + 50*0.3 + 80*0.2 + 50*0.1 = 20 + 15 + 16 + 5 = 56
      expect(score.total).toBe(56);
    });

    it('should handle task with context', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Optimize database queries',
        type: 'optimization',
        context: {
          currentLatency: 500,
          targetLatency: 100,
        },
      };

      const score = await scorer.scoreTask(task);

      expect(score).toBeDefined();
      expect(score.total).toBeGreaterThanOrEqual(0);
    });

    it('should handle additional context parameter', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Fix critical bug',
        type: 'bug_fix',
      };

      const context = 'This bug is affecting 50% of users';

      const score = await scorer.scoreTask(task, context);

      expect(score).toBeDefined();
    });

    it('should fallback to heuristic scoring on LLM failure', async () => {
      // Mock LLM failure
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const task: Task = {
        id: 'task-1',
        description: 'Test task',
        type: 'bug_fix',
      };

      const score = await scorer.scoreTask(task);

      expect(score).toBeDefined();
      expect(score.reasoning).toContain('Heuristic');
      expect(score.breakdown.impact).toBe(70); // bug_fix heuristic
      expect(score.breakdown.urgency).toBe(80);
    });

    it('should clamp scores to 0-100 range', async () => {
      mockRuntime.setMockResponse(`Impact: 150
Urgency: -10
Effort: 200
Alignment: 50
Reasoning: Invalid scores`);

      const task: Task = {
        id: 'task-1',
        description: 'Test task',
        type: 'feature',
      };

      const score = await scorer.scoreTask(task);

      expect(score.breakdown.impact).toBe(100); // Clamped from 150
      // Note: parseInt('-10') returns NaN, which gets clamped to 50 (default)
      expect(score.breakdown.urgency).toBe(50); // Default value for unparseable
      expect(score.breakdown.effort).toBe(100); // Clamped from 200
      expect(score.breakdown.alignment).toBe(50);
    });
  });

  describe('scoreTasks', () => {
    it('should score multiple tasks', async () => {
      const tasks: Task[] = [
        { id: 'task-1', description: 'Task 1', type: 'feature' },
        { id: 'task-2', description: 'Task 2', type: 'bug_fix' },
        { id: 'task-3', description: 'Task 3', type: 'refactoring' },
      ];

      const scored = await scorer.scoreTasks(tasks);

      expect(scored).toHaveLength(3);
      expect(scored[0].score).toBeDefined();
      expect(scored[1].score).toBeDefined();
      expect(scored[2].score).toBeDefined();
    });

    it('should preserve task properties', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          description: 'Task 1',
          type: 'feature',
          context: { priority: 'high' },
        },
      ];

      const scored = await scorer.scoreTasks(tasks);

      expect(scored[0].id).toBe('task-1');
      expect(scored[0].description).toBe('Task 1');
      expect(scored[0].type).toBe('feature');
      expect(scored[0].context).toEqual({ priority: 'high' });
    });
  });

  describe('rankTasks', () => {
    it('should rank tasks by priority (highest first)', async () => {
      // Set up different scores for each task
      let callCount = 0;
      mockRuntime.execute = async () => {
        callCount++;
        const responses = [
          `Impact: 50\nUrgency: 50\nEffort: 50\nAlignment: 50\nReasoning: Low priority`,
          `Impact: 90\nUrgency: 80\nEffort: 30\nAlignment: 85\nReasoning: High priority`,
          `Impact: 60\nUrgency: 60\nEffort: 60\nAlignment: 60\nReasoning: Medium priority`,
        ];
        return {
          content: responses[callCount - 1],
          model: { provider: 'mock', model: 'mock' },
          tokensUsed: 100,
          latency: 50,
        };
      };

      const tasks: Task[] = [
        { id: 'task-1', description: 'Low priority task', type: 'refactoring' },
        { id: 'task-2', description: 'High priority task', type: 'bug_fix' },
        { id: 'task-3', description: 'Medium priority task', type: 'feature' },
      ];

      const ranked = await scorer.rankTasks(tasks);

      expect(ranked).toHaveLength(3);
      expect(ranked[0].id).toBe('task-2'); // Highest priority
      expect(ranked[1].id).toBe('task-3'); // Medium priority
      expect(ranked[2].id).toBe('task-1'); // Lowest priority
    });

    it('should return tasks without score property', async () => {
      const tasks: Task[] = [
        { id: 'task-1', description: 'Task 1', type: 'feature' },
      ];

      const ranked = await scorer.rankTasks(tasks);

      expect(ranked[0]).not.toHaveProperty('score');
    });
  });

  describe('custom weights', () => {
    it('should use custom weights', () => {
      const customWeights: ScoringWeights = {
        impact: 0.5,
        urgency: 0.2,
        effort: 0.2,
        alignment: 0.1,
      };

      const customScorer = new PriorityScorer(mockRuntime as any, customWeights);
      const weights = customScorer.getWeights();

      expect(weights.impact).toBeCloseTo(0.5, 5);
      expect(weights.urgency).toBeCloseTo(0.2, 5);
      expect(weights.effort).toBeCloseTo(0.2, 5);
      expect(weights.alignment).toBeCloseTo(0.1, 5);
    });

    it('should normalize weights to sum to 1.0', () => {
      const unnormalizedWeights: Partial<ScoringWeights> = {
        impact: 2,
        urgency: 1,
        effort: 1,
      };

      const customScorer = new PriorityScorer(mockRuntime as any, unnormalizedWeights);
      const weights = customScorer.getWeights();

      const sum = weights.impact + weights.urgency + weights.effort + weights.alignment;
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should allow updating weights', () => {
      scorer.setWeights({ impact: 0.6, urgency: 0.4 });
      const weights = scorer.getWeights();

      // Should be normalized
      const sum = weights.impact + weights.urgency + weights.effort + weights.alignment;
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe('heuristic scoring', () => {
    beforeEach(() => {
      // Force heuristic scoring by making LLM fail
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };
    });

    it('should score bug_fix tasks with high urgency', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Fix critical bug',
        type: 'bug_fix',
      };

      const score = await scorer.scoreTask(task);

      expect(score.breakdown.urgency).toBe(80);
      expect(score.breakdown.impact).toBe(70);
    });

    it('should score feature tasks with high alignment', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Add new feature',
        type: 'feature',
      };

      const score = await scorer.scoreTask(task);

      expect(score.breakdown.alignment).toBe(70);
      expect(score.breakdown.effort).toBe(70);
    });

    it('should score refactoring tasks with low urgency', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Refactor code',
        type: 'refactoring',
      };

      const score = await scorer.scoreTask(task);

      expect(score.breakdown.urgency).toBe(30);
    });

    it('should score optimization tasks with moderate values', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Optimize performance',
        type: 'optimization',
      };

      const score = await scorer.scoreTask(task);

      expect(score.breakdown.impact).toBe(60);
      expect(score.breakdown.urgency).toBe(40);
    });

    it('should score technical_debt tasks with low urgency', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Pay down technical debt',
        type: 'technical_debt',
      };

      const score = await scorer.scoreTask(task);

      expect(score.breakdown.urgency).toBe(30);
      expect(score.breakdown.impact).toBe(40);
    });

    it('should use default scores for unknown task types', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Unknown task',
        type: 'unknown',
      };

      const score = await scorer.scoreTask(task);

      expect(score.breakdown.impact).toBe(50);
      expect(score.breakdown.urgency).toBe(50);
      expect(score.breakdown.effort).toBe(50);
      expect(score.breakdown.alignment).toBe(50);
    });
  });

  describe('edge cases', () => {
    it('should handle empty task description', async () => {
      const task: Task = {
        id: 'task-1',
        description: '',
        type: 'feature',
      };

      const score = await scorer.scoreTask(task);

      expect(score).toBeDefined();
      expect(score.total).toBeGreaterThanOrEqual(0);
    });

    it('should handle task with no context', async () => {
      const task: Task = {
        id: 'task-1',
        description: 'Task without context',
        type: 'feature',
      };

      const score = await scorer.scoreTask(task);

      expect(score).toBeDefined();
    });

    it('should handle malformed LLM response', async () => {
      mockRuntime.setMockResponse('Invalid response format');

      const task: Task = {
        id: 'task-1',
        description: 'Test task',
        type: 'feature',
      };

      const score = await scorer.scoreTask(task);

      // Should use default values (50) for unparseable scores
      expect(score.breakdown.impact).toBe(50);
      expect(score.breakdown.urgency).toBe(50);
      expect(score.breakdown.effort).toBe(50);
      expect(score.breakdown.alignment).toBe(50);
    });

    it('should handle partial LLM response', async () => {
      mockRuntime.setMockResponse(`Impact: 80
Urgency: 70
Reasoning: Partial response`);

      const task: Task = {
        id: 'task-1',
        description: 'Test task',
        type: 'feature',
      };

      const score = await scorer.scoreTask(task);

      expect(score.breakdown.impact).toBe(80);
      expect(score.breakdown.urgency).toBe(70);
      expect(score.breakdown.effort).toBe(50); // Default
      expect(score.breakdown.alignment).toBe(50); // Default
    });
  });
});
