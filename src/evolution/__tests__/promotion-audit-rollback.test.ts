/**
 * Tests for Promotion Audit and Rollback System
 */

import {
  PromotionAuditRollback,
  createPromotionAuditRollback,
  RollbackConfig,
} from '../promotion-audit-rollback';
import { DevProdManager } from '../dev-prod-manager';
import { RepositoryWorkflow } from '../../integrations/repository-workflow';
import { MemoryEngine } from '../../memory/engine';

describe('PromotionAuditRollback', () => {
  let auditRollback: PromotionAuditRollback;
  let devProdManager: DevProdManager;
  let prodWorkflow: RepositoryWorkflow;
  let memoryEngine: MemoryEngine;
  let config: RollbackConfig;

  beforeEach(() => {
    // Create mock dev/prod manager
    devProdManager = {
      getPromotionRequest: jest.fn(),
      getAuditLog: jest.fn().mockReturnValue([]),
      rollbackPromotion: jest.fn(),
    } as any;

    // Create mock prod workflow
    prodWorkflow = {} as any;

    // Create mock memory engine
    memoryEngine = {
      storePattern: jest.fn().mockResolvedValue(undefined),
      searchPatterns: jest.fn().mockResolvedValue([]),
    } as any;

    config = {
      prodRepoPath: '/path/to/prod',
      prodBranch: 'main',
      backupBranch: 'backup',
      testCommand: 'npm test',
      verifyCommand: 'npm run verify',
      autoBackup: true,
      requireApproval: false,
    };

    auditRollback = new PromotionAuditRollback(
      devProdManager,
      prodWorkflow,
      memoryEngine,
      config
    );
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await auditRollback.initialize();

      expect(memoryEngine.searchPatterns).toHaveBeenCalledWith('promotion-audit');
      expect(memoryEngine.searchPatterns).toHaveBeenCalledWith('rollback-request');
    });
  });

  describe('getAuditLog', () => {
    beforeEach(() => {
      const mockAuditLog = [
        {
          promotionId: 'promo-1',
          action: 'created' as const,
          timestamp: 1000,
          user: 'user1',
        },
        {
          promotionId: 'promo-1',
          action: 'approved' as const,
          timestamp: 2000,
          user: 'user2',
        },
        {
          promotionId: 'promo-2',
          action: 'created' as const,
          timestamp: 3000,
          user: 'user1',
        },
      ];

      (devProdManager.getAuditLog as jest.Mock).mockReturnValue(mockAuditLog);
    });

    it('should return all audit entries without filter', async () => {
      const entries = await auditRollback.getAuditLog();

      expect(entries).toHaveLength(3);
    });

    it('should filter by promotion ID', async () => {
      const entries = await auditRollback.getAuditLog({
        promotionId: 'promo-1',
      });

      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.promotionId === 'promo-1')).toBe(true);
    });

    it('should filter by action', async () => {
      const entries = await auditRollback.getAuditLog({
        action: 'created',
      });

      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.action === 'created')).toBe(true);
    });

    it('should filter by user', async () => {
      const entries = await auditRollback.getAuditLog({
        user: 'user1',
      });

      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.user === 'user1')).toBe(true);
    });

    it('should filter by time range', async () => {
      const entries = await auditRollback.getAuditLog({
        startTime: 1500,
        endTime: 2500,
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].timestamp).toBe(2000);
    });

    it('should apply limit', async () => {
      const entries = await auditRollback.getAuditLog({
        limit: 2,
      });

      expect(entries).toHaveLength(2);
    });
  });

  describe('generateAuditReport', () => {
    beforeEach(() => {
      const mockAuditLog = [
        {
          promotionId: 'promo-1',
          action: 'created' as const,
          timestamp: Date.parse('2024-01-01'),
          user: 'user1',
        },
        {
          promotionId: 'promo-1',
          action: 'approved' as const,
          timestamp: Date.parse('2024-01-01'),
          user: 'user2',
        },
        {
          promotionId: 'promo-2',
          action: 'created' as const,
          timestamp: Date.parse('2024-01-02'),
          user: 'user1',
        },
      ];

      (devProdManager.getAuditLog as jest.Mock).mockReturnValue(mockAuditLog);
    });

    it('should generate comprehensive audit report', async () => {
      const report = await auditRollback.generateAuditReport();

      expect(report.totalEntries).toBe(3);
      expect(report.summary.byAction).toEqual({
        created: 2,
        approved: 1,
      });
      expect(report.summary.byUser).toEqual({
        user1: 2,
        user2: 1,
      });
      expect(report.summary.byPromotion).toEqual({
        'promo-1': 2,
        'promo-2': 1,
      });
      expect(report.timeline).toHaveLength(2);
    });
  });

  describe('exportAuditLog', () => {
    beforeEach(() => {
      const mockAuditLog = [
        {
          promotionId: 'promo-1',
          action: 'created' as const,
          timestamp: 1000,
          user: 'user1',
          reason: 'Test',
        },
      ];

      (devProdManager.getAuditLog as jest.Mock).mockReturnValue(mockAuditLog);
    });

    it('should export as JSON', async () => {
      const exported = await auditRollback.exportAuditLog('json');

      expect(exported).toContain('promo-1');
      expect(exported).toContain('created');
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it('should export as CSV', async () => {
      const exported = await auditRollback.exportAuditLog('csv');

      expect(exported).toContain('Timestamp,Promotion ID,Action');
      expect(exported).toContain('promo-1');
      expect(exported).toContain('created');
    });

    it('should export as Markdown', async () => {
      const exported = await auditRollback.exportAuditLog('markdown');

      expect(exported).toContain('# Promotion Audit Log');
      expect(exported).toContain('promo-1');
      expect(exported).toContain('created');
    });

    it('should throw error for unsupported format', async () => {
      await expect(
        auditRollback.exportAuditLog('xml' as any)
      ).rejects.toThrow('Unsupported format');
    });
  });

  describe('createRollbackRequest', () => {
    it('should create rollback request for deployed promotion', async () => {
      const promotion = {
        id: 'promo-1',
        status: 'deployed',
        rollbackPlan: {
          steps: ['Step 1', 'Step 2'],
          estimatedTime: 10,
          dataBackupRequired: false,
          automatable: true,
        },
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      const request = await auditRollback.createRollbackRequest(
        'promo-1',
        'Critical bug found',
        'admin@example.com'
      );

      expect(request.promotionId).toBe('promo-1');
      expect(request.reason).toBe('Critical bug found');
      expect(request.requestedBy).toBe('admin@example.com');
      // When no approval required, it auto-executes and becomes 'completed'
      expect(['approved', 'completed']).toContain(request.status);
      expect(memoryEngine.storePattern).toHaveBeenCalled();
    });

    it('should throw error for non-existent promotion', async () => {
      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(null);

      await expect(
        auditRollback.createRollbackRequest('promo-1', 'Test', 'user')
      ).rejects.toThrow('Promotion not found');
    });

    it('should throw error for non-deployed promotion', async () => {
      const promotion = {
        id: 'promo-1',
        status: 'pending',
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      await expect(
        auditRollback.createRollbackRequest('promo-1', 'Test', 'user')
      ).rejects.toThrow('Can only rollback deployed promotions');
    });

    it('should require approval when configured', async () => {
      auditRollback = new PromotionAuditRollback(
        devProdManager,
        prodWorkflow,
        memoryEngine,
        { ...config, requireApproval: true }
      );

      const promotion = {
        id: 'promo-1',
        status: 'deployed',
        rollbackPlan: {
          steps: [],
          estimatedTime: 0,
          dataBackupRequired: false,
          automatable: true,
        },
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      const request = await auditRollback.createRollbackRequest(
        'promo-1',
        'Test',
        'user'
      );

      expect(request.status).toBe('pending');
    });
  });

  describe('approveRollbackRequest', () => {
    it('should approve pending rollback request', async () => {
      const promotion = {
        id: 'promo-1',
        status: 'deployed',
        rollbackPlan: {
          steps: ['Step 1'],
          estimatedTime: 5,
          dataBackupRequired: false,
          automatable: true,
        },
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      // Create request with approval required
      auditRollback = new PromotionAuditRollback(
        devProdManager,
        prodWorkflow,
        memoryEngine,
        { ...config, requireApproval: true }
      );

      const request = await auditRollback.createRollbackRequest(
        'promo-1',
        'Test',
        'user1'
      );

      // Approve request
      await auditRollback.approveRollbackRequest(request.id, 'admin@example.com');

      const updatedRequest = auditRollback.getRollbackRequest(request.id);
      expect(updatedRequest?.status).toBe('completed');
      expect(updatedRequest?.approvedBy).toBe('admin@example.com');
      expect(devProdManager.rollbackPromotion).toHaveBeenCalled();
    });

    it('should throw error for non-existent request', async () => {
      await expect(
        auditRollback.approveRollbackRequest('invalid-id', 'admin')
      ).rejects.toThrow('Rollback request not found');
    });
  });

  describe('rejectRollbackRequest', () => {
    it('should reject pending rollback request', async () => {
      const promotion = {
        id: 'promo-1',
        status: 'deployed',
        rollbackPlan: {
          steps: [],
          estimatedTime: 0,
          dataBackupRequired: false,
          automatable: true,
        },
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      // Create request with approval required
      auditRollback = new PromotionAuditRollback(
        devProdManager,
        prodWorkflow,
        memoryEngine,
        { ...config, requireApproval: true }
      );

      const request = await auditRollback.createRollbackRequest(
        'promo-1',
        'Test',
        'user1'
      );

      // Reject request
      await auditRollback.rejectRollbackRequest(
        request.id,
        'admin@example.com',
        'Not necessary'
      );

      const updatedRequest = auditRollback.getRollbackRequest(request.id);
      expect(updatedRequest?.status).toBe('rejected');
    });
  });

  describe('getRollbackHistory', () => {
    it('should return rollback history for promotion', async () => {
      const promotion = {
        id: 'promo-1',
        status: 'deployed',
        rollbackPlan: {
          steps: [],
          estimatedTime: 0,
          dataBackupRequired: false,
          automatable: true,
        },
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      // Create multiple rollback requests (with approval required to prevent auto-execution)
      const tempConfig = { ...config, requireApproval: true };
      const tempAuditRollback = new PromotionAuditRollback(
        devProdManager,
        prodWorkflow,
        memoryEngine,
        tempConfig
      );

      await tempAuditRollback.createRollbackRequest('promo-1', 'Reason 1', 'user1');
      await tempAuditRollback.createRollbackRequest('promo-1', 'Reason 2', 'user2');

      const history = tempAuditRollback.getRollbackHistory('promo-1');

      expect(history).toHaveLength(2);
      expect(history.every(r => r.promotionId === 'promo-1')).toBe(true);
    });
  });

  describe('getRollbackStatistics', () => {
    it('should calculate rollback statistics', async () => {
      const promotion = {
        id: 'promo-1',
        status: 'deployed',
        rollbackPlan: {
          steps: [],
          estimatedTime: 0,
          dataBackupRequired: false,
          automatable: true,
        },
      };

      (devProdManager.getPromotionRequest as jest.Mock).mockReturnValue(promotion);

      // Create some rollback requests (with approval required to prevent auto-execution)
      const tempConfig = { ...config, requireApproval: true };
      const tempAuditRollback = new PromotionAuditRollback(
        devProdManager,
        prodWorkflow,
        memoryEngine,
        tempConfig
      );

      await tempAuditRollback.createRollbackRequest('promo-1', 'Test 1', 'user1');
      await tempAuditRollback.createRollbackRequest('promo-1', 'Test 2', 'user2');

      const stats = tempAuditRollback.getRollbackStatistics();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2); // Pending approval
    });
  });

  describe('createPromotionAuditRollback', () => {
    it('should create instance', () => {
      const instance = createPromotionAuditRollback(
        devProdManager,
        prodWorkflow,
        memoryEngine,
        config
      );

      expect(instance).toBeInstanceOf(PromotionAuditRollback);
    });
  });
});
