/**
 * Unit tests for RepositoryManager
 */

import { RepositoryManager, RepositoryManagerConfig } from '../repository-manager';
import { RepositoryConnector, RepositoryConfig } from '../repository-connector';
import { MemoryEngine } from '../../memory/engine';

// Mock RepositoryConnector
jest.mock('../repository-connector');
jest.mock('../../memory/engine');

describe('RepositoryManager', () => {
  let memoryEngine: jest.Mocked<MemoryEngine>;
  let config: RepositoryManagerConfig;

  beforeEach(() => {
    memoryEngine = new MemoryEngine({} as any) as jest.Mocked<MemoryEngine>;
    
    config = {
      prometheusRepoPath: './prometheus',
      repositories: [
        {
          id: 'repo1',
          name: 'Repository 1',
          provider: 'github',
          repoUrl: 'https://github.com/test/repo1.git',
          localPath: './repos/repo1',
        },
        {
          id: 'repo2',
          name: 'Repository 2',
          provider: 'gitlab',
          repoUrl: 'https://gitlab.com/test/repo2.git',
          localPath: './repos/repo2',
        },
      ],
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create RepositoryManager with multiple repositories', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      expect(manager.getRepositoryCount()).toBe(2);
      expect(manager.hasRepository('repo1')).toBe(true);
      expect(manager.hasRepository('repo2')).toBe(true);
    });

    it('should create connectors for all configured repositories', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      expect(RepositoryConnector).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRepository', () => {
    it('should return repository connector by ID', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      const repo = manager.getRepository('repo1');
      
      expect(repo).toBeInstanceOf(RepositoryConnector);
    });

    it('should throw error for non-existent repository', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      expect(() => manager.getRepository('non-existent')).toThrow('Repository non-existent not found');
    });
  });

  describe('getRepositoryIds', () => {
    it('should return all repository IDs', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      const ids = manager.getRepositoryIds();
      
      expect(ids).toEqual(['repo1', 'repo2']);
    });

    it('should return empty array if no repositories', () => {
      const emptyConfig = {
        prometheusRepoPath: './prometheus',
        repositories: [],
      };
      
      const manager = new RepositoryManager(emptyConfig, memoryEngine);
      
      expect(manager.getRepositoryIds()).toEqual([]);
    });
  });

  describe('context management', () => {
    it('should set and get repository context', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      manager.setContext('repo1');
      
      expect(manager.getContext()).toBe('repo1');
    });

    it('should throw error when setting context for non-existent repository', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      expect(() => manager.setContext('non-existent')).toThrow('Repository non-existent not found');
    });

    it('should clear context', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      manager.setContext('repo1');
      expect(manager.getContext()).toBe('repo1');
      
      manager.clearContext();
      expect(manager.getContext()).toBeUndefined();
    });

    it('should return undefined for context initially', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      expect(manager.getContext()).toBeUndefined();
    });
  });

  describe('addRepository', () => {
    it('should add a new repository', async () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      const newRepoConfig: RepositoryConfig = {
        id: 'repo3',
        name: 'Repository 3',
        provider: 'bitbucket',
        repoUrl: 'https://bitbucket.org/test/repo3.git',
        localPath: './repos/repo3',
      };
      
      await manager.addRepository(newRepoConfig);
      
      expect(manager.hasRepository('repo3')).toBe(true);
      expect(manager.getRepositoryCount()).toBe(3);
    });

    it('should throw error when adding repository with duplicate ID', async () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      const duplicateConfig: RepositoryConfig = {
        id: 'repo1', // Duplicate
        name: 'Duplicate Repository',
        provider: 'github',
        repoUrl: 'https://github.com/test/duplicate.git',
        localPath: './repos/duplicate',
      };
      
      await expect(manager.addRepository(duplicateConfig)).rejects.toThrow(
        'Repository with ID repo1 already exists'
      );
    });
  });

  describe('removeRepository', () => {
    it('should remove a repository', async () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      await manager.removeRepository('repo1');
      
      expect(manager.hasRepository('repo1')).toBe(false);
      expect(manager.getRepositoryCount()).toBe(1);
    });

    it('should throw error when removing non-existent repository', async () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      await expect(manager.removeRepository('non-existent')).rejects.toThrow(
        'Repository non-existent not found'
      );
    });

    it('should clear context if removing current repository', async () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      manager.setContext('repo1');
      await manager.removeRepository('repo1');
      
      expect(manager.getContext()).toBeUndefined();
    });
  });

  describe('verifyRepositorySeparation', () => {
    it('should reject paths in Prometheus repository', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      const isValid = manager.verifyRepositorySeparation('./prometheus/src/memory/engine.ts');
      
      expect(isValid).toBe(false);
    });

    it('should accept paths in managed repositories', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      // Mock getRepoPath
      const mockConnector = {
        getRepoPath: jest.fn().mockReturnValue('./repos/repo1'),
      };
      jest.spyOn(manager, 'getRepository').mockReturnValue(mockConnector as any);
      
      const isValid = manager.verifyRepositorySeparation('./repos/repo1/src/index.ts');
      
      expect(isValid).toBe(true);
    });

    it('should verify path is in expected repository', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      // Mock getRepoPath for both repos
      const mockConnector1 = {
        getRepoPath: jest.fn().mockReturnValue('./repos/repo1'),
      };
      const mockConnector2 = {
        getRepoPath: jest.fn().mockReturnValue('./repos/repo2'),
      };
      
      jest.spyOn(manager, 'getRepository')
        .mockImplementation((id: string) => {
          if (id === 'repo1') return mockConnector1 as any;
          if (id === 'repo2') return mockConnector2 as any;
          throw new Error('Not found');
        });
      
      // Path in repo1, expecting repo1 - should be true
      const isValid1 = manager.verifyRepositorySeparation('./repos/repo1/src/index.ts', 'repo1');
      expect(isValid1).toBe(true);
      
      // Path in repo2, expecting repo1 - should be false
      const isValid2 = manager.verifyRepositorySeparation('./repos/repo2/src/index.ts', 'repo1');
      expect(isValid2).toBe(false);
    });
  });

  describe('getRepositoryIdFromPath', () => {
    it('should return repository ID for valid path', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      // Mock getRepoPath
      const mockConnector = {
        getRepoPath: jest.fn().mockReturnValue('./repos/repo1'),
      };
      jest.spyOn(manager, 'getRepository').mockReturnValue(mockConnector as any);
      
      const repoId = manager.getRepositoryIdFromPath('./repos/repo1/src/index.ts');
      
      expect(repoId).toBe('repo1');
    });

    it('should return undefined for path not in any repository', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      // Mock getRepoPath to return different paths
      jest.spyOn(manager, 'getRepository').mockImplementation(() => ({
        getRepoPath: jest.fn().mockReturnValue('./repos/other'),
      } as any));
      
      const repoId = manager.getRepositoryIdFromPath('./some/other/path/file.ts');
      
      expect(repoId).toBeUndefined();
    });
  });

  describe('hasRepository', () => {
    it('should return true for existing repository', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      expect(manager.hasRepository('repo1')).toBe(true);
    });

    it('should return false for non-existent repository', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      expect(manager.hasRepository('non-existent')).toBe(false);
    });
  });

  describe('getRepositoryCount', () => {
    it('should return correct repository count', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      expect(manager.getRepositoryCount()).toBe(2);
    });

    it('should return 0 for empty manager', () => {
      const emptyConfig = {
        prometheusRepoPath: './prometheus',
        repositories: [],
      };
      
      const manager = new RepositoryManager(emptyConfig, memoryEngine);
      
      expect(manager.getRepositoryCount()).toBe(0);
    });
  });

  describe('updateRepositoryProfile', () => {
    it('should update repository profile', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      const mockConnector = {
        updateProfile: jest.fn(),
      };
      jest.spyOn(manager, 'getRepository').mockReturnValue(mockConnector as any);
      
      manager.updateRepositoryProfile('repo1', { autoMerge: true });
      
      expect(mockConnector.updateProfile).toHaveBeenCalledWith({ autoMerge: true });
    });
  });

  describe('onAnyRepositoryChange', () => {
    it('should register listener for all repositories', () => {
      const manager = new RepositoryManager(config, memoryEngine);
      
      const listener = jest.fn();
      manager.onAnyRepositoryChange(listener);
      
      // Verify onChangeDetected was called for each connector
      expect(RepositoryConnector.prototype.onChangeDetected).toHaveBeenCalledTimes(2);
    });
  });
});
