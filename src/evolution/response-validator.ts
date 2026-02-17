/**
 * Themis - Response Validator
 * 
 * Validates Prometheus's chat responses for hallucinations and accuracy.
 * Provides a truth score and brief commentary on each response.
 * 
 * Named after Themis, Greek goddess of divine law and order.
 */

import { RuntimeRequest, RuntimeResponse } from '../types/index.js';

/**
 * Simple runtime engine interface for validation
 */
export interface RuntimeEngine {
  execute(request: RuntimeRequest): Promise<RuntimeResponse>;
}

/**
 * Response validation result
 */
export type ResponseValidationResult = {
  /** Truth score (0-100) */
  truthScore: number;
  /** Brief commentary (1 sentence) */
  commentary: string;
  /** Issues found (if any) */
  issues: ResponseIssue[];
  /** Validated by */
  validatedBy: 'themis';
  /** Validation timestamp */
  validatedAt: number;
};

/**
 * Response issue severity
 */
export type ResponseIssueSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Response issue
 */
export type ResponseIssue = {
  /** Issue type */
  type: ResponseIssueType;
  /** Severity */
  severity: ResponseIssueSeverity;
  /** Description */
  description: string;
  /** Evidence (quote from response) */
  evidence?: string;
};

/**
 * Response issue types
 */
export type ResponseIssueType =
  | 'hallucination'          // Claims non-existent facts
  | 'contradiction'          // Contradicts itself
  | 'unsupported_claim'      // Makes claims without evidence
  | 'outdated_info'          // Uses outdated information
  | 'overconfidence'         // Too confident without basis
  | 'vague'                  // Too vague to be useful
  | 'off_topic'              // Doesn't address the question
  | 'code_error'             // Suggests code with errors
  | 'security_risk';         // Suggests insecure practices

/**
 * Themis - Response Validator
 * 
 * Validates Prometheus's responses to prevent hallucinations.
 * Uses independent LLM analysis with a critical lens.
 */
export class ResponseValidator {
  constructor(private runtimeEngine: RuntimeEngine) {}

  /**
   * Validate a chat response
   * 
   * Analyzes response for accuracy, hallucinations, and quality.
   * Returns a truth score and brief commentary.
   * 
   * @param response - Prometheus's response to validate
   * @param userQuery - Original user query for context
   * @param context - Additional context (code, docs, etc.)
   * @returns Validation result with score and commentary
   */
  async validateResponse(
    response: string,
    userQuery: string,
    context?: {
      codeSnippets?: string[];
      documentation?: string;
      previousMessages?: Array<{ role: string; content: string }>;
    }
  ): Promise<ResponseValidationResult> {
    const issues: ResponseIssue[] = [];

    // 1. Quick heuristic checks (fast)
    const heuristicIssues = this.performHeuristicChecks(response, userQuery);
    issues.push(...heuristicIssues);

    // 2. Deep validation with independent LLM (critical)
    const deepIssues = await this.performDeepValidation(response, userQuery, context);
    issues.push(...deepIssues);

    // 3. Calculate truth score
    const truthScore = this.calculateTruthScore(issues);

    // 4. Generate brief commentary
    const commentary = this.generateCommentary(truthScore, issues);

    return {
      truthScore,
      commentary,
      issues,
      validatedBy: 'themis',
      validatedAt: Date.now(),
    };
  }

  /**
   * Perform quick heuristic checks
   * 
   * Fast, pattern-based checks that don't require LLM.
   */
  private performHeuristicChecks(response: string, userQuery: string): ResponseIssue[] {
    const issues: ResponseIssue[] = [];

    // Check for vagueness
    if (this.isVague(response)) {
      issues.push({
        type: 'vague',
        severity: 'medium',
        description: 'Response is too vague or generic',
      });
    }

    // Check for overconfidence markers
    if (this.hasOverconfidenceMarkers(response)) {
      issues.push({
        type: 'overconfidence',
        severity: 'low',
        description: 'Response shows overconfidence without sufficient basis',
      });
    }

    // Check if response addresses the query
    if (!this.addressesQuery(response, userQuery)) {
      issues.push({
        type: 'off_topic',
        severity: 'high',
        description: 'Response does not adequately address the user query',
      });
    }

    // Check for common code errors in suggestions
    if (this.hasCommonCodeErrors(response)) {
      issues.push({
        type: 'code_error',
        severity: 'high',
        description: 'Response contains code with potential errors',
      });
    }

    // Check for security anti-patterns
    if (this.hasSecurityRisks(response)) {
      issues.push({
        type: 'security_risk',
        severity: 'critical',
        description: 'Response suggests potentially insecure practices',
      });
    }

    return issues;
  }

  /**
   * Perform deep validation using independent LLM
   * 
   * Critical analysis by Themis to detect hallucinations and inaccuracies.
   */
  private async performDeepValidation(
    response: string,
    userQuery: string,
    context?: {
      codeSnippets?: string[];
      documentation?: string;
      previousMessages?: Array<{ role: string; content: string }>;
    }
  ): Promise<ResponseIssue[]> {
    const prompt = this.buildValidationPrompt(response, userQuery, context);

    try {
      const result = await this.runtimeEngine.execute({
        taskType: 'decision_making',
        prompt,
        context: `You are Themis, an independent truth validator.
Your job is to critically analyze responses and detect hallucinations, inaccuracies, and unsupported claims.
Be skeptical and thorough. Question everything. Look for problems.
You are NOT trying to be helpful - you are trying to find issues.`,
        maxTokens: 600,
      });

      return this.parseValidationIssues(result.content);
    } catch (error) {
      console.warn('[Themis] Deep validation failed:', error);
      return [];
    }
  }

  /**
   * Calculate truth score based on issues
   */
  private calculateTruthScore(issues: ResponseIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 40;
          break;
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate brief commentary (1 sentence)
   */
  private generateCommentary(truthScore: number, issues: ResponseIssue[]): string {
    const criticalIssues = issues.filter((i) => i.severity === 'critical');
    const highIssues = issues.filter((i) => i.severity === 'high');
    const hallucinationIssues = issues.filter((i) => i.type === 'hallucination');

    if (criticalIssues.length > 0) {
      return `⚠️ Critical issues detected - response may contain significant inaccuracies.`;
    }

    if (hallucinationIssues.length > 0) {
      return `🚨 Potential hallucination detected - verify claims against actual sources.`;
    }

    if (highIssues.length > 0) {
      return `⚠️ Response has notable issues - cross-check important details.`;
    }

    if (truthScore >= 90) {
      return `✅ Response appears accurate and well-grounded.`;
    }

    if (truthScore >= 75) {
      return `✓ Response is generally reliable with minor concerns.`;
    }

    if (truthScore >= 60) {
      return `⚠️ Response has some accuracy concerns - verify key points.`;
    }

    return `❌ Response quality is questionable - significant verification needed.`;
  }

  /**
   * Build validation prompt for LLM
   */
  private buildValidationPrompt(
    response: string,
    userQuery: string,
    context?: {
      codeSnippets?: string[];
      documentation?: string;
      previousMessages?: Array<{ role: string; content: string }>;
    }
  ): string {
    let prompt = `Critically analyze this response for accuracy and hallucinations.

USER QUERY:
${userQuery}

PROMETHEUS RESPONSE:
${response}
`;

    if (context?.codeSnippets && context.codeSnippets.length > 0) {
      prompt += `\n\nCODE CONTEXT:\n${context.codeSnippets.join('\n\n')}`;
    }

    if (context?.documentation) {
      prompt += `\n\nDOCUMENTATION:\n${context.documentation}`;
    }

    prompt += `

ANALYZE FOR:
1. Hallucinations: Does the response claim facts not supported by context?
2. Contradictions: Does the response contradict itself?
3. Unsupported claims: Are there claims without evidence?
4. Code accuracy: If code is suggested, is it correct?
5. Relevance: Does it actually answer the question?

Respond with issues found in this format:
ISSUE: [type]
SEVERITY: [critical/high/medium/low]
DESCRIPTION: [description]
EVIDENCE: [quote from response]
---

If no issues found, respond with: NO_ISSUES_FOUND`;

    return prompt;
  }

  /**
   * Parse validation issues from LLM response
   */
  private parseValidationIssues(response: string): ResponseIssue[] {
    if (response.includes('NO_ISSUES_FOUND')) {
      return [];
    }

    const issues: ResponseIssue[] = [];
    const blocks = response.split('---').filter((b) => b.trim());

    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim());

      let type: ResponseIssueType = 'unsupported_claim';
      let severity: ResponseIssueSeverity = 'medium';
      let description = '';
      let evidence: string | undefined;

      for (const line of lines) {
        if (line.startsWith('ISSUE:')) {
          const issueType = line.substring(6).trim().toLowerCase().replace(/\s+/g, '_');
          if (this.isValidIssueType(issueType)) {
            type = issueType as ResponseIssueType;
          }
        } else if (line.startsWith('SEVERITY:')) {
          const sev = line.substring(9).trim().toLowerCase();
          if (['critical', 'high', 'medium', 'low'].includes(sev)) {
            severity = sev as ResponseIssueSeverity;
          }
        } else if (line.startsWith('DESCRIPTION:')) {
          description = line.substring(12).trim();
        } else if (line.startsWith('EVIDENCE:')) {
          evidence = line.substring(9).trim();
        }
      }

      if (description) {
        issues.push({
          type,
          severity,
          description,
          evidence,
        });
      }
    }

    return issues;
  }

  // Heuristic check helpers

  private isVague(response: string): boolean {
    const vaguePatterns = [
      /it depends/i,
      /might work/i,
      /could be/i,
      /possibly/i,
      /maybe/i,
    ];

    const vagueCount = vaguePatterns.filter((p) => p.test(response)).length;
    const wordCount = response.split(/\s+/).length;

    // If response is short and has multiple vague phrases, flag it
    return wordCount < 50 && vagueCount >= 2;
  }

  private hasOverconfidenceMarkers(response: string): boolean {
    const overconfidentPatterns = [
      /definitely/i,
      /absolutely/i,
      /always works/i,
      /never fails/i,
      /guaranteed/i,
      /100% sure/i,
    ];

    return overconfidentPatterns.some((p) => p.test(response));
  }

  private addressesQuery(response: string, userQuery: string): boolean {
    // Extract key terms from query
    const queryTerms = userQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Check if response mentions at least some key terms
    const responseLower = response.toLowerCase();
    const mentionedTerms = queryTerms.filter((term) => responseLower.includes(term));

    return mentionedTerms.length >= Math.min(2, queryTerms.length);
  }

  private hasCommonCodeErrors(response: string): boolean {
    // Check for common code anti-patterns
    const errorPatterns = [
      /eval\(/i,                    // eval is dangerous
      /innerHTML\s*=/i,             // XSS risk
      /document\.write/i,           // Bad practice
      /var\s+/,                     // Should use let/const
      /==\s*null/,                  // Should use === or ??
    ];

    return errorPatterns.some((p) => p.test(response));
  }

  private hasSecurityRisks(response: string): boolean {
    const securityPatterns = [
      /password.*plain.*text/i,
      /disable.*ssl/i,
      /ignore.*certificate/i,
      /md5.*password/i,
      /sha1.*password/i,
    ];

    return securityPatterns.some((p) => p.test(response));
  }

  private isValidIssueType(type: string): boolean {
    const validTypes: ResponseIssueType[] = [
      'hallucination',
      'contradiction',
      'unsupported_claim',
      'outdated_info',
      'overconfidence',
      'vague',
      'off_topic',
      'code_error',
      'security_risk',
    ];

    return validTypes.includes(type as ResponseIssueType);
  }
}

/**
 * Create a response validator instance
 * 
 * @param runtimeEngine - Runtime engine for LLM calls
 * @returns Response validator instance
 */
export function createResponseValidator(runtimeEngine: RuntimeEngine): ResponseValidator {
  return new ResponseValidator(runtimeEngine);
}
