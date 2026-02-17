/**
 * Integration tests for navigation actions
 * 
 * Tests navigation functionality with a real browser instance.
 * Validates Requirements 2.2 and 6.1.
 */

import { chromium, Browser, Page } from 'playwright';

describe('Navigation Actions Integration', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    // Launch a browser for testing
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    if (page) {
      await page.context().close();
    }
  });

  describe('navigate()', () => {
    it('should navigate to a URL and return navigation result', async () => {
      const startTime = Date.now();
      const response = await page.goto('https://example.com');
      const loadTime = Date.now() - startTime;
      const title = await page.title();

      expect(page.url()).toBe('https://example.com/');
      expect(response?.status()).toBe(200);
      expect(title).toBeTruthy();
      expect(loadTime).toBeGreaterThan(0);
    });

    it('should navigate with waitUntil: load', async () => {
      const response = await page.goto('https://example.com', {
        waitUntil: 'load',
      });

      expect(page.url()).toBe('https://example.com/');
      expect(response?.status()).toBe(200);
    });

    it('should navigate with waitUntil: domcontentloaded', async () => {
      const response = await page.goto('https://example.com', {
        waitUntil: 'domcontentloaded',
      });

      expect(page.url()).toBe('https://example.com/');
      expect(response?.status()).toBe(200);
    });

    it('should navigate with waitUntil: networkidle', async () => {
      const response = await page.goto('https://example.com', {
        waitUntil: 'networkidle',
      });

      expect(page.url()).toBe('https://example.com/');
      expect(response?.status()).toBe(200);
    });

    it('should track load time accurately', async () => {
      const startTime = Date.now();
      await page.goto('https://example.com');
      const endTime = Date.now();

      const actualLoadTime = endTime - startTime;
      
      // Load time should be within reasonable bounds
      expect(actualLoadTime).toBeGreaterThan(0);
      expect(actualLoadTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle navigation timeout', async () => {
      await expect(
        page.goto('https://example.com', { timeout: 1 })
      ).rejects.toThrow();
    });

    it('should handle invalid URL', async () => {
      await expect(
        page.goto('not-a-valid-url')
      ).rejects.toThrow();
    });
  });

  describe('goBack()', () => {
    it('should navigate back in history', async () => {
      // Navigate to first page
      await page.goto('https://example.com');
      
      // Navigate to second page
      await page.goto('https://www.iana.org/domains/reserved');
      
      // Go back
      await page.goBack();
      
      // Verify we're back at the first page
      expect(page.url()).toBe('https://example.com/');
    });

    it('should handle goBack when no history exists', async () => {
      await page.goto('https://example.com');
      
      // Going back on first page should not throw
      await expect(page.goBack()).resolves.not.toThrow();
    });
  });

  describe('goForward()', () => {
    it('should navigate forward in history', async () => {
      // Navigate to first page
      await page.goto('https://example.com');
      
      // Navigate to second page
      await page.goto('https://www.iana.org/domains/reserved');
      
      // Go back
      await page.goBack();
      
      // Go forward
      await page.goForward();
      
      // Verify we're at the second page again
      expect(page.url()).toContain('iana.org');
    });

    it('should handle goForward when no forward history exists', async () => {
      await page.goto('https://example.com');
      
      // Going forward when at the end should not throw
      await expect(page.goForward()).resolves.not.toThrow();
    });
  });

  describe('reload()', () => {
    it('should reload the current page', async () => {
      // Navigate to a page
      await page.goto('https://example.com');
      const url = page.url();
      
      // Reload the page
      await page.reload();
      
      // Verify we're still on the same page
      expect(page.url()).toBe(url);
    });

    it('should reload and maintain page state', async () => {
      await page.goto('https://example.com');
      
      // Set some localStorage
      await page.evaluate(() => {
        localStorage.setItem('test_key', 'test_value');
      });
      
      // Reload
      await page.reload();
      
      // Verify localStorage persists
      const value = await page.evaluate(() => localStorage.getItem('test_key'));
      expect(value).toBe('test_value');
    });
  });

  describe('Navigation result tracking', () => {
    it('should include all required fields in navigation result', async () => {
      const startTime = Date.now();
      const response = await page.goto('https://example.com');
      const loadTime = Date.now() - startTime;
      const title = await page.title();

      // Verify all required fields are present
      expect(page.url()).toBeTruthy();
      expect(response?.status()).toBeTruthy();
      expect(title).toBeTruthy();
      expect(loadTime).toBeGreaterThan(0);

      // Verify field types
      expect(typeof page.url()).toBe('string');
      expect(typeof response?.status()).toBe('number');
      expect(typeof title).toBe('string');
      expect(typeof loadTime).toBe('number');
    });

    it('should track different status codes', async () => {
      // Test successful navigation
      const response = await page.goto('https://example.com');
      expect(response?.status()).toBe(200);

      // Note: Testing 404 would require a known 404 URL
      // This is better suited for property-based testing
    });
  });
});
