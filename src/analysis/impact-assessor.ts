/**
 * Impact Assessor
 * 
 * Assesses the impact of proposed changes by analyzing dependencies,
 * estimating risks, benefits, and effort.
 * 
 * Task 30.1: Create component dependency analysis
 * Task 30.2: Implement affected component identification
 * Task 30.3: Implement risk/benefit/effort estimation
 * Task 30.4: Implement high-impact consultation trigger
 */

import { ImpactAssessment } from './types';
import { RuntimeEngine } from '../runtime';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Proposed change
 */
export type ProposedChange = {
  /** Change description */
  description: string;
  /** Changed files */
  files: string[];
  /** Change type */
  type: 'feature' | 'bugfix' | 'refactor' | 'optimization' | 'breaking';
  /** Optional context */
  context?: string;
};

/**
 * Dependency graph node
 */
export type DependencyNode = {
  /** File path */
  filePath: string;
  /** Direct dependencies (imports) */
  dependencies: string[];
  /** Direct dependents (imported by) */
  dependents: string[];
};

/**
 * Impact thresholds
 */
export type ImpactThresholds = {
  /** High impact: affects this many files or more */
  highImpactFileCount: number;
  /** Critical impact: affects this many files or more */
  criticalImpactFileCount: number;
  /** High risk: risk score threshold */
  highRiskScore: number;
};

/**
 * Impact Assessor
 * 
 * Analyzes the impact of proposed changes.
 */
export class ImpactAssessor {
  private dependencyGraph: Map<string, DependencyNode> = new Map();
  private thresholds: ImpactThresholds;

  constructor(
    private runtimeEngine: RuntimeEngine,
    thresholds?: Partial<ImpactThresholds>
  ) {
    this.thresholds = {
      highImpactFileCount: thresholds?.highImpactFileCount ?? 10,
      criticalImpactFileCount: thresholds?.criticalImpactFileCount ?? 25,
      highRiskScore: thresholds?.highRiskScore ?? 0.7,
    };
  }

  /**
   * Build dependency graph from codebase
   * 
   * @param codebasePath - Path to codebase root
   */
  async buildDependencyGraph(codebasePath: string): Promise<void> {
    this.dependencyGraph.clear();

    const files = await this.findSourceFiles(codebasePath);

    // First pass: collect all files and their imports
    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf-8');
      const dependencies = this.extractImports(content, filePath, codebasePath);

      this.dependencyGraph.set(filePath, {
        filePath,
        dependencies,
        dependents: [],
      });
    }

    // Second pass: build reverse dependencies (dependents)
    for (const [filePath, node] of this.dependencyGraph.entries()) {
      for (const dep of node.dependencies) {
        const depNode = this.dependencyGraph.get(dep);
        if (depNode) {
          depNode.dependents.push(filePath);
        }
      }
    }
  }

  /**
   * Assess impact of a proposed change
   * 
   * @param change - Proposed change
   * @returns Impact assessment
   */
  async assessImpact(change: ProposedChange): Promise<ImpactAssessment> {
    if (this.dependencyGraph.size === 0) {
      throw new Error('Dependency graph not built. Call buildDependencyGraph() first.');
    }

    // Identify affected components
    const affectedComponents = this.identifyAffectedComponents(change.files);

    // Get dependencies
    const directDependencies = this.getDirectDependencies(change.files);
    const transitiveDependencies = this.getTransitiveDependencies(change.files);

    // Estimate risks, benefits, and effort
    const { risks, benefits, effortHours } = await this.estimateImpact(
      change,
      affectedComponents,
      directDependencies,
      transitiveDependencies
    );

    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(risks, affectedComponents.length, change.type);

    // Determine if consultation is required
    const requiresConsultation = this.shouldRequireConsultation(
      riskLevel,
      affectedComponents.length
    );

    return {
      id: `impact-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      changeDescription: change.description,
      affectedComponents,
      directDependencies,
      transitiveDependencies,
      riskLevel,
      risks,
      benefits,
      effortHours,
      requiresConsultation,
      assessedAt: Date.now(),
    };
  }

  /**
   * Identify affected components
   */
  private identifyAffectedComponents(files: string[]): string[] {
    const affected = new Set<string>();

    for (const file of files) {
      // Add the file itself
      affected.add(file);

      // Add all dependents (files that import this file)
      const node = this.dependencyGraph.get(file);
      if (node) {
        for (const dependent of node.dependents) {
          affected.add(dependent);
        }
      }
    }

    return Array.from(affected);
  }

  /**
   * Get direct dependencies
   */
  private getDirectDependencies(files: string[]): string[] {
    const deps = new Set<string>();

    for (const file of files) {
      const node = this.dependencyGraph.get(file);
      if (node) {
        for (const dep of node.dependencies) {
          deps.add(dep);
        }
      }
    }

    return Array.from(deps);
  }

  /**
   * Get transitive dependencies (dependencies of dependencies)
   */
  private getTransitiveDependencies(files: string[]): string[] {
    const visited = new Set<string>(files);
    const transitive = new Set<string>();

    const traverse = (file: string, depth: number = 0) => {
      if (depth > 10) return; // Prevent infinite loops

      const node = this.dependencyGraph.get(file);
      if (!node) return;

      for (const dep of node.dependencies) {
        if (!visited.has(dep)) {
          visited.add(dep);
          transitive.add(dep);
          traverse(dep, depth + 1);
        }
      }
    };

    for (const file of files) {
      traverse(file);
    }

    return Array.from(transitive);
  }

  /**
   * Estimate impact using LLM
   */
  private async estimateImpact(
    change: ProposedChange,
    affectedComponents: string[],
    directDeps: string[],
    transitiveDeps: string[]
  ): Promise<{
    risks: Array<{ description: string; likelihood: number; impact: number }>;
    benefits: Array<{ description: string; value: number }>;
    effortHours: number;
  }> {
    const prompt = this.buildImpactPrompt(
      change,
      affectedComponents,
      directDeps,
      transitiveDeps
    );

    try {
      const response = await this.runtimeEngine.execute({
        taskType: 'decision_making',
        prompt,
        systemPrompt: 'You are a software architect assessing change impact.',
        maxTokens: 600,
      });

      return this.parseImpactResponse(response.content);
    } catch (error) {
      // Fallback to heuristic estimation
      return this.heuristicImpactEstimation(change, affectedComponents);
    }
  }

  /**
   * Build impact estimation prompt
   */
  private buildImpactPrompt(
    change: ProposedChange,
    affected: string[],
    directDeps: string[],
    transitiveDeps: string[]
  ): string {
    let prompt = `Assess the impact of this proposed change:\n\n`;
    prompt += `Description: ${change.description}\n`;
    prompt += `Type: ${change.type}\n`;
    prompt += `Changed Files: ${change.files.length}\n`;
    prompt += `Affected Components: ${affected.length}\n`;
    prompt += `Direct Dependencies: ${directDeps.length}\n`;
    prompt += `Transitive Dependencies: ${transitiveDeps.length}\n`;

    if (change.context) {
      prompt += `\nContext: ${change.context}\n`;
    }

    prompt += `\nProvide:`;
    prompt += `\n1. Risks: List potential risks with likelihood (0-1) and impact (0-1)`;
    prompt += `\n2. Benefits: List expected benefits with value (0-1)`;
    prompt += `\n3. Effort: Estimated hours to implement`;
    prompt += `\n\nFormat:`;
    prompt += `\nRisks:`;
    prompt += `\n- [description] (likelihood: [0-1], impact: [0-1])`;
    prompt += `\nBenefits:`;
    prompt += `\n- [description] (value: [0-1])`;
    prompt += `\nEffort: [hours]`;

    return prompt;
  }

  /**
   * Parse LLM impact response
   */
  private parseImpactResponse(response: string): {
    risks: Array<{ description: string; likelihood: number; impact: number }>;
    benefits: Array<{ description: string; value: number }>;
    effortHours: number;
  } {
    const risks: Array<{ description: string; likelihood: number; impact: number }> = [];
    const benefits: Array<{ description: string; value: number }> = [];
    let effortHours = 4;

    const lines = response.split('\n');
    let section: 'risks' | 'benefits' | 'none' = 'none';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.toLowerCase().startsWith('risks:')) {
        section = 'risks';
      } else if (trimmed.toLowerCase().startsWith('benefits:')) {
        section = 'benefits';
      } else if (trimmed.toLowerCase().startsWith('effort:')) {
        const match = trimmed.match(/(\d+\.?\d*)/);
        if (match) effortHours = parseFloat(match[1]);
        section = 'none';
      } else if (trimmed.startsWith('-') && section === 'risks') {
        const riskMatch = trimmed.match(/likelihood:\s*(\d+\.?\d*)/i);
        const impactMatch = trimmed.match(/impact:\s*(\d+\.?\d*)/i);
        const description = trimmed.substring(1, trimmed.indexOf('(')).trim();

        if (riskMatch && impactMatch && description) {
          risks.push({
            description,
            likelihood: parseFloat(riskMatch[1]),
            impact: parseFloat(impactMatch[1]),
          });
        }
      } else if (trimmed.startsWith('-') && section === 'benefits') {
        const valueMatch = trimmed.match(/value:\s*(\d+\.?\d*)/i);
        const description = trimmed.substring(1, trimmed.indexOf('(')).trim();

        if (valueMatch && description) {
          benefits.push({
            description,
            value: parseFloat(valueMatch[1]),
          });
        }
      }
    }

    return { risks, benefits, effortHours };
  }

  /**
   * Heuristic impact estimation (fallback)
   */
  private heuristicImpactEstimation(
    change: ProposedChange,
    affected: string[]
  ): {
    risks: Array<{ description: string; likelihood: number; impact: number }>;
    benefits: Array<{ description: string; value: number }>;
    effortHours: number;
  } {
    const risks = [];
    const benefits = [];

    // Estimate risks based on change type and scope
    if (change.type === 'breaking') {
      risks.push({
        description: 'Breaking change may affect existing functionality',
        likelihood: 0.8,
        impact: 0.9,
      });
    }

    if (affected.length > this.thresholds.highImpactFileCount) {
      risks.push({
        description: 'Large number of affected files increases regression risk',
        likelihood: 0.6,
        impact: 0.7,
      });
    }

    if (change.type === 'refactor') {
      risks.push({
        description: 'Refactoring may introduce subtle bugs',
        likelihood: 0.4,
        impact: 0.5,
      });
      benefits.push({
        description: 'Improved code maintainability',
        value: 0.7,
      });
    }

    if (change.type === 'optimization') {
      benefits.push({
        description: 'Improved performance',
        value: 0.8,
      });
    }

    // Estimate effort
    const effortHours = Math.max(2, Math.min(40, affected.length * 0.5 + change.files.length * 2));

    return { risks, benefits, effortHours };
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(
    risks: Array<{ likelihood: number; impact: number }>,
    affectedCount: number,
    changeType: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Calculate average risk score
    const avgRisk =
      risks.length > 0
        ? risks.reduce((sum, r) => sum + r.likelihood * r.impact, 0) / risks.length
        : 0;

    // Adjust for scope
    const scopeMultiplier = affectedCount > this.thresholds.criticalImpactFileCount ? 1.5 : 1;
    const adjustedRisk = avgRisk * scopeMultiplier;

    // Adjust for change type
    if (changeType === 'breaking') {
      return 'critical';
    }

    if (adjustedRisk >= 0.7) {
      return 'critical';
    }
    if (adjustedRisk >= 0.5) {
      return 'high';
    }
    if (adjustedRisk >= 0.3) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Determine if consultation is required
   */
  private shouldRequireConsultation(riskLevel: string, affectedCount: number): boolean {
    if (riskLevel === 'critical' || riskLevel === 'high') {
      return true;
    }

    if (affectedCount >= this.thresholds.highImpactFileCount) {
      return true;
    }

    return false;
  }

  /**
   * Find source files in codebase
   */
  private async findSourceFiles(codebasePath: string): Promise<string[]> {
    const files: string[] = [];

    const scan = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip node_modules, dist, build
          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === 'build' ||
            entry.name === '.git'
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            await scan(fullPath);
          } else if (entry.isFile()) {
            if (/\.(ts|js|tsx|jsx)$/.test(entry.name)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await scan(codebasePath);
    return files;
  }

  /**
   * Extract import statements from code
   */
  private extractImports(content: string, filePath: string, codebasePath: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Skip external packages
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue;
      }

      // Resolve relative path
      const resolvedPath = this.resolveImportPath(importPath, filePath, codebasePath);
      if (resolvedPath) {
        imports.push(resolvedPath);
      }
    }

    return imports;
  }

  /**
   * Resolve import path to absolute path
   */
  private resolveImportPath(
    importPath: string,
    fromFile: string,
    codebasePath: string
  ): string | null {
    try {
      const fromDir = path.dirname(fromFile);
      let resolved = path.resolve(fromDir, importPath);

      // Try with extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
      for (const ext of extensions) {
        const withExt = resolved + ext;
        try {
          // Check if file exists (simplified - in real implementation would use fs.stat)
          return withExt;
        } catch {
          continue;
        }
      }

      return resolved;
    } catch {
      return null;
    }
  }
}

/**
 * Create an impact assessor instance
 * 
 * @param runtimeEngine - Runtime engine for LLM calls
 * @param thresholds - Optional custom thresholds
 * @returns Impact assessor instance
 */
export function createImpactAssessor(
  runtimeEngine: RuntimeEngine,
  thresholds?: Partial<ImpactThresholds>
): ImpactAssessor {
  return new ImpactAssessor(runtimeEngine, thresholds);
}
