/**
 * Risk Evaluator
 * 
 * Evaluates risks for decisions and suggests mitigation strategies.
 * 
 * Task 34.1: Create risk identification
 * Task 34.2: Create risk mitigation suggestions
 * Task 34.3: Implement high-risk consultation requirement
 */

import { RuntimeExecutor } from '../runtime/runtime-executor';

/**
 * Risk severity levels
 */
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Individual risk
 */
export type Risk = {
  description: string;
  likelihood: number; // 0-100
  severity: RiskSeverity;
  category: string;
  mitigation?: string;
};

/**
 * Mitigation strategy for a risk
 */
export type MitigationStrategy = {
  risk: string;
  strategy: string;
  effort: number; // Hours
  effectiveness: number; // 0-100
};

/**
 * Complete risk evaluation
 */
export type RiskEvaluation = {
  risks: Risk[];
  overallRisk: RiskSeverity;
  requiresConsultation: boolean;
  mitigationStrategies: MitigationStrategy[];
  reasoning: string;
};

/**
 * Decision to evaluate
 */
export type Decision = {
  id: string;
  description: string;
  type: string;
  context?: Record<string, unknown>;
  change?: {
    type: string;
    files: string[];
    description: string;
  };
};

/**
 * Risk Evaluator
 * 
 * Identifies risks and suggests mitigation strategies for decisions.
 */
export class RiskEvaluator {
  constructor(private runtimeEngine: RuntimeExecutor) {}

  /**
   * Evaluate risks for a decision
   * 
   * @param decision - Decision to evaluate
   * @param context - Optional additional context
   * @returns Complete risk evaluation
   */
  async evaluateRisk(decision: Decision, context?: string): Promise<RiskEvaluation> {
    // Identify risks
    const risks = await this.identifyRisks(decision, context);

    // Determine overall risk level
    const overallRisk = this.calculateOverallRisk(risks);

    // Check if consultation is required
    const requiresConsultation = this.requiresConsultation(risks, overallRisk);

    // Generate mitigation strategies
    const mitigationStrategies = await this.generateMitigationStrategies(risks, decision);

    // Generate reasoning
    const reasoning = this.generateReasoning(risks, overallRisk, requiresConsultation);

    return {
      risks,
      overallRisk,
      requiresConsultation,
      mitigationStrategies,
      reasoning,
    };
  }

  /**
   * Identify risks for a decision
   * 
   * Uses LLM to identify potential risks.
   * 
   * @param decision - Decision to evaluate
   * @param context - Optional additional context
   * @returns Array of identified risks
   */
  async identifyRisks(decision: Decision, context?: string): Promise<Risk[]> {
    const prompt = this.buildRiskIdentificationPrompt(decision, context);

    try {
      const response = await this.runtimeEngine.execute({
        taskType: 'decision_making',
        prompt,
        context: 'You are a risk assessment expert. Identify potential risks objectively.',
        maxTokens: 500,
      });

      return this.parseRisks(response.content);
    } catch (error) {
      // Fallback to heuristic risk identification
      return this.heuristicRiskIdentification(decision);
    }
  }

  /**
   * Generate mitigation strategies for risks
   * 
   * @param risks - Identified risks
   * @param decision - Original decision
   * @returns Array of mitigation strategies
   */
  async generateMitigationStrategies(
    risks: Risk[],
    decision: Decision
  ): Promise<MitigationStrategy[]> {
    // Only generate strategies for medium and high risks
    const significantRisks = risks.filter(
      (r) => r.severity === 'medium' || r.severity === 'high' || r.severity === 'critical'
    );

    if (significantRisks.length === 0) {
      return [];
    }

    const prompt = this.buildMitigationPrompt(significantRisks, decision);

    try {
      const response = await this.runtimeEngine.execute({
        taskType: 'decision_making',
        prompt,
        context: 'You are a risk mitigation expert. Suggest practical mitigation strategies.',
        maxTokens: 400,
      });

      return this.parseMitigationStrategies(response.content, significantRisks);
    } catch (error) {
      // Fallback to basic mitigation strategies
      return this.heuristicMitigationStrategies(significantRisks);
    }
  }

  /**
   * Check if consultation is required
   * 
   * Consultation is required if:
   * - Any risk is high or critical severity
   * - Overall risk is high or critical
   * 
   * @param risks - Identified risks
   * @param overallRisk - Overall risk level
   * @returns True if consultation required
   */
  requiresConsultation(risks: Risk[], overallRisk: RiskSeverity): boolean {
    // Check for high or critical individual risks
    const hasHighRisk = risks.some((r) => r.severity === 'high' || r.severity === 'critical');

    // Check overall risk level
    const overallIsHigh = overallRisk === 'high' || overallRisk === 'critical';

    return hasHighRisk || overallIsHigh;
  }

  /**
   * Calculate overall risk level
   * 
   * Based on the highest severity risk and number of risks.
   */
  private calculateOverallRisk(risks: Risk[]): RiskSeverity {
    if (risks.length === 0) {
      return 'low';
    }

    // Find highest severity
    const severityLevels: Record<RiskSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    let maxSeverity: RiskSeverity = 'low';
    let maxLevel = 0;

    for (const risk of risks) {
      const level = severityLevels[risk.severity];
      if (level > maxLevel) {
        maxLevel = level;
        maxSeverity = risk.severity;
      }
    }

    // If we have multiple medium risks, escalate to high
    const mediumCount = risks.filter((r) => r.severity === 'medium').length;
    if (mediumCount >= 3 && maxSeverity === 'medium') {
      return 'high';
    }

    return maxSeverity;
  }

  /**
   * Build risk identification prompt
   */
  private buildRiskIdentificationPrompt(decision: Decision, context?: string): string {
    let prompt = `Identify potential risks for this decision:\n\n`;
    prompt += `Decision: ${decision.description}\n`;
    prompt += `Type: ${decision.type}\n`;

    if (decision.change) {
      prompt += `\nChange Details:\n`;
      prompt += `- Type: ${decision.change.type}\n`;
      prompt += `- Files: ${decision.change.files.join(', ')}\n`;
      prompt += `- Description: ${decision.change.description}\n`;
    }

    if (decision.context) {
      prompt += `\nContext:\n${JSON.stringify(decision.context, null, 2)}\n`;
    }

    if (context) {
      prompt += `\nAdditional Context:\n${context}\n`;
    }

    prompt += `\n**Risk Categories to Consider:**\n`;
    prompt += `- Technical: Breaking changes, compatibility issues, performance degradation\n`;
    prompt += `- Security: Vulnerabilities, data exposure, authentication issues\n`;
    prompt += `- Operational: Downtime, deployment issues, rollback complexity\n`;
    prompt += `- Business: User impact, revenue impact, reputation\n`;
    prompt += `- Maintenance: Increased complexity, technical debt, documentation\n\n`;

    prompt += `For each risk, provide:\n`;
    prompt += `1. Description of the risk\n`;
    prompt += `2. Likelihood (0-100)\n`;
    prompt += `3. Severity (low/medium/high/critical)\n`;
    prompt += `4. Category\n\n`;

    prompt += `Format each risk as:\n`;
    prompt += `RISK: [description]\n`;
    prompt += `LIKELIHOOD: [0-100]\n`;
    prompt += `SEVERITY: [low/medium/high/critical]\n`;
    prompt += `CATEGORY: [category]\n`;
    prompt += `---\n`;

    return prompt;
  }

  /**
   * Build mitigation strategy prompt
   */
  private buildMitigationPrompt(risks: Risk[], _decision: Decision): string {
    let prompt = `Suggest mitigation strategies for these risks:\n\n`;

    for (let i = 0; i < risks.length; i++) {
      const risk = risks[i];
      if (!risk) continue;
      
      prompt += `Risk ${i + 1}: ${risk.description}\n`;
      prompt += `Severity: ${risk.severity}\n`;
      prompt += `Likelihood: ${risk.likelihood}%\n\n`;
    }

    prompt += `For each risk, provide:\n`;
    prompt += `1. Mitigation strategy (specific actions)\n`;
    prompt += `2. Estimated effort in hours\n`;
    prompt += `3. Effectiveness (0-100)\n\n`;

    prompt += `Format each strategy as:\n`;
    prompt += `RISK: [risk description]\n`;
    prompt += `STRATEGY: [mitigation strategy]\n`;
    prompt += `EFFORT: [hours]\n`;
    prompt += `EFFECTIVENESS: [0-100]\n`;
    prompt += `---\n`;

    return prompt;
  }

  /**
   * Parse risks from LLM response
   */
  private parseRisks(response: string): Risk[] {
    const risks: Risk[] = [];
    const riskBlocks = response.split('---').filter((block) => block.trim());

    for (const block of riskBlocks) {
      const descMatch = block.match(/RISK:\s*(.+)/i);
      const likelihoodMatch = block.match(/LIKELIHOOD:\s*(\d+)/i);
      const severityMatch = block.match(/SEVERITY:\s*(low|medium|high|critical)/i);
      const categoryMatch = block.match(/CATEGORY:\s*(.+)/i);

      if (descMatch?.[1] && severityMatch?.[1]) {
        risks.push({
          description: descMatch[1].trim(),
          likelihood: likelihoodMatch?.[1] ? parseInt(likelihoodMatch[1]) : 50,
          severity: severityMatch[1].toLowerCase() as RiskSeverity,
          category: categoryMatch?.[1]?.trim() || 'general',
        });
      }
    }

    return risks;
  }

  /**
   * Parse mitigation strategies from LLM response
   */
  private parseMitigationStrategies(
    response: string,
    _risks: Risk[]
  ): MitigationStrategy[] {
    const strategies: MitigationStrategy[] = [];
    const strategyBlocks = response.split('---').filter((block) => block.trim());

    for (const block of strategyBlocks) {
      const riskMatch = block.match(/RISK:\s*(.+)/i);
      const strategyMatch = block.match(/STRATEGY:\s*(.+)/i);
      const effortMatch = block.match(/EFFORT:\s*(\d+\.?\d*)/i);
      const effectivenessMatch = block.match(/EFFECTIVENESS:\s*(\d+)/i);

      if (riskMatch?.[1] && strategyMatch?.[1]) {
        strategies.push({
          risk: riskMatch[1].trim(),
          strategy: strategyMatch[1].trim(),
          effort: effortMatch?.[1] ? parseFloat(effortMatch[1]) : 2,
          effectiveness: effectivenessMatch?.[1] ? parseInt(effectivenessMatch[1]) : 70,
        });
      }
    }

    return strategies;
  }

  /**
   * Heuristic risk identification (fallback)
   */
  private heuristicRiskIdentification(decision: Decision): Risk[] {
    const risks: Risk[] = [];

    // Check decision type
    if (decision.type === 'architectural') {
      risks.push({
        description: 'Architectural changes may introduce breaking changes',
        likelihood: 60,
        severity: 'high',
        category: 'technical',
      });
    }

    if (decision.type === 'security') {
      risks.push({
        description: 'Security changes require careful review to avoid vulnerabilities',
        likelihood: 50,
        severity: 'high',
        category: 'security',
      });
    }

    // Check change details
    if (decision.change) {
      if (decision.change.files.length > 10) {
        risks.push({
          description: 'Large number of files affected increases risk of unintended side effects',
          likelihood: 70,
          severity: 'medium',
          category: 'technical',
        });
      }

      if (decision.change.type === 'breaking') {
        risks.push({
          description: 'Breaking changes may affect existing functionality',
          likelihood: 80,
          severity: 'high',
          category: 'technical',
        });
      }
    }

    // Default risk if none identified
    if (risks.length === 0) {
      risks.push({
        description: 'Standard implementation risks apply',
        likelihood: 30,
        severity: 'low',
        category: 'general',
      });
    }

    return risks;
  }

  /**
   * Heuristic mitigation strategies (fallback)
   */
  private heuristicMitigationStrategies(risks: Risk[]): MitigationStrategy[] {
    return risks.map((risk) => ({
      risk: risk.description,
      strategy: this.getDefaultMitigation(risk.category),
      effort: 2,
      effectiveness: 70,
    }));
  }

  /**
   * Get default mitigation for a risk category
   */
  private getDefaultMitigation(category: string): string {
    const mitigations: Record<string, string> = {
      technical: 'Implement comprehensive testing and code review',
      security: 'Conduct security audit and penetration testing',
      operational: 'Create detailed deployment plan with rollback procedure',
      business: 'Communicate changes to stakeholders and gather feedback',
      maintenance: 'Document changes thoroughly and update architecture diagrams',
      general: 'Review changes carefully and test thoroughly',
    };

    return mitigations[category] ?? mitigations['general'] ?? 'Review changes carefully and test thoroughly';
  }

  /**
   * Generate reasoning for risk evaluation
   */
  private generateReasoning(
    risks: Risk[],
    overallRisk: RiskSeverity,
    requiresConsultation: boolean
  ): string {
    let reasoning = `Identified ${risks.length} risk(s). `;
    reasoning += `Overall risk level: ${overallRisk}. `;

    if (requiresConsultation) {
      reasoning += 'Consultation required due to high-risk factors. ';
    }

    const highRisks = risks.filter((r) => r.severity === 'high' || r.severity === 'critical');
    if (highRisks.length > 0) {
      reasoning += `${highRisks.length} high-severity risk(s) identified. `;
    }

    return reasoning;
  }
}

/**
 * Create a risk evaluator instance
 * 
 * @param runtimeEngine - Runtime engine for LLM calls
 * @returns Risk evaluator instance
 */
export function createRiskEvaluator(runtimeEngine: RuntimeExecutor): RiskEvaluator {
  return new RiskEvaluator(runtimeEngine);
}
