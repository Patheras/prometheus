/**
 * Technical Debt Detector
 * 
 * Detects and quantifies technical debt including:
 * - Outdated dependencies
 * - TODO/FIXME comments
 * - Missing tests
 * - Architectural violations
 * 
 * Task 27.1: Create debt detection systems
 * Task 27.2: Implement debt quantification
 * Task 27.3: Implement debt threshold monitoring
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TechnicalDebtItem, TechnicalDebtSummary } from './types';
import { randomUUID } from 'crypto';

/**
 * Debt detection options
 */
export type DebtDetectionOptions = {
  /** Include outdated dependencies check */
  includeOutdatedDeps?: boolean;
  /** Include TODO/FIXME comments */
  includeTodoComments?: boolean;
  /** Include missing tests check */
  includeMissingTests?: boolean;
  /** Include architectural violations */
  includeArchitecturalViolations?: boolean;
  /** Minimum priority to report (1-5) */
  minPriority?: number;
  /** Maximum debt items to return */
  maxItems?: number;
};

/**
 * Debt threshold configuration
 */
export type DebtThresholds = {
  /** Critical threshold (hours) */
  critical: number;
  /** Warning threshold (hours) */
  warning: number;
  /** Maximum acceptable debt (hours) */
  maximum: number;
};

/**
 * Technical Debt Detector
 * 
 * Detects various types of technical debt in a codebase.
 */
export class DebtDetector {
  private thresholds: DebtThresholds;

  constructor(thresholds?: Partial<DebtThresholds>) {
    this.thresholds = {
      critical: thresholds?.critical ?? 100,
      warning: thresholds?.warning ?? 50,
      maximum: thresholds?.maximum ?? 200,
    };
  }

  /**
   * Detect technical debt in a codebase
   * 
   * @param codebasePath - Path to codebase root
   * @param options - Detection options
   * @returns Technical debt summary
   */
  async detectDebt(
    codebasePath: string,
    options: DebtDetectionOptions = {}
  ): Promise<TechnicalDebtSummary> {
    const items: TechnicalDebtItem[] = [];

    // Detect outdated dependencies
    if (options.includeOutdatedDeps !== false) {
      const outdatedDeps = await this.detectOutdatedDependencies(codebasePath);
      items.push(...outdatedDeps);
    }

    // Detect TODO/FIXME comments
    if (options.includeTodoComments !== false) {
      const todos = await this.detectTodoComments(codebasePath);
      items.push(...todos);
    }

    // Detect missing tests
    if (options.includeMissingTests !== false) {
      const missingTests = await this.detectMissingTests(codebasePath);
      items.push(...missingTests);
    }

    // Detect architectural violations
    if (options.includeArchitecturalViolations !== false) {
      const violations = await this.detectArchitecturalViolations(codebasePath);
      items.push(...violations);
    }

    // Filter by priority
    let filteredItems = items;
    if (options.minPriority) {
      filteredItems = items.filter((item) => item.priority >= options.minPriority!);
    }

    // Limit results
    if (options.maxItems && filteredItems.length > options.maxItems) {
      // Sort by priority first
      filteredItems.sort((a, b) => b.priority - a.priority);
      filteredItems = filteredItems.slice(0, options.maxItems);
    }

    return this.summarizeDebt(filteredItems);
  }

  /**
   * Detect outdated dependencies
   */
  private async detectOutdatedDependencies(codebasePath: string): Promise<TechnicalDebtItem[]> {
    const items: TechnicalDebtItem[] = [];

    try {
      // Check for package.json
      const packageJsonPath = path.join(codebasePath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Check dependencies (simplified - in real implementation, would check npm registry)
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Detect old version patterns (simplified heuristic)
      for (const [name, version] of Object.entries(deps)) {
        const versionStr = version as string;
        
        // Check for very old versions (< 1.0.0 or old major versions)
        if (versionStr.match(/^[~^]?0\./)) {
          items.push({
            id: randomUUID(),
            type: 'outdated_dependency',
            description: `Dependency '${name}' is on pre-1.0 version (${versionStr})`,
            filePath: packageJsonPath,
            effortHours: 2,
            priority: 3,
            detectedAt: Date.now(),
          });
        }
      }
    } catch (error) {
      // No package.json or error reading it
    }

    return items;
  }

  /**
   * Detect TODO/FIXME comments
   */
  private async detectTodoComments(codebasePath: string): Promise<TechnicalDebtItem[]> {
    const items: TechnicalDebtItem[] = [];

    try {
      const files = await this.findSourceFiles(codebasePath);

      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX):\s*(.+)/i);

          if (todoMatch) {
            const [, type, description] = todoMatch;
            const priority = type.toUpperCase() === 'FIXME' ? 4 : 2;

            items.push({
              id: randomUUID(),
              type: 'todo_comment',
              description: `${type}: ${description.trim()}`,
              filePath,
              lineNumber: i + 1,
              effortHours: 1,
              priority,
              detectedAt: Date.now(),
            });
          }
        }
      }
    } catch (error) {
      // Error scanning files
    }

    return items;
  }

  /**
   * Detect missing tests
   */
  private async detectMissingTests(codebasePath: string): Promise<TechnicalDebtItem[]> {
    const items: TechnicalDebtItem[] = [];

    try {
      const sourceFiles = await this.findSourceFiles(codebasePath);
      const testFiles = await this.findTestFiles(codebasePath);

      // Create set of test file base names
      const testFileNames = new Set(
        testFiles.map((f) => {
          const base = path.basename(f);
          return base
            .replace(/\.(test|spec)\.(ts|js|tsx|jsx)$/, '')
            .replace(/\.(ts|js|tsx|jsx)$/, '');
        })
      );

      // Check each source file for corresponding test
      for (const sourceFile of sourceFiles) {
        // Skip test files themselves
        if (sourceFile.includes('.test.') || sourceFile.includes('.spec.')) {
          continue;
        }

        // Skip certain directories
        if (
          sourceFile.includes('node_modules') ||
          sourceFile.includes('dist') ||
          sourceFile.includes('build')
        ) {
          continue;
        }

        const base = path.basename(sourceFile).replace(/\.(ts|js|tsx|jsx)$/, '');

        if (!testFileNames.has(base)) {
          items.push({
            id: randomUUID(),
            type: 'missing_test',
            description: `No test file found for '${path.basename(sourceFile)}'`,
            filePath: sourceFile,
            effortHours: 3,
            priority: 3,
            detectedAt: Date.now(),
          });
        }
      }
    } catch (error) {
      // Error scanning files
    }

    return items;
  }

  /**
   * Detect architectural violations
   */
  private async detectArchitecturalViolations(
    codebasePath: string
  ): Promise<TechnicalDebtItem[]> {
    const items: TechnicalDebtItem[] = [];

    try {
      const files = await this.findSourceFiles(codebasePath);

      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for circular dependencies (simplified)
        const imports = this.extractImports(content);
        const fileName = path.basename(filePath, path.extname(filePath));

        for (const importPath of imports) {
          if (importPath.includes(fileName)) {
            items.push({
              id: randomUUID(),
              type: 'architectural_violation',
              description: `Potential circular dependency in '${path.basename(filePath)}'`,
              filePath,
              effortHours: 4,
              priority: 4,
              detectedAt: Date.now(),
            });
            break;
          }
        }

        // Check for large files (> 500 lines)
        const lineCount = content.split('\n').length;
        if (lineCount > 500) {
          items.push({
            id: randomUUID(),
            type: 'architectural_violation',
            description: `File is too large (${lineCount} lines) - consider splitting`,
            filePath,
            effortHours: Math.ceil(lineCount / 100),
            priority: 3,
            detectedAt: Date.now(),
          });
        }

        // Check for God objects (classes with many methods)
        const classMatches = content.match(/class\s+\w+/g);
        if (classMatches) {
          const methodCount = (content.match(/\s+(public|private|protected)?\s*\w+\s*\(/g) || [])
            .length;
          if (methodCount > 20) {
            items.push({
              id: randomUUID(),
              type: 'architectural_violation',
              description: `Class has too many methods (${methodCount}) - violates Single Responsibility`,
              filePath,
              effortHours: 8,
              priority: 4,
              detectedAt: Date.now(),
            });
          }
        }
      }
    } catch (error) {
      // Error scanning files
    }

    return items;
  }

  /**
   * Summarize debt items
   */
  private summarizeDebt(items: TechnicalDebtItem[]): TechnicalDebtSummary {
    const totalHours = items.reduce((sum, item) => sum + item.effortHours, 0);

    // Group by type
    const byType: Record<string, number> = {};
    for (const item of items) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    // Group by priority
    const byPriority: Record<number, number> = {};
    for (const item of items) {
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    }

    // Get critical items (priority 5)
    const criticalItems = items.filter((item) => item.priority === 5);

    return {
      totalItems: items.length,
      totalHours,
      byType,
      byPriority,
      criticalItems,
    };
  }

  /**
   * Check if debt exceeds thresholds
   * 
   * @param summary - Debt summary
   * @returns Threshold status
   */
  checkThresholds(summary: TechnicalDebtSummary): {
    exceedsCritical: boolean;
    exceedsWarning: boolean;
    exceedsMaximum: boolean;
    requiresConsultation: boolean;
  } {
    return {
      exceedsCritical: summary.totalHours >= this.thresholds.critical,
      exceedsWarning: summary.totalHours >= this.thresholds.warning,
      exceedsMaximum: summary.totalHours >= this.thresholds.maximum,
      requiresConsultation:
        summary.totalHours >= this.thresholds.critical || summary.criticalItems.length > 0,
    };
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
            // Include TypeScript and JavaScript files
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
   * Find test files in codebase
   */
  private async findTestFiles(codebasePath: string): Promise<string[]> {
    const files = await this.findSourceFiles(codebasePath);
    return files.filter(
      (f) => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__')
    );
  }

  /**
   * Extract import statements from code
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }
}

/**
 * Create a debt detector instance
 * 
 * @param thresholds - Optional custom thresholds
 * @returns Debt detector instance
 */
export function createDebtDetector(thresholds?: Partial<DebtThresholds>): DebtDetector {
  return new DebtDetector(thresholds);
}
