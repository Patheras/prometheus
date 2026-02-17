/**
 * Playwright Adapter
 * 
 * High-level browser action execution using Playwright.
 * Connects to browser via CDP endpoint and provides comprehensive action capabilities.
 * 
 * Requirements: 2.1
 */

import { chromium, Browser as PlaywrightBrowser, Page, BrowserContext } from 'playwright';
import {
  NavigateOptions,
  NavigateResult,
  ClickOptions,
  TypeOptions,
  ScreenshotOptions,
  PDFOptions,
  PageSnapshot,
  WaitOptions,
  LoadState,
  Cookie,
  AccessibilityNode,
} from './types/index.js';

/**
 * Playwright Adapter for high-level browser automation
 */
export class PlaywrightAdapter {
  private browser: PlaywrightBrowser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private cdpEndpoint: string | null = null;
  private initialized = false;

  /**
   * Initialize the adapter by connecting to a browser via CDP endpoint
   * @param cdpEndpoint WebSocket endpoint URL for CDP connection
   */
  async initialize(cdpEndpoint: string): Promise<void> {
    if (this.initialized) {
      throw new Error('PlaywrightAdapter is already initialized');
    }

    try {
      this.cdpEndpoint = cdpEndpoint;

      // Connect to the browser via CDP
      this.browser = await chromium.connectOverCDP(cdpEndpoint);

      // Get or create a context
      const contexts = this.browser.contexts();
      if (contexts.length > 0) {
        this.context = contexts[0];
      } else {
        this.context = await this.browser.newContext();
      }

      // Get or create a page
      const pages = this.context.pages();
      if (pages.length > 0) {
        this.page = pages[0];
      } else {
        this.page = await this.context.newPage();
      }

      this.initialized = true;
    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to initialize PlaywrightAdapter: ${error}`);
    }
  }

  /**
   * Close the adapter and clean up resources
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      // Note: We don't close the browser itself since we connected via CDP
      // The browser is managed externally (by chrome-launcher or user)
      // We only disconnect from it
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      // Ignore errors during cleanup
      console.error('Error during PlaywrightAdapter cleanup:', error);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Navigate to a URL
   * @param url URL to navigate to
   * @param options Navigation options
   * @returns Navigation result with URL, status, title, and load time
   */
  async navigate(url: string, options?: NavigateOptions): Promise<NavigateResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const waitUntil = options?.waitUntil || 'load';
    const timeout = options?.timeout;

    try {
      const response = await this.page!.goto(url, {
        waitUntil,
        timeout,
      });

      const loadTime = Date.now() - startTime;
      const title = await this.page!.title();

      return {
        url: this.page!.url(),
        status: response?.status() || 0,
        title,
        loadTime,
      };
    } catch (error) {
      throw new Error(`Navigation failed: ${error}`);
    }
  }

  /**
   * Go back in browser history
   */
  async goBack(): Promise<void> {
    this.ensureInitialized();
    await this.page!.goBack();
  }

  /**
   * Go forward in browser history
   */
  async goForward(): Promise<void> {
    this.ensureInitialized();
    await this.page!.goForward();
  }

  /**
   * Reload the current page
   */
  async reload(): Promise<void> {
    this.ensureInitialized();
    await this.page!.reload();
  }

  /**
   * Click an element
   * @param selector CSS selector or XPath for the element
   * @param options Click options
   */
  async click(selector: string, options?: ClickOptions): Promise<void> {
    this.ensureInitialized();

    try {
      await this.page!.click(selector, {
        button: options?.button,
        clickCount: options?.clickCount,
        delay: options?.delay,
        timeout: options?.timeout,
      });
    } catch (error) {
      throw new Error(`Click failed for selector "${selector}": ${error}`);
    }
  }

  /**
   * Type text into an input element
   * @param selector CSS selector or XPath for the input element
   * @param text Text to type
   * @param options Type options
   */
  async type(selector: string, text: string, options?: TypeOptions): Promise<void> {
    this.ensureInitialized();

    try {
      await this.page!.type(selector, text, {
        delay: options?.delay,
        timeout: options?.timeout,
      });
    } catch (error) {
      throw new Error(`Type failed for selector "${selector}": ${error}`);
    }
  }

  /**
   * Fill an input element with a value (faster than type, no events)
   * @param selector CSS selector or XPath for the input element
   * @param value Value to fill
   */
  async fill(selector: string, value: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.page!.fill(selector, value);
    } catch (error) {
      throw new Error(`Fill failed for selector "${selector}": ${error}`);
    }
  }

  /**
   * Select options in a <select> element
   * @param selector CSS selector or XPath for the select element
   * @param values Values to select
   */
  async select(selector: string, values: string[]): Promise<void> {
    this.ensureInitialized();

    try {
      await this.page!.selectOption(selector, values);
    } catch (error) {
      throw new Error(`Select failed for selector "${selector}": ${error}`);
    }
  }

  /**
   * Hover over an element
   * @param selector CSS selector or XPath for the element
   */
  async hover(selector: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.page!.hover(selector);
    } catch (error) {
      throw new Error(`Hover failed for selector "${selector}": ${error}`);
    }
  }

  /**
   * Take a screenshot
   * @param options Screenshot options
   * @returns Screenshot as a Buffer
   */
  async screenshot(options?: ScreenshotOptions): Promise<Buffer> {
    this.ensureInitialized();

    try {
      return await this.page!.screenshot({
        type: options?.type,
        quality: options?.quality,
        fullPage: options?.fullPage,
        clip: options?.clip,
        path: options?.path,
      });
    } catch (error) {
      throw new Error(`Screenshot failed: ${error}`);
    }
  }

  /**
   * Generate a PDF of the current page
   * @param options PDF options
   * @returns PDF as a Buffer
   */
  async pdf(options?: PDFOptions): Promise<Buffer> {
    this.ensureInitialized();

    try {
      return await this.page!.pdf({
        path: options?.path,
        format: options?.format,
        width: options?.width,
        height: options?.height,
        margin: options?.margin,
        printBackground: options?.printBackground,
      });
    } catch (error) {
      throw new Error(`PDF generation failed: ${error}`);
    }
  }

  /**
   * Capture a page snapshot including DOM and accessibility tree
   * @returns Page snapshot with HTML, accessibility tree, and metadata
   */
  async snapshot(): Promise<PageSnapshot> {
    this.ensureInitialized();

    try {
      const html = await this.page!.content();
      const title = await this.page!.title();
      const url = this.page!.url();
      const viewport = this.page!.viewportSize() || { width: 0, height: 0 };

      // Get accessibility tree
      const accessibilitySnapshot = await this.page!.accessibility.snapshot();
      const accessibilityTree = this.convertAccessibilityTree(accessibilitySnapshot);

      return {
        url,
        title,
        html,
        accessibilityTree,
        viewport,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`Snapshot failed: ${error}`);
    }
  }

  /**
   * Execute JavaScript in the page context
   * 
   * SECURITY: This method executes JavaScript in the browser page context ONLY.
   * Node.js globals (process, require, __dirname, etc.) are NOT accessible.
   * The code runs in the browser's JavaScript environment, not in Node.js.
   * 
   * @param script JavaScript code to execute
   * @returns Result of the script execution
   */
  async evaluate(script: string): Promise<any> {
    this.ensureInitialized();

    try {
      // Playwright's page.evaluate() executes in page context, not Node.js context
      // This ensures proper isolation and security
      return await this.page!.evaluate(script);
    } catch (error) {
      throw new Error(`Script evaluation failed: ${error}`);
    }
  }

  /**
   * Execute JavaScript and return a handle to the result
   * 
   * SECURITY: This method executes JavaScript in the browser page context ONLY.
   * Node.js globals (process, require, __dirname, etc.) are NOT accessible.
   * The code runs in the browser's JavaScript environment, not in Node.js.
   * 
   * @param script JavaScript code to execute
   * @returns Handle to the result object
   */
  async evaluateHandle(script: string): Promise<any> {
    this.ensureInitialized();

    try {
      // Playwright's page.evaluateHandle() executes in page context, not Node.js context
      // This ensures proper isolation and security
      return await this.page!.evaluateHandle(script);
    } catch (error) {
      throw new Error(`Script evaluation handle failed: ${error}`);
    }
  }

  /**
   * Wait for a selector to appear on the page
   * @param selector CSS selector or XPath for the element
   * @param options Wait options
   */
  async waitForSelector(selector: string, options?: WaitOptions): Promise<void> {
    this.ensureInitialized();

    try {
      await this.page!.waitForSelector(selector, {
        state: options?.state,
        timeout: options?.timeout,
      });
    } catch (error) {
      throw new Error(`Wait for selector "${selector}" failed: ${error}`);
    }
  }

  /**
   * Wait for navigation to complete
   * @param options Wait options
   */
  async waitForNavigation(options?: WaitOptions): Promise<void> {
    this.ensureInitialized();

    try {
      await this.page!.waitForLoadState('load', {
        timeout: options?.timeout,
      });
    } catch (error) {
      throw new Error(`Wait for navigation failed: ${error}`);
    }
  }

  /**
   * Wait for a specific load state
   * @param state Load state to wait for
   */
  async waitForLoadState(state: LoadState): Promise<void> {
    this.ensureInitialized();

    try {
      await this.page!.waitForLoadState(state);
    } catch (error) {
      throw new Error(`Wait for load state "${state}" failed: ${error}`);
    }
  }

  /**
   * Scroll to a specific position or element
   * @param target Scroll target type
   * @param options Scroll options based on target type
   */
  async scroll(target: 'element' | 'coordinates' | 'top' | 'bottom', options?: { selector?: string; x?: number; y?: number }): Promise<void> {
    this.ensureInitialized();

    try {
      switch (target) {
        case 'element':
          if (!options?.selector) {
            throw new Error('Selector is required for element scroll target');
          }
          await this.page!.locator(options.selector).scrollIntoViewIfNeeded();
          break;

        case 'coordinates':
          if (options?.x === undefined || options?.y === undefined) {
            throw new Error('x and y coordinates are required for coordinates scroll target');
          }
          await this.page!.evaluate(({ x, y }) => {
            window.scrollTo(x, y);
          }, { x: options.x, y: options.y });
          break;

        case 'top':
          await this.page!.evaluate(() => {
            window.scrollTo(0, 0);
          });
          break;

        case 'bottom':
          await this.page!.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          break;

        default:
          throw new Error(`Unknown scroll target: ${target}`);
      }
    } catch (error) {
      throw new Error(`Scroll to ${target} failed: ${error}`);
    }
  }


  /**
   * Get all cookies
   * @returns Array of cookies
   */
  async getCookies(): Promise<Cookie[]> {
    this.ensureInitialized();

    try {
      const cookies = await this.context!.cookies();
      return cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires || -1,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None',
      }));
    } catch (error) {
      throw new Error(`Get cookies failed: ${error}`);
    }
  }

  /**
   * Set cookies
   * @param cookies Array of cookies to set
   */
  async setCookies(cookies: Cookie[]): Promise<void> {
    this.ensureInitialized();

    try {
      await this.context!.addCookies(cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      })));
    } catch (error) {
      throw new Error(`Set cookies failed: ${error}`);
    }
  }

  /**
   * Get localStorage items for the current origin
   * @returns Object with key-value pairs from localStorage
   */
  async getLocalStorage(): Promise<Record<string, string>> {
    this.ensureInitialized();

    try {
      return await this.page!.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            items[key] = localStorage.getItem(key) || '';
          }
        }
        return items;
      });
    } catch (error) {
      throw new Error(`Get localStorage failed: ${error}`);
    }
  }

  /**
   * Set localStorage items for the current origin
   * @param items Object with key-value pairs to set in localStorage
   */
  async setLocalStorage(items: Record<string, string>): Promise<void> {
    this.ensureInitialized();

    try {
      await this.page!.evaluate((items) => {
        for (const [key, value] of Object.entries(items)) {
          localStorage.setItem(key, value);
        }
      }, items);
    } catch (error) {
      throw new Error(`Set localStorage failed: ${error}`);
    }
  }

  /**
   * Get the current page instance (for advanced usage)
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Get the browser context instance (for advanced usage)
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Get the browser instance (for advanced usage)
   */
  getBrowser(): PlaywrightBrowser | null {
    return this.browser;
  }

  /**
   * Check if the adapter is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure the adapter is initialized, throw error if not
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.page) {
      throw new Error('PlaywrightAdapter is not initialized. Call initialize() first.');
    }
  }

  /**
   * Convert Playwright accessibility tree to our format
   */
  private convertAccessibilityTree(node: any): AccessibilityNode[] {
    if (!node) {
      return [];
    }

    const result: AccessibilityNode = {
      role: node.role || 'unknown',
      name: node.name || '',
      value: node.value,
      children: node.children ? node.children.map((child: any) => this.convertAccessibilityTree(child)[0]) : undefined,
    };

    return [result];
  }

  /**
   * Clean up internal state
   */
  private cleanup(): void {
    this.initialized = false;
    this.page = null;
    this.context = null;
    this.browser = null;
    this.cdpEndpoint = null;
  }
}
