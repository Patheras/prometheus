/**
 * Issue Ranker Tests
 * 
 * Tests for quality issue ranking and suggestion generation.
 * 
 * Task 26.3: Implement quality issue ranking
 * Task 26.4: Implement quality suggestions
 */

import { createIssueRanker } from '../issue-ranker';
import { QualityIssue, IssueSeverity, IssueType } from '../types';

describe('IssueRanker', () => {
  // Helper to create test issues
  const createIssue = (
    type: IssueType,
    severity: IssueSeverity,
    impactScore: number,
    effortHours: number
  ): QualityIssue => ({
    id: `issue-${Math.random()}`,
    type,
    severity,
    filePath: 'test.ts',
    startLine: 1,
    endLine: 10,
    description: `Test ${type} issue`,
    codeSnippet: 'test code',
    impactScore,
    effortHours,
    detectedAt: Date.now(),
  });

  describe('Issue Ranking', () => {
    it('should rank issues by priority', () => {
      const ranker = createIssueRanker();
      const issues: QualityIssue[] = [
        createIssue(IssueType.MAGIC_NUMBER, IssueSeverity.LOW, 20, 0.5),
        createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 3),
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 50, 1),
      ];

      const ranked = ranker.rankIssues(issues);

      // High severity should be first
      expect(ranked[0].severity).toBe(IssueSeverity.HIGH);
      // Low severity should be last
      expect(ranked[ranked.length - 1].severity).toBe(IssueSeverity.LOW);
    });

    it('should prioritize high impact issues', () => {
      const ranker = createIssueRanker();
      const issues: QualityIssue[] = [
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 30, 1),
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 90, 1),
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 60, 1),
      ];

      const ranked = ranker.rankIssues(issues);

      // Higher impact should be first
      expect(ranked[0].impactScore).toBe(90);
      expect(ranked[1].impactScore).toBe(60);
      expect(ranked[2].impactScore).toBe(30);
    });

    it('should prioritize low effort issues when severity is equal', () => {
      const ranker = createIssueRanker();
      const issues: QualityIssue[] = [
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 50, 5),
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 50, 1),
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 50, 3),
      ];

      const ranked = ranker.rankIssues(issues);

      // Lower effort should be first
      expect(ranked[0].effortHours).toBe(1);
      expect(ranked[2].effortHours).toBe(5);
    });

    it('should handle custom ranking weights', () => {
      // Prioritize effort over severity
      const ranker = createIssueRanker({
        severity: 0.1,
        impact: 0.1,
        effort: 0.8,
      });

      const issues: QualityIssue[] = [
        createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 10),
        createIssue(IssueType.MAGIC_NUMBER, IssueSeverity.LOW, 20, 0.5),
      ];

      const ranked = ranker.rankIssues(issues);

      // Low effort should be first despite low severity
      expect(ranked[0].effortHours).toBe(0.5);
    });

    it('should handle empty issue list', () => {
      const ranker = createIssueRanker();
      const ranked = ranker.rankIssues([]);

      expect(ranked).toEqual([]);
    });

    it('should handle single issue', () => {
      const ranker = createIssueRanker();
      const issue = createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 3);
      const ranked = ranker.rankIssues([issue]);

      expect(ranked).toHaveLength(1);
      expect(ranked[0]).toBe(issue);
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate suggestion for complexity issues', () => {
      const ranker = createIssueRanker();
      const issue = createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 3);

      const suggestion = ranker.generateSuggestion(issue);

      expect(suggestion).toContain('Complexity');
      expect(suggestion).toContain('Extract');
      expect(suggestion).toContain('hours');
    });

    it('should generate suggestion for long methods', () => {
      const ranker = createIssueRanker();
      const issue = createIssue(IssueType.LONG_METHOD, IssueSeverity.MEDIUM, 60, 2);

      const suggestion = ranker.generateSuggestion(issue);

      expect(suggestion).toContain('Long Method');
      expect(suggestion).toContain('Extract');
    });

    it('should generate suggestion for large classes', () => {
      const ranker = createIssueRanker();
      const issue = createIssue(IssueType.LARGE_CLASS, IssueSeverity.HIGH, 70, 5);

      const suggestion = ranker.generateSuggestion(issue);

      expect(suggestion).toContain('Large Class');
      expect(suggestion).toContain('Single Responsibility');
    });

    it('should generate suggestion for duplication', () => {
      const ranker = createIssueRanker();
      const issue = createIssue(IssueType.DUPLICATION, IssueSeverity.MEDIUM, 50, 2);

      const suggestion = ranker.generateSuggestion(issue);

      expect(suggestion).toContain('Duplication');
      expect(suggestion).toContain('Extract');
    });

    it('should generate suggestion for magic numbers', () => {
      const ranker = createIssueRanker();
      const issue = createIssue(IssueType.MAGIC_NUMBER, IssueSeverity.LOW, 20, 0.5);

      const suggestion = ranker.generateSuggestion(issue);

      expect(suggestion).toContain('Magic Number');
      expect(suggestion).toContain('constant');
    });

    it('should generate suggestion for code smells', () => {
      const ranker = createIssueRanker();
      const issue = createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 40, 1);

      const suggestion = ranker.generateSuggestion(issue);

      expect(suggestion).toContain('Code Smell');
      expect(suggestion).toContain('refactoring');
    });

    it('should enhance existing suggestions', () => {
      const ranker = createIssueRanker();
      const issue: QualityIssue = {
        ...createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 3),
        suggestion: 'Break down this function',
      };

      const suggestion = ranker.generateSuggestion(issue);

      expect(suggestion).toContain('Break down this function');
      expect(suggestion).toContain('Estimated effort');
    });

    it('should include priority advice for critical issues', () => {
      const ranker = createIssueRanker();
      const issue = createIssue(IssueType.COMPLEXITY, IssueSeverity.CRITICAL, 90, 5);
      issue.suggestion = 'Fix this';

      const suggestion = ranker.generateSuggestion(issue);

      expect(suggestion).toContain('Priority');
    });
  });

  describe('Issue Grouping', () => {
    it('should group issues by file', () => {
      const ranker = createIssueRanker();
      const issues: QualityIssue[] = [
        { ...createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 3), filePath: 'file1.ts' },
        { ...createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 50, 1), filePath: 'file1.ts' },
        { ...createIssue(IssueType.MAGIC_NUMBER, IssueSeverity.LOW, 20, 0.5), filePath: 'file2.ts' },
      ];

      const grouped = ranker.groupByFile(issues);

      expect(grouped.size).toBe(2);
      expect(grouped.get('file1.ts')).toHaveLength(2);
      expect(grouped.get('file2.ts')).toHaveLength(1);
    });

    it('should group issues by severity', () => {
      const ranker = createIssueRanker();
      const issues: QualityIssue[] = [
        createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 3),
        createIssue(IssueType.CODE_SMELL, IssueSeverity.HIGH, 70, 2),
        createIssue(IssueType.MAGIC_NUMBER, IssueSeverity.LOW, 20, 0.5),
      ];

      const grouped = ranker.groupBySeverity(issues);

      expect(grouped.size).toBe(2);
      expect(grouped.get(IssueSeverity.HIGH)).toHaveLength(2);
      expect(grouped.get(IssueSeverity.LOW)).toHaveLength(1);
    });

    it('should handle empty grouping', () => {
      const ranker = createIssueRanker();
      const grouped = ranker.groupByFile([]);

      expect(grouped.size).toBe(0);
    });
  });

  describe('Top Issues', () => {
    it('should return top N issues', () => {
      const ranker = createIssueRanker();
      const issues: QualityIssue[] = [
        createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 3),
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 50, 1),
        createIssue(IssueType.MAGIC_NUMBER, IssueSeverity.LOW, 20, 0.5),
        createIssue(IssueType.LONG_METHOD, IssueSeverity.HIGH, 70, 2),
      ];

      const top = ranker.getTopIssues(issues, 2);

      expect(top).toHaveLength(2);
      // Should be the highest priority issues
      expect(top[0].severity).toBe(IssueSeverity.HIGH);
      expect(top[1].severity).toBe(IssueSeverity.HIGH);
    });

    it('should handle N larger than issue count', () => {
      const ranker = createIssueRanker();
      const issues: QualityIssue[] = [
        createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 3),
      ];

      const top = ranker.getTopIssues(issues, 10);

      expect(top).toHaveLength(1);
    });

    it('should handle empty list', () => {
      const ranker = createIssueRanker();
      const top = ranker.getTopIssues([], 5);

      expect(top).toEqual([]);
    });
  });

  describe('Ranking Consistency', () => {
    it('should produce consistent rankings', () => {
      const ranker = createIssueRanker();
      const issues: QualityIssue[] = [
        createIssue(IssueType.COMPLEXITY, IssueSeverity.HIGH, 80, 3),
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 50, 1),
        createIssue(IssueType.MAGIC_NUMBER, IssueSeverity.LOW, 20, 0.5),
      ];

      const ranked1 = ranker.rankIssues([...issues]);
      const ranked2 = ranker.rankIssues([...issues]);

      expect(ranked1.map(i => i.id)).toEqual(ranked2.map(i => i.id));
    });

    it('should handle issues with same priority', () => {
      const ranker = createIssueRanker();
      const issues: QualityIssue[] = [
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 50, 1),
        createIssue(IssueType.CODE_SMELL, IssueSeverity.MEDIUM, 50, 1),
      ];

      const ranked = ranker.rankIssues(issues);

      expect(ranked).toHaveLength(2);
    });
  });
});
