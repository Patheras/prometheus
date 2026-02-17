/**
 * Integration tests for PlaywrightAdapter
 * 
 * These tests require a running Chrome instance with CDP enabled.
 * They demonstrate the full functionality of the adapter with a real browser.
 * 
 * To run these tests:
 * 1. Start Chrome with remote debugging: chrome --remote-debugging-port=9222
 * 2. Run: npm test -- playwright-adapter-integration.test.ts
 * 
 * Note: These tests are skipped by default. Set INTEGRATION_TESTS=true to run them.
 */

import { PlaywrightAdapter } from '../../playwright-adapter.js';
import { chromium } from 'playwright';

const INTEGRATION_TESTS_ENABLED = process.env.INTEGRATION_TESTS === 'true';
const describeIntegration = INTEGRATION_TESTS_ENABLED ? describe : describe.skip;

describeIntegration('PlaywrightAdapter Integration', () => {
  let adapter: PlaywrightAdapter;
  let cdpEndpoint: string;

  beforeAll(async () => {
    // For integration tests, we would need a real CDP endpoint
    // This would typically come from chrome-launcher or a running Chrome instance
    // For now, we skip these tests unless explicitly enabled
    cdpEndpoint = process.env.CDP_ENDPOINT || 'ws://localhost:9222/devtools/browser';
  });

  beforeEach(() => {
    adapter = new PlaywrightAdapter();
  });

  afterEach(async () => {
    if (adapter.isInitialized()) {
      await adapter.close();
    }
  });

  describe('Initialization and Connection', () => {
    it('should successfully connect to a browser via CDP', async () => {
      await adapter.initialize(cdpEndpoint);
      expect(adapter.isInitialized()).toBe(true);
      expect(adapter.getPage()).not.toBeNull();
      expect(adapter.getContext()).not.toBeNull();
      expect(adapter.getBrowser()).not.toBeNull();
    });

    it('should clean up properly after close', async () => {
      await adapter.initialize(cdpEndpoint);
      await adapter.close();
      expect(adapter.isInitialized()).toBe(false);
      expect(adapter.getPage()).toBeNull();
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      await adapter.initialize(cdpEndpoint);
    });

    it('should navigate to a URL and return result', async () => {
      const result = await adapter.navigate('https://example.com');
      expect(result.url).toContain('example.com');
      expect(result.status).toBe(200);
      expect(result.title).toBeTruthy();
      expect(result.loadTime).toBeGreaterThan(0);
    });

    it('should wait for networkidle when specified', async () => {
      const result = await adapter.navigate('https://example.com', {
        waitUntil: 'networkidle',
      });
      expect(result.status).toBe(200);
    });

    it('should support browser history navigation', async () => {
      await adapter.navigate('https://example.com');
      await adapter.navigate('https://www.iana.org');
      await adapter.goBack();
      const page = adapter.getPage();
      expect(page?.url()).toContain('example.com');
    });
  });

  describe('Interaction Actions', () => {
    beforeEach(async () => {
      await adapter.initialize(cdpEndpoint);
    });

    describe('Click', () => {
      it('should click an element with default options', async () => {
        // Create a test page with a clickable button
        await adapter.navigate('data:text/html,<button id="test-btn">Click Me</button><div id="result"></div><script>document.getElementById("test-btn").onclick = () => document.getElementById("result").textContent = "clicked";</script>');
        await adapter.click('#test-btn');
        const result = await adapter.evaluate('document.getElementById("result").textContent');
        expect(result).toBe('clicked');
      });

      it('should support left button click', async () => {
        await adapter.navigate('data:text/html,<button id="test-btn">Click Me</button><div id="result"></div><script>document.getElementById("test-btn").onclick = () => document.getElementById("result").textContent = "clicked";</script>');
        await adapter.click('#test-btn', { button: 'left' });
        const result = await adapter.evaluate('document.getElementById("result").textContent');
        expect(result).toBe('clicked');
      });

      it('should support right button click', async () => {
        await adapter.navigate('data:text/html,<button id="test-btn">Click Me</button><div id="result"></div><script>document.getElementById("test-btn").oncontextmenu = (e) => { e.preventDefault(); document.getElementById("result").textContent = "right-clicked"; };</script>');
        await adapter.click('#test-btn', { button: 'right' });
        const result = await adapter.evaluate('document.getElementById("result").textContent');
        expect(result).toBe('right-clicked');
      });

      it('should support double click', async () => {
        await adapter.navigate('data:text/html,<button id="test-btn">Click Me</button><div id="result"></div><script>document.getElementById("test-btn").ondblclick = () => document.getElementById("result").textContent = "double-clicked";</script>');
        await adapter.click('#test-btn', { clickCount: 2 });
        const result = await adapter.evaluate('document.getElementById("result").textContent');
        expect(result).toBe('double-clicked');
      });

      it('should support click with delay', async () => {
        await adapter.navigate('data:text/html,<button id="test-btn">Click Me</button><div id="result"></div><script>document.getElementById("test-btn").onclick = () => document.getElementById("result").textContent = "clicked";</script>');
        const startTime = Date.now();
        await adapter.click('#test-btn', { delay: 100 });
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(100);
        const result = await adapter.evaluate('document.getElementById("result").textContent');
        expect(result).toBe('clicked');
      });

      it('should timeout when element not found', async () => {
        await adapter.navigate('data:text/html,<div>No button here</div>');
        await expect(
          adapter.click('#non-existent', { timeout: 1000 })
        ).rejects.toThrow();
      });
    });

    describe('Type', () => {
      it('should type text into an input', async () => {
        await adapter.navigate('data:text/html,<input id="test-input" type="text">');
        await adapter.type('#test-input', 'Hello World');
        const value = await adapter.evaluate('document.getElementById("test-input").value');
        expect(value).toBe('Hello World');
      });

      it('should type with delay between keystrokes', async () => {
        await adapter.navigate('data:text/html,<input id="test-input" type="text">');
        const startTime = Date.now();
        await adapter.type('#test-input', 'ABC', { delay: 50 });
        const elapsed = Date.now() - startTime;
        // Should take at least 150ms (3 chars * 50ms delay)
        expect(elapsed).toBeGreaterThanOrEqual(150);
        const value = await adapter.evaluate('document.getElementById("test-input").value');
        expect(value).toBe('ABC');
      });

      it('should timeout when input not found', async () => {
        await adapter.navigate('data:text/html,<div>No input here</div>');
        await expect(
          adapter.type('#non-existent', 'text', { timeout: 1000 })
        ).rejects.toThrow();
      });
    });

    describe('Fill', () => {
      it('should fill an input with a value', async () => {
        await adapter.navigate('data:text/html,<input id="test-input" type="text">');
        await adapter.fill('#test-input', 'Filled Value');
        const value = await adapter.evaluate('document.getElementById("test-input").value');
        expect(value).toBe('Filled Value');
      });

      it('should replace existing value', async () => {
        await adapter.navigate('data:text/html,<input id="test-input" type="text" value="old">');
        await adapter.fill('#test-input', 'new');
        const value = await adapter.evaluate('document.getElementById("test-input").value');
        expect(value).toBe('new');
      });

      it('should throw error for non-existent element', async () => {
        await adapter.navigate('data:text/html,<div>No input here</div>');
        await expect(adapter.fill('#non-existent', 'value')).rejects.toThrow();
      });
    });

    describe('Hover', () => {
      it('should hover over an element', async () => {
        await adapter.navigate('data:text/html,<button id="test-btn">Hover Me</button><div id="result"></div><script>document.getElementById("test-btn").onmouseenter = () => document.getElementById("result").textContent = "hovered";</script>');
        await adapter.hover('#test-btn');
        const result = await adapter.evaluate('document.getElementById("result").textContent');
        expect(result).toBe('hovered');
      });

      it('should throw error for non-existent element', async () => {
        await adapter.navigate('data:text/html,<div>No button here</div>');
        await expect(adapter.hover('#non-existent')).rejects.toThrow();
      });
    });

    describe('Select', () => {
      it('should select a single option', async () => {
        await adapter.navigate('data:text/html,<select id="test-select"><option value="1">One</option><option value="2">Two</option><option value="3">Three</option></select>');
        await adapter.select('#test-select', ['2']);
        const value = await adapter.evaluate('document.getElementById("test-select").value');
        expect(value).toBe('2');
      });

      it('should select multiple options', async () => {
        await adapter.navigate('data:text/html,<select id="test-select" multiple><option value="1">One</option><option value="2">Two</option><option value="3">Three</option></select>');
        await adapter.select('#test-select', ['1', '3']);
        const values = await adapter.evaluate('Array.from(document.getElementById("test-select").selectedOptions).map(o => o.value)');
        expect(values).toEqual(['1', '3']);
      });

      it('should throw error for non-existent select', async () => {
        await adapter.navigate('data:text/html,<div>No select here</div>');
        await expect(adapter.select('#non-existent', ['value'])).rejects.toThrow();
      });
    });
  });

  describe('Capture Actions', () => {
    beforeEach(async () => {
      await adapter.initialize(cdpEndpoint);
      await adapter.navigate('https://example.com');
    });

    it('should take a screenshot', async () => {
      const screenshot = await adapter.screenshot();
      expect(screenshot).toBeInstanceOf(Buffer);
      expect(screenshot.length).toBeGreaterThan(0);
    });

    it('should take a full-page screenshot', async () => {
      const screenshot = await adapter.screenshot({ fullPage: true });
      expect(screenshot).toBeInstanceOf(Buffer);
      expect(screenshot.length).toBeGreaterThan(0);
    });

    it('should capture a page snapshot', async () => {
      const snapshot = await adapter.snapshot();
      expect(snapshot.url).toContain('example.com');
      expect(snapshot.title).toBeTruthy();
      expect(snapshot.html).toContain('Example Domain');
      expect(snapshot.accessibilityTree).toBeDefined();
      expect(snapshot.viewport).toHaveProperty('width');
      expect(snapshot.viewport).toHaveProperty('height');
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it('should execute JavaScript in page context', async () => {
      const result = await adapter.evaluate('document.title');
      expect(result).toBeTruthy();
    });

    it('should get and set localStorage', async () => {
      await adapter.setLocalStorage({ testKey: 'testValue' });
      const storage = await adapter.getLocalStorage();
      expect(storage.testKey).toBe('testValue');
    });
  });

  describe('JavaScript Evaluation and Context Isolation', () => {
    beforeEach(async () => {
      await adapter.initialize(cdpEndpoint);
      await adapter.navigate('data:text/html,<html><head><title>Test Page</title></head><body><h1>Test</h1></body></html>');
    });

    describe('evaluate() method', () => {
      it('should execute simple JavaScript expressions', async () => {
        const result = await adapter.evaluate('1 + 1');
        expect(result).toBe(2);
      });

      it('should execute JavaScript with string return', async () => {
        const result = await adapter.evaluate('document.title');
        expect(result).toBe('Test Page');
      });

      it('should execute JavaScript with object return', async () => {
        const result = await adapter.evaluate('({ foo: "bar", num: 42 })');
        expect(result).toEqual({ foo: 'bar', num: 42 });
      });

      it('should execute JavaScript with array return', async () => {
        const result = await adapter.evaluate('[1, 2, 3, 4, 5]');
        expect(result).toEqual([1, 2, 3, 4, 5]);
      });

      it('should execute JavaScript that accesses DOM', async () => {
        const result = await adapter.evaluate('document.querySelector("h1").textContent');
        expect(result).toBe('Test');
      });

      it('should execute JavaScript that modifies DOM', async () => {
        await adapter.evaluate('document.querySelector("h1").textContent = "Modified"');
        const result = await adapter.evaluate('document.querySelector("h1").textContent');
        expect(result).toBe('Modified');
      });
    });

    describe('evaluateHandle() method', () => {
      it('should return handle to browser object', async () => {
        const handle = await adapter.evaluateHandle('document');
        expect(handle).toBeDefined();
        expect(handle).not.toBeNull();
      });

      it('should return handle to DOM element', async () => {
        const handle = await adapter.evaluateHandle('document.querySelector("h1")');
        expect(handle).toBeDefined();
        expect(handle).not.toBeNull();
      });

      it('should return handle to window object', async () => {
        const handle = await adapter.evaluateHandle('window');
        expect(handle).toBeDefined();
        expect(handle).not.toBeNull();
      });
    });

    describe('Context Isolation - Requirement 9.7', () => {
      it('should have access to browser globals (window)', async () => {
        const result = await adapter.evaluate('typeof window');
        expect(result).toBe('object');
      });

      it('should have access to browser globals (document)', async () => {
        const result = await adapter.evaluate('typeof document');
        expect(result).toBe('object');
      });

      it('should have access to browser globals (navigator)', async () => {
        const result = await adapter.evaluate('typeof navigator');
        expect(result).toBe('object');
      });

      it('should have access to browser globals (location)', async () => {
        const result = await adapter.evaluate('typeof location');
        expect(result).toBe('object');
      });

      it('should have access to browser globals (console)', async () => {
        const result = await adapter.evaluate('typeof console');
        expect(result).toBe('object');
      });

      it('should NOT have access to Node.js global (process)', async () => {
        const result = await adapter.evaluate('typeof process');
        expect(result).toBe('undefined');
      });

      it('should NOT have access to Node.js global (require)', async () => {
        const result = await adapter.evaluate('typeof require');
        expect(result).toBe('undefined');
      });

      it('should NOT have access to Node.js global (__dirname)', async () => {
        const result = await adapter.evaluate('typeof __dirname');
        expect(result).toBe('undefined');
      });

      it('should NOT have access to Node.js global (__filename)', async () => {
        const result = await adapter.evaluate('typeof __filename');
        expect(result).toBe('undefined');
      });

      it('should NOT have access to Node.js global (module)', async () => {
        const result = await adapter.evaluate('typeof module');
        expect(result).toBe('undefined');
      });

      it('should NOT have access to Node.js global (exports)', async () => {
        const result = await adapter.evaluate('typeof exports');
        expect(result).toBe('undefined');
      });

      it('should NOT have access to Node.js global (Buffer)', async () => {
        const result = await adapter.evaluate('typeof Buffer');
        expect(result).toBe('undefined');
      });

      it('should NOT have access to Node.js global (global)', async () => {
        const result = await adapter.evaluate('typeof global');
        expect(result).toBe('undefined');
      });

      it('should throw error when trying to access Node.js process', async () => {
        try {
          await adapter.evaluate('process.version');
          fail('Should have thrown ReferenceError');
        } catch (error: any) {
          expect(error.message).toContain('Script evaluation failed');
        }
      });

      it('should throw error when trying to use require', async () => {
        try {
          await adapter.evaluate('require("fs")');
          fail('Should have thrown ReferenceError');
        } catch (error: any) {
          expect(error.message).toContain('Script evaluation failed');
        }
      });

      it('should execute in isolated context (no cross-contamination)', async () => {
        // Set a variable in one evaluation
        await adapter.evaluate('window.testVar = "isolated"');
        
        // Verify it persists in the same page context
        const result = await adapter.evaluate('window.testVar');
        expect(result).toBe('isolated');
        
        // But it should not affect Node.js context
        // (This is implicit - Node.js context is completely separate)
      });

      it('should not allow file system access via Node.js', async () => {
        try {
          await adapter.evaluate('require("fs").readFileSync("/etc/passwd")');
          fail('Should have thrown error - no access to Node.js fs module');
        } catch (error: any) {
          expect(error.message).toContain('Script evaluation failed');
        }
      });

      it('should not allow child process execution via Node.js', async () => {
        try {
          await adapter.evaluate('require("child_process").execSync("ls")');
          fail('Should have thrown error - no access to Node.js child_process module');
        } catch (error: any) {
          expect(error.message).toContain('Script evaluation failed');
        }
      });

      it('should execute in browser V8 engine, not Node.js runtime', async () => {
        // Browser context has different global object structure
        const hasWindow = await adapter.evaluate('typeof window !== "undefined"');
        const hasDocument = await adapter.evaluate('typeof document !== "undefined"');
        const hasProcess = await adapter.evaluate('typeof process !== "undefined"');
        
        expect(hasWindow).toBe(true);
        expect(hasDocument).toBe(true);
        expect(hasProcess).toBe(false);
      });
    });

    describe('Error Handling', () => {
      it('should handle syntax errors in evaluated script', async () => {
        try {
          await adapter.evaluate('this is not valid javascript!!!');
          fail('Should have thrown error');
        } catch (error: any) {
          expect(error.message).toContain('Script evaluation failed');
        }
      });

      it('should handle runtime errors in evaluated script', async () => {
        try {
          await adapter.evaluate('throw new Error("Test error")');
          fail('Should have thrown error');
        } catch (error: any) {
          expect(error.message).toContain('Script evaluation failed');
        }
      });

      it('should handle reference errors in evaluated script', async () => {
        try {
          await adapter.evaluate('nonExistentVariable.property');
          fail('Should have thrown error');
        } catch (error: any) {
          expect(error.message).toContain('Script evaluation failed');
        }
      });

      it('should handle errors in evaluateHandle', async () => {
        try {
          await adapter.evaluateHandle('throw new Error("Handle error")');
          fail('Should have thrown error');
        } catch (error: any) {
          expect(error.message).toContain('Script evaluation handle failed');
        }
      });
    });
  });

  describe('Cookies', () => {
    beforeEach(async () => {
      await adapter.initialize(cdpEndpoint);
      await adapter.navigate('https://example.com');
    });

    it('should get cookies', async () => {
      const cookies = await adapter.getCookies();
      expect(Array.isArray(cookies)).toBe(true);
    });

    it('should set and retrieve cookies', async () => {
      const testCookie = {
        name: 'test_cookie',
        value: 'test_value',
        domain: 'example.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      };

      await adapter.setCookies([testCookie]);
      const cookies = await adapter.getCookies();
      const foundCookie = cookies.find(c => c.name === 'test_cookie');
      expect(foundCookie).toBeDefined();
      expect(foundCookie?.value).toBe('test_value');
    });
  });

  describe('Wait Operations', () => {
    beforeEach(async () => {
      await adapter.initialize(cdpEndpoint);
      await adapter.navigate('https://example.com');
    });

    it('should wait for load state', async () => {
      await expect(adapter.waitForLoadState('load')).resolves.not.toThrow();
    });

    it('should wait for selector', async () => {
      await expect(adapter.waitForSelector('h1')).resolves.not.toThrow();
    });
  });

  describe('Scroll Operations', () => {
    beforeEach(async () => {
      await adapter.initialize(cdpEndpoint);
      // Create a page with scrollable content
      await adapter.navigate('data:text/html,<div style="height: 3000px;"><div id="top" style="height: 100px;">Top</div><div id="middle" style="margin-top: 1000px; height: 100px;">Middle</div><div id="bottom" style="margin-top: 1000px; height: 100px;">Bottom</div></div>');
    });

    it('should scroll to top', async () => {
      // First scroll down
      await adapter.scroll('coordinates', { x: 0, y: 500 });
      // Then scroll to top
      await adapter.scroll('top');
      const scrollY = await adapter.evaluate('window.scrollY');
      expect(scrollY).toBe(0);
    });

    it('should scroll to bottom', async () => {
      await adapter.scroll('bottom');
      const scrollY = await adapter.evaluate('window.scrollY');
      expect(scrollY).toBeGreaterThan(0);
    });

    it('should scroll to specific coordinates', async () => {
      await adapter.scroll('coordinates', { x: 0, y: 500 });
      const scrollY = await adapter.evaluate('window.scrollY');
      expect(scrollY).toBeGreaterThanOrEqual(490); // Allow 10px tolerance
      expect(scrollY).toBeLessThanOrEqual(510);
    });

    it('should scroll element into view', async () => {
      await adapter.scroll('element', { selector: '#middle' });
      const isVisible = await adapter.evaluate(() => {
        const element = document.getElementById('middle');
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      });
      expect(isVisible).toBe(true);
    });

    it('should scroll to coordinates with x and y', async () => {
      await adapter.scroll('coordinates', { x: 0, y: 1000 });
      const scrollY = await adapter.evaluate('window.scrollY');
      expect(scrollY).toBeGreaterThanOrEqual(990);
      expect(scrollY).toBeLessThanOrEqual(1010);
    });

    it('should scroll to zero coordinates', async () => {
      // First scroll down
      await adapter.scroll('coordinates', { x: 0, y: 500 });
      // Then scroll to zero
      await adapter.scroll('coordinates', { x: 0, y: 0 });
      const scrollY = await adapter.evaluate('window.scrollY');
      expect(scrollY).toBe(0);
    });

    it('should throw error when scrolling to element without selector', async () => {
      await expect(adapter.scroll('element', {})).rejects.toThrow(
        'Selector is required for element scroll target'
      );
    });

    it('should throw error when scrolling to coordinates without x', async () => {
      await expect(adapter.scroll('coordinates', { y: 100 } as any)).rejects.toThrow(
        'x and y coordinates are required for coordinates scroll target'
      );
    });

    it('should throw error when scrolling to coordinates without y', async () => {
      await expect(adapter.scroll('coordinates', { x: 100 } as any)).rejects.toThrow(
        'x and y coordinates are required for coordinates scroll target'
      );
    });

    it('should throw error when scrolling to non-existent element', async () => {
      await expect(adapter.scroll('element', { selector: '#non-existent' })).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await adapter.initialize(cdpEndpoint);
      await adapter.navigate('https://example.com');
    });

    it('should throw error for invalid selector', async () => {
      await expect(adapter.click('invalid>>selector')).rejects.toThrow();
    });

    it('should throw error for navigation to invalid URL', async () => {
      await expect(adapter.navigate('not-a-valid-url')).rejects.toThrow();
    });

    it('should throw error when waiting for non-existent selector with timeout', async () => {
      await expect(
        adapter.waitForSelector('non-existent-element', { timeout: 1000 })
      ).rejects.toThrow();
    });
  });
});
