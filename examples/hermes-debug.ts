/**
 * Olympus - Hermes Debug Script
 * 
 * Debug script to test Gemini interaction step by step
 */

import { chromium } from 'playwright';
import Database from 'better-sqlite3';
import { GeminiMessenger, HERMES_BROWSER_PROFILE } from '../src/olympus/hermes/index.js';

async function main() {
  console.log('🔧 Hermes Debug Mode\n');
  
  // Initialize database
  const db = new Database('./data/prometheus.db');
  
  // Run migrations
  console.log('📊 Ensuring database schema...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS gemini_tabs (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      message_count INTEGER DEFAULT 0,
      context_estimate INTEGER DEFAULT 0,
      gem_id TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS gemini_messages (
      id TEXT PRIMARY KEY,
      tab_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens_estimate INTEGER,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Initialize Hermes
  console.log('🏛️  Initializing Hermes...');
  const hermes = new GeminiMessenger(db);
  await hermes.initialize();
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launchPersistentContext(
    HERMES_BROWSER_PROFILE.userDataDir,
    {
      headless: false,
      viewport: { width: 1920, height: 1080 },
      args: HERMES_BROWSER_PROFILE.launchOptions.args,
    }
  );
  
  const page = await browser.newPage();
  hermes.setPage(page);
  
  console.log('\n📍 Step 1: Navigating to Gemini...');
  await page.goto('https://gemini.google.com/app', {
    waitUntil: 'domcontentloaded',
  });
  
  console.log('⏳ Waiting 3 seconds for page to load...');
  await page.waitForTimeout(3000);
  
  console.log('📸 Current URL:', page.url());
  
  console.log('\n🔍 Step 2: Looking for input field...');
  
  // Try multiple selectors
  const selectors = [
    'textarea[aria-label*="prompt"]',
    'textarea[placeholder*="Enter"]',
    'textarea',
    'div[contenteditable="true"]',
  ];
  
  let inputFound = false;
  for (const selector of selectors) {
    const element = await page.$(selector);
    if (element) {
      console.log(`✅ Found input with selector: ${selector}`);
      inputFound = true;
      
      // Try to type
      console.log('\n⌨️  Step 3: Typing test message...');
      await element.click();
      await page.waitForTimeout(500);
      await element.fill('Hello from Hermes! This is a test message.');
      
      console.log('✅ Message typed successfully!');
      console.log('\n📤 Press Enter in the browser to send, or Ctrl+C to exit');
      
      break;
    }
  }
  
  if (!inputFound) {
    console.log('❌ No input field found!');
    console.log('\n🔍 Available textareas:');
    const textareas = await page.$$('textarea');
    console.log(`Found ${textareas.length} textarea elements`);
    
    console.log('\n🔍 Available contenteditable:');
    const editables = await page.$$('[contenteditable="true"]');
    console.log(`Found ${editables.length} contenteditable elements`);
  }
  
  // Keep browser open
  console.log('\n✨ Browser will stay open for inspection');
  console.log('Press Ctrl+C to close\n');
  await new Promise(() => {});
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
