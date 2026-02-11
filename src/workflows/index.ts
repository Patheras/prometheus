/**
 * End-to-End Workflows
 * 
 * Complete workflows that orchestrate multiple engines
 * to accomplish high-level goals.
 */

export { CodeQualityWorkflow, createCodeQualityWorkflow } from './code-quality-workflow';
export type { WorkflowConfig, WorkflowResult } from './code-quality-workflow';

export { PerformanceWorkflow, createPerformanceWorkflow } from './performance-workflow';
export type {
  PerformanceWorkflowConfig,
  PerformanceWorkflowResult,
} from './performance-workflow';

export { DebtReductionWorkflow, createDebtReductionWorkflow } from './debt-reduction-workflow';
export type { DebtWorkflowConfig, DebtWorkflowResult } from './debt-reduction-workflow';

export {
  SelfImprovementWorkflow,
  createSelfImprovementWorkflow,
} from './self-improvement-workflow';
export type {
  SelfImprovementConfig,
  SelfImprovementResult,
} from './self-improvement-workflow';
