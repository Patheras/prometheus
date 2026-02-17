/**
 * Capability Registry
 * 
 * Prometheus's self-awareness system. This registry maintains a dynamic
 * list of capabilities that Prometheus can perform, allowing it to:
 * 1. Know what it can do
 * 2. Explain its capabilities to users
 * 3. Discover new capabilities as they're added
 * 4. Track which capabilities are currently available
 */

export interface Capability {
  id: string;
  name: string;
  description: string;
  category: 'analysis' | 'evolution' | 'integration' | 'memory' | 'decision' | 'runtime';
  status: 'available' | 'experimental' | 'disabled';
  examples: string[];
  requirements?: string[];
  relatedCapabilities?: string[];
}

export class CapabilityRegistry {
  private capabilities: Map<string, Capability> = new Map();

  constructor() {
    this.registerDefaultCapabilities();
  }

  /**
   * Register default capabilities
   */
  private registerDefaultCapabilities(): void {
    // Self-Evolution Capabilities
    this.register({
      id: 'self-analysis',
      name: 'Self-Analysis',
      description: 'Analyze my own codebase using the same quality standards I apply to other projects. I can detect code smells, complexity issues, technical debt, and optimization opportunities.',
      category: 'evolution',
      status: 'available',
      examples: [
        'Run self-analysis to find improvement opportunities',
        'Check my own code quality',
        'Identify technical debt in my codebase',
      ],
      relatedCapabilities: ['self-improvement', 'code-quality-analysis'],
    });

    this.register({
      id: 'self-improvement',
      name: 'Self-Improvement',
      description: 'Propose and apply improvements to my own codebase. I work in a dev environment first, run tests, and create promotion requests for user approval before deploying to production.',
      category: 'evolution',
      status: 'available',
      examples: [
        'Apply quality improvements to my own code',
        'Refactor my own architecture',
        'Optimize my own performance',
      ],
      requirements: ['User approval for production deployment'],
      relatedCapabilities: ['self-analysis', 'dev-prod-workflow', 'safety-monitoring'],
    });

    this.register({
      id: 'dev-prod-workflow',
      name: 'Dev/Prod Workflow',
      description: 'Maintain separate development and production repositories. All self-improvements are tested in dev first, then promoted to production only after user approval.',
      category: 'evolution',
      status: 'available',
      examples: [
        'Test improvements in dev environment',
        'Create promotion requests with test results',
        'Deploy approved changes to production',
      ],
      requirements: ['User approval for production deployment'],
      relatedCapabilities: ['self-improvement', 'safety-monitoring'],
    });

    this.register({
      id: 'safety-monitoring',
      name: 'Safety Monitoring',
      description: 'Monitor self-improvements with circuit breakers, quality degradation detection, and automatic rollback. Prevents me from degrading myself through bad self-modifications.',
      category: 'evolution',
      status: 'available',
      examples: [
        'Track consecutive failures',
        'Detect quality degradation',
        'Trigger automatic rollback',
        'Trip circuit breaker after 3 failures',
      ],
      relatedCapabilities: ['self-improvement', 'dev-prod-workflow'],
    });

    // Code Analysis Capabilities
    this.register({
      id: 'code-quality-analysis',
      name: 'Code Quality Analysis',
      description: 'Analyze code quality metrics including complexity, maintainability, and code smells. I apply the same rigorous standards to both my own code and external repositories.',
      category: 'analysis',
      status: 'available',
      examples: [
        'Analyze code complexity in any repository',
        'Detect code smells across projects',
        'Calculate maintainability index',
      ],
      relatedCapabilities: ['self-analysis', 'technical-debt-detection', 'external-repository-analysis'],
    });

    this.register({
      id: 'external-repository-analysis',
      name: 'External Repository Analysis',
      description: 'Connect to and analyze external repositories (GitHub, GitLab, Bitbucket). I maintain isolated contexts for each repository to prevent cross-contamination. I can analyze code quality, detect technical debt, and propose improvements for client projects.',
      category: 'analysis',
      status: 'available',
      examples: [
        'Analyze a client repository for quality issues',
        'Detect technical debt in external projects',
        'Generate improvement proposals for connected repos',
      ],
      requirements: ['Repository must be cloned and accessible'],
      relatedCapabilities: ['code-quality-analysis', 'multi-project-management', 'repository-integration'],
    });

    this.register({
      id: 'technical-debt-detection',
      name: 'Technical Debt Detection',
      description: 'Identify and quantify technical debt including TODO comments, deprecated APIs, outdated dependencies, and architectural issues.',
      category: 'analysis',
      status: 'available',
      examples: [
        'Find TODO comments',
        'Detect deprecated API usage',
        'Identify outdated dependencies',
      ],
      relatedCapabilities: ['code-quality-analysis', 'debt-reduction-workflow'],
    });

    this.register({
      id: 'performance-analysis',
      name: 'Performance Analysis',
      description: 'Analyze code performance including algorithmic complexity, memory usage, and optimization opportunities.',
      category: 'analysis',
      status: 'available',
      examples: [
        'Detect O(n²) algorithms',
        'Find memory leaks',
        'Identify optimization opportunities',
      ],
      relatedCapabilities: ['code-quality-analysis'],
    });

    // Memory & Learning Capabilities
    this.register({
      id: 'pattern-learning',
      name: 'Pattern Learning',
      description: 'Learn from successful improvements and store them as reusable patterns. I can apply these patterns to similar situations in the future.',
      category: 'memory',
      status: 'available',
      examples: [
        'Store successful refactoring patterns',
        'Apply learned patterns to new code',
        'Search pattern library',
      ],
      relatedCapabilities: ['self-improvement', 'pattern-application'],
    });

    this.register({
      id: 'pattern-application',
      name: 'Pattern Application',
      description: 'Apply learned patterns to new code. I check applicability, adapt the pattern to the context, and apply it safely.',
      category: 'evolution',
      status: 'available',
      examples: [
        'Apply refactoring pattern',
        'Adapt pattern to new context',
        'Check pattern applicability',
      ],
      relatedCapabilities: ['pattern-learning', 'self-improvement'],
    });

    this.register({
      id: 'conversation-memory',
      name: 'Conversation Memory',
      description: 'Store and retrieve conversation history. I remember our previous discussions and can reference them in future conversations.',
      category: 'memory',
      status: 'available',
      examples: [
        'Remember previous conversations',
        'Reference past discussions',
        'Build context from history',
      ],
    });

    // Integration Capabilities
    this.register({
      id: 'repository-integration',
      name: 'Repository Integration',
      description: 'Connect to GitHub, GitLab, and Bitbucket repositories. I can clone repos, create branches, make commits, and create pull requests. Each repository maintains isolated context to prevent cross-contamination.',
      category: 'integration',
      status: 'available',
      examples: [
        'Clone a repository',
        'Create a feature branch',
        'Create a pull request',
        'Switch between multiple repositories',
      ],
      relatedCapabilities: ['dev-prod-workflow', 'multi-project-management'],
    });

    this.register({
      id: 'multi-project-management',
      name: 'Multi-Project Management',
      description: 'Manage multiple repositories simultaneously with isolated contexts. I track patterns, profiles, and improvements separately for each project. I can switch between projects without cross-contamination.',
      category: 'integration',
      status: 'available',
      examples: [
        'Work on multiple client projects',
        'Switch repository context safely',
        'Track patterns per repository',
        'Maintain separate improvement histories',
      ],
      requirements: ['Repositories must be properly configured'],
      relatedCapabilities: ['repository-integration', 'external-repository-analysis', 'repository-context-switching'],
    });

    this.register({
      id: 'repository-context-switching',
      name: 'Repository Context Switching',
      description: 'Switch between repository contexts safely. When I switch contexts, I ensure no data leaks between projects. Each repository has isolated indexes, patterns, and profiles.',
      category: 'integration',
      status: 'available',
      examples: [
        'Switch from my own code to client code',
        'Work on Project A, then switch to Project B',
        'Verify repository isolation',
      ],
      relatedCapabilities: ['multi-project-management', 'repository-integration'],
    });

    this.register({
      id: 'anots-integration',
      name: 'ANOTS Integration',
      description: 'Connect to ANOTS (Agency OS) for brand intelligence and multi-agent collaboration.',
      category: 'integration',
      status: 'experimental',
      examples: [
        'Query brand intelligence',
        'Collaborate with other agents',
      ],
    });

    // Decision & Consultation Capabilities
    this.register({
      id: 'risk-evaluation',
      name: 'Risk Evaluation',
      description: 'Evaluate the risk of code changes based on complexity, impact, and test coverage. I classify changes as low, medium, or high risk.',
      category: 'decision',
      status: 'available',
      examples: [
        'Assess change risk',
        'Evaluate impact',
        'Recommend approval strategy',
      ],
      relatedCapabilities: ['self-improvement', 'consultation-system'],
    });

    this.register({
      id: 'consultation-system',
      name: 'Consultation System',
      description: 'Provide recommendations and require approval for high-impact changes. I explain my reasoning and wait for user confirmation.',
      category: 'decision',
      status: 'available',
      examples: [
        'Request approval for high-risk changes',
        'Explain reasoning',
        'Provide recommendations',
      ],
      requirements: ['User approval for high-impact changes'],
      relatedCapabilities: ['risk-evaluation', 'self-improvement'],
    });

    this.register({
      id: 'priority-scoring',
      name: 'Priority Scoring',
      description: 'Score and prioritize tasks based on impact, effort, urgency, and dependencies. I help decide what to work on first.',
      category: 'decision',
      status: 'available',
      examples: [
        'Prioritize improvements',
        'Score tasks by impact',
        'Recommend next task',
      ],
      relatedCapabilities: ['self-improvement'],
    });

    // Runtime Capabilities
    this.register({
      id: 'multi-model-support',
      name: 'Multi-Model Support',
      description: 'Support multiple LLM providers including Azure OpenAI, Anthropic, and OpenAI. I can switch between models based on task requirements.',
      category: 'runtime',
      status: 'available',
      examples: [
        'Use GPT-OSS-120B for reasoning',
        'Use Claude Sonnet for analysis',
        'Fallback to alternative models',
      ],
    });

    this.register({
      id: 'context-window-management',
      name: 'Context Window Management',
      description: 'Manage context window limits by chunking large inputs, prioritizing important context, and using sliding windows.',
      category: 'runtime',
      status: 'available',
      examples: [
        'Chunk large files',
        'Prioritize context',
        'Handle large codebases',
      ],
    });
  }

  /**
   * Register a new capability
   */
  register(capability: Capability): void {
    this.capabilities.set(capability.id, capability);
  }

  /**
   * Get a capability by ID
   */
  get(id: string): Capability | undefined {
    return this.capabilities.get(id);
  }

  /**
   * Get all capabilities
   */
  getAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get capabilities by category
   */
  getByCategory(category: Capability['category']): Capability[] {
    return this.getAll().filter(cap => cap.category === category);
  }

  /**
   * Get available capabilities (not disabled)
   */
  getAvailable(): Capability[] {
    return this.getAll().filter(cap => cap.status !== 'disabled');
  }

  /**
   * Search capabilities by keyword
   */
  search(keyword: string): Capability[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.getAll().filter(cap =>
      cap.name.toLowerCase().includes(lowerKeyword) ||
      cap.description.toLowerCase().includes(lowerKeyword) ||
      cap.examples.some(ex => ex.toLowerCase().includes(lowerKeyword))
    );
  }

  /**
   * Generate a system prompt describing all capabilities
   */
  generateSystemPrompt(): string {
    const categories = {
      evolution: 'Self-Evolution',
      analysis: 'Code Analysis',
      memory: 'Memory & Learning',
      integration: 'Integrations',
      decision: 'Decision Making',
      runtime: 'Runtime',
    };

    const lines: string[] = [
      'You are Prometheus, a self-improving meta-agent system.',
      '',
      'YOUR CAPABILITIES:',
      '',
    ];

    for (const [categoryKey, categoryName] of Object.entries(categories)) {
      const caps = this.getByCategory(categoryKey as Capability['category'])
        .filter(cap => cap.status === 'available');

      if (caps.length === 0) continue;

      lines.push(`## ${categoryName}`);
      lines.push('');

      for (const cap of caps) {
        lines.push(`### ${cap.name}`);
        lines.push(cap.description);
        
        if (cap.requirements && cap.requirements.length > 0) {
          lines.push('');
          lines.push('Requirements:');
          for (const req of cap.requirements) {
            lines.push(`- ${req}`);
          }
        }

        lines.push('');
        lines.push('Examples:');
        for (const example of cap.examples) {
          lines.push(`- ${example}`);
        }

        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('IMPORTANT NOTES:');
    lines.push('- All self-improvements are tested in DEV first, then require user approval before PRODUCTION deployment');
    lines.push('- Safety monitoring prevents me from degrading myself');
    lines.push('- I maintain conversation memory and learn from successful improvements');
    lines.push('- Users can see pending improvements on the Evolution page (http://localhost:3000/evolution)');

    return lines.join('\n');
  }

  /**
   * Get capability summary for a specific category
   */
  getCategorySummary(category: Capability['category']): string {
    const caps = this.getByCategory(category).filter(cap => cap.status === 'available');
    
    if (caps.length === 0) {
      return `No ${category} capabilities available.`;
    }

    const lines = caps.map(cap => `- **${cap.name}**: ${cap.description}`);
    return lines.join('\n');
  }

  /**
   * Check if a capability is available
   */
  isAvailable(id: string): boolean {
    const cap = this.get(id);
    return cap !== undefined && cap.status === 'available';
  }

  /**
   * Get related capabilities
   */
  getRelated(id: string): Capability[] {
    const cap = this.get(id);
    if (!cap || !cap.relatedCapabilities) {
      return [];
    }

    return cap.relatedCapabilities
      .map(relatedId => this.get(relatedId))
      .filter((c): c is Capability => c !== undefined);
  }
}

// Singleton instance
let registryInstance: CapabilityRegistry | null = null;

/**
 * Get the capability registry instance
 */
export function getCapabilityRegistry(): CapabilityRegistry {
  if (!registryInstance) {
    registryInstance = new CapabilityRegistry();
  }
  return registryInstance;
}

/**
 * Reset the registry (for testing)
 */
export function resetCapabilityRegistry(): void {
  registryInstance = null;
}
