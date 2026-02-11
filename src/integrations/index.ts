/**
 * Integration modules for external systems
 */

// Generic repository management (NEW - recommended)
export { RepositoryConnector } from './repository-connector';
export type {
  RepositoryConfig,
  RepositoryProfile,
  RepoStatus as GenericRepoStatus,
  ChangeEvent as GenericChangeEvent,
  GitProvider,
} from './repository-connector';

export { RepositoryManager } from './repository-manager';
export type {
  RepositoryManagerConfig,
} from './repository-manager';

export { RepositoryWorkflow } from './repository-workflow';
export type {
  WorkflowConfig,
  BranchInfo as GenericBranchInfo,
  PullRequestInfo as GenericPullRequestInfo,
  ChangeSet as GenericChangeSet,
  TestResult,
} from './repository-workflow';

export { PRCreator } from './pr-creator';
export type {
  PRCreatorConfig,
  CreatedPR,
} from './pr-creator';

export { RepositoryPatternTracker } from './repository-pattern-tracker';
export type {
  RepositoryPattern,
  PatternCategory,
  PatternViolation,
  LearnedConvention,
  PatternAnalysisResult,
} from './repository-pattern-tracker';

export { RepositoryProfileManager } from './repository-profiles';
export type {
  RepositoryProfile,
  BranchingStrategy,
  BranchingConfig,
  TestConfig,
  TestCommand,
  CoverageConfig,
  ReviewConfig,
  QualityGate,
  DeploymentConfig,
  DeploymentEnvironment,
  ProfileTemplate,
} from './repository-profiles';

export { RepositoryContextManager, ContextAwareOperation } from './repository-context';
export type {
  RepositoryContext,
  ContextStackEntry,
  ContextValidation,
} from './repository-context';

// Legacy ANOTS-specific (deprecated, use RepositoryConnector instead)
export { AnotsConnector } from './anots-connector';
export type {
  AnotsConnectorConfig,
  RepoStatus,
  ChangeEvent,
} from './anots-connector';

export { AnotsWorkflow } from './anots-workflow';
export type {
  WorkflowConfig as AnotsWorkflowConfig,
  BranchInfo,
  PullRequestInfo,
  ChangeSet,
} from './anots-workflow';

export { AnotsManager } from './anots-manager';
export type {
  AnotsPattern,
  BranchingStrategy,
  RepositoryInfo,
  ConventionViolation,
} from './anots-manager';
