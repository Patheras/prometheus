/**
 * PlaywrightAdapter Demo
 * 
 * This example demonstrates how to use the PlaywrightAdapter to control a browser.
 * 
 * Prerequisites:
 * 1. Install dependencies: npm install
 * 2. Start Chrome with remote debugging:
 *    chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
 * 
 * Run this demo:
 * tsx src/browser-automation/examples/playwright-adapter-demo.ts
 */

import { PlaywrightAdapter } from '../playwright-adapter.js';
import { chromium } from 'playwright';

async function demo() {
  console.log('PlaywrightAdapter Demo\n');

  // For this demo, we'll launch a browser ourselves and get its CDP endpoint
  console.log('1. Launching browser with CDP...');
  const browser = await chromium.launch({
    headless: false, // Show the browser window
    args: ['--remote-debugging-port=9222'],
  });

  // Get the CDP endpoint
  const cdpEndpoint = browser.wsEndpoint();
  console.log(`   CDP Endpoint: ${cdpEndpoint}\n`);

  // Create and initialize the adapter
  console.log('2. Initializing PlaywrightAdapter...');
  const adapter = new PlaywrightAdapter();
  await adapter.initialize(cdpEndpoint);
  console.log('   ✓ Adapter initialized\n');

  try {
    // Navigate to a website
    console.log('3. Navigating to example.com...');
    const navResult = await adapter.navigate('https://example.com', {
      waitUntil: 'networkidle',
    });
    console.log(`   ✓ Loaded: ${navResult.title}`);
    console.log(`   ✓ Status: ${navResult.status}`);
    console.log(`   ✓ Load time: ${navResult.loadTime}ms\n`);

    // Take a screenshot
    console.log('4. Taking screenshot...');
    const screenshot = await adapter.screenshot({ fullPage: true });
    console.log(`   ✓ Screenshot captured: ${screenshot.length} bytes\n`);

    // Capture page snapshot
    console.log('5. Capturing page snapshot...');
    const snapshot = await adapter.snapshot();
    console.log(`   ✓ URL: ${snapshot.url}`);
    console.log(`   ✓ Title: ${snapshot.title}`);
    console.log(`   ✓ HTML length: ${snapshot.html.length} characters`);
    console.log(`   ✓ Accessibility tree nodes: ${snapshot.accessibilityTree.length}\n`);

    // Execute JavaScript
    console.log('6. Executing JavaScript...');
    const pageTitle = await adapter.evaluate('document.title');
    console.log(`   ✓ Page title from JS: ${pageTitle}\n`);

    // Work with localStorage
    console.log('7. Testing localStorage...');
    await adapter.setLocalStorage({
      demo_key: 'demo_value',
      timestamp: new Date().toISOString(),
    });
    const storage = await adapter.getLocalStorage();
    console.log(`   ✓ localStorage items: ${Object.keys(storage).length}`);
    console.log(`   ✓ demo_key = ${storage.demo_key}\n`);

    // Work with cookies
    console.log('8. Testing cookies...');
    await adapter.setCookies([
      {
        name: 'demo_cookie',
        value: 'demo_value',
        domain: 'example.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
    const cookies = await adapter.getCookies();
    console.log(`   ✓ Total cookies: ${cookies.length}`);
    const demoCookie = cookies.find(c => c.name === 'demo_cookie');
    if (demoCookie) {
      console.log(`   ✓ demo_cookie = ${demoCookie.value}\n`);
    }

    // Wait for a selector
    console.log('9. Waiting for h1 element...');
    await adapter.waitForSelector('h1', { timeout: 5000 });
    console.log('   ✓ h1 element found\n');

    console.log('✓ Demo completed successfully!');
  } catch (error) {
    console.error('✗ Error during demo:', error);
  } finally {
    // Clean up
    console.log('\n10. Cleaning up...');
    await adapter.close();
    await browser.close();
    console.log('   ✓ Cleanup complete');
  }
}

// Run the demo
demo().catch(console.error);
