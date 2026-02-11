/**
 * Repository Pattern Tracker
 * 
 * Learns and tracks repository-specific patterns, conventions, and best practices:
 * - Code organization patterns
 * - Naming conventions
 * - Architecture patterns
 * - Testing patterns
 * - Documentation patterns
 * - Commit message patterns
 */

import { MemoryEngine } from '../memory/engine';

export interface RepositoryPattern {
  id: string;
  repoId: string;
  category: PatternCategory;
  name: string;
  description: string;
  examples: string[];
  confidence: number; // 0-1, how confident we are about this pattern
  occurrences: number; // How many times we've seen this pattern
  lastSeen: number;
  violations: PatternViolation[];
}

export type PatternCategory =
  | 'naming'           // Naming conventions (camelCase, PascalCase, etc.)
  | 'structure'        // File/folder structure
  | 'architecture'     // Architectural patterns (MVC, layered, etc.)
  | 'testing'          // Testing patterns and conventions
  | 'documentation'    // Documentation style and requirements
  | 'commit'           // Commit message format
  | 'code-style'       // Code style preferences
  | 'import'           // Import organization
  | 'error-handling'   // Error handling patterns
  | 'api-design';      // API design patterns

export interface PatternViolation {
  file: string;
  line?: number;
  description: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: number;
}

export interface LearnedConvention {
  type: string;
  pattern: string;
  examples: string[];
  confidence: number;
}

export interface PatternAnalysisResult {
  repoId: string;
  patterns: RepositoryPattern[];
  conventions: LearnedConvention[];
  violations: PatternViolation[];
  recommendations: string[];
}

export class RepositoryPatternTracker {
  private repoId: string;
  private memoryEngine: MemoryEngine;
  private patterns: Map<string, RepositoryPattern> = new Map();

  constructor(repoId: string, memoryEngine: MemoryEngine) {
    this.repoId = repoId;
    this.memoryEngine = memoryEngine;
  }

  /**
   * Analyze repository and learn patterns
   */
  async analyzeRepository(repoPath: string): Promise<PatternAnalysisResult> {
    console.log(`[${this.repoId}] Analyzing repository patterns...`);

    // Load existing patterns from memory
    await this.loadPatterns();

    // Analyze different aspects
    const namingPatterns = await this.analyzeNamingConventions(repoPath);
    const structurePatterns = await this.analyzeStructure(repoPath);
    const architecturePatterns = await this.analyzeArchitecture(repoPath);
    const testingPatterns = await this.analyzeTestingPatterns(repoPath);
    const commitPatterns = await this.analyzeCommitPatterns(repoPath);
    const codeStylePatterns = await this.analyzeCodeStyle(repoPath);

    // Combine all patterns
    const allPatterns = [
      ...namingPatterns,
      ...structurePatterns,
      ...architecturePatterns,
      ...testingPatterns,
      ...commitPatterns,
      ...codeStylePatterns,
    ];

    // Update patterns
    for (const pattern of allPatterns) {
      this.updatePattern(pattern);
    }

    // Save patterns to memory
    await this.savePatterns();

    // Detect violations
    const violations = await this.detectViolations(repoPath);

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    // Extract conventions
    const conventions = this.extractConventions();

    console.log(`[${this.repoId}] Analysis complete: ${allPatterns.length} patterns, ${violations.length} violations`);

    return {
      repoId: this.repoId,
      patterns: Array.from(this.patterns.values()),
      conventions,
      violations,
      recommendations,
    };
  }

  /**
   * Analyze naming conventions
   */
  private async analyzeNamingConventions(repoPath: string): Promise<RepositoryPattern[]> {
    const patterns: RepositoryPattern[] = [];

    // Search for TypeScript/JavaScript files
    const codeResults = await this.memoryEngine.searchCode(
      'function OR class OR interface OR type',
      {
        repoId: this.repoId,
        limit: 100,
      }
    );

    // Analyze naming patterns
    const functionNames: string[] = [];
    const classNames: string[] = [];
    const interfaceNames: string[] = [];

    for (const result of codeResults) {
      // Extract names from code (simplified - in real implementation, use AST)
      const functionMatches = result.content.match(/function\s+(\w+)/g);
      const classMatches = result.content.match(/class\s+(\w+)/g);
      const interfaceMatches = result.content.match(/interface\s+(\w+)/g);

      if (functionMatches) {
        functionNames.push(...functionMatches.map(m => m.split(/\s+/)[1]));
      }
      if (classMatches) {
        classNames.push(...classMatches.map(m => m.split(/\s+/)[1]));
      }
      if (interfaceMatches) {
        interfaceNames.push(...interfaceMatches.map(m => m.split(/\s+/)[1]));
      }
    }

    // Detect function naming convention
    if (functionNames.length > 0) {
      const camelCaseCount = functionNames.filter(n => /^[a-z][a-zA-Z0-9]*$/.test(n)).length;
      const confidence = camelCaseCount / functionNames.length;

      if (confidence > 0.7) {
        patterns.push({
          id: `${this.repoId}-naming-function-camelcase`,
          repoId: this.repoId,
          category: 'naming',
          name: 'Function Naming: camelCase',
          description: 'Functions use camelCase naming convention',
          examples: functionNames.slice(0, 5),
          confidence,
          occurrences: functionNames.length,
          lastSeen: Date.now(),
          violations: [],
        });
      }
    }

    // Detect class naming convention
    if (classNames.length > 0) {
      const pascalCaseCount = classNames.filter(n => /^[A-Z][a-zA-Z0-9]*$/.test(n)).length;
      const confidence = pascalCaseCount / classNames.length;

      if (confidence > 0.7) {
        patterns.push({
          id: `${this.repoId}-naming-class-pascalcase`,
          repoId: this.repoId,
          category: 'naming',
          name: 'Class Naming: PascalCase',
          description: 'Classes use PascalCase naming convention',
          examples: classNames.slice(0, 5),
          confidence,
          occurrences: classNames.length,
          lastSeen: Date.now(),
          violations: [],
        });
      }
    }

    // Detect interface naming convention
    if (interfaceNames.length > 0) {
      const iPrefixCount = interfaceNames.filter(n => n.startsWith('I')).length;
      const confidence = iPrefixCount / interfaceNames.length;

      if (confidence > 0.7) {
        patterns.push({
          id: `${this.repoId}-naming-interface-iprefix`,
          repoId: this.repoId,
          category: 'naming',
          name: 'Interface Naming: I-prefix',
          description: 'Interfaces use I-prefix naming convention',
          examples: interfaceNames.slice(0, 5),
          confidence,
          occurrences: interfaceNames.length,
          lastSeen: Date.now(),
          violations: [],
        });
      } else if (confidence < 0.3) {
        patterns.push({
          id: `${this.repoId}-naming-interface-no-prefix`,
          repoId: this.repoId,
          category: 'naming',
          name: 'Interface Naming: No prefix',
          description: 'Interfaces do not use I-prefix',
          examples: interfaceNames.slice(0, 5),
          confidence: 1 - confidence,
          occurrences: interfaceNames.length,
          lastSeen: Date.now(),
          violations: [],
        });
      }
    }

    return patterns;
  }

  /**
   * Analyze repository structure
   */
  private async analyzeStructure(repoPath: string): Promise<RepositoryPattern[]> {
    const patterns: RepositoryPattern[] = [];

    // Get all files
    const files = await this.memoryEngine.searchCode('*', {
      repoId: this.repoId,
      limit: 1000,
    });

    // Analyze directory structure
    const directories = new Set<string>();
    for (const file of files) {
      const parts = file.path.split('/');
      for (let i = 1; i < parts.length; i++) {
        directories.add(parts.slice(0, i).join('/'));
      }
    }

    // Detect common patterns
    const hasComponents = Array.from(directories).some(d => d.includes('components'));
    const hasUtils = Array.from(directories).some(d => d.includes('utils') || d.includes('helpers'));
    const hasTypes = Array.from(directories).some(d => d.includes('types') || d.includes('interfaces'));
    const hasTests = Array.from(directories).some(d => d.includes('test') || d.includes('__tests__'));

    if (hasComponents) {
      patterns.push({
        id: `${this.repoId}-structure-components`,
        repoId: this.repoId,
        category: 'structure',
        name: 'Component Organization',
        description: 'Components are organized in a dedicated directory',
        examples: Array.from(directories).filter(d => d.includes('components')).slice(0, 3),
        confidence: 0.9,
        occurrences: 1,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    if (hasUtils) {
      patterns.push({
        id: `${this.repoId}-structure-utils`,
        repoId: this.repoId,
        category: 'structure',
        name: 'Utility Organization',
        description: 'Utility functions are organized in a dedicated directory',
        examples: Array.from(directories).filter(d => d.includes('utils') || d.includes('helpers')).slice(0, 3),
        confidence: 0.9,
        occurrences: 1,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    if (hasTypes) {
      patterns.push({
        id: `${this.repoId}-structure-types`,
        repoId: this.repoId,
        category: 'structure',
        name: 'Type Organization',
        description: 'Type definitions are organized in a dedicated directory',
        examples: Array.from(directories).filter(d => d.includes('types') || d.includes('interfaces')).slice(0, 3),
        confidence: 0.9,
        occurrences: 1,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    if (hasTests) {
      patterns.push({
        id: `${this.repoId}-structure-tests`,
        repoId: this.repoId,
        category: 'structure',
        name: 'Test Organization',
        description: 'Tests are organized in dedicated directories',
        examples: Array.from(directories).filter(d => d.includes('test') || d.includes('__tests__')).slice(0, 3),
        confidence: 0.9,
        occurrences: 1,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    return patterns;
  }

  /**
   * Analyze architecture patterns
   */
  private async analyzeArchitecture(repoPath: string): Promise<RepositoryPattern[]> {
    const patterns: RepositoryPattern[] = [];

    // Search for architectural indicators
    const files = await this.memoryEngine.searchCode('*', {
      repoId: this.repoId,
      limit: 1000,
    });

    const paths = files.map(f => f.path.toLowerCase());

    // Detect layered architecture
    const hasControllers = paths.some(p => p.includes('controller'));
    const hasServices = paths.some(p => p.includes('service'));
    const hasRepositories = paths.some(p => p.includes('repository') || p.includes('repo'));
    const hasModels = paths.some(p => p.includes('model') || p.includes('entity'));

    if (hasControllers && hasServices) {
      patterns.push({
        id: `${this.repoId}-arch-layered`,
        repoId: this.repoId,
        category: 'architecture',
        name: 'Layered Architecture',
        description: 'Application uses layered architecture (controllers, services, repositories)',
        examples: ['controllers/', 'services/', 'repositories/'],
        confidence: 0.8,
        occurrences: 1,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    // Detect feature-based organization
    const directories = new Set(paths.map(p => p.split('/')[0]));
    const hasFeatureStructure = Array.from(directories).some(d => 
      paths.filter(p => p.startsWith(d)).length > 5
    );

    if (hasFeatureStructure) {
      patterns.push({
        id: `${this.repoId}-arch-feature-based`,
        repoId: this.repoId,
        category: 'architecture',
        name: 'Feature-Based Organization',
        description: 'Code is organized by features rather than technical layers',
        examples: Array.from(directories).slice(0, 5),
        confidence: 0.7,
        occurrences: 1,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    return patterns;
  }

  /**
   * Analyze testing patterns
   */
  private async analyzeTestingPatterns(repoPath: string): Promise<RepositoryPattern[]> {
    const patterns: RepositoryPattern[] = [];

    // Search for test files
    const testFiles = await this.memoryEngine.searchCode('test OR spec OR __tests__', {
      repoId: this.repoId,
      limit: 100,
    });

    if (testFiles.length === 0) {
      return patterns;
    }

    // Analyze test file naming
    const testExtensions = testFiles.map(f => {
      const match = f.path.match(/\.(test|spec)\.(ts|js|tsx|jsx)$/);
      return match ? match[1] : null;
    }).filter(Boolean);

    const testCount = testExtensions.filter(e => e === 'test').length;
    const specCount = testExtensions.filter(e => e === 'spec').length;

    if (testCount > specCount) {
      patterns.push({
        id: `${this.repoId}-testing-naming-test`,
        repoId: this.repoId,
        category: 'testing',
        name: 'Test File Naming: .test.ts',
        description: 'Test files use .test.ts extension',
        examples: testFiles.filter(f => f.path.includes('.test.')).slice(0, 3).map(f => f.path),
        confidence: testCount / (testCount + specCount),
        occurrences: testCount,
        lastSeen: Date.now(),
        violations: [],
      });
    } else if (specCount > testCount) {
      patterns.push({
        id: `${this.repoId}-testing-naming-spec`,
        repoId: this.repoId,
        category: 'testing',
        name: 'Test File Naming: .spec.ts',
        description: 'Test files use .spec.ts extension',
        examples: testFiles.filter(f => f.path.includes('.spec.')).slice(0, 3).map(f => f.path),
        confidence: specCount / (testCount + specCount),
        occurrences: specCount,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    // Detect test framework
    const jestCount = testFiles.filter(f => f.content.includes('jest') || f.content.includes('describe')).length;
    const mochaCount = testFiles.filter(f => f.content.includes('mocha')).length;

    if (jestCount > mochaCount) {
      patterns.push({
        id: `${this.repoId}-testing-framework-jest`,
        repoId: this.repoId,
        category: 'testing',
        name: 'Testing Framework: Jest',
        description: 'Repository uses Jest as testing framework',
        examples: ['jest', 'describe', 'it', 'expect'],
        confidence: 0.9,
        occurrences: jestCount,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    return patterns;
  }

  /**
   * Analyze commit message patterns
   */
  private async analyzeCommitPatterns(repoPath: string): Promise<RepositoryPattern[]> {
    const patterns: RepositoryPattern[] = [];

    // This would analyze git commit history
    // For now, we'll return a placeholder pattern
    patterns.push({
      id: `${this.repoId}-commit-conventional`,
      repoId: this.repoId,
      category: 'commit',
      name: 'Commit Messages: Conventional Commits',
      description: 'Commit messages follow conventional commits format',
      examples: ['feat: add new feature', 'fix: resolve bug', 'docs: update readme'],
      confidence: 0.7,
      occurrences: 1,
      lastSeen: Date.now(),
      violations: [],
    });

    return patterns;
  }

  /**
   * Analyze code style patterns
   */
  private async analyzeCodeStyle(repoPath: string): Promise<RepositoryPattern[]> {
    const patterns: RepositoryPattern[] = [];

    // Search for code files
    const codeFiles = await this.memoryEngine.searchCode('function OR const OR let', {
      repoId: this.repoId,
      limit: 50,
    });

    if (codeFiles.length === 0) {
      return patterns;
    }

    // Analyze quote style
    const singleQuoteCount = codeFiles.filter(f => (f.content.match(/'/g) || []).length > (f.content.match(/"/g) || []).length).length;
    const doubleQuoteCount = codeFiles.length - singleQuoteCount;

    if (singleQuoteCount > doubleQuoteCount) {
      patterns.push({
        id: `${this.repoId}-style-quotes-single`,
        repoId: this.repoId,
        category: 'code-style',
        name: 'Quote Style: Single Quotes',
        description: 'Code uses single quotes for strings',
        examples: ["'example'", "'string'"],
        confidence: singleQuoteCount / codeFiles.length,
        occurrences: singleQuoteCount,
        lastSeen: Date.now(),
        violations: [],
      });
    } else {
      patterns.push({
        id: `${this.repoId}-style-quotes-double`,
        repoId: this.repoId,
        category: 'code-style',
        name: 'Quote Style: Double Quotes',
        description: 'Code uses double quotes for strings',
        examples: ['"example"', '"string"'],
        confidence: doubleQuoteCount / codeFiles.length,
        occurrences: doubleQuoteCount,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    // Analyze semicolon usage
    const withSemicolons = codeFiles.filter(f => f.content.includes(';')).length;
    const confidence = withSemicolons / codeFiles.length;

    if (confidence > 0.7) {
      patterns.push({
        id: `${this.repoId}-style-semicolons-yes`,
        repoId: this.repoId,
        category: 'code-style',
        name: 'Semicolons: Required',
        description: 'Code uses semicolons at end of statements',
        examples: ['const x = 1;', 'return value;'],
        confidence,
        occurrences: withSemicolons,
        lastSeen: Date.now(),
        violations: [],
      });
    } else if (confidence < 0.3) {
      patterns.push({
        id: `${this.repoId}-style-semicolons-no`,
        repoId: this.repoId,
        category: 'code-style',
        name: 'Semicolons: Optional',
        description: 'Code does not use semicolons',
        examples: ['const x = 1', 'return value'],
        confidence: 1 - confidence,
        occurrences: codeFiles.length - withSemicolons,
        lastSeen: Date.now(),
        violations: [],
      });
    }

    return patterns;
  }

  /**
   * Detect violations of learned patterns
   */
  private async detectViolations(repoPath: string): Promise<PatternViolation[]> {
    const violations: PatternViolation[] = [];

    // Check each pattern for violations
    for (const pattern of this.patterns.values()) {
      if (pattern.confidence < 0.7) continue; // Only check high-confidence patterns

      // Pattern-specific violation detection would go here
      // For now, we'll return empty array
    }

    return violations;
  }

  /**
   * Generate recommendations based on patterns
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze patterns and generate recommendations
    const lowConfidencePatterns = Array.from(this.patterns.values())
      .filter(p => p.confidence < 0.7);

    if (lowConfidencePatterns.length > 0) {
      recommendations.push(
        `Consider establishing clearer conventions for: ${lowConfidencePatterns.map(p => p.category).join(', ')}`
      );
    }

    const namingPatterns = Array.from(this.patterns.values())
      .filter(p => p.category === 'naming');

    if (namingPatterns.length === 0) {
      recommendations.push('Consider establishing naming conventions for functions, classes, and interfaces');
    }

    const testingPatterns = Array.from(this.patterns.values())
      .filter(p => p.category === 'testing');

    if (testingPatterns.length === 0) {
      recommendations.push('Consider adding tests and establishing testing conventions');
    }

    return recommendations;
  }

  /**
   * Extract conventions from patterns
   */
  private extractConventions(): LearnedConvention[] {
    const conventions: LearnedConvention[] = [];

    for (const pattern of this.patterns.values()) {
      if (pattern.confidence > 0.7) {
        conventions.push({
          type: pattern.category,
          pattern: pattern.name,
          examples: pattern.examples,
          confidence: pattern.confidence,
        });
      }
    }

    return conventions;
  }

  /**
   * Update or add a pattern
   */
  private updatePattern(pattern: RepositoryPattern): void {
    const existing = this.patterns.get(pattern.id);

    if (existing) {
      // Update existing pattern
      existing.occurrences += pattern.occurrences;
      existing.confidence = (existing.confidence + pattern.confidence) / 2;
      existing.lastSeen = Date.now();
      existing.examples = [...new Set([...existing.examples, ...pattern.examples])].slice(0, 10);
    } else {
      // Add new pattern
      this.patterns.set(pattern.id, pattern);
    }
  }

  /**
   * Load patterns from memory engine
   */
  private async loadPatterns(): Promise<void> {
    try {
      const results = await this.memoryEngine.searchPatterns(`repo:${this.repoId}`);
      
      for (const result of results) {
        if (result.metadata?.repoId === this.repoId) {
          const pattern: RepositoryPattern = {
            id: result.id,
            repoId: this.repoId,
            category: result.metadata.category as PatternCategory,
            name: result.name,
            description: result.problem,
            examples: result.metadata.examples || [],
            confidence: result.metadata.confidence || 0.5,
            occurrences: result.metadata.occurrences || 1,
            lastSeen: result.metadata.lastSeen || Date.now(),
            violations: [],
          };
          
          this.patterns.set(pattern.id, pattern);
        }
      }

      console.log(`[${this.repoId}] Loaded ${this.patterns.size} existing patterns`);
    } catch (error) {
      console.warn(`[${this.repoId}] Could not load patterns:`, error);
    }
  }

  /**
   * Save patterns to memory engine
   */
  private async savePatterns(): Promise<void> {
    try {
      for (const pattern of this.patterns.values()) {
        await this.memoryEngine.storePattern({
          name: pattern.name,
          category: pattern.category,
          problem: pattern.description,
          solution: `Follow the ${pattern.name} convention`,
          example_code: pattern.examples.join('\n'),
          applicability: `Repository: ${this.repoId}`,
          success_count: pattern.occurrences,
          failure_count: pattern.violations.length,
          metadata: {
            repoId: this.repoId,
            category: pattern.category,
            confidence: pattern.confidence,
            occurrences: pattern.occurrences,
            lastSeen: pattern.lastSeen,
            examples: pattern.examples,
          },
        });
      }

      console.log(`[${this.repoId}] Saved ${this.patterns.size} patterns`);
    } catch (error) {
      console.error(`[${this.repoId}] Failed to save patterns:`, error);
    }
  }

  /**
   * Get all patterns
   */
  getPatterns(): RepositoryPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(category: PatternCategory): RepositoryPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.category === category);
  }

  /**
   * Get high-confidence patterns
   */
  getHighConfidencePatterns(minConfidence: number = 0.7): RepositoryPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.confidence >= minConfidence);
  }
}
