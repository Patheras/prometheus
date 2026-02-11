/**
 * Debt Quantifier
 * 
 * Uses LLM to estimate effort required to fix technical debt items.
 * 
 * Task 27.2: Implement debt quantification
 */

import { TechnicalDebtItem } from './types';
import { RuntimeEngine } from '../runtime';

/**
 * Debt Quantifier
 * 
 * Estimates effort to fix technical debt using LLM analysis.
 */
export class DebtQuantifier {
  constructor(private runtimeEngine: RuntimeEngine) {}

  /**
   * Quantify a single debt item
   * 
   * Uses LLM to estimate hours required to fix the debt.
   * 
   * @param debt - Technical debt item
   * @param context - Optional additional context
   * @returns Estimated hours
   */
  async quantifyDebt(debt: TechnicalDebtItem, context?: string): Promise<number> {
    // Build prompt for LLM
    const prompt = this.buildQuantificationPrompt(debt, context);

    try {
      // Use RuntimeEngine to get LLM estimate
      const response = await this.runtimeEngine.execute({
        taskType: 'decision_making',
        prompt,
        systemPrompt: 'You are a technical debt analyst. Estimate effort in hours to fix issues.',
        maxTokens: 200,
      });

      // Parse estimate from response
      const estimate = this.parseEstimate(response.content);

      // Validate and return
      return Math.max(0.5, Math.min(estimate, 100)); // Clamp between 0.5 and 100 hours
    } catch (error) {
      // Fallback to heuristic if LLM fails
      return this.heuristicEstimate(debt);
    }
  }

  /**
   * Quantify multiple debt items in batch
   * 
   * @param debts - Array of technical debt items
   * @param context - Optional additional context
   * @returns Array of debt items with updated effort estimates
   */
  async quantifyDebts(
    debts: TechnicalDebtItem[],
    context?: string
  ): Promise<TechnicalDebtItem[]> {
    const quantified: TechnicalDebtItem[] = [];

    for (const debt of debts) {
      const effortHours = await this.quantifyDebt(debt, context);
      quantified.push({
        ...debt,
        effortHours,
      });
    }

    return quantified;
  }

  /**
   * Build quantification prompt for LLM
   */
  private buildQuantificationPrompt(debt: TechnicalDebtItem, context?: string): string {
    let prompt = `Estimate the effort in hours to fix this technical debt:\n\n`;
    prompt += `Type: ${debt.type}\n`;
    prompt += `Description: ${debt.description}\n`;

    if (debt.filePath) {
      prompt += `File: ${debt.filePath}\n`;
    }

    if (debt.lineNumber) {
      prompt += `Line: ${debt.lineNumber}\n`;
    }

    if (context) {
      prompt += `\nContext:\n${context}\n`;
    }

    prompt += `\nProvide a realistic estimate in hours (0.5 to 100). Consider:`;
    prompt += `\n- Complexity of the fix`;
    prompt += `\n- Testing requirements`;
    prompt += `\n- Documentation updates`;
    prompt += `\n- Code review time`;
    prompt += `\n\nRespond with just the number of hours (e.g., "3.5" or "8").`;

    return prompt;
  }

  /**
   * Parse estimate from LLM response
   */
  private parseEstimate(response: string): number {
    // Try to extract number from response
    const match = response.match(/(\d+\.?\d*)/);

    if (match) {
      return parseFloat(match[1]);
    }

    // Fallback
    return 2;
  }

  /**
   * Heuristic estimate (fallback when LLM unavailable)
   */
  private heuristicEstimate(debt: TechnicalDebtItem): number {
    switch (debt.type) {
      case 'todo_comment':
        return 1;
      case 'outdated_dependency':
        return 2;
      case 'missing_test':
        return 3;
      case 'architectural_violation':
        return 8;
      default:
        return 2;
    }
  }

  /**
   * Calculate total debt for a codebase
   * 
   * @param debts - Array of technical debt items
   * @returns Total estimated hours
   */
  calculateTotalDebt(debts: TechnicalDebtItem[]): number {
    return debts.reduce((sum, debt) => sum + debt.effortHours, 0);
  }

  /**
   * Prioritize debt items by ROI (Return on Investment)
   * 
   * ROI = (Priority / Effort)
   * Higher ROI = better to fix first
   * 
   * @param debts - Array of technical debt items
   * @returns Sorted array (highest ROI first)
   */
  prioritizeByROI(debts: TechnicalDebtItem[]): TechnicalDebtItem[] {
    return [...debts].sort((a, b) => {
      const roiA = a.priority / a.effortHours;
      const roiB = b.priority / b.effortHours;
      return roiB - roiA;
    });
  }

  /**
   * Group debt by effort range
   * 
   * @param debts - Array of technical debt items
   * @returns Grouped debt items
   */
  groupByEffort(debts: TechnicalDebtItem[]): {
    quick: TechnicalDebtItem[]; // < 2 hours
    medium: TechnicalDebtItem[]; // 2-8 hours
    large: TechnicalDebtItem[]; // > 8 hours
  } {
    return {
      quick: debts.filter((d) => d.effortHours < 2),
      medium: debts.filter((d) => d.effortHours >= 2 && d.effortHours <= 8),
      large: debts.filter((d) => d.effortHours > 8),
    };
  }
}

/**
 * Create a debt quantifier instance
 * 
 * @param runtimeEngine - Runtime engine for LLM calls
 * @returns Debt quantifier instance
 */
export function createDebtQuantifier(runtimeEngine: RuntimeEngine): DebtQuantifier {
  return new DebtQuantifier(runtimeEngine);
}
