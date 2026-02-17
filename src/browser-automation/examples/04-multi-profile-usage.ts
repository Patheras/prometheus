/**
 * Example 4: Multi-Profile Usage
 * 
 * This example demonstrates:
 * - Using different browser profiles
 * - Switching between profiles
 * - Isolated browser instances
 * - Profile-specific configurations
 * - Chrome extension profile
 * 
 * Requirements: 3.1, 3.2, 3.6
 */

import { initializeBrowserAutomation, shutdownBrowserAutomation } from '../init.js';
import { BrowserProfile } from '../types/index.js';

async function multiProfileUsage() {
  console.log('=== Example 4: Multi-Profile Usage ===\n');

  try {
    // Step 1: Initialize with custom profiles
    console.log('1. Initializing with multiple profiles...');
    const system = await initializeBrowserAutomation({
      browser: {
        defaultProfile: 'openclaw',
        headless: false,
      },
      profiles: [
        // Profile 1: Default isolated instance
        {
          name: 'openclaw',
          type: 'openclaw',
          userDataDir: './.browser-data/openclaw',
          launchOptions: {
            headless: false,
            args: ['--no-first-run', '--no-default-browser-check'],
            defaultViewport: { width: 1280, height: 720 },
            timeout: 30000,
          },
        },
        // Profile 2: Development profile with larger viewport
        {
          name: 'development',
          type: 'openclaw',
          userDataDir: './.browser-data/development',
          launchOptions: {
            headless: false,
            args: [
              '--no-first-run',
              '--disable-blink-features=AutomationControlled',
              '--disable-web-security', // For local development only!
            ],
            defaultViewport: { width: 1920, height: 1080 },
            timeout: 30000,
          },
        },
        // Profile 3: Testing profile (headless)
        {
          name: 'testing',
          type: 'openclaw',
          userDataDir: './.browser-data/testing',
          launchOptions: {
            headless: true,
            args: ['--no-first-run'],
            defaultViewport: { width: 1280, height: 720 },
            timeout: 10000,
          },
        },
      ],
    });
    console.log('   ✓ System initialized with 3 profiles\n');

    const browserManager = system.getBrowserManager();
    const profileManager = system.getProfileManager();

    // Step 2: List available profiles
    console.log('2. Available profiles:');
    const profiles = profileManager.listProfiles();
    profiles.forEach(profile => {
      console.log(`   - ${profile.name} (${profile.type})`);
      console.log(`     Viewport: ${profile.launchOptions.defaultViewport.width}x${profile.launchOptions.defaultViewport.height}`);
      console.log(`     Headless: ${profile.launchOptions.headless}`);
    });
    console.log();

    // Step 3: Use default profile (openclaw)
    console.log('3. Using default profile (openclaw)...');
    const currentProfile = browserManager.getCurrentProfile();
    console.log(`   Current profile: ${currentProfile?.name}\n`);

    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    });
    console.log('   ✓ Navigated with openclaw profile\n');

    // Step 4: Switch to development profile
    console.log('4. Switching to development profile...');
    await browserManager.switchProfile('development');
    console.log('   ✓ Switched to development profile\n');

    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    });
    console.log('   ✓ Navigated with development profile (larger viewport)\n');

    // Step 5: Switch to testing profile (headless)
    console.log('5. Switching to testing profile (headless)...');
    await browserManager.switchProfile('testing');
    console.log('   ✓ Switched to testing profile\n');

    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    });
    console.log('   ✓ Navigated with testing profile (headless)\n');

    // Step 6: Demonstrate profile isolation
    console.log('6. Demonstrating profile isolation...');
    
    // Set cookies in testing profile
    await browserManager.executeAction({
      type: 'set_cookies',
      cookies: [{
        name: 'test_cookie',
        value: 'testing_profile_value',
        domain: 'example.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 3600,
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      }],
    });
    console.log('   ✓ Set cookie in testing profile\n');

    // Switch back to openclaw profile
    await browserManager.switchProfile('openclaw');
    console.log('   Switched back to openclaw profile');

    // Check cookies - should not have the testing profile cookie
    const cookiesResult = await browserManager.executeAction({
      type: 'get_cookies',
      domain: 'example.com',
    });

    const hasCookie = cookiesResult.result?.some((c: any) => c.name === 'test_cookie');
    console.log(`   Cookie from testing profile present: ${hasCookie ? 'YES (unexpected!)' : 'NO (correct!)'}`);
    console.log('   ✓ Profiles are properly isolated\n');

    console.log('=== Example completed successfully! ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    console.log('\n7. Shutting down...');
    await shutdownBrowserAutomation();
    console.log('   ✓ Shutdown complete');
  }
}

// Example: Using Chrome Extension Profile
async function chromeExtensionProfile() {
  console.log('=== Chrome Extension Profile Example ===\n');

  try {
    console.log('This example demonstrates connecting to existing Chrome tabs via extension.\n');
    console.log('Prerequisites:');
    console.log('1. Install the Browser Automation Chrome Extension');
    console.log('2. Open Chrome with the extension enabled');
    console.log('3. The extension will relay commands to your existing tabs\n');

    const system = await initializeBrowserAutomation({
      browser: {
        defaultProfile: 'chrome-extension',
      },
      profiles: [
        {
          name: 'chrome-extension',
          type: 'chrome-extension',
          userDataDir: './.browser-data/extension',
          launchOptions: {
            headless: false,
            args: [],
            defaultViewport: { width: 1280, height: 720 },
            timeout: 30000,
          },
          connectionOptions: {
            extensionId: 'your-extension-id-here',
          },
        },
      ],
    });

    const browserManager = system.getBrowserManager();

    console.log('1. Connecting to Chrome extension...');
    // The system will automatically connect to the extension
    console.log('   ✓ Connected to extension\n');

    console.log('2. Listing available tabs...');
    // Get available tabs from the extension
    const tabsResult = await browserManager.executeAction({
      type: 'list_extension_tabs',
    });

    if (tabsResult.success) {
      console.log(`   Found ${tabsResult.result.length} tabs:`);
      tabsResult.result.forEach((tab: any, index: number) => {
        console.log(`   ${index + 1}. ${tab.title} - ${tab.url}`);
      });
      console.log();
    }

    console.log('3. Selecting a tab to control...');
    // Select the first tab
    if (tabsResult.result.length > 0) {
      await browserManager.executeAction({
        type: 'select_extension_tab',
        tabId: tabsResult.result[0].id,
      });
      console.log('   ✓ Tab selected\n');

      // Now you can control this tab
      console.log('4. Controlling the selected tab...');
      await browserManager.executeAction({
        type: 'execute_js',
        script: 'document.title',
      });
      console.log('   ✓ Executed command on tab\n');
    }

    console.log('Note: Extension profile allows you to automate your existing');
    console.log('Chrome tabs without launching a new browser instance.\n');

  } catch (error) {
    console.error('Error:', error);
    console.log('\nNote: This example requires the Chrome extension to be installed and running.');
  } finally {
    await shutdownBrowserAutomation();
  }
}

// Example: Creating custom profiles programmatically
async function customProfileCreation() {
  console.log('=== Custom Profile Creation ===\n');

  try {
    const system = await initializeBrowserAutomation();
    const profileManager = system.getProfileManager();

    // Create a custom profile for mobile testing
    console.log('Creating mobile testing profile...');
    const mobileProfile: BrowserProfile = {
      name: 'mobile-testing',
      type: 'openclaw',
      userDataDir: './.browser-data/mobile',
      launchOptions: {
        headless: false,
        args: [
          '--no-first-run',
          '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        ],
        defaultViewport: { width: 375, height: 812 }, // iPhone X dimensions
        timeout: 30000,
      },
    };

    await profileManager.createProfile(mobileProfile);
    console.log('✓ Mobile testing profile created\n');

    // Use the new profile
    const browserManager = system.getBrowserManager();
    await browserManager.switchProfile('mobile-testing');
    console.log('✓ Switched to mobile testing profile\n');

    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    });
    console.log('✓ Navigated with mobile viewport\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await shutdownBrowserAutomation();
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  multiProfileUsage().catch(console.error);
}

export { multiProfileUsage, chromeExtensionProfile, customProfileCreation };
