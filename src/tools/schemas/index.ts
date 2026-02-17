/**
 * Tool Schemas Index
 * 
 * Exports all tool schemas and registers them with the tool registry.
 */

import { getToolRegistry } from '../tool-registry.js';
import { analysisTools } from './analysis-tools.js';
import { repositoryTools } from './repository-tools.js';
import { workspaceTools } from './workspace-tools.js';
import { systemTools } from './system-tools.js';
import { evolutionTools } from './evolution-tools.js';
import { documentationTools } from './documentation-tools.js';

/**
 * All available tools
 */
export const allTools = [
  ...analysisTools,
  ...repositoryTools,
  ...workspaceTools,
  ...systemTools,
  ...evolutionTools,
  ...documentationTools,
];

/**
 * Register all tools with the registry
 */
export function registerAllTools(): void {
  const registry = getToolRegistry();
  
  for (const tool of allTools) {
    registry.registerTool(tool);
  }
}

// Export individual tool arrays
export { analysisTools } from './analysis-tools.js';
export { repositoryTools } from './repository-tools.js';
export { workspaceTools } from './workspace-tools.js';
export { systemTools } from './system-tools.js';
export { evolutionTools } from './evolution-tools.js';
export { documentationTools } from './documentation-tools.js';
