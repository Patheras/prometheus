/**
 * Quality Analysis Integration Tests
 * 
 * Tests the complete quality analysis workflow:
 * 1. Analyze code with CodeQualityAnalyzer
 * 2. Rank issues with IssueRanker
 * 3. Generate suggestions
 * 
 * Task 26.3: Implement quality issue ranking
 * Task 26.4: Implement quality suggestions
 */

import { createCodeQualityAnalyzer } from '../code-quality-analyzer';
import { createIssueRanker } from '../issue-ranker';
import { IssueSeverity } from '../types';

describe('Quality Analysis Integration', () => {
  it('should analyze, rank, and generate suggestions for code', async () => {
    // Step 1: Analyze code
    const analyzer = createCodeQualityAnalyzer();
    const code = `
      function complexFunction(a: number, b: string, c: boolean, d: object, e: any, f: number) {
        // TODO: Refactor this
        if (a > 10) {
          if (b.length > 5) {
            if (c) {
              if (d) {
                if (e) {
                  return a * 3.14159 + 42;
                }
              }
            }
          }
        }
        return 0;
      }

      class LargeClass {
        method1() { console.log(1); console.log(1); console.log(1); }
        method2() { console.log(2); console.log(2); console.log(2); }
        method3() { console.log(3); console.log(3); console.log(3); }
        method4() { console.log(4); console.log(4); console.log(4); }
        method5() { console.log(5); console.log(5); console.log(5); }
        method6() { console.log(6); console.log(6); console.log(6); }
        method7() { console.log(7); console.log(7); console.log(7); }
        method8() { console.log(8); console.log(8); console.log(8); }
        method9() { console.log(9); console.log(9); console.log(9); }
        method10() { console.log(10); console.log(10); console.log(10); }
        method11() { console.log(11); console.log(11); console.log(11); }
        method12() { console.log(12); console.log(12); console.log(12); }
        method13() { console.log(13); console.log(13); console.log(13); }
        method14() { console.log(14); console.log(14); console.log(14); }
        method15() { console.log(15); console.log(15); console.log(15); }
        method16() { console.log(16); console.log(16); console.log(16); }
        method17() { console.log(17); console.log(17); console.log(17); }
        method18() { console.log(18); console.log(18); console.log(18); }
        method19() { console.log(19); console.log(19); console.log(19); }
        method20() { console.log(20); console.log(20); console.log(20); }
        method21() { console.log(21); console.log(21); console.log(21); }
        method22() { console.log(22); console.log(22); console.log(22); }
        method23() { console.log(23); console.log(23); console.log(23); }
        method24() { console.log(24); console.log(24); console.log(24); }
        method25() { console.log(25); console.log(25); console.log(25); }
        method26() { console.log(26); console.log(26); console.log(26); }
        method27() { console.log(27); console.log(27); console.log(27); }
        method28() { console.log(28); console.log(28); console.log(28); }
        method29() { console.log(29); console.log(29); console.log(29); }
        method30() { console.log(30); console.log(30); console.log(30); }
      }
    `;

    const result = await analyzer.analyze('problematic.ts', code);

    // Verify analysis found issues
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.qualityScore).toBeLessThan(100);

    // Step 2: Rank issues
    const ranker = createIssueRanker();
    const rankedIssues = ranker.rankIssues(result.issues);

    // Verify ranking
    expect(rankedIssues.length).toBe(result.issues.length);
    
    // First issue should be high priority
    expect(rankedIssues[0].severity).toBeOneOf([
      IssueSeverity.HIGH,
      IssueSeverity.CRITICAL,
      IssueSeverity.MEDIUM,
    ]);

    // Step 3: Generate suggestions for top issues
    const topIssues = ranker.getTopIssues(result.issues, 3);
    expect(topIssues.length).toBeGreaterThan(0);

    for (const issue of topIssues) {
      const suggestion = ranker.generateSuggestion(issue);
      
      // Verify suggestion is generated
      expect(suggestion).toBeTruthy();
      expect(suggestion.length).toBeGreaterThan(0);
      
      // Verify suggestion contains useful information
      expect(suggestion).toMatch(/refactor|extract|improve|fix|consider/i);
    }
  });

  it('should prioritize quick wins (low effort, high impact)', async () => {
    const analyzer = createCodeQualityAnalyzer();
    const code = `
      function calculate() {
        return 3.14159 * 2.71828 * 1.41421 * 9.80665;
      }
    `;

    const result = await analyzer.analyze('quick-wins.ts', code);

    // Rank with emphasis on effort
    const ranker = createIssueRanker({
      severity: 0.2,
      impact: 0.3,
      effort: 0.5,
    });

    const ranked = ranker.rankIssues(result.issues);

    // Magic numbers should be ranked high (low effort)
    if (ranked.length > 0) {
      expect(ranked[0].effortHours).toBeLessThanOrEqual(1);
    }
  });

  it('should group issues by file for reporting', async () => {
    const analyzer = createCodeQualityAnalyzer();
    const ranker = createIssueRanker();

    // Analyze multiple "files"
    const code1 = `function bad1() { return 42 + 3.14; }`;
    const code2 = `function bad2() { return 2.71 * 9.81; }`;

    const result1 = await analyzer.analyze('file1.ts', code1);
    const result2 = await analyzer.analyze('file2.ts', code2);

    const allIssues = [...result1.issues, ...result2.issues];
    const grouped = ranker.groupByFile(allIssues);

    expect(grouped.size).toBe(2);
    expect(grouped.has('file1.ts')).toBe(true);
    expect(grouped.has('file2.ts')).toBe(true);
  });

  it('should generate actionable suggestions for each issue type', async () => {
    const analyzer = createCodeQualityAnalyzer();
    const ranker = createIssueRanker();

    // Code with various issue types
    const code = `
      // TODO: implement properly
      function complex(a, b, c, d, e, f) {
        if (a > 0) {
          if (b > 0) {
            if (c > 0) {
              return 42 * 3.14;
            }
          }
        }
        return 0;
      }

      class Big {
        ${'method() { console.log("x"); }\n'.repeat(40)}
      }
    `;

    const result = await analyzer.analyze('various.ts', code);
    const ranked = ranker.rankIssues(result.issues);

    // Generate suggestions for all issues
    const suggestions = ranked.map(issue => ({
      issue: issue.type,
      suggestion: ranker.generateSuggestion(issue),
    }));

    // Verify each suggestion is actionable
    for (const { suggestion } of suggestions) {
      expect(suggestion).toMatch(/\d+\s+hours?/i); // Contains effort estimate
      expect(suggestion.split('\n').length).toBeGreaterThan(1); // Multi-line
    }
  });

  it('should handle clean code with no issues', async () => {
    const analyzer = createCodeQualityAnalyzer();
    const ranker = createIssueRanker();

    const cleanCode = `
      function add(a: number, b: number): number {
        return a + b;
      }

      function multiply(a: number, b: number): number {
        return a * b;
      }
    `;

    const result = await analyzer.analyze('clean.ts', cleanCode);
    const ranked = ranker.rankIssues(result.issues);

    expect(result.qualityScore).toBeGreaterThan(80);
    expect(ranked.length).toBe(0);
  });

  it('should provide severity-based filtering and ranking', async () => {
    const analyzer = createCodeQualityAnalyzer();
    const ranker = createIssueRanker();

    const code = `
      function problematic(a, b, c, d, e, f, g) {
        // TODO: fix
        if (a) {
          if (b) {
            if (c) {
              if (d) {
                if (e) {
                  return 42 * 3.14 + 2.71;
                }
              }
            }
          }
        }
        return 0;
      }
    `;

    const result = await analyzer.analyze('test.ts', code);
    
    // Group by severity
    const bySeverity = ranker.groupBySeverity(result.issues);
    
    // Verify grouping
    expect(bySeverity.size).toBeGreaterThan(0);
    
    // Get only high severity issues
    const highSeverity = bySeverity.get(IssueSeverity.HIGH) || [];
    const ranked = ranker.rankIssues(highSeverity);
    
    // All should be high severity
    for (const issue of ranked) {
      expect(issue.severity).toBe(IssueSeverity.HIGH);
    }
  });
});

// Custom matcher
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});
