/**
 * Example 3: State Management (Cookies and localStorage)
 * 
 * This example demonstrates:
 * - Setting and getting cookies
 * - Managing localStorage
 * - Managing sessionStorage
 * - Exporting and importing browser state
 * - Clearing browser state
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.8
 */

import { initializeBrowserAutomation, shutdownBrowserAutomation } from '../init.js';
import { Cookie } from '../types/index.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function stateManagement() {
  console.log('=== Example 3: State Management ===\n');

  try {
    // Step 1: Initialize the system
    console.log('1. Initializing browser automation system...');
    const system = await initializeBrowserAutomation({
      browser: {
        headless: false,
      },
    });
    console.log('   ✓ System initialized\n');

    const browserManager = system.getBrowserManager();

    // Step 2: Navigate to a website
    console.log('2. Navigating to example.com...');
    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'networkidle',
    });
    console.log('   ✓ Page loaded\n');

    // Step 3: Set cookies
    console.log('3. Setting cookies...');
    const cookies: Cookie[] = [
      {
        name: 'user_session',
        value: 'abc123xyz789',
        domain: 'example.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      },
      {
        name: 'user_preferences',
        value: JSON.stringify({ theme: 'dark', language: 'en' }),
        domain: 'example.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      },
      {
        name: 'analytics_id',
        value: 'visitor_12345',
        domain: 'example.com',
        path: '/',
        expires: -1, // Session cookie
        httpOnly: false,
        secure: false,
        sameSite: 'None',
      },
    ];

    const setCookiesResult = await browserManager.executeAction({
      type: 'set_cookies',
      cookies,
    });

    if (setCookiesResult.success) {
      console.log(`   ✓ Set ${cookies.length} cookies\n`);
    }

    // Step 4: Get cookies
    console.log('4. Getting cookies...');
    const getCookiesResult = await browserManager.executeAction({
      type: 'get_cookies',
      domain: 'example.com',
    });

    if (getCookiesResult.success) {
      console.log(`   ✓ Retrieved ${getCookiesResult.result.length} cookies:`);
      getCookiesResult.result.forEach((cookie: Cookie) => {
        console.log(`     - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
      });
      console.log();
    }

    // Step 5: Set localStorage
    console.log('5. Setting localStorage...');
    const setLocalStorageResult = await browserManager.executeAction({
      type: 'set_local_storage',
      items: {
        'app_version': '1.2.3',
        'last_visit': new Date().toISOString(),
        'feature_flags': JSON.stringify({
          newUI: true,
          betaFeatures: false,
        }),
      },
    });

    if (setLocalStorageResult.success) {
      console.log('   ✓ localStorage items set\n');
    }

    // Step 6: Get localStorage
    console.log('6. Getting localStorage...');
    const getLocalStorageResult = await browserManager.executeAction({
      type: 'get_local_storage',
    });

    if (getLocalStorageResult.success) {
      console.log('   ✓ localStorage items:');
      Object.entries(getLocalStorageResult.result).forEach(([key, value]) => {
        console.log(`     - ${key}: ${value}`);
      });
      console.log();
    }

    // Step 7: Export browser state
    console.log('7. Exporting browser state...');
    const exportResult = await browserManager.executeAction({
      type: 'export_state',
    });

    if (exportResult.success) {
      const statePath = join(process.cwd(), 'browser-state.json');
      writeFileSync(statePath, JSON.stringify(exportResult.result, null, 2));
      console.log(`   ✓ State exported to: ${statePath}`);
      console.log(`   - Cookies: ${exportResult.result.cookies.length}`);
      console.log(`   - localStorage origins: ${Object.keys(exportResult.result.localStorage).length}`);
      console.log(`   - sessionStorage origins: ${Object.keys(exportResult.result.sessionStorage).length}\n`);
    }

    // Step 8: Clear all state
    console.log('8. Clearing all browser state...');
    const clearResult = await browserManager.executeAction({
      type: 'clear_all_state',
    });

    if (clearResult.success) {
      console.log('   ✓ All state cleared\n');
    }

    // Step 9: Verify state is cleared
    console.log('9. Verifying state is cleared...');
    const verifyCookies = await browserManager.executeAction({
      type: 'get_cookies',
    });
    const verifyStorage = await browserManager.executeAction({
      type: 'get_local_storage',
    });

    console.log(`   - Cookies: ${verifyCookies.result?.length || 0}`);
    console.log(`   - localStorage items: ${Object.keys(verifyStorage.result || {}).length}\n`);

    // Step 10: Import state back
    console.log('10. Importing state back...');
    const statePath = join(process.cwd(), 'browser-state.json');
    if (existsSync(statePath)) {
      const savedState = JSON.parse(readFileSync(statePath, 'utf-8'));
      const importResult = await browserManager.executeAction({
        type: 'import_state',
        state: savedState,
      });

      if (importResult.success) {
        console.log('   ✓ State imported successfully\n');
      }

      // Step 11: Verify state is restored
      console.log('11. Verifying state is restored...');
      const restoredCookies = await browserManager.executeAction({
        type: 'get_cookies',
      });
      const restoredStorage = await browserManager.executeAction({
        type: 'get_local_storage',
      });

      console.log(`   - Cookies: ${restoredCookies.result?.length || 0}`);
      console.log(`   - localStorage items: ${Object.keys(restoredStorage.result || {}).length}\n`);
    }

    // Step 12: Delete specific cookies
    console.log('12. Deleting specific cookies...');
    const deleteCookiesResult = await browserManager.executeAction({
      type: 'delete_cookies',
      filter: {
        name: 'analytics_id',
        domain: 'example.com',
      },
    });

    if (deleteCookiesResult.success) {
      console.log('   ✓ Cookie deleted\n');
    }

    // Step 13: Verify cookie deletion
    const finalCookies = await browserManager.executeAction({
      type: 'get_cookies',
    });
    console.log(`13. Final cookie count: ${finalCookies.result?.length || 0}\n`);

    console.log('=== Example completed successfully! ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    console.log('\n14. Shutting down...');
    await shutdownBrowserAutomation();
    console.log('   ✓ Shutdown complete');
  }
}

// Alternative example: Session management pattern
async function sessionManagementPattern() {
  console.log('=== Session Management Pattern ===\n');

  try {
    const system = await initializeBrowserAutomation();
    const browserManager = system.getBrowserManager();

    // Navigate to login page
    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com/login',
      waitUntil: 'networkidle',
    });

    // Simulate login (fill form and submit)
    // ... login actions ...

    // After successful login, save the session
    console.log('Saving session after login...');
    const sessionState = await browserManager.executeAction({
      type: 'export_state',
    });

    if (sessionState.success) {
      // Save to file for later use
      writeFileSync('session.json', JSON.stringify(sessionState.result, null, 2));
      console.log('✓ Session saved\n');
    }

    // Later, restore the session
    console.log('Restoring session...');
    const savedSession = JSON.parse(readFileSync('session.json', 'utf-8'));
    await browserManager.executeAction({
      type: 'import_state',
      state: savedSession,
    });

    // Navigate to protected page - should be logged in
    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com/dashboard',
      waitUntil: 'networkidle',
    });

    console.log('✓ Session restored, navigated to protected page\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await shutdownBrowserAutomation();
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  stateManagement().catch(console.error);
}

export { stateManagement, sessionManagementPattern };
