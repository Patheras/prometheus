/**
 * Tool System Exports
 */

export * from './types.js';
export * from './tool-registry.js';
export * from './tool-execution-engine.js';

import { getToolRegistry } from './tool-registry.js';
import { ToolExecutionEngine } from './tool-execution-engine.js';
import { analysisTools } from './schemas/analysis-tools.js';
import { repositoryTools } from './schemas/repository-tools.js';
import { workspaceTools } from './schemas/workspace-tools.js';
import { systemTools } from './schemas/system-tools.js';
import { evolutionTools } from './schemas/evolution-tools.js';
import { documentationTools } from './schemas/documentation-tools.js';

/**
 * Global tool execution engine instance
 */
let globalToolExecutionEngine: ToolExecutionEngine | null = null;

/**
 * Get or create global tool execution engine
 */
export function getToolExecutionEngine(): ToolExecutionEngine {
  if (!globalToolExecutionEngine) {
    globalToolExecutionEngine = new ToolExecutionEngine();
  }
  return globalToolExecutionEngine;
}

/**
 * Register all available tools
 */
export function registerAllTools(): void {
  const registry = getToolRegistry();
  
  // Register all tools from each category
  const allTools = [
    ...analysisTools,
    ...repositoryTools,
    ...workspaceTools,
    ...systemTools,
    ...evolutionTools,
    ...documentationTools,
  ];
  
  for (const tool of allTools) {
    registry.registerTool(tool);
  }
  
  console.log(`[Tools] Registered ${registry.getAllSchemas().length} tools`);
}
