/**
 * Quality Issue Ranker
 * 
 * Ranks quality issues by severity and impact, and generates
 * specific refactoring suggestions.
 * 
 * Task 26.3: Implement quality issue ranking
 * Task 26.4: Implement quality suggestions
 */

import { QualityIssue, IssueSeverity, IssueType } from './types';

/**
 * Ranking criteria weights
 */
type RankingWeights = {
  severity: number;
  impact: number;
  effort: number;
};

/**
 * Issue Ranker
 * 
 * Ranks quality issues and generates suggestions.
 */
export class IssueRanker {
  private weights: RankingWeights;

  constructor(weights?: Partial<RankingWeights>) {
    this.weights = {
      severity: weights?.severity ?? 0.5,
      impact: weights?.impact ?? 0.3,
      effort: weights?.effort ?? 0.2,
    };
  }

  /**
   * Rank issues by priority
   * 
   * Higher scores = higher priority
   * 
   * @param issues - Array of quality issues
   * @returns Sorted array (highest priority first)
   */
  rankIssues(issues: QualityIssue[]): QualityIssue[] {
    // Calculate priority score for each issue
    const scored = issues.map((issue) => ({
      issue,
      score: this.calculatePriorityScore(issue),
    }));

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    return scored.map((s) => s.issue);
  }

  /**
   * Calculate priority score for an issue
   * 
   * Score = (severity * weight) + (impact * weight) - (effort * weight)
   * 
   * We want high severity, high impact, low effort issues first.
   */
  private calculatePriorityScore(issue: QualityIssue): number {
    // Severity score (0-100)
    const severityScore = this.getSeverityScore(issue.severity);

    // Impact score (0-100)
    const impactScore = issue.impactScore;

    // Effort score (inverted - lower effort = higher score)
    const effortHours = issue.effortHours ?? 1;
    const effortScore = Math.max(0, 100 - effortHours * 10);

    // Weighted sum
    const score =
      severityScore * this.weights.severity +
      impactScore * this.weights.impact +
      effortScore * this.weights.effort;

    return score;
  }

  /**
   * Get numeric score for severity level
   */
  private getSeverityScore(severity: IssueSeverity): number {
    switch (severity) {
      case IssueSeverity.CRITICAL:
        return 100;
      case IssueSeverity.HIGH:
        return 75;
      case IssueSeverity.MEDIUM:
        return 50;
      case IssueSeverity.LOW:
        return 25;
      default:
        return 0;
    }
  }

  /**
   * Generate detailed suggestion for an issue
   * 
   * @param issue - Quality issue
   * @returns Detailed suggestion with steps
   */
  generateSuggestion(issue: QualityIssue): string {
    // If issue already has a suggestion, enhance it
    if (issue.suggestion) {
      return this.enhanceSuggestion(issue);
    }

    // Generate suggestion based on issue type
    switch (issue.type) {
      case IssueType.COMPLEXITY:
        return this.generateComplexitySuggestion(issue);
      case IssueType.LONG_METHOD:
        return this.generateLongMethodSuggestion(issue);
      case IssueType.LARGE_CLASS:
        return this.generateLargeClassSuggestion(issue);
      case IssueType.DUPLICATION:
        return this.generateDuplicationSuggestion(issue);
      case IssueType.MAGIC_NUMBER:
        return this.generateMagicNumberSuggestion(issue);
      case IssueType.CODE_SMELL:
        return this.generateCodeSmellSuggestion(issue);
      default:
        return 'Review and refactor this code section';
    }
  }

  /**
   * Enhance existing suggestion with specific steps
   */
  private enhanceSuggestion(issue: QualityIssue): string {
    const steps: string[] = [issue.suggestion!];

    // Add effort estimate
    if (issue.effortHours) {
      steps.push(`Estimated effort: ${issue.effortHours} hours`);
    }

    // Add severity-specific advice
    if (issue.severity === IssueSeverity.CRITICAL || issue.severity === IssueSeverity.HIGH) {
      steps.push('Priority: Address this issue soon to prevent technical debt accumulation');
    }

    return steps.join('\n');
  }

  /**
   * Generate suggestion for high complexity
   */
  private generateComplexitySuggestion(issue: QualityIssue): string {
    return `High Complexity Refactoring:
1. Identify logical blocks within the function
2. Extract each block into a separate, well-named function
3. Use early returns to reduce nesting
4. Consider using guard clauses for validation
5. Apply the Single Responsibility Principle

Estimated effort: ${issue.effortHours ?? 2} hours`;
  }

  /**
   * Generate suggestion for long methods
   */
  private generateLongMethodSuggestion(issue: QualityIssue): string {
    return `Long Method Refactoring:
1. Identify cohesive blocks of code
2. Extract each block into a separate method
3. Use descriptive names that explain what each method does
4. Consider using the Extract Method refactoring pattern
5. Aim for methods under 30 lines

Estimated effort: ${issue.effortHours ?? 3} hours`;
  }

  /**
   * Generate suggestion for large classes
   */
  private generateLargeClassSuggestion(issue: QualityIssue): string {
    return `Large Class Refactoring:
1. Identify groups of related methods and properties
2. Extract each group into a separate class
3. Use composition to connect the classes
4. Apply the Single Responsibility Principle
5. Consider using design patterns (Strategy, Decorator, etc.)

Estimated effort: ${issue.effortHours ?? 5} hours`;
  }

  /**
   * Generate suggestion for code duplication
   */
  private generateDuplicationSuggestion(issue: QualityIssue): string {
    return `Code Duplication Refactoring:
1. Identify the common code pattern
2. Extract the duplicated code into a shared function or class
3. Parameterize any differences
4. Update all locations to use the shared code
5. Add tests to ensure behavior is preserved

Estimated effort: ${issue.effortHours ?? 2} hours`;
  }

  /**
   * Generate suggestion for magic numbers
   */
  private generateMagicNumberSuggestion(issue: QualityIssue): string {
    return `Magic Number Refactoring:
1. Create a named constant with a descriptive name
2. Replace all occurrences of the magic number with the constant
3. Add a comment explaining the constant's purpose if needed
4. Consider grouping related constants in an enum or object

Estimated effort: ${issue.effortHours ?? 0.5} hours`;
  }

  /**
   * Generate suggestion for code smells
   */
  private generateCodeSmellSuggestion(issue: QualityIssue): string {
    return `Code Smell Refactoring:
1. Review the code smell and understand its impact
2. Apply appropriate refactoring pattern
3. Ensure tests pass after refactoring
4. Consider adding new tests for edge cases

Estimated effort: ${issue.effortHours ?? 1} hours`;
  }

  /**
   * Group issues by file
   * 
   * @param issues - Array of quality issues
   * @returns Map of file path to issues
   */
  groupByFile(issues: QualityIssue[]): Map<string, QualityIssue[]> {
    const grouped = new Map<string, QualityIssue[]>();

    for (const issue of issues) {
      if (!grouped.has(issue.filePath)) {
        grouped.set(issue.filePath, []);
      }
      grouped.get(issue.filePath)!.push(issue);
    }

    return grouped;
  }

  /**
   * Group issues by severity
   * 
   * @param issues - Array of quality issues
   * @returns Map of severity to issues
   */
  groupBySeverity(issues: QualityIssue[]): Map<IssueSeverity, QualityIssue[]> {
    const grouped = new Map<IssueSeverity, QualityIssue[]>();

    for (const issue of issues) {
      if (!grouped.has(issue.severity)) {
        grouped.set(issue.severity, []);
      }
      grouped.get(issue.severity)!.push(issue);
    }

    return grouped;
  }

  /**
   * Get top N issues by priority
   * 
   * @param issues - Array of quality issues
   * @param n - Number of top issues to return
   * @returns Top N issues
   */
  getTopIssues(issues: QualityIssue[], n: number): QualityIssue[] {
    const ranked = this.rankIssues(issues);
    return ranked.slice(0, n);
  }
}

/**
 * Create an issue ranker instance
 * 
 * @param weights - Optional custom ranking weights
 * @returns Issue ranker instance
 */
export function createIssueRanker(weights?: Partial<RankingWeights>): IssueRanker {
  return new IssueRanker(weights);
}
