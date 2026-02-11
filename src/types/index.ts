/**
 * Core type definitions for Prometheus Meta-Agent System
 */

// ============================================================================
// Memory Engine Types
// ============================================================================

export type MemorySource = 'codebase' | 'decisions' | 'metrics' | 'patterns';

export interface CodeResult {
  file: string;
  startLine: number;
  endLine: number;
  text: string;
  score: number;
  symbols: string[];
  imports: string[];
}

export interface FileMetadata {
  path: string;
  repo: string;
  hash: string;
  language: string;
  size: number;
  lastModified: number;
}

export interface Decision {
  id: string;
  timestamp: number;
  type: string;
  context: string;
  reasoning: string;
  alternatives: Alternative[];
  chosenOption: string;
  outcome?: Outcome;
  userFeedback?: string;
  approved?: boolean;
}

export interface Alternative {
  option: string;
  pros: string[];
  cons: string[];
  estimatedEffort: number;
}

export interface Outcome {
  success: boolean;
  results: string;
  lessonsLearned: string;
  timestamp: number;
}

export interface Metric {
  id: string;
  timestamp: number;
  metric_type: string;
  metric_name: string;
  value: number;
  context: Record<string, unknown>;
}

export interface Pattern {
  id: string;
  name: string;
  category: string;
  problem: string;
  solution: string;
  exampleCode: string;
  applicability: string;
  successCount: number;
  failureCount: number;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  keywordWeight?: number;
  vectorWeight?: number;
}

export interface SearchResult {
  id: string;
  source: MemorySource;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Runtime Engine Types
// ============================================================================

export interface ModelRef {
  provider: string;
  model: string;
}

export interface AuthProfile {
  id: string;
  provider: string;
  apiKey: string;
  lastUsed: number;
  lastGood: number;
  cooldownUntil: number;
  failureCount: number;
}

export type TaskType =
  | 'code_analysis'
  | 'decision_making'
  | 'pattern_matching'
  | 'metric_analysis'
  | 'refactoring'
  | 'consultation';

export interface RuntimeRequest {
  taskType: TaskType;
  prompt: string;
  context: string;
  model?: ModelRef;
  maxTokens?: number;
}

export interface RuntimeResponse {
  content: string;
  model: ModelRef;
  tokensUsed: number;
  latency: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export type FailoverReason =
  | 'auth'
  | 'billing'
  | 'context'
  | 'timeout'
  | 'rate_limit'
  | 'unavailable'
  | 'unknown';

export interface FallbackAttempt {
  provider: string;
  model: string;
  error: string;
  reason: FailoverReason;
}

export interface StreamChunk {
  type: 'content' | 'done' | 'error' | 'aborted';
  content?: string;
  model?: ModelRef;
  error?: string;
  reason?: string;
}

// ============================================================================
// Task Queue Types
// ============================================================================

export enum Lane {
  MAIN = 'main',
  ANALYSIS = 'analysis',
  DECISION = 'decision',
  EVOLUTION = 'evolution',
  REPO_PREFIX = 'repo:',
  FILE_PREFIX = 'file:',
  DB_PREFIX = 'db:',
  GITHUB = 'github',
  SUPABASE = 'supabase',
  MONITORING = 'monitoring',
}

export interface QueueEntry {
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  enqueuedAt: number;
  warnAfterMs: number;
}

export interface LaneState {
  lane: string;
  queue: QueueEntry[];
  active: number;
  maxConcurrent: number;
  draining: boolean;
}

export interface LaneStatus {
  lane: string;
  queueDepth: number;
  activeCount: number;
  averageWaitTime: number;
}

// ============================================================================
// Analysis Engine Types
// ============================================================================

export type Severity = 'low' | 'medium' | 'high';

export interface QualityIssue {
  type: string;
  severity: Severity;
  location: { file: string; line: number };
  message: string;
  suggestion: string;
}

export interface QualityReport {
  overallScore: number;
  issues: QualityIssue[];
  metrics: {
    complexity: number;
    duplication: number;
    testCoverage: number;
    maintainability: number;
  };
  trends: QualityTrend[];
}

export interface QualityTrend {
  timestamp: number;
  score: number;
  changeDescription: string;
}

export interface Bottleneck {
  type: string;
  endpoint: string;
  p50: number;
  p95: number;
  severity: Severity;
  affectedUsers: number;
}

export interface Anomaly {
  metric: string;
  timestamp: number;
  value: number;
  expected: number;
  deviation: number;
  severity: Severity;
}

export interface TechnicalDebt {
  id: string;
  category: string;
  description: string;
  location: string;
  estimatedHours: number;
  priority: number;
}

export interface Component {
  name: string;
  path: string;
  dependencies: string[];
  dependents: string[];
}

export interface Risk {
  description: string;
  likelihood: number;
  severity: Severity;
  mitigation?: string;
}

export interface Benefit {
  description: string;
  impact: number;
}

export interface EffortEstimate {
  hours: number;
  confidence: number;
}

export interface ImpactAssessment {
  affectedComponents: Component[];
  risks: Risk[];
  benefits: Benefit[];
  effort: EffortEstimate;
  recommendation: 'proceed' | 'consult' | 'reject';
  reasoning: string;
}

// ============================================================================
// Decision Engine Types
// ============================================================================

export interface PriorityScore {
  total: number;
  breakdown: {
    impact: number;
    urgency: number;
    effort: number;
    alignment: number;
  };
  reasoning: string;
}

export interface RiskEvaluation {
  risks: Risk[];
  overallRisk: Severity;
  mitigationStrategies: MitigationStrategy[];
}

export interface MitigationStrategy {
  risk: string;
  strategy: string;
  effort: number;
}

export interface ConsultationResponse {
  approved: boolean;
  feedback: string;
  modifications?: string[];
}

export type ConsultationTrigger =
  | 'high_impact'
  | 'high_risk'
  | 'architectural'
  | 'self_modification'
  | 'user_preference'
  | 'uncertainty'
  | 'precedent';

// ============================================================================
// Evolution Engine Types
// ============================================================================

export interface Improvement {
  type: string;
  priority: Severity;
  description: string;
  suggestion: string;
  location: string;
  estimatedImpact: number;
}

export interface RefactoringStep {
  description: string;
  files: string[];
  changes: string;
}

export interface RefactoringPlan {
  id: string;
  description: string;
  steps: RefactoringStep[];
  affectedFiles: string[];
  estimatedEffort: number;
  expectedBenefits: string[];
  risks: Risk[];
}

export interface RefactoringResult {
  success: boolean;
  steps: StepResult[];
  improvement: ImprovementReport;
}

export interface StepResult {
  step: RefactoringStep;
  success: boolean;
  error?: string;
}

export interface ImprovementReport {
  before: MetricsSnapshot;
  after: MetricsSnapshot;
  improvements: string[];
  regressions: string[];
}

export interface MetricsSnapshot {
  timestamp: number;
  qualityScore: number;
  complexity: number;
  testCoverage: number;
  performance: Record<string, number>;
}

export interface PatternOpportunity {
  pattern: Pattern;
  location: { file: string; line: number };
  estimatedBenefit: number;
  estimatedEffort: number;
}

export interface PatternResult {
  success: boolean;
  pattern: Pattern;
  location: { file: string; line: number };
  error?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface PrometheusConfig {
  server: {
    port: number;
    host: string;
  };
  database: {
    path: string;
  };
  llm: {
    providers: Record<string, LLMProviderConfig>;
    defaultProvider: string;
  };
  integrations: {
    github?: GitHubConfig;
    supabase?: SupabaseConfig;
    anots?: AnotsConfig;
  };
  monitoring: {
    enabled: boolean;
    port: number;
  };
}

export interface LLMProviderConfig {
  apiKey: string;
  models: string[];
  contextWindow?: number;
  fallback?: string[];
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface SupabaseConfig {
  url: string;
  key: string;
}

export interface AnotsConfig {
  repoPath: string;
  prometheusRepoPath: string;
}
