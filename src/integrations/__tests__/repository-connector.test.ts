/**
 * Unit tests for RepositoryConnector
 */

import { RepositoryConnector, RepositoryConfig } from '../repository-connector';
import { MemoryEngine } from '../../memory/engine';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock MemoryEngine
jest.mock('../../memory/engine');

describe('RepositoryConnector', () => {
  let memoryEngine: jest.Mocked<MemoryEngine>;
  let config: RepositoryConfig;

  beforeEach(() => {
    memoryEngine = new MemoryEngine({} as any) as jest.Mocked<MemoryEngine>;
    
    config = {
      id: 'test-repo',
      name: 'Test Repository',
      provider: 'github',
      repoUrl: 'https://github.com/test/repo.git',
      localPath: './test-repos/test-repo',
      branch: 'main',
      credentials: {
        token: 'test-token',
      },
      profile: {
        branchingStrategy: 'github-flow',
        mainBranch: 'main',
        featureBranchPrefix: 'feature/',
        testCommand: 'npm test',
        reviewRequired: true,
        autoMerge: false,
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a RepositoryConnector instance', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      
      expect(connector).toBeInstanceOf(RepositoryConnector);
      expect(connector.getRepoId()).toBe('test-repo');
      expect(connector.getRepoPath()).toBe('./test-repos/test-repo');
    });

    it('should use default branch from profile if not specified', () => {
      const configWithoutBranch = { ...config };
      delete configWithoutBranch.branch;
      
      const connector = new RepositoryConnector(configWithoutBranch, memoryEngine);
      const connectorConfig = connector.getConfig();
      
      expect(connectorConfig.branch).toBe('main'); // From profile.mainBranch
    });
  });

  describe('buildAuthenticatedUrl', () => {
    it('should build GitHub authenticated URL correctly', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      
      // Access private method through any
      const url = (connector as any).buildAuthenticatedUrl();
      
      expect(url).toContain('test-token');
      expect(url).toContain('github.com');
    });

    it('should build GitLab authenticated URL correctly', () => {
      const gitlabConfig = {
        ...config,
        provider: 'gitlab' as const,
        repoUrl: 'https://gitlab.com/test/repo.git',
      };
      
      const connector = new RepositoryConnector(gitlabConfig, memoryEngine);
      const url = (connector as any).buildAuthenticatedUrl();
      
      expect(url).toContain('oauth2');
      expect(url).toContain('test-token');
    });

    it('should build Bitbucket authenticated URL correctly', () => {
      const bitbucketConfig = {
        ...config,
        provider: 'bitbucket' as const,
        repoUrl: 'https://bitbucket.org/test/repo.git',
      };
      
      const connector = new RepositoryConnector(bitbucketConfig, memoryEngine);
      const url = (connector as any).buildAuthenticatedUrl();
      
      expect(url).toContain('x-token-auth');
      expect(url).toContain('test-token');
    });

    it('should return original URL if no credentials', () => {
      const configWithoutCreds = { ...config };
      delete configWithoutCreds.credentials;
      
      const connector = new RepositoryConnector(configWithoutCreds, memoryEngine);
      const url = (connector as any).buildAuthenticatedUrl();
      
      expect(url).toBe(config.repoUrl);
    });
  });

  describe('getConfig', () => {
    it('should return repository configuration', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      const returnedConfig = connector.getConfig();
      
      expect(returnedConfig.id).toBe('test-repo');
      expect(returnedConfig.name).toBe('Test Repository');
      expect(returnedConfig.provider).toBe('github');
    });

    it('should return a copy of config (not reference)', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      const returnedConfig = connector.getConfig();
      
      returnedConfig.name = 'Modified Name';
      
      expect(connector.getConfig().name).toBe('Test Repository');
    });
  });

  describe('updateProfile', () => {
    it('should update repository profile', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      
      connector.updateProfile({
        autoMerge: true,
        testCommand: 'npm run test:ci',
      });
      
      const updatedConfig = connector.getConfig();
      expect(updatedConfig.profile?.autoMerge).toBe(true);
      expect(updatedConfig.profile?.testCommand).toBe('npm run test:ci');
      expect(updatedConfig.profile?.reviewRequired).toBe(true); // Unchanged
    });

    it('should handle partial profile updates', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      
      connector.updateProfile({
        autoMerge: true,
      });
      
      const updatedConfig = connector.getConfig();
      expect(updatedConfig.profile?.autoMerge).toBe(true);
      expect(updatedConfig.profile?.testCommand).toBe('npm test'); // Unchanged
    });
  });

  describe('onChangeDetected', () => {
    it('should register change listeners', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      const listener = jest.fn();
      
      connector.onChangeDetected(listener);
      
      // Trigger a change event
      (connector as any).notifyChangeListeners({
        repoId: 'test-repo',
        type: 'modified',
        path: '/test/file.ts',
        timestamp: Date.now(),
      });
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      connector.onChangeDetected(listener1);
      connector.onChangeDetected(listener2);
      
      (connector as any).notifyChangeListeners({
        repoId: 'test-repo',
        type: 'modified',
        path: '/test/file.ts',
        timestamp: Date.now(),
      });
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();
      
      connector.onChangeDetected(errorListener);
      connector.onChangeDetected(goodListener);
      
      // Should not throw
      expect(() => {
        (connector as any).notifyChangeListeners({
          repoId: 'test-repo',
          type: 'modified',
          path: '/test/file.ts',
          timestamp: Date.now(),
        });
      }).not.toThrow();
      
      expect(goodListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRepoId', () => {
    it('should return repository ID', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      expect(connector.getRepoId()).toBe('test-repo');
    });
  });

  describe('getRepoPath', () => {
    it('should return repository path', () => {
      const connector = new RepositoryConnector(config, memoryEngine);
      expect(connector.getRepoPath()).toBe('./test-repos/test-repo');
    });
  });
});
