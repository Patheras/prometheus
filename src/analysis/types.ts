/**
 * Analysis Engine Types
 * 
 * Types for code quality analysis, technical debt detection,
 * performance analysis, and impact assessment.
 */

/**
 * Code quality issue severity levels
 */
export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Code quality issue types
 */
export enum IssueType {
  CODE_SMELL = 'code_smell',
  COMPLEXITY = 'complexity',
  DUPLICATION = 'duplication',
  LONG_METHOD = 'long_method',
  LARGE_CLASS = 'large_class',
  DEAD_CODE = 'dead_code',
  MAGIC_NUMBER = 'magic_number',
  NAMING = 'naming',
}

/**
 * Code quality issue
 */
export type QualityIssue = {
  /** Unique identifier */
  id: string;
  /** Issue type */
  type: IssueType;
  /** Severity level */
  severity: IssueSeverity;
  /** File path */
  filePath: string;
  /** Start line number */
  startLine: number;
  /** End line number */
  endLine: number;
  /** Issue description */
  description: string;
  /** Affected code snippet */
  codeSnippet: string;
  /** Suggested fix */
  suggestion?: string;
  /** Estimated effort to fix (hours) */
  effortHours?: number;
  /** Impact score (0-100) */
  impactScore: number;
  /** Timestamp when detected */
  detectedAt: number;
};

/**
 * Code complexity metrics
 */
export type ComplexityMetrics = {
  /** Cyclomatic complexity */
  cyclomaticComplexity: number;
  /** Cognitive complexity */
  cognitiveComplexity: number;
  /** Lines of code */
  linesOfCode: number;
  /** Number of parameters */
  parameterCount: number;
  /** Nesting depth */
  nestingDepth: number;
};

/**
 * Code duplication result
 */
export type DuplicationResult = {
  /** Hash of duplicated code */
  hash: string;
  /** Files containing this duplication */
  files: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
  }>;
  /** Number of lines duplicated */
  lineCount: number;
  /** Duplication percentage */
  percentage: number;
};

/**
 * Code quality analysis result
 */
export type QualityAnalysisResult = {
  /** File path analyzed */
  filePath: string;
  /** Quality issues found */
  issues: QualityIssue[];
  /** Complexity metrics */
  complexity: ComplexityMetrics;
  /** Duplication results */
  duplications: DuplicationResult[];
  /** Overall quality score (0-100) */
  qualityScore: number;
  /** Analysis timestamp */
  analyzedAt: number;
};

/**
 * Technical debt item
 */
export type TechnicalDebtItem = {
  /** Unique identifier */
  id: string;
  /** Debt type */
  type: 'outdated_dependency' | 'todo_comment' | 'missing_test' | 'architectural_violation';
  /** Description */
  description: string;
  /** File path (if applicable) */
  filePath?: string;
  /** Line number (if applicable) */
  lineNumber?: number;
  /** Estimated effort to fix (hours) */
  effortHours: number;
  /** Priority (1-5, 5 is highest) */
  priority: number;
  /** Detected timestamp */
  detectedAt: number;
};

/**
 * Technical debt summary
 */
export type TechnicalDebtSummary = {
  /** Total debt items */
  totalItems: number;
  /** Total estimated hours */
  totalHours: number;
  /** Debt by type */
  byType: Record<string, number>;
  /** Debt by priority */
  byPriority: Record<number, number>;
  /** Critical debt items (priority 5) */
  criticalItems: TechnicalDebtItem[];
};

/**
 * Performance bottleneck
 */
export type PerformanceBottleneck = {
  /** Unique identifier */
  id: string;
  /** Operation/endpoint name */
  operation: string;
  /** Metric type (latency, throughput, etc.) */
  metricType: string;
  /** Current value */
  currentValue: number;
  /** Expected/baseline value */
  baselineValue: number;
  /** Severity (how much worse than baseline) */
  severity: IssueSeverity;
  /** Affected users (estimated) */
  affectedUsers?: number;
  /** Suggested optimization */
  suggestion?: string;
  /** Detected timestamp */
  detectedAt: number;
};

/**
 * Performance anomaly
 */
export type PerformanceAnomaly = {
  /** Unique identifier */
  id: string;
  /** Metric name */
  metricName: string;
  /** Anomalous value */
  value: number;
  /** Mean value */
  mean: number;
  /** Standard deviation */
  stdDev: number;
  /** Z-score (how many std devs from mean) */
  zScore: number;
  /** Severity */
  severity: IssueSeverity;
  /** Timestamp */
  timestamp: number;
};

/**
 * Impact assessment
 */
export type ImpactAssessment = {
  /** Unique identifier */
  id: string;
  /** Proposed change description */
  changeDescription: string;
  /** Affected components */
  affectedComponents: string[];
  /** Direct dependencies */
  directDependencies: string[];
  /** Transitive dependencies */
  transitiveDependencies: string[];
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Estimated risks */
  risks: Array<{
    description: string;
    likelihood: number; // 0-1
    impact: number; // 0-1
  }>;
  /** Estimated benefits */
  benefits: Array<{
    description: string;
    value: number; // 0-1
  }>;
  /** Estimated effort (hours) */
  effortHours: number;
  /** Requires consultation */
  requiresConsultation: boolean;
  /** Assessment timestamp */
  assessedAt: number;
};

/**
 * Analysis options
 */
export type AnalysisOptions = {
  /** Include complexity analysis */
  includeComplexity?: boolean;
  /** Include duplication detection */
  includeDuplication?: boolean;
  /** Include code smells */
  includeCodeSmells?: boolean;
  /** Minimum severity to report */
  minSeverity?: IssueSeverity;
  /** Maximum issues to return */
  maxIssues?: number;
};
