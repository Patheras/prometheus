/**
 * Architecture Refactoring System
 * 
 * Detects architectural issues and proposes refactoring strategies.
 */

import type { RuntimeExecutor } from '../runtime/runtime-executor';
import type { RefactoringPlan } from '../types';

export interface ArchitecturalIssue {
  type: 'tight_coupling' | 'circular_dependency' | 'missing_abstraction' | 'scalability';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedComponents: string[];
  location: string;
  impact: string;
}

export interface ArchitectureMetrics {
  coupling: number; // 0-100, lower is better
  cohesion: number; // 0-100, higher is better
  complexity: number; // 0-100, lower is better
  modularity: number; // 0-100, higher is better
}

export class ArchitectureAnalyzer {
  constructor(
    private runtimeExecutor?: RuntimeExecutor
  ) {}

  /**
   * Detect architectural issues in codebase
   */
  async detectIssues(repoPath: string): Promise<ArchitecturalIssue[]> {
    const issues: ArchitecturalIssue[] = [];

    // Detect tight coupling
    const couplingIssues = await this.detectTightCoupling(repoPath);
    issues.push(...couplingIssues);

    // Detect circular dependencies
    const circularIssues = await this.detectCircularDependencies(repoPath);
    issues.push(...circularIssues);

    // Detect missing abstractions
    const abstractionIssues = await this.detectMissingAbstractions(repoPath);
    issues.push(...abstractionIssues);

    // Detect scalability issues
    const scalabilityIssues = await this.detectScalabilityIssues(repoPath);
    issues.push(...scalabilityIssues);

    return issues;
  }

  /**
   * Detect tight coupling between components
   */
  private async detectTightCoupling(repoPath: string): Promise<ArchitecturalIssue[]> {
    const issues: ArchitecturalIssue[] = [];

    // Get all files and their dependencies
    const files = await this.getCodeFiles(repoPath);
    const dependencyMap = await this.buildDependencyMap(files);

    // Analyze coupling
    for (const [file, deps] of Object.entries(dependencyMap)) {
      // High coupling: file depends on many others
      if (deps.length > 10) {
        issues.push({
          type: 'tight_coupling',
          severity: 'high',
          description: `File has ${deps.length} dependencies, indicating tight coupling`,
          affectedComponents: [file, ...deps],
          location: file,
          impact: 'Changes to dependencies will frequently require changes to this file',
        });
      }

      // Check for bidirectional dependencies (strong coupling indicator)
      for (const dep of deps) {
        const depDeps = dependencyMap[dep] || [];
        if (depDeps.includes(file)) {
          issues.push({
            type: 'tight_coupling',
            severity: 'high',
            description: `Bidirectional dependency between ${file} and ${dep}`,
            affectedComponents: [file, dep],
            location: file,
            impact: 'Bidirectional dependencies make code harder to understand and modify',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Detect circular dependencies
   */
  private async detectCircularDependencies(repoPath: string): Promise<ArchitecturalIssue[]> {
    const issues: ArchitecturalIssue[] = [];

    const files = await this.getCodeFiles(repoPath);
    const dependencyMap = await this.buildDependencyMap(files);

    // Find cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (file: string, path: string[]): void => {
      visited.add(file);
      recursionStack.add(file);
      path.push(file);

      const deps = dependencyMap[file] || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep, [...path]);
        } else if (recursionStack.has(dep)) {
          // Found a cycle
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart);
          cycles.push([...cycle, dep]);
        }
      }

      recursionStack.delete(file);
    };

    for (const file of files) {
      if (!visited.has(file)) {
        dfs(file, []);
      }
    }

    // Create issues for each cycle
    for (const cycle of cycles) {
      issues.push({
        type: 'circular_dependency',
        severity: 'high',
        description: `Circular dependency detected: ${cycle.join(' -> ')}`,
        affectedComponents: cycle,
        location: cycle[0] ?? 'unknown',
        impact: 'Circular dependencies make code harder to test and maintain',
      });
    }

    return issues;
  }

  /**
   * Detect missing abstractions
   */
  private async detectMissingAbstractions(repoPath: string): Promise<ArchitecturalIssue[]> {
    const issues: ArchitecturalIssue[] = [];

    if (!this.runtimeExecutor) {
      return issues; // Skip LLM-based analysis if no executor
    }

    const files = await this.getCodeFiles(repoPath);

    // Use LLM to identify code duplication and missing abstractions
    try {
      const prompt = `Analyze the following codebase structure and identify missing abstractions:

Files: ${files.slice(0, 20).join(', ')}${files.length > 20 ? ` and ${files.length - 20} more` : ''}

Look for:
1. Repeated patterns that could be abstracted
2. Similar functionality in multiple files
3. Missing interfaces or base classes
4. Opportunities for dependency injection

Return a JSON array of issues with: type, severity, description, affectedComponents, location, impact`;

      const response = await this.runtimeExecutor.execute({
        taskType: 'code_analysis',
        prompt,
        context: '',
      });

      const llmIssues = JSON.parse(response.content);
      for (const issue of llmIssues) {
        issues.push({
          type: 'missing_abstraction',
          severity: issue.severity || 'medium',
          description: issue.description,
          affectedComponents: issue.affectedComponents || [],
          location: issue.location || repoPath,
          impact: issue.impact || 'Missing abstraction increases code duplication',
        });
      }
    } catch (error) {
      console.warn('LLM analysis for missing abstractions failed:', error);
    }

    return issues;
  }

  /**
   * Detect scalability issues
   */
  private async detectScalabilityIssues(repoPath: string): Promise<ArchitecturalIssue[]> {
    const issues: ArchitecturalIssue[] = [];

    const files = await this.getCodeFiles(repoPath);

    // Check for potential scalability issues
    for (const file of files) {
      try {
        const content = await this.readFile(file);

        // Check for synchronous operations in loops
        if (content.includes('for') && content.includes('await') && !content.includes('Promise.all')) {
          issues.push({
            type: 'scalability',
            severity: 'medium',
            description: 'Sequential async operations in loop - consider parallelization',
            affectedComponents: [file],
            location: file,
            impact: 'Sequential operations limit throughput and increase latency',
          });
        }

        // Check for global state
        if (content.match(/let\s+\w+\s*=.*;\s*$/gm)) {
          issues.push({
            type: 'scalability',
            severity: 'low',
            description: 'Global mutable state detected',
            affectedComponents: [file],
            location: file,
            impact: 'Global state makes horizontal scaling difficult',
          });
        }

        // Check for large in-memory data structures
        if (content.includes('new Map()') || content.includes('new Set()')) {
          const hasSize = content.includes('.size') || content.includes('.length');
          if (!hasSize) {
            issues.push({
              type: 'scalability',
              severity: 'medium',
              description: 'Unbounded in-memory collection detected',
              affectedComponents: [file],
              location: file,
              impact: 'Unbounded collections can cause memory issues at scale',
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to analyze file ${file}:`, error);
      }
    }

    return issues;
  }

  /**
   * Generate refactoring strategy for architectural issues
   */
  async generateRefactoringStrategy(
    issues: ArchitecturalIssue[],
    context: string
  ): Promise<RefactoringPlan> {
    if (!this.runtimeExecutor) {
      throw new Error('RuntimeExecutor required for refactoring strategy generation');
    }

    // Group issues by type
    const issuesByType = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      const arr = acc[issue.type];
      if (arr) arr.push(issue);
      return acc;
    }, {} as Record<string, ArchitecturalIssue[]>);

    const prompt = `Generate a refactoring strategy for the following architectural issues:

${Object.entries(issuesByType).map(([type, typeIssues]) => 
  `${type}: ${typeIssues.length} issues\n${typeIssues.map(i => `  - ${i.description}`).join('\n')}`
).join('\n\n')}

Context: ${context}

Provide:
1. A high-level refactoring strategy
2. Incremental steps to implement the refactoring
3. Affected files for each step
4. Expected benefits
5. Potential risks

Return JSON with: description, steps (array of {description, files, changes}), affectedFiles, estimatedEffort, expectedBenefits, risks`;

    try {
      const response = await this.runtimeExecutor.execute({
        taskType: 'refactoring',
        prompt,
        context: JSON.stringify(issuesByType),
      });

      const plan = JSON.parse(response.content);

      return {
        id: `refactor-${Date.now()}`,
        description: plan.description,
        steps: plan.steps.map((step: any) => ({
          description: step.description,
          files: step.files || [],
          changes: step.changes || '',
        })),
        affectedFiles: plan.affectedFiles || [],
        estimatedEffort: plan.estimatedEffort || 0,
        expectedBenefits: plan.expectedBenefits || [],
        risks: plan.risks || [],
      };
    } catch (error) {
      console.error('Failed to generate refactoring strategy:', error);
      throw error;
    }
  }

  /**
   * Check for backward compatibility issues
   */
  async checkBackwardCompatibility(
    plan: RefactoringPlan,
    _repoPath: string
  ): Promise<{ compatible: boolean; breakingChanges: string[]; suggestions: string[] }> {
    const breakingChanges: string[] = [];
    const suggestions: string[] = [];

    // Analyze each step for breaking changes
    for (const step of plan.steps) {
      for (const file of step.files) {
        try {
          const content = await this.readFile(file);

          // Check for exported API changes
          if (content.includes('export')) {
            // Check if step modifies exports
            if (step.changes.includes('export') || step.changes.includes('interface') || step.changes.includes('class')) {
              breakingChanges.push(`${file}: Potential API surface change`);
              suggestions.push(`Consider adding compatibility layer for ${file}`);
            }
          }

          // Check for signature changes
          if (step.changes.includes('function') || step.changes.includes('method')) {
            breakingChanges.push(`${file}: Function/method signature may change`);
            suggestions.push(`Maintain old signatures with deprecation warnings`);
          }
        } catch (error) {
          console.warn(`Failed to check compatibility for ${file}:`, error);
        }
      }
    }

    return {
      compatible: breakingChanges.length === 0,
      breakingChanges,
      suggestions,
    };
  }

  /**
   * Measure architecture quality metrics
   */
  async measureArchitectureQuality(repoPath: string): Promise<ArchitectureMetrics> {
    const files = await this.getCodeFiles(repoPath);
    const dependencyMap = await this.buildDependencyMap(files);

    // Calculate coupling (average dependencies per file)
    const totalDeps = Object.values(dependencyMap).reduce((sum, deps) => sum + deps.length, 0);
    const avgDeps = files.length > 0 ? totalDeps / files.length : 0;
    const coupling = Math.min(100, avgDeps * 10); // Normalize to 0-100

    // Calculate cohesion (inverse of coupling)
    const cohesion = 100 - coupling;

    // Calculate complexity (based on file count and dependencies)
    const complexity = Math.min(100, (files.length / 10) + coupling);

    // Calculate modularity (based on dependency structure)
    const modularity = Math.max(0, 100 - (coupling + complexity) / 2);

    return {
      coupling: Math.round(coupling),
      cohesion: Math.round(cohesion),
      complexity: Math.round(complexity),
      modularity: Math.round(modularity),
    };
  }

  /**
   * Get all code files in repository
   */
  private async getCodeFiles(repoPath: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const files: string[] = [];

    async function scanDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await scanDir(fullPath);
            }
          } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Failed to scan directory ${dir}:`, error);
      }
    }

    await scanDir(repoPath);
    return files;
  }

  /**
   * Build dependency map from files
   */
  private async buildDependencyMap(files: string[]): Promise<Record<string, string[]>> {
    const dependencyMap: Record<string, string[]> = {};

    for (const file of files) {
      try {
        const content = await this.readFile(file);
        const imports = this.extractImports(content);
        dependencyMap[file] = imports;
      } catch (error) {
        console.warn(`Failed to build dependencies for ${file}:`, error);
        dependencyMap[file] = [];
      }
    }

    return dependencyMap;
  }

  /**
   * Extract import statements from file content
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*\s+from\s+['"](.+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // Only track relative imports (local dependencies)
      if (importPath && (importPath.startsWith('.') || importPath.startsWith('/'))) {
        imports.push(importPath);
      }
    }

    return imports;
  }

  /**
   * Read file content
   */
  private async readFile(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf-8');
  }
}
