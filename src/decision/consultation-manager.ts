/**
 * Consultation Manager
 * 
 * Manages consultation triggers, request building, and feedback incorporation.
 * Determines when to consult with the user before making decisions.
 * 
 * Task 35: Implement consultation system
 */

import { Decision, RiskEvaluation } from './risk-evaluator';
import { PriorityScore } from './priority-scorer';

/**
 * Consultation trigger types
 */
export type ConsultationTrigger =
  | 'high_impact'        // Change affects many components
  | 'high_risk'          // Significant risk identified
  | 'architectural'      // Architectural change
  | 'self_modification'  // Prometheus modifying itself
  | 'user_preference'    // User wants to be consulted
  | 'uncertainty'        // Low confidence in decision
  | 'precedent'          // No similar past decisions
  | 'tie_breaking';      // Priority scores are too close

/**
 * Impact assessment for consultation
 */
export type ImpactAssessment = {
  /** Number of affected components */
  affectedComponents: number;
  /** Estimated users affected */
  affectedUsers?: number;
  /** Estimated effort (hours) */
  estimatedEffort: number;
  /** Confidence in assessment (0-1) */
  confidence: number;
};

/**
 * Alternative option for a decision
 */
export type Alternative = {
  /** Alternative description */
  description: string;
  /** Pros of this alternative */
  pros: string[];
  /** Cons of this alternative */
  cons: string[];
  /** Estimated effort (hours) */
  effort: number;
};

/**
 * Past decision for context
 */
export type PastDecision = {
  /** Decision ID */
  id: string;
  /** Decision description */
  description: string;
  /** Decision outcome */
  outcome: 'success' | 'failure' | 'partial' | 'unknown';
  /** Lessons learned */
  lessonsLearned?: string;
  /** Timestamp */
  timestamp: number;
};

/**
 * Consultation request
 */
export type ConsultationRequest = {
  /** Decision being considered */
  decision: Decision;
  /** Triggers that caused consultation */
  triggers: ConsultationTrigger[];
  /** Impact assessment */
  impact: ImpactAssessment;
  /** Risk evaluation */
  riskEvaluation?: RiskEvaluation;
  /** Priority score */
  priorityScore?: PriorityScore;
  /** Alternative options */
  alternatives: Alternative[];
  /** Recommendation */
  recommendation: string;
  /** Past similar decisions */
  pastDecisions: PastDecision[];
  /** Additional context */
  context?: string;
  /** Requested at timestamp */
  requestedAt: number;
};

/**
 * User feedback on consultation
 */
export type UserFeedback = {
  /** Whether user approved the decision */
  approved: boolean;
  /** User's chosen alternative (if different from recommendation) */
  chosenAlternative?: string;
  /** User's comments */
  comments?: string;
  /** User's confidence in decision (0-100) */
  confidence?: number;
  /** Additional guidance for future decisions */
  guidance?: string;
};

/**
 * Consultation response
 */
export type ConsultationResponse = {
  /** Consultation request ID */
  requestId: string;
  /** User feedback */
  feedback: UserFeedback;
  /** Response timestamp */
  respondedAt: number;
};

/**
 * Consultation pattern for learning
 */
export type ConsultationPattern = {
  /** Pattern description */
  description: string;
  /** Triggers that led to consultation */
  triggers: ConsultationTrigger[];
  /** Whether user approved */
  approved: boolean;
  /** Frequency of this pattern */
  frequency: number;
  /** Last seen timestamp */
  lastSeen: number;
};

/**
 * Consultation Manager
 * 
 * Determines when to consult, builds consultation requests,
 * and learns from user feedback.
 */
export class ConsultationManager {
  private consultationPatterns: Map<string, ConsultationPattern> = new Map();
  private userPreferences: Map<string, boolean> = new Map();

  /**
   * Check if consultation is needed for a decision
   * 
   * Task 35.1: Create consultation trigger logic
   * 
   * @param decision - Decision to evaluate
   * @param impact - Impact assessment
   * @param riskEvaluation - Optional risk evaluation
   * @param priorityScore - Optional priority score
   * @returns Whether consultation is needed and triggers
   */
  shouldConsult(
    decision: Decision,
    impact: ImpactAssessment,
    riskEvaluation?: RiskEvaluation,
    priorityScore?: PriorityScore
  ): { required: boolean; triggers: ConsultationTrigger[] } {
    const triggers: ConsultationTrigger[] = [];

    // Check high impact
    if (impact.affectedComponents > 5) {
      triggers.push('high_impact');
    }

    // Check high risk
    if (riskEvaluation?.requiresConsultation) {
      triggers.push('high_risk');
    }

    // Check architectural changes
    if (decision.type === 'architectural') {
      triggers.push('architectural');
    }

    // Check self-modification
    if (decision.type === 'self-modification') {
      triggers.push('self_modification');
    }

    // Check uncertainty (low confidence)
    if (impact.confidence < 0.7) {
      triggers.push('uncertainty');
    }

    // Check user preference
    const preferenceKey = this.getPreferenceKey(decision);
    if (this.userPreferences.get(preferenceKey) === true) {
      triggers.push('user_preference');
    }

    // Check for learned patterns
    const pattern = this.findMatchingPattern(decision, triggers);
    if (pattern && !pattern.approved) {
      // User previously rejected similar decisions
      // Ensure we consult again
      if (!triggers.includes('user_preference')) {
        triggers.push('user_preference');
      }
    }

    return {
      required: triggers.length > 0,
      triggers,
    };
  }

  /**
   * Build a consultation request
   * 
   * Task 35.2: Create consultation request builder
   * 
   * @param decision - Decision to consult about
   * @param triggers - Consultation triggers
   * @param impact - Impact assessment
   * @param riskEvaluation - Optional risk evaluation
   * @param priorityScore - Optional priority score
   * @param alternatives - Alternative options
   * @param pastDecisions - Past similar decisions
   * @returns Consultation request
   */
  buildConsultationRequest(
    decision: Decision,
    triggers: ConsultationTrigger[],
    impact: ImpactAssessment,
    riskEvaluation?: RiskEvaluation,
    priorityScore?: PriorityScore,
    alternatives: Alternative[] = [],
    pastDecisions: PastDecision[] = []
  ): ConsultationRequest {
    // Generate recommendation
    const recommendation = this.generateRecommendation(
      decision,
      triggers,
      impact,
      riskEvaluation,
      priorityScore
    );

    // Build context
    const context = this.buildContext(
      decision,
      triggers,
      impact,
      riskEvaluation,
      pastDecisions
    );

    return {
      decision,
      triggers,
      impact,
      riskEvaluation,
      priorityScore,
      alternatives,
      recommendation,
      pastDecisions,
      context,
      requestedAt: Date.now(),
    };
  }

  /**
   * Incorporate user feedback
   * 
   * Task 35.3: Implement feedback incorporation
   * 
   * @param request - Original consultation request
   * @param feedback - User feedback
   */
  incorporateFeedback(request: ConsultationRequest, feedback: UserFeedback): void {
    // Update consultation patterns
    this.updateConsultationPatterns(request, feedback);

    // Update user preferences
    this.updateUserPreferences(request, feedback);

    // Learn from guidance
    if (feedback.guidance) {
      this.learnFromGuidance(request, feedback.guidance);
    }
  }

  /**
   * Generate recommendation based on analysis
   */
  private generateRecommendation(
    decision: Decision,
    triggers: ConsultationTrigger[],
    impact: ImpactAssessment,
    riskEvaluation?: RiskEvaluation,
    priorityScore?: PriorityScore
  ): string {
    const parts: string[] = [];

    // Start with decision type
    parts.push(`Recommendation for ${decision.type} decision:`);

    // Add risk assessment
    if (riskEvaluation) {
      if (riskEvaluation.overallRisk === 'high' || riskEvaluation.overallRisk === 'critical') {
        parts.push(`⚠️ High risk detected (${riskEvaluation.overallRisk}). Proceed with caution.`);
      } else {
        parts.push(`✓ Risk level: ${riskEvaluation.overallRisk}`);
      }
    }

    // Add impact assessment
    if (impact.affectedComponents > 10) {
      parts.push(`⚠️ Large impact: ${impact.affectedComponents} components affected`);
    } else if (impact.affectedComponents > 5) {
      parts.push(`⚠️ Moderate impact: ${impact.affectedComponents} components affected`);
    } else {
      parts.push(`✓ Limited impact: ${impact.affectedComponents} components affected`);
    }

    // Add confidence
    if (impact.confidence < 0.5) {
      parts.push(`⚠️ Low confidence (${Math.round(impact.confidence * 100)}%). Consider gathering more information.`);
    } else if (impact.confidence < 0.7) {
      parts.push(`⚠️ Moderate confidence (${Math.round(impact.confidence * 100)}%)`);
    } else {
      parts.push(`✓ High confidence (${Math.round(impact.confidence * 100)}%)`);
    }

    // Add priority if available
    if (priorityScore) {
      parts.push(`Priority score: ${priorityScore.totalScore}/100`);
    }

    // Add final recommendation
    if (triggers.includes('high_risk') || triggers.includes('self_modification')) {
      parts.push('\n**Recommendation**: Proceed only after careful review and testing.');
    } else if (triggers.includes('high_impact')) {
      parts.push('\n**Recommendation**: Proceed with staged rollout and monitoring.');
    } else if (triggers.includes('uncertainty')) {
      parts.push('\n**Recommendation**: Gather more information before proceeding.');
    } else {
      parts.push('\n**Recommendation**: Safe to proceed with standard review process.');
    }

    return parts.join('\n');
  }

  /**
   * Build context for consultation
   */
  private buildContext(
    decision: Decision,
    triggers: ConsultationTrigger[],
    impact: ImpactAssessment,
    riskEvaluation?: RiskEvaluation,
    pastDecisions: PastDecision[] = []
  ): string {
    const parts: string[] = [];

    // Decision details
    parts.push(`**Decision**: ${decision.description}`);
    parts.push(`**Type**: ${decision.type}`);
    parts.push(`**Files**: ${decision.change.files.length} file(s)`);

    // Triggers
    parts.push(`\n**Consultation Triggers**:`);
    triggers.forEach((trigger) => {
      parts.push(`- ${this.formatTrigger(trigger)}`);
    });

    // Impact
    parts.push(`\n**Impact Assessment**:`);
    parts.push(`- Affected components: ${impact.affectedComponents}`);
    if (impact.affectedUsers) {
      parts.push(`- Affected users: ${impact.affectedUsers}`);
    }
    parts.push(`- Estimated effort: ${impact.estimatedEffort} hours`);
    parts.push(`- Confidence: ${Math.round(impact.confidence * 100)}%`);

    // Risks
    if (riskEvaluation && riskEvaluation.risks.length > 0) {
      parts.push(`\n**Identified Risks**:`);
      riskEvaluation.risks.forEach((risk) => {
        parts.push(`- [${risk.severity}] ${risk.description}`);
      });
    }

    // Past decisions
    if (pastDecisions.length > 0) {
      parts.push(`\n**Similar Past Decisions**:`);
      pastDecisions.slice(0, 3).forEach((past) => {
        parts.push(`- ${past.description} (${past.outcome})`);
        if (past.lessonsLearned) {
          parts.push(`  Lesson: ${past.lessonsLearned}`);
        }
      });
    }

    return parts.join('\n');
  }

  /**
   * Format trigger for display
   */
  private formatTrigger(trigger: ConsultationTrigger): string {
    const labels: Record<ConsultationTrigger, string> = {
      high_impact: 'High Impact - Affects many components',
      high_risk: 'High Risk - Significant risks identified',
      architectural: 'Architectural Change - System-wide impact',
      self_modification: 'Self-Modification - Prometheus modifying itself',
      user_preference: 'User Preference - User requested consultation',
      uncertainty: 'Uncertainty - Low confidence in decision',
      precedent: 'No Precedent - No similar past decisions',
      tie_breaking: 'Tie Breaking - Multiple options with similar priority',
    };

    return labels[trigger] || trigger;
  }

  /**
   * Update consultation patterns based on feedback
   */
  private updateConsultationPatterns(
    request: ConsultationRequest,
    feedback: UserFeedback
  ): void {
    const patternKey = this.getPatternKey(request.decision, request.triggers);
    const existing = this.consultationPatterns.get(patternKey);

    if (existing) {
      existing.frequency += 1;
      existing.approved = feedback.approved;
      existing.lastSeen = Date.now();
    } else {
      this.consultationPatterns.set(patternKey, {
        description: request.decision.description,
        triggers: request.triggers,
        approved: feedback.approved,
        frequency: 1,
        lastSeen: Date.now(),
      });
    }
  }

  /**
   * Update user preferences based on feedback
   */
  private updateUserPreferences(
    request: ConsultationRequest,
    feedback: UserFeedback
  ): void {
    // If user consistently approves certain types of decisions,
    // we can reduce consultation frequency
    const preferenceKey = this.getPreferenceKey(request.decision);

    if (feedback.approved && feedback.confidence && feedback.confidence > 80) {
      // User is confident - maybe we don't need to consult next time
      this.userPreferences.set(preferenceKey, false);
    } else if (!feedback.approved) {
      // User rejected - always consult for similar decisions
      this.userPreferences.set(preferenceKey, true);
    }
  }

  /**
   * Learn from user guidance
   */
  private learnFromGuidance(request: ConsultationRequest, guidance: string): void {
    // Store guidance for future reference
    // This could be used to update decision models
    // For now, we just track it
    console.log(`Learning from guidance: ${guidance}`);
  }

  /**
   * Find matching consultation pattern
   */
  private findMatchingPattern(
    decision: Decision,
    triggers: ConsultationTrigger[]
  ): ConsultationPattern | undefined {
    const patternKey = this.getPatternKey(decision, triggers);
    return this.consultationPatterns.get(patternKey);
  }

  /**
   * Get pattern key for decision and triggers
   */
  private getPatternKey(decision: Decision, triggers: ConsultationTrigger[]): string {
    const triggerStr = triggers.sort().join(',');
    // Include decision ID to make patterns unique per decision
    return `${decision.type}:${triggerStr}:${decision.id}`;
  }

  /**
   * Get preference key for decision
   */
  private getPreferenceKey(decision: Decision): string {
    return `${decision.type}`;
  }

  /**
   * Get consultation statistics
   */
  getStatistics(): {
    totalPatterns: number;
    approvalRate: number;
    mostCommonTriggers: ConsultationTrigger[];
  } {
    const patterns = Array.from(this.consultationPatterns.values());
    const totalPatterns = patterns.length;

    if (totalPatterns === 0) {
      return {
        totalPatterns: 0,
        approvalRate: 0,
        mostCommonTriggers: [],
      };
    }

    const approved = patterns.filter((p) => p.approved).length;
    const approvalRate = approved / totalPatterns;

    // Count trigger frequencies
    const triggerCounts = new Map<ConsultationTrigger, number>();
    patterns.forEach((pattern) => {
      pattern.triggers.forEach((trigger) => {
        triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + pattern.frequency);
      });
    });

    // Sort by frequency
    const mostCommonTriggers = Array.from(triggerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([trigger]) => trigger);

    return {
      totalPatterns,
      approvalRate,
      mostCommonTriggers,
    };
  }

  /**
   * Reset consultation patterns (for testing)
   */
  reset(): void {
    this.consultationPatterns.clear();
    this.userPreferences.clear();
  }
}

/**
 * Create a consultation manager instance
 * 
 * @returns Consultation manager instance
 */
export function createConsultationManager(): ConsultationManager {
  return new ConsultationManager();
}
