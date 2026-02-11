/**
 * Evolution Engine
 * 
 * Enables Prometheus to improve itself through self-analysis,
 * architecture refactoring, and pattern application.
 */

export { SelfAnalyzer } from './self-analyzer';
export type {
  SelfAnalysisConfig,
  SelfAnalysisResult,
  SelfMetrics,
} from './self-analyzer';

export { ArchitectureAnalyzer } from './architecture-analyzer';
export type {
  ArchitecturalIssue,
  ArchitectureMetrics,
} from './architecture-analyzer';

export { PatternApplicator } from './pattern-applicator';
export type {
  PatternApplicabilityCheck,
  PreconditionCheck,
  AdaptedPattern,
} from './pattern-applicator';

export { AgentOptimizer } from './agent-optimizer';
export type {
  PerformanceBottleneck,
  OptimizationProposal,
  ABTestConfig,
  ABTestResult,
  OptimizationRollout,
} from './agent-optimizer';

export { TestValidator, createTestValidator } from './test-validator';
export type {
  TestValidationResult,
  TestIssue,
  TestIssueSeverity,
  TestIssueType,
  GeneratedTest,
} from './test-validator';

export { TestGenerator, createTestGenerator } from './test-generator';
export type {
  TestGenerationResult,
  CoverageGap,
} from './test-generator';

export { SelfImprovementPrioritizer, createSelfImprovementPrioritizer } from './self-improvement-prioritizer';
export type {
  SelfImprovementPrioritizationConfig,
  PrioritizedWork,
  SelfImprovementROI,
} from './self-improvement-prioritizer';

export { SelfModificationConsultant, createSelfModificationConsultant } from './self-modification-consultant';
export type {
  SelfModificationConfig,
  SelfModificationProposal,
  SelfModificationResult,
} from './self-modification-consultant';

export { DevProdManager } from './dev-prod-manager';
export type {
  DevProdConfig,
  PromotionRequest,
  ChangeDescription,
  TestResults,
  TestFailure,
  ImpactAssessment,
  RollbackPlan,
  PromotionAuditEntry,
} from './dev-prod-manager';

export { SelfImprovementWorkflow } from './self-improvement-workflow';
export type {
  SelfImprovementTask,
  SelfImprovementContext,
  WorkflowConfig,
} from './self-improvement-workflow';

export { PromotionRequestBuilder, createPromotionRequestBuilder } from './promotion-request-builder';
export type {
  PromotionRequestTemplate,
  ValidationResult,
  FormattedPromotionRequest,
  PromotionSummary,
} from './promotion-request-builder';

export { PromotionApprovalWorkflow, createPromotionApprovalWorkflow } from './promotion-approval-workflow';
export type {
  ApprovalWorkflowConfig,
  ApprovalDecision,
  DeploymentResult,
  NotificationPayload,
} from './promotion-approval-workflow';

export { PromotionAuditRollback, createPromotionAuditRollback } from './promotion-audit-rollback';
export type {
  RollbackConfig,
  RollbackRequest,
  RollbackVerification,
  AuditQuery,
  AuditReport,
} from './promotion-audit-rollback';
