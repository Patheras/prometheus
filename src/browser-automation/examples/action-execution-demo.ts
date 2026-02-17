/**
 * Action Execution Demo
 * 
 * Demonstrates the executeAction method with various action types,
 * validation, and error handling.
 */

import { BrowserManager } from '../browser-manager.js';
import { ProfileManager } from '../profile-manager.js';
import { NavigateAction, ClickAction, TypeAction, ScreenshotAction } from '../types/index.js';

async function demo() {
  console.log('=== Browser Manager Action Execution Demo ===\n');

  // Initialize managers
  const profileManager = new ProfileManager();
  const browserManager = new BrowserManager(profileManager);

  try {
    // Start the browser manager
    console.log('1. Starting browser manager...');
    await browserManager.start();
    console.log('   ✓ Browser manager started\n');

    // Launch a browser with the openclaw profile
    console.log('2. Launching browser with openclaw profile...');
    const profile = profileManager.getProfile('openclaw');
    if (!profile) {
      throw new Error('openclaw profile not found');
    }
    const browser = await browserManager.launchBrowser(profile);
    console.log(`   ✓ Browser launched with ID: ${browser.id}\n`);

    // Test 1: Navigate action
    console.log('3. Testing navigate action...');
    const navigateAction: NavigateAction = {
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    };
    const navigateResult = await browserManager.executeAction(navigateAction);
    console.log(`   ✓ Navigate result:`, {
      success: navigateResult.success,
      url: navigateResult.result?.url,
      status: navigateResult.result?.status,
      title: navigateResult.result?.title,
      executionTime: `${navigateResult.executionTime}ms`,
    });
    console.log();

    // Test 2: Screenshot action
    console.log('4. Testing screenshot action...');
    const screenshotAction: ScreenshotAction = {
      type: 'screenshot',
      fullPage: false,
      format: 'png',
    };
    const screenshotResult = await browserManager.executeAction(screenshotAction);
    console.log(`   ✓ Screenshot result:`, {
      success: screenshotResult.success,
      format: screenshotResult.result?.format,
      hasScreenshot: !!screenshotResult.result?.screenshot,
      screenshotLength: screenshotResult.result?.screenshot?.length,
      executionTime: `${screenshotResult.executionTime}ms`,
    });
    console.log();

    // Test 3: Execute JavaScript action
    console.log('5. Testing execute_js action...');
    const executeJsAction = {
      type: 'execute_js',
      script: 'document.title',
    } as any;
    const executeJsResult = await browserManager.executeAction(executeJsAction);
    console.log(`   ✓ Execute JS result:`, {
      success: executeJsResult.success,
      result: executeJsResult.result,
      executionTime: `${executeJsResult.executionTime}ms`,
    });
    console.log();

    // Test 4: Validation error - missing URL
    console.log('6. Testing validation error (missing URL)...');
    const invalidNavigateAction = {
      type: 'navigate',
      url: '',
    } as NavigateAction;
    const invalidResult = await browserManager.executeAction(invalidNavigateAction);
    console.log(`   ✓ Validation error result:`, {
      success: invalidResult.success,
      errorCode: invalidResult.error?.code,
      errorMessage: invalidResult.error?.message,
    });
    console.log();

    // Test 5: Validation error - invalid URL protocol
    console.log('7. Testing validation error (invalid URL protocol)...');
    const invalidProtocolAction: NavigateAction = {
      type: 'navigate',
      url: 'example.com',
    };
    const invalidProtocolResult = await browserManager.executeAction(invalidProtocolAction);
    console.log(`   ✓ Validation error result:`, {
      success: invalidProtocolResult.success,
      errorCode: invalidProtocolResult.error?.code,
      errorMessage: invalidProtocolResult.error?.message,
    });
    console.log();

    // Test 6: Element not found error
    console.log('8. Testing element not found error...');
    const clickAction: ClickAction = {
      type: 'click',
      selector: 'button#nonexistent-button',
      timeout: 1000,
    };
    const clickResult = await browserManager.executeAction(clickAction);
    console.log(`   ✓ Element not found result:`, {
      success: clickResult.success,
      errorCode: clickResult.error?.code,
      errorMessage: clickResult.error?.message?.substring(0, 100) + '...',
    });
    console.log();

    // Test 7: Snapshot action
    console.log('9. Testing snapshot action...');
    const snapshotAction = {
      type: 'snapshot',
    } as any;
    const snapshotResult = await browserManager.executeAction(snapshotAction);
    console.log(`   ✓ Snapshot result:`, {
      success: snapshotResult.success,
      url: snapshotResult.result?.url,
      title: snapshotResult.result?.title,
      hasHtml: !!snapshotResult.result?.html,
      htmlLength: snapshotResult.result?.html?.length,
      hasAccessibilityTree: !!snapshotResult.result?.accessibilityTree,
      executionTime: `${snapshotResult.executionTime}ms`,
    });
    console.log();

    console.log('=== Demo completed successfully! ===');

  } catch (error) {
    console.error('Error during demo:', error);
  } finally {
    // Clean up
    console.log('\n10. Cleaning up...');
    await browserManager.stop();
    console.log('   ✓ Browser manager stopped');
  }
}

// Run the demo
demo().catch(console.error);
