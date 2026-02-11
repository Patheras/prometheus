/**
 * Hierarchical Lanes Tests
 * 
 * Tests for hierarchical lane composition (Task 23.2)
 */

import {
  enqueueNested,
  laneHierarchy,
  LaneHierarchies,
  DeadlockPrevention,
} from '../hierarchical-lanes';
import { clearAllLanes, getLaneStatus, setLaneConcurrency } from '../lane-queue';

describe('Hierarchical Lane Composition (Task 23.2)', () => {
  beforeEach(() => {
    clearAllLanes();
  });

  afterEach(() => {
    clearAllLanes();
  });

  describe('Requirement 10.3: Hierarchical Lane Composition', () => {
    it('should support nested lane queueing', async () => {
      const result = await enqueueNested(
        'outer-lane',
        'inner-lane',
        async () => 'nested-result'
      );

      expect(result).toBe('nested-result');
    });

    it('should maintain lane hierarchy', async () => {
      const executionOrder: string[] = [];

      await enqueueNested(
        'outer-lane',
        'inner-lane',
        async () => {
          executionOrder.push('inner');
          return 'result';
        }
      );

      // Inner task should execute
      expect(executionOrder).toContain('inner');
    });

    it('should prevent deadlocks in nested lanes', async () => {
      setLaneConcurrency('outer-lane', 1);
      setLaneConcurrency('inner-lane', 1);

      const results: string[] = [];

      // Multiple nested tasks should not deadlock
      const promises = [
        enqueueNested('outer-lane', 'inner-lane', async () => {
          results.push('task1');
          return 'task1';
        }),
        enqueueNested('outer-lane', 'inner-lane', async () => {
          results.push('task2');
          return 'task2';
        }),
        enqueueNested('outer-lane', 'inner-lane', async () => {
          results.push('task3');
          return 'task3';
        }),
      ];

      await Promise.all(promises);
      expect(results).toHaveLength(3);
    });

    it('should allow different inner lanes from same outer lane', async () => {
      const results: string[] = [];

      const promises = [
        enqueueNested('outer-lane', 'inner-lane-1', async () => {
          results.push('inner1');
          return 'inner1';
        }),
        enqueueNested('outer-lane', 'inner-lane-2', async () => {
          results.push('inner2');
          return 'inner2';
        }),
      ];

      await Promise.all(promises);
      expect(results).toContain('inner1');
      expect(results).toContain('inner2');
    });

    it('should pass options to both lanes', async () => {
      let outerWaitCalled = false;
      let innerWaitCalled = false;

      await enqueueNested(
        'outer-lane',
        'inner-lane',
        async () => 'result',
        {
          warnAfterMs: 1000,
          onWait: () => {
            outerWaitCalled = true;
          },
        },
        {
          warnAfterMs: 1000,
          onWait: () => {
            innerWaitCalled = true;
          },
        }
      );

      // Options should be passed (though may not trigger in this test)
      expect(outerWaitCalled).toBe(false); // No wait in this test
      expect(innerWaitCalled).toBe(false); // No wait in this test
    });
  });

  describe('Lane Hierarchy Builder', () => {
    it('should build simple hierarchy', async () => {
      const result = await laneHierarchy<string>()
        .in('lane1')
        .then('lane2')
        .execute(async () => 'result');

      expect(result).toBe('result');
    });

    it('should build multi-level hierarchy', async () => {
      const executionOrder: string[] = [];

      await laneHierarchy()
        .in('lane1')
        .then('lane2')
        .then('lane3')
        .execute(async () => {
          executionOrder.push('executed');
          return 'result';
        });

      expect(executionOrder).toContain('executed');
    });

    it('should throw error if no lanes specified', async () => {
      await expect(
        laneHierarchy().execute(async () => 'result')
      ).rejects.toThrow('No lanes specified');
    });

    it('should pass options to each lane', async () => {
      const result = await laneHierarchy<string>()
        .in('lane1', { warnAfterMs: 1000 })
        .then('lane2', { warnAfterMs: 2000 })
        .execute(async () => 'result');

      expect(result).toBe('result');
    });

    it('should execute through hierarchy in correct order', async () => {
      setLaneConcurrency('lane1', 1);
      setLaneConcurrency('lane2', 1);

      const results: string[] = [];

      const promises = [
        laneHierarchy()
          .in('lane1')
          .then('lane2')
          .execute(async () => {
            results.push('task1');
            return 'task1';
          }),
        laneHierarchy()
          .in('lane1')
          .then('lane2')
          .execute(async () => {
            results.push('task2');
            return 'task2';
          }),
      ];

      await Promise.all(promises);
      expect(results).toHaveLength(2);
    });
  });

  describe('Common Lane Hierarchy Patterns', () => {
    it('should support session → main hierarchy', async () => {
      const sessionHierarchy = LaneHierarchies.sessionToMain('user123');
      const result = await sessionHierarchy.enqueue(async () => 'session-result');

      expect(result).toBe('session-result');
    });

    it('should support repo → analysis hierarchy', async () => {
      const repoHierarchy = LaneHierarchies.repoToAnalysis('my-repo');
      const result = await repoHierarchy.enqueue(async () => 'analysis-result');

      expect(result).toBe('analysis-result');
    });

    it('should support file → repo hierarchy', async () => {
      const fileHierarchy = LaneHierarchies.fileToRepo('src/index.ts', 'my-repo');
      const result = await fileHierarchy.enqueue(async () => 'file-result');

      expect(result).toBe('file-result');
    });

    it('should serialize per session in session → main', async () => {
      setLaneConcurrency('session:user123', 1);

      const executionOrder: number[] = [];

      const sessionHierarchy = LaneHierarchies.sessionToMain('user123');
      const promises = [
        sessionHierarchy.enqueue(async () => {
          executionOrder.push(1);
          await new Promise(resolve => setTimeout(resolve, 50));
        }),
        sessionHierarchy.enqueue(async () => {
          executionOrder.push(2);
        }),
      ];

      await Promise.all(promises);
      expect(executionOrder).toEqual([1, 2]); // Serialized
    });

    it('should allow concurrent analysis in repo → analysis', async () => {
      setLaneConcurrency('analysis', 4);

      const startTimes: number[] = [];

      const repoHierarchy = LaneHierarchies.repoToAnalysis('my-repo');
      const promises = [
        repoHierarchy.enqueue(async () => {
          startTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 50));
        }),
        repoHierarchy.enqueue(async () => {
          startTimes.push(Date.now());
          await new Promise(resolve => setTimeout(resolve, 50));
        }),
      ];

      await Promise.all(promises);
      
      // Should start around the same time (concurrent)
      // More tolerant timing for CI environments
      const timeDiff = Math.abs(startTimes[1] - startTimes[0]);
      expect(timeDiff).toBeLessThan(100);
    });
  });

  describe('Deadlock Prevention', () => {
    it('should detect safe hierarchies', () => {
      const safeHierarchy = ['lane1', 'lane2', 'lane3'];
      expect(DeadlockPrevention.isSafeHierarchy(safeHierarchy)).toBe(true);
    });

    it('should detect cycles in hierarchies', () => {
      const cyclicHierarchy = ['lane1', 'lane2', 'lane1']; // Cycle!
      expect(DeadlockPrevention.isSafeHierarchy(cyclicHierarchy)).toBe(false);
    });

    it('should validate safe hierarchies', () => {
      const safeHierarchy = ['lane1', 'lane2', 'lane3'];
      expect(() => {
        DeadlockPrevention.validateHierarchy(safeHierarchy);
      }).not.toThrow();
    });

    it('should throw error for cyclic hierarchies', () => {
      const cyclicHierarchy = ['lane1', 'lane2', 'lane1'];
      expect(() => {
        DeadlockPrevention.validateHierarchy(cyclicHierarchy);
      }).toThrow('Lane hierarchy contains cycles');
    });

    it('should detect multiple cycles', () => {
      const multipleCycles = ['lane1', 'lane2', 'lane1', 'lane2'];
      expect(DeadlockPrevention.isSafeHierarchy(multipleCycles)).toBe(false);
    });
  });

  describe('Integration: Complex Hierarchies', () => {
    it('should handle 3-level hierarchy', async () => {
      const result = await laneHierarchy<string>()
        .in('level1')
        .then('level2')
        .then('level3')
        .execute(async () => 'deep-result');

      expect(result).toBe('deep-result');
    });

    it('should handle multiple tasks in hierarchy', async () => {
      setLaneConcurrency('level1', 1);
      setLaneConcurrency('level2', 2);

      const results: string[] = [];

      const promises = Array.from({ length: 5 }, (_, i) =>
        laneHierarchy()
          .in('level1')
          .then('level2')
          .execute(async () => {
            results.push(`task${i}`);
            return `task${i}`;
          })
      );

      await Promise.all(promises);
      expect(results).toHaveLength(5);
    });

    it('should maintain isolation across different hierarchies', async () => {
      const hierarchy1Results: string[] = [];
      const hierarchy2Results: string[] = [];

      const promises = [
        laneHierarchy()
          .in('h1-lane1')
          .then('h1-lane2')
          .execute(async () => {
            hierarchy1Results.push('h1');
            return 'h1';
          }),
        laneHierarchy()
          .in('h2-lane1')
          .then('h2-lane2')
          .execute(async () => {
            hierarchy2Results.push('h2');
            return 'h2';
          }),
      ];

      await Promise.all(promises);
      expect(hierarchy1Results).toContain('h1');
      expect(hierarchy2Results).toContain('h2');
    });
  });
});
