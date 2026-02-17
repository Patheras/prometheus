/**
 * Tool Adapter Demo
 * 
 * Demonstrates how to create and use a browser tool adapter.
 */

import { BrowserManager } from '../browser-manager.js';
import { ProfileManager } from '../profile-manager.js';
import { BrowserToolAdapter, ToolSchema } from '../tool-adapters/browser-tool-adapter.js';
import { BrowserAction, NavigateAction } from '../types/index.js';

/**
 * Example: Browser Navigate Tool Adapter
 * 
 * This adapter exposes the navigate action as a function calling tool.
 */
class BrowserNavigateToolAdapter extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    const schema: ToolSchema = {
      name: 'browser_navigate',
      description: 'Navigate the browser to a specified URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to (must include protocol: http:// or https://)',
          },
          waitUntil: {
            type: 'string',
            description: 'When to consider navigation complete',
            enum: ['load', 'domcontentloaded', 'networkidle'],
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait in milliseconds (default: 30000)',
          },
        },
        required: ['url'],
      },
    };

    super(browserManager, schema);
  }

  protected convertToAction(params: Record<string, any>): BrowserAction {
    return {
      type: 'navigate',
      url: params.url,
      waitUntil: params.waitUntil,
      timeout: params.timeout,
    } as NavigateAction;
  }
}

/**
 * Demo function
 */
async function demo() {
  console.log('=== Browser Tool Adapter Demo ===\n');

  // Initialize profile manager and browser manager
  const profileManager = new ProfileManager();
  const browserManager = new BrowserManager(profileManager);

  try {
    // Start the browser manager
    console.log('Starting browser manager...');
    await browserManager.start();

    // Launch a browser with the default profile
    const defaultProfile = profileManager.getDefaultProfile();
    console.log(`Launching browser with profile: ${defaultProfile.name}`);
    await browserManager.launchBrowser(defaultProfile);

    // Create a tool adapter
    const navigateTool = new BrowserNavigateToolAdapter(browserManager);

    console.log('\n--- Tool Schema ---');
    console.log(JSON.stringify(navigateTool.getSchema(), null, 2));

    // Example 1: Successful navigation
    console.log('\n--- Example 1: Navigate to example.com ---');
    const result1 = await navigateTool.execute({
      url: 'https://example.com',
      waitUntil: 'load',
      timeout: 30000,
    });

    if (result1.success) {
      console.log('✓ Navigation successful!');
      console.log('Result:', JSON.stringify(result1.data, null, 2));
    } else {
      console.log('✗ Navigation failed!');
      console.log('Error:', result1.error);
    }

    // Example 2: Validation error (missing required parameter)
    console.log('\n--- Example 2: Missing required parameter ---');
    const result2 = await navigateTool.execute({
      waitUntil: 'load',
    });

    if (result2.success) {
      console.log('✓ Unexpected success');
    } else {
      console.log('✗ Validation error (expected):');
      console.log('Error:', result2.error?.message);
      console.log('Details:', result2.error?.details);
    }

    // Example 3: Invalid parameter type
    console.log('\n--- Example 3: Invalid parameter type ---');
    const result3 = await navigateTool.execute({
      url: 12345, // Should be string
    });

    if (result3.success) {
      console.log('✓ Unexpected success');
    } else {
      console.log('✗ Validation error (expected):');
      console.log('Error:', result3.error?.message);
      console.log('Details:', result3.error?.details);
    }

    // Example 4: Invalid enum value
    console.log('\n--- Example 4: Invalid enum value ---');
    const result4 = await navigateTool.execute({
      url: 'https://example.com',
      waitUntil: 'invalid-value',
    });

    if (result4.success) {
      console.log('✓ Unexpected success');
    } else {
      console.log('✗ Validation error (expected):');
      console.log('Error:', result4.error?.message);
      console.log('Details:', result4.error?.details);
    }

    // Example 5: Invalid URL format
    console.log('\n--- Example 5: Invalid URL format ---');
    const result5 = await navigateTool.execute({
      url: 'not-a-valid-url',
    });

    if (result5.success) {
      console.log('✓ Unexpected success');
    } else {
      console.log('✗ Action validation error (expected):');
      console.log('Error:', result5.error?.message);
    }

  } catch (error) {
    console.error('Demo error:', error);
  } finally {
    // Clean up
    console.log('\n--- Cleanup ---');
    await browserManager.stop();
    console.log('Browser manager stopped');
  }
}

// Run the demo
demo().catch(console.error);
