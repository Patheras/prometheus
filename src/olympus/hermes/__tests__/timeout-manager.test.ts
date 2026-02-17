/**
 * Olympus - Timeout Manager Tests
 * 
 * Unit tests for TimeoutManager class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TimeoutManager } from '../timeout-manager.js';
import { TIMEOUT_CONFIG } from '../room-catalog.js';

describe('TimeoutManager', () => {
  let timeoutManager: TimeoutManager;

  beforeEach(() => {
    timeoutManager = new TimeoutManager();
  });

  describe('getTimeout', () => {
    it('should return media timeout for image capability', () => {
      const timeout = timeoutManager.getTimeout('forge', 'image');
      expect(timeout).toBe(TIMEOUT_CONFIG.media);
      expect(timeout).toBe(60000);
    });

    it('should return media timeout for video capability', () => {
      const timeout = timeoutManager.getTimeout('forge', 'video');
      expect(timeout).toBe(TIMEOUT_CONFIG.media);
      expect(timeout).toBe(60000);
    });

    it('should return deepSearch timeout for deep-search capability', () => {
      const timeout = timeoutManager.getTimeout('forge', 'deep-search');
      expect(timeout).toBe(TIMEOUT_CONFIG.deepSearch);
      expect(timeout).toBe(60000);
    });

    it('should return canvas timeout for canvas-writer capability', () => {
      const timeout = timeoutManager.getTimeout('forge', 'canvas-writer');
      expect(timeout).toBe(TIMEOUT_CONFIG.canvas);
      expect(timeout).toBe(45000);
    });

    it('should return canvas timeout for canvas-coder capability', () => {
      const timeout = timeoutManager.getTimeout('forge', 'canvas-coder');
      expect(timeout).toBe(TIMEOUT_CONFIG.canvas);
      expect(timeout).toBe(45000);
    });

    it('should return standard timeout for mind rooms without capability', () => {
      const timeout = timeoutManager.getTimeout('mind');
      expect(timeout).toBe(TIMEOUT_CONFIG.standard);
      expect(timeout).toBe(30000);
    });

    it('should return standard timeout for forge rooms without capability', () => {
      const timeout = timeoutManager.getTimeout('forge');
      expect(timeout).toBe(TIMEOUT_CONFIG.standard);
      expect(timeout).toBe(30000);
    });

    it('should return standard timeout for unknown capability', () => {
      const timeout = timeoutManager.getTimeout('forge', 'unknown-capability');
      expect(timeout).toBe(TIMEOUT_CONFIG.standard);
      expect(timeout).toBe(30000);
    });
  });

  describe('updateTimeout', () => {
    it('should update standard timeout', () => {
      timeoutManager.updateTimeout('standard', 40000);
      const timeout = timeoutManager.getTimeout('mind');
      expect(timeout).toBe(40000);
    });

    it('should update media timeout', () => {
      timeoutManager.updateTimeout('media', 90000);
      const timeout = timeoutManager.getTimeout('forge', 'image');
      expect(timeout).toBe(90000);
    });

    it('should update deepSearch timeout', () => {
      timeoutManager.updateTimeout('deepSearch', 120000);
      const timeout = timeoutManager.getTimeout('forge', 'deep-search');
      expect(timeout).toBe(120000);
    });

    it('should update canvas timeout', () => {
      timeoutManager.updateTimeout('canvas', 60000);
      const timeout = timeoutManager.getTimeout('forge', 'canvas-writer');
      expect(timeout).toBe(60000);
    });

    it('should persist updated timeout across multiple calls', () => {
      timeoutManager.updateTimeout('standard', 50000);
      expect(timeoutManager.getTimeout('mind')).toBe(50000);
      expect(timeoutManager.getTimeout('forge')).toBe(50000);
    });
  });

  describe('custom configuration', () => {
    it('should accept custom timeout configuration', () => {
      const customConfig = {
        standard: 20000,
        media: 80000,
        deepSearch: 100000,
        canvas: 50000,
      };
      const customManager = new TimeoutManager(customConfig);

      expect(customManager.getTimeout('mind')).toBe(20000);
      expect(customManager.getTimeout('forge', 'image')).toBe(80000);
      expect(customManager.getTimeout('forge', 'deep-search')).toBe(100000);
      expect(customManager.getTimeout('forge', 'canvas-writer')).toBe(50000);
    });
  });
});
