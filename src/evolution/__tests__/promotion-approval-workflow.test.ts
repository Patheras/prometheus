/**
 * Tests for Promotion Approval Workflow
 */

import { PromotionApprovalWorkflow, createPromotionApprovalWorkflow } from '../promotion-approval-workflow';
import { DevProdManager } from '../dev-prod-manager';
import { RepositoryWorkflow } from '../../integrations/repository-workflow';
import { MemoryEngine } from '../../memory/engine';

describe('PromotionApprovalWorkflow', () => {
  let workflow: PromotionApprovalWorkflow;
  let devProdManager: DevProdManager;
  let prodWorkflow: RepositoryWorkflow;
  let memoryEngine: MemoryEngine;

  beforeEach(() => {
    // Create mock dev/prod manager
    devProdManager = {
      getPromotionRequest: jest.fn(),
      approvePromotion: jest.fn(),
      rejectPromotion: jest.fn(),
      deployPromotion: jest.fn(),
      preventDirectProdModification: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({
        approved: 5,
        rejected: 2,
        deployed: 4,
        averageApprovalTime: 3600000,
        averageDeploymentTime: 1800000,
      }),
    } as any;

    // Create mock prod workflow
    prodWorkflow = {
      createPullRequest: jest.fn().mockResolvedValue({
        url: 'https://github.com/org/repo/pull/123',
        number: 123,
      }),
    } as any;

    // Create mock memory engine
    memoryEngine = {
      storePattern: jest.fn().mockResolvedValue(undefined),
      searchPatterns: jest.fn().mockResolvedValue([]),
    } as any;

    workflow = new PromotionApprovalWorkflow(
      devProdManager,
      prodWorkflow,
      memoryEngine,
      {
        prodRepoPath: '/path/to/prod',
        prodBranch: 'main',
        deploymentUrl: 'https://admin.anots.com',
        testCommand: 'npm test',
        deployCommand: 'npm run deploy',
        requireManualApproval: true,
        autoDeployOnTestPass: false,
      }
    );

    // Mock the private executeCommand method to return success
    (workflow as any).executeCommand = jest.fn().mockResolvedValue('All tests passed');
  });

  describe('requestApproval', () => {
    it('should request approval for pending promotion', async () => {
      const promotion = {
        id: 'promo-1',
        title: 'Test Promotion',
        status: 'pending',
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      await workflow.requestApproval('promo-1');

      expect(workflow.isPendingApproval('promo-1')).toBe(true);
    });

    it('should throw error for non-existent promotion', async () => {
      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(null);

      await expect(workflow.requestApproval('promo-1')).rejects.toThrow('Promotion not found');
    });

    it('should throw error for non-pending promotion', async () => {
      const promotion = {
        id: 'promo-1',
        title: 'Test Promotion',
        status: 'approved',
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      await expect(workflow.requestApproval('promo-1')).rejects.toThrow('Promotion is not pending');
    });
  });

  describe('approve', () => {
    it('should approve promotion and remove from pending', async () => {
      const promotion = {
        id: 'promo-1',
        title: 'Test Promotion',
        status: 'pending',
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      // Add to pending first
      await workflow.requestApproval('promo-1');

      // Approve
      const result = await workflow.approve('promo-1', 'admin@example.com');

      expect(devProdManager.approvePromotion).toHaveBeenCalledWith('promo-1', 'admin@example.com');
      expect(workflow.isPendingApproval('promo-1')).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should auto-deploy when enabled', async () => {
      workflow = new PromotionApprovalWorkflow(
        devProdManager,
        prodWorkflow,
        memoryEngine,
        {
          prodRepoPath: '/path/to/prod',
          prodBranch: 'main',
          deploymentUrl: 'https://admin.anots.com',
          testCommand: 'npm test',
          requireManualApproval: true,
          autoDeployOnTestPass: true,
        }
      );

      // Mock the private executeCommand method
      (workflow as any).executeCommand = jest.fn().mockResolvedValue('All tests passed');

      const promotion = {
        id: 'promo-1',
        title: 'Test Promotion',
        description: 'Test description',
        status: 'approved',
        createdAt: Date.now(),
        changes: [],
        testResults: { totalTests: 10, passedTests: 10, failedTests: 0 },
        impactAssessment: { risk: 'low', affectedComponents: [], estimatedDowntime: 0 },
        rollbackPlan: { estimatedTime: 5, automatable: true, steps: [] },
        approvedBy: 'admin@example.com',
        approvedAt: Date.now(),
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      const result = await workflow.approve('promo-1', 'admin@example.com');

      expect(result.prUrl).toBeDefined();
      expect(prodWorkflow.createPullRequest).toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('should reject promotion and remove from pending', async () => {
      const promotion = {
        id: 'promo-1',
        title: 'Test Promotion',
        status: 'pending',
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      // Add to pending first
      await workflow.requestApproval('promo-1');

      // Reject
      await workflow.reject('promo-1', 'admin@example.com', 'Not ready');

      expect(devProdManager.rejectPromotion).toHaveBeenCalledWith('promo-1', 'admin@example.com', 'Not ready');
      expect(workflow.isPendingApproval('promo-1')).toBe(false);
    });
  });

  describe('deploy', () => {
    it('should deploy approved promotion successfully', async () => {
      const promotion = {
        id: 'promo-1',
        title: 'Test Promotion',
        description: 'Test description',
        status: 'approved',
        createdAt: Date.now(),
        changes: [
          {
            file: 'src/test.ts',
            type: 'modified',
            summary: 'Updated test',
            linesAdded: 10,
            linesRemoved: 5,
          },
        ],
        testResults: {
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
        },
        impactAssessment: {
          risk: 'low',
          affectedComponents: ['test-component'],
          estimatedDowntime: 0,
        },
        rollbackPlan: {
          estimatedTime: 5,
          automatable: true,
          steps: ['Revert commit'],
        },
        approvedBy: 'admin@example.com',
        approvedAt: Date.now(),
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      const result = await workflow.deploy('promo-1');

      expect(result.success).toBe(true);
      expect(result.prUrl).toBe('https://github.com/org/repo/pull/123');
      expect(result.prNumber).toBe(123);
      expect(result.testsPassed).toBe(true);
      expect(result.deploymentUrl).toBe('https://admin.anots.com');
      expect(devProdManager.preventDirectProdModification).toHaveBeenCalled();
      expect(prodWorkflow.createPullRequest).toHaveBeenCalled();
      expect(devProdManager.deployPromotion).toHaveBeenCalledWith('promo-1');
    });

    it('should throw error for non-existent promotion', async () => {
      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(null);

      await expect(workflow.deploy('promo-1')).rejects.toThrow('Promotion not found');
    });

    it('should throw error for non-approved promotion', async () => {
      const promotion = {
        id: 'promo-1',
        title: 'Test Promotion',
        status: 'pending',
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      await expect(workflow.deploy('promo-1')).rejects.toThrow('Promotion must be approved');
    });

    it('should handle deployment failure gracefully', async () => {
      const promotion = {
        id: 'promo-1',
        title: 'Test Promotion',
        status: 'approved',
        changes: [],
        testResults: { totalTests: 10, passedTests: 10, failedTests: 0 },
        impactAssessment: { risk: 'low', affectedComponents: [], estimatedDowntime: 0 },
        rollbackPlan: { estimatedTime: 5, automatable: true, steps: [] },
        approvedBy: 'admin@example.com',
        approvedAt: Date.now(),
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);
      (devProdManager.preventDirectProdModification as jest.Mock).mockImplementation(() => {
        throw new Error('Production modification blocked');
      });

      const result = await workflow.deploy('promo-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Production modification blocked');
    });
  });

  describe('getPendingApprovals', () => {
    it('should return all pending approvals', async () => {
      const promotion1 = { id: 'promo-1', title: 'Test 1', status: 'pending' };
      const promotion2 = { id: 'promo-2', title: 'Test 2', status: 'pending' };

      (devProdManager.getPromotionRequest as jest.Mock)
        .mockReturnValueOnce(promotion1)
        .mockReturnValueOnce(promotion2);

      await workflow.requestApproval('promo-1');
      await workflow.requestApproval('promo-2');

      const pending = workflow.getPendingApprovals();

      expect(pending).toHaveLength(2);
      expect(pending[0].id).toBe('promo-1');
      expect(pending[1].id).toBe('promo-2');
    });
  });

  describe('getStatistics', () => {
    it('should return approval statistics', () => {
      const stats = workflow.getStatistics();

      expect(stats.pending).toBe(0);
      expect(stats.approved).toBe(5);
      expect(stats.rejected).toBe(2);
      expect(stats.deployed).toBe(4);
      expect(stats.averageApprovalTime).toBe(3600000);
      expect(stats.averageDeploymentTime).toBe(1800000);
    });
  });

  describe('getNotificationHistory', () => {
    it('should return notification history', async () => {
      const notifications = [
        {
          category: 'promotion-notification',
          metadata: {
            notificationData: {
              type: 'approval_requested',
              promotionId: 'promo-1',
              title: 'Test Promotion',
              status: 'pending',
              timestamp: Date.now(),
            },
          },
        },
      ];

      (memoryEngine.searchPatterns as jest.Mock).mockResolvedValue(notifications);

      const history = await workflow.getNotificationHistory();

      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('approval_requested');
      expect(history[0].promotionId).toBe('promo-1');
    });

    it('should filter by promotion ID', async () => {
      const notifications = [
        {
          category: 'promotion-notification',
          metadata: {
            notificationData: {
              type: 'approval_requested',
              promotionId: 'promo-1',
              title: 'Test 1',
              status: 'pending',
              timestamp: Date.now(),
            },
          },
        },
        {
          category: 'promotion-notification',
          metadata: {
            notificationData: {
              type: 'approved',
              promotionId: 'promo-2',
              title: 'Test 2',
              status: 'approved',
              timestamp: Date.now(),
            },
          },
        },
      ];

      (memoryEngine.searchPatterns as jest.Mock).mockResolvedValue(notifications);

      const history = await workflow.getNotificationHistory('promo-1');

      expect(history).toHaveLength(1);
      expect(history[0].promotionId).toBe('promo-1');
    });
  });

  describe('createPromotionApprovalWorkflow', () => {
    it('should create workflow instance', () => {
      const instance = createPromotionApprovalWorkflow(
        devProdManager,
        prodWorkflow,
        memoryEngine,
        {
          prodRepoPath: '/path/to/prod',
          prodBranch: 'main',
          deploymentUrl: 'https://admin.anots.com',
          testCommand: 'npm test',
          requireManualApproval: true,
          autoDeployOnTestPass: false,
        }
      );

      expect(instance).toBeInstanceOf(PromotionApprovalWorkflow);
    });
  });
});
