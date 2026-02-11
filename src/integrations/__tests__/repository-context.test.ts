/**
 * Tests for RepositoryContextManager
 */

import { RepositoryContextManager, RepositoryContext, ContextAwareOperation } from '../repository-context';
import { MemoryEngine } from '../../memory/engine';

describe('RepositoryContextManager', () => {
  let memoryEngine: MemoryEngine;
  let contextManager: RepositoryContextManager;

  const createContext = (repoId: string): RepositoryContext => ({
    repoId,
    repoPath: `/path/to/${repoId}`,
    provider: 'github',
    url: `https://github.com/org/${repoId}`,
    enteredAt: Date.now(),
  });

  beforeEach(() => {
    memoryEngine = new MemoryEngine({
      dbPath: ':memory:',
      embeddingProvider: 'mock',
    });
    contextManager = new RepositoryContextManager(memoryEngine, '/path/to/prometheus');
  });

  afterEach(async () => {
    await memoryEngine.close();
  });

  describe('Context Setting', () => {
    it('should set repository context', () => {
      const context = createContext('test-repo');
      contextManager.setContext(context);

      const current = contextManager.getCurrentContext();
      expect(current).toEqual(context);
      expect(contextManager.getCurrentRepoId()).toBe('test-repo');
    });

    it('should track context history', () => {
      contextManager.setContext(createContext('repo1'));
      contextManager.setContext(createContext('repo2'));
      contextManager.setContext(createContext('repo3'));

      const history = contextManager.getHistory();
      expect(history.length).toBe(3);
      expect(history[0].repoId).toBe('repo1');
      expect(history[2].repoId).toBe('repo3');
    });

    it('should limit history size', () => {
      // Add more than 100 contexts
      for (let i = 0; i < 150; i++) {
        contextManager.setContext(createContext(`repo${i}`));
      }

      const history = contextManager.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should throw error for invalid context', () => {
      const invalidContext = {
        repoId: '',
        repoPath: '',
        provider: 'github' as const,
        url: '',
        enteredAt: Date.now(),
      };

      expect(() => contextManager.setContext(invalidContext)).toThrow('Invalid context');
    });

    it('should warn when setting Prometheus context', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const prometheusContext: RepositoryContext = {
        repoId: 'prometheus',
        repoPath: '/path/to/prometheus',
        provider: 'github',
        url: 'https://github.com/org/prometheus',
        enteredAt: Date.now(),
      };

      contextManager.setContext(prometheusContext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Prometheus repository')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Context Stack', () => {
    it('should push context onto stack', () => {
      contextManager.setContext(createContext('repo1'));
      contextManager.pushContext(createContext('repo2'));

      expect(contextManager.getCurrentRepoId()).toBe('repo2');
    });

    it('should pop context from stack', () => {
      contextManager.setContext(createContext('repo1'));
      contextManager.pushContext(createContext('repo2'));

      const popped = contextManager.popContext();

      expect(popped?.repoId).toBe('repo2');
      expect(contextManager.getCurrentRepoId()).toBe('repo1');
    });

    it('should handle multiple pushes and pops', () => {
      contextManager.setContext(createContext('repo1'));
      contextManager.pushContext(createContext('repo2'));
      contextManager.pushContext(createContext('repo3'));

      expect(contextManager.getCurrentRepoId()).toBe('repo3');

      contextManager.popContext();
      expect(contextManager.getCurrentRepoId()).toBe('repo2');

      contextManager.popContext();
      expect(contextManager.getCurrentRepoId()).toBe('repo1');
    });

    it('should return null when popping empty stack', () => {
      const result = contextManager.popContext();
      expect(result).toBeNull();
    });

    it('should warn when popping empty stack', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      contextManager.popContext();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot pop')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Context Validation', () => {
    it('should validate valid context', () => {
      const context = createContext('test-repo');
      const validation = contextManager.validateContext(context);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing repoId', () => {
      const context = { ...createContext('test'), repoId: '' };
      const validation = contextManager.validateContext(context);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('repoId'))).toBe(true);
    });

    it('should detect missing repoPath', () => {
      const context = { ...createContext('test'), repoPath: '' };
      const validation = contextManager.validateContext(context);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('repoPath'))).toBe(true);
    });

    it('should detect path traversal', () => {
      const context = { ...createContext('test'), repoPath: '/path/../../../etc' };
      const validation = contextManager.validateContext(context);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('traversal'))).toBe(true);
    });
  });

  describe('Context Requirements', () => {
    it('should require context to be set', () => {
      expect(() => contextManager.requireContext()).toThrow('No repository context');
    });

    it('should return context when set', () => {
      const context = createContext('test-repo');
      contextManager.setContext(context);

      const required = contextManager.requireContext();
      expect(required).toEqual(context);
    });

    it('should require specific repository', () => {
      contextManager.setContext(createContext('repo1'));

      expect(() => contextManager.requireRepository('repo2')).toThrow(
        "Expected repository 'repo2'"
      );
    });

    it('should return context for correct repository', () => {
      const context = createContext('test-repo');
      contextManager.setContext(context);

      const required = contextManager.requireRepository('test-repo');
      expect(required).toEqual(context);
    });
  });

  describe('Context Execution', () => {
    it('should execute function with context', async () => {
      const context = createContext('test-repo');
      let executedContext: RepositoryContext | null = null;

      await contextManager.withContext(context, async (ctx) => {
        executedContext = ctx;
      });

      expect(executedContext).toEqual(context);
    });

    it('should restore previous context after execution', async () => {
      contextManager.setContext(createContext('repo1'));

      await contextManager.withContext(createContext('repo2'), async () => {
        expect(contextManager.getCurrentRepoId()).toBe('repo2');
      });

      expect(contextManager.getCurrentRepoId()).toBe('repo1');
    });

    it('should restore context even on error', async () => {
      contextManager.setContext(createContext('repo1'));

      try {
        await contextManager.withContext(createContext('repo2'), async () => {
          throw new Error('Test error');
        });
      } catch (error) {
        // Expected
      }

      expect(contextManager.getCurrentRepoId()).toBe('repo1');
    });

    it('should execute with temporary context', async () => {
      let executedRepoId: string | null = null;

      await contextManager.withTemporaryContext(
        'temp-repo',
        '/path/to/temp',
        'github',
        'https://github.com/org/temp',
        async (ctx) => {
          executedRepoId = ctx.repoId;
        }
      );

      expect(executedRepoId).toBe('temp-repo');
      expect(contextManager.getCurrentContext()).toBeNull();
    });
  });

  describe('Prometheus Protection', () => {
    it('should detect Prometheus repository', () => {
      const prometheusContext: RepositoryContext = {
        repoId: 'prometheus',
        repoPath: '/path/to/prometheus',
        provider: 'github',
        url: 'https://github.com/org/prometheus',
        enteredAt: Date.now(),
      };

      contextManager.setContext(prometheusContext);

      expect(contextManager.isModifyingPrometheus()).toBe(true);
    });

    it('should prevent Prometheus modifications', () => {
      const prometheusContext: RepositoryContext = {
        repoId: 'prometheus',
        repoPath: '/path/to/prometheus',
        provider: 'github',
        url: 'https://github.com/org/prometheus',
        enteredAt: Date.now(),
      };

      contextManager.setContext(prometheusContext);

      expect(() => contextManager.preventPrometheusModification()).toThrow(
        'Cannot modify Prometheus repository'
      );
    });

    it('should allow non-Prometheus modifications', () => {
      contextManager.setContext(createContext('other-repo'));

      expect(() => contextManager.preventPrometheusModification()).not.toThrow();
    });
  });

  describe('Context Statistics', () => {
    it('should provide statistics', () => {
      contextManager.setContext(createContext('repo1'));
      contextManager.pushContext(createContext('repo2'));

      const stats = contextManager.getStatistics();

      expect(stats.currentRepo).toBe('repo2');
      expect(stats.stackDepth).toBe(1);
      expect(stats.historySize).toBe(2);
    });

    it('should track recent repositories', () => {
      contextManager.setContext(createContext('repo1'));
      contextManager.setContext(createContext('repo2'));
      contextManager.setContext(createContext('repo3'));

      const stats = contextManager.getStatistics();

      expect(stats.recentRepos).toContain('repo1');
      expect(stats.recentRepos).toContain('repo2');
      expect(stats.recentRepos).toContain('repo3');
    });
  });

  describe('Context Snapshots', () => {
    it('should create snapshot', () => {
      contextManager.setContext(createContext('repo1'));
      contextManager.pushContext(createContext('repo2'));

      const snapshot = contextManager.createSnapshot();

      expect(snapshot.current?.repoId).toBe('repo2');
      expect(snapshot.stack.length).toBe(1);
      expect(snapshot.history.length).toBe(2);
      expect(snapshot.timestamp).toBeTruthy();
    });

    it('should restore from snapshot', () => {
      contextManager.setContext(createContext('repo1'));
      const snapshot = contextManager.createSnapshot();

      contextManager.setContext(createContext('repo2'));
      expect(contextManager.getCurrentRepoId()).toBe('repo2');

      contextManager.restoreSnapshot(snapshot);
      expect(contextManager.getCurrentRepoId()).toBe('repo1');
    });
  });

  describe('Context Clearing', () => {
    it('should clear context', () => {
      contextManager.setContext(createContext('test-repo'));
      contextManager.clearContext();

      expect(contextManager.getCurrentContext()).toBeNull();
    });

    it('should clear context stack', () => {
      contextManager.setContext(createContext('repo1'));
      contextManager.pushContext(createContext('repo2'));
      contextManager.clearContext();

      const stats = contextManager.getStatistics();
      expect(stats.stackDepth).toBe(0);
    });
  });

  describe('Context Activity', () => {
    it('should check if repository is active', () => {
      contextManager.setContext(createContext('test-repo'));

      expect(contextManager.isActive('test-repo')).toBe(true);
      expect(contextManager.isActive('other-repo')).toBe(false);
    });
  });

  describe('Recent Contexts', () => {
    it('should get recent contexts', () => {
      contextManager.setContext(createContext('repo1'));
      contextManager.setContext(createContext('repo2'));
      contextManager.setContext(createContext('repo3'));

      const recent = contextManager.getRecentContexts(2);

      expect(recent.length).toBe(2);
      expect(recent[0].repoId).toBe('repo2');
      expect(recent[1].repoId).toBe('repo3');
    });
  });
});

describe('ContextAwareOperation', () => {
  let memoryEngine: MemoryEngine;
  let contextManager: RepositoryContextManager;

  const createContext = (repoId: string): RepositoryContext => ({
    repoId,
    repoPath: `/path/to/${repoId}`,
    provider: 'github',
    url: `https://github.com/org/${repoId}`,
    enteredAt: Date.now(),
  });

  beforeEach(() => {
    memoryEngine = new MemoryEngine({
      dbPath: ':memory:',
      embeddingProvider: 'mock',
    });
    contextManager = new RepositoryContextManager(memoryEngine, '/path/to/prometheus');
  });

  afterEach(async () => {
    await memoryEngine.close();
  });

  describe('Operation Execution', () => {
    it('should execute operation with context', async () => {
      contextManager.setContext(createContext('test-repo'));

      const operation = new ContextAwareOperation(contextManager);
      const result = await operation.execute(async (ctx) => {
        return ctx.repoId;
      });

      expect(result).toBe('test-repo');
    });

    it('should require context to be set', async () => {
      const operation = new ContextAwareOperation(contextManager);

      await expect(
        operation.execute(async () => 'test')
      ).rejects.toThrow('No repository context');
    });

    it('should validate required repository', async () => {
      contextManager.setContext(createContext('repo1'));

      const operation = new ContextAwareOperation(contextManager, 'repo2');

      await expect(
        operation.execute(async () => 'test')
      ).rejects.toThrow("Operation requires repository 'repo2'");
    });

    it('should prevent Prometheus modifications', async () => {
      const prometheusContext: RepositoryContext = {
        repoId: 'prometheus',
        repoPath: '/path/to/prometheus',
        provider: 'github',
        url: 'https://github.com/org/prometheus',
        enteredAt: Date.now(),
      };

      contextManager.setContext(prometheusContext);

      const operation = new ContextAwareOperation(contextManager);

      await expect(
        operation.execute(async () => 'test')
      ).rejects.toThrow('Cannot modify Prometheus repository');
    });
  });

  describe('Operation with Context Setup', () => {
    it('should execute with provided context', async () => {
      const context = createContext('test-repo');
      const operation = new ContextAwareOperation(contextManager);

      const result = await operation.executeWithContext(context, async (ctx) => {
        return ctx.repoId;
      });

      expect(result).toBe('test-repo');
    });

    it('should restore previous context', async () => {
      contextManager.setContext(createContext('repo1'));

      const operation = new ContextAwareOperation(contextManager);
      await operation.executeWithContext(createContext('repo2'), async () => {
        expect(contextManager.getCurrentRepoId()).toBe('repo2');
      });

      expect(contextManager.getCurrentRepoId()).toBe('repo1');
    });
  });
});
