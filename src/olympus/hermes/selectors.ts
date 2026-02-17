/**
 * Olympus - Hermes Selectors
 * 
 * Multi-layered selector strategies for Gemini UI
 * OpenClaw pattern: Try multiple selectors with fallback logic
 */

import { Page, ElementHandle } from 'playwright';

/**
 * Gemini UI Selectors (ordered by reliability)
 */
export const GEMINI_SELECTORS = {
  // Input field selectors
  input: [
    'textarea[aria-label*="prompt"]',
    'textarea[aria-label*="Enter"]',
    'textarea[placeholder*="Enter"]',
    'div[contenteditable="true"][role="textbox"]',
    '.input-area textarea',
    'textarea.ql-editor',
    '[data-test-id="prompt-textarea"]',
  ],
  
  // Response/message selectors
  response: [
    '.model-response',
    '[data-message-author-role="model"]',
    '.response-container',
    '.markdown-content',
    '.message-content',
    '[data-test-id="model-response"]',
  ],
  
  // Streaming indicator selectors
  streamingIndicator: [
    '.typing-indicator',
    '[data-streaming="true"]',
    '.response-loading',
    '.loading-dots',
    '[aria-label*="generating"]',
  ],
  
  // Copy button (appears when response is complete)
  copyButton: [
    'button[aria-label*="Copy"]',
    'button[title*="Copy"]',
    '.copy-button',
    '[data-test-id="copy-button"]',
  ],
  
  // New chat button
  newChatButton: [
    'button[aria-label*="New chat"]',
    'button[title*="New chat"]',
    '.new-chat-button',
    '[data-test-id="new-chat"]',
  ],
  
  // Gems button
  gemsButton: [
    'button[aria-label*="Gems"]',
    'a[href*="/gems"]',
    '.gems-button',
    '[data-test-id="gems-button"]',
  ],
  
  // Send button
  sendButton: [
    'button[aria-label*="Send"]',
    'button[title*="Send"]',
    '.send-button',
    '[data-test-id="send-button"]',
  ],
};

/**
 * Find element using fallback selector strategy
 * Tries each selector in order until one works
 */
export async function findElement(
  page: Page,
  selectors: string[],
  options: {
    timeout?: number;
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
  } = {}
): Promise<ElementHandle | null> {
  const timeout = options.timeout || 10000;
  const state = options.state || 'visible';
  
  for (const selector of selectors) {
    try {
      const element = await page.waitForSelector(selector, {
        timeout: 2000,  // Short timeout per selector
        state,
      });
      
      if (element) {
        console.log(`✅ Found element with selector: ${selector}`);
        return element;
      }
    } catch (error) {
      // Try next selector
      continue;
    }
  }
  
  // No selector worked
  console.error(`❌ No selector matched from: ${selectors.join(', ')}`);
  return null;
}

/**
 * Find element with text content
 */
export async function findElementByText(
  page: Page,
  text: string,
  options: {
    exact?: boolean;
    timeout?: number;
  } = {}
): Promise<ElementHandle | null> {
  const exact = options.exact ?? false;
  const timeout = options.timeout || 10000;
  
  try {
    const selector = exact
      ? `text="${text}"`
      : `text=${text}`;
    
    return await page.waitForSelector(selector, { timeout });
  } catch (error) {
    console.error(`❌ Element with text "${text}" not found`);
    return null;
  }
}

/**
 * Wait for element to disappear
 */
export async function waitForElementToDisappear(
  page: Page,
  selectors: string[],
  timeout: number = 120000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    let found = false;
    
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          found = true;
          break;
        }
      } catch {
        // Selector not found, continue
      }
    }
    
    if (!found) {
      return true;  // Element disappeared
    }
    
    // Wait a bit before checking again
    await page.waitForTimeout(500);
  }
  
  return false;  // Timeout
}

/**
 * Check if element exists (without waiting)
 */
export async function elementExists(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    const element = await page.$(selector);
    return element !== null;
  } catch {
    return false;
  }
}

/**
 * Get element text content
 */
export async function getElementText(
  element: ElementHandle
): Promise<string> {
  try {
    const text = await element.textContent();
    return text?.trim() || '';
  } catch (error) {
    console.error('❌ Failed to get element text:', error);
    return '';
  }
}

/**
 * Type text with human-like delays
 */
export async function typeWithDelay(
  element: ElementHandle,
  text: string,
  delayMs: number = 50
): Promise<void> {
  for (const char of text) {
    await element.type(char, { delay: delayMs });
  }
}

