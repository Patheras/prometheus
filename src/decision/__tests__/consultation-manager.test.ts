/**
 * Consultation Manager Tests
 * 
 * Tests for consultation trigger logic, request building, and feedback incorporation.
 */

import {
  ConsultationManager,
  createConsultationManager,
  ConsultationTrigger,
  ImpactAssessment,
  Alternative,
  PastDecision,
  UserFeedback,
} from '../consultation-manager';
import { Decision, RiskEvaluation } from '../risk-evaluator';
import { PriorityScore } from '../priority-scorer';

describe('ConsultationManager', () => {
  let manager: ConsultationManager;

  beforeEach(() => {
    manager = createConsultationManager();
  });

  describe('shouldConsult', () => {
    it('should require consultation for high impact decisions', () => {
      const decision: Decision = {
        id: 'test-1',
        description: 'Large refactor',
        type: 'refactor',
        change: {
          files: ['file1.ts', 'file2.ts'],
          description: 'Refactor',
        },
      };

      const impact: ImpactAssessment = {
        affectedComponents: 10,
        estimatedEffort: 20,
        confidence: 0.8,
      };

      const result = manager.shouldConsult(decision, impact);

      expect(result.required).toBe(true);
      expect(result.triggers).toContain('high_impact');
    });

    it('should require consultation for high risk decisions', () => {
      const decision: Decision = {
        id: 'test-2',
        description: 'Security fix',
        type: 'bugfix',
        change: {
          files: ['auth.ts'],
          description: 'Fix security issue',
        },
      };

      const impact: ImpactAssessment = {
        affectedComponents: 2,
        estimatedEffort: 5,
        confidence: 0.9,
      };

      const riskEvaluation: RiskEvaluation = {
        decisionId: 'test-2',
        risks: [],
        mitigations: [],
        overallRisk: 'high',
        requiresConsultation: true,
        reasoning: 'High risk',
        evaluatedAt: Date.now(),
      };

      const result = manager.shouldConsult(decision, impact, riskEvaluation);

      expect(result.required).toBe(true);
      expect(result.triggers).toContain('high_risk');
    });

    it('should require consultation for architectural changes', () => {
      const decision: Decision = {
        id: 'test-3',
        description: 'Redesign architecture',
        type: 'architectural',
        change: {
          files: ['architecture.ts'],
          description: 'New architecture',
        },
      };

      const impact: ImpactAssessment = {
        affectedComponents: 3,
        estimatedEffort: 40,
        confidence: 0.7,
      };

      const result = manager.shouldConsult(decision, impact);

      expect(result.required).toBe(true);
      expect(result.triggers).toContain('architectural');
    });

    it('should require consultation for self-modification', () => {
      const decision: Decision = {
        id: 'test-4',
        description: 'Update Prometheus core',
        type: 'self-modification',
        change: {
          files: ['prometheus/core.ts'],
          description: 'Improve core',
        },
      };

      const impact: ImpactAssessment = {
        affectedComponents: 1,
        estimatedEffort: 10,
        confidence: 0.8,
      };

      const result = manager.shouldConsult(decision, impact);

      expect(result.required).toBe(true);
      expect(result.triggers).toContain('self_modification');
    });

    it('should require consultation for low confidence decisions', () => {
      const decision: Decision = {
        id: 'test-5',
        description: 'Uncertain change',
        type: 'refactor',
        change: {
          files: ['complex.ts'],
          description: 'Complex refactor',
        },
      };

      const impact: ImpactAssessment = {
        affectedComponents: 2,
        estimatedEffort: 15,
        confidence: 0.5, // Low confidence
      };

      const result = manager.shouldConsult(decision, impact);

      expect(result.required).toBe(true);
      expect(result.triggers).toContain('uncertainty');
    });

    it('should not require consultation for low impact, low risk decisions', () => {
      const decision: Decision = {
        id: 'test-6',
        description: 'Simple fix',
        type: 'bugfix',
        change: {
          files: ['utils.ts'],
          description: 'Fix typo',
        },
      };

      const impact: ImpactAssessment = {
        affectedComponents: 1,
        estimatedEffort: 1,
        confidence: 0.95,
      };

      const riskEvaluation: RiskEvaluation = {
        decisionId: 'test-6',
        risks: [],
        mitigations: [],
        overallRisk: 'low',
        requiresConsultation: false,
        reasoning: 'Low risk',
        evaluatedAt: Date.now(),
      };

      const result = manager.shouldConsult(decision, impact, riskEvaluation);

      expect(result.required).toBe(false);
      expect(result.triggers).toHaveLength(0);
    });

    it('should handle multiple triggers', () => {
      const decision: Decision = {
        id: 'test-7',
        description: 'Major architectural change',
        type: 'architectural',
        change: {
          files: Array.from({ length: 20 }, (_, i) => `file${i}.ts`),
          description: 'Major change',
        },
      };

      const impact: ImpactAssessment = {
        affectedComponents: 15,
        estimatedEffort: 100,
        confidence: 0.6,
      };

      const riskEvaluation: RiskEvaluation = {
        decisionId: 'test-7',
        risks: [],
        mitigations: [],
        overallRisk: 'high',
        requiresConsultation: true,
        reasoning: 'High risk',
        evaluatedAt: Date.now(),
      };

      const result = manager.shouldConsult(decision, impact, riskEvaluation);

      expect(result.required).toBe(true);
      expect(result.triggers.length).toBeGreaterThan(1);
      expect(result.triggers).toContain('high_impact');
      expect(result.triggers).toContain('high_risk');
      expect(result.triggers).toContain('architectural');
      expect(result.triggers).toContain('uncertainty');
    });
  });

  describe('buildConsultationRequest', () => {
    it('should build complete consultation request', () => {
      const decision: Decision = {
        id: 'test-8',
        description: 'Database migration',
        type: 'architectural',
        change: {
          files: ['db/schema.ts'],
          description: 'Migrate schema',
        },
      };

      const triggers: ConsultationTrigger[] = ['architectural', 'high_risk'];

      const impact: ImpactAssessment = {
        affectedComponents: 8,
        affectedUsers: 1000,
        estimatedEffort: 40,
        confidence: 0.75,
      };

      const riskEvaluation: RiskEvaluation = {
        decisionId: 'test-8',
        risks: [
          {
            description: 'Data loss',
            severity: 'critical',
            likelihood: 'possible',
            category: 'technical',
            impact: 'Permanent data loss',
          },
        ],
        mitigations: [],
        overallRisk: 'critical',
        requiresConsultation: true,
        reasoning: 'Critical risk',
        evaluatedAt: Date.now(),
      };

      const alternatives: Alternative[] = [
        {
          description: 'Gradual migration',
          pros: ['Lower risk', 'Reversible'],
          cons: ['Takes longer'],
          effort: 60,
        },
      ];

      const pastDecisions: PastDecision[] = [
        {
          id: 'past-1',
          description: 'Previous migration',
          outcome: 'success',
          lessonsLearned: 'Test thoroughly',
          timestamp: Date.now() - 86400000,
        },
      ];

      const request = manager.buildConsultationRequest(
        decision,
        triggers,
        impact,
        riskEvaluation,
        undefined,
        alternatives,
        pastDecisions
      );

      expect(request.decision).toBe(decision);
      expect(request.triggers).toEqual(triggers);
      expect(request.impact).toBe(impact);
      expect(request.riskEvaluation).toBe(riskEvaluation);
      expect(request.alternatives).toEqual(alternatives);
      expect(request.pastDecisions).toEqual(pastDecisions);
      expect(request.recommendation).toBeTruthy();
      expect(request.context).toBeTruthy();
      expect(request.requestedAt).toBeGreaterThan(0);
    });

    it('should generate appropriate recommendation for high risk', () => {
      const decision: Decision = {
        id: 'test-9',
        description: 'Critical fix',
        type: 'bugfix',
        change: {
          files: ['critical.ts'],
          description: 'Fix critical bug',
        },
      };

      const triggers: ConsultationTrigger[] = ['high_risk'];

      const impact: ImpactAssessment = {
        affectedComponents: 3,
        estimatedEffort: 10,
        confidence: 0.8,
      };

      const riskEvaluation: RiskEvaluation = {
        decisionId: 'test-9',
        risks: [],
        mitigations: [],
        overallRisk: 'critical',
        requiresConsultation: true,
        reasoning: 'Critical risk',
        evaluatedAt: Date.now(),
      };

      const request = manager.buildConsultationRequest(
        decision,
        triggers,
        impact,
        riskEvaluation
      );

      expect(request.recommendation).toContain('careful review');
    });

    it('should include context with all relevant information', () => {
      const decision: Decision = {
        id: 'test-10',
        description: 'Feature implementation',
        type: 'feature',
        change: {
          files: ['feature.ts', 'feature.test.ts'],
          description: 'New feature',
        },
      };

      const triggers: ConsultationTrigger[] = ['high_impact'];

      const impact: ImpactAssessment = {
        affectedComponents: 7,
        affectedUsers: 500,
        estimatedEffort: 30,
        confidence: 0.85,
      };

      const request = manager.buildConsultationRequest(decision, triggers, impact);

      expect(request.context).toContain('Feature implementation');
      expect(request.context).toContain('feature');
      expect(request.context).toContain('7');
      expect(request.context).toContain('500');
      expect(request.context).toContain('30 hours');
      expect(request.context).toContain('85%');
    });
  });

  describe('incorporateFeedback', () => {
    it('should update consultation patterns on approval', () => {
      const decision: Decision = {
        id: 'test-11',
        description: 'Refactor',
        type: 'refactor',
        change: {
          files: ['code.ts'],
          description: 'Refactor code',
        },
      };

      const triggers: ConsultationTrigger[] = ['high_impact'];

      const impact: ImpactAssessment = {
        affectedComponents: 6,
        estimatedEffort: 20,
        confidence: 0.8,
      };

      const request = manager.buildConsultationRequest(decision, triggers, impact);

      const feedback: UserFeedback = {
        approved: true,
        confidence: 90,
        comments: 'Looks good',
      };

      manager.incorporateFeedback(request, feedback);

      const stats = manager.getStatistics();
      expect(stats.totalPatterns).toBe(1);
      expect(stats.approvalRate).toBe(1);
    });

    it('should update consultation patterns on rejection', () => {
      const decision: Decision = {
        id: 'test-12',
        description: 'Risky change',
        type: 'refactor',
        change: {
          files: ['risky.ts'],
          description: 'Risky refactor',
        },
      };

      const triggers: ConsultationTrigger[] = ['high_risk'];

      const impact: ImpactAssessment = {
        affectedComponents: 4,
        estimatedEffort: 15,
        confidence: 0.7,
      };

      const request = manager.buildConsultationRequest(decision, triggers, impact);

      const feedback: UserFeedback = {
        approved: false,
        comments: 'Too risky',
        guidance: 'Need more testing',
      };

      manager.incorporateFeedback(request, feedback);

      const stats = manager.getStatistics();
      expect(stats.totalPatterns).toBe(1);
      expect(stats.approvalRate).toBe(0);
    });

    it('should track multiple patterns', () => {
      // First decision
      const decision1: Decision = {
        id: 'test-13',
        description: 'Change 1',
        type: 'refactor',
        change: {
          files: ['file1.ts'],
          description: 'Change 1',
        },
      };

      const request1 = manager.buildConsultationRequest(
        decision1,
        ['high_impact'],
        {
          affectedComponents: 6,
          estimatedEffort: 20,
          confidence: 0.8,
        }
      );

      manager.incorporateFeedback(request1, { approved: true });

      // Second decision
      const decision2: Decision = {
        id: 'test-14',
        description: 'Change 2',
        type: 'architectural',
        change: {
          files: ['file2.ts'],
          description: 'Change 2',
        },
      };

      const request2 = manager.buildConsultationRequest(
        decision2,
        ['architectural'],
        {
          affectedComponents: 10,
          estimatedEffort: 50,
          confidence: 0.7,
        }
      );

      manager.incorporateFeedback(request2, { approved: false });

      const stats = manager.getStatistics();
      expect(stats.totalPatterns).toBe(2);
      expect(stats.approvalRate).toBe(0.5);
    });

    it('should identify most common triggers', () => {
      // Create multiple consultations with different triggers
      for (let i = 0; i < 5; i++) {
        const decision: Decision = {
          id: `test-${15 + i}`,
          description: `Change ${i}`,
          type: 'refactor',
          change: {
            files: [`file${i}.ts`],
            description: `Change ${i}`,
          },
        };

        const request = manager.buildConsultationRequest(
          decision,
          ['high_impact'],
          {
            affectedComponents: 6,
            estimatedEffort: 20,
            confidence: 0.8,
          }
        );

        manager.incorporateFeedback(request, { approved: true });
      }

      const stats = manager.getStatistics();
      expect(stats.mostCommonTriggers).toContain('high_impact');
    });
  });

  describe('getStatistics', () => {
    it('should return zero statistics for no patterns', () => {
      const stats = manager.getStatistics();

      expect(stats.totalPatterns).toBe(0);
      expect(stats.approvalRate).toBe(0);
      expect(stats.mostCommonTriggers).toHaveLength(0);
    });

    it('should calculate approval rate correctly', () => {
      // Add 3 approved, 2 rejected
      for (let i = 0; i < 5; i++) {
        const decision: Decision = {
          id: `test-${20 + i}`,
          description: `Change ${i}`,
          type: 'refactor',
          change: {
            files: [`file${i}.ts`],
            description: `Change ${i}`,
          },
        };

        const request = manager.buildConsultationRequest(
          decision,
          ['high_impact'],
          {
            affectedComponents: 6,
            estimatedEffort: 20,
            confidence: 0.8,
          }
        );

        manager.incorporateFeedback(request, { approved: i < 3 });
      }

      const stats = manager.getStatistics();
      expect(stats.totalPatterns).toBe(5);
      expect(stats.approvalRate).toBeCloseTo(0.6, 1);
    });
  });

  describe('reset', () => {
    it('should clear all patterns and preferences', () => {
      const decision: Decision = {
        id: 'test-25',
        description: 'Test',
        type: 'refactor',
        change: {
          files: ['test.ts'],
          description: 'Test',
        },
      };

      const request = manager.buildConsultationRequest(
        decision,
        ['high_impact'],
        {
          affectedComponents: 6,
          estimatedEffort: 20,
          confidence: 0.8,
        }
      );

      manager.incorporateFeedback(request, { approved: true });

      expect(manager.getStatistics().totalPatterns).toBe(1);

      manager.reset();

      expect(manager.getStatistics().totalPatterns).toBe(0);
    });
  });
});
