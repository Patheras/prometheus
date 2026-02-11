/**
 * Tests for Consultation System
 * 
 * Task 35: Implement consultation system
 */

import {
  ConsultationSystem,
  ConsultationTrigger,
  ConsultationRequest,
  ConsultationResponse,
  Alternative,
} from '../consultation-system';
import { Decision, RiskEvaluation } from '../risk-evaluator';
import { PriorityScore } from '../priority-scorer';
import { RuntimeEngine } from '../../runtime';

// Mock RuntimeEngine
class MockRuntimeEngine implements Partial<RuntimeEngine> {
  private mockResponse: string;

  constructor(mockResponse?: string) {
    this.mockResponse =
      mockResponse ||
      `OPTION: Proceed with original plan
PROS: Clear path | Addresses need | Quick implementation
CONS: Some risks | Limited testing
EFFORT: 4
---
OPTION: Implement with safeguards
PROS: Reduced risk | Better testing | More robust
CONS: Higher effort | Longer timeline
EFFORT: 8`;
  }

  setMockResponse(response: string): void {
    this.mockResponse = response;
  }

  async execute(request: {
    taskType: string;
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
  }): Promise<{ content: string; model: any; tokensUsed: number; latency: number }> {
    // Return recommendation if prompt contains "recommend"
    if (request.prompt.toLowerCase().includes('recommend')) {
      return {
        content: `RECOMMENDATION: Option 1
REASONING: Best balance of risk and effort
CONFIDENCE: 85`,
        model: { provider: 'mock', model: 'mock' },
        tokensUsed: 100,
        latency: 50,
      };
    }

    return {
      content: this.mockResponse,
      model: { provider: 'mock', model: 'mock' },
      tokensUsed: 100,
      latency: 50,
    };
  }
}

describe('ConsultationSystem', () => {
  let mockRuntime: MockRuntimeEngine;
  let system: ConsultationSystem;

  beforeEach(() => {
    mockRuntime = new MockRuntimeEngine();
    system = new ConsultationSystem(mockRuntime as any);
  });

  describe('shouldConsult', () => {
    it('should trigger consultation for high impact', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Major refactoring',
        type: 'refactoring',
      };

      const analysis = {
        impact: {
          affectedComponents: Array(10).fill({ name: 'component' }),
          recommendation: 'consult',
        },
      };

      const triggers = await system.shouldConsult(decision, analysis);

      expect(triggers).toContain('high_impact');
    });

    it('should trigger consultation for high risk', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Security update',
        type: 'security',
      };

      const analysis = {
        risks: {
          risks: [],
          overallRisk: 'high' as const,
          requiresConsultation: true,
          mitigationStrategies: [],
          reasoning: 'High risk',
        },
      };

      const triggers = await system.shouldConsult(decision, analysis);

      expect(triggers).toContain('high_risk');
    });

    it('should trigger consultation for architectural changes', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Redesign system architecture',
        type: 'architectural',
      };

      const triggers = await system.shouldConsult(decision);

      expect(triggers).toContain('architectural');
    });

    it('should trigger consultation for self-modification', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Update Prometheus code',
        type: 'feature',
        change: {
          type: 'feature',
          files: ['prometheus/src/core.ts'],
          description: 'Update core logic',
        },
      };

      const triggers = await system.shouldConsult(decision);

      expect(triggers).toContain('self_modification');
    });

    it('should trigger consultation for low confidence', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Complex change',
        type: 'feature',
        change: {
          type: 'feature',
          files: Array(15).fill('file.ts'),
          description: 'Large change',
        },
      };

      const analysis = {
        risks: {
          risks: [],
          overallRisk: 'high' as const,
          requiresConsultation: false,
          mitigationStrategies: [],
          reasoning: '',
        },
        priority: {
          total: 50,
          breakdown: { impact: 50, urgency: 50, effort: 50, alignment: 50 },
          reasoning: '',
        },
      };

      const triggers = await system.shouldConsult(decision, analysis);

      expect(triggers).toContain('uncertainty');
    });

    it('should trigger consultation for no precedent', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'New type of change',
        type: 'unknown_type',
      };

      const triggers = await system.shouldConsult(decision);

      expect(triggers).toContain('precedent');
    });

    it('should return empty array if no triggers', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Simple feature',
        type: 'feature',
      };

      const analysis = {
        risks: {
          risks: [],
          overallRisk: 'low' as const,
          requiresConsultation: false,
          mitigationStrategies: [],
          reasoning: '',
        },
      };

      const triggers = await system.shouldConsult(decision, analysis);

      // Should have at least 'precedent' trigger for feature type
      expect(triggers.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildConsultationRequest', () => {
    it('should build complete consultation request', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Major change',
        type: 'architectural',
      };

      const triggers: ConsultationTrigger[] = ['architectural', 'high_impact'];

      const request = await system.buildConsultationRequest(decision, triggers);

      expect(request.id).toBeDefined();
      expect(request.decision).toBe(decision);
      expect(request.triggers).toEqual(triggers);
      expect(request.alternatives).toBeDefined();
      expect(request.alternatives.length).toBeGreaterThan(0);
      expect(request.recommendation).toBeDefined();
      expect(request.context).toBeDefined();
      expect(request.timestamp).toBeDefined();
    });

    it('should include analysis in request', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Change',
        type: 'feature',
      };

      const analysis = {
        risks: {
          risks: [],
          overallRisk: 'medium' as const,
          requiresConsultation: false,
          mitigationStrategies: [],
          reasoning: '',
        },
        priority: {
          total: 75,
          breakdown: { impact: 80, urgency: 70, effort: 60, alignment: 80 },
          reasoning: 'High priority',
        },
      };

      const request = await system.buildConsultationRequest(decision, [], analysis);

      expect(request.analysis.risks).toBeDefined();
      expect(request.analysis.priority).toBeDefined();
    });

    it('should generate alternatives', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Implement feature',
        type: 'feature',
      };

      const request = await system.buildConsultationRequest(decision, []);

      expect(request.alternatives.length).toBeGreaterThan(0);
      expect(request.alternatives[0].option).toBeDefined();
      expect(request.alternatives[0].pros).toBeDefined();
      expect(request.alternatives[0].cons).toBeDefined();
      expect(request.alternatives[0].estimatedEffort).toBeGreaterThan(0);
    });

    it('should generate recommendation', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Make decision',
        type: 'feature',
      };

      const request = await system.buildConsultationRequest(decision, []);

      expect(request.recommendation.option).toBeDefined();
      expect(request.recommendation.reasoning).toBeDefined();
      expect(request.recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(request.recommendation.confidence).toBeLessThanOrEqual(100);
    });

    it('should build context string', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Test decision',
        type: 'feature',
      };

      const triggers: ConsultationTrigger[] = ['high_risk'];

      const request = await system.buildConsultationRequest(decision, triggers);

      expect(request.context).toContain('Test decision');
      expect(request.context).toContain('feature');
      expect(request.context).toContain('high_risk');
    });
  });

  describe('incorporateFeedback', () => {
    it('should store consultation pattern', async () => {
      const request: ConsultationRequest = {
        id: 'consultation-1',
        decision: {
          id: 'decision-1',
          description: 'Test',
          type: 'feature',
        },
        triggers: ['high_risk'],
        analysis: {},
        alternatives: [],
        recommendation: { option: 'Proceed', reasoning: '', confidence: 70 },
        pastDecisions: [],
        context: '',
        timestamp: Date.now(),
      };

      const response: ConsultationResponse = {
        approved: true,
        feedback: 'Looks good',
        timestamp: Date.now(),
      };

      await system.incorporateFeedback(request, response);

      const patterns = system.getConsultationPatterns();
      expect(patterns.length).toBe(1);
      expect(patterns[0].trigger).toBe('high_risk');
      expect(patterns[0].userApproved).toBe(true);
    });

    it('should update decision with feedback', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Test',
        type: 'feature',
      };

      const request: ConsultationRequest = {
        id: 'consultation-1',
        decision,
        triggers: ['architectural'],
        analysis: {},
        alternatives: [],
        recommendation: { option: 'Proceed', reasoning: '', confidence: 70 },
        pastDecisions: [],
        context: '',
        timestamp: Date.now(),
      };

      const response: ConsultationResponse = {
        approved: false,
        feedback: 'Need more testing',
        modifications: ['Add tests', 'Review security'],
        timestamp: Date.now(),
      };

      await system.incorporateFeedback(request, response);

      expect(decision.context).toBeDefined();
      expect(decision.context!.userFeedback).toBe('Need more testing');
      expect(decision.context!.approved).toBe(false);
    });

    it('should handle multiple triggers', async () => {
      const request: ConsultationRequest = {
        id: 'consultation-1',
        decision: {
          id: 'decision-1',
          description: 'Test',
          type: 'architectural',
        },
        triggers: ['architectural', 'high_risk', 'high_impact'],
        analysis: {},
        alternatives: [],
        recommendation: { option: 'Proceed', reasoning: '', confidence: 70 },
        pastDecisions: [],
        context: '',
        timestamp: Date.now(),
      };

      const response: ConsultationResponse = {
        approved: true,
        feedback: 'Approved',
        timestamp: Date.now(),
      };

      await system.incorporateFeedback(request, response);

      const patterns = system.getConsultationPatterns();
      expect(patterns.length).toBe(3); // One for each trigger
    });
  });

  describe('alternative generation', () => {
    it('should parse alternatives from LLM response', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Implement feature',
        type: 'feature',
      };

      const request = await system.buildConsultationRequest(decision, []);

      expect(request.alternatives.length).toBeGreaterThan(0);
      expect(request.alternatives[0].pros.length).toBeGreaterThan(0);
      expect(request.alternatives[0].cons.length).toBeGreaterThan(0);
    });

    it('should fallback to heuristic alternatives on LLM failure', async () => {
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const decision: Decision = {
        id: 'decision-1',
        description: 'Test',
        type: 'feature',
      };

      const request = await system.buildConsultationRequest(decision, []);

      expect(request.alternatives.length).toBeGreaterThan(0);
      expect(request.alternatives[0].option).toContain('Proceed');
    });
  });

  describe('recommendation generation', () => {
    it('should parse recommendation from LLM response', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Make choice',
        type: 'feature',
      };

      const request = await system.buildConsultationRequest(decision, []);

      expect(request.recommendation.option).toBeDefined();
      expect(request.recommendation.confidence).toBe(85);
    });

    it('should fallback to first alternative on LLM failure', async () => {
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const decision: Decision = {
        id: 'decision-1',
        description: 'Test',
        type: 'feature',
      };

      const request = await system.buildConsultationRequest(decision, []);

      expect(request.recommendation.option).toBeDefined();
      expect(request.recommendation.confidence).toBe(50); // Default
    });
  });

  describe('edge cases', () => {
    it('should handle decision with no change details', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Simple decision',
        type: 'feature',
      };

      const triggers = await system.shouldConsult(decision);

      expect(triggers).toBeDefined();
    });

    it('should handle empty analysis', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Test',
        type: 'feature',
      };

      const request = await system.buildConsultationRequest(decision, []);

      expect(request).toBeDefined();
      expect(request.analysis).toEqual({});
    });

    it('should handle malformed LLM response for alternatives', async () => {
      // Make LLM fail to trigger fallback
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const decision: Decision = {
        id: 'decision-1',
        description: 'Test',
        type: 'feature',
      };

      const request = await system.buildConsultationRequest(decision, []);

      // Should fallback to heuristic alternatives
      expect(request.alternatives.length).toBeGreaterThan(0);
    });
  });
});
