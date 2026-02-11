/**
 * Runtime Engine Types
 * 
 * Defines types for model selection, execution, and management.
 */

/**
 * Task types that determine model selection preferences
 */
export enum TaskType {
  CODE_ANALYSIS = 'code_analysis',       // Requires code understanding
  DECISION_MAKING = 'decision_making',   // Requires reasoning
  PATTERN_MATCHING = 'pattern_matching', // Requires pattern recognition
  METRIC_ANALYSIS = 'metric_analysis',   // Requires data analysis
  REFACTORING = 'refactoring',           // Requires code generation
  CONSULTATION = 'consultation',         // Requires explanation
  GENERAL = 'general'                    // General purpose tasks
}

/**
 * Model reference identifying a specific model
 */
export type ModelRef = {
  provider: string;  // e.g., 'anthropic', 'openai', 'google'
  model: string;     // e.g., 'claude-sonnet-4', 'gpt-4-turbo'
  version?: string;  // Optional version pinning
};

/**
 * Model capabilities and specializations
 */
export type ModelCapabilities = {
  code: boolean;       // Optimized for code understanding
  reasoning: boolean;  // Optimized for reasoning tasks
  general: boolean;    // General purpose model
  vision?: boolean;    // Supports vision/image inputs
  tools?: boolean;     // Supports function calling/tools
};

/**
 * Model cost/performance characteristics
 */
export type ModelCharacteristics = {
  costTier: 'low' | 'medium' | 'high' | 'premium';  // Relative cost
  speedTier: 'fast' | 'medium' | 'slow';            // Relative speed
  qualityTier: 'standard' | 'high' | 'premium';     // Output quality
};

/**
 * Complete model catalog entry
 */
export type ModelCatalogEntry = {
  ref: ModelRef;
  contextWindow: number;
  capabilities: ModelCapabilities;
  characteristics: ModelCharacteristics;
  description: string;
};

/**
 * Model preferences for a task type
 */
export type ModelPreferences = {
  taskType: TaskType;
  preferredModels: ModelRef[];  // Ordered by preference (first is most preferred)
};

/**
 * Model alias mapping
 */
export type ModelAlias = {
  alias: string;
  target: ModelRef;
  description: string;
};

/**
 * Authentication profile for API access
 * Tracks usage, failures, and cooldown state for reliable API access
 */
export type AuthProfile = {
  id: string;              // Unique identifier for this profile
  provider: string;        // Provider name (anthropic, openai, google)
  apiKey: string;          // API key (encrypted or reference)
  lastUsed: number;        // Timestamp of last use (for round-robin)
  lastGood: number;        // Timestamp of last successful use (for preferring reliable profiles)
  failureCount: number;    // Number of consecutive failures
  cooldownUntil: number;   // Timestamp when cooldown expires (0 if not in cooldown)
  successCount: number;    // Total successful requests (for tracking)
};
