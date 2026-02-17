/**
 * Code Quality Analyzer
 * 
 * Analyzes code quality by parsing TypeScript/JavaScript to AST,
 * calculating complexity metrics, detecting code smells, and
 * identifying duplication.
 * 
 * Task 26.1: Create code parsing and AST analysis
 */

import * as ts from 'typescript';
import { randomUUID } from 'crypto';
import {
  QualityIssue,
  QualityAnalysisResult,
  ComplexityMetrics,
  DuplicationResult,
  IssueType,
  IssueSeverity,
  AnalysisOptions,
} from './types';

/**
 * Code Quality Analyzer
 * 
 * Parses TypeScript/JavaScript code and analyzes quality metrics.
 */
export class CodeQualityAnalyzer {
  private sourceFile: ts.SourceFile | null = null;
  private filePath: string = '';
  private sourceCode: string = '';

  /**
   * Analyze a code file
   * 
   * @param filePath - Path to the file
   * @param sourceCode - Source code content
   * @param options - Analysis options
   * @returns Quality analysis result
   */
  async analyze(
    filePath: string,
    sourceCode: string,
    options: AnalysisOptions = {}
  ): Promise<QualityAnalysisResult> {
    this.filePath = filePath;
    this.sourceCode = sourceCode;

    // Parse code to AST
    this.sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const issues: QualityIssue[] = [];

    // Analyze complexity
    if (options.includeComplexity !== false) {
      const complexityIssues = this.analyzeComplexity();
      issues.push(...complexityIssues);
    }

    // Detect code smells
    if (options.includeCodeSmells !== false) {
      const codeSmells = this.detectCodeSmells();
      issues.push(...codeSmells);
    }

    // Calculate overall complexity metrics
    const complexity = this.calculateComplexityMetrics();

    // Detect duplication (placeholder - requires multiple files)
    const duplications: DuplicationResult[] = [];

    // Filter by severity
    let filteredIssues = issues;
    if (options.minSeverity) {
      const severityOrder = {
        [IssueSeverity.LOW]: 1,
        [IssueSeverity.MEDIUM]: 2,
        [IssueSeverity.HIGH]: 3,
        [IssueSeverity.CRITICAL]: 4,
      };
      const minLevel = severityOrder[options.minSeverity];
      filteredIssues = issues.filter(
        (issue) => severityOrder[issue.severity] >= minLevel
      );
    }

    // Limit results
    if (options.maxIssues && filteredIssues.length > options.maxIssues) {
      filteredIssues = filteredIssues.slice(0, options.maxIssues);
    }

    // Calculate quality score (0-100)
    const qualityScore = this.calculateQualityScore(filteredIssues, complexity);

    return {
      filePath,
      issues: filteredIssues,
      complexity,
      duplications,
      qualityScore,
      analyzedAt: Date.now(),
    };
  }

  /**
   * Analyze complexity and detect high complexity issues
   */
  private analyzeComplexity(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    if (!this.sourceFile) return issues;

    const visit = (node: ts.Node) => {
      // Check functions and methods
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      ) {
        const complexity = this.calculateCyclomaticComplexity(node);
        const name = this.getFunctionName(node);
        const { line } = this.sourceFile!.getLineAndCharacterOfPosition(node.getStart());

        // High complexity threshold
        if (complexity > 5) {
          issues.push({
            id: randomUUID(),
            type: IssueType.COMPLEXITY,
            severity: complexity > 15 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
            filePath: this.filePath,
            startLine: line + 1,
            endLine: line + 1,
            description: `Function '${name}' has high cyclomatic complexity (${complexity})`,
            codeSnippet: this.getCodeSnippet(node),
            suggestion: 'Consider breaking this function into smaller, more focused functions',
            effortHours: Math.ceil(complexity / 5),
            impactScore: Math.min(complexity * 5, 100),
            detectedAt: Date.now(),
          });
        }

        // Long method detection
        const lineCount = this.getLineCount(node);
        if (lineCount > 50) {
          issues.push({
            id: randomUUID(),
            type: IssueType.LONG_METHOD,
            severity: lineCount > 100 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
            filePath: this.filePath,
            startLine: line + 1,
            endLine: line + lineCount,
            description: `Function '${name}' is too long (${lineCount} lines)`,
            codeSnippet: this.getCodeSnippet(node),
            suggestion: 'Consider extracting logical blocks into separate functions',
            effortHours: Math.ceil(lineCount / 20),
            impactScore: Math.min(lineCount, 100),
            detectedAt: Date.now(),
          });
        }

        // Parameter count check
        const paramCount = this.getParameterCount(node);
        if (paramCount > 5) {
          issues.push({
            id: randomUUID(),
            type: IssueType.CODE_SMELL,
            severity: IssueSeverity.MEDIUM,
            filePath: this.filePath,
            startLine: line + 1,
            endLine: line + 1,
            description: `Function '${name}' has too many parameters (${paramCount})`,
            codeSnippet: this.getCodeSnippet(node),
            suggestion: 'Consider using an options object or splitting the function',
            effortHours: 2,
            impactScore: paramCount * 10,
            detectedAt: Date.now(),
          });
        }
      }

      // Check classes
      if (ts.isClassDeclaration(node)) {
        const name = node.name?.text || 'Anonymous';
        const { line } = this.sourceFile!.getLineAndCharacterOfPosition(node.getStart());
        const lineCount = this.getLineCount(node);

        // Large class detection
        if (lineCount > 100) {
          issues.push({
            id: randomUUID(),
            type: IssueType.LARGE_CLASS,
            severity: lineCount > 300 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
            filePath: this.filePath,
            startLine: line + 1,
            endLine: line + lineCount,
            description: `Class '${name}' is too large (${lineCount} lines)`,
            codeSnippet: this.getCodeSnippet(node),
            suggestion: 'Consider splitting into multiple classes with single responsibilities',
            effortHours: Math.ceil(lineCount / 50),
            impactScore: Math.min(lineCount / 3, 100),
            detectedAt: Date.now(),
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return issues;
  }

  /**
   * Detect code smells
   */
  private detectCodeSmells(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    if (!this.sourceFile) return issues;

    const visit = (node: ts.Node) => {
      // Magic numbers
      if (ts.isNumericLiteral(node)) {
        const value = parseFloat(node.text);
        const parent = node.parent;

        // Skip common values and array indices
        if (
          value !== 0 &&
          value !== 1 &&
          value !== -1 &&
          !ts.isElementAccessExpression(parent) &&
          !ts.isArrayLiteralExpression(parent)
        ) {
          const { line } = this.sourceFile!.getLineAndCharacterOfPosition(node.getStart());
          issues.push({
            id: randomUUID(),
            type: IssueType.MAGIC_NUMBER,
            severity: IssueSeverity.LOW,
            filePath: this.filePath,
            startLine: line + 1,
            endLine: line + 1,
            description: `Magic number ${value} should be a named constant`,
            codeSnippet: this.getCodeSnippet(node.parent || node),
            suggestion: `Extract ${value} to a named constant`,
            effortHours: 0.5,
            impactScore: 20,
            detectedAt: Date.now(),
          });
        }
      }

      // TODO/FIXME comments
      const sourceText = node.getFullText(this.sourceFile || undefined);
      const todoMatch = sourceText.match(/\/\/\s*(TODO|FIXME|HACK|XXX):/i);
      if (todoMatch) {
        const { line } = this.sourceFile!.getLineAndCharacterOfPosition(node.getStart());
        issues.push({
          id: randomUUID(),
          type: IssueType.CODE_SMELL,
          severity: IssueSeverity.LOW,
          filePath: this.filePath,
          startLine: line + 1,
          endLine: line + 1,
          description: `${todoMatch[1]} comment found`,
          codeSnippet: sourceText.trim(),
          suggestion: 'Address the TODO/FIXME or create a task',
          effortHours: 1,
          impactScore: 10,
          detectedAt: Date.now(),
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return issues;
  }

  /**
   * Calculate cyclomatic complexity for a function
   */
  private calculateCyclomaticComplexity(node: ts.Node): number {
    let complexity = 1; // Base complexity

    const visit = (n: ts.Node) => {
      // Decision points increase complexity
      if (
        ts.isIfStatement(n) ||
        ts.isConditionalExpression(n) ||
        ts.isWhileStatement(n) ||
        ts.isDoStatement(n) ||
        ts.isForStatement(n) ||
        ts.isForInStatement(n) ||
        ts.isForOfStatement(n) ||
        ts.isCaseClause(n) ||
        ts.isCatchClause(n)
      ) {
        complexity++;
      }

      // Logical operators
      if (ts.isBinaryExpression(n)) {
        if (
          n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          n.operatorToken.kind === ts.SyntaxKind.BarBarToken
        ) {
          complexity++;
        }
      }

      ts.forEachChild(n, visit);
    };

    visit(node);
    return complexity;
  }

  /**
   * Calculate overall complexity metrics for the file
   */
  private calculateComplexityMetrics(): ComplexityMetrics {
    if (!this.sourceFile) {
      return {
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0,
        linesOfCode: 0,
        parameterCount: 0,
        nestingDepth: 0,
      };
    }

    let totalComplexity = 0;
    let functionCount = 0;
    let maxNesting = 0;
    let totalParams = 0;

    const visit = (node: ts.Node, depth: number = 0) => {
      maxNesting = Math.max(maxNesting, depth);

      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)
      ) {
        totalComplexity += this.calculateCyclomaticComplexity(node);
        totalParams += this.getParameterCount(node);
        functionCount++;
      }

      ts.forEachChild(node, (child) => visit(child, depth + 1));
    };

    visit(this.sourceFile);

    const lines = this.sourceCode.split('\n');
    const linesOfCode = lines.filter((line) => line.trim().length > 0).length;

    return {
      cyclomaticComplexity: functionCount > 0 ? Math.round(totalComplexity / functionCount) : 0,
      cognitiveComplexity: totalComplexity, // Simplified
      linesOfCode,
      parameterCount: functionCount > 0 ? Math.round(totalParams / functionCount) : 0,
      nestingDepth: maxNesting,
    };
  }

  /**
   * Calculate quality score (0-100)
   * 
   * EXTREMELY STRICT SCORING: Prometheus must be HARSH on quality issues.
   * NO HALLUCINATIONS - if there are real problems, score must be LOW.
   * Multiple issues should compound and result in very low scores.
   */
  private calculateQualityScore(issues: QualityIssue[], complexity: ComplexityMetrics): number {
    let score = 100;

    // Deduct points for issues - BE EXTREMELY STRICT
    for (const issue of issues) {
      switch (issue.severity) {
        case IssueSeverity.CRITICAL:
          score -= 25; // Critical issues are catastrophic
          break;
        case IssueSeverity.HIGH:
          score -= 15; // High severity issues are very serious
          break;
        case IssueSeverity.MEDIUM:
          score -= 8; // Medium issues matter significantly
          break;
        case IssueSeverity.LOW:
          score -= 3; // Even low issues add up
          break;
      }
    }

    // Deduct points for high complexity - BE EXTREMELY STRICT
    if (complexity.cyclomaticComplexity > 10) {
      // Exponential penalty for high complexity
      const excessComplexity = complexity.cyclomaticComplexity - 10;
      score -= excessComplexity * 8; // 8 points per unit over 10
    }
    
    // Deduct for high nesting depth - VERY STRICT
    if (complexity.nestingDepth > 5) {
      const excessNesting = complexity.nestingDepth - 5;
      score -= excessNesting * 5; // 5 points per level over 5
    }
    
    // Additional penalty for having MANY issues (compounds the problem)
    if (issues.length > 5) {
      score -= (issues.length - 5) * 2; // 2 points per issue over 5
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get function name
   */
  private getFunctionName(node: ts.Node): string {
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name.text;
    }
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name.text;
    }
    if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
      return node.parent.name.text;
    }
    return 'anonymous';
  }

  /**
   * Get parameter count
   */
  private getParameterCount(node: ts.Node): number {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      return node.parameters.length;
    }
    return 0;
  }

  /**
   * Get line count for a node
   */
  private getLineCount(node: ts.Node): number {
    if (!this.sourceFile) return 0;

    const start = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = this.sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return end.line - start.line + 1;
  }

  /**
   * Get code snippet for a node
   */
  private getCodeSnippet(node: ts.Node, maxLines: number = 5): string {
    if (!this.sourceFile) return '';

    const start = node.getStart();
    const end = node.getEnd();
    const text = this.sourceCode.substring(start, end);

    const lines = text.split('\n');
    if (lines.length <= maxLines) {
      return text;
    }

    return lines.slice(0, maxLines).join('\n') + '\n...';
  }
}

/**
 * Create a code quality analyzer instance
 */
export function createCodeQualityAnalyzer(): CodeQualityAnalyzer {
  return new CodeQualityAnalyzer();
}
