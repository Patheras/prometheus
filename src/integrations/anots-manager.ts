/**
 * ANOTS Manager
 * 
 * Comprehensive manager for ANOTS-specific operations:
 * - Pattern tracking and learning
 * - Branching strategy enforcement
 * - Repository separation verification
 */

import { MemoryEngine } from '../memory/engine';
import { Pattern } from '../types';

export interface AnotsPattern {
  id: string;
  name: string;
  category: 'architecture' | 'naming' | 'testing' | 'deployment' | 'api' | 'ui';
  description: string;
  example: string;
  applicability: string;
  usageCount: number;
  lastUsed: number;
}

export interface BranchingStrategy {
  branchPrefix: string;
  namingConvention: RegExp;
  baseBranch: string;
  protectedBranches: string[];
  requirePRForBranches: string[];
  autoDeleteOnMerge: boolean;
}

export interface RepositoryInfo {
  name: string;
  path: string;
  type: 'anots' | 'prometheus';
  allowedOperations: string[];
}

export interface ConventionViolation {
  type: 'branch_naming' | 'protected_branch' | 'repository_separation';
  severity: 'error' | 'warning';
  message: string;
  suggestion: string;
}

export class AnotsManager {
  private memoryEngine: MemoryEngine;
  private anotsRepoPath: string;
  private prometheusRepoPath: string;
  private patterns: Map<string, AnotsPattern> = new Map();
  private branchingStrategy: BranchingStrategy;

  constructor(
    memoryEngine: MemoryEngine,
    anotsRepoPath: string,
    prometheusRepoPath: string
  ) {
    this.memoryEngine = memoryEngine;
    this.anotsRepoPath = anotsRepoPath;
    this.prometheusRepoPath = prometheusRepoPath;

    // Initialize ANOTS branching strategy
    this.branchingStrategy = {
      branchPrefix: 'prometheus/',
      namingConvention: /^prometheus\/[a-z0-9-]+$/,
      baseBranch: 'main',
      protectedBranches: ['main', 'production', 'staging'],
      requirePRForBranches: ['main', 'production', 'staging'],
      autoDeleteOnMerge: true,
    };
  }

  /**
   * Initialize ANOTS-specific patterns
   */
  async initializePatterns(): Promise<void> {
    // Load existing ANOTS patterns from memory
    const storedPatterns = await this.memoryEngine.searchPatterns('anots');

    for (const pattern of storedPatterns) {
      this.patterns.set(pattern.id, {
        id: pattern.id,
        name: pattern.name,
        category: this.categorizePattern(pattern.category),
        description: pattern.problem,
        example: pattern.exampleCode,
        applicability: pattern.applicability,
        usageCount: pattern.successCount,
        lastUsed: Date.now(),
      });
    }

    // Add default ANOTS patterns if none exist
    if (this.patterns.size === 0) {
      await this.seedDefaultPatterns();
    }
  }

  /**
   * Categorize pattern into ANOTS-specific category
   */
  private categorizePattern(category: string): AnotsPattern['category'] {
    const categoryMap: Record<string, AnotsPattern['category']> = {
      architecture: 'architecture',
      naming: 'naming',
      testing: 'testing',
      deployment: 'deployment',
      api: 'api',
      ui: 'ui',
    };

    return categoryMap[category.toLowerCase()] || 'architecture';
  }

  /**
   * Seed default ANOTS patterns
   */
  private async seedDefaultPatterns(): Promise<void> {
    const defaultPatterns: Omit<AnotsPattern, 'id' | 'usageCount' | 'lastUsed'>[] = [
      {
        name: 'Supabase RLS Pattern',
        category: 'architecture',
        description: 'Use Row Level Security for multi-tenant data isolation',
        example: 'CREATE POLICY tenant_isolation ON table USING (tenant_id = auth.uid())',
        applicability: 'All database tables with tenant data',
      },
      {
        name: 'API Route Naming',
        category: 'naming',
        description: 'API routes follow /api/[resource]/[action] pattern',
        example: '/api/brands/create, /api/campaigns/list',
        applicability: 'All Next.js API routes',
      },
      {
        name: 'Component Testing',
        category: 'testing',
        description: 'React components have corresponding .test.tsx files',
        example: 'BrandCard.tsx -> BrandCard.test.tsx',
        applicability: 'All React components',
      },
      {
        name: 'Environment Variables',
        category: 'deployment',
        description: 'Use NEXT_PUBLIC_ prefix for client-side env vars',
        example: 'NEXT_PUBLIC_SUPABASE_URL',
        applicability: 'All environment configuration',
      },
      {
        name: 'Type Safety',
        category: 'api',
        description: 'Use Zod schemas for API validation',
        example: 'const schema = z.object({ name: z.string() })',
        applicability: 'All API endpoints',
      },
      {
        name: 'UI Consistency',
        category: 'ui',
        description: 'Use shadcn/ui components for consistent design',
        example: 'import { Button } from "@/components/ui/button"',
        applicability: 'All UI components',
      },
    ];

    for (const pattern of defaultPatterns) {
      const id = `anots-${pattern.name.toLowerCase().replace(/\s+/g, '-')}`;
      
      this.patterns.set(id, {
        id,
        ...pattern,
        usageCount: 0,
        lastUsed: Date.now(),
      });

      // Store in memory engine
      await this.memoryEngine.storePattern({
        id,
        name: pattern.name,
        category: pattern.category,
        problem: pattern.description,
        solution: pattern.example,
        exampleCode: pattern.example,
        applicability: pattern.applicability,
        successCount: 0,
        failureCount: 0,
      });
    }
  }

  /**
   * Track pattern usage
   */
  async trackPatternUsage(patternId: string, success: boolean): Promise<void> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    pattern.usageCount += 1;
    pattern.lastUsed = Date.now();

    // Update in memory engine
    await this.memoryEngine.updatePatternOutcome(patternId, {
      success,
      context: 'anots',
      timestamp: Date.now(),
    });
  }

  /**
   * Get ANOTS patterns by category
   */
  getPatternsByCategory(category: AnotsPattern['category']): AnotsPattern[] {
    return Array.from(this.patterns.values()).filter(p => p.category === category);
  }

  /**
   * Get most used patterns
   */
  getMostUsedPatterns(limit: number = 10): AnotsPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Learn new pattern from code
   */
  async learnPattern(pattern: Omit<AnotsPattern, 'id' | 'usageCount' | 'lastUsed'>): Promise<string> {
    const id = `anots-learned-${Date.now()}`;
    
    const newPattern: AnotsPattern = {
      id,
      ...pattern,
      usageCount: 0,
      lastUsed: Date.now(),
    };

    this.patterns.set(id, newPattern);

    // Store in memory engine
    await this.memoryEngine.storePattern({
      id,
      name: pattern.name,
      category: pattern.category,
      problem: pattern.description,
      solution: pattern.example,
      exampleCode: pattern.example,
      applicability: pattern.applicability,
      successCount: 0,
      failureCount: 0,
    });

    return id;
  }

  /**
   * Validate branch name against ANOTS conventions
   */
  validateBranchName(branchName: string): ConventionViolation[] {
    const violations: ConventionViolation[] = [];

    // Check if branch follows naming convention
    if (!this.branchingStrategy.namingConvention.test(branchName)) {
      violations.push({
        type: 'branch_naming',
        severity: 'error',
        message: `Branch name "${branchName}" does not follow ANOTS convention`,
        suggestion: `Use format: ${this.branchingStrategy.branchPrefix}[feature-name] (lowercase, hyphens only)`,
      });
    }

    // Check if trying to modify protected branch
    if (this.branchingStrategy.protectedBranches.includes(branchName)) {
      violations.push({
        type: 'protected_branch',
        severity: 'error',
        message: `Cannot directly modify protected branch: ${branchName}`,
        suggestion: 'Create a feature branch and submit a pull request',
      });
    }

    return violations;
  }

  /**
   * Check if branch requires PR
   */
  requiresPullRequest(targetBranch: string): boolean {
    return this.branchingStrategy.requirePRForBranches.includes(targetBranch);
  }

  /**
   * Get branching strategy
   */
  getBranchingStrategy(): BranchingStrategy {
    return { ...this.branchingStrategy };
  }

  /**
   * Update branching strategy
   */
  updateBranchingStrategy(updates: Partial<BranchingStrategy>): void {
    this.branchingStrategy = {
      ...this.branchingStrategy,
      ...updates,
    };
  }

  /**
   * Verify repository separation
   */
  verifyRepositorySeparation(targetPath: string): ConventionViolation[] {
    const violations: ConventionViolation[] = [];

    // Normalize paths
    const normalizedTarget = targetPath.toLowerCase().replace(/\\/g, '/');
    const normalizedAnots = this.anotsRepoPath.toLowerCase().replace(/\\/g, '/');
    const normalizedPrometheus = this.prometheusRepoPath.toLowerCase().replace(/\\/g, '/');

    // Check if target is in ANOTS repo
    const isAnotsRepo = normalizedTarget.startsWith(normalizedAnots);

    // Check if target is in Prometheus repo
    const isPrometheusRepo = normalizedTarget.startsWith(normalizedPrometheus);

    // Violation: Trying to modify Prometheus repo from ANOTS context
    if (isPrometheusRepo && !isAnotsRepo) {
      violations.push({
        type: 'repository_separation',
        severity: 'error',
        message: 'Cannot modify Prometheus repository from ANOTS context',
        suggestion: 'Ensure changes target ANOTS repository only',
      });
    }

    // Violation: Path is in neither repository
    if (!isAnotsRepo && !isPrometheusRepo) {
      violations.push({
        type: 'repository_separation',
        severity: 'warning',
        message: 'Target path is outside both ANOTS and Prometheus repositories',
        suggestion: 'Verify the target path is correct',
      });
    }

    return violations;
  }

  /**
   * Get repository info for a path
   */
  getRepositoryInfo(targetPath: string): RepositoryInfo | null {
    const normalizedTarget = targetPath.toLowerCase().replace(/\\/g, '/');
    const normalizedAnots = this.anotsRepoPath.toLowerCase().replace(/\\/g, '/');
    const normalizedPrometheus = this.prometheusRepoPath.toLowerCase().replace(/\\/g, '/');

    if (normalizedTarget.startsWith(normalizedAnots)) {
      return {
        name: 'ANOTS',
        path: this.anotsRepoPath,
        type: 'anots',
        allowedOperations: ['read', 'write', 'create', 'delete', 'branch', 'commit', 'pr'],
      };
    }

    if (normalizedTarget.startsWith(normalizedPrometheus)) {
      return {
        name: 'Prometheus',
        path: this.prometheusRepoPath,
        type: 'prometheus',
        allowedOperations: ['read'], // Read-only from ANOTS context
      };
    }

    return null;
  }

  /**
   * Validate operation on repository
   */
  validateOperation(targetPath: string, operation: string): ConventionViolation[] {
    const violations: ConventionViolation[] = [];
    const repoInfo = this.getRepositoryInfo(targetPath);

    if (!repoInfo) {
      violations.push({
        type: 'repository_separation',
        severity: 'error',
        message: 'Target path is not in a known repository',
        suggestion: 'Ensure path is within ANOTS or Prometheus repository',
      });
      return violations;
    }

    if (!repoInfo.allowedOperations.includes(operation)) {
      violations.push({
        type: 'repository_separation',
        severity: 'error',
        message: `Operation "${operation}" not allowed on ${repoInfo.name} repository`,
        suggestion: `Allowed operations: ${repoInfo.allowedOperations.join(', ')}`,
      });
    }

    return violations;
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): AnotsPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get pattern by ID
   */
  getPattern(patternId: string): AnotsPattern | undefined {
    return this.patterns.get(patternId);
  }
}
