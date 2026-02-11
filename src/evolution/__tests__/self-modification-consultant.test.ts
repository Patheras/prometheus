/**
 * Tests for Self-Modification Consultation System
 * 
 * Task 37.4: Implement self-modification consultation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SelfModificationConsultant,
  createSelfModificationConsultant,
  type SelfModificationConfig,
  type SelfModificationProposal,
} from '../self-modification-consultant';
import type { SelfAnalyzer, SelfAnalysisResult } from '../self-analyzer';
import type { SelfImprovementPrioritizer, PrioritizedWork } from '../self-improvement-prioritizer';
import type { ConsultationManager } from '../../decision/consultation-manager';
import type { AnotsWorkflow, PullRequestInfo } from '../../integrations/anots-workflow';
import type { Improvement } from '../../types';
import type { UserFeedback } from '../../decision/consultation-manager';

describe('SelfModificationConsultant', () => {
  let config: SelfModificationConfig;
  let mockSelfAnalyzer: jest.Mocked<SelfAnalyzer>;
  let mockPrioritizer: jest.Mocked<SelfImprovementPrioritizer>;
  let mockConsultationManager: jest.Mocked<ConsultationManager>;
  let mockAnotsWorkflow: jest.Mocked<AnotsWorkflow>;
  let consultant: SelfModificationConsultant;

  beforeEach(() => {
    config = {
      prometheusRepoPath: '/path/to/prometheus',
      anotsRepoPath: '/path/to/anots',
      targetRepo: 'anots', // Default to ANOTS for backward compatibility
      minROI: 2.0,
      maxSelfImprovementRatio: 0.2,
      runTestsBeforePR: true,
    };

    // Mock SelfAnalyzer
    mockSelfAnalyzer = {
      runAnalysis: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      triggerPostModification: jest.fn(),
      getLastAnalysis: jest.fn(),
      getAnalysisHistory: jest.fn(),
      isAnalysisDue: jest.fn(),
      getImprovementMetrics: jest.fn(),
    } as any;

    // Mock SelfImprovementPrioritizer
    mockPrioritizer = {
      prioritize: jest.fn(),
      getROI: jest.fn(),
      getROIHistory: jest.fn(),
      trackOutcome: jest.fn(),
      updateConfig: jest.fn(),
    } as any;

    // Mock ConsultationManager
    mockConsultationManager = {
      shouldConsult: jest.fn(),
      buildConsultationRequest: jest.fn(),
      incorporateFeedback: jest.fn(),
      getStatistics: jest.fn(),
      reset: jest.fn(),
    } as any;

    // Mock AnotsWorkflow
    mockAnotsWorkflow = {
      createFeatureBranch: jest.fn(),
      applyChanges: jest.fn(),
      runTests: jest.fn(),
      pushBranch: jest.fn(),
      getChangedFiles: jest.fn(),
      generatePullRequest: jest.fn(),
      executeWorkflow: jest.fn(),
      branchExists: jest.fn(),
      deleteBranch: jest.fn(),
      getCurrentBranch: jest.fn(),
      switchBranch: jest.fn(),
      getCommitCount: jest.fn(),
      isWorkingDirectoryClean: jest.fn(),
    } as any;

    consultant = createSelfModificationConsultant(
      config,
      mockSelfAnalyzer,
      mockPrioritizer,
      mockConsultationManager,
      mockAnotsWorkflow
    );
  });

  describe('analyzeSelfAndPropose', () => {
    it('should return null when no improvements identified', async () => {
      const analysisResult: SelfAnalysisResult = {
        timestamp: Date.now(),
        issues: [],
        debt: [],
        improvements: [],
        metrics: {
          totalFiles: 10,
          totalLines: 1000,
          averageComplexity: 5,
          testCoverage: 80,
          qualityScore: 85,
        },
      };

      mockSelfAnalyzer.runAnalysis.mockResolvedValue(analysisResult);

      const proposal = await consultant.analyzeSelfAndPropose();

      expect(proposal).toBeNull();
      expect(mockSelfAnalyzer.runAnalysis).toHaveBeenCalled();
    });

    it('should return null when no viable improvements after prioritization', async () => {
      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'low',
          description: 'Low priority improvement',
          suggestion: 'Refactor this',
          location: 'file.ts:10',
          estimatedImpact: 20,
        },
      ];

      const analysisResult: SelfAnalysisResult = {
        timestamp: Date.now(),
        issues: [],
        debt: [],
        improvements,
        metrics: {
          totalFiles: 10,
          totalLines: 1000,
          averageComplexity: 5,
          testCoverage: 80,
          qualityScore: 85,
        },
      };

      const prioritizedWork: PrioritizedWork = {
        allTasks: [],
        scores: [],
        selfImprovements: [], // No viable improvements
        projectWork: [],
        selfImprovementRatio: 0,
        roiMetrics: {
          totalROI: 0,
          averageROI: 0,
          highROICount: 0,
        },
      };

      mockSelfAnalyzer.runAnalysis.mockResolvedValue(analysisResult);
      mockPrioritizer.prioritize.mockReturnValue(prioritizedWork);

      const proposal = await consultant.analyzeSelfAndPropose();

      expect(proposal).toBeNull();
    });

    it('should create proposal when viable improvements exist', async () => {
      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Reduce complexity',
          suggestion: 'Extract method',
          location: 'file.ts:10',
          estimatedImpact: 80,
        },
        {
          type: 'debt',
          priority: 'medium',
          description: 'Remove TODO',
          suggestion: 'Implement feature',
          location: 'file.ts:20',
          estimatedImpact: 60,
        },
      ];

      const analysisResult: SelfAnalysisResult = {
        timestamp: Date.now(),
        issues: [],
        debt: [],
        improvements,
        metrics: {
          totalFiles: 10,
          totalLines: 1000,
          averageComplexity: 5,
          testCoverage: 80,
          qualityScore: 85,
        },
      };

      const prioritizedWork: PrioritizedWork = {
        allTasks: [
          {
            id: 'self-improvement-quality-file.ts:10',
            description: 'Reduce complexity',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
          {
            id: 'self-improvement-debt-file.ts:20',
            description: 'Remove TODO',
            type: 'self-improvement',
            effortHours: 2,
            metadata: {},
          },
        ],
        scores: [],
        selfImprovements: [
          {
            id: 'self-improvement-quality-file.ts:10',
            description: 'Reduce complexity',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
          {
            id: 'self-improvement-debt-file.ts:20',
            description: 'Remove TODO',
            type: 'self-improvement',
            effortHours: 2,
            metadata: {},
          },
        ],
        projectWork: [],
        selfImprovementRatio: 1.0,
        roiMetrics: {
          totalROI: 30,
          averageROI: 15,
          highROICount: 2,
        },
      };

      mockSelfAnalyzer.runAnalysis.mockResolvedValue(analysisResult);
      mockPrioritizer.prioritize.mockReturnValue(prioritizedWork);

      const proposal = await consultant.analyzeSelfAndPropose();

      expect(proposal).not.toBeNull();
      expect(proposal!.improvements).toHaveLength(2);
      expect(proposal!.files).toContain('file.ts');
      expect(proposal!.estimatedEffort).toBe(7); // 5 + 2
      expect(proposal!.expectedBenefits).toHaveLength(2);
    });
  });

  describe('requestConsultation', () => {
    let proposal: SelfModificationProposal;

    beforeEach(async () => {
      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Reduce complexity',
          suggestion: 'Extract method',
          location: 'file.ts:10',
          estimatedImpact: 80,
        },
      ];

      const analysisResult: SelfAnalysisResult = {
        timestamp: Date.now(),
        issues: [],
        debt: [],
        improvements,
        metrics: {
          totalFiles: 10,
          totalLines: 1000,
          averageComplexity: 5,
          testCoverage: 80,
          qualityScore: 85,
        },
      };

      const prioritizedWork: PrioritizedWork = {
        allTasks: [
          {
            id: 'self-improvement-quality-file.ts:10',
            description: 'Reduce complexity',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        scores: [],
        selfImprovements: [
          {
            id: 'self-improvement-quality-file.ts:10',
            description: 'Reduce complexity',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        projectWork: [],
        selfImprovementRatio: 1.0,
        roiMetrics: {
          totalROI: 15,
          averageROI: 15,
          highROICount: 1,
        },
      };

      mockSelfAnalyzer.runAnalysis.mockResolvedValue(analysisResult);
      mockPrioritizer.prioritize.mockReturnValue(prioritizedWork);

      proposal = (await consultant.analyzeSelfAndPropose())!;
    });

    it('should return not required when consultation not needed', async () => {
      mockConsultationManager.shouldConsult.mockReturnValue({
        required: false,
        triggers: [],
      });

      const result = await consultant.requestConsultation(proposal.id);

      expect(result.required).toBe(false);
      expect(result.requestId).toBeUndefined();
    });

    it('should build consultation request when required', async () => {
      mockConsultationManager.shouldConsult.mockReturnValue({
        required: true,
        triggers: ['self_modification'],
      });

      mockConsultationManager.buildConsultationRequest.mockReturnValue({
        decision: {
          id: `self-mod-${proposal.id}`,
          description: 'Self-improvement',
          type: 'self-modification',
          change: {
            files: ['file.ts'],
            description: 'Changes',
          },
          reasoning: 'Reasoning',
          timestamp: Date.now(),
        },
        triggers: ['self_modification'],
        impact: {
          affectedComponents: 1,
          estimatedEffort: 5,
          confidence: 0.8,
        },
        alternatives: [],
        recommendation: 'Proceed',
        pastDecisions: [],
        requestedAt: Date.now(),
      });

      const result = await consultant.requestConsultation(proposal.id);

      expect(result.required).toBe(true);
      expect(result.requestId).toBeDefined();
      expect(mockConsultationManager.buildConsultationRequest).toHaveBeenCalled();
    });

    it('should throw error for non-existent proposal', async () => {
      await expect(
        consultant.requestConsultation('non-existent')
      ).rejects.toThrow('Proposal not found');
    });
  });

  describe('applyApprovedModification', () => {
    let proposal: SelfModificationProposal;

    beforeEach(async () => {
      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Reduce complexity',
          suggestion: 'Extract method',
          location: 'file.ts:10',
          estimatedImpact: 80,
        },
      ];

      const analysisResult: SelfAnalysisResult = {
        timestamp: Date.now(),
        issues: [],
        debt: [],
        improvements,
        metrics: {
          totalFiles: 10,
          totalLines: 1000,
          averageComplexity: 5,
          testCoverage: 80,
          qualityScore: 85,
        },
      };

      const prioritizedWork: PrioritizedWork = {
        allTasks: [
          {
            id: 'self-improvement-quality-file.ts:10',
            description: 'Reduce complexity',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        scores: [],
        selfImprovements: [
          {
            id: 'self-improvement-quality-file.ts:10',
            description: 'Reduce complexity',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        projectWork: [],
        selfImprovementRatio: 1.0,
        roiMetrics: {
          totalROI: 15,
          averageROI: 15,
          highROICount: 1,
        },
      };

      mockSelfAnalyzer.runAnalysis.mockResolvedValue(analysisResult);
      mockPrioritizer.prioritize.mockReturnValue(prioritizedWork);

      proposal = (await consultant.analyzeSelfAndPropose())!;
    });

    it('should handle rejected modification', async () => {
      const feedback: UserFeedback = {
        approved: false,
        comments: 'Not now',
      };

      const result = await consultant.applyApprovedModification(proposal.id, feedback);

      expect(result.approved).toBe(false);
      expect(result.feedback).toEqual(feedback);
      expect(result.pullRequest).toBeUndefined();
      expect(consultant.getPendingProposals()).toHaveLength(0);
    });

    it('should apply approved modification and create PR', async () => {
      const feedback: UserFeedback = {
        approved: true,
        comments: 'Looks good',
        confidence: 90,
      };

      mockAnotsWorkflow.createFeatureBranch.mockResolvedValue({
        name: 'prometheus/self-improvement-test',
        baseBranch: 'main',
        created: Date.now(),
        commitHash: 'abc123',
      });

      mockAnotsWorkflow.applyChanges.mockResolvedValue(undefined);

      mockAnotsWorkflow.runTests.mockResolvedValue({
        passed: true,
        output: 'All tests passed',
      });

      const mockPR: PullRequestInfo = {
        branch: 'prometheus/self-improvement-test',
        title: '[Prometheus] Self-improvement: quality',
        description: 'PR description',
        baseBranch: 'main',
        filesChanged: ['file.ts'],
        testsRun: true,
        testsPassed: true,
      };

      mockAnotsWorkflow.generatePullRequest.mockResolvedValue(mockPR);

      mockConsultationManager.buildConsultationRequest.mockReturnValue({
        decision: {
          id: `self-mod-${proposal.id}`,
          description: 'Self-improvement',
          type: 'self-modification',
          change: {
            files: ['file.ts'],
            description: 'Changes',
          },
          reasoning: 'Reasoning',
          timestamp: Date.now(),
        },
        triggers: ['self_modification'],
        impact: {
          affectedComponents: 1,
          estimatedEffort: 5,
          confidence: 0.8,
        },
        alternatives: [],
        recommendation: 'Proceed',
        pastDecisions: [],
        requestedAt: Date.now(),
      });

      const result = await consultant.applyApprovedModification(proposal.id, feedback);

      expect(result.approved).toBe(true);
      expect(result.pullRequest).toEqual(mockPR);
      expect(result.testResults).toEqual({
        passed: true,
        output: 'All tests passed',
      });

      expect(mockAnotsWorkflow.createFeatureBranch).toHaveBeenCalled();
      expect(mockAnotsWorkflow.applyChanges).toHaveBeenCalled();
      expect(mockAnotsWorkflow.runTests).toHaveBeenCalled();
      expect(mockAnotsWorkflow.generatePullRequest).toHaveBeenCalled();
      expect(mockConsultationManager.incorporateFeedback).toHaveBeenCalled();

      expect(consultant.getPendingProposals()).toHaveLength(0);
      expect(consultant.getProposalHistory()).toHaveLength(1);
    });

    it('should handle test failures', async () => {
      const feedback: UserFeedback = {
        approved: true,
        comments: 'Looks good',
      };

      mockAnotsWorkflow.createFeatureBranch.mockResolvedValue({
        name: 'prometheus/self-improvement-test',
        baseBranch: 'main',
        created: Date.now(),
        commitHash: 'abc123',
      });

      mockAnotsWorkflow.applyChanges.mockResolvedValue(undefined);

      mockAnotsWorkflow.runTests.mockResolvedValue({
        passed: false,
        output: 'Test failed: ...',
      });

      const mockPR: PullRequestInfo = {
        branch: 'prometheus/self-improvement-test',
        title: '[Prometheus] Self-improvement: quality',
        description: 'PR description',
        baseBranch: 'main',
        filesChanged: ['file.ts'],
        testsRun: true,
        testsPassed: false,
      };

      mockAnotsWorkflow.generatePullRequest.mockResolvedValue(mockPR);

      mockConsultationManager.buildConsultationRequest.mockReturnValue({
        decision: {
          id: `self-mod-${proposal.id}`,
          description: 'Self-improvement',
          type: 'self-modification',
          change: {
            files: ['file.ts'],
            description: 'Changes',
          },
          reasoning: 'Reasoning',
          timestamp: Date.now(),
        },
        triggers: ['self_modification'],
        impact: {
          affectedComponents: 1,
          estimatedEffort: 5,
          confidence: 0.8,
        },
        alternatives: [],
        recommendation: 'Proceed',
        pastDecisions: [],
        requestedAt: Date.now(),
      });

      const result = await consultant.applyApprovedModification(proposal.id, feedback);

      expect(result.testResults?.passed).toBe(false);
      expect(result.pullRequest?.testsPassed).toBe(false);
    });

    it('should throw error for non-existent proposal', async () => {
      const feedback: UserFeedback = {
        approved: true,
      };

      await expect(
        consultant.applyApprovedModification('non-existent', feedback)
      ).rejects.toThrow('Proposal not found');
    });
  });

  describe('proposal management', () => {
    it('should track pending proposals', async () => {
      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Improvement 1',
          suggestion: 'Suggestion 1',
          location: 'file1.ts:10',
          estimatedImpact: 80,
        },
      ];

      const analysisResult: SelfAnalysisResult = {
        timestamp: Date.now(),
        issues: [],
        debt: [],
        improvements,
        metrics: {
          totalFiles: 10,
          totalLines: 1000,
          averageComplexity: 5,
          testCoverage: 80,
          qualityScore: 85,
        },
      };

      const prioritizedWork: PrioritizedWork = {
        allTasks: [
          {
            id: 'self-improvement-quality-file1.ts:10',
            description: 'Improvement 1',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        scores: [],
        selfImprovements: [
          {
            id: 'self-improvement-quality-file1.ts:10',
            description: 'Improvement 1',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        projectWork: [],
        selfImprovementRatio: 1.0,
        roiMetrics: {
          totalROI: 15,
          averageROI: 15,
          highROICount: 1,
        },
      };

      // Mock to return same data for both calls
      mockSelfAnalyzer.runAnalysis.mockResolvedValue(analysisResult);
      mockPrioritizer.prioritize.mockReturnValue(prioritizedWork);

      const proposal1 = await consultant.analyzeSelfAndPropose();
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const proposal2 = await consultant.analyzeSelfAndPropose();

      expect(consultant.getPendingProposals()).toHaveLength(2);
      expect(consultant.getProposal(proposal1!.id)).toEqual(proposal1);
      expect(consultant.getProposal(proposal2!.id)).toEqual(proposal2);
      expect(proposal1!.id).not.toEqual(proposal2!.id); // Different IDs
    });

    it('should track proposal history', async () => {
      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Improvement 1',
          suggestion: 'Suggestion 1',
          location: 'file1.ts:10',
          estimatedImpact: 80,
        },
      ];

      const analysisResult: SelfAnalysisResult = {
        timestamp: Date.now(),
        issues: [],
        debt: [],
        improvements,
        metrics: {
          totalFiles: 10,
          totalLines: 1000,
          averageComplexity: 5,
          testCoverage: 80,
          qualityScore: 85,
        },
      };

      const prioritizedWork: PrioritizedWork = {
        allTasks: [
          {
            id: 'self-improvement-quality-file1.ts:10',
            description: 'Improvement 1',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        scores: [],
        selfImprovements: [
          {
            id: 'self-improvement-quality-file1.ts:10',
            description: 'Improvement 1',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        projectWork: [],
        selfImprovementRatio: 1.0,
        roiMetrics: {
          totalROI: 15,
          averageROI: 15,
          highROICount: 1,
        },
      };

      mockSelfAnalyzer.runAnalysis.mockResolvedValue(analysisResult);
      mockPrioritizer.prioritize.mockReturnValue(prioritizedWork);

      const proposal = await consultant.analyzeSelfAndPropose();

      const feedback: UserFeedback = {
        approved: false,
        comments: 'Not now',
      };

      await consultant.applyApprovedModification(proposal!.id, feedback);

      expect(consultant.getProposalHistory()).toHaveLength(1);
      expect(consultant.getProposalHistory()[0].approved).toBe(false);
    });

    it('should support targeting Prometheus repository', async () => {
      // Create a new consultant targeting Prometheus repo
      const prometheusConfig = {
        ...config,
        targetRepo: 'prometheus' as const,
      };

      // Create a separate mock workflow for Prometheus
      const mockPrometheusWorkflow = {
        ...mockAnotsWorkflow,
        createFeatureBranch: jest.fn(),
        applyChanges: jest.fn(),
        runTests: jest.fn(),
        generatePullRequest: jest.fn(),
      } as jest.Mocked<AnotsWorkflow>;

      const prometheusConsultant = new SelfModificationConsultant(
        prometheusConfig,
        mockSelfAnalyzer,
        mockPrioritizer,
        mockConsultationManager,
        mockAnotsWorkflow, // ANOTS workflow
        mockPrometheusWorkflow // Prometheus workflow (for testing)
      );

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Improve self-analyzer',
          suggestion: 'Refactor method',
          location: 'src/evolution/self-analyzer.ts:100',
          estimatedImpact: 80,
        },
      ];

      const analysisResult: SelfAnalysisResult = {
        timestamp: Date.now(),
        issues: [],
        debt: [],
        improvements,
        metrics: {
          totalFiles: 10,
          totalLines: 1000,
          averageComplexity: 5,
          testCoverage: 80,
          qualityScore: 85,
        },
      };

      const prioritizedWork: PrioritizedWork = {
        allTasks: [
          {
            id: 'self-improvement-quality-src/evolution/self-analyzer.ts:100',
            description: 'Improve self-analyzer',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        scores: [],
        selfImprovements: [
          {
            id: 'self-improvement-quality-src/evolution/self-analyzer.ts:100',
            description: 'Improve self-analyzer',
            type: 'self-improvement',
            effortHours: 5,
            metadata: {},
          },
        ],
        projectWork: [],
        selfImprovementRatio: 1.0,
        roiMetrics: {
          totalROI: 15,
          averageROI: 15,
          highROICount: 1,
        },
      };

      mockSelfAnalyzer.runAnalysis.mockResolvedValue(analysisResult);
      mockPrioritizer.prioritize.mockReturnValue(prioritizedWork);

      const proposal = await prometheusConsultant.analyzeSelfAndPropose();

      expect(proposal).not.toBeNull();
      expect(proposal!.improvements[0].location).toContain('self-analyzer.ts');

      const feedback: UserFeedback = {
        approved: true,
        comments: 'Good self-improvement',
      };

      mockPrometheusWorkflow.createFeatureBranch.mockResolvedValue({
        name: 'self-improvement/self-improvement-test',
        baseBranch: 'main',
        created: Date.now(),
        commitHash: 'abc123',
      });

      mockPrometheusWorkflow.applyChanges.mockResolvedValue(undefined);
      mockPrometheusWorkflow.runTests.mockResolvedValue({
        passed: true,
        output: 'All tests passed',
      });

      const mockPR: PullRequestInfo = {
        branch: 'self-improvement/self-improvement-test',
        title: '[Prometheus] Self-improvement (Prometheus (self)): quality',
        description: 'PR description for Prometheus repo',
        baseBranch: 'main',
        filesChanged: ['src/evolution/self-analyzer.ts'],
        testsRun: true,
        testsPassed: true,
      };

      mockPrometheusWorkflow.generatePullRequest.mockResolvedValue(mockPR);
      mockConsultationManager.buildConsultationRequest.mockReturnValue({
        decision: {
          id: `self-mod-${proposal!.id}`,
          description: 'Self-improvement',
          type: 'self-modification',
          change: {
            files: ['src/evolution/self-analyzer.ts'],
            description: 'Changes',
          },
          reasoning: 'Reasoning',
          timestamp: Date.now(),
        },
        triggers: ['self_modification'],
        impact: {
          affectedComponents: 1,
          estimatedEffort: 5,
          confidence: 0.8,
        },
        alternatives: [],
        recommendation: 'Proceed',
        pastDecisions: [],
        requestedAt: Date.now(),
      });

      const result = await prometheusConsultant.applyApprovedModification(
        proposal!.id,
        feedback
      );

      expect(result.approved).toBe(true);
      expect(result.pullRequest?.title).toContain('Prometheus (self)');
      expect(result.pullRequest?.filesChanged[0]).toContain('self-analyzer.ts');
    });
  });
});
