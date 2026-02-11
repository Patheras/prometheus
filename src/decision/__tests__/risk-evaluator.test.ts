/**
 * Tests for Risk Evaluator
 * 
 * Task 34: Implement risk evaluation system
 */

import {
  RiskEvaluator,
  Decision,
  Risk,
  RiskSeverity,
  MitigationStrategy,
} from '../risk-evaluator';
import { RuntimeEngine } from '../../runtime';

// Mock RuntimeEngine
class MockRuntimeEngine implements Partial<RuntimeEngine> {
  private mockResponse: string;

  constructor(mockResponse?: string) {
    this.mockResponse =
      mockResponse ||
      `RISK: Breaking changes may affect existing functionality
LIKELIHOOD: 70
SEVERITY: high
CATEGORY: technical
---
RISK: Insufficient test coverage
LIKELIHOOD: 50
SEVERITY: medium
CATEGORY: technical`;
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
    // Return mitigation strategies if prompt contains "mitigation"
    if (request.prompt.toLowerCase().includes('mitigation')) {
      return {
        content: `RISK: Breaking changes may affect existing functionality
STRATEGY: Implement comprehensive integration tests and staged rollout
EFFORT: 8
EFFECTIVENESS: 85
---
RISK: Insufficient test coverage
STRATEGY: Add unit tests for all new functionality
EFFORT: 4
EFFECTIVENESS: 90`,
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

describe('RiskEvaluator', () => {
  let mockRuntime: MockRuntimeEngine;
  let evaluator: RiskEvaluator;

  beforeEach(() => {
    mockRuntime = new MockRuntimeEngine();
    evaluator = new RiskEvaluator(mockRuntime as any);
  });

  describe('identifyRisks', () => {
    it('should identify risks using LLM', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Refactor authentication system',
        type: 'architectural',
      };

      const risks = await evaluator.identifyRisks(decision);

      expect(risks).toHaveLength(2);
      expect(risks[0].description).toContain('Breaking changes');
      expect(risks[0].severity).toBe('high');
      expect(risks[0].likelihood).toBe(70);
      expect(risks[1].severity).toBe('medium');
    });

    it('should parse risk categories', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Update security protocols',
        type: 'security',
      };

      const risks = await evaluator.identifyRisks(decision);

      expect(risks[0].category).toBe('technical');
    });

    it('should handle decision with change details', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Major refactoring',
        type: 'architectural',
        change: {
          type: 'breaking',
          files: ['auth.ts', 'user.ts', 'session.ts'],
          description: 'Refactor authentication flow',
        },
      };

      const risks = await evaluator.identifyRisks(decision);

      expect(risks).toBeDefined();
      expect(risks.length).toBeGreaterThan(0);
    });

    it('should handle additional context', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Deploy new feature',
        type: 'feature',
      };

      const context = 'This feature affects 10,000 users';

      const risks = await evaluator.identifyRisks(decision, context);

      expect(risks).toBeDefined();
    });

    it('should fallback to heuristic identification on LLM failure', async () => {
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const decision: Decision = {
        id: 'decision-1',
        description: 'Architectural change',
        type: 'architectural',
      };

      const risks = await evaluator.identifyRisks(decision);

      expect(risks).toBeDefined();
      expect(risks.length).toBeGreaterThan(0);
      expect(risks[0].description).toContain('Architectural changes');
    });

    it('should identify security risks for security decisions', async () => {
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const decision: Decision = {
        id: 'decision-1',
        description: 'Update authentication',
        type: 'security',
      };

      const risks = await evaluator.identifyRisks(decision);

      const securityRisk = risks.find((r) => r.category === 'security');
      expect(securityRisk).toBeDefined();
      expect(securityRisk!.severity).toBe('high');
    });

    it('should identify risks for large file changes', async () => {
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const decision: Decision = {
        id: 'decision-1',
        description: 'Large refactoring',
        type: 'refactoring',
        change: {
          type: 'refactoring',
          files: Array(15).fill('file.ts'),
          description: 'Refactor multiple modules',
        },
      };

      const risks = await evaluator.identifyRisks(decision);

      const largeChangeRisk = risks.find((r) => r.description.includes('Large number'));
      expect(largeChangeRisk).toBeDefined();
    });

    it('should identify breaking change risks', async () => {
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const decision: Decision = {
        id: 'decision-1',
        description: 'API update',
        type: 'feature',
        change: {
          type: 'breaking',
          files: ['api.ts'],
          description: 'Update API endpoints',
        },
      };

      const risks = await evaluator.identifyRisks(decision);

      const breakingRisk = risks.find((r) => r.description.includes('Breaking changes'));
      expect(breakingRisk).toBeDefined();
      expect(breakingRisk!.severity).toBe('high');
    });
  });

  describe('generateMitigationStrategies', () => {
    it('should generate mitigation strategies for risks', async () => {
      const risks: Risk[] = [
        {
          description: 'Breaking changes may affect existing functionality',
          likelihood: 70,
          severity: 'high',
          category: 'technical',
        },
        {
          description: 'Insufficient test coverage',
          likelihood: 50,
          severity: 'medium',
          category: 'technical',
        },
      ];

      const decision: Decision = {
        id: 'decision-1',
        description: 'Refactor system',
        type: 'architectural',
      };

      const strategies = await evaluator.generateMitigationStrategies(risks, decision);

      expect(strategies).toHaveLength(2);
      expect(strategies[0].strategy).toContain('integration tests');
      expect(strategies[0].effort).toBe(8);
      expect(strategies[0].effectiveness).toBe(85);
    });

    it('should only generate strategies for medium+ risks', async () => {
      const risks: Risk[] = [
        {
          description: 'Low risk issue',
          likelihood: 20,
          severity: 'low',
          category: 'general',
        },
      ];

      const decision: Decision = {
        id: 'decision-1',
        description: 'Minor change',
        type: 'feature',
      };

      const strategies = await evaluator.generateMitigationStrategies(risks, decision);

      expect(strategies).toHaveLength(0);
    });

    it('should fallback to heuristic strategies on LLM failure', async () => {
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const risks: Risk[] = [
        {
          description: 'Technical risk',
          likelihood: 60,
          severity: 'high',
          category: 'technical',
        },
      ];

      const decision: Decision = {
        id: 'decision-1',
        description: 'Change',
        type: 'feature',
      };

      const strategies = await evaluator.generateMitigationStrategies(risks, decision);

      expect(strategies).toHaveLength(1);
      expect(strategies[0].strategy).toContain('testing');
    });

    it('should provide category-specific mitigation strategies', async () => {
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const risks: Risk[] = [
        {
          description: 'Security vulnerability',
          likelihood: 70,
          severity: 'high',
          category: 'security',
        },
        {
          description: 'Operational issue',
          likelihood: 60,
          severity: 'medium',
          category: 'operational',
        },
      ];

      const decision: Decision = {
        id: 'decision-1',
        description: 'Change',
        type: 'feature',
      };

      const strategies = await evaluator.generateMitigationStrategies(risks, decision);

      expect(strategies[0].strategy).toContain('security audit');
      expect(strategies[1].strategy).toContain('deployment plan');
    });
  });

  describe('requiresConsultation', () => {
    it('should require consultation for high severity risks', () => {
      const risks: Risk[] = [
        {
          description: 'High risk',
          likelihood: 70,
          severity: 'high',
          category: 'technical',
        },
      ];

      const result = evaluator.requiresConsultation(risks, 'medium');

      expect(result).toBe(true);
    });

    it('should require consultation for critical severity risks', () => {
      const risks: Risk[] = [
        {
          description: 'Critical risk',
          likelihood: 80,
          severity: 'critical',
          category: 'security',
        },
      ];

      const result = evaluator.requiresConsultation(risks, 'medium');

      expect(result).toBe(true);
    });

    it('should require consultation for high overall risk', () => {
      const risks: Risk[] = [
        {
          description: 'Medium risk',
          likelihood: 50,
          severity: 'medium',
          category: 'technical',
        },
      ];

      const result = evaluator.requiresConsultation(risks, 'high');

      expect(result).toBe(true);
    });

    it('should not require consultation for low risks', () => {
      const risks: Risk[] = [
        {
          description: 'Low risk',
          likelihood: 20,
          severity: 'low',
          category: 'general',
        },
      ];

      const result = evaluator.requiresConsultation(risks, 'low');

      expect(result).toBe(false);
    });

    it('should not require consultation for medium risks only', () => {
      const risks: Risk[] = [
        {
          description: 'Medium risk',
          likelihood: 50,
          severity: 'medium',
          category: 'technical',
        },
      ];

      const result = evaluator.requiresConsultation(risks, 'medium');

      expect(result).toBe(false);
    });
  });

  describe('evaluateRisk', () => {
    it('should provide complete risk evaluation', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Major refactoring',
        type: 'architectural',
      };

      const evaluation = await evaluator.evaluateRisk(decision);

      expect(evaluation.risks).toBeDefined();
      expect(evaluation.overallRisk).toBeDefined();
      expect(evaluation.requiresConsultation).toBeDefined();
      expect(evaluation.mitigationStrategies).toBeDefined();
      expect(evaluation.reasoning).toBeDefined();
    });

    it('should calculate overall risk correctly', async () => {
      mockRuntime.setMockResponse(`RISK: High severity risk
LIKELIHOOD: 80
SEVERITY: high
CATEGORY: technical`);

      const decision: Decision = {
        id: 'decision-1',
        description: 'Risky change',
        type: 'feature',
      };

      const evaluation = await evaluator.evaluateRisk(decision);

      expect(evaluation.overallRisk).toBe('high');
      expect(evaluation.requiresConsultation).toBe(true);
    });

    it('should escalate multiple medium risks to high', async () => {
      mockRuntime.setMockResponse(`RISK: Risk 1
LIKELIHOOD: 50
SEVERITY: medium
CATEGORY: technical
---
RISK: Risk 2
LIKELIHOOD: 50
SEVERITY: medium
CATEGORY: technical
---
RISK: Risk 3
LIKELIHOOD: 50
SEVERITY: medium
CATEGORY: technical`);

      const decision: Decision = {
        id: 'decision-1',
        description: 'Complex change',
        type: 'feature',
      };

      const evaluation = await evaluator.evaluateRisk(decision);

      expect(evaluation.overallRisk).toBe('high');
    });

    it('should generate reasoning', async () => {
      const decision: Decision = {
        id: 'decision-1',
        description: 'Change',
        type: 'feature',
      };

      const evaluation = await evaluator.evaluateRisk(decision);

      expect(evaluation.reasoning).toContain('Identified');
      expect(evaluation.reasoning).toContain('risk');
    });

    it('should handle no risks identified', async () => {
      mockRuntime.setMockResponse('No significant risks identified');

      const decision: Decision = {
        id: 'decision-1',
        description: 'Safe change',
        type: 'feature',
      };

      const evaluation = await evaluator.evaluateRisk(decision);

      expect(evaluation.risks).toHaveLength(0);
      expect(evaluation.overallRisk).toBe('low');
      expect(evaluation.requiresConsultation).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed LLM response', async () => {
      mockRuntime.setMockResponse('Invalid response format');

      const decision: Decision = {
        id: 'decision-1',
        description: 'Change',
        type: 'feature',
      };

      const risks = await evaluator.identifyRisks(decision);

      // Should return empty array for unparseable response
      expect(risks).toHaveLength(0);
    });

    it('should handle partial risk information', async () => {
      mockRuntime.setMockResponse(`RISK: Incomplete risk
SEVERITY: high`);

      const decision: Decision = {
        id: 'decision-1',
        description: 'Change',
        type: 'feature',
      };

      const risks = await evaluator.identifyRisks(decision);

      expect(risks).toHaveLength(1);
      expect(risks[0].likelihood).toBe(50); // Default value
      expect(risks[0].category).toBe('general'); // Default value
    });

    it('should handle decision with no type', async () => {
      mockRuntime.execute = async () => {
        throw new Error('LLM unavailable');
      };

      const decision: Decision = {
        id: 'decision-1',
        description: 'Change',
        type: '',
      };

      const risks = await evaluator.identifyRisks(decision);

      expect(risks).toBeDefined();
    });
  });
});
