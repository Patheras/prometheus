/**
 * Tests for SelfImprovementWorkflow
 */

import { SelfImprovementWorkflow, SelfImprovementTask, WorkflowConfig } from '../self-improvement-workflow';
import { DevProdManager } from '../dev-prod-manager';
import { RepositoryWorkflow } from '../../integrations/repository-workflow';
import { AnalysisEngine } from '../../analysis/engine';
import { MemoryEngine } from '../../memory/engine';

describe('SelfImprovementWorkflow', () => {
  let workflow: SelfImprovementWorkflow;
  let devProdManager: DevProdManager;
  let devWorkflow: RepositoryWorkflow;
  let analysisEngine: AnalysisEngine;
  let memoryEngine: MemoryEngine;
  let config: WorkflowConfig;

  beforeEach(() => {
    memoryEngine = new MemoryEngine({
      dbPath: ':memory:',
      embeddingProvider: 'mock',
    });

    // Mock dependencies
    devProdManager = {
      switchToDev: jest.fn(),
      requireDevRepository: jest.fn(),
      createPromotionRequest: jest.fn().mockResolvedValue({
        id: 'promotion-123',
        status: 'pending',
      }),
    } as any;

    devWorkflow = {
      createBranch: jest.fn().mockResolvedValue(undefined),
    } as any;

    analysisEngine = {} as any;

    config = {
      devRepoPath: '/path/to/dev',
      testCommand: 'npm test',
      buildCommand: 'npm run build',
      lintCommand: 'npm run lint',
      coverageThreshold: 80,
      requireAllTestsPass: true,
    };

    workflow = new SelfImprovementWorkflow(
      devProdManager,
      devWorkflow,
      analysisEngine,
      memoryEngine,
      config
    );
  });

  afterEach(async () => {
    await memoryEngine.close();
  });

  describe('Task Creation', () => {
    it('should create a new task', async () => {
      const task = await workflow.createTask(
        'Optimize memory usage',
        'Reduce memory footprint in indexing',
        'performance',
        'high',
        8,
        'Reduce memory usage by 20%'
      );

      expect(task.id).toBeTruthy();
      expect(task.title).toBe('Optimize memory usage');
      expect(task.category).toBe('performance');
      expect(task.priority).toBe('high');
      expect(task.status).toBe('planned');
    });

    it('should assign unique IDs to tasks', async () => {
      const task1 = await workflow.createTask('Task 1', 'Desc 1', 'quality', 'low', 2, 'Benefit 1');
      const task2 = await workflow.createTask('Task 2', 'Desc 2', 'quality', 'low', 2, 'Benefit 2');

      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('Task Lifecycle', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await workflow.createTask(
        'Test Task',
        'Test Description',
        'quality',
        'medium',
        4,
        'Test Benefit'
      );
      taskId = task.id;
    });

    it('should start a task', async () => {
      await workflow.startTask(taskId);

      const task = workflow.getTask(taskId);
      expect(task?.status).toBe('in_progress');
      expect(task?.branchName).toBeTruthy();
      expect(devProdManager.switchToDev).toHaveBeenCalled();
      expect(devWorkflow.createBranch).toHaveBeenCalled();
    });

    it('should track file modifications', async () => {
      await workflow.startTask(taskId);

      workflow.trackFileModification('src/memory/engine.ts');
      workflow.trackFileModification('src/memory/cache.ts');

      const context = workflow.getCurrentContext();
      expect(context?.modifiedFiles.size).toBe(2);
      expect(context?.modifiedFiles.has('src/memory/engine.ts')).toBe(true);
    });

    it('should not start task that is not planned', async () => {
      await workflow.startTask(taskId);

      await expect(workflow.startTask(taskId)).rejects.toThrow('not in planned state');
    });

    it('should cancel a task', async () => {
      await workflow.cancelTask(taskId, 'Not needed anymore');

      const task = workflow.getTask(taskId);
      expect(task?.status).toBe('cancelled');
    });
  });

  describe('Task Queries', () => {
    beforeEach(async () => {
      await workflow.createTask('Task 1', 'Desc', 'performance', 'high', 4, 'Benefit');
      await workflow.createTask('Task 2', 'Desc', 'quality', 'low', 2, 'Benefit');
      await workflow.createTask('Task 3', 'Desc', 'performance', 'medium', 6, 'Benefit');
    });

    it('should get all tasks', () => {
      const tasks = workflow.getAllTasks();
      expect(tasks.length).toBe(3);
    });

    it('should get tasks by status', () => {
      const planned = workflow.getTasksByStatus('planned');
      expect(planned.length).toBe(3);

      const inProgress = workflow.getTasksByStatus('in_progress');
      expect(inProgress.length).toBe(0);
    });

    it('should get tasks by priority', () => {
      const high = workflow.getTasksByPriority('high');
      expect(high.length).toBe(1);

      const low = workflow.getTasksByPriority('low');
      expect(low.length).toBe(1);
    });

    it('should get task by ID', () => {
      const tasks = workflow.getAllTasks();
      const task = workflow.getTask(tasks[0].id);

      expect(task).toBeDefined();
      expect(task?.id).toBe(tasks[0].id);
    });

    it('should return null for non-existent task', () => {
      const task = workflow.getTask('non-existent');
      expect(task).toBeNull();
    });
  });

  describe('Branch Naming', () => {
    it('should generate valid branch names', async () => {
      const task = await workflow.createTask(
        'Optimize Memory Usage in Indexing System',
        'Description',
        'performance',
        'high',
        8,
        'Benefit'
      );

      await workflow.startTask(task.id);

      const updatedTask = workflow.getTask(task.id);
      expect(updatedTask?.branchName).toMatch(/^self-improvement\/performance\//);
      expect(updatedTask?.branchName).not.toContain(' ');
      expect(updatedTask?.branchName).not.toContain('_');
    });

    it('should sanitize special characters in branch names', async () => {
      const task = await workflow.createTask(
        'Fix: Bug #123 (Critical!)',
        'Description',
        'quality',
        'critical',
        2,
        'Benefit'
      );

      await workflow.startTask(task.id);

      const updatedTask = workflow.getTask(task.id);
      expect(updatedTask?.branchName).toMatch(/^self-improvement\/quality\/fix-bug-123-critical$/);
    });
  });

  describe('Context Management', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await workflow.createTask('Test', 'Desc', 'quality', 'low', 2, 'Benefit');
      taskId = task.id;
    });

    it('should set context when starting task', async () => {
      expect(workflow.getCurrentContext()).toBeUndefined();

      await workflow.startTask(taskId);

      const context = workflow.getCurrentContext();
      expect(context).toBeDefined();
      expect(context?.taskId).toBe(taskId);
    });

    it('should clear context when cancelling task', async () => {
      await workflow.startTask(taskId);
      expect(workflow.getCurrentContext()).toBeDefined();

      await workflow.cancelTask(taskId, 'Test');

      expect(workflow.getCurrentContext()).toBeUndefined();
    });

    it('should track modifications in context', async () => {
      await workflow.startTask(taskId);

      workflow.trackFileModification('file1.ts');
      workflow.trackFileModification('file2.ts');

      const context = workflow.getCurrentContext();
      expect(context?.modifiedFiles.size).toBe(2);
    });
  });

  describe('Task Categories', () => {
    it('should support all task categories', async () => {
      const categories: SelfImprovementTask['category'][] = [
        'performance',
        'quality',
        'architecture',
        'testing',
        'documentation',
      ];

      for (const category of categories) {
        const task = await workflow.createTask(
          `${category} task`,
          'Description',
          category,
          'medium',
          4,
          'Benefit'
        );

        expect(task.category).toBe(category);
      }
    });
  });

  describe('Task Priorities', () => {
    it('should support all priority levels', async () => {
      const priorities: SelfImprovementTask['priority'][] = [
        'low',
        'medium',
        'high',
        'critical',
      ];

      for (const priority of priorities) {
        const task = await workflow.createTask(
          `${priority} task`,
          'Description',
          'quality',
          priority,
          4,
          'Benefit'
        );

        expect(task.priority).toBe(priority);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error when tracking modification without active task', () => {
      expect(() => workflow.trackFileModification('file.ts')).toThrow(
        'No active self-improvement task'
      );
    });

    it('should throw error when starting non-existent task', async () => {
      await expect(workflow.startTask('non-existent')).rejects.toThrow('Task not found');
    });

    it('should throw error when cancelling non-existent task', async () => {
      await expect(workflow.cancelTask('non-existent', 'reason')).rejects.toThrow(
        'Task not found'
      );
    });
  });

  describe('Task Sorting', () => {
    it('should sort tasks by creation time (newest first)', async () => {
      const task1 = await workflow.createTask('Task 1', 'Desc', 'quality', 'low', 2, 'Benefit');
      await new Promise(resolve => setTimeout(resolve, 10));
      const task2 = await workflow.createTask('Task 2', 'Desc', 'quality', 'low', 2, 'Benefit');
      await new Promise(resolve => setTimeout(resolve, 10));
      const task3 = await workflow.createTask('Task 3', 'Desc', 'quality', 'low', 2, 'Benefit');

      const tasks = workflow.getAllTasks();

      expect(tasks[0].id).toBe(task3.id);
      expect(tasks[1].id).toBe(task2.id);
      expect(tasks[2].id).toBe(task1.id);
    });
  });
});
