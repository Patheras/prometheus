/**
 * Promotion Request Builder
 * 
 * Builds comprehensive promotion requests with:
 * - Detailed change summaries
 * - Formatted test results
 * - Visual impact assessment
 * - Interactive rollback plans
 * - Validation and quality checks
 */

import { PromotionRequest, ChangeDescription, TestResults, ImpactAssessment, RollbackPlan } from './dev-prod-manager';
import { SelfImprovementTask } from './self-improvement-workflow';

export interface PromotionRequestTemplate {
  title: string;
  description: string;
  changes: ChangeDescription[];
  testResults: TestResults;
  impactAssessment: ImpactAssessment;
  rollbackPlan: RollbackPlan;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FormattedPromotionRequest {
  markdown: string;
  html: string;
  json: string;
  summary: PromotionSummary;
}

export interface PromotionSummary {
  totalFiles: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  testsPassed: boolean;
  coverage?: number;
  riskLevel: string;
  estimatedDowntime: number;
  rollbackTime: number;
}

/**
 * Promotion Request Builder
 * 
 * Creates well-formatted, validated promotion requests
 */
export class PromotionRequestBuilder {
  private template: Partial<PromotionRequestTemplate> = {};

  /**
   * Set title
   */
  setTitle(title: string): this {
    this.template.title = title;
    return this;
  }

  /**
   * Set description
   */
  setDescription(description: string): this {
    this.template.description = description;
    return this;
  }

  /**
   * Add changes
   */
  setChanges(changes: ChangeDescription[]): this {
    this.template.changes = changes;
    return this;
  }

  /**
   * Add single change
   */
  addChange(change: ChangeDescription): this {
    if (!this.template.changes) {
      this.template.changes = [];
    }
    this.template.changes.push(change);
    return this;
  }

  /**
   * Set test results
   */
  setTestResults(results: TestResults): this {
    this.template.testResults = results;
    return this;
  }

  /**
   * Set impact assessment
   */
  setImpactAssessment(assessment: ImpactAssessment): this {
    this.template.impactAssessment = assessment;
    return this;
  }

  /**
   * Set rollback plan
   */
  setRollbackPlan(plan: RollbackPlan): this {
    this.template.rollbackPlan = plan;
    return this;
  }

  /**
   * Set metadata
   */
  setMetadata(metadata: Record<string, any>): this {
    this.template.metadata = metadata;
    return this;
  }

  /**
   * Build from self-improvement task
   */
  fromTask(task: SelfImprovementTask): this {
    this.setTitle(task.title);
    this.setDescription(task.description);

    if (task.changes) {
      this.setChanges(task.changes);
    }

    if (task.testResults) {
      this.setTestResults(task.testResults);
    }

    this.setMetadata({
      taskId: task.id,
      category: task.category,
      priority: task.priority,
      estimatedEffort: task.estimatedEffort,
      expectedBenefit: task.expectedBenefit,
    });

    return this;
  }

  /**
   * Validate the promotion request
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!this.template.title) {
      errors.push('Title is required');
    }

    if (!this.template.description) {
      errors.push('Description is required');
    }

    if (!this.template.changes || this.template.changes.length === 0) {
      errors.push('At least one change is required');
    }

    if (!this.template.testResults) {
      errors.push('Test results are required');
    } else {
      // Validate test results
      if (!this.template.testResults.passed) {
        errors.push('All tests must pass before creating promotion request');
      }

      if (this.template.testResults.failedTests > 0) {
        errors.push(`${this.template.testResults.failedTests} test(s) failed`);
      }
    }

    if (!this.template.impactAssessment) {
      errors.push('Impact assessment is required');
    } else {
      // Warnings for high-risk changes
      if (this.template.impactAssessment.risk === 'high') {
        warnings.push('This is a high-risk change - extra caution recommended');
      }

      if (this.template.impactAssessment.estimatedDowntime > 0) {
        warnings.push(`Estimated downtime: ${this.template.impactAssessment.estimatedDowntime} minutes`);
      }
    }

    if (!this.template.rollbackPlan) {
      errors.push('Rollback plan is required');
    } else {
      // Warnings for complex rollbacks
      if (this.template.rollbackPlan.rollbackComplexity === 'complex') {
        warnings.push('Rollback is complex - ensure backup is available');
      }

      if (this.template.rollbackPlan.dataBackupRequired) {
        warnings.push('Data backup is required before deployment');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Build the promotion request template
   */
  build(): PromotionRequestTemplate {
    const validation = this.validate();

    if (!validation.valid) {
      throw new Error(
        `Invalid promotion request: ${validation.errors.join(', ')}`
      );
    }

    return this.template as PromotionRequestTemplate;
  }

  /**
   * Build and format the promotion request
   */
  buildFormatted(): FormattedPromotionRequest {
    const template = this.build();

    return {
      markdown: this.formatMarkdown(template),
      html: this.formatHTML(template),
      json: JSON.stringify(template, null, 2),
      summary: this.generateSummary(template),
    };
  }

  /**
   * Format as Markdown
   */
  private formatMarkdown(template: PromotionRequestTemplate): string {
    let md = `# ${template.title}\n\n`;
    md += `${template.description}\n\n`;

    // Summary
    const summary = this.generateSummary(template);
    md += `## Summary\n\n`;
    md += `- **Files Changed**: ${summary.totalFiles}\n`;
    md += `- **Lines Added**: +${summary.totalLinesAdded}\n`;
    md += `- **Lines Removed**: -${summary.totalLinesRemoved}\n`;
    md += `- **Tests**: ${summary.testsPassed ? '✅ All Passed' : '❌ Failed'}\n`;
    if (summary.coverage) {
      md += `- **Coverage**: ${summary.coverage}%\n`;
    }
    md += `- **Risk Level**: ${this.getRiskEmoji(summary.riskLevel)} ${summary.riskLevel.toUpperCase()}\n`;
    md += `- **Estimated Downtime**: ${summary.estimatedDowntime} minutes\n`;
    md += `- **Rollback Time**: ${summary.rollbackTime} minutes\n\n`;

    // Changes
    md += `## Changes\n\n`;
    for (const change of template.changes) {
      const icon = this.getChangeIcon(change.type);
      md += `### ${icon} ${change.file}\n\n`;
      md += `**Type**: ${change.type}\n\n`;
      md += `**Summary**: ${change.summary}\n\n`;
      md += `**Stats**: +${change.linesAdded} -${change.linesRemoved}\n\n`;
    }

    // Test Results
    md += `## Test Results\n\n`;
    md += `- **Total Tests**: ${template.testResults.totalTests}\n`;
    md += `- **Passed**: ✅ ${template.testResults.passedTests}\n`;
    md += `- **Failed**: ${template.testResults.failedTests > 0 ? '❌' : '✅'} ${template.testResults.failedTests}\n`;
    md += `- **Duration**: ${template.testResults.duration}ms\n`;
    if (template.testResults.coverage) {
      md += `- **Coverage**: ${template.testResults.coverage}%\n`;
    }

    if (template.testResults.failures.length > 0) {
      md += `\n### Failures\n\n`;
      for (const failure of template.testResults.failures) {
        md += `- **${failure.test}**: ${failure.error}\n`;
      }
    }
    md += `\n`;

    // Impact Assessment
    md += `## Impact Assessment\n\n`;
    md += `### Risk Level: ${this.getRiskEmoji(template.impactAssessment.risk)} ${template.impactAssessment.risk.toUpperCase()}\n\n`;
    md += `- **Affected Components**: ${template.impactAssessment.affectedComponents.join(', ')}\n`;
    md += `- **Estimated Downtime**: ${template.impactAssessment.estimatedDowntime} minutes\n`;
    md += `- **Rollback Complexity**: ${template.impactAssessment.rollbackComplexity}\n\n`;

    md += `### Benefits\n\n`;
    for (const benefit of template.impactAssessment.benefits) {
      md += `- ✅ ${benefit}\n`;
    }
    md += `\n`;

    md += `### Risks\n\n`;
    for (const risk of template.impactAssessment.risks) {
      md += `- ⚠️ ${risk}\n`;
    }
    md += `\n`;

    // Rollback Plan
    md += `## Rollback Plan\n\n`;
    md += `- **Estimated Time**: ${template.rollbackPlan.estimatedTime} minutes\n`;
    md += `- **Data Backup Required**: ${template.rollbackPlan.dataBackupRequired ? '✅ Yes' : '❌ No'}\n`;
    md += `- **Automatable**: ${template.rollbackPlan.automatable ? '✅ Yes' : '❌ No'}\n\n`;

    md += `### Steps\n\n`;
    for (let i = 0; i < template.rollbackPlan.steps.length; i++) {
      md += `${i + 1}. ${template.rollbackPlan.steps[i]}\n`;
    }
    md += `\n`;

    return md;
  }

  /**
   * Format as HTML
   */
  private formatHTML(template: PromotionRequestTemplate): string {
    const summary = this.generateSummary(template);

    let html = `<div class="promotion-request">\n`;
    html += `  <h1>${this.escapeHtml(template.title)}</h1>\n`;
    html += `  <p>${this.escapeHtml(template.description)}</p>\n`;

    // Summary card
    html += `  <div class="summary-card">\n`;
    html += `    <h2>Summary</h2>\n`;
    html += `    <div class="stats">\n`;
    html += `      <div class="stat"><span class="label">Files:</span> <span class="value">${summary.totalFiles}</span></div>\n`;
    html += `      <div class="stat"><span class="label">Added:</span> <span class="value text-success">+${summary.totalLinesAdded}</span></div>\n`;
    html += `      <div class="stat"><span class="label">Removed:</span> <span class="value text-danger">-${summary.totalLinesRemoved}</span></div>\n`;
    html += `      <div class="stat"><span class="label">Tests:</span> <span class="value ${summary.testsPassed ? 'text-success' : 'text-danger'}">${summary.testsPassed ? '✅ Passed' : '❌ Failed'}</span></div>\n`;
    html += `      <div class="stat"><span class="label">Risk:</span> <span class="value risk-${summary.riskLevel}">${this.getRiskEmoji(summary.riskLevel)} ${summary.riskLevel.toUpperCase()}</span></div>\n`;
    html += `    </div>\n`;
    html += `  </div>\n`;

    // Changes
    html += `  <div class="changes">\n`;
    html += `    <h2>Changes</h2>\n`;
    for (const change of template.changes) {
      html += `    <div class="change change-${change.type}">\n`;
      html += `      <h3>${this.getChangeIcon(change.type)} ${this.escapeHtml(change.file)}</h3>\n`;
      html += `      <p>${this.escapeHtml(change.summary)}</p>\n`;
      html += `      <div class="stats"><span class="added">+${change.linesAdded}</span> <span class="removed">-${change.linesRemoved}</span></div>\n`;
      html += `    </div>\n`;
    }
    html += `  </div>\n`;

    // Test Results
    html += `  <div class="test-results">\n`;
    html += `    <h2>Test Results</h2>\n`;
    html += `    <div class="progress-bar">\n`;
    const passPercentage = (template.testResults.passedTests / template.testResults.totalTests) * 100;
    html += `      <div class="progress" style="width: ${passPercentage}%"></div>\n`;
    html += `    </div>\n`;
    html += `    <p>${template.testResults.passedTests}/${template.testResults.totalTests} tests passed</p>\n`;
    html += `  </div>\n`;

    // Impact Assessment
    html += `  <div class="impact-assessment">\n`;
    html += `    <h2>Impact Assessment</h2>\n`;
    html += `    <div class="risk-badge risk-${template.impactAssessment.risk}">${this.getRiskEmoji(template.impactAssessment.risk)} ${template.impactAssessment.risk.toUpperCase()}</div>\n`;
    html += `    <div class="benefits">\n`;
    html += `      <h3>Benefits</h3>\n`;
    html += `      <ul>\n`;
    for (const benefit of template.impactAssessment.benefits) {
      html += `        <li>✅ ${this.escapeHtml(benefit)}</li>\n`;
    }
    html += `      </ul>\n`;
    html += `    </div>\n`;
    html += `    <div class="risks">\n`;
    html += `      <h3>Risks</h3>\n`;
    html += `      <ul>\n`;
    for (const risk of template.impactAssessment.risks) {
      html += `        <li>⚠️ ${this.escapeHtml(risk)}</li>\n`;
    }
    html += `      </ul>\n`;
    html += `    </div>\n`;
    html += `  </div>\n`;

    html += `</div>\n`;

    return html;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(template: PromotionRequestTemplate): PromotionSummary {
    const totalLinesAdded = template.changes.reduce((sum, c) => sum + c.linesAdded, 0);
    const totalLinesRemoved = template.changes.reduce((sum, c) => sum + c.linesRemoved, 0);

    return {
      totalFiles: template.changes.length,
      totalLinesAdded,
      totalLinesRemoved,
      testsPassed: template.testResults.passed,
      coverage: template.testResults.coverage,
      riskLevel: template.impactAssessment.risk,
      estimatedDowntime: template.impactAssessment.estimatedDowntime,
      rollbackTime: template.rollbackPlan.estimatedTime,
    };
  }

  /**
   * Get risk emoji
   */
  private getRiskEmoji(risk: string): string {
    switch (risk) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  }

  /**
   * Get change icon
   */
  private getChangeIcon(type: string): string {
    switch (type) {
      case 'added': return '➕';
      case 'modified': return '✏️';
      case 'deleted': return '🗑️';
      default: return '📄';
    }
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Reset builder
   */
  reset(): this {
    this.template = {};
    return this;
  }
}

/**
 * Create a new promotion request builder
 */
export function createPromotionRequestBuilder(): PromotionRequestBuilder {
  return new PromotionRequestBuilder();
}
