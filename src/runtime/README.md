# Runtime Engine - Model Selection System

This module implements the model selection system for the Prometheus Runtime Engine, based on Requirements 6.1, 6.3, and 6.4.

## Overview

The model selection system provides intelligent model selection based on:
- **Task Type**: Different tasks prefer different models (code analysis, decision making, etc.)
- **Configuration Overrides**: Force specific models when needed
- **Provider Filtering**: Allowlist/blocklist providers for enterprise policies
- **Context Window Requirements**: Ensure models have sufficient context capacity
- **Cost Constraints**: Limit to specific cost tiers
- **Capability Requirements**: Require specific capabilities (code, reasoning, vision, tools)

## Components

### 1. Model Catalog (`model-catalog.ts`)

Defines all available models with their characteristics:

```typescript
import { getModelInfo, getContextWindow, DEFAULT_MODEL } from './model-catalog.js';

// Get model information
const info = getModelInfo({ provider: 'anthropic', model: 'claude-sonnet-4' });
console.log(info.contextWindow); // 200000
console.log(info.capabilities.code); // true

// Get context window
const contextWindow = getContextWindow({ provider: 'openai', model: 'gpt-4o' });
```

### 2. Model Aliases (`model-aliases.ts`)

Maps friendly names to specific models:

```typescript
import { resolveModelAlias, resolveModel } from './model-aliases.js';

// Resolve alias
const model = resolveModelAlias('fast'); // { provider: 'openai', model: 'gpt-4o-mini' }

// Resolve various formats
resolveModel('fast'); // Alias
resolveModel('anthropic/claude-sonnet-4'); // Provider/model format
resolveModel({ provider: 'openai', model: 'gpt-4o' }); // ModelRef object
```

### 3. Model Preferences (`model-preferences.ts`)

Defines task-type-specific model preferences:

```typescript
import { getPreferredModels, TaskType } from './model-preferences.js';

// Get preferences for a task type
const preferences = getPreferredModels(TaskType.CODE_ANALYSIS);
// [
//   { provider: 'anthropic', model: 'claude-sonnet-4' },
//   { provider: 'openai', model: 'gpt-4-turbo' },
//   ...
// ]
```

### 4. Model Selector (`model-selector.ts`)

The main selection logic:

```typescript
import { selectModel, selectModelWithMetadata, TaskType } from './model-selector.js';

// Basic selection
const model = selectModel(TaskType.CODE_ANALYSIS);

// With options
const model = selectModel(TaskType.CODE_ANALYSIS, {
  forceModel: 'fast',
  allowedProviders: ['anthropic', 'openai'],
  contextWindowMin: 128000,
  maxCostTier: 'high',
  requireCapabilities: { code: true, reasoning: true }
});

// With metadata
const result = selectModelWithMetadata(TaskType.CODE_ANALYSIS);
console.log(result.reason); // 'preference' | 'forced' | 'fallback'
console.log(result.preferenceRank); // 0 (most preferred)
console.log(result.filteredCount); // Number of models filtered out
```

## Selection Logic

The model selector follows this logic:

1. **Force Model**: If `forceModel` is specified, use it (with validation)
2. **Task Preferences**: Get preferred models for the task type
3. **Apply Filters**: Filter by providers, context window, cost, capabilities
4. **Return First Match**: Return the first model that passes all filters
5. **Fallback**: If no matches, fall back to default model

## Selection Options

```typescript
type SelectionOptions = {
  // Force a specific model (overrides preferences)
  forceModel?: string | ModelRef;
  
  // Provider filtering
  allowedProviders?: string[];      // Only these providers
  excludedProviders?: string[];     // Exclude these providers
  
  // Context window requirement
  contextWindowMin?: number;        // Minimum tokens required
  
  // Cost constraint
  maxCostTier?: 'low' | 'medium' | 'high' | 'premium';
  
  // Capability requirements
  requireCapabilities?: {
    code?: boolean;
    reasoning?: boolean;
    vision?: boolean;
    tools?: boolean;
  };
};
```

## Usage Examples

### Example 1: Basic Task-Based Selection

```typescript
import { selectModel, TaskType } from './runtime/index.js';

// Select model for code analysis
const model = selectModel(TaskType.CODE_ANALYSIS);
// Returns: { provider: 'anthropic', model: 'claude-sonnet-4' }

// Select model for decision making
const model = selectModel(TaskType.DECISION_MAKING);
// Returns: { provider: 'anthropic', model: 'claude-opus-4' }
```

### Example 2: Enterprise with Provider Restrictions

```typescript
// Company policy: Only use Anthropic models
const model = selectModel(TaskType.CODE_ANALYSIS, {
  allowedProviders: ['anthropic']
});
// Returns: { provider: 'anthropic', model: 'claude-sonnet-4' }
```

### Example 3: Cost-Constrained Operations

```typescript
// Budget-conscious: Use low-cost models
const model = selectModel(TaskType.GENERAL, {
  maxCostTier: 'low'
});
// Returns: { provider: 'anthropic', model: 'claude-haiku-4' }
```

### Example 4: Large Codebase Analysis

```typescript
// Need huge context window for large codebase
const model = selectModel(TaskType.CODE_ANALYSIS, {
  contextWindowMin: 1000000
});
// Returns: { provider: 'google', model: 'gemini-2.0-flash-exp' }
```

### Example 5: Multimodal Requirements

```typescript
// Need vision capability
const model = selectModel(TaskType.GENERAL, {
  requireCapabilities: { vision: true }
});
// Returns a model with vision support
```

### Example 6: Force Specific Model

```typescript
// User wants to use a specific model
const model = selectModel(TaskType.CODE_ANALYSIS, {
  forceModel: 'fast' // Alias
});
// Returns: { provider: 'openai', model: 'gpt-4o-mini' }

// Or use provider/model format
const model = selectModel(TaskType.CODE_ANALYSIS, {
  forceModel: 'google/gemini-1.5-pro'
});
// Returns: { provider: 'google', model: 'gemini-1.5-pro' }
```

### Example 7: Complex Multi-Constraint Selection

```typescript
// Multiple constraints
const model = selectModel(TaskType.CODE_ANALYSIS, {
  allowedProviders: ['anthropic', 'openai'],
  maxCostTier: 'high',
  contextWindowMin: 128000,
  requireCapabilities: { code: true, reasoning: true }
});
// Returns first model meeting all criteria
```

### Example 8: Selection with Metadata

```typescript
// Get selection metadata for monitoring/logging
const result = selectModelWithMetadata(TaskType.CODE_ANALYSIS, {
  excludedProviders: ['anthropic']
});

console.log(result.model); // Selected model
console.log(result.reason); // 'preference' (from preference list)
console.log(result.preferenceRank); // 1 (second choice, first was filtered)
console.log(result.filteredCount); // 1 (one model filtered out)
```

## Task Types

The system supports the following task types:

- `CODE_ANALYSIS`: Code understanding and analysis
- `DECISION_MAKING`: Complex reasoning and decision making
- `PATTERN_MATCHING`: Pattern recognition and matching
- `METRIC_ANALYSIS`: Data analysis and metrics
- `REFACTORING`: Code generation and refactoring
- `CONSULTATION`: Explanations and consultations
- `GENERAL`: General purpose tasks

Each task type has a curated list of preferred models optimized for that task.

## Model Aliases

Common aliases available:

**Speed-based:**
- `fast`: Fast and affordable model
- `fastest`: Fastest available model

**Quality-based:**
- `best`: Highest quality model
- `balanced`: Balanced quality and speed

**Task-specific:**
- `reasoning`: Best for reasoning tasks
- `code`: Optimized for code
- `vision`: Best for vision tasks

**Provider-specific:**
- `claude`, `claude-best`, `claude-fast`
- `gpt`, `gpt-best`, `gpt-fast`
- `gemini`, `gemini-pro`

**Context window:**
- `large-context`: Model with largest context window
- `huge-context`: Model with huge context window

## Fallback Behavior

If no models match the constraints:
1. The selector falls back to the default model
2. The default model is validated against constraints
3. If even the default fails validation, it's still returned (last resort)
4. This ensures the selector always returns a model

## Testing

The module includes comprehensive tests:

- **Unit Tests** (`model-selector.test.ts`): 48 tests covering all selection logic
- **Integration Tests** (`model-selector.integration.test.ts`): 25 tests demonstrating real-world scenarios

Run tests:
```bash
npm test -- model-selector
```

## Requirements Coverage

This implementation satisfies:

- **Requirement 6.1**: Model selection based on task type
- **Requirement 6.3**: Models optimized for code analysis
- **Requirement 6.4**: Models optimized for decision making

Additional features beyond requirements:
- Provider filtering (allowlist/blocklist)
- Context window requirements
- Cost tier constraints
- Capability requirements
- Selection metadata for monitoring
