/**
 * Olympus - Timeout Manager
 * 
 * Manages adaptive timeout durations based on room type and capability.
 * Different room types require different timeout durations:
 * - Media rooms (image/video): 60 seconds
 * - Deep search: 60 seconds
 * - Canvas rooms: 45 seconds
 * - Standard mind rooms: 30 seconds
 */

import { TIMEOUT_CONFIG, type TimeoutConfig } from './room-catalog.js';

/**
 * TimeoutManager - Determines appropriate timeout based on room type and capability
 */
export class TimeoutManager {
  private config: TimeoutConfig;

  constructor(config: TimeoutConfig = TIMEOUT_CONFIG) {
    this.config = config;
  }

  /**
   * Get timeout duration for a room based on its type and capability
   * 
   * @param roomType - 'forge' or 'mind'
   * @param capability - Optional capability: 'image', 'video', 'deep-search', 'canvas-writer', 'canvas-coder'
   * @returns Timeout duration in milliseconds
   */
  getTimeout(roomType: 'forge' | 'mind', capability?: string): number {
    // Handle capability-based timeouts
    if (capability) {
      switch (capability) {
        case 'image':
        case 'video':
          return this.config.media;
        case 'deep-search':
          return this.config.deepSearch;
        case 'canvas-writer':
        case 'canvas-coder':
          return this.config.canvas;
      }
    }

    // Default to standard timeout for mind rooms or forge rooms without specific capability
    return this.config.standard;
  }

  /**
   * Update timeout configuration at runtime
   * 
   * @param key - Timeout configuration key: 'standard', 'media', 'deepSearch', 'canvas'
   * @param timeout - New timeout duration in milliseconds
   */
  updateTimeout(key: keyof TimeoutConfig, timeout: number): void {
    this.config[key] = timeout;
  }
}
