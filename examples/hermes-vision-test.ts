/**
 * Hermes DOM Test
 * 
 * Test DOM-based navigation with DeepSeek-R1
 * Uses hermes-beta tab where Gemini 3 Pro knows the project
 */

import { chromium } from 'playwright';
import Database from 'better-sqlite3';
import { GeminiMessenger } from '../src/olympus/hermes/gemini-messenger.js';

const HERMES_BETA_URL = 'https://gemini.google.com/app/e42a7b4ccc3cb9cf';

async function main() {
  console.log('🏛️  Hermes DOM Test');
  console.log('='.repeat(60));
  
  // Initialize database
  const db = new Database('./data/prometheus.db');
  
  // Launch browser with persistent context (auto-login!)
  console.log('🌐 Launching browser with persistent profile...');
  const context = await chromium.launchPersistentContext('./browser-data/olympus-hermes', {
    headless: false,
    viewport: { width: 1280, height: 720 },
  });
  
  const page = context.pages()[0] || await context.newPage();
  
  // Check if we need to login
  console.log('📍 Opening Gemini...');
  await page.goto('https://gemini.google.com/app', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  
  await page.waitForTimeout(2000);
  
  // Check if we're logged in by looking for the input field
  const isLoggedIn = await page.locator('[contenteditable][class*="textarea"]').count() > 0;
  
  if (!isLoggedIn) {
    console.log('\n⚠️  PLEASE LOGIN TO GEMINI MANUALLY');
    console.log('⚠️  After login, press Enter in this terminal to continue...\n');
    
    // Wait for user to press Enter
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
  } else {
    console.log('✅ Already logged in!');
  }
  
  console.log('✅ Continuing...');
  
  try {
    // Initialize Hermes
    const hermes = new GeminiMessenger(db, page);
    await hermes.initialize();
    
    // Navigate to hermes-beta tab
    console.log(`\n📍 Navigating to hermes-beta tab...`);
    await page.goto(HERMES_BETA_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    
    // Update tab URL
    const tabManager = hermes.getTabManager();
    const tab = tabManager.getTab('General');
    if (tab) {
      tabManager.updateTabMetadata(tab.id, { url: HERMES_BETA_URL });
      console.log(`💾 Set tab URL to: ${HERMES_BETA_URL}`);
    }
    
    // Send test message
    console.log('\n📤 Sending test message...');
    const response = await hermes.sendToGemini(
      'General',
      'Hello! Can you confirm you can see this message? Just reply with "Yes, I can see it!"'
    );
    
    console.log('\n✅ Response received:');
    console.log('='.repeat(60));
    console.log(response);
    console.log('='.repeat(60));
    
    // Show metrics
    const metrics = hermes.getMetrics();
    console.log('\n📊 Metrics:');
    console.log(`   Messages sent: ${metrics.messagesSent}`);
    console.log(`   Responses received: ${metrics.responsesReceived}`);
    console.log(`   Average response time: ${metrics.averageResponseTime}ms`);
    console.log(`   Errors: ${metrics.errors}`);
    
    console.log('\n✅ Test complete!');
    console.log('Press Ctrl+C to exit...');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    db.close();
  }
}

main().catch(console.error);
