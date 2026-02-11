/**
 * Self-Modification Consultation System
 * 
 * Manages the workflow for Prometheus self-improvements:
 * 1. Analyze own code
 * 2. Prioritize improvements
 * 3. Send consultation request to user
 * 4. Apply changes to ANOTS development repo after approval
 * 5. Create PR and report back
 * 
 * Task 37.4: Implement self-modification consultation
 */

import type { SelfAnalyzer, SelfAnalysisResult } from './self-analyzer';
import type { SelfImprovementPrioritizer, PrioritizedWork } from './self-improvement-prioritizer';
import type { ConsultationManager } from '../decision/consultation-manager';
import { AnotsWorkflow, type ChangeSet, type PullRequestInfo } from '../integrations/anots-workflow';
import type { Improvement } from '../types';
import type { Decision } from '../decision/risk-evaluator';
import type { Alternative, ImpactAssessment, UserFeedback } from '../decision/consultation-manager';

export interface SelfModificationConfig {
  /** Path to Prometheus repository (for analysis and self-modifications) */
  prometheusRepoPath: string;
  /** Path to ANOTS development repository (for ANOTS improvements) */
  anotsRepoPath: string;
  /** Target repository for modifications: 'prometheus' or 'anots' */
  targetRepo: 'prometheus' | 'anots';
  /** Minimum ROI threshold for self-improvements */
  minROI: number;
  /** Maximum self-improvement ratio (0-1) */
  maxSelfImprovementRatio: number;
  /** Whether to run tests before creating PR */
  runTestsBeforePR: boolean;
}

export interface SelfModificationProposal {
  /** Unique proposal ID */
  id: string;
  /** Improvements being proposed */
  improvements: Improvement[];
  /** Prioritized work breakdown */
  prioritizedWork: PrioritizedWork;
  /** Files that will be modified */
  files: string[];
  /** Estimated effort (hours) */
  estimatedEffort: number;
  /** Expected benefits */
  expectedBenefits: string[];
  /** Risks */
  risks: string[];
  /** Test plan */
  testPlan: string;
  /** Created timestamp */
  createdAt: number;
}

export interface SelfModificationResult {
  /** Proposal ID */
  proposalId: string;
  /** Whether user approved */
  approved: boolean;
  /** User feedback */
  feedback?: UserFeedback;
  /** Pull request info (if approved and applied) */
  pullRequest?: PullRequestInfo;
  /** Test results */
  testResults?: {
    passed: boolean;
    output: string;
  };
  /** Completion timestamp */
  completedAt: number;
}

export class SelfModificationConsultant {
  private pendingProposals: Map<string, SelfModificationProposal> = new Map();
  private proposalHistory: SelfModificationResult[] = [];
  private prometheusWorkflow: AnotsWorkflow;

  constructor(
    private config: SelfModificationConfig,
    private selfAnalyzer: SelfAnalyzer,
    private prioritizer: SelfImprovementPrioritizer,
    private consultationManager: ConsultationManager,
    private anotsWorkflow: AnotsWorkflow,
    prometheusWorkflow?: AnotsWorkflow // Optional for testing
  ) {
    // Use provided workflow or create a new one
    this.prometheusWorkflow = prometheusWorkflow || new AnotsWorkflow({
      repoPath: config.prometheusRepoPath,
      baseBranch: 'main',
      branchPrefix: 'self-improvement/',
      runTestsBeforePR: config.runTestsBeforePR,
      testCommand: 'npm test',
    });
  }

  /**
   * Get the appropriate workflow based on target repo
   */
  private getWorkflow(): AnotsWorkflow {
    return this.config.targetRepo === 'prometheus' 
      ? this.prometheusWorkflow 
      : this.anotsWorkflow;
  }

  /**
   * Get the target repository path
   */
  private getTargetRepoPath(): string {
    return this.config.targetRepo === 'prometheus'
      ? this.config.prometheusRepoPath
      : this.config.anotsRepoPath;
  }

  /**
   * Get the target repository name for display
   */
  private getTargetRepoName(): string {
    return this.config.targetRepo === 'prometheus'
      ? 'Prometheus (self)'
      : 'ANOTS';
  }

  /**
   * Analyze self-code and propose improvements
   * 
   * This is the main entry point for self-improvement workflow.
   */
  async analyzeSelfAndPropose(): Promise<SelfModificationProposal | null> {
    console.log('Starting self-analysis and improvement proposal...');

    // Step 1: Analyze self-code
    const analysisResult = await this.selfAnalyzer.runAnalysis();

    if (analysisResult.improvements.length === 0) {
      console.log('No self-improvements identified');
      return null;
    }

    console.log(`Identified ${analysisResult.improvements.length} potential self-improvements`);

    // Step 2: Prioritize improvements alongside project work
    // For self-improvements, we don't have project work to balance against,
    // so we pass an empty array
    const prioritizedWork = this.prioritizer.prioritize(
      analysisResult.improvements,
      [] // No project work to balance
    );

    if (prioritizedWork.selfImprovements.length === 0) {
      console.log('No viable self-improvements after prioritization');
      return null;
    }

    console.log(`Prioritized ${prioritizedWork.selfImprovements.length} self-improvements`);

    // Step 3: Build proposal
    const proposal = this.buildProposal(analysisResult, prioritizedWork);

    // Store pending proposal
    this.pendingProposals.set(proposal.id, proposal);

    console.log(`Created self-modification proposal: ${proposal.id}`);

    return proposal;
  }

  /**
   * Request user consultation for self-modification
   * 
   * Builds a consultation request with full context and sends to user.
   */
  async requestConsultation(
    proposalId: string
  ): Promise<{ required: boolean; requestId?: string }> {
    const proposal = this.pendingProposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    // Build decision object
    const decision: Decision = {
      id: `self-mod-${proposalId}`,
      description: this.buildDecisionDescription(proposal),
      type: 'self-modification',
      change: {
        files: proposal.files,
        description: this.buildChangeDescription(proposal),
      },
      reasoning: this.buildReasoning(proposal),
      timestamp: Date.now(),
    };

    // Build impact assessment
    const impact: ImpactAssessment = {
      affectedComponents: proposal.files.length,
      estimatedEffort: proposal.estimatedEffort,
      confidence: 0.8, // High confidence since we analyzed our own code
    };

    // Check if consultation is needed
    const { required, triggers } = this.consultationManager.shouldConsult(
      decision,
      impact
    );

    if (!required) {
      console.log('Consultation not required for this self-modification');
      return { required: false };
    }

    // Build alternatives
    const alternatives = this.buildAlternatives(proposal);

    // Build consultation request
    const consultationRequest = this.consultationManager.buildConsultationRequest(
      decision,
      triggers,
      impact,
      undefined, // No risk evaluation for now
      undefined, // No priority score for now
      alternatives,
      [] // No past decisions for now
    );

    console.log('Consultation request built:', {
      proposalId,
      triggers,
      improvements: proposal.improvements.length,
      files: proposal.files.length,
    });

    return {
      required: true,
      requestId: consultationRequest.decision.id,
    };
  }

  /**
   * Apply approved self-modification
   * 
   * Creates branch, applies changes, runs tests, creates PR.
   */
  async applyApprovedModification(
    proposalId: string,
    feedback: UserFeedback
  ): Promise<SelfModificationResult> {
    const proposal = this.pendingProposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    if (!feedback.approved) {
      // User rejected - store result and return
      const result: SelfModificationResult = {
        proposalId,
        approved: false,
        feedback,
        completedAt: Date.now(),
      };

      this.proposalHistory.push(result);
      this.pendingProposals.delete(proposalId);

      console.log(`Self-modification rejected by user: ${proposalId}`);
      return result;
    }

    console.log(`Applying approved self-modification: ${proposalId}`);

    try {
      // Get the appropriate workflow for target repo
      const workflow = this.getWorkflow();
      const targetRepo = this.getTargetRepoName();

      console.log(`Target repository: ${targetRepo}`);

      // Step 1: Create feature branch
      const featureName = `self-improvement-${proposalId}`;
      const branch = await workflow.createFeatureBranch(featureName);
      console.log(`Created branch: ${branch.name}`);

      // Step 2: Generate changes
      const changeSet = await this.generateChangeSet(proposal);

      // Step 3: Apply changes
      await workflow.applyChanges(changeSet);
      console.log(`Applied changes to ${changeSet.files.length} files`);

      // Step 4: Run tests (if configured)
      let testResults: { passed: boolean; output: string } | undefined;
      if (this.config.runTestsBeforePR) {
        testResults = await workflow.runTests();
        console.log(`Tests ${testResults.passed ? 'passed' : 'failed'}`);
      }

      // Step 5: Create PR
      const prTitle = this.buildPRTitle(proposal);
      const prDescription = this.buildPRDescription(proposal, testResults);

      const pullRequest = await workflow.generatePullRequest(
        branch.name,
        prTitle,
        prDescription
      );

      console.log(`Created PR: ${pullRequest.title}`);

      // Step 6: Store result
      const result: SelfModificationResult = {
        proposalId,
        approved: true,
        feedback,
        pullRequest,
        testResults,
        completedAt: Date.now(),
      };

      this.proposalHistory.push(result);
      this.pendingProposals.delete(proposalId);

      // Step 7: Incorporate feedback into consultation manager
      const decision: Decision = {
        id: `self-mod-${proposalId}`,
        description: this.buildDecisionDescription(proposal),
        type: 'self-modification',
        change: {
          files: proposal.files,
          description: this.buildChangeDescription(proposal),
        },
        reasoning: this.buildReasoning(proposal),
        timestamp: Date.now(),
      };

      const impact: ImpactAssessment = {
        affectedComponents: proposal.files.length,
        estimatedEffort: proposal.estimatedEffort,
        confidence: 0.8,
      };

      const consultationRequest = this.consultationManager.buildConsultationRequest(
        decision,
        ['self_modification'],
        impact
      );

      this.consultationManager.incorporateFeedback(consultationRequest, feedback);

      return result;
    } catch (error) {
      console.error('Failed to apply self-modification:', error);
      throw error;
    }
  }

  /**
   * Get pending proposals
   */
  getPendingProposals(): SelfModificationProposal[] {
    return Array.from(this.pendingProposals.values());
  }

  /**
   * Get proposal history
   */
  getProposalHistory(): SelfModificationResult[] {
    return [...this.proposalHistory];
  }

  /**
   * Get proposal by ID
   */
  getProposal(proposalId: string): SelfModificationProposal | undefined {
    return this.pendingProposals.get(proposalId);
  }

  /**
   * Build proposal from analysis and prioritization
   */
  private buildProposal(
    analysisResult: SelfAnalysisResult,
    prioritizedWork: PrioritizedWork
  ): SelfModificationProposal {
    const improvements = prioritizedWork.selfImprovements.map((task) => {
      const improvement = analysisResult.improvements.find(
        (i) => `self-improvement-${i.type}-${i.location}` === task.id
      );
      return improvement!;
    });

    // Extract unique files from improvements
    const files = Array.from(
      new Set(improvements.map((i) => i.location.split(':')[0]))
    );

    // Calculate total effort
    const estimatedEffort = prioritizedWork.selfImprovements.reduce(
      (sum, task) => sum + task.effortHours,
      0
    );

    // Build expected benefits
    const expectedBenefits = improvements.map((i) => i.suggestion);

    // Build risks
    const risks = [
      'Self-modification may introduce bugs',
      'Tests may fail after changes',
      'Changes may affect system stability',
    ];

    // Build test plan
    const testPlan = this.buildTestPlan(improvements);

    return {
      id: `prop-${Date.now()}`,
      improvements,
      prioritizedWork,
      files,
      estimatedEffort,
      expectedBenefits,
      risks,
      testPlan,
      createdAt: Date.now(),
    };
  }

  /**
   * Build decision description
   */
  private buildDecisionDescription(proposal: SelfModificationProposal): string {
    const improvementTypes = Array.from(
      new Set(proposal.improvements.map((i) => i.type))
    );

    return `Self-improvement: ${improvementTypes.join(', ')} (${proposal.improvements.length} improvements)`;
  }

  /**
   * Build change description
   */
  private buildChangeDescription(proposal: SelfModificationProposal): string {
    const parts: string[] = [];

    const targetRepo = this.getTargetRepoName();
    parts.push(`**Self-Improvement Proposal for ${targetRepo}**`);
    parts.push(`\n**Improvements** (${proposal.improvements.length}):`);

    proposal.improvements.forEach((improvement, index) => {
      parts.push(`${index + 1}. [${improvement.priority}] ${improvement.description}`);
      parts.push(`   Location: ${improvement.location}`);
      parts.push(`   Suggestion: ${improvement.suggestion}`);
    });

    parts.push(`\n**Files to Modify** (${proposal.files.length}):`);
    proposal.files.forEach((file) => {
      parts.push(`- ${file}`);
    });

    parts.push(`\n**Estimated Effort**: ${proposal.estimatedEffort} hours`);

    parts.push(`\n**Expected Benefits**:`);
    proposal.expectedBenefits.forEach((benefit) => {
      parts.push(`- ${benefit}`);
    });

    parts.push(`\n**Test Plan**:`);
    parts.push(proposal.testPlan);

    return parts.join('\n');
  }

  /**
   * Build reasoning
   */
  private buildReasoning(proposal: SelfModificationProposal): string {
    const parts: string[] = [];

    parts.push('Self-analysis identified opportunities for improvement.');
    parts.push(
      `ROI analysis shows average ROI of ${proposal.prioritizedWork.roiMetrics.averageROI.toFixed(2)}.`
    );
    parts.push(
      `${proposal.prioritizedWork.roiMetrics.highROICount} high-ROI improvements identified.`
    );
    parts.push(
      `Self-improvement ratio: ${(proposal.prioritizedWork.selfImprovementRatio * 100).toFixed(1)}%`
    );

    return parts.join(' ');
  }

  /**
   * Build alternatives
   */
  private buildAlternatives(proposal: SelfModificationProposal): Alternative[] {
    return [
      {
        description: 'Apply all proposed improvements',
        pros: [
          'Maximum quality improvement',
          'Address all identified issues',
          'High ROI improvements included',
        ],
        cons: [
          `Requires ${proposal.estimatedEffort} hours`,
          'May introduce bugs',
          'Requires thorough testing',
        ],
        effort: proposal.estimatedEffort,
      },
      {
        description: 'Apply only high-priority improvements',
        pros: [
          'Lower risk',
          'Faster to implement',
          'Focus on critical issues',
        ],
        cons: [
          'Leaves some issues unaddressed',
          'May need follow-up improvements',
        ],
        effort: proposal.estimatedEffort * 0.5,
      },
      {
        description: 'Defer improvements',
        pros: [
          'No immediate risk',
          'Can focus on project work',
        ],
        cons: [
          'Technical debt accumulates',
          'Quality issues persist',
          'May become harder to fix later',
        ],
        effort: 0,
      },
    ];
  }

  /**
   * Build test plan
   */
  private buildTestPlan(improvements: Improvement[]): string {
    const parts: string[] = [];

    parts.push('1. Run existing unit tests');
    parts.push('2. Run integration tests');

    // Add specific tests based on improvement types
    const hasQualityImprovements = improvements.some((i) => i.type === 'quality');
    const hasDebtImprovements = improvements.some((i) => i.type === 'debt');

    if (hasQualityImprovements) {
      parts.push('3. Verify code quality metrics improved');
      parts.push('4. Check complexity reduction');
    }

    if (hasDebtImprovements) {
      parts.push('3. Verify technical debt reduced');
      parts.push('4. Check for TODO/FIXME resolution');
    }

    parts.push('5. Manual smoke testing');
    parts.push('6. Performance regression testing');

    return parts.join('\n');
  }

  /**
   * Generate change set for proposal
   */
  private async generateChangeSet(
    proposal: SelfModificationProposal
  ): Promise<ChangeSet> {
    // In a real implementation, this would generate actual code changes
    // For now, we'll create a placeholder that documents the changes

    const files = proposal.files.map((filePath) => {
      const relevantImprovements = proposal.improvements.filter(
        (i) => i.location.startsWith(filePath)
      );

      const content = this.generateFileChanges(filePath, relevantImprovements);

      return {
        path: filePath,
        content,
      };
    });

    const commitMessage = this.buildCommitMessage(proposal);

    return {
      files,
      commitMessage,
    };
  }

  /**
   * Generate file changes
   */
  private generateFileChanges(
    filePath: string,
    improvements: Improvement[]
  ): string {
    // In a real implementation, this would use LLM to generate actual code changes
    // For now, return a comment documenting the changes

    const parts: string[] = [];

    parts.push(`// Self-improvement changes for ${filePath}`);
    parts.push('//');
    parts.push('// Improvements applied:');

    improvements.forEach((improvement, index) => {
      parts.push(`// ${index + 1}. ${improvement.description}`);
      parts.push(`//    ${improvement.suggestion}`);
    });

    parts.push('');
    parts.push('// TODO: Implement actual code changes');
    parts.push('');

    return parts.join('\n');
  }

  /**
   * Build commit message
   */
  private buildCommitMessage(proposal: SelfModificationProposal): string {
    const improvementTypes = Array.from(
      new Set(proposal.improvements.map((i) => i.type))
    );

    return `feat(prometheus): self-improvement - ${improvementTypes.join(', ')}

Applied ${proposal.improvements.length} self-improvements:
${proposal.improvements.map((i, idx) => `${idx + 1}. ${i.description}`).join('\n')}

Estimated effort: ${proposal.estimatedEffort} hours
ROI: ${proposal.prioritizedWork.roiMetrics.averageROI.toFixed(2)}`;
  }

  /**
   * Build PR title
   */
  private buildPRTitle(proposal: SelfModificationProposal): string {
    const improvementTypes = Array.from(
      new Set(proposal.improvements.map((i) => i.type))
    );

    const targetRepo = this.getTargetRepoName();
    return `[Prometheus] Self-improvement (${targetRepo}): ${improvementTypes.join(', ')}`;
  }

  /**
   * Build PR description
   */
  private buildPRDescription(
    proposal: SelfModificationProposal,
    testResults?: { passed: boolean; output: string }
  ): string {
    const parts: string[] = [];

    const targetRepo = this.getTargetRepoName();
    parts.push(`## Self-Improvement Proposal for ${targetRepo}`);
    parts.push('');
    parts.push(`Prometheus has analyzed its own codebase and identified opportunities for improvement in the ${targetRepo} repository.`);
    parts.push('');

    parts.push('### Improvements');
    parts.push('');
    proposal.improvements.forEach((improvement, index) => {
      parts.push(`${index + 1}. **[${improvement.priority}]** ${improvement.description}`);
      parts.push(`   - Location: \`${improvement.location}\``);
      parts.push(`   - Suggestion: ${improvement.suggestion}`);
      parts.push('');
    });

    parts.push('### Metrics');
    parts.push('');
    parts.push(`- **Target Repository**: ${targetRepo}`);
    parts.push(`- **Improvements**: ${proposal.improvements.length}`);
    parts.push(`- **Files Modified**: ${proposal.files.length}`);
    parts.push(`- **Estimated Effort**: ${proposal.estimatedEffort} hours`);
    parts.push(
      `- **Average ROI**: ${proposal.prioritizedWork.roiMetrics.averageROI.toFixed(2)}`
    );
    parts.push(
      `- **High-ROI Improvements**: ${proposal.prioritizedWork.roiMetrics.highROICount}`
    );
    parts.push('');

    parts.push('### Test Plan');
    parts.push('');
    parts.push(proposal.testPlan);
    parts.push('');

    if (testResults) {
      parts.push('### Test Results');
      parts.push('');
      parts.push(`**Status**: ${testResults.passed ? '✅ PASSED' : '❌ FAILED'}`);
      parts.push('');
      if (!testResults.passed) {
        parts.push('```');
        parts.push(testResults.output);
        parts.push('```');
      }
    }

    parts.push('---');
    parts.push('');
    parts.push(`*This PR was automatically generated by Prometheus self-improvement system for ${targetRepo}.*`);

    return parts.join('\n');
  }
}

/**
 * Create a self-modification consultant instance
 */
export function createSelfModificationConsultant(
  config: SelfModificationConfig,
  selfAnalyzer: SelfAnalyzer,
  prioritizer: SelfImprovementPrioritizer,
  consultationManager: ConsultationManager,
  anotsWorkflow: AnotsWorkflow
): SelfModificationConsultant {
  return new SelfModificationConsultant(
    config,
    selfAnalyzer,
    prioritizer,
    consultationManager,
    anotsWorkflow
  );
}
