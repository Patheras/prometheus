/**
 * Lane Queue Tests
 * 
 * Tests for lane-based queue system (Tasks 22.1-22.4)
 */

import {
  enqueue,
  enqueueInLane,
  setLaneConcurrency,
  getLaneStatus,
  getQueueDepth,
  getActiveCount,
  getWaitTime,
  drainLaneCompletely,
  getAllLanes,
  clearAllLanes,
} from '../lane-queue';
import { Lane } from '../types';

describe('Lane Queue System (Task 22)', () => {
  beforeEach(() => {
    clearAllLanes();
  });

  afterEach(() => {
    clearAllLanes();
  });

  describe('Task 22.1: Lane Queue Data Structures', () => {
    it('should create lane state on first use', async () => {
      const result = await enqueueInLane(
        async () => 'test',
        'test-lane'
      );

      expect(result).toBe('test');
      expect(getAllLanes()).toContain('test-lane');
    });

    it('should use default concurrency for unknown lanes', async () => {
      await enqueueInLane(async () => 'test', 'unknown-lane');
      const status = getLaneStatus('unknown-lane');
      expect(status.maxConcurrent).toBe(1); // Serial by default
    });

    it('should use configured concurrency for known lanes', async () => {
      await enqueueInLane(async () => 'test', Lane.MAIN);
      const status = getLaneStatus(Lane.MAIN);
      expect(status.maxConcurrent).toBe(4); // Main lane default
    });

    it('should track queue depth', async () => {
      // Enqueue multiple tasks that block
      const blocker = new Promise(resolve => setTimeout(resolve, 100));
      
      const promises = [
        enqueueInLane(async () => blocker, 'test-lane'),
        enqueueInLane(async () => blocker, 'test-lane'),
        enqueueInLane(async () => blocker, 'test-lane'),
      ];

      // Check queue depth before completion
      await new Promise(resolve => setTimeout(resolve, 10));
      const depth = getQueueDepth('test-lane');
      expect(depth).toBeGreaterThan(0);

      await Promise.all(promises);
    });

    it('should track active count', async () => {
      setLaneConcurrency('test-lane', 2);
      
      let activeCount = 0;
      const blocker = new Promise(resolve => setTimeout(resolve, 50));
      
      const promises = [
        enqueueInLane(async () => {
          activeCount = getActiveCount('test-lane');
          await blocker;
        }, 'test-lane'),
        enqueueInLane(async () => {
          activeCount = Math.max(activeCount, getActiveCount('test-lane'));
          await blocker;
        }, 'test-lane'),
      ];

      await Promise.all(promises);
      expect(activeCount).toBeLessThanOrEqual(2);
    });
  });

  describe('Task 22.2: Lane Enqueue Logic', () => {
    it('should enqueue and execute task', async () => {
      const result = await enqueue(async () => 42);
      expect(result).toBe(42);
    });

    it('should enqueue in specific lane', async () => {
      const result = await enqueueInLane(
        async () => 'analysis',
        Lane.ANALYSIS
      );
      expect(result).toBe('analysis');
    });

    it('should return promise that resolves when task completes', async () => {
      let completed = false;
      const promise = enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        completed = true;
        return 'done';
      });

      expect(completed).toBe(false);
      const result = await promise;
      expect(completed).toBe(true);
      expect(result).toBe('done');
    });

    it('should track enqueue time', async () => {
      const blocker = new Promise(resolve => setTimeout(resolve, 100));
      
      // Enqueue first task that blocks
      const promise1 = enqueueInLane(async () => blocker, 'test-lane');
      
      // Enqueue second task
      await new Promise(resolve => setTimeout(resolve, 10));
      const promise2 = enqueueInLane(async () => 'second', 'test-lane');
      
      // Second task should have wait time
      await new Promise(resolve => setTimeout(resolve, 10));
      const waitTime = getWaitTime('test-lane');
      expect(waitTime).toBeGreaterThan(0);

      await Promise.all([promise1, promise2]);
    });

    it('should handle errors without blocking queue', async () => {
      const results: string[] = [];
      
      const promises = [
        enqueueInLane(async () => {
          results.push('task1');
          return 'task1';
        }, 'test-lane'),
        enqueueInLane(async () => {
          results.push('task2-error');
          throw new Error('Task 2 failed');
        }, 'test-lane'),
        enqueueInLane(async () => {
          results.push('task3');
          return 'task3';
        }, 'test-lane'),
      ];

      await expect(promises[1]).rejects.toThrow('Task 2 failed');
      await promises[0];
      await promises[2];

      expect(results).toEqual(['task1', 'task2-error', 'task3']);
    });
  });

  describe('Task 22.3: Lane Drain Logic (Pump)', () => {
    it('should drain tasks up to maxConcurrent', async () => {
      setLaneConcurrency('test-lane', 2);
      
      let concurrent = 0;
      let maxConcurrent = 0;
      
      const task = async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrent--;
      };

      const promises = [
        enqueueInLane(task, 'test-lane'),
        enqueueInLane(task, 'test-lane'),
        enqueueInLane(task, 'test-lane'),
        enqueueInLane(task, 'test-lane'),
      ];

      await Promise.all(promises);
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should execute tasks asynchronously', async () => {
      const order: number[] = [];
      
      const promises = [
        enqueueInLane(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          order.push(1);
        }, 'test-lane'),
        enqueueInLane(async () => {
          await new Promise(resolve => setTimeout(resolve, 25));
          order.push(2);
        }, 'test-lane'),
      ];

      await Promise.all(promises);
      // Tasks should complete in order despite different durations
      expect(order).toEqual([1, 2]);
    });

    it('should recursively drain on completion', async () => {
      const results: number[] = [];
      
      const promises = Array.from({ length: 5 }, (_, i) =>
        enqueueInLane(async () => {
          results.push(i);
          return i;
        }, 'test-lane')
      );

      await Promise.all(promises);
      expect(results).toHaveLength(5);
    });

    it('should handle errors without blocking queue', async () => {
      const results: string[] = [];
      
      const promises = [
        enqueueInLane(async () => {
          results.push('success1');
          return 'success1';
        }, 'test-lane'),
        enqueueInLane(async () => {
          results.push('error');
          throw new Error('Failed');
        }, 'test-lane'),
        enqueueInLane(async () => {
          results.push('success2');
          return 'success2';
        }, 'test-lane'),
      ];

      await expect(promises[1]).rejects.toThrow('Failed');
      await promises[0];
      await promises[2];

      expect(results).toEqual(['success1', 'error', 'success2']);
    });

    it('should respect concurrency limit', async () => {
      setLaneConcurrency('test-lane', 3);
      
      let concurrent = 0;
      let maxConcurrent = 0;
      
      const task = async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(resolve => setTimeout(resolve, 30));
        concurrent--;
      };

      const promises = Array.from({ length: 10 }, () =>
        enqueueInLane(task, 'test-lane')
      );

      await Promise.all(promises);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('Task 22.4: Wait Time Monitoring', () => {
    it('should track wait time for queued tasks', async () => {
      setLaneConcurrency('test-lane', 1);
      
      // Block the lane
      const blocker = new Promise(resolve => setTimeout(resolve, 100));
      const promise1 = enqueueInLane(async () => blocker, 'test-lane');
      
      // Enqueue more tasks
      await new Promise(resolve => setTimeout(resolve, 20));
      const promise2 = enqueueInLane(async () => 'task2', 'test-lane');
      const promise3 = enqueueInLane(async () => 'task3', 'test-lane');
      
      // Check wait time
      await new Promise(resolve => setTimeout(resolve, 20));
      const waitTime = getWaitTime('test-lane');
      expect(waitTime).toBeGreaterThan(0);

      await Promise.all([promise1, promise2, promise3]);
    });

    it('should call onWait callback when wait exceeds threshold', async () => {
      setLaneConcurrency('test-lane', 1);
      
      let waitCallbackCalled = false;
      let reportedWaitMs = 0;
      let reportedQueuedAhead = 0;
      
      // Block the lane
      const blocker = new Promise(resolve => setTimeout(resolve, 150));
      const promise1 = enqueueInLane(async () => blocker, 'test-lane');
      
      // Enqueue task with wait callback
      const promise2 = enqueueInLane(
        async () => 'task2',
        'test-lane',
        {
          warnAfterMs: 50,
          onWait: (waitMs, queuedAhead) => {
            waitCallbackCalled = true;
            reportedWaitMs = waitMs;
            reportedQueuedAhead = queuedAhead;
          },
        }
      );

      await Promise.all([promise1, promise2]);
      
      expect(waitCallbackCalled).toBe(true);
      expect(reportedWaitMs).toBeGreaterThanOrEqual(50);
    });

    it('should log warning when wait exceeds threshold', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      setLaneConcurrency('test-lane', 1);
      
      // Block the lane
      const blocker = new Promise(resolve => setTimeout(resolve, 150));
      const promise1 = enqueueInLane(async () => blocker, 'test-lane');
      
      // Enqueue task with low threshold
      const promise2 = enqueueInLane(
        async () => 'task2',
        'test-lane',
        { warnAfterMs: 50 }
      );

      await Promise.all([promise1, promise2]);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lane wait exceeded')
      );
      
      consoleSpy.mockRestore();
    });

    it('should calculate average wait time correctly', async () => {
      setLaneConcurrency('test-lane', 1);
      
      // Block the lane
      const blocker = new Promise(resolve => setTimeout(resolve, 100));
      const promise1 = enqueueInLane(async () => blocker, 'test-lane');
      
      // Enqueue multiple tasks
      await new Promise(resolve => setTimeout(resolve, 20));
      const promise2 = enqueueInLane(async () => 'task2', 'test-lane');
      await new Promise(resolve => setTimeout(resolve, 20));
      const promise3 = enqueueInLane(async () => 'task3', 'test-lane');
      
      // Check average wait time
      await new Promise(resolve => setTimeout(resolve, 20));
      const avgWaitTime = getWaitTime('test-lane');
      expect(avgWaitTime).toBeGreaterThan(0);

      await Promise.all([promise1, promise2, promise3]);
    });
  });

  describe('Lane Management', () => {
    it('should set lane concurrency', () => {
      setLaneConcurrency('test-lane', 5);
      const status = getLaneStatus('test-lane');
      expect(status.maxConcurrent).toBe(5);
    });

    it('should enforce minimum concurrency of 1', () => {
      setLaneConcurrency('test-lane', 0);
      const status = getLaneStatus('test-lane');
      expect(status.maxConcurrent).toBe(1);
    });

    it('should get lane status', async () => {
      await enqueueInLane(async () => 'test', 'test-lane');
      const status = getLaneStatus('test-lane');
      
      expect(status).toMatchObject({
        lane: 'test-lane',
        queueDepth: expect.any(Number),
        activeCount: expect.any(Number),
        maxConcurrent: expect.any(Number),
        avgWaitTime: expect.any(Number),
        isDraining: expect.any(Boolean),
      });
    });

    it('should drain lane completely', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        enqueueInLane(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          return i;
        }, 'test-lane')
      );

      await drainLaneCompletely('test-lane');
      
      const status = getLaneStatus('test-lane');
      expect(status.queueDepth).toBe(0);
      expect(status.activeCount).toBe(0);

      await Promise.all(promises);
    });

    it('should get all lane names', async () => {
      await enqueueInLane(async () => 'test1', 'lane1');
      await enqueueInLane(async () => 'test2', 'lane2');
      await enqueueInLane(async () => 'test3', 'lane3');
      
      const lanes = getAllLanes();
      expect(lanes).toContain('lane1');
      expect(lanes).toContain('lane2');
      expect(lanes).toContain('lane3');
    });
  });

  describe('Requirement 10.1: Lane Serialization', () => {
    it('should serialize operations in same lane', async () => {
      const order: number[] = [];
      
      const promises = [
        enqueueInLane(async () => {
          order.push(1);
          await new Promise(resolve => setTimeout(resolve, 50));
        }, 'test-lane'),
        enqueueInLane(async () => {
          order.push(2);
          await new Promise(resolve => setTimeout(resolve, 25));
        }, 'test-lane'),
        enqueueInLane(async () => {
          order.push(3);
        }, 'test-lane'),
      ];

      await Promise.all(promises);
      expect(order).toEqual([1, 2, 3]); // FIFO order
    });
  });

  describe('Requirement 10.2: Cross-Lane Concurrency', () => {
    it('should execute operations in different lanes concurrently', async () => {
      const startTimes: Record<string, number> = {};
      const endTimes: Record<string, number> = {};
      
      const task = async (lane: string) => {
        startTimes[lane] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
        endTimes[lane] = Date.now();
      };

      const promises = [
        enqueueInLane(() => task('lane1'), 'lane1'),
        enqueueInLane(() => task('lane2'), 'lane2'),
        enqueueInLane(() => task('lane3'), 'lane3'),
      ];

      await Promise.all(promises);
      
      // All lanes should start around the same time (concurrent)
      const startTimeValues = Object.values(startTimes);
      const maxStartDiff = Math.max(...startTimeValues) - Math.min(...startTimeValues);
      expect(maxStartDiff).toBeLessThan(30); // Started within 30ms
    });
  });

  describe('Requirement 10.4: Lane Isolation on Failure', () => {
    it('should not block other lanes when one lane fails', async () => {
      const results: string[] = [];
      
      const promises = [
        enqueueInLane(async () => {
          throw new Error('Lane 1 failed');
        }, 'lane1').catch(() => results.push('lane1-error')),
        enqueueInLane(async () => {
          results.push('lane2-success');
          return 'lane2';
        }, 'lane2'),
        enqueueInLane(async () => {
          results.push('lane3-success');
          return 'lane3';
        }, 'lane3'),
      ];

      await Promise.all(promises);
      
      expect(results).toContain('lane1-error');
      expect(results).toContain('lane2-success');
      expect(results).toContain('lane3-success');
    });
  });

  describe('Requirement 10.5: Lane Contention Tracking', () => {
    it('should track queue depth for contention monitoring', async () => {
      setLaneConcurrency('test-lane', 1);
      
      // Block the lane
      const blocker = new Promise(resolve => setTimeout(resolve, 100));
      const promise1 = enqueueInLane(async () => blocker, 'test-lane');
      
      // Enqueue more tasks
      const promise2 = enqueueInLane(async () => 'task2', 'test-lane');
      const promise3 = enqueueInLane(async () => 'task3', 'test-lane');
      const promise4 = enqueueInLane(async () => 'task4', 'test-lane');
      
      // Check queue depth
      await new Promise(resolve => setTimeout(resolve, 10));
      const depth = getQueueDepth('test-lane');
      expect(depth).toBeGreaterThan(0);

      await Promise.all([promise1, promise2, promise3, promise4]);
    });
  });
});
