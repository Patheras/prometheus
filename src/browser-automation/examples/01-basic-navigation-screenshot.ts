/**
 * Example 1: Basic Navigation and Screenshot
 * 
 * This example demonstrates:
 * - Initializing the browser automation system
 * - Navigating to a URL
 * - Taking a screenshot
 * - Proper cleanup
 * 
 * Requirements: 2.2, 5.1, 5.4
 */

import { initializeBrowserAutomation, shutdownBrowserAutomation } from '../init.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function basicNavigationAndScreenshot() {
  console.log('=== Example 1: Basic Navigation and Screenshot ===\n');

  try {
    // Step 1: Initialize the browser automation system
    console.log('1. Initializing browser automation system...');
    const system = await initializeBrowserAutomation({
      browser: {
        headless: false, // Set to true for headless mode
        defaultTimeout: 30000,
      },
      logging: {
        level: 'info',
        logActions: true,
      },
    });
    console.log('   ✓ System initialized\n');

    // Step 2: Get the browser manager
    const browserManager = system.getBrowserManager();

    // Step 3: Navigate to a URL
    console.log('2. Navigating to https://example.com...');
    const navigateResult = await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle', // Wait for network to be idle
      timeout: 30000,
    });

    if (!navigateResult.success) {
      throw new Error(`Navigation failed: ${navigateResult.error?.message}`);
    }

    console.log('   ✓ Navigation successful');
    console.log(`   - URL: ${navigateResult.result.url}`);
    console.log(`   - Title: ${navigateResult.result.title}`);
    console.log(`   - Status: ${navigateResult.result.status}`);
    console.log(`   - Load time: ${navigateResult.result.loadTime}ms\n`);

    // Step 4: Take a screenshot
    console.log('3. Taking a screenshot...');
    const screenshotResult = await browserManager.executeAction({
      type: 'screenshot',
      fullPage: false, // Set to true to capture the entire page
      format: 'png',
    });

    if (!screenshotResult.success) {
      throw new Error(`Screenshot failed: ${screenshotResult.error?.message}`);
    }

    console.log('   ✓ Screenshot captured');
    console.log(`   - Format: ${screenshotResult.result.format}`);
    console.log(`   - Size: ${screenshotResult.result.screenshot.length} bytes\n`);

    // Step 5: Save the screenshot to a file
    const screenshotPath = join(process.cwd(), 'example-screenshot.png');
    const screenshotBuffer = Buffer.from(screenshotResult.result.screenshot, 'base64');
    writeFileSync(screenshotPath, screenshotBuffer);
    console.log(`4. Screenshot saved to: ${screenshotPath}\n`);

    // Step 6: Take a full-page screenshot
    console.log('5. Taking a full-page screenshot...');
    const fullPageResult = await browserManager.executeAction({
      type: 'screenshot',
      fullPage: true,
      format: 'png',
    });

    if (fullPageResult.success) {
      const fullPagePath = join(process.cwd(), 'example-fullpage-screenshot.png');
      const fullPageBuffer = Buffer.from(fullPageResult.result.screenshot, 'base64');
      writeFileSync(fullPagePath, fullPageBuffer);
      console.log(`   ✓ Full-page screenshot saved to: ${fullPagePath}\n`);
    }

    console.log('=== Example completed successfully! ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Step 7: Clean up - always shutdown the system
    console.log('\n6. Shutting down browser automation system...');
    await shutdownBrowserAutomation();
    console.log('   ✓ System shutdown complete');
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  basicNavigationAndScreenshot().catch(console.error);
}

export { basicNavigationAndScreenshot };
