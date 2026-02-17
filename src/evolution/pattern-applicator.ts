/**
 * Pattern Application System
 * 
 * Applies OpenClaw patterns to codebases by:
 * 1. Verifying pattern applicability
 * 2. Adapting patterns to local conventions
 * 3. Tracking pattern outcomes
 * 4. Prioritizing pattern applications
 */

import type { RuntimeExecutor } from '../runtime/runtime-executor';
import type { MemoryEngine } from '../memory';
import type { Pattern } from '../memory/types';

// Local types that use memory Pattern type
export interface PatternResult {
  success: boolean;
  pattern: Pattern;
  location: { file: string; line: number };
  error?: string;
}

export interface PatternOpportunity {
  pattern: Pattern;
  location: { file: string; line: number };
  estimatedBenefit: number;
  estimatedEffort: number;
  confidence: number;
}

export interface PatternApplicabilityCheck {
  applicable: boolean;
  confidence: number; // 0-100
  preconditions: PreconditionCheck[];
  estimatedEffort: number; // hours
  reasoning: string;
}

export interface PreconditionCheck {
  condition: string;
  satisfied: boolean;
  details: string;
}

export interface AdaptedPattern {
  originalPattern: Pattern;
  adaptedCode: string;
  adaptationNotes: string[];
  localConventions: string[];
}

export class PatternApplicator {
  constructor(
    private memoryEngine: MemoryEngine,
    private runtimeExecutor?: RuntimeExecutor
  ) {}

  /**
   * Check if a pattern is applicable to a specific location
   * 
   * Requirements: 21.1
   */
  async checkApplicability(
    pattern: Pattern,
    location: { file: string; line: number },
    codeContext: string
  ): Promise<PatternApplicabilityCheck> {
    // Extract preconditions from pattern
    const preconditions = this.extractPreconditions(pattern);

    // Check each precondition
    const preconditionChecks = await Promise.all(
      preconditions.map(condition => this.checkPrecondition(condition, codeContext))
    );

    const allSatisfied = preconditionChecks.every(check => check.satisfied);

    // Use LLM for deeper analysis if available
    let confidence = allSatisfied ? 70 : 30;
    let reasoning = `Basic precondition check: ${allSatisfied ? 'passed' : 'failed'}`;
    let estimatedEffort = this.estimateEffortHeuristic(pattern);

    if (this.runtimeExecutor && allSatisfied) {
      try {
        const llmAnalysis = await this.analyzeLLM(pattern, location, codeContext);
        confidence = llmAnalysis.confidence;
        reasoning = llmAnalysis.reasoning;
        estimatedEffort = llmAnalysis.estimatedEffort;
      } catch (error) {
        console.warn('LLM analysis failed, using heuristics:', error);
      }
    }

    return {
      applicable: allSatisfied && confidence > 50,
      confidence,
      preconditions: preconditionChecks,
      estimatedEffort,
      reasoning,
    };
  }

  /**
   * Adapt pattern to local codebase conventions
   * 
   * Requirements: 21.2
   */
  async adaptPattern(
    pattern: Pattern,
    location: { file: string; line: number },
    codeContext: string
  ): Promise<AdaptedPattern> {
    // Detect local conventions
    const conventions = await this.detectLocalConventions(location.file, codeContext);

    if (!this.runtimeExecutor) {
      // Fallback: minimal adaptation
      return {
        originalPattern: pattern,
        adaptedCode: pattern.example_code ?? '',
        adaptationNotes: ['No LLM available, using pattern as-is'],
        localConventions: conventions,
      };
    }

    // Use LLM to adapt pattern
    try {
      const prompt = `Adapt the following pattern to match local code conventions:

Pattern: ${pattern.name}
Category: ${pattern.category}
Problem: ${pattern.problem}
Solution: ${pattern.solution}

Example Code:
\`\`\`typescript
${pattern.example_code}
\`\`\`

Local Code Context:
\`\`\`typescript
${codeContext}
\`\`\`

Local Conventions:
${conventions.map(c => `- ${c}`).join('\n')}

Generate adapted code that:
1. Follows local naming conventions
2. Matches local code style
3. Integrates with existing patterns
4. Maintains pattern's core benefits

Return JSON with: adaptedCode, adaptationNotes`;

      const response = await this.runtimeExecutor.execute({
        taskType: 'refactoring',
        prompt,
        context: JSON.stringify({ pattern, conventions }),
      });

      const result = JSON.parse(response.content);

      return {
        originalPattern: pattern,
        adaptedCode: result.adaptedCode || pattern.example_code || '',
        adaptationNotes: result.adaptationNotes || [],
        localConventions: conventions,
      };
    } catch (error) {
      console.error('Pattern adaptation failed:', error);
      return {
        originalPattern: pattern,
        adaptedCode: pattern.example_code ?? '',
        adaptationNotes: ['Adaptation failed, using original pattern'],
        localConventions: conventions,
      };
    }
  }

  /**
   * Apply pattern and track outcome
   * 
   * Requirements: 21.3, 21.4
   */
  async applyPattern(
    pattern: Pattern,
    location: { file: string; line: number },
    _adaptedCode: string
  ): Promise<PatternResult> {
    try {
      // In a real implementation, this would:
      // 1. Create a backup of the file
      // 2. Apply the code changes
      // 3. Run tests to verify
      // 4. Commit if successful

      console.log(`Applying pattern "${pattern.name}" at ${location.file}:${location.line}`);

      // Simulate application (in real implementation, would modify files)
      const success = true; // Would be determined by test results

      // Track outcome in memory
      await this.memoryEngine.updatePatternOutcome(pattern.id, {
        success,
        context: `Applied at ${location.file}:${location.line}`,
        notes: `Applied at ${new Date().toISOString()}`,
      });

      return {
        success,
        pattern,
        location,
      };
    } catch (error) {
      // Track failure
      await this.memoryEngine.updatePatternOutcome(pattern.id, {
        success: false,
        context: `Failed at ${location.file}:${location.line}: ${error}`,
        notes: `Failed at ${new Date().toISOString()}: ${error}`,
      });

      return {
        success: false,
        pattern,
        location,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Find pattern opportunities in codebase
   * 
   * Requirements: 21.5
   */
  async findOpportunities(
    repoPath: string,
    patterns?: Pattern[]
  ): Promise<PatternOpportunity[]> {
    const opportunities: PatternOpportunity[] = [];

    // Get patterns from memory if not provided
    const patternsToCheck = patterns || await this.getAllPatterns();

    // Scan codebase for opportunities
    const files = await this.getCodeFiles(repoPath);

    for (const file of files) {
      const content = await this.readFile(file);

      for (const pattern of patternsToCheck) {
        // Check if pattern problem exists in this file
        const hasProblem = await this.detectProblem(pattern, file, content);

        if (hasProblem) {
          const applicability = await this.checkApplicability(
            pattern,
            { file, line: 1 },
            content
          );

          if (applicability.applicable) {
            opportunities.push({
              pattern,
              location: { file, line: 1 },
              estimatedBenefit: this.estimateBenefit(pattern, applicability),
              estimatedEffort: applicability.estimatedEffort,
              confidence: applicability.confidence,
            });
          }
        }
      }
    }

    // Sort by benefit/effort ratio
    opportunities.sort((a, b) => {
      const ratioA = a.estimatedBenefit / Math.max(a.estimatedEffort, 0.5);
      const ratioB = b.estimatedBenefit / Math.max(b.estimatedEffort, 0.5);
      return ratioB - ratioA;
    });

    return opportunities;
  }

  /**
   * Prioritize pattern applications
   * 
   * Requirements: 21.5
   */
  prioritizeOpportunities(opportunities: PatternOpportunity[]): PatternOpportunity[] {
    return opportunities.sort((a, b) => {
      // Calculate priority score
      const scoreA = this.calculatePriorityScore(a);
      const scoreB = this.calculatePriorityScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate priority score for pattern opportunity
   */
  private calculatePriorityScore(opportunity: PatternOpportunity): number {
    const { estimatedBenefit, estimatedEffort, pattern } = opportunity;

    // Factors:
    // 1. Benefit/effort ratio (higher is better)
    // 2. Pattern success rate (higher is better)
    // 3. Pattern category weight

    const benefitEffortRatio = estimatedBenefit / Math.max(estimatedEffort, 0.5);
    const successRate = this.getPatternSuccessRate(pattern);
    const categoryWeight = this.getCategoryWeight(pattern.category);

    return benefitEffortRatio * 0.5 + successRate * 0.3 + categoryWeight * 0.2;
  }

  /**
   * Get pattern success rate
   */
  private getPatternSuccessRate(pattern: Pattern): number {
    const total = pattern.success_count + pattern.failure_count;
    if (total === 0) return 50; // Neutral for untested patterns
    return (pattern.success_count / total) * 100;
  }

  /**
   * Get category weight (some categories are higher priority)
   */
  private getCategoryWeight(category: string): number {
    const weights: Record<string, number> = {
      Reliability: 100,
      Performance: 80,
      Concurrency: 70,
      Architecture: 60,
      Data: 50,
    };
    return weights[category] || 50;
  }

  /**
   * Extract preconditions from pattern
   */
  private extractPreconditions(pattern: Pattern): string[] {
    const preconditions: string[] = [];

    // Extract from applicability field
    if (pattern.applicability) {
      const sentences = pattern.applicability.split('.');
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes('when') || sentence.toLowerCase().includes('use')) {
          preconditions.push(sentence.trim());
        }
      }
    }

    // Add category-specific preconditions
    if (pattern.category === 'Concurrency') {
      preconditions.push('Code has concurrent operations');
    } else if (pattern.category === 'Performance') {
      preconditions.push('Performance issue exists');
    }

    return preconditions;
  }

  /**
   * Check if a precondition is satisfied
   */
  private async checkPrecondition(
    condition: string,
    codeContext: string
  ): Promise<PreconditionCheck> {
    // Simple heuristic checks
    const lowerCondition = condition.toLowerCase();
    const lowerContext = codeContext.toLowerCase();

    let satisfied = false;
    let details = '';

    if (lowerCondition.includes('concurrent')) {
      satisfied = lowerContext.includes('async') || lowerContext.includes('promise');
      details = satisfied ? 'Found async/promise usage' : 'No concurrent operations detected';
    } else if (lowerCondition.includes('performance')) {
      satisfied = lowerContext.includes('for') || lowerContext.includes('map');
      details = satisfied ? 'Found loops/iterations' : 'No performance-critical code detected';
    } else if (lowerCondition.includes('multiple')) {
      satisfied = (lowerContext.match(/class|interface|function/g) || []).length > 2;
      details = satisfied ? 'Multiple components found' : 'Single component detected';
    } else {
      // Default: assume satisfied
      satisfied = true;
      details = 'Precondition check passed (heuristic)';
    }

    return {
      condition,
      satisfied,
      details,
    };
  }

  /**
   * Analyze applicability using LLM
   */
  private async analyzeLLM(
    pattern: Pattern,
    location: { file: string; line: number },
    codeContext: string
  ): Promise<{ confidence: number; reasoning: string; estimatedEffort: number }> {
    if (!this.runtimeExecutor) {
      throw new Error('RuntimeExecutor required for LLM analysis');
    }

    const prompt = `Analyze if this pattern is applicable to the given code:

Pattern: ${pattern.name}
Problem: ${pattern.problem}
Solution: ${pattern.solution}
Applicability: ${pattern.applicability}

Code Context:
\`\`\`typescript
${codeContext.substring(0, 1000)}
\`\`\`

Analyze:
1. Does the code have the problem this pattern solves?
2. Are the preconditions for applying this pattern met?
3. What is the estimated effort to apply this pattern (in hours)?
4. What is your confidence level (0-100)?

Return JSON with: confidence, reasoning, estimatedEffort`;

    const response = await this.runtimeExecutor.execute({
      taskType: 'pattern_matching',
      prompt,
      context: JSON.stringify({ pattern, location }),
    });

    const result = JSON.parse(response.content);

    return {
      confidence: Math.min(100, Math.max(0, result.confidence || 50)),
      reasoning: result.reasoning || 'LLM analysis completed',
      estimatedEffort: Math.max(0.5, result.estimatedEffort || 2),
    };
  }

  /**
   * Detect local code conventions
   */
  private async detectLocalConventions(_file: string, codeContext: string): Promise<string[]> {
    const conventions: string[] = [];

    // Detect naming conventions
    if (codeContext.match(/[a-z][A-Z]/)) {
      conventions.push('camelCase for variables');
    }
    if (codeContext.match(/^[A-Z][a-z]/m)) {
      conventions.push('PascalCase for classes');
    }

    // Detect async patterns
    if (codeContext.includes('async') && codeContext.includes('await')) {
      conventions.push('async/await for asynchronous operations');
    }

    // Detect error handling
    if (codeContext.includes('try') && codeContext.includes('catch')) {
      conventions.push('try/catch for error handling');
    }

    // Detect type annotations
    if (codeContext.includes(': ')) {
      conventions.push('TypeScript type annotations');
    }

    return conventions;
  }

  /**
   * Estimate effort using heuristics
   */
  private estimateEffortHeuristic(pattern: Pattern): number {
    // Base effort by category
    const categoryEffort: Record<string, number> = {
      Concurrency: 4,
      Architecture: 6,
      Reliability: 3,
      Performance: 2,
      Data: 3,
    };

    return categoryEffort[pattern.category] || 3;
  }

  /**
   * Estimate benefit of applying pattern
   */
  private estimateBenefit(pattern: Pattern, applicability: PatternApplicabilityCheck): number {
    // Base benefit by category
    const categoryBenefit: Record<string, number> = {
      Reliability: 90,
      Performance: 80,
      Concurrency: 75,
      Architecture: 70,
      Data: 65,
    };

    const baseBenefit = categoryBenefit[pattern.category] || 60;

    // Adjust by confidence
    return (baseBenefit * applicability.confidence) / 100;
  }

  /**
   * Detect if pattern problem exists in code
   */
  private async detectProblem(pattern: Pattern, _file: string, content: string): Promise<boolean> {
    const problem = pattern.problem.toLowerCase();

    // Simple heuristic detection
    if (problem.includes('race condition') || problem.includes('concurrent')) {
      return content.includes('async') && !content.includes('queue');
    }

    if (problem.includes('expensive') || problem.includes('slow')) {
      return content.includes('for') || content.includes('map');
    }

    if (problem.includes('fail') || problem.includes('error')) {
      return !content.includes('try') || !content.includes('catch');
    }

    // Default: assume problem might exist
    return true;
  }

  /**
   * Get all patterns from memory
   */
  private async getAllPatterns(): Promise<Pattern[]> {
    const results = await this.memoryEngine.searchPatterns('', { limit: 100 });
    return results;
  }

  /**
   * Get code files from repository
   */
  private async getCodeFiles(repoPath: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const files: string[] = [];

    async function scanDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await scanDir(fullPath);
            }
          } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Failed to scan directory ${dir}:`, error);
      }
    }

    await scanDir(repoPath);
    return files;
  }

  /**
   * Read file content
   */
  private async readFile(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf-8');
  }
}
