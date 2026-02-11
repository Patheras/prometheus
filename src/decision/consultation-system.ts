/**
 * Consultation System
 * 
 * Manages consultation requests and user feedback incorporation.
 * 
 * Task 35.1: Create consultation trigger logic
 * Task 35.2: Create consultation request builder
 * Task 35.3: Implement feedback incorporation
 */

import { RuntimeEngine } from '../runtime';
import { Decision, Risk, RiskEvaluation } from './risk-evaluator';
import { PriorityScore } from './priority-scorer';

/**
 * Consultation trigger types
 */
export type ConsultationTrigger =
  | 'high_impact'
  | 'high_risk'
  | 'architectural'
  | 'self_modification'
  | 'user_preference'
  | 'uncertainty'
  | 'precedent';

/**
 * Consultation request
 */
export type ConsultationRequest = {
  id: string;
  decision: Decision;
  triggers: ConsultationTrigger[];
  analysis: {
    risks?: RiskEvaluation;
    priority?: PriorityScore;
    impact?: any;
  };
  alternatives: Alternative[];
  recommendation: Recommendation;
  pastDecisions: Decision[];
  context: string;
  timestamp: number;
};

/**
 * Alternative option
 */
export type Alternative = {
  option: string;
  pros: string[];
  cons: string[];
  estimatedEffort: number;
  risks: Risk[];
};

/**
 * Recommendation
 */
export type Recommendation = {
  option: string;
  reasoning: string;
  confidence: number; // 0-100
};

/**
 * Consultation response from user
 */
export type ConsultationResponse = {
  approved: boolean;
  feedback: string;
  modifications?: string[];
  selectedAlternative?: string;
  timestamp: number;
};

/**
 * Consultation pattern for learning
 */
export type ConsultationPattern = {
  trigger: ConsultationTrigger;
  decisionType: string;
  userApproved: boolean;
  feedback: string;
  timestamp: number;
};

/**
 * Consultation System
 * 
 * Determines when to consult users and builds consultation requests.
 */
export class ConsultationSystem {
  private consultationPatterns: ConsultationPattern[] = [];

  constructor(private runtimeEngine: RuntimeEngine) {}

  /**
   * Check if consultation is needed for a decision
   * 
   * @param decision - Decision to evaluate
   * @param analysis - Optional analysis results
   * @returns Array of triggered consultation reasons
   */
  async shouldConsult(
    decision: Decision,
    analysis?: {
      risks?: RiskEvaluation;
      priority?: PriorityScore;
      impact?: any;
    }
  ): Promise<ConsultationTrigger[]> {
    const triggers: ConsultationTrigger[] = [];

    // Check high impact
    if (analysis?.impact) {
      if (this.isHighImpact(analysis.impact)) {
        triggers.push('high_impact');
      }
    }

    // Check high risk
    if (analysis?.risks) {
      if (analysis.risks.requiresConsultation) {
        triggers.push('high_risk');
      }
    }

    // Check if architectural
    if (decision.type === 'architectural') {
      triggers.push('architectural');
    }

    // Check if self-modification
    if (this.isSelfModification(decision)) {
      triggers.push('self_modification');
    }

    // Check confidence/uncertainty
    if (analysis?.priority) {
      const confidence = await this.estimateConfidence(decision, analysis);
      if (confidence < 70) {
        triggers.push('uncertainty');
      }
    }

    // Check for precedent
    const hasPrecedent = await this.hasPrecedent(decision);
    if (!hasPrecedent) {
      triggers.push('precedent');
    }

    // Check user preference patterns
    if (this.matchesUserPreference(decision)) {
      triggers.push('user_preference');
    }

    return triggers;
  }

  /**
   * Build a consultation request
   * 
   * @param decision - Decision requiring consultation
   * @param triggers - Consultation triggers
   * @param analysis - Analysis results
   * @returns Complete consultation request
   */
  async buildConsultationRequest(
    decision: Decision,
    triggers: ConsultationTrigger[],
    analysis?: {
      risks?: RiskEvaluation;
      priority?: PriorityScore;
      impact?: any;
    }
  ): Promise<ConsultationRequest> {
    // Generate alternatives
    const alternatives = await this.generateAlternatives(decision);

    // Generate recommendation
    const recommendation = await this.generateRecommendation(decision, alternatives, analysis);

    // Get past similar decisions
    const pastDecisions = await this.getPastDecisions(decision);

    // Build context
    const context = this.buildContext(decision, triggers, analysis);

    return {
      id: `consultation-${Date.now()}`,
      decision,
      triggers,
      analysis: analysis || {},
      alternatives,
      recommendation,
      pastDecisions,
      context,
      timestamp: Date.now(),
    };
  }

  /**
   * Incorporate user feedback
   * 
   * @param request - Original consultation request
   * @param response - User response
   */
  async incorporateFeedback(
    request: ConsultationRequest,
    response: ConsultationResponse
  ): Promise<void> {
    // Store consultation pattern for learning
    for (const trigger of request.triggers) {
      this.consultationPatterns.push({
        trigger,
        decisionType: request.decision.type,
        userApproved: response.approved,
        feedback: response.feedback,
        timestamp: response.timestamp,
      });
    }

    // Update decision with feedback
    request.decision.context = {
      ...request.decision.context,
      userFeedback: response.feedback,
      approved: response.approved,
      consultationId: request.id,
    };

    // Learn from feedback
    await this.learnFromFeedback(request, response);
  }

  /**
   * Check if impact is high
   */
  private isHighImpact(impact: any): boolean {
    if (!impact) return false;

    // Check affected components
    if (impact.affectedComponents && impact.affectedComponents.length > 5) {
      return true;
    }

    // Check recommendation
    if (impact.recommendation === 'consult') {
      return true;
    }

    return false;
  }

  /**
   * Check if decision involves self-modification
   */
  private isSelfModification(decision: Decision): boolean {
    if (!decision.change) return false;

    // Check if any files are in prometheus directory
    return decision.change.files.some(
      (file) => file.startsWith('prometheus/') || file.includes('prometheus')
    );
  }

  /**
   * Estimate confidence in decision
   */
  private async estimateConfidence(
    decision: Decision,
    analysis: any
  ): Promise<number> {
    // Start with base confidence
    let confidence = 70;

    // Reduce confidence for high risks
    if (analysis.risks && analysis.risks.overallRisk === 'high') {
      confidence -= 20;
    }

    // Reduce confidence for high complexity
    if (decision.change && decision.change.files.length > 10) {
      confidence -= 10;
    }

    // Increase confidence if we have precedent
    const hasPrecedent = await this.hasPrecedent(decision);
    if (hasPrecedent) {
      confidence += 10;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Check if we have precedent for this decision
   */
  private async hasPrecedent(decision: Decision): Promise<boolean> {
    // In a real implementation, this would query the memory engine
    // For now, return false for new decision types
    const knownTypes = ['feature', 'bug_fix', 'refactoring', 'optimization'];
    return knownTypes.includes(decision.type);
  }

  /**
   * Check if decision matches user preference patterns
   */
  private matchesUserPreference(decision: Decision): boolean {
    // Check consultation patterns
    const relevantPatterns = this.consultationPatterns.filter(
      (p) => p.decisionType === decision.type
    );

    if (relevantPatterns.length === 0) return false;

    // If user consistently wants consultation for this type, trigger it
    const consultationRate =
      relevantPatterns.filter((p) => p.userApproved).length / relevantPatterns.length;

    return consultationRate > 0.7;
  }

  /**
   * Generate alternative options
   */
  private async generateAlternatives(decision: Decision): Promise<Alternative[]> {
    const prompt = this.buildAlternativesPrompt(decision);

    try {
      const response = await this.runtimeEngine.execute({
        taskType: 'decision_making',
        prompt,
        systemPrompt: 'You are a decision analysis expert. Generate practical alternatives.',
        maxTokens: 400,
      });

      return this.parseAlternatives(response.content);
    } catch (error) {
      // Fallback to basic alternatives
      return this.heuristicAlternatives(decision);
    }
  }

  /**
   * Generate recommendation
   */
  private async generateRecommendation(
    decision: Decision,
    alternatives: Alternative[],
    analysis?: any
  ): Promise<Recommendation> {
    const prompt = this.buildRecommendationPrompt(decision, alternatives, analysis);

    try {
      const response = await this.runtimeEngine.execute({
        taskType: 'decision_making',
        prompt,
        systemPrompt: 'You are a decision advisor. Provide clear recommendations.',
        maxTokens: 300,
      });

      return this.parseRecommendation(response.content, alternatives);
    } catch (error) {
      // Fallback to first alternative
      return {
        option: alternatives[0]?.option || 'Proceed with original plan',
        reasoning: 'Default recommendation',
        confidence: 50,
      };
    }
  }

  /**
   * Get past similar decisions
   */
  private async getPastDecisions(decision: Decision): Promise<Decision[]> {
    // In a real implementation, this would query the memory engine
    // For now, return empty array
    return [];
  }

  /**
   * Build context string
   */
  private buildContext(
    decision: Decision,
    triggers: ConsultationTrigger[],
    analysis?: any
  ): string {
    let context = `Decision: ${decision.description}\n`;
    context += `Type: ${decision.type}\n`;
    context += `Consultation Triggers: ${triggers.join(', ')}\n\n`;

    if (analysis?.risks) {
      context += `Risk Level: ${analysis.risks.overallRisk}\n`;
      context += `Risks Identified: ${analysis.risks.risks.length}\n\n`;
    }

    if (analysis?.priority) {
      context += `Priority Score: ${analysis.priority.total}\n\n`;
    }

    return context;
  }

  /**
   * Learn from user feedback
   */
  private async learnFromFeedback(
    request: ConsultationRequest,
    response: ConsultationResponse
  ): Promise<void> {
    // Analyze feedback patterns
    const recentPatterns = this.consultationPatterns.slice(-10);

    // If user consistently approves without modifications, reduce consultation frequency
    const approvalRate =
      recentPatterns.filter((p) => p.userApproved && !response.modifications).length /
      recentPatterns.length;

    // Store learning insights (in a real implementation, this would update models)
    if (approvalRate > 0.8) {
      // User trusts our decisions - can reduce consultation frequency
    }
  }

  /**
   * Build alternatives prompt
   */
  private buildAlternativesPrompt(decision: Decision): string {
    let prompt = `Generate 2-3 alternative approaches for this decision:\n\n`;
    prompt += `Decision: ${decision.description}\n`;
    prompt += `Type: ${decision.type}\n`;

    if (decision.change) {
      prompt += `\nChange Details:\n`;
      prompt += `- Type: ${decision.change.type}\n`;
      prompt += `- Files: ${decision.change.files.join(', ')}\n`;
    }

    prompt += `\nFor each alternative, provide:\n`;
    prompt += `1. Option description\n`;
    prompt += `2. Pros (2-3 points)\n`;
    prompt += `3. Cons (2-3 points)\n`;
    prompt += `4. Estimated effort in hours\n\n`;

    prompt += `Format each alternative as:\n`;
    prompt += `OPTION: [description]\n`;
    prompt += `PROS: [pro1] | [pro2] | [pro3]\n`;
    prompt += `CONS: [con1] | [con2] | [con3]\n`;
    prompt += `EFFORT: [hours]\n`;
    prompt += `---\n`;

    return prompt;
  }

  /**
   * Build recommendation prompt
   */
  private buildRecommendationPrompt(
    decision: Decision,
    alternatives: Alternative[],
    analysis?: any
  ): string {
    let prompt = `Recommend the best option for this decision:\n\n`;
    prompt += `Decision: ${decision.description}\n\n`;

    prompt += `Alternatives:\n`;
    alternatives.forEach((alt, i) => {
      prompt += `${i + 1}. ${alt.option}\n`;
      prompt += `   Effort: ${alt.estimatedEffort} hours\n`;
    });

    if (analysis?.risks) {
      prompt += `\nRisk Level: ${analysis.risks.overallRisk}\n`;
    }

    prompt += `\nProvide:\n`;
    prompt += `RECOMMENDATION: [option number or description]\n`;
    prompt += `REASONING: [brief explanation]\n`;
    prompt += `CONFIDENCE: [0-100]\n`;

    return prompt;
  }

  /**
   * Parse alternatives from LLM response
   */
  private parseAlternatives(response: string): Alternative[] {
    const alternatives: Alternative[] = [];
    const blocks = response.split('---').filter((b) => b.trim());

    for (const block of blocks) {
      const optionMatch = block.match(/OPTION:\s*(.+)/i);
      const prosMatch = block.match(/PROS:\s*(.+)/i);
      const consMatch = block.match(/CONS:\s*(.+)/i);
      const effortMatch = block.match(/EFFORT:\s*(\d+\.?\d*)/i);

      if (optionMatch) {
        alternatives.push({
          option: optionMatch[1].trim(),
          pros: prosMatch ? prosMatch[1].split('|').map((p) => p.trim()) : [],
          cons: consMatch ? consMatch[1].split('|').map((c) => c.trim()) : [],
          estimatedEffort: effortMatch ? parseFloat(effortMatch[1]) : 4,
          risks: [],
        });
      }
    }

    return alternatives;
  }

  /**
   * Parse recommendation from LLM response
   */
  private parseRecommendation(response: string, alternatives: Alternative[]): Recommendation {
    const recMatch = response.match(/RECOMMENDATION:\s*(.+)/i);
    const reasoningMatch = response.match(/REASONING:\s*(.+)/i);
    const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/i);

    return {
      option: recMatch ? recMatch[1].trim() : alternatives[0]?.option || 'Proceed',
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided',
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 70,
    };
  }

  /**
   * Heuristic alternatives (fallback)
   */
  private heuristicAlternatives(decision: Decision): Alternative[] {
    return [
      {
        option: 'Proceed with original plan',
        pros: ['Addresses the immediate need', 'Clear implementation path'],
        cons: ['May have unforeseen risks'],
        estimatedEffort: 4,
        risks: [],
      },
      {
        option: 'Implement with additional safeguards',
        pros: ['Reduced risk', 'Better testing'],
        cons: ['Higher effort', 'Longer timeline'],
        estimatedEffort: 8,
        risks: [],
      },
    ];
  }

  /**
   * Get consultation patterns for analysis
   */
  getConsultationPatterns(): ConsultationPattern[] {
    return [...this.consultationPatterns];
  }
}

/**
 * Create a consultation system instance
 * 
 * @param runtimeEngine - Runtime engine for LLM calls
 * @returns Consultation system instance
 */
export function createConsultationSystem(runtimeEngine: RuntimeEngine): ConsultationSystem {
  return new ConsultationSystem(runtimeEngine);
}
