/**
 * Example 5: Remote Browser Connection
 * 
 * This example demonstrates:
 * - Connecting to remote browsers
 * - Gateway authentication
 * - Remote browser operations
 * - Network interruption handling
 * - Cloud browser services integration
 * 
 * Requirements: 17.1, 17.2, 17.3, 17.4
 */

import { initializeBrowserAutomation, shutdownBrowserAutomation } from '../init.js';
import { BrowserProfile } from '../types/index.js';

async function remoteBrowserConnection() {
  console.log('=== Example 5: Remote Browser Connection ===\n');

  try {
    // Step 1: Initialize with remote profile
    console.log('1. Initializing with remote browser profile...');
    
    // Note: Replace these values with your actual remote browser details
    const remoteProfile: BrowserProfile = {
      name: 'remote',
      type: 'remote',
      userDataDir: './.browser-data/remote',
      launchOptions: {
        headless: false,
        args: [],
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000,
      },
      connectionOptions: {
        // WebSocket endpoint of the remote browser
        wsEndpoint: 'ws://remote-browser.example.com:9222/devtools/browser/abc123',
        
        // Optional: Gateway URL for authentication
        gatewayUrl: 'https://gateway.example.com',
        
        // Optional: Authentication token
        authToken: 'your-auth-token-here',
      },
    };

    const system = await initializeBrowserAutomation({
      browser: {
        defaultProfile: 'remote',
      },
      profiles: [remoteProfile],
      security: {
        allowRemoteProfiles: true, // Must be enabled for remote connections
        validateSelectors: true,
        sanitizeFilePaths: true,
      },
    });
    console.log('   ✓ System initialized with remote profile\n');

    const browserManager = system.getBrowserManager();

    // Step 2: Connect to remote browser
    console.log('2. Connecting to remote browser...');
    console.log('   Endpoint: ws://remote-browser.example.com:9222');
    console.log('   Authenticating via gateway...');
    
    // The connection is established automatically when the profile is loaded
    const currentProfile = browserManager.getCurrentProfile();
    console.log(`   ✓ Connected to remote browser (profile: ${currentProfile?.name})\n`);

    // Step 3: Verify browser version compatibility
    console.log('3. Verifying browser compatibility...');
    const versionResult = await browserManager.executeAction({
      type: 'get_browser_version',
    });

    if (versionResult.success) {
      console.log('   ✓ Browser version:');
      console.log(`     - Browser: ${versionResult.result.browser}`);
      console.log(`     - Protocol: ${versionResult.result.protocolVersion}`);
      console.log(`     - User Agent: ${versionResult.result.userAgent}`);
      console.log();
    }

    // Step 4: Perform remote browser operations
    console.log('4. Performing operations on remote browser...');
    
    // Navigate
    const navigateResult = await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    });
    console.log(`   ✓ Navigation: ${navigateResult.success ? 'success' : 'failed'}`);

    // Take screenshot
    const screenshotResult = await browserManager.executeAction({
      type: 'screenshot',
      fullPage: false,
      format: 'png',
    });
    console.log(`   ✓ Screenshot: ${screenshotResult.success ? 'captured' : 'failed'}`);

    // Execute JavaScript
    const jsResult = await browserManager.executeAction({
      type: 'execute_js',
      script: 'document.title',
    });
    console.log(`   ✓ JavaScript execution: ${jsResult.success ? jsResult.result : 'failed'}\n`);

    // Step 5: Demonstrate network resilience
    console.log('5. Network resilience features:');
    console.log('   - Automatic reconnection on network interruption');
    console.log('   - Exponential backoff (1s, 2s, 4s, 8s, 16s)');
    console.log('   - Maximum 5 reconnection attempts');
    console.log('   - Connection state monitoring\n');

    console.log('=== Example completed successfully! ===');

  } catch (error) {
    console.error('Error:', error);
    console.log('\nNote: This example requires a remote browser to be running.');
    console.log('Common remote browser services:');
    console.log('  - BrowserStack');
    console.log('  - Sauce Labs');
    console.log('  - Selenium Grid');
    console.log('  - Self-hosted Chrome with --remote-debugging-port');
  } finally {
    // Clean up
    console.log('\n6. Shutting down...');
    await shutdownBrowserAutomation();
    console.log('   ✓ Shutdown complete');
  }
}

// Example: Using BrowserStack
async function browserStackExample() {
  console.log('=== BrowserStack Remote Browser Example ===\n');

  try {
    console.log('This example shows how to connect to BrowserStack.\n');

    // BrowserStack provides WebSocket endpoints for browser automation
    const browserStackProfile: BrowserProfile = {
      name: 'browserstack',
      type: 'remote',
      userDataDir: './.browser-data/browserstack',
      launchOptions: {
        headless: false,
        args: [],
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000,
      },
      connectionOptions: {
        // BrowserStack WebSocket endpoint
        wsEndpoint: 'wss://cdp.browserstack.com/wd/hub',
        
        // BrowserStack authentication
        gatewayUrl: 'https://api.browserstack.com',
        authToken: 'YOUR_BROWSERSTACK_ACCESS_KEY',
      },
    };

    const system = await initializeBrowserAutomation({
      browser: {
        defaultProfile: 'browserstack',
      },
      profiles: [browserStackProfile],
      security: {
        allowRemoteProfiles: true,
      },
    });

    console.log('1. Connected to BrowserStack');
    console.log('2. Running tests on cloud browser...\n');

    const browserManager = system.getBrowserManager();

    // Run your tests
    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    });

    console.log('✓ Tests completed on BrowserStack\n');

  } catch (error) {
    console.error('Error:', error);
    console.log('\nNote: Requires valid BrowserStack credentials.');
  } finally {
    await shutdownBrowserAutomation();
  }
}

// Example: Self-hosted remote browser
async function selfHostedRemoteBrowser() {
  console.log('=== Self-Hosted Remote Browser Example ===\n');

  try {
    console.log('Setting up connection to self-hosted remote browser.\n');
    console.log('Prerequisites:');
    console.log('1. Start Chrome on remote machine with:');
    console.log('   chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0');
    console.log('2. Ensure port 9222 is accessible from your network');
    console.log('3. Note the WebSocket endpoint from http://remote-ip:9222/json/version\n');

    const remoteProfile: BrowserProfile = {
      name: 'self-hosted',
      type: 'remote',
      userDataDir: './.browser-data/self-hosted',
      launchOptions: {
        headless: false,
        args: [],
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000,
      },
      connectionOptions: {
        // WebSocket endpoint from the remote Chrome instance
        wsEndpoint: 'ws://192.168.1.100:9222/devtools/browser/abc123',
      },
    };

    const system = await initializeBrowserAutomation({
      browser: {
        defaultProfile: 'self-hosted',
      },
      profiles: [remoteProfile],
      security: {
        allowRemoteProfiles: true,
      },
    });

    console.log('1. Connected to self-hosted remote browser');
    console.log('2. Remote browser IP: 192.168.1.100');
    console.log('3. Ready for automation\n');

    const browserManager = system.getBrowserManager();

    // Perform operations
    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    });

    console.log('✓ Successfully automated remote browser\n');

  } catch (error) {
    console.error('Error:', error);
    console.log('\nTroubleshooting:');
    console.log('- Verify Chrome is running with --remote-debugging-port=9222');
    console.log('- Check firewall rules allow port 9222');
    console.log('- Ensure WebSocket endpoint is correct');
    console.log('- Try accessing http://remote-ip:9222/json in browser');
  } finally {
    await shutdownBrowserAutomation();
  }
}

// Example: Docker-based remote browser
async function dockerRemoteBrowser() {
  console.log('=== Docker Remote Browser Example ===\n');

  try {
    console.log('Using Chrome in Docker container.\n');
    console.log('Docker setup:');
    console.log('  docker run -d -p 9222:9222 \\');
    console.log('    --name chrome-remote \\');
    console.log('    zenika/alpine-chrome \\');
    console.log('    --no-sandbox --remote-debugging-address=0.0.0.0 \\');
    console.log('    --remote-debugging-port=9222\n');

    const dockerProfile: BrowserProfile = {
      name: 'docker',
      type: 'remote',
      userDataDir: './.browser-data/docker',
      launchOptions: {
        headless: true, // Docker Chrome typically runs headless
        args: [],
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000,
      },
      connectionOptions: {
        wsEndpoint: 'ws://localhost:9222/devtools/browser/abc123',
      },
    };

    const system = await initializeBrowserAutomation({
      browser: {
        defaultProfile: 'docker',
      },
      profiles: [dockerProfile],
      security: {
        allowRemoteProfiles: true,
      },
    });

    console.log('1. Connected to Docker Chrome container');
    console.log('2. Running headless automation\n');

    const browserManager = system.getBrowserManager();

    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    });

    console.log('✓ Docker browser automation successful\n');

  } catch (error) {
    console.error('Error:', error);
    console.log('\nNote: Requires Docker and chrome-remote container running.');
  } finally {
    await shutdownBrowserAutomation();
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  remoteBrowserConnection().catch(console.error);
}

export {
  remoteBrowserConnection,
  browserStackExample,
  selfHostedRemoteBrowser,
  dockerRemoteBrowser,
};
