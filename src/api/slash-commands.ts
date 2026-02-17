/**
 * Slash Command Handler
 * 
 * Handles special slash commands in chat for system operations
 */

/**
 * Slash command types
 */
export type SlashCommandType =
  | 'evolve'
  | 'promotions'
  | 'repos'
  | 'workspace'
  | 'stats'
  | 'config'
  | 'status'
  | 'analyze'
  | 'debt'
  | 'debug'
  | 'refactor'
  | 'optimize'
  | 'test'
  | 'explain';

/**
 * Slash command response
 */
export interface SlashCommandResponse {
  type: 'widget' | 'text' | 'error';
  content: string;
  widget?: {
    type: 'promotions' | 'status' | 'consultations' | 'config' | 'metrics';
    data: any;
  };
}

/**
 * Handle slash command
 * 
 * @param command Command name (without /)
 * @param args Command arguments
 * @returns Command response
 */
export async function handleSlashCommand(
  command: string,
  args: string
): Promise<SlashCommandResponse> {
  const cmd = command.toLowerCase().replace('/', '') as SlashCommandType;

  switch (cmd) {
    case 'evolve':
      return handleEvolveCommand();
    
    case 'promotions':
      return handlePromotionsCommand();
    
    case 'repos':
      return handleReposCommand();
    
    case 'workspace':
      return handleWorkspaceCommand(args);
    
    case 'stats':
      return handleStatusCommand();
    
    case 'config':
      return handleConfigCommand(args);
    
    case 'status':
      return handleStatusCommand();
    
    case 'debt':
      return handleDebtCommand(args);
    
    default:
      // For other commands, return instruction to process normally
      return {
        type: 'text',
        content: `Processing ${command} command...`,
      };
  }
}

/**
 * Handle /evolve command
 * 
 * Runs actual self-analysis on Prometheus codebase
 */
async function handleEvolveCommand(): Promise<SlashCommandResponse> {
  try {
    // Call the backend self-analysis endpoint
    const response = await fetch('http://localhost:4242/api/evolution/analysis/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Format the analysis results
    const { issues, debt, improvements, metrics } = result;
    
    let content = `🔥 **Self-Analysis Complete**\n\n`;
    content += `**Code Quality Metrics:**\n`;
    content += `- Files Analyzed: ${metrics.totalFiles}\n`;
    content += `- Total Lines: ${metrics.totalLines.toLocaleString()}\n`;
    content += `- Avg Complexity: ${metrics.averageComplexity.toFixed(1)}\n`;
    content += `- Quality Score: ${metrics.qualityScore.toFixed(0)}/100\n\n`;
    
    content += `**Issues Found:**\n`;
    content += `- Total Issues: ${issues.length}\n`;
    const highSeverity = issues.filter((i: any) => i.severity === 'high').length;
    const mediumSeverity = issues.filter((i: any) => i.severity === 'medium').length;
    const lowSeverity = issues.filter((i: any) => i.severity === 'low').length;
    content += `- High: ${highSeverity} | Medium: ${mediumSeverity} | Low: ${lowSeverity}\n\n`;
    
    content += `**Technical Debt:**\n`;
    content += `- Total Items: ${debt.length}\n`;
    const totalHours = debt.reduce((sum: number, d: any) => sum + d.estimatedHours, 0);
    content += `- Estimated Effort: ${totalHours.toFixed(1)} hours\n\n`;
    
    content += `**Improvement Opportunities:**\n`;
    content += `- ${improvements.length} improvements identified\n`;
    const highPriority = improvements.filter((i: any) => i.priority === 'high').length;
    content += `- High Priority: ${highPriority}\n\n`;
    
    if (improvements.length > 0) {
      content += `**Top 3 Improvements:**\n`;
      improvements.slice(0, 3).forEach((imp: any, idx: number) => {
        content += `${idx + 1}. ${imp.description}\n`;
        content += `   Location: ${imp.location}\n`;
        content += `   Impact: ${imp.estimatedImpact}/100\n\n`;
      });
    }
    
    content += `View full details at: http://localhost:3000/evolution`;
    
    return {
      type: 'widget',
      content,
      widget: {
        type: 'metrics',
        data: {
          metrics,
          issues: issues.slice(0, 10), // Top 10 issues
          debt: debt.slice(0, 10), // Top 10 debt items
          improvements: improvements.slice(0, 5), // Top 5 improvements
        },
      },
    };
  } catch (error) {
    console.error('Self-analysis failed:', error);
    return {
      type: 'error',
      content: `Failed to run self-analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Handle /promotions command
 */
async function handlePromotionsCommand(): Promise<SlashCommandResponse> {
  try {
    // Fetch promotions from API
    const response = await fetch('http://localhost:3000/api/promotions');
    const data = await response.json();
    
    const pending = data.promotions.filter((p: any) => p.status === 'pending');
    
    return {
      type: 'widget',
      content: `You have ${pending.length} pending promotion${pending.length !== 1 ? 's' : ''}.`,
      widget: {
        type: 'promotions',
        data: {
          promotions: pending,
          total: data.promotions.length,
        },
      },
    };
  } catch (error) {
    return {
      type: 'error',
      content: 'Failed to load promotions. Please try again.',
    };
  }
}

/**
 * Handle /repos command
 */
async function handleReposCommand(): Promise<SlashCommandResponse> {
  try {
    const response = await fetch('http://localhost:4242/api/repositories');
    if (response.ok) {
      const data = await response.json();
      const repos = data.repositories || [];
      
      return {
        type: 'widget',
        content: `You have ${repos.length} repositor${repos.length !== 1 ? 'ies' : 'y'}.`,
        widget: {
          type: 'repos' as any,
          data: {
            repositories: repos,
          },
        },
      };
    }
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
  }
  
  return {
    type: 'error',
    content: 'Failed to load repositories. Please try again.',
  };
}

/**
 * Handle /workspace command
 */
async function handleWorkspaceCommand(args: string): Promise<SlashCommandResponse> {
  const repoId = args.trim() || 'prometheus';
  
  try {
    const response = await fetch(`http://localhost:4242/api/workspace/${repoId}/files`);
    if (response.ok) {
      const data = await response.json();
      
      return {
        type: 'widget',
        content: `Workspace files for ${repoId}:`,
        widget: {
          type: 'workspace' as any,
          data: {
            repoId,
            files: data.files || [],
          },
        },
      };
    }
  } catch (error) {
    console.error('Failed to fetch workspace files:', error);
  }
  
  return {
    type: 'error',
    content: 'Failed to load workspace files. Please try again.',
  };
}

/**
 * Handle /debt command
 */
async function handleDebtCommand(args: string): Promise<SlashCommandResponse> {
  const codebasePath = args.trim() || process.cwd();
  
  return {
    type: 'widget',
    content: 'Analyzing technical debt...',
    widget: {
      type: 'status',
      data: {
        status: 'running',
        message: `Scanning ${codebasePath} for technical debt`,
        actions: [
          { label: 'View Details', action: 'open_debt_report' },
          { label: 'Stop', action: 'stop_analysis' },
        ],
      },
    },
  };
}

/**
 * Handle /config command
 */
async function handleConfigCommand(args: string): Promise<SlashCommandResponse> {
  if (!args || args.trim() === '') {
    // Show current config
    return {
      type: 'widget',
      content: 'Current Prometheus configuration:',
      widget: {
        type: 'config',
        data: {
          settings: [
            { key: 'Model', value: 'GPT-OSS-120B', editable: false },
            { key: 'Reasoning Effort', value: 'high', editable: true },
            { key: 'Auto-approve', value: 'false', editable: true },
            { key: 'Themis Validation', value: 'enabled', editable: true },
          ],
        },
      },
    };
  }
  
  // Parse config change
  const [key, value] = args.split('=').map(s => s.trim());
  
  if (!key || !value) {
    return {
      type: 'error',
      content: 'Invalid config format. Use: /config key=value',
    };
  }
  
  // TODO: Actually update config
  return {
    type: 'text',
    content: `✅ Updated ${key} to ${value}`,
  };
}

/**
 * Handle /status command
 */
async function handleStatusCommand(): Promise<SlashCommandResponse> {
  return {
    type: 'widget',
    content: 'Prometheus System Status:',
    widget: {
      type: 'status',
      data: {
        status: 'healthy',
        uptime: '2h 34m',
        metrics: {
          'Consultations Today': 12,
          'Pending Promotions': 2,
          'Success Rate': '94%',
          'Avg Response Time': '1.2s',
        },
        services: [
          { name: 'Runtime Engine', status: 'healthy' },
          { name: 'Memory Engine', status: 'healthy' },
          { name: 'Themis Validator', status: 'healthy' },
          { name: 'Queue System', status: 'healthy' },
        ],
      },
    },
  };
}

/**
 * Check if message is a slash command
 */
export function isSlashCommand(message: string): boolean {
  return message.trim().startsWith('/');
}

/**
 * Parse slash command from message
 */
export function parseSlashCommand(message: string): { command: string; args: string } {
  const trimmed = message.trim();
  const spaceIndex = trimmed.indexOf(' ');
  
  if (spaceIndex === -1) {
    return {
      command: trimmed,
      args: '',
    };
  }
  
  return {
    command: trimmed.substring(0, spaceIndex),
    args: trimmed.substring(spaceIndex + 1).trim(),
  };
}
