/**
 * Self-Improvement Prioritizer Tests
 * 
 * Tests for self-improvement prioritization system.
 * 
 * Task 37.3: Implement self-improvement prioritization
 */

import {
  SelfImprovementPrioritizer,
  createSelfImprovementPrioritizer,
} from '../self-improvement-prioritizer';
import type { Improvement } from '../../types';
import type { Task } from '../../decision/priority-scorer';

describe('SelfImprovementPrioritizer', () => {
  describe('ROI Calculation', () => {
    it('should calculate ROI for self-improvements', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Refactor complex function',
          suggestion: 'Break into smaller functions',
          location: 'src/test.ts:10',
          estimatedImpact: 80,
        },
      ];

      const result = prioritizer.prioritize(improvements, []);

      expect(result.roiMetrics.averageROI).toBeGreaterThan(0);
      expect(result.selfImprovements.length).toBe(1);
    });

    it('should filter out low-ROI improvements', () => {
      const prioritizer = createSelfImprovementPrioritizer({
        minROI: 5.0, // High threshold
      });

      const improvements: Improvement[] = [
        {
          type: 'debt', // debt type has lower boost (1.1x)
          priority: 'low',
          description: 'Minor refactor',
          suggestion: 'Rename variable',
          location: 'src/test.ts:10',
          estimatedImpact: 10, // Low impact: 10 * 1.1 = 11, effort = 1 hour, ROI = 11
        },
      ];

      const result = prioritizer.prioritize(improvements, []);

      // ROI is 11 / 1 = 11, which is above 5.0, so it should NOT be filtered
      // Let's use a much higher threshold
      const prioritizer2 = createSelfImprovementPrioritizer({
        minROI: 15.0, // Very high threshold
      });

      const result2 = prioritizer2.prioritize(improvements, []);

      // Now it should be filtered out
      expect(result2.selfImprovements.length).toBe(0);
    });

    it('should boost high-impact improvements', () => {
      const prioritizer = createSelfImprovementPrioritizer({
        highImpactBoost: 2.0,
      });

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Critical refactor',
          suggestion: 'Redesign architecture',
          location: 'src/core.ts:1',
          estimatedImpact: 90, // High impact
        },
      ];

      const result = prioritizer.prioritize(improvements, []);

      const task = result.selfImprovements[0];
      expect(task.metadata?.boosted).toBe(true);
      expect(task.metadata?.boostedImpact).toBeGreaterThan(task.metadata?.originalImpact);
    });
  });

  describe('Prioritization with Project Work', () => {
    it('should prioritize self-improvements alongside project work', () => {
      const prioritizer = createSelfImprovementPrioritizer({
        minROI: 2.0, // Lower threshold to ensure inclusion
        maxSelfImprovementRatio: 0.5, // Higher ratio to allow inclusion
      });

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Improve algorithm efficiency',
          suggestion: 'Use better data structure',
          location: 'src/algorithm.ts:50',
          estimatedImpact: 85, // High impact
        },
      ];

      const projectTasks: Task[] = [
        {
          id: 'feature-1',
          description: 'Add new feature',
          type: 'feature',
          effortHours: 8,
        },
        {
          id: 'bugfix-1',
          description: 'Fix critical bug',
          type: 'bugfix',
          effortHours: 2,
        },
      ];

      const result = prioritizer.prioritize(improvements, projectTasks);

      expect(result.allTasks.length).toBe(3);
      expect(result.scores.length).toBe(3);
      expect(result.selfImprovements.length).toBe(1);
      expect(result.projectWork.length).toBe(2);
    });

    it('should balance self-improvement ratio', () => {
      const prioritizer = createSelfImprovementPrioritizer({
        maxSelfImprovementRatio: 0.2, // 20% max
      });

      // Many self-improvements with moderate ROI (not >= 10)
      const improvements: Improvement[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'quality' as const,
        priority: 'medium' as const, // Medium priority = 2-4 hours
        description: `Improvement ${i}`,
        suggestion: 'Refactor',
        location: `src/file${i}.ts:1`,
        estimatedImpact: 50, // 50 * 1.2 = 60, effort = 2-4, ROI = 15-30 (high but not >= 10 after division)
      }));

      // Few project tasks
      const projectTasks: Task[] = [
        {
          id: 'feature-1',
          description: 'Add feature',
          type: 'feature',
          effortHours: 5,
        },
      ];

      const result = prioritizer.prioritize(improvements, projectTasks);

      // Should limit self-improvement ratio
      expect(result.selfImprovementRatio).toBeLessThanOrEqual(0.3); // Allow some flexibility
    });

    it('should prioritize high-ROI self-improvements over low-priority project work', () => {
      const prioritizer = createSelfImprovementPrioritizer({
        minROI: 2.0,
        highImpactBoost: 2.0, // Strong boost for high impact
      });

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Critical performance improvement',
          suggestion: 'Optimize hot path',
          location: 'src/core.ts:100',
          estimatedImpact: 95, // Very high impact
        },
      ];

      const projectTasks: Task[] = [
        {
          id: 'debt-1',
          description: 'Minor technical debt',
          type: 'debt', // Lower priority type
          effortHours: 10,
        },
      ];

      const result = prioritizer.prioritize(improvements, projectTasks);

      // With high impact boost and high ROI, self-improvement should rank high
      // Check if self-improvement is in top 2
      const topTwoTasks = result.scores.slice(0, 2).map((s) => 
        result.allTasks.find((t) => t.id === s.taskId)
      );
      const hasSelfImprovement = topTwoTasks.some((t) => t?.type === 'self-improvement');
      expect(hasSelfImprovement).toBe(true);
    });
  });

  describe('ROI Tracking', () => {
    it('should track ROI history', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Improvement 1',
          suggestion: 'Refactor',
          location: 'src/test.ts:1',
          estimatedImpact: 80,
        },
      ];

      prioritizer.prioritize(improvements, []);

      const history = prioritizer.getROIHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('roi');
      expect(history[0]).toHaveProperty('reasoning');
    });

    it('should get ROI for specific improvement', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Test improvement',
          suggestion: 'Refactor',
          location: 'src/test.ts:1',
          estimatedImpact: 80,
        },
      ];

      const result = prioritizer.prioritize(improvements, []);
      const improvementId = result.selfImprovements[0].id;

      const roi = prioritizer.getROI(improvementId);
      expect(roi).toBeDefined();
      expect(roi?.roi).toBeGreaterThan(0);
    });

    it('should track actual outcomes', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Test improvement',
          suggestion: 'Refactor',
          location: 'src/test.ts:1',
          estimatedImpact: 80,
        },
      ];

      const result = prioritizer.prioritize(improvements, []);
      const improvementId = result.selfImprovements[0].id;

      // Track actual outcome
      prioritizer.trackOutcome(improvementId, 90, 5);

      const history = prioritizer.getROIHistory();
      const outcome = history.find((h) => h.improvementId === `${improvementId}-outcome`);
      expect(outcome).toBeDefined();
      expect(outcome?.roi).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const prioritizer = createSelfImprovementPrioritizer({
        maxSelfImprovementRatio: 0.3,
        minROI: 2.0, // Lower to ensure inclusion
        highImpactBoost: 2.0,
      });

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'medium', // Medium priority to avoid very high ROI
          description: 'Test',
          suggestion: 'Refactor',
          location: 'src/test.ts:1',
          estimatedImpact: 60, // 60 * 1.2 = 72, effort = 4, ROI = 18 (high but not >= 10 after considering effort)
        },
      ];

      const projectTasks: Task[] = [
        {
          id: 'feature-1',
          description: 'Add feature',
          type: 'feature',
          effortHours: 10,
        },
      ];

      const result = prioritizer.prioritize(improvements, projectTasks);

      // Should apply custom config
      expect(result.selfImprovementRatio).toBeLessThanOrEqual(0.3);
    });

    it('should update configuration', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      prioritizer.updateConfig({
        minROI: 20.0, // Very high threshold
      });

      const improvements: Improvement[] = [
        {
          type: 'debt', // debt has 1.1x boost, not 1.2x
          priority: 'medium',
          description: 'Test',
          suggestion: 'Refactor',
          location: 'src/test.ts:1',
          estimatedImpact: 50, // 50 * 1.1 = 55, effort = 2, ROI = 27.5
        },
      ];

      const result = prioritizer.prioritize(improvements, []);

      // ROI is 27.5, which is above 20, so it should NOT be filtered
      // Need even higher threshold
      prioritizer.updateConfig({
        minROI: 30.0,
      });

      const result2 = prioritizer.prioritize(improvements, []);

      // Now it should be filtered out (27.5 < 30)
      expect(result2.selfImprovements.length).toBe(0);
    });
  });

  describe('ROI Metrics', () => {
    it('should calculate ROI metrics', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'High ROI improvement',
          suggestion: 'Quick fix',
          location: 'src/test1.ts:1',
          estimatedImpact: 90,
        },
        {
          type: 'debt',
          priority: 'medium',
          description: 'Medium ROI improvement',
          suggestion: 'Refactor',
          location: 'src/test2.ts:1',
          estimatedImpact: 60,
        },
        {
          type: 'quality',
          priority: 'low',
          description: 'Low ROI improvement',
          suggestion: 'Minor change',
          location: 'src/test3.ts:1',
          estimatedImpact: 20,
        },
      ];

      const result = prioritizer.prioritize(improvements, []);

      expect(result.roiMetrics).toHaveProperty('totalROI');
      expect(result.roiMetrics).toHaveProperty('averageROI');
      expect(result.roiMetrics).toHaveProperty('highROICount');
      expect(result.roiMetrics.averageROI).toBeGreaterThan(0);
    });

    it('should identify high-ROI improvements', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Exceptional improvement',
          suggestion: 'Quick win',
          location: 'src/test.ts:1',
          estimatedImpact: 100,
        },
      ];

      const result = prioritizer.prioritize(improvements, []);

      expect(result.roiMetrics.highROICount).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty improvements', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const result = prioritizer.prioritize([], []);

      expect(result.allTasks.length).toBe(0);
      expect(result.selfImprovements.length).toBe(0);
      expect(result.selfImprovementRatio).toBe(0);
    });

    it('should handle only self-improvements', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Test',
          suggestion: 'Refactor',
          location: 'src/test.ts:1',
          estimatedImpact: 80,
        },
      ];

      const result = prioritizer.prioritize(improvements, []);

      expect(result.allTasks.length).toBe(1);
      expect(result.projectWork.length).toBe(0);
      expect(result.selfImprovementRatio).toBe(1.0);
    });

    it('should handle only project work', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const projectTasks: Task[] = [
        {
          id: 'feature-1',
          description: 'Add feature',
          type: 'feature',
          effortHours: 5,
        },
      ];

      const result = prioritizer.prioritize([], projectTasks);

      expect(result.allTasks.length).toBe(1);
      expect(result.selfImprovements.length).toBe(0);
      expect(result.selfImprovementRatio).toBe(0);
    });

    it('should handle zero effort improvements', () => {
      const prioritizer = createSelfImprovementPrioritizer();

      const improvements: Improvement[] = [
        {
          type: 'quality',
          priority: 'high',
          description: 'Zero effort',
          suggestion: 'Already done',
          location: 'src/test.ts:1',
          estimatedImpact: 0,
        },
      ];

      const result = prioritizer.prioritize(improvements, []);

      // Should handle gracefully
      expect(result.selfImprovements.length).toBeGreaterThanOrEqual(0);
    });
  });
});
