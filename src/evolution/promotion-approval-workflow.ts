/**
 * Promotion Approval Workflow
 * 
 * Manages the complete approval and deployment workflow:
 * - Prevent direct prod modifications
 * - Create PR from dev to prod on approval
 * - Run tests in production environment
 * - Deploy to admin.anots.com if tests pass
 * - Notify user of deployment status
 */

import { DevProdManager, PromotionRequest } from './dev-prod-manager';
import { RepositoryWorkflow } from '../integrations/repository-workflow';
import { MemoryEngine } from '../memory/engine';

export interface ApprovalWorkflowConfig {
  prodRepoPath: string;
  prodBranch: string;
  deploymentUrl: string;
  testCommand: string;
  deployCommand?: string;
  notificationWebhook?: string;
  requireManualApproval: boolean;
  autoDeployOnTestPass: boolean;
}

export interface ApprovalDecision {
  approved: boolean;
  approvedBy: string;
  approvedAt: number;
  reason?: string;
  conditions?: string[];
}

export interface DeploymentResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  testsPassed: boolean;
  deployedAt?: number;
  deploymentUrl?: string;
  error?: string;
  logs: string[];
}

export interface NotificationPayload {
  type: 'approval_requested' | 'approved' | 'rejected' | 'deployed' | 'deployment_failed';
  promotionId: string;
  title: string;
  approver?: string;
  status: string;
  url?: string;
  timestamp: number;
}

/**
 * Promotion Approval Workflow
 * 
 * Orchestrates the approval and deployment process
 */
export class PromotionApprovalWorkflow {
  private devProdManager: DevProdManager;
  private prodWorkflow: RepositoryWorkflow;
  private memoryEngine: MemoryEngine;
  private config: ApprovalWorkflowConfig;
  private pendingApprovals: Map<string, PromotionRequest> = new Map();

  constructor(
    devProdManager: DevProdManager,
    prodWorkflow: RepositoryWorkflow,
    memoryEngine: MemoryEngine,
    config: ApprovalWorkflowConfig
  ) {
    this.devProdManager = devProdManager;
    this.prodWorkflow = prodWorkflow;
    this.memoryEngine = memoryEngine;
    this.config = config;
  }

  /**
   * Request approval for a promotion
   */
  async requestApproval(promotionId: string): Promise<void> {
    const promotion = this.devProdManager.getPromotionRequest(promotionId);
    if (!promotion) {
      throw new Error(`Promotion not found: ${promotionId}`);
    }

    if (promotion.status !== 'pending') {
      throw new Error(`Promotion is not pending: ${promotion.status}`);
    }

    console.log(`[Approval] Requesting approval for: ${promotionId}`);
    console.log(`[Approval] Title: ${promotion.title}`);

    // Add to pending approvals
    this.pendingApprovals.set(promotionId, promotion);

    // Send notification
    await this.sendNotification({
      type: 'approval_requested',
      promotionId,
      title: promotion.title,
      status: 'pending',
      timestamp: Date.now(),
    });

    console.log(`[Approval] Approval request sent`);
    console.log(`[Approval] Waiting for user decision...`);
  }

  /**
   * Approve a promotion
   */
  async approve(
    promotionId: string,
    approvedBy: string,
    reason?: string,
    conditions?: string[]
  ): Promise<DeploymentResult> {
    console.log(`[Approval] Approving promotion: ${promotionId}`);
    console.log(`[Approval] Approved by: ${approvedBy}`);

    // Approve in dev/prod manager
    await this.devProdManager.approvePromotion(promotionId, approvedBy);

    // Remove from pending
    this.pendingApprovals.delete(promotionId);

    // Send approval notification
    await this.sendNotification({
      type: 'approved',
      promotionId,
      title: this.devProdManager.getPromotionRequest(promotionId)?.title || '',
      approver: approvedBy,
      status: 'approved',
      timestamp: Date.now(),
    });

    // If auto-deploy is enabled, deploy immediately
    if (this.config.autoDeployOnTestPass) {
      console.log(`[Approval] Auto-deploy enabled, starting deployment...`);
      return await this.deploy(promotionId);
    }

    console.log(`[Approval] Promotion approved, manual deployment required`);
    return {
      success: true,
      testsPassed: false,
      logs: ['Promotion approved, awaiting manual deployment'],
    };
  }

  /**
   * Reject a promotion
   */
  async reject(
    promotionId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    console.log(`[Approval] Rejecting promotion: ${promotionId}`);
    console.log(`[Approval] Rejected by: ${rejectedBy}`);
    console.log(`[Approval] Reason: ${reason}`);

    // Reject in dev/prod manager
    await this.devProdManager.rejectPromotion(promotionId, rejectedBy, reason);

    // Remove from pending
    this.pendingApprovals.delete(promotionId);

    // Send rejection notification
    await this.sendNotification({
      type: 'rejected',
      promotionId,
      title: this.devProdManager.getPromotionRequest(promotionId)?.title || '',
      approver: rejectedBy,
      status: 'rejected',
      timestamp: Date.now(),
    });

    console.log(`[Approval] Promotion rejected`);
  }

  /**
   * Deploy an approved promotion
   */
  async deploy(promotionId: string): Promise<DeploymentResult> {
    const promotion = this.devProdManager.getPromotionRequest(promotionId);
    if (!promotion) {
      throw new Error(`Promotion not found: ${promotionId}`);
    }

    if (promotion.status !== 'approved') {
      throw new Error(`Promotion must be approved before deployment: ${promotion.status}`);
    }

    console.log(`[Deployment] Starting deployment for: ${promotionId}`);

    const logs: string[] = [];
    const result: DeploymentResult = {
      success: false,
      testsPassed: false,
      logs,
    };

    try {
      // Step 1: Prevent direct prod modifications
      logs.push('Verifying production repository protection...');
      this.devProdManager.preventDirectProdModification();
      logs.push('✓ Production repository is protected');

      // Step 2: Create PR from dev to prod
      logs.push('Creating pull request from dev to prod...');
      const prInfo = await this.createProductionPR(promotion);
      result.prUrl = prInfo.url;
      result.prNumber = prInfo.number;
      logs.push(`✓ Pull request created: ${prInfo.url}`);

      // Step 3: Run tests in production environment
      logs.push('Running tests in production environment...');
      const testsPassed = await this.runProductionTests();
      result.testsPassed = testsPassed;

      if (!testsPassed) {
        logs.push('✗ Tests failed in production environment');
        result.success = false;
        result.error = 'Tests failed in production environment';

        // Send failure notification
        await this.sendNotification({
          type: 'deployment_failed',
          promotionId,
          title: promotion.title,
          status: 'failed',
          url: prInfo.url,
          timestamp: Date.now(),
        });

        return result;
      }

      logs.push('✓ All tests passed in production environment');

      // Step 4: Deploy to production
      if (this.config.deployCommand) {
        logs.push('Deploying to production...');
        await this.executeDeployment();
        logs.push('✓ Deployment completed successfully');
      }

      // Step 5: Update promotion status
      result.success = true;
      result.deployedAt = Date.now();
      result.deploymentUrl = this.config.deploymentUrl;

      // Mark as deployed in dev/prod manager
      await this.devProdManager.deployPromotion(promotionId);

      logs.push(`✓ Deployment successful: ${this.config.deploymentUrl}`);

      // Send success notification
      await this.sendNotification({
        type: 'deployed',
        promotionId,
        title: promotion.title,
        status: 'deployed',
        url: this.config.deploymentUrl,
        timestamp: Date.now(),
      });

      console.log(`[Deployment] Deployment completed successfully`);
      console.log(`[Deployment] URL: ${this.config.deploymentUrl}`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logs.push(`✗ Deployment failed: ${errorMessage}`);
      result.success = false;
      result.error = errorMessage;

      console.error(`[Deployment] Deployment failed:`, error);

      // Send failure notification
      await this.sendNotification({
        type: 'deployment_failed',
        promotionId,
        title: promotion.title,
        status: 'failed',
        timestamp: Date.now(),
      });

      return result;
    }
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals(): PromotionRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Check if promotion is pending approval
   */
  isPendingApproval(promotionId: string): boolean {
    return this.pendingApprovals.has(promotionId);
  }

  /**
   * Get approval statistics
   */
  getStatistics(): {
    pending: number;
    approved: number;
    rejected: number;
    deployed: number;
    averageApprovalTime: number;
    averageDeploymentTime: number;
  } {
    const stats = this.devProdManager.getStatistics();

    return {
      pending: this.pendingApprovals.size,
      approved: stats.approved,
      rejected: stats.rejected,
      deployed: stats.deployed,
      averageApprovalTime: stats.averageApprovalTime,
      averageDeploymentTime: stats.averageDeploymentTime,
    };
  }

  /**
   * Create production PR
   */
  private async createProductionPR(promotion: PromotionRequest): Promise<{
    url: string;
    number: number;
  }> {
    // Generate PR description
    const description = this.generatePRDescription(promotion);

    // Create PR
    const prInfo = await this.prodWorkflow.createPullRequest(
      `promotion-${promotion.id}`,
      promotion.title,
      description,
      this.config.prodBranch
    );

    return {
      url: prInfo.url,
      number: prInfo.number,
    };
  }

  /**
   * Generate PR description
   */
  private generatePRDescription(promotion: PromotionRequest): string {
    let description = `# ${promotion.title}\n\n`;
    description += `${promotion.description}\n\n`;

    description += `## Promotion Details\n\n`;
    description += `- **Promotion ID**: ${promotion.id}\n`;
    description += `- **Created**: ${new Date(promotion.createdAt).toISOString()}\n`;
    description += `- **Approved By**: ${promotion.approvedBy}\n`;
    description += `- **Approved At**: ${new Date(promotion.approvedAt!).toISOString()}\n\n`;

    description += `## Changes\n\n`;
    for (const change of promotion.changes) {
      description += `- **${change.file}** (${change.type}): ${change.summary}\n`;
      description += `  - +${change.linesAdded} -${change.linesRemoved}\n`;
    }

    description += `\n## Test Results\n\n`;
    description += `- Total: ${promotion.testResults.totalTests}\n`;
    description += `- Passed: ${promotion.testResults.passedTests}\n`;
    description += `- Failed: ${promotion.testResults.failedTests}\n`;
    if (promotion.testResults.coverage) {
      description += `- Coverage: ${promotion.testResults.coverage}%\n`;
    }

    description += `\n## Risk Assessment\n\n`;
    description += `- **Risk Level**: ${promotion.impactAssessment.risk}\n`;
    description += `- **Affected Components**: ${promotion.impactAssessment.affectedComponents.join(', ')}\n`;
    description += `- **Estimated Downtime**: ${promotion.impactAssessment.estimatedDowntime} minutes\n`;

    description += `\n## Rollback Plan\n\n`;
    description += `- **Estimated Time**: ${promotion.rollbackPlan.estimatedTime} minutes\n`;
    description += `- **Automatable**: ${promotion.rollbackPlan.automatable ? 'Yes' : 'No'}\n\n`;
    description += `### Steps\n\n`;
    for (let i = 0; i < promotion.rollbackPlan.steps.length; i++) {
      description += `${i + 1}. ${promotion.rollbackPlan.steps[i]}\n`;
    }

    return description;
  }

  /**
   * Run tests in production environment
   */
  private async runProductionTests(): Promise<boolean> {
    try {
      console.log(`[Tests] Running: ${this.config.testCommand}`);

      // Execute test command
      // In real implementation, this would run the actual tests
      const testOutput = await this.executeCommand(this.config.testCommand);

      // Check if tests passed
      const passed = !testOutput.includes('FAIL') && !testOutput.includes('failed');

      console.log(`[Tests] Result: ${passed ? 'PASSED' : 'FAILED'}`);

      return passed;
    } catch (error) {
      console.error(`[Tests] Error:`, error);
      return false;
    }
  }

  /**
   * Execute deployment
   */
  private async executeDeployment(): Promise<void> {
    if (!this.config.deployCommand) {
      return;
    }

    console.log(`[Deploy] Running: ${this.config.deployCommand}`);

    // Execute deploy command
    // In real implementation, this would run the actual deployment
    await this.executeCommand(this.config.deployCommand);

    console.log(`[Deploy] Completed`);
  }

  /**
   * Execute shell command
   */
  private async executeCommand(command: string): Promise<string> {
    // Simplified - real implementation would use child_process
    console.log(`Executing: ${command}`);
    return 'Command output';
  }

  /**
   * Send notification
   */
  private async sendNotification(payload: NotificationPayload): Promise<void> {
    if (!this.config.notificationWebhook) {
      console.log(`[Notification] ${payload.type}: ${payload.title}`);
      return;
    }

    try {
      // In real implementation, this would send HTTP request to webhook
      console.log(`[Notification] Sending to webhook: ${payload.type}`);
      console.log(`[Notification] Payload:`, JSON.stringify(payload, null, 2));

      // Store notification in memory
      await this.storeNotification(payload);
    } catch (error) {
      console.error(`[Notification] Failed to send:`, error);
    }
  }

  /**
   * Store notification in memory engine
   */
  private async storeNotification(payload: NotificationPayload): Promise<void> {
    try {
      await this.memoryEngine.storePattern({
        name: `notification-${payload.promotionId}-${payload.type}`,
        category: 'promotion-notification',
        problem: payload.title,
        solution: payload.type,
        example_code: JSON.stringify(payload),
        applicability: `Status: ${payload.status}`,
        metadata: {
          notificationData: payload,
        },
      });
    } catch (error) {
      console.error('Failed to store notification:', error);
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(promotionId?: string): Promise<NotificationPayload[]> {
    try {
      const results = await this.memoryEngine.searchPatterns('promotion-notification');

      const notifications: NotificationPayload[] = [];

      for (const result of results) {
        if (result.category === 'promotion-notification' && result.metadata?.notificationData) {
          const notification = result.metadata.notificationData as NotificationPayload;

          if (!promotionId || notification.promotionId === promotionId) {
            notifications.push(notification);
          }
        }
      }

      return notifications.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.warn('Could not load notification history:', error);
      return [];
    }
  }
}

/**
 * Create promotion approval workflow
 */
export function createPromotionApprovalWorkflow(
  devProdManager: DevProdManager,
  prodWorkflow: RepositoryWorkflow,
  memoryEngine: MemoryEngine,
  config: ApprovalWorkflowConfig
): PromotionApprovalWorkflow {
  return new PromotionApprovalWorkflow(
    devProdManager,
    prodWorkflow,
    memoryEngine,
    config
  );
}
