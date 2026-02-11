/**
 * Code Quality Service
 * 
 * Integrates code quality analysis with Memory and Runtime engines.
 * Uses Memory Engine to retrieve code and Runtime Engine for LLM analysis.
 * Stores results back in Memory Engine.
 * 
 * Task 31.1: Wire code quality analysis
 */

import { MemoryEngine } from '../memory/engine';
import { RuntimeExecutor } from '../runtime/runtime-executor';
import { CodeQualityAnalyzer } from './code-quality-analyzer';
import { IssueRanker } from './issue-ranker';
import {
  QualityAnalysisResult,
  QualityIssue,
  AnalysisOptions,
  IssueSeverity,
} from './types';
import { TaskType } from '../runtime/types';

/**
 * Code quality service configuration
 */
export type CodeQualityServiceConfig = {
  /** Memory engine instance */
  memoryEngine: MemoryEngine;
  /** Runtime executor instance */
  runtimeExecutor: RuntimeExecutor;
  /** Enable LLM-based suggestions */
  enableLLMSuggestions?: boolean;
  /** Minimum severity for LLM analysis */
  llmMinSeverity?: IssueSeverity;
};

/**
 * Code Quality Service
 * 
 * Orchestrates code quality analysis using Memory and Runtime engines.
 */
export class CodeQualityService {
  private memoryEngine: MemoryEngine;
  private runtimeExecutor: RuntimeExecutor;
  private analyzer: CodeQualityAnalyzer;
  private ranker: IssueRanker;
  private enableLLMSuggestions: boolean;
  private llmMinSeverity: IssueSeverity;

  constructor(config: CodeQualityServiceConfig) {
    this.memoryEngine = config.memoryEngine;
    this.runtimeExecutor = config.runtimeExecutor;
    this.analyzer = new CodeQualityAnalyzer();
    this.ranker = new IssueRanker();
    this.enableLLMSuggestions = config.enableLLMSuggestions ?? true;
    this.llmMinSeverity = config.llmMinSeverity ?? IssueSeverity.MEDIUM;
  }

  /**
   * Analyze a file by path
   * 
   * Retrieves code from Memory Engine, analyzes it, and stores results.
   * 
   * @param filePath - Path to the file to analyze
   * @param options - Analysis options
   * @returns Quality analysis result
   */
  async analyzeFile(
    filePath: string,
    options: AnalysisOptions = {}
  ): Promise<QualityAnalysisResult> {
    // Retrieve code from Memory Engine
    const sourceCode = await this.retrieveCode(filePath);

    // Perform static analysis
    const result = await this.analyzer.analyze(filePath, sourceCode, options);

    // Rank issues
    const rankedIssues = this.ranker.rankIssues(result.issues);
    result.issues = rankedIssues;

    // Enhance with LLM suggestions if enabled
    if (this.enableLLMSuggestions && result.issues.length > 0) {
      await this.enhanceWithLLMSuggestions(result);
    }

    // Store results in Memory Engine
    await this.storeAnalysisResult(result);

    return result;
  }

  /**
   * Analyze multiple files
   * 
   * @param filePaths - Paths to files to analyze
   * @param options - Analysis options
   * @returns Array of quality analysis results
   */
  async analyzeFiles(
    filePaths: string[],
    options: AnalysisOptions = {}
  ): Promise<QualityAnalysisResult[]> {
    const results: QualityAnalysisResult[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.analyzeFile(filePath, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to analyze ${filePath}:`, error);
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Retrieve code from Memory Engine
   * 
   * @param filePath - Path to the file
   * @returns Source code content
   */
  private async retrieveCode(filePath: string): Promise<string> {
    // Query Memory Engine for file chunks and reconstruct content
    const prometheusDb = this.memoryEngine.getDatabase();
    const db = prometheusDb.getDb();
    
    // Get all chunks for this file, ordered by start_line
    const chunks = db.prepare(`
      SELECT text
      FROM code_chunks
      WHERE file_path = ?
      ORDER BY start_line ASC
    `).all(filePath) as Array<{ text: string }>;

    if (chunks.length === 0) {
      throw new Error(`File not found in index: ${filePath}`);
    }

    // Reconstruct file content from chunks
    // Note: This is a simplified reconstruction. In production, we'd handle overlaps better.
    return chunks.map(c => c.text).join('\n');
  }

  /**
   * Enhance issues with LLM-based suggestions
   * 
   * Uses Runtime Engine to generate detailed suggestions for high-severity issues.
   * 
   * @param result - Quality analysis result to enhance
   */
  private async enhanceWithLLMSuggestions(result: QualityAnalysisResult): Promise<void> {
    // Filter issues that need LLM enhancement
    const severityOrder = {
      [IssueSeverity.LOW]: 1,
      [IssueSeverity.MEDIUM]: 2,
      [IssueSeverity.HIGH]: 3,
      [IssueSeverity.CRITICAL]: 4,
    };
    const minLevel = severityOrder[this.llmMinSeverity];

    const issuesForLLM = result.issues.filter(
      (issue) => !issue.suggestion || severityOrder[issue.severity] >= minLevel
    );

    if (issuesForLLM.length === 0) {
      return;
    }

    // Generate suggestions using LLM
    for (const issue of issuesForLLM) {
      try {
        const suggestion = await this.generateLLMSuggestion(issue, result.filePath);
        issue.suggestion = suggestion;
      } catch (error) {
        console.error(`Failed to generate LLM suggestion for issue ${issue.id}:`, error);
        // Keep existing suggestion or leave empty
      }
    }
  }

  /**
   * Generate LLM-based suggestion for an issue
   * 
   * @param issue - Quality issue
   * @param filePath - File path for context
   * @returns Detailed suggestion
   */
  private async generateLLMSuggestion(issue: QualityIssue, filePath: string): Promise<string> {
    const prompt = `You are a code quality expert. Analyze this code quality issue and provide a specific, actionable suggestion for fixing it.

File: ${filePath}
Issue Type: ${issue.type}
Severity: ${issue.severity}
Description: ${issue.description}
Location: Lines ${issue.startLine}-${issue.endLine}

Code:
\`\`\`
${issue.codeSnippet}
\`\`\`

Provide a concise, specific suggestion for fixing this issue. Include:
1. What to change
2. Why it improves code quality
3. Example of improved code (if applicable)

Keep your response under 200 words.`;

    const response = await this.runtimeExecutor.execute({
      taskType: TaskType.CODE_ANALYSIS,
      prompt,
      systemPrompt: 'You are a code quality expert providing actionable refactoring suggestions.',
      maxTokens: 500,
    });

    return response.trim();
  }

  /**
   * Store analysis result in Memory Engine
   * 
   * @param result - Quality analysis result
   */
  private async storeAnalysisResult(result: QualityAnalysisResult): Promise<void> {
    const prometheusDb = this.memoryEngine.getDatabase();
    const db = prometheusDb.getDb();

    // Create table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS quality_analysis_results (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        quality_score REAL NOT NULL,
        issue_count INTEGER NOT NULL,
        cyclomatic_complexity REAL NOT NULL,
        lines_of_code INTEGER NOT NULL,
        analyzed_at INTEGER NOT NULL,
        result_json TEXT NOT NULL
      )
    `);

    // Store result
    const id = `${result.filePath}-${result.analyzedAt}`;
    db.prepare(`
      INSERT OR REPLACE INTO quality_analysis_results
      (id, file_path, quality_score, issue_count, cyclomatic_complexity, lines_of_code, analyzed_at, result_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      result.filePath,
      result.qualityScore,
      result.issues.length,
      result.complexity.cyclomaticComplexity,
      result.complexity.linesOfCode,
      result.analyzedAt,
      JSON.stringify(result)
    );
  }

  /**
   * Retrieve analysis results for a file
   * 
   * @param filePath - Path to the file
   * @param limit - Maximum number of results to return
   * @returns Array of quality analysis results
   */
  async getAnalysisHistory(
    filePath: string,
    limit: number = 10
  ): Promise<QualityAnalysisResult[]> {
    const prometheusDb = this.memoryEngine.getDatabase();
    const db = prometheusDb.getDb();

    const rows = db.prepare(`
      SELECT result_json
      FROM quality_analysis_results
      WHERE file_path = ?
      ORDER BY analyzed_at DESC
      LIMIT ?
    `).all(filePath, limit) as Array<{ result_json: string }>;

    return rows.map((row) => JSON.parse(row.result_json) as QualityAnalysisResult);
  }

  /**
   * Get quality trends for a file
   * 
   * @param filePath - Path to the file
   * @returns Quality trend data
   */
  async getQualityTrends(filePath: string): Promise<{
    scores: Array<{ timestamp: number; score: number }>;
    issueCount: Array<{ timestamp: number; count: number }>;
    complexity: Array<{ timestamp: number; complexity: number }>;
  }> {
    const prometheusDb = this.memoryEngine.getDatabase();
    const db = prometheusDb.getDb();

    const rows = db.prepare(`
      SELECT analyzed_at, quality_score, issue_count, cyclomatic_complexity
      FROM quality_analysis_results
      WHERE file_path = ?
      ORDER BY analyzed_at ASC
    `).all(filePath) as Array<{
      analyzed_at: number;
      quality_score: number;
      issue_count: number;
      cyclomatic_complexity: number;
    }>;

    return {
      scores: rows.map((r) => ({ timestamp: r.analyzed_at, score: r.quality_score })),
      issueCount: rows.map((r) => ({ timestamp: r.analyzed_at, count: r.issue_count })),
      complexity: rows.map((r) => ({ timestamp: r.analyzed_at, complexity: r.cyclomatic_complexity })),
    };
  }
}

/**
 * Create a code quality service instance
 * 
 * @param config - Service configuration
 * @returns Code quality service instance
 */
export function createCodeQualityService(config: CodeQualityServiceConfig): CodeQualityService {
  return new CodeQualityService(config);
}
