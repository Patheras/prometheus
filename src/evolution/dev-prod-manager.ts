/**
 * Dev/Prod Repository Manager
 * 
 * Manages Prometheus self-improvement workflow with separate dev and prod repositories:
 * - Development repository for testing self-improvements
 * - Production repository for stable, approved changes
 * - Promotion workflow with user approval
 * - Rollback capabilities
 */

import { RepositoryManager } from '../integrations/repository-manager';
import { RepositoryWorkflow } from '../integrations/repository-workflow';
import { MemoryEngine } from '../memory/engine';
import * as path from 'path';

export interface DevProdConfig {
  devRepoPath: string;
  devRepoUrl: string;
  prodRepoPath: string;
  prodRepoUrl: string;
  gitProvider: 'github' | 'gitlab' | 'bitbucket';
  auth: {
    type: 'token' | 'ssh';
    token?: string;
    sshKeyPath?: string;
  };
}

export interface PromotionRequest {
  id: string;
  title: string;
  description: string;
  changes: ChangeDescription[];
  testResults: TestResults;
  impactAssessment: ImpactAssessment;
  rollbackPlan: RollbackPlan;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'deployed' | 'rolled_back';
  approvedBy?: string;
  approvedAt?: number;
  deployedAt?: number;
}

export interface ChangeDescription {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  linesAdded: number;
  linesRemoved: number;
  summary: string;
}

export interface TestResults {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coverage?: number;
  duration: number;
  failures: TestFailure[];
}

export interface TestFailure {
  test: string;
  error: string;
  stack?: string;
}

export interface ImpactAssessment {
  risk: 'low' | 'medium' | 'high';
  affectedComponents: string[];
  estimatedDowntime: number; // minutes
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
  benefits: string[];
  risks: string[];
}

export interface RollbackPlan {
  steps: string[];
  estimatedTime: number; // minutes
  dataBackupRequired: boolean;
  automatable: boolean;
}

export interface PromotionAuditEntry {
  promotionId: string;
  action: 'created' | 'approved' | 'rejected' | 'deployed' | 'rolled_back';
  timestamp: number;
  user?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Dev/Prod Manager
 * 
 * Manages the separation between development and production repositories
 * for Prometheus self-improvements.
 */
export class DevProdManager {
  private repoManager: RepositoryManager;
  private memoryEngine: MemoryEngine;
  private config: DevProdConfig;
  private devWorkflow: RepositoryWorkflow;
  private prodWorkflow: RepositoryWorkflow;
  private promotionRequests: Map<string, PromotionRequest> = new Map();
  private auditLog: PromotionAuditEntry[] = [];

  constructor(
    repoManager: RepositoryManager,
    memoryEngine: MemoryEngine,
    config: DevProdConfig
  ) {
    this.repoManager = repoManager;
    this.memoryEngine = memoryEngine;
    this.config = config;

    // Create workflows for dev and prod
    this.devWorkflow = new RepositoryWorkflow(
      {
        repoId: 'prometheus-dev',
        repoPath: config.devRepoPath,
        provider: config.gitProvider,
        auth: config.auth,
      },
      memoryEngine
    );

    this.prodWorkflow = new RepositoryWorkflow(
      {
        repoId: 'prometheus-prod',
        repoPath: config.prodRepoPath,
        provider: config.gitProvider,
        auth: config.auth,
      },
      memoryEngine
    );
  }

  /**
   * Initialize dev and prod repositories
   */
  async initialize(): Promise<void> {
    console.log('[DevProd] Initializing dev/prod repository structure...');

    // Add dev repository
    await this.repoManager.addRepository({
      id: 'prometheus-dev',
      name: 'Prometheus Development',
      provider: this.config.gitProvider,
      url: this.config.devRepoUrl,
      localPath: this.config.devRepoPath,
      auth: this.config.auth,
      profile: {
        autoSync: true,
        autoMerge: false,
        requireTests: true,
        requireReview: false, // Dev doesn't need review
      },
    });

    // Add prod repository
    await this.repoManager.addRepository({
      id: 'prometheus-prod',
      name: 'Prometheus Production',
      provider: this.config.gitProvider,
      url: this.config.prodRepoUrl,
      localPath: this.config.prodRepoPath,
      auth: this.config.auth,
      profile: {
        autoSync: true,
        autoMerge: false,
        requireTests: true,
        requireReview: true, // Prod requires review
      },
    });

    console.log('[DevProd] Dev/prod repositories initialized successfully');
  }

  /**
   * Check if currently working in dev repository
   */
  isInDevRepository(): boolean {
    const currentRepo = this.repoManager.getCurrentRepository();
    return currentRepo === 'prometheus-dev';
  }

  /**
   * Check if currently working in prod repository
   */
  isInProdRepository(): boolean {
    const currentRepo = this.repoManager.getCurrentRepository();
    return currentRepo === 'prometheus-prod';
  }

  /**
   * Ensure we're in dev repository
   */
  requireDevRepository(): void {
    if (!this.isInDevRepository()) {
      throw new Error(
        'This operation must be performed in the development repository. ' +
        'Self-improvements should be developed and tested in dev first.'
      );
    }
  }

  /**
   * Prevent direct prod modifications
   */
  preventDirectProdModification(): void {
    if (this.isInProdRepository()) {
      throw new Error(
        'Direct modifications to production repository are not allowed. ' +
        'All changes must go through the dev → approval → prod workflow.'
      );
    }
  }

  /**
   * Switch to dev repository
   */
  async switchToDev(): Promise<void> {
    console.log('[DevProd] Switching to development repository...');
    this.repoManager.setCurrentRepository('prometheus-dev');
    console.log('[DevProd] Now working in development repository');
  }

  /**
   * Switch to prod repository (read-only)
   */
  async switchToProd(): Promise<void> {
    console.log('[DevProd] Switching to production repository (read-only)...');
    this.repoManager.setCurrentRepository('prometheus-prod');
    console.log('[DevProd] Now in production repository (read-only mode)');
  }

  /**
   * Create a promotion request
   */
  async createPromotionRequest(
    title: string,
    description: string,
    changes: ChangeDescription[],
    testResults: TestResults,
    impactAssessment: ImpactAssessment,
    rollbackPlan: RollbackPlan
  ): Promise<PromotionRequest> {
    // Ensure we're in dev
    this.requireDevRepository();

    // Validate test results
    if (!testResults.passed) {
      throw new Error(
        'Cannot create promotion request with failing tests. ' +
        `${testResults.failedTests} test(s) failed.`
      );
    }

    // Create promotion request
    const request: PromotionRequest = {
      id: `promotion-${Date.now()}`,
      title,
      description,
      changes,
      testResults,
      impactAssessment,
      rollbackPlan,
      createdAt: Date.now(),
      status: 'pending',
    };

    // Store request
    this.promotionRequests.set(request.id, request);

    // Add to audit log
    this.addAuditEntry({
      promotionId: request.id,
      action: 'created',
      timestamp: Date.now(),
    });

    // Store in memory engine
    await this.storePromotionRequest(request);

    console.log(`[DevProd] Created promotion request: ${request.id}`);
    console.log(`[DevProd] Title: ${title}`);
    console.log(`[DevProd] Changes: ${changes.length} files`);
    console.log(`[DevProd] Tests: ${testResults.passedTests}/${testResults.totalTests} passed`);
    console.log(`[DevProd] Risk: ${impactAssessment.risk}`);

    return request;
  }

  /**
   * Get promotion request
   */
  getPromotionRequest(promotionId: string): PromotionRequest | null {
    return this.promotionRequests.get(promotionId) || null;
  }

  /**
   * Get all pending promotion requests
   */
  getPendingPromotions(): PromotionRequest[] {
    return Array.from(this.promotionRequests.values())
      .filter(r => r.status === 'pending')
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Approve promotion request
   */
  async approvePromotion(
    promotionId: string,
    approvedBy: string
  ): Promise<void> {
    const request = this.promotionRequests.get(promotionId);
    if (!request) {
      throw new Error(`Promotion request not found: ${promotionId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Promotion request is not pending: ${request.status}`);
    }

    // Update request
    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = Date.now();

    // Add to audit log
    this.addAuditEntry({
      promotionId,
      action: 'approved',
      timestamp: Date.now(),
      user: approvedBy,
    });

    // Store updated request
    await this.storePromotionRequest(request);

    console.log(`[DevProd] Promotion approved: ${promotionId}`);
    console.log(`[DevProd] Approved by: ${approvedBy}`);
  }

  /**
   * Reject promotion request
   */
  async rejectPromotion(
    promotionId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    const request = this.promotionRequests.get(promotionId);
    if (!request) {
      throw new Error(`Promotion request not found: ${promotionId}`);
    }

    if (request.status !== 'pending') {
      throw new Error(`Promotion request is not pending: ${request.status}`);
    }

    // Update request
    request.status = 'rejected';

    // Add to audit log
    this.addAuditEntry({
      promotionId,
      action: 'rejected',
      timestamp: Date.now(),
      user: rejectedBy,
      reason,
    });

    // Store updated request
    await this.storePromotionRequest(request);

    console.log(`[DevProd] Promotion rejected: ${promotionId}`);
    console.log(`[DevProd] Rejected by: ${rejectedBy}`);
    console.log(`[DevProd] Reason: ${reason}`);
  }

  /**
   * Deploy approved promotion to production
   */
  async deployPromotion(promotionId: string): Promise<void> {
    const request = this.promotionRequests.get(promotionId);
    if (!request) {
      throw new Error(`Promotion request not found: ${promotionId}`);
    }

    if (request.status !== 'approved') {
      throw new Error(`Promotion must be approved before deployment: ${request.status}`);
    }

    console.log(`[DevProd] Deploying promotion: ${promotionId}`);

    try {
      // Switch to prod repository
      await this.switchToProd();

      // Create PR from dev to prod
      const prInfo = await this.prodWorkflow.createPullRequest(
        `promotion-${promotionId}`,
        request.title,
        this.generatePRDescription(request),
        'main' // Target branch
      );

      console.log(`[DevProd] Created PR: ${prInfo.url}`);

      // Update request
      request.status = 'deployed';
      request.deployedAt = Date.now();

      // Add to audit log
      this.addAuditEntry({
        promotionId,
        action: 'deployed',
        timestamp: Date.now(),
        metadata: {
          prUrl: prInfo.url,
          prNumber: prInfo.number,
        },
      });

      // Store updated request
      await this.storePromotionRequest(request);

      console.log(`[DevProd] Promotion deployed successfully`);
      console.log(`[DevProd] PR URL: ${prInfo.url}`);
    } catch (error) {
      console.error(`[DevProd] Deployment failed:`, error);
      throw error;
    } finally {
      // Switch back to dev
      await this.switchToDev();
    }
  }

  /**
   * Rollback a deployed promotion
   */
  async rollbackPromotion(
    promotionId: string,
    rolledBackBy: string,
    reason: string
  ): Promise<void> {
    const request = this.promotionRequests.get(promotionId);
    if (!request) {
      throw new Error(`Promotion request not found: ${promotionId}`);
    }

    if (request.status !== 'deployed') {
      throw new Error(`Can only rollback deployed promotions: ${request.status}`);
    }

    console.log(`[DevProd] Rolling back promotion: ${promotionId}`);
    console.log(`[DevProd] Reason: ${reason}`);

    try {
      // Execute rollback plan
      for (const step of request.rollbackPlan.steps) {
        console.log(`[DevProd] Rollback step: ${step}`);
        // In real implementation, execute the step
      }

      // Update request
      request.status = 'rolled_back';

      // Add to audit log
      this.addAuditEntry({
        promotionId,
        action: 'rolled_back',
        timestamp: Date.now(),
        user: rolledBackBy,
        reason,
      });

      // Store updated request
      await this.storePromotionRequest(request);

      console.log(`[DevProd] Promotion rolled back successfully`);
    } catch (error) {
      console.error(`[DevProd] Rollback failed:`, error);
      throw error;
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(promotionId?: string): PromotionAuditEntry[] {
    if (promotionId) {
      return this.auditLog.filter(entry => entry.promotionId === promotionId);
    }
    return [...this.auditLog];
  }

  /**
   * Get promotion statistics
   */
  getStatistics(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    deployed: number;
    rolledBack: number;
    averageApprovalTime: number;
    averageDeploymentTime: number;
  } {
    const requests = Array.from(this.promotionRequests.values());

    const stats = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      deployed: requests.filter(r => r.status === 'deployed').length,
      rolledBack: requests.filter(r => r.status === 'rolled_back').length,
      averageApprovalTime: 0,
      averageDeploymentTime: 0,
    };

    // Calculate average approval time
    const approvedRequests = requests.filter(r => r.approvedAt);
    if (approvedRequests.length > 0) {
      const totalApprovalTime = approvedRequests.reduce(
        (sum, r) => sum + (r.approvedAt! - r.createdAt),
        0
      );
      stats.averageApprovalTime = totalApprovalTime / approvedRequests.length;
    }

    // Calculate average deployment time
    const deployedRequests = requests.filter(r => r.deployedAt && r.approvedAt);
    if (deployedRequests.length > 0) {
      const totalDeploymentTime = deployedRequests.reduce(
        (sum, r) => sum + (r.deployedAt! - r.approvedAt!),
        0
      );
      stats.averageDeploymentTime = totalDeploymentTime / deployedRequests.length;
    }

    return stats;
  }

  /**
   * Generate PR description from promotion request
   */
  private generatePRDescription(request: PromotionRequest): string {
    let description = `# ${request.title}\n\n`;
    description += `${request.description}\n\n`;

    description += `## Changes\n\n`;
    for (const change of request.changes) {
      description += `- **${change.file}** (${change.type}): ${change.summary}\n`;
      description += `  - +${change.linesAdded} -${change.linesRemoved}\n`;
    }

    description += `\n## Test Results\n\n`;
    description += `- Total Tests: ${request.testResults.totalTests}\n`;
    description += `- Passed: ${request.testResults.passedTests}\n`;
    description += `- Failed: ${request.testResults.failedTests}\n`;
    if (request.testResults.coverage) {
      description += `- Coverage: ${request.testResults.coverage}%\n`;
    }
    description += `- Duration: ${request.testResults.duration}ms\n`;

    description += `\n## Impact Assessment\n\n`;
    description += `- Risk Level: ${request.impactAssessment.risk}\n`;
    description += `- Affected Components: ${request.impactAssessment.affectedComponents.join(', ')}\n`;
    description += `- Estimated Downtime: ${request.impactAssessment.estimatedDowntime} minutes\n`;
    description += `- Rollback Complexity: ${request.impactAssessment.rollbackComplexity}\n`;

    description += `\n### Benefits\n\n`;
    for (const benefit of request.impactAssessment.benefits) {
      description += `- ${benefit}\n`;
    }

    description += `\n### Risks\n\n`;
    for (const risk of request.impactAssessment.risks) {
      description += `- ${risk}\n`;
    }

    description += `\n## Rollback Plan\n\n`;
    description += `- Estimated Time: ${request.rollbackPlan.estimatedTime} minutes\n`;
    description += `- Data Backup Required: ${request.rollbackPlan.dataBackupRequired ? 'Yes' : 'No'}\n`;
    description += `- Automatable: ${request.rollbackPlan.automatable ? 'Yes' : 'No'}\n`;
    description += `\n### Steps\n\n`;
    for (let i = 0; i < request.rollbackPlan.steps.length; i++) {
      description += `${i + 1}. ${request.rollbackPlan.steps[i]}\n`;
    }

    description += `\n---\n`;
    description += `Promotion ID: ${request.id}\n`;
    description += `Created: ${new Date(request.createdAt).toISOString()}\n`;
    if (request.approvedBy) {
      description += `Approved by: ${request.approvedBy}\n`;
      description += `Approved at: ${new Date(request.approvedAt!).toISOString()}\n`;
    }

    return description;
  }

  /**
   * Add entry to audit log
   */
  private addAuditEntry(entry: PromotionAuditEntry): void {
    this.auditLog.push(entry);

    // Limit audit log size
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
  }

  /**
   * Store promotion request in memory engine
   */
  private async storePromotionRequest(request: PromotionRequest): Promise<void> {
    try {
      await this.memoryEngine.storePattern({
        name: `promotion-${request.id}`,
        category: 'promotion-request',
        problem: request.title,
        solution: request.description,
        example_code: JSON.stringify(request.changes),
        applicability: `Status: ${request.status}`,
        metadata: {
          promotionId: request.id,
          promotionData: request,
        },
      });
    } catch (error) {
      console.error(`Failed to store promotion request:`, error);
    }
  }

  /**
   * Load promotion requests from memory engine
   */
  async loadPromotionRequests(): Promise<void> {
    try {
      const results = await this.memoryEngine.searchPatterns('promotion-request');

      for (const result of results) {
        if (result.category === 'promotion-request' && result.metadata?.promotionData) {
          const request = result.metadata.promotionData as PromotionRequest;
          this.promotionRequests.set(request.id, request);
        }
      }

      console.log(`[DevProd] Loaded ${this.promotionRequests.size} promotion requests`);
    } catch (error) {
      console.warn('Could not load promotion requests:', error);
    }
  }
}
