/**
 * State Export/Import Demo
 * 
 * Demonstrates how to export, import, and clear browser state using StateManager.
 * This example shows:
 * - Exporting all browser state to JSON
 * - Importing state from JSON
 * - Clearing all browser state
 * - Round-trip preservation of state
 * 
 * Requirements: 7.8, 15.1, 15.2, 15.3
 */

import { CDPClient } from '../cdp-client.js';
import { StateManager } from '../state-manager.js';
import { BrowserState, Cookie } from '../types/index.js';

async function demo() {
  console.log('=== State Export/Import Demo ===\n');

  // Initialize CDP client and StateManager
  const cdpClient = new CDPClient();
  const stateManager = new StateManager(cdpClient);

  try {
    // Connect to browser (assumes browser is running with debugging enabled)
    // Example: chrome --remote-debugging-port=9222
    const cdpEndpoint = 'ws://localhost:9222';
    console.log(`Connecting to browser at ${cdpEndpoint}...`);
    await cdpClient.connect(cdpEndpoint);
    console.log('Connected!\n');

    // 1. Set some initial state
    console.log('1. Setting initial browser state...');
    const testCookies: Cookie[] = [
      {
        name: 'session_id',
        value: 'abc123xyz',
        domain: 'example.com',
        path: '/',
        expires: Date.now() / 1000 + 3600, // 1 hour from now
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      },
      {
        name: 'user_pref',
        value: 'dark_mode',
        domain: 'example.com',
        path: '/',
        expires: -1, // Session cookie
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ];

    await stateManager.setCookies(testCookies);
    console.log(`Set ${testCookies.length} cookies\n`);

    // 2. Export state to JSON
    console.log('2. Exporting browser state...');
    const exportedState = await stateManager.exportState();
    console.log('Exported state:');
    console.log(JSON.stringify(exportedState, null, 2));
    console.log();

    // 2a. Alternative: Export directly as JSON string
    console.log('2a. Export as JSON string (convenience method):');
    const jsonString = await stateManager.exportStateAsJSON();
    console.log(jsonString);
    console.log();

    // 3. Save state to file (in real usage)
    console.log('3. State can be saved to file:');
    console.log('   // Using exportState():');
    console.log('   fs.writeFileSync("browser-state.json", JSON.stringify(exportedState, null, 2))');
    console.log('   // Or using exportStateAsJSON() convenience method:');
    console.log('   fs.writeFileSync("browser-state.json", await stateManager.exportStateAsJSON())');
    console.log();

    // 4. Clear all state
    console.log('4. Clearing all browser state...');
    await stateManager.clearAllState();
    console.log('All state cleared\n');

    // 5. Verify state is cleared
    console.log('5. Verifying state is cleared...');
    const clearedState = await stateManager.exportState();
    console.log(`Cookies after clear: ${clearedState.cookies.length}`);
    console.log();

    // 6. Import state back
    console.log('6. Importing state back...');
    await stateManager.importState(exportedState);
    console.log('State imported\n');

    // 7. Verify state is restored
    console.log('7. Verifying state is restored...');
    const restoredState = await stateManager.exportState();
    console.log(`Cookies after import: ${restoredState.cookies.length}`);
    console.log('Restored cookies:');
    restoredState.cookies.forEach(cookie => {
      console.log(`  - ${cookie.name}: ${cookie.value} (domain: ${cookie.domain})`);
    });
    console.log();

    // 8. Demonstrate round-trip preservation
    console.log('8. Verifying round-trip preservation...');
    const statesMatch = JSON.stringify(exportedState) === JSON.stringify(restoredState);
    console.log(`States match: ${statesMatch ? '✓ YES' : '✗ NO'}`);
    console.log();

    // 9. Example with localStorage and sessionStorage
    console.log('9. Example with storage (requires navigation to a page first):');
    console.log('   await stateManager.setLocalStorage("https://example.com", {');
    console.log('     theme: "dark",');
    console.log('     language: "en"');
    console.log('   });');
    console.log();
    console.log('   await stateManager.setSessionStorage("https://example.com", {');
    console.log('     temp_data: "session_value"');
    console.log('   });');
    console.log();
    console.log('   const stateWithStorage = await stateManager.exportState();');
    console.log('   // stateWithStorage will include localStorage and sessionStorage');
    console.log();

    // 10. Example with geolocation
    console.log('10. Example with geolocation:');
    console.log('    await stateManager.setGeolocation({');
    console.log('      latitude: 37.7749,');
    console.log('      longitude: -122.4194,');
    console.log('      accuracy: 50');
    console.log('    });');
    console.log();
    console.log('    const stateWithGeo = await stateManager.exportState();');
    console.log('    // stateWithGeo.geolocation will contain the coordinates');
    console.log();

    console.log('=== Demo Complete ===');

  } catch (error) {
    console.error('Error during demo:', error);
  } finally {
    // Cleanup
    if (cdpClient.isConnected()) {
      await cdpClient.disconnect();
      console.log('\nDisconnected from browser');
    }
  }
}

// Run the demo
demo().catch(console.error);
