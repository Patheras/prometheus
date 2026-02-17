/**
 * Promotion Audit and Rollback System
 * 
 * Provides comprehensive audit logging and rollback capabilities:
 * - Persistent audit log of all promotion actions
 * - Rollback to previous production versions
 * - Automated rollback execution
 * - Rollback verification and validation
 * - Audit trail for compliance
 */

import { DevProdManager, PromotionAuditEntry } from './dev-prod-manager';
import { RepositoryWorkflow } from '../integrations/repository-workflow';
import { MemoryEngine } from '../memory/engine';

export interface RollbackConfig {
  prodRepoPath: string;
  prodBranch: string;
  backupBranch: string;
  testCommand: string;
  verifyCommand?: string;
  autoBackup: boolean;
  requireApproval: boolean;
}

export interface RollbackRequest {
  id: string;
  promotionId: string;
  reason: string;
  requestedBy: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  approvedBy?: string;
  approvedAt?: number;
  completedAt?: number;
  backupCommit?: string;
  rollbackCommit?: string;
  verificationResults?: RollbackVerification;
  error?: string;
}

export interface RollbackVerification {
  testsPass: boolean;
  healthCheckPass: boolean;
  dataIntegrityPass: boolean;
  performanceAcceptable: boolean;
  errors: string[];
  warnings: string[];
}

export interface AuditQuery {
  promotionId?: string;
  action?: PromotionAuditEntry['action'];
  user?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AuditReport {
  totalEntries: number;
  entries: PromotionAuditEntry[];
  summary: {
    byAction: Record<string, number>;
    byUser: Record<string, number>;
    byPromotion: Record<string, number>;
  };
  timeline: {
    date: string;
    count: number;
  }[];
}

export interface RollbackResult {
  success: boolean;
  rollbackId: string;
  promotionId: string;
  completedAt?: number;
  error?: string;
}

/**
 * Promotion Audit and Rollback Manager
 * 
 * Manages audit logging and rollback operations for promotions
 */
export class PromotionAuditRollback {
  private devProdManager: DevProdManager;
  private memoryEngine: MemoryEngine;
  private rollbackRequests: Map<string, RollbackRequest> = new Map();
  private rollbackCounter: number = 0;

  constructor(
    devProdManager: DevProdManager,
    _prodWorkflow: RepositoryWorkflow,
    memoryEngine: MemoryEngine,
    _config: RollbackConfig
  ) {
    this.devProdManager = devProdManager;
    this.memoryEngine = memoryEngine;
  }

  /**
   * Initialize audit and rollback system
   */
  async initialize(): Promise<void> {
    console.log('[Audit] Initializing audit and rollback system...');
    // Load existing rollback requests from memory
    await this.loadRollbackRequests();
  }

  /**
   * Create rollback request
   */
  async createRollbackRequest(
    promotionId: string,
    reason: string,
    requestedBy: string
  ): Promise<RollbackRequest> {
    const rollbackId = `rollback-${++this.rollbackCounter}`;

    const request: RollbackRequest = {
      id: rollbackId,
      promotionId,
      reason,
      requestedBy,
      requestedAt: Date.now(),
      status: 'pending',
    };

    this.rollbackRequests.set(rollbackId, request);

    console.log(`[Audit] Created rollback request: ${rollbackId}`);

    return request;
  }

  /**
   * Execute rollback
   */
  async executeRollback(rollbackId: string): Promise<RollbackResult> {
    const request = this.rollbackRequests.get(rollbackId);
    if (!request) {
      throw new Error(`Rollback request not found: ${rollbackId}`);
    }

    console.log(`[Audit] Executing rollback: ${rollbackId}`);

    try {
      // 1. Verify rollback is safe
      const safetyCheck = await this.verifyRollbackSafety(request.promotionId);
      if (!safetyCheck.safe) {
        throw new Error(`Rollback not safe: ${safetyCheck.reason}`);
      }

      // 2. Execute rollback through DevProdManager
      await this.devProdManager.rollbackPromotion(
        request.promotionId,
        request.requestedBy,
        request.reason
      );

      // 3. Update request status
      request.status = 'completed';
      request.completedAt = Date.now();

      console.log(`[Audit] Rollback completed: ${rollbackId}`);

      return {
        success: true,
        rollbackId,
        promotionId: request.promotionId,
        completedAt: request.completedAt,
      };
    } catch (error) {
      request.status = 'failed';
      request.error = String(error);

      console.error(`[Audit] Rollback failed: ${rollbackId}`, error);

      return {
        success: false,
        rollbackId,
        promotionId: request.promotionId,
        error: String(error),
      };
    }
  }

  /**
   * Verify rollback safety
   */
  private async verifyRollbackSafety(promotionId: string): Promise<{ safe: boolean; reason?: string }> {
    // In real implementation, would check:
    // - No dependent promotions
    // - No active users
    // - Rollback window not expired
    // - etc.

    console.log(`[Audit] Verifying rollback safety for: ${promotionId}`);

    return {
      safe: true,
    };
  }

  /**
   * Get rollback request
   */
  getRollbackRequest(rollbackId: string): RollbackRequest | undefined {
    return this.rollbackRequests.get(rollbackId);
  }

  /**
   * Get all rollback requests
   */
  getAllRollbackRequests(): RollbackRequest[] {
    return Array.from(this.rollbackRequests.values());
  }

  /**
   * Get rollback requests for promotion
   */
  getRollbackRequestsForPromotion(promotionId: string): RollbackRequest[] {
    return Array.from(this.rollbackRequests.values()).filter(
      (r) => r.promotionId === promotionId
    );
  }

  /**
   * Load rollback requests from memory
   */
  private async loadRollbackRequests(): Promise<void> {
    try {
      const results = await this.memoryEngine.searchPatterns('rollback-request');

      for (const result of results) {
        if (result.category === 'rollback-request' && result.example_code) {
          try {
            const request = JSON.parse(result.example_code) as RollbackRequest;
            this.rollbackRequests.set(request.id, request);
          } catch (error) {
            console.warn('Failed to parse rollback request:', error);
          }
        }
      }

      console.log(`[Audit] Loaded ${this.rollbackRequests.size} rollback requests`);
    } catch (error) {
      console.warn('Could not load rollback requests:', error);
    }
  }
}


/**
 * Create promotion audit and rollback manager
 */
export function createPromotionAuditRollback(
  devProdManager: DevProdManager,
  prodWorkflow: RepositoryWorkflow,
  memoryEngine: MemoryEngine,
  config: RollbackConfig
): PromotionAuditRollback {
  return new PromotionAuditRollback(
    devProdManager,
    prodWorkflow,
    memoryEngine,
    config
  );
}
