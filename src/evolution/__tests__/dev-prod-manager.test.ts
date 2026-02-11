/**
 * Tests for DevProdManager
 */

import { DevProdManager, DevProdConfig } from '../dev-prod-manager';
import { RepositoryManager } from '../../integrations/repository-manager';
import { MemoryEngine } from '../../memory/engine';

describe('DevProdManager', () => {
  let memoryEngine: MemoryEngine;
  let repoManager: RepositoryManager;
  let devProdManager: DevProdManager;
  let config: DevProdConfig;

  beforeEach(() => {
    memoryEngine = new MemoryEngine({
      dbPath: ':memory:',
      embeddingProvider: 'mock',
    });

    repoManager = new RepositoryManager(memoryEngine, {
      prometheusRepoPath: '/path/to/prometheus',
    });

    config = {
      devRepoPath: '/path/to/prometheus-dev',
      devRepoUrl: 'https://github.com/org/prometheus-dev',
      prodRepoPath: '/path/to/prometheus-prod',
      prodRepoUrl: 'https://github.com/org/prometheus-prod',
      gitProvider: 'github',
      auth: {
        type: 'token',
        token: 'test-token',
      },
    };

    devProdManager = new DevProdManager(repoManager, memoryEngine, config);
  });

  afterEach(async () => {
    await memoryEngine.close();
  });

  describe('Initialization', () => {
    it('should initialize dev and prod repositories', async () => {
      await devProdManager.initialize();

      expect(repoManager.hasRepository('prometheus-dev')).toBe(true);
      expect(repoManager.hasRepository('prometheus-prod')).toBe(true);
    });
  });

  describe('Repository Context', () => {
    beforeEach(async () => {
      await devProdManager.initialize();
    });

    it('should detect dev repository', async () => {
      await devProdManager.switchToDev();
      expect(devProdManager.isInDevRepository()).toBe(true);
      expect(devProdManager.isInProdRepository()).toBe(false);
    });

    it('should detect prod repository', async () => {
      await devProdManager.switchToProd();
      expect(devProdManager.isInProdRepository()).toBe(true);
      expect(devProdManager.isInDevRepository()).toBe(false);
    });

    it('should switch between repositories', async () => {
      await devProdManager.switchToDev();
      expect(devProdManager.isInDevRepository()).toBe(true);

      await devProdManager.switchToProd();
      expect(devProdManager.isInProdRepository()).toBe(true);

      await devProdManager.switchToDev();
      expect(devProdManager.isInDevRepository()).toBe(true);
    });
  });

  describe('Protection', () => {
    beforeEach(async () => {
      await devProdManager.initialize();
    });

    it('should require dev repository for certain operations', async () => {
      await devProdManager.switchToProd();

      expect(() => devProdManager.requireDevRepository()).toThrow(
        'must be performed in the development repository'
      );
    });

    it('should prevent direct prod modifications', async () => {
      await devProdManager.switchToProd();

      expect(() => devProdManager.preventDirectProdModification()).toThrow(
        'Direct modifications to production repository are not allowed'
      );
    });

    it('should allow dev operations in dev repository', async () => {
      await devProdManager.switchToDev();

      expect(() => devProdManager.requireDevRepository()).not.toThrow();
      expect(() => devProdManager.preventDirectProdModification()).not.toThrow();
    });
  });

  describe('Promotion Requests', () => {
    beforeEach(async () => {
      await devProdManager.initialize();
      await devProdManager.switchToDev();
    });

    it('should create promotion request', async () => {
      const request = await devProdManager.createPromotionRequest(
        'Improve memory efficiency',
        'Optimized memory allocation in indexing system',
        [
          {
            file: 'src/memory/engine.ts',
            type: 'modified',
            linesAdded: 50,
            linesRemoved: 30,
            summary: 'Optimized memory allocation',
          },
        ],
        {
          passed: true,
          totalTests: 100,
          passedTests: 100,
          failedTests: 0,
          coverage: 85,
          duration: 5000,
          failures: [],
        },
        {
          risk: 'low',
          affectedComponents: ['memory-engine'],
          estimatedDowntime: 0,
          rollbackComplexity: 'simple',
          benefits: ['Reduced memory usage by 20%'],
          risks: ['Potential edge cases in large files'],
        },
        {
          steps: ['Revert commit', 'Restart service'],
          estimatedTime: 5,
          dataBackupRequired: false,
          automatable: true,
        }
      );

      expect(request.id).toBeTruthy();
      expect(request.status).toBe('pending');
      expect(request.title).toBe('Improve memory efficiency');
    });

    it('should reject promotion with failing tests', async () => {
      await expect(
        devProdManager.createPromotionRequest(
          'Test',
          'Test',
          [],
          {
            passed: false,
            totalTests: 10,
            passedTests: 8,
            failedTests: 2,
            duration: 1000,
            failures: [{ test: 'test1', error: 'Failed' }],
          },
          {
            risk: 'low',
            affectedComponents: [],
            estimatedDowntime: 0,
            rollbackComplexity: 'simple',
            benefits: [],
            risks: [],
          },
          {
            steps: [],
            estimatedTime: 0,
            dataBackupRequired: false,
            automatable: true,
          }
        )
      ).rejects.toThrow('failing tests');
    });

    it('should get pending promotions', async () => {
      await devProdManager.createPromotionRequest(
        'Test 1',
        'Description 1',
        [],
        {
          passed: true,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          duration: 1000,
          failures: [],
        },
        {
          risk: 'low',
          affectedComponents: [],
          estimatedDowntime: 0,
          rollbackComplexity: 'simple',
          benefits: [],
          risks: [],
        },
        {
          steps: [],
          estimatedTime: 0,
          dataBackupRequired: false,
          automatable: true,
        }
      );

      const pending = devProdManager.getPendingPromotions();
      expect(pending.length).toBe(1);
      expect(pending[0].title).toBe('Test 1');
    });
  });

  describe('Approval Workflow', () => {
    let promotionId: string;

    beforeEach(async () => {
      await devProdManager.initialize();
      await devProdManager.switchToDev();

      const request = await devProdManager.createPromotionRequest(
        'Test Promotion',
        'Test Description',
        [],
        {
          passed: true,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          duration: 1000,
          failures: [],
        },
        {
          risk: 'low',
          affectedComponents: [],
          estimatedDowntime: 0,
          rollbackComplexity: 'simple',
          benefits: [],
          risks: [],
        },
        {
          steps: [],
          estimatedTime: 0,
          dataBackupRequired: false,
          automatable: true,
        }
      );

      promotionId = request.id;
    });

    it('should approve promotion', async () => {
      await devProdManager.approvePromotion(promotionId, 'user@example.com');

      const request = devProdManager.getPromotionRequest(promotionId);
      expect(request?.status).toBe('approved');
      expect(request?.approvedBy).toBe('user@example.com');
      expect(request?.approvedAt).toBeTruthy();
    });

    it('should reject promotion', async () => {
      await devProdManager.rejectPromotion(
        promotionId,
        'user@example.com',
        'Not ready for production'
      );

      const request = devProdManager.getPromotionRequest(promotionId);
      expect(request?.status).toBe('rejected');
    });

    it('should not approve already approved promotion', async () => {
      await devProdManager.approvePromotion(promotionId, 'user1@example.com');

      await expect(
        devProdManager.approvePromotion(promotionId, 'user2@example.com')
      ).rejects.toThrow('not pending');
    });

    it('should throw error for non-existent promotion', async () => {
      await expect(
        devProdManager.approvePromotion('non-existent', 'user@example.com')
      ).rejects.toThrow('not found');
    });
  });

  describe('Audit Log', () => {
    let promotionId: string;

    beforeEach(async () => {
      await devProdManager.initialize();
      await devProdManager.switchToDev();

      const request = await devProdManager.createPromotionRequest(
        'Test',
        'Test',
        [],
        {
          passed: true,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          duration: 1000,
          failures: [],
        },
        {
          risk: 'low',
          affectedComponents: [],
          estimatedDowntime: 0,
          rollbackComplexity: 'simple',
          benefits: [],
          risks: [],
        },
        {
          steps: [],
          estimatedTime: 0,
          dataBackupRequired: false,
          automatable: true,
        }
      );

      promotionId = request.id;
    });

    it('should log promotion creation', () => {
      const log = devProdManager.getAuditLog(promotionId);

      expect(log.length).toBeGreaterThan(0);
      expect(log[0].action).toBe('created');
      expect(log[0].promotionId).toBe(promotionId);
    });

    it('should log approval', async () => {
      await devProdManager.approvePromotion(promotionId, 'user@example.com');

      const log = devProdManager.getAuditLog(promotionId);
      const approvalEntry = log.find(e => e.action === 'approved');

      expect(approvalEntry).toBeDefined();
      expect(approvalEntry?.user).toBe('user@example.com');
    });

    it('should log rejection', async () => {
      await devProdManager.rejectPromotion(promotionId, 'user@example.com', 'Not ready');

      const log = devProdManager.getAuditLog(promotionId);
      const rejectionEntry = log.find(e => e.action === 'rejected');

      expect(rejectionEntry).toBeDefined();
      expect(rejectionEntry?.reason).toBe('Not ready');
    });

    it('should get all audit entries', () => {
      const allLog = devProdManager.getAuditLog();
      expect(allLog.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await devProdManager.initialize();
      await devProdManager.switchToDev();
    });

    it('should provide statistics', async () => {
      // Create some promotions
      await devProdManager.createPromotionRequest(
        'Test 1',
        'Test',
        [],
        {
          passed: true,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          duration: 1000,
          failures: [],
        },
        {
          risk: 'low',
          affectedComponents: [],
          estimatedDowntime: 0,
          rollbackComplexity: 'simple',
          benefits: [],
          risks: [],
        },
        {
          steps: [],
          estimatedTime: 0,
          dataBackupRequired: false,
          automatable: true,
        }
      );

      const stats = devProdManager.getStatistics();

      expect(stats.total).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(0);
      expect(stats.rejected).toBe(0);
    });

    it('should calculate average approval time', async () => {
      const request = await devProdManager.createPromotionRequest(
        'Test',
        'Test',
        [],
        {
          passed: true,
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          duration: 1000,
          failures: [],
        },
        {
          risk: 'low',
          affectedComponents: [],
          estimatedDowntime: 0,
          rollbackComplexity: 'simple',
          benefits: [],
          risks: [],
        },
        {
          steps: [],
          estimatedTime: 0,
          dataBackupRequired: false,
          automatable: true,
        }
      );

      await devProdManager.approvePromotion(request.id, 'user@example.com');

      const stats = devProdManager.getStatistics();
      expect(stats.averageApprovalTime).toBeGreaterThan(0);
    });
  });
});
