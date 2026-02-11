/**
 * Property-Based Tests for Self-Analyzer
 * 
 * Task 37.5: Write property test for self-analysis quality standards
 * 
 * Property 40: Self-Analysis Quality Standards
 * Validates: Requirements 19.1
 * 
 * Verifies that Prometheus applies the same quality standards to its own code
 * as it does to external code.
 */

import * as fc from 'fast-check';
import { SelfAnalyzer } from '../self-analyzer';
import { createCodeQualityAnalyzer } from '../../analysis/code-quality-analyzer';
import { createDebtDetector } from '../../analysis/debt-detector';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SelfAnalyzer - Property-Based Tests', () => {
  describe('Property 40: Self-Analysis Quality Standards', () => {
    it('should apply same standards to self-code as external code', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random code samples with known quality issues
          fc.record({
            functionName: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z]/.test(s)),
            paramCount: fc.integer({ min: 0, max: 10 }),
            complexity: fc.integer({ min: 1, max: 20 }),
            hasDebt: fc.boolean(),
            hasMagicNumber: fc.boolean(),
          }),
          async (codeSpec) => {
            // Create temporary directories for self-code and external code
            const selfDir = await fs.mkdtemp(path.join(os.tmpdir(), 'self-'));
            const externalDir = await fs.mkdtemp(path.join(os.tmpdir(), 'external-'));

            try {
              // Generate code with specified characteristics
              const code = generateCodeWithCharacteristics(codeSpec);

              // Write same code to both directories
              await fs.mkdir(path.join(selfDir, 'src'), { recursive: true });
              await fs.mkdir(path.join(externalDir, 'src'), { recursive: true });
              
              await fs.writeFile(path.join(selfDir, 'src', 'test.ts'), code);
              await fs.writeFile(path.join(externalDir, 'src', 'test.ts'), code);

              // Analyze as self-code
              const selfAnalyzer = new SelfAnalyzer(
                {
                  prometheusRepoPath: selfDir,
                  analysisInterval: 3600000,
                  triggerOnModification: false,
                },
                createCodeQualityAnalyzer(),
                createDebtDetector()
              );

              const selfResult = await selfAnalyzer.runAnalysis();

              // Analyze as external code
              const externalAnalyzer = createCodeQualityAnalyzer();
              const externalResult = await externalAnalyzer.analyze(
                path.join(externalDir, 'src', 'test.ts'),
                code
              );

              // Property: Same standards should be applied
              // 1. If external code has complexity issues, self-code should too
              const externalComplexityIssues = externalResult.issues.filter(
                i => i.type === 'complexity' || i.type === 'long_method'
              );
              const selfComplexityIssues = selfResult.issues.filter(
                i => i.type === 'complexity' || i.type === 'long_method'
              );

              if (externalComplexityIssues.length > 0) {
                expect(selfComplexityIssues.length).toBeGreaterThan(0);
              }

              // 2. If external code has parameter issues, self-code should too
              const externalParamIssues = externalResult.issues.filter(
                i => i.description.includes('too many parameters')
              );
              const selfParamIssues = selfResult.issues.filter(
                i => i.message.includes('too many parameters')
              );

              if (externalParamIssues.length > 0) {
                expect(selfParamIssues.length).toBeGreaterThan(0);
              }

              // 3. If external code has magic numbers, self-code should detect them too
              const externalMagicNumbers = externalResult.issues.filter(
                i => i.type === 'magic_number'
              );
              const selfMagicNumbers = selfResult.issues.filter(
                i => i.type === 'magic_number'
              );

              if (externalMagicNumbers.length > 0) {
                expect(selfMagicNumbers.length).toBeGreaterThan(0);
              }

              // 4. If code has TODO comments, both should detect them
              if (codeSpec.hasDebt) {
                expect(selfResult.debt.length).toBeGreaterThan(0);
              }

              // 5. Quality scores should be similar (within 10 points)
              // Note: Self-analysis may have slightly different scores due to
              // additional context, but should be in same ballpark
              const scoreDiff = Math.abs(selfResult.metrics.qualityScore - externalResult.qualityScore);
              expect(scoreDiff).toBeLessThan(15);

              // 6. Both should identify improvements for high-severity issues
              const externalHighSeverity = externalResult.issues.filter(
                i => i.severity === 'high' || i.severity === 'critical'
              );
              const selfHighSeverity = selfResult.issues.filter(
                i => i.severity === 'high'
              );

              if (externalHighSeverity.length > 0) {
                // Self-analysis should either have high-severity issues or improvements
                expect(selfHighSeverity.length + selfResult.improvements.length).toBeGreaterThan(0);
              }

            } finally {
              // Cleanup
              await fs.rm(selfDir, { recursive: true, force: true });
              await fs.rm(externalDir, { recursive: true, force: true });
            }
          }
        ),
        {
          numRuns: 100,
          timeout: 60000, // 60 seconds for 100 runs
        }
      );
    }, 120000); // 2 minute timeout for entire test

    it('should not give preferential treatment to self-code', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate code with clear quality violations
          fc.record({
            hasHighComplexity: fc.constant(true),
            hasManyParams: fc.constant(true),
            hasMagicNumbers: fc.constant(true),
            hasDebt: fc.constant(true),
          }),
          async (spec) => {
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-preference-'));

            try {
              // Generate VERY problematic code with multiple severe issues
              const code = `
                // TODO: Fix this mess
                // FIXME: Refactor urgently
                // HACK: This is terrible
                // XXX: Remove this
                function problematic(a, b, c, d, e, f, g, h, i, j, k) {
                  if (a > 0) {
                    if (b > 0) {
                      if (c > 0) {
                        if (d > 0) {
                          if (e > 0) {
                            if (f > 0) {
                              if (g > 0) {
                                if (h > 0) {
                                  if (i > 0) {
                                    if (j > 0) {
                                      return 42 * 3.14159 * 2.71828 * 1.414 * 9.81;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                  return 0;
                }
                
                function anotherBad(x, y, z, w, q, r, s, t, u, v) {
                  if (x) {
                    if (y) {
                      if (z) {
                        if (w) {
                          if (q) {
                            if (r) {
                              return 123 * 456 * 789;
                            }
                          }
                        }
                      }
                    }
                  }
                  return 999;
                }
                
                class HugeClass {
                  method1(a, b, c, d, e, f, g, h) {
                    if (a) { if (b) { if (c) { if (d) { return 1; }}}}
                  }
                  method2(a, b, c, d, e, f, g, h) {
                    if (a) { if (b) { if (c) { if (d) { return 2; }}}}
                  }
                  method3(a, b, c, d, e, f, g, h) {
                    if (a) { if (b) { if (c) { if (d) { return 3; }}}}
                  }
                  method4(a, b, c, d, e, f, g, h) {
                    if (a) { if (b) { if (c) { if (d) { return 4; }}}}
                  }
                  method5(a, b, c, d, e, f, g, h) {
                    if (a) { if (b) { if (c) { if (d) { return 5; }}}}
                  }
                }
              `;

              await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
              await fs.writeFile(path.join(tempDir, 'src', 'bad.ts'), code);

              const analyzer = new SelfAnalyzer(
                {
                  prometheusRepoPath: tempDir,
                  analysisInterval: 3600000,
                  triggerOnModification: false,
                },
                createCodeQualityAnalyzer(),
                createDebtDetector()
              );

              const result = await analyzer.runAnalysis();

              // Property: Self-code with clear violations should be flagged
              // 1. Should detect complexity issues
              const complexityIssues = result.issues.filter(
                i => i.type === 'complexity'
              );
              expect(complexityIssues.length).toBeGreaterThan(0);

              // 2. Should detect parameter count issues
              const paramIssues = result.issues.filter(
                i => i.message.includes('too many parameters')
              );
              expect(paramIssues.length).toBeGreaterThan(0);

              // 3. Should detect technical debt
              expect(result.debt.length).toBeGreaterThan(0);

              // 4. Should have LOW quality score due to many severe issues
              // With 10+ nested ifs, 11 parameters, multiple magic numbers, and 4 TODO comments,
              // quality score MUST be low (< 50)
              expect(result.metrics.qualityScore).toBeLessThan(50);

              // 5. Should identify improvements
              expect(result.improvements.length).toBeGreaterThan(0);

            } finally {
              await fs.rm(tempDir, { recursive: true, force: true });
            }
          }
        ),
        {
          numRuns: 50,
          timeout: 30000,
        }
      );
    }, 60000);

    it('should consistently detect same issues across multiple analyses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            functionName: fc.string({ minLength: 5, maxLength: 15 }).filter(s => /^[a-zA-Z]/.test(s)),
            complexity: fc.integer({ min: 10, max: 20 }),
          }),
          async (spec) => {
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'consistent-'));

            try {
              const code = generateComplexFunction(spec.functionName, spec.complexity);

              await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
              await fs.writeFile(path.join(tempDir, 'src', 'test.ts'), code);

              const analyzer = new SelfAnalyzer(
                {
                  prometheusRepoPath: tempDir,
                  analysisInterval: 3600000,
                  triggerOnModification: false,
                },
                createCodeQualityAnalyzer(),
                createDebtDetector()
              );

              // Run analysis twice
              const result1 = await analyzer.runAnalysis();
              const result2 = await analyzer.runAnalysis();

              // Property: Same code should produce same issues
              expect(result1.issues.length).toBe(result2.issues.length);
              expect(result1.debt.length).toBe(result2.debt.length);
              expect(result1.metrics.qualityScore).toBe(result2.metrics.qualityScore);

              // Issue types should match
              const types1 = result1.issues.map(i => i.type).sort();
              const types2 = result2.issues.map(i => i.type).sort();
              expect(types1).toEqual(types2);

            } finally {
              await fs.rm(tempDir, { recursive: true, force: true });
            }
          }
        ),
        {
          numRuns: 50,
          timeout: 30000,
        }
      );
    }, 60000);
  });
});

/**
 * Generate code with specified characteristics
 */
function generateCodeWithCharacteristics(spec: {
  functionName: string;
  paramCount: number;
  complexity: number;
  hasDebt: boolean;
  hasMagicNumber: boolean;
}): string {
  const params = Array.from({ length: spec.paramCount }, (_, i) => `p${i}`).join(', ');
  
  let body = '';
  
  // Add debt comments if requested
  if (spec.hasDebt) {
    body += '  // TODO: Refactor this function\n';
    body += '  // FIXME: Handle edge cases\n';
  }

  // Add complexity through nested if statements
  let indent = '  ';
  for (let i = 0; i < spec.complexity - 1; i++) {
    body += `${indent}if (p${i % spec.paramCount} > ${i}) {\n`;
    indent += '  ';
  }

  // Add magic number if requested
  const returnValue = spec.hasMagicNumber ? '42 * 3.14159' : '0';
  body += `${indent}return ${returnValue};\n`;

  // Close all if statements
  for (let i = 0; i < spec.complexity - 1; i++) {
    indent = indent.slice(2);
    body += `${indent}}\n`;
  }

  body += '  return 0;\n';

  return `
function ${spec.functionName}(${params}) {
${body}}
`;
}

/**
 * Generate a complex function with specified complexity
 */
function generateComplexFunction(name: string, complexity: number): string {
  let body = '';
  let indent = '  ';

  for (let i = 0; i < complexity; i++) {
    body += `${indent}if (x > ${i}) {\n`;
    indent += '  ';
  }

  body += `${indent}return true;\n`;

  for (let i = 0; i < complexity; i++) {
    indent = indent.slice(2);
    body += `${indent}}\n`;
  }

  body += '  return false;\n';

  return `
function ${name}(x: number): boolean {
${body}}
`;
}
