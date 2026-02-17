/**
 * Unit tests for ResponseDetector
 */

import { ResponseDetector } from '../response-detector.js';
import { Page } from 'playwright';

// Mock Playwright Page
const createMockPage = (): jest.Mocked<Page> => {
  return {
    waitForTimeout: jest.fn().mockImplementation(async (ms: number) => {
      // Simulate actual wait time for duration calculations
      await new Promise(resolve => setTimeout(resolve, 0));
    }),
    evaluate: jest.fn(),
  } as unknown as jest.Mocked<Page>;
};

describe('ResponseDetector', () => {
  let detector: ResponseDetector;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    detector = new ResponseDetector();
    mockPage = createMockPage();
    jest.clearAllMocks();
    // Suppress console.log during tests
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('detectCopyIcon', () => {
    it('should detect copy icon when present', async () => {
      mockPage.evaluate.mockResolvedValue(true);

      const result = await detector.detectCopyIcon(mockPage);

      expect(result).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should return false when copy icon is not present', async () => {
      mockPage.evaluate.mockResolvedValue(false);

      const result = await detector.detectCopyIcon(mockPage);

      expect(result).toBe(false);
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should check multiple selector patterns', async () => {
      // Verify the evaluate function is called (selector checking happens in browser context)
      mockPage.evaluate.mockResolvedValue(false);

      await detector.detectCopyIcon(mockPage);

      expect(mockPage.evaluate).toHaveBeenCalled();
      // The actual selector checking happens in the browser context via evaluate
    });
  });

  describe('isStreaming', () => {
    it('should detect streaming when active', async () => {
      mockPage.evaluate.mockResolvedValue(true);

      const result = await detector.isStreaming(mockPage);

      expect(result).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should return false when not streaming', async () => {
      mockPage.evaluate.mockResolvedValue(false);

      const result = await detector.isStreaming(mockPage);

      expect(result).toBe(false);
      expect(mockPage.evaluate).toHaveBeenCalledTimes(1);
    });
  });

  describe('waitForCompletion', () => {
    it('should complete successfully when copy icon appears', async () => {
      // Mock: not streaming, copy icon appears on first check
      mockPage.evaluate
        .mockResolvedValueOnce(false) // isStreaming
        .mockResolvedValueOnce(true); // detectCopyIcon

      const result = await detector.waitForCompletion(mockPage, 10000);

      expect(result.complete).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });

    it('should timeout when copy icon never appears', async () => {
      // Mock: never streaming, copy icon never appears
      mockPage.evaluate.mockResolvedValue(false);

      const result = await detector.waitForCompletion(mockPage, 4000);

      expect(result.complete).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should wait for streaming to complete before checking copy icon', async () => {
      // Mock: streaming for 2 checks, then copy icon appears
      mockPage.evaluate
        .mockResolvedValueOnce(true)  // isStreaming - attempt 1
        .mockResolvedValueOnce(true)  // isStreaming - attempt 2
        .mockResolvedValueOnce(false) // isStreaming - attempt 3
        .mockResolvedValueOnce(true); // detectCopyIcon - attempt 3

      const result = await detector.waitForCompletion(mockPage, 10000);

      expect(result.complete).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(mockPage.waitForTimeout).toHaveBeenCalledTimes(3);
    });

    it('should use 2-second polling interval', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce(false) // isStreaming
        .mockResolvedValueOnce(true); // detectCopyIcon

      await detector.waitForCompletion(mockPage, 10000);

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });

    it('should calculate max attempts based on timeout', async () => {
      // With 4000ms timeout and 2000ms interval, should have 2 attempts max
      mockPage.evaluate.mockResolvedValue(false);

      const result = await detector.waitForCompletion(mockPage, 4000);

      // Should make 2 attempts (4000ms / 2000ms = 2)
      expect(mockPage.waitForTimeout).toHaveBeenCalledTimes(2);
      expect(result.timedOut).toBe(true);
    });

    it('should log progress every 5 attempts', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      mockPage.evaluate.mockResolvedValue(false);

      // 12000ms timeout = 6 attempts (12000 / 2000)
      await detector.waitForCompletion(mockPage, 12000);

      // Should log at attempt 5
      const logCalls = consoleSpy.mock.calls.map(call => call[0]);
      const progressLogs = logCalls.filter(log => 
        typeof log === 'string' && log.includes('Still waiting')
      );
      
      expect(progressLogs.length).toBeGreaterThan(0);
    });

    it('should return duration in milliseconds', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce(false) // isStreaming
        .mockResolvedValueOnce(true); // detectCopyIcon

      const startTime = Date.now();
      const result = await detector.waitForCompletion(mockPage, 10000);
      const endTime = Date.now();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThanOrEqual(endTime - startTime + 100); // Allow small margin
    });
  });

  describe('ResponseStatus interface', () => {
    it('should return correct status for successful completion', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce(false) // isStreaming
        .mockResolvedValueOnce(true); // detectCopyIcon

      const result = await detector.waitForCompletion(mockPage, 10000);

      expect(result).toHaveProperty('complete');
      expect(result).toHaveProperty('timedOut');
      expect(result).toHaveProperty('duration');
      expect(typeof result.complete).toBe('boolean');
      expect(typeof result.timedOut).toBe('boolean');
      expect(typeof result.duration).toBe('number');
    });

    it('should return correct status for timeout', async () => {
      mockPage.evaluate.mockResolvedValue(false);

      const result = await detector.waitForCompletion(mockPage, 2000);

      expect(result.complete).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
