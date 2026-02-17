/**
 * Olympus - Response Detector
 * 
 * Monitors for response completion indicators in Gemini's UI.
 * Detects when the Copy Response Icon appears and handles streaming responses.
 */

import { Page } from 'playwright';

/**
 * ResponseStatus - Status of response completion detection
 */
export interface ResponseStatus {
  complete: boolean;
  timedOut: boolean;
  duration: number;
}

/**
 * ResponseDetector - Detects when Gemini has completed generating a response
 */
export class ResponseDetector {
  private readonly pollingInterval: number = 2000; // 2 seconds
  private readonly logInterval: number = 5; // Log every 5 attempts

  /**
   * Wait for response completion by monitoring for the Copy Response Icon
   * 
   * @param page - Playwright page instance
   * @param timeout - Maximum wait time in milliseconds
   * @returns ResponseStatus with completion status and duration
   */
  async waitForCompletion(page: Page, timeout: number): Promise<ResponseStatus> {
    const startTime = Date.now();
    const maxAttempts = Math.ceil(timeout / this.pollingInterval);
    let attempts = 0;
    let isComplete = false;

    console.log(`⏳ Waiting for response completion (timeout: ${timeout}ms)...`);

    while (!isComplete && attempts < maxAttempts) {
      // Wait for polling interval
      await page.waitForTimeout(this.pollingInterval);
      attempts++;

      // Check if streaming is complete
      const streaming = await this.isStreaming(page);
      if (streaming) {
        // Log progress every 5 attempts
        if (attempts % this.logInterval === 0) {
          console.log(`   Still streaming... (${attempts}/${maxAttempts})`);
        }
        continue;
      }

      // Check for Copy Response Icon
      isComplete = await this.detectCopyIcon(page);

      // Log progress every 5 attempts
      if (!isComplete && attempts % this.logInterval === 0) {
        console.log(`   Still waiting... (${attempts}/${maxAttempts})`);
      }
    }

    const duration = Date.now() - startTime;
    const timedOut = !isComplete && attempts >= maxAttempts;

    if (isComplete) {
      console.log(`✅ Response complete after ${duration}ms`);
    } else if (timedOut) {
      console.log(`⚠️  Response timeout after ${duration}ms`);
    }

    return {
      complete: isComplete,
      timedOut,
      duration,
    };
  }

  /**
   * Detect if the Copy Response Icon is present in the DOM
   * 
   * @param page - Playwright page instance
   * @returns True if Copy Response Icon is detected
   */
  async detectCopyIcon(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      // Look for Copy button/icon patterns in Gemini UI
      const copySelectors = [
        'button[aria-label*="Copy"]',
        'button[title*="Copy"]',
        'button[data-tooltip*="Copy"]',
        '[data-test-id*="copy"]',
        'button[class*="copy"]',
      ];

      // Check if any copy buttons exist and are visible
      for (const selector of copySelectors) {
        const buttons = document.querySelectorAll(selector);
        if (buttons.length > 0) {
          // Verify at least one is visible
          for (const button of Array.from(buttons)) {
            const rect = button.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return true;
            }
          }
        }
      }

      // Alternative: Look for action buttons that appear after response completion
      const actionSelectors = [
        'button[aria-label*="Good response"]',
        'button[aria-label*="Bad response"]',
        'button[aria-label*="Refresh"]',
        '[data-test-id*="thumbs"]',
      ];

      for (const selector of actionSelectors) {
        const buttons = document.querySelectorAll(selector);
        if (buttons.length > 0) {
          for (const button of Array.from(buttons)) {
            const rect = button.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return true;
            }
          }
        }
      }

      return false;
    });
  }

  /**
   * Check if response is currently streaming
   * 
   * @param page - Playwright page instance
   * @returns True if response is streaming
   */
  async isStreaming(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      // Look for streaming indicators in Gemini UI
      const streamingSelectors = [
        '[class*="streaming"]',
        '[data-streaming="true"]',
        '[aria-busy="true"]',
        '.loading-indicator',
        '[class*="typing"]',
      ];

      // Check if any streaming indicators exist and are visible
      for (const selector of streamingSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          for (const element of Array.from(elements)) {
            const rect = element.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return true;
            }
          }
        }
      }

      // Alternative: Check if there's a cursor/blinking indicator
      const cursorSelectors = [
        '.cursor',
        '[class*="cursor"]',
        '[class*="blink"]',
      ];

      for (const selector of cursorSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          for (const element of Array.from(elements)) {
            const rect = element.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return true;
            }
          }
        }
      }

      return false;
    });
  }
}
