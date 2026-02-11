/**
 * Tests for Multi-Repository Support in RepositoryManager
 */

import { RepositoryManager } from '../repository-manager';
import { RepositoryConfig } from '../repository-connector';
import { MemoryEngine } from '../../memory/engine';

describe('RepositoryManager - Multi-Repository Support', () => {
  let memoryEngine: MemoryEngine;
  let manager: RepositoryManager;

  beforeEach(() => {
    memoryEngine = new MemoryEngine({
      dbPath: ':memory:',
      embeddingProvider: 'mock',
    });

    manager = new RepositoryManager(memoryEngine, {
      prometheusRepoPath: '/path/to/prometheus',
    });
  });

  afterEach(async () => {
    await manager.stopAll();
    await memoryEngine.close();
  });

  describe('Repository Addition', () => {
    it('should add a repository', async () => {
      const config: RepositoryConfig = {
        id: 'test-repo',
        name: 'Test Repository',
        provider: 'github',
        url: 'https://github.com/org/test-repo',
        localPath: '/path/to/test-repo',
        auth: {
          type: 'token',
          token: 'test-token',
        },
      };

      await manager.addRepository(config);

      expect(manager.hasRepository('test-repo')).toBe(true);
      expect(manager.getRepositoryCount()).toBe(1);
    });

    it('should create isolated index namespace', async () => {
      const config: RepositoryConfig = {
        id: 'test-repo',
        name: 'Test',
        provider: 'github',
        url: 'https://github.com/org/test',
        localPath: '/path/to/test',
        auth: { type: 'token', token: 'test' },
      };

      await manager.addRepository(config);

      const namespace = manager.getRepositoryIndexNamespace('test-repo');
      expect(namespace).toBe('repo:test-repo');
    });

    it('should create pattern tracker', async () => {
      const config: RepositoryConfig = {
        id: 'test-repo',
        name: 'Test',
        provider: 'github',
        url: 'https://github.com/org/test',
        localPath: '/path/to/test',
        auth: { type: 'token', token: 'test' },
      };

      await manager.addRepository(config);

      const tracker = manager.getPatternTracker('test-repo');
      expect(tracker).toBeDefined();
    });

    it('should throw error for duplicate repository ID', async () => {
      const config: RepositoryConfig = {
        id: 'test-repo',
        name: 'Test',
        provider: 'github',
        url: 'https://github.com/org/test',
        localPath: '/path/to/test',
        auth: { type: 'token', token: 'test' },
      };

      await manager.addRepository(config);

      await expect(manager.addRepository(config)).rejects.toThrow(
        'Repository with ID test-repo already exists'
      );
    });
  });

  describe('Repository Removal', () => {
    beforeEach(async () => {
      await manager.addRepository({
        id: 'test-repo',
        name: 'Test',
        provider: 'github',
        url: 'https://github.com/org/test',
        localPath: '/path/to/test',
        auth: { type: 'token', token: 'test' },
      });
    });

    it('should remove a repository', async () => {
      await manager.removeRepository('test-repo');

      expect(manager.hasRepository('test-repo')).toBe(false);
      expect(manager.getRepositoryCount()).toBe(0);
    });

    it('should clear context when removing current repository', async () => {
      manager.setCurrentRepository('test-repo');
      expect(manager.getCurrentRepository()).toBe('test-repo');

      await manager.removeRepository('test-repo');

      expect(manager.getCurrentRepository()).toBeNull();
    });

    it('should throw error for non-existent repository', async () => {
      await expect(manager.removeRepository('non-existent')).rejects.toThrow(
        'Repository non-existent not found'
      );
    });
  });

  describe('Context Management', () => {
    beforeEach(async () => {
      await manager.addRepository({
        id: 'repo1',
        name: 'Repo 1',
        provider: 'github',
        url: 'https://github.com/org/repo1',
        localPath: '/path/to/repo1',
        auth: { type: 'token', token: 'test' },
      });

      await manager.addRepository({
        id: 'repo2',
        name: 'Repo 2',
        provider: 'github',
        url: 'https://github.com/org/repo2',
        localPath: '/path/to/repo2',
        auth: { type: 'token', token: 'test' },
      });
    });

    it('should set current repository', () => {
      manager.setCurrentRepository('repo1');

      expect(manager.getCurrentRepository()).toBe('repo1');
    });

    it('should switch between repositories', async () => {
      manager.setCurrentRepository('repo1');
      expect(manager.getCurrentRepository()).toBe('repo1');

      await manager.switchRepository('repo1', 'repo2');
      expect(manager.getCurrentRepository()).toBe('repo2');
    });

    it('should clear current repository', () => {
      manager.setCurrentRepository('repo1');
      manager.clearCurrentRepository();

      expect(manager.getCurrentRepository()).toBeNull();
    });

    it('should throw error when setting non-existent repository', () => {
      expect(() => manager.setCurrentRepository('non-existent')).toThrow(
        'Repository non-existent not found'
      );
    });
  });

  describe('Repository Isolation', () => {
    beforeEach(async () => {
      await manager.addRepository({
        id: 'repo1',
        name: 'Repo 1',
        provider: 'github',
        url: 'https://github.com/org/repo1',
        localPath: '/path/to/repo1',
        auth: { type: 'token', token: 'test' },
      });

      await manager.addRepository({
        id: 'repo2',
        name: 'Repo 2',
        provider: 'github',
        url: 'https://github.com/org/repo2',
        localPath: '/path/to/repo2',
        auth: { type: 'token', token: 'test' },
      });
    });

    it('should execute operation with repository isolation', async () => {
      let executedRepoId: string | null = null;

      await manager.withRepositoryIsolation('repo1', async (connector) => {
        executedRepoId = connector.getConfig().id;
      });

      expect(executedRepoId).toBe('repo1');
    });

    it('should restore context after isolated operation', async () => {
      manager.setCurrentRepository('repo1');

      await manager.withRepositoryIsolation('repo2', async () => {
        expect(manager.getCurrentRepository()).toBe('repo2');
      });

      expect(manager.getCurrentRepository()).toBe('repo1');
    });

    it('should validate repository isolation', async () => {
      const validation = await manager.validateIsolation();

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should have unique index namespaces', () => {
      const namespace1 = manager.getRepositoryIndexNamespace('repo1');
      const namespace2 = manager.getRepositoryIndexNamespace('repo2');

      expect(namespace1).not.toBe(namespace2);
      expect(namespace1).toBe('repo:repo1');
      expect(namespace2).toBe('repo:repo2');
    });
  });

  describe('Repository Statistics', () => {
    beforeEach(async () => {
      await manager.addRepository({
        id: 'repo1',
        name: 'Repo 1',
        provider: 'github',
        url: 'https://github.com/org/repo1',
        localPath: '/path/to/repo1',
        auth: { type: 'token', token: 'test' },
      });

      await manager.addRepository({
        id: 'repo2',
        name: 'Repo 2',
        provider: 'github',
        url: 'https://github.com/org/repo2',
        localPath: '/path/to/repo2',
        auth: { type: 'token', token: 'test' },
      });
    });

    it('should provide repository statistics', () => {
      manager.setCurrentRepository('repo1');

      const stats = manager.getStatistics();

      expect(stats.totalRepositories).toBe(2);
      expect(stats.activeRepositories).toBe(2);
      expect(stats.currentRepository).toBe('repo1');
      expect(stats.repositories).toHaveLength(2);
    });

    it('should list all repositories', () => {
      const repos = manager.getAllRepositories();

      expect(repos).toHaveLength(2);
      expect(repos[0].id).toBe('repo1');
      expect(repos[1].id).toBe('repo2');
    });

    it('should indicate active repository', () => {
      manager.setCurrentRepository('repo1');

      const repos = manager.getAllRepositories();
      const repo1 = repos.find(r => r.id === 'repo1');
      const repo2 = repos.find(r => r.id === 'repo2');

      expect(repo1?.isActive).toBe(true);
      expect(repo2?.isActive).toBe(false);
    });
  });

  describe('Manager Access', () => {
    it('should provide context manager', () => {
      const contextManager = manager.getContextManager();
      expect(contextManager).toBeDefined();
    });

    it('should provide profile manager', () => {
      const profileManager = manager.getProfileManager();
      expect(profileManager).toBeDefined();
    });

    it('should provide pattern tracker for repository', async () => {
      await manager.addRepository({
        id: 'test-repo',
        name: 'Test',
        provider: 'github',
        url: 'https://github.com/org/test',
        localPath: '/path/to/test',
        auth: { type: 'token', token: 'test' },
      });

      const tracker = manager.getPatternTracker('test-repo');
      expect(tracker).toBeDefined();
    });

    it('should throw error for non-existent pattern tracker', () => {
      expect(() => manager.getPatternTracker('non-existent')).toThrow(
        'Pattern tracker not found'
      );
    });
  });

  describe('Repository Separation', () => {
    beforeEach(async () => {
      await manager.addRepository({
        id: 'test-repo',
        name: 'Test',
        provider: 'github',
        url: 'https://github.com/org/test',
        localPath: '/path/to/test-repo',
        auth: { type: 'token', token: 'test' },
      });
    });

    it('should verify repository separation', () => {
      const isValid = manager.verifyRepositorySeparation('/path/to/test-repo/file.ts', 'test-repo');
      expect(isValid).toBe(true);
    });

    it('should prevent Prometheus repository modification', () => {
      const isValid = manager.verifyRepositorySeparation('/path/to/prometheus/file.ts');
      expect(isValid).toBe(false);
    });

    it('should detect cross-repository access', () => {
      const isValid = manager.verifyRepositorySeparation('/path/to/other-repo/file.ts', 'test-repo');
      expect(isValid).toBe(false);
    });

    it('should get repository ID from path', () => {
      const repoId = manager.getRepositoryIdFromPath('/path/to/test-repo/src/index.ts');
      expect(repoId).toBe('test-repo');
    });

    it('should return undefined for unmanaged path', () => {
      const repoId = manager.getRepositoryIdFromPath('/path/to/unmanaged/file.ts');
      expect(repoId).toBeUndefined();
    });
  });

  describe('Multiple Repositories', () => {
    it('should handle many repositories', async () => {
      for (let i = 0; i < 10; i++) {
        await manager.addRepository({
          id: `repo${i}`,
          name: `Repo ${i}`,
          provider: 'github',
          url: `https://github.com/org/repo${i}`,
          localPath: `/path/to/repo${i}`,
          auth: { type: 'token', token: 'test' },
        });
      }

      expect(manager.getRepositoryCount()).toBe(10);

      const stats = manager.getStatistics();
      expect(stats.totalRepositories).toBe(10);
    });

    it('should maintain isolation across many repositories', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.addRepository({
          id: `repo${i}`,
          name: `Repo ${i}`,
          provider: 'github',
          url: `https://github.com/org/repo${i}`,
          localPath: `/path/to/repo${i}`,
          auth: { type: 'token', token: 'test' },
        });
      }

      const validation = await manager.validateIsolation();
      expect(validation.valid).toBe(true);
    });
  });
});
