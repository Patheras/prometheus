/**
 * Code Quality Analyzer Tests
 * 
 * Tests for code parsing, AST analysis, complexity calculation,
 * and code smell detection.
 */

import { createCodeQualityAnalyzer } from '../code-quality-analyzer';
import { IssueType, IssueSeverity } from '../types';

describe('CodeQualityAnalyzer', () => {
  describe('Complexity Analysis', () => {
    it('should detect high cyclomatic complexity', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function complexFunction(x: number): string {
          if (x > 10) {
            if (x > 20) {
              if (x > 30) {
                return 'very high';
              } else {
                return 'high';
              }
            } else {
              return 'medium';
            }
          } else if (x > 5) {
            return 'low';
          } else if (x > 0) {
            return 'very low';
          } else {
            return 'zero or negative';
          }
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      const complexityIssues = result.issues.filter(
        (i) => i.type === IssueType.COMPLEXITY
      );
      expect(complexityIssues.length).toBeGreaterThan(0);
      expect(complexityIssues[0].severity).toBe(IssueSeverity.MEDIUM);
    });

    it('should detect long methods', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const lines = Array(60).fill('  console.log("line");').join('\n');
      const code = `
        function longFunction() {
          ${lines}
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      const longMethodIssues = result.issues.filter(
        (i) => i.type === IssueType.LONG_METHOD
      );
      expect(longMethodIssues.length).toBeGreaterThan(0);
    });

    it('should detect too many parameters', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function manyParams(a: number, b: string, c: boolean, d: object, e: any, f: number) {
          return a + b + c + d + e + f;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      const paramIssues = result.issues.filter(
        (i) => i.description.includes('too many parameters')
      );
      expect(paramIssues.length).toBeGreaterThan(0);
    });

    it('should detect large classes', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const methods = Array(30)
        .fill(0)
        .map((_, i) => `  method${i}() {\n    console.log(${i});\n    console.log(${i});\n    console.log(${i});\n  }`)
        .join('\n');
      const code = `
        class LargeClass {
          ${methods}
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      const largeClassIssues = result.issues.filter(
        (i) => i.type === IssueType.LARGE_CLASS
      );
      expect(largeClassIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Code Smell Detection', () => {
    it('should detect magic numbers', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function calculate(x: number) {
          return x * 3.14159 + 42;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      const magicNumberIssues = result.issues.filter(
        (i) => i.type === IssueType.MAGIC_NUMBER
      );
      expect(magicNumberIssues.length).toBeGreaterThan(0);
    });

    it('should not flag common values as magic numbers', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function calculate(x: number) {
          return x * 0 + 1 - 1;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      const magicNumberIssues = result.issues.filter(
        (i) => i.type === IssueType.MAGIC_NUMBER
      );
      expect(magicNumberIssues.length).toBe(0);
    });

    it('should detect TODO comments', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function doSomething() {
          // TODO: Implement this properly
          return null;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      const todoIssues = result.issues.filter((i) =>
        i.description.includes('TODO')
      );
      expect(todoIssues.length).toBeGreaterThan(0);
    });

    it('should detect FIXME comments', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function buggyFunction() {
          // FIXME: This breaks on edge cases
          return true;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      const fixmeIssues = result.issues.filter((i) =>
        i.description.includes('FIXME')
      );
      expect(fixmeIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Complexity Metrics', () => {
    it('should calculate cyclomatic complexity', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function simpleFunction(x: number) {
          if (x > 0) {
            return x;
          }
          return 0;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      expect(result.complexity.cyclomaticComplexity).toBeGreaterThan(0);
    });

    it('should count lines of code', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function test() {
          const x = 1;
          const y = 2;
          return x + y;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      expect(result.complexity.linesOfCode).toBeGreaterThan(0);
    });

    it('should track nesting depth', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function nested() {
          if (true) {
            if (true) {
              if (true) {
                return 1;
              }
            }
          }
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      expect(result.complexity.nestingDepth).toBeGreaterThan(2);
    });
  });

  describe('Quality Score', () => {
    it('should calculate quality score', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function goodFunction(x: number) {
          return x * 2;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should give high score to clean code', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      expect(result.qualityScore).toBeGreaterThan(80);
    });

    it('should give low score to problematic code', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const lines = Array(100).fill('  console.log("line");').join('\n');
      const code = `
        function badFunction(a, b, c, d, e, f, g) {
          if (a > 0) {
            if (b > 0) {
              if (c > 0) {
                if (d > 0) {
                  ${lines}
                  return 42 * 3.14159 * 2.71828;
                }
              }
            }
          }
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      // Should detect multiple issues and have lower score than clean code
      expect(result.qualityScore).toBeLessThan(90);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Analysis Options', () => {
    it('should respect minSeverity filter', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function test() {
          // TODO: test
          return 42;
        }
      `;

      const result = await analyzer.analyze('test.ts', code, {
        minSeverity: IssueSeverity.HIGH,
      });

      // Should filter out LOW severity issues
      const lowIssues = result.issues.filter(
        (i) => i.severity === IssueSeverity.LOW
      );
      expect(lowIssues.length).toBe(0);
    });

    it('should respect maxIssues limit', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function test() {
          return 42 + 3.14 + 2.71 + 1.41 + 9.81;
        }
      `;

      const result = await analyzer.analyze('test.ts', code, {
        maxIssues: 2,
      });

      expect(result.issues.length).toBeLessThanOrEqual(2);
    });

    it('should skip complexity analysis when disabled', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const lines = Array(60).fill('  console.log("line");').join('\n');
      const code = `
        function longFunction() {
          ${lines}
        }
      `;

      const result = await analyzer.analyze('test.ts', code, {
        includeComplexity: false,
      });

      const complexityIssues = result.issues.filter(
        (i) => i.type === IssueType.COMPLEXITY || i.type === IssueType.LONG_METHOD
      );
      expect(complexityIssues.length).toBe(0);
    });

    it('should skip code smells when disabled', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function test() {
          // TODO: implement
          return 42;
        }
      `;

      const result = await analyzer.analyze('test.ts', code, {
        includeCodeSmells: false,
      });

      const codeSmellIssues = result.issues.filter(
        (i) => i.type === IssueType.CODE_SMELL || i.type === IssueType.MAGIC_NUMBER
      );
      expect(codeSmellIssues.length).toBe(0);
    });
  });

  describe('Result Structure', () => {
    it('should include all required fields', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `function test() { return 1; }`;

      const result = await analyzer.analyze('test.ts', code);

      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('complexity');
      expect(result).toHaveProperty('duplications');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('analyzedAt');
    });

    it('should include issue details', async () => {
      const analyzer = createCodeQualityAnalyzer();
      const code = `
        function test() {
          return 42;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);

      if (result.issues.length > 0) {
        const issue = result.issues[0];
        expect(issue).toHaveProperty('id');
        expect(issue).toHaveProperty('type');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('filePath');
        expect(issue).toHaveProperty('startLine');
        expect(issue).toHaveProperty('endLine');
        expect(issue).toHaveProperty('description');
        expect(issue).toHaveProperty('codeSnippet');
        expect(issue).toHaveProperty('impactScore');
        expect(issue).toHaveProperty('detectedAt');
      }
    });
  });
});
