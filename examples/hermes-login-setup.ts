/**
 * Olympus - Hermes Login Setup
 * 
 * Simple script to setup Gemini login for Hermes
 * Run this once to login, then session persists forever!
 */

import { chromium } from 'playwright';
import { HERMES_BROWSER_PROFILE } from '../src/olympus/hermes/config.js';

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              🏛️  HERMES LOGIN SETUP  🏛️                  ║
║                                                           ║
║  This script will open a browser for you to login        ║
║  to Gemini. Your session will be saved automatically.    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  console.log('🌐 Launching browser with Hermes profile...\n');
  
  // Launch browser with persistent profile
  const browser = await chromium.launchPersistentContext(
    HERMES_BROWSER_PROFILE.userDataDir,
    {
      headless: false,
      viewport: { width: 1920, height: 1080 },
      args: HERMES_BROWSER_PROFILE.launchOptions.args,
    }
  );
  
  const page = await browser.newPage();
  
  // Navigate to Gemini
  console.log('📍 Navigating to Gemini...\n');
  await page.goto('https://gemini.google.com', {
    waitUntil: 'domcontentloaded',
  });
  
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                   📋 INSTRUCTIONS                         ║
║                                                           ║
║  1. ✅ Sign in with your Google account                  ║
║  2. ✅ Select "Stay signed in" if prompted               ║
║  3. ✅ Wait for Gemini to fully load                     ║
║  4. ✅ You should see the Gemini chat interface          ║
║                                                           ║
║  Once you see Gemini is ready, press Ctrl+C to exit.     ║
║  Your session is automatically saved! 🎉                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // Check login status every 5 seconds
  const checkInterval = setInterval(async () => {
    try {
      const url = page.url();
      
      // Check if we're on Gemini app (not login page)
      if (url.includes('gemini.google.com/app')) {
        console.log('✅ Login detected! Gemini app loaded.');
        console.log('✅ Session saved to:', HERMES_BROWSER_PROFILE.userDataDir);
        console.log('\n🎉 Setup complete! You can now close this window (Ctrl+C).\n');
        clearInterval(checkInterval);
      }
    } catch (error) {
      // Ignore errors during check
    }
  }, 5000);
  
  // Keep browser open
  await new Promise(() => {}); // Wait forever (until Ctrl+C)
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
