/**
 * Olympus - Hermes Hello World Example
 * 
 * Simple example showing how to use Hermes to send a message to Gemini
 */

import { chromium } from 'playwright';
import Database from 'better-sqlite3';
import { GeminiMessenger, logHermesInit } from '../src/olympus/hermes/index.js';
import { ProfileManager } from '../src/browser-automation/profile-manager.js';
import { HERMES_BROWSER_PROFILE } from '../src/olympus/hermes/config.js';

async function main() {
  // Log Hermes initialization
  logHermesInit();
  
  // Initialize database
  const db = new Database('./data/prometheus.db');
  
  // Run migrations
  console.log('📊 Running migrations...');
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
  const hermes = new GeminiMessenger(db);
  await hermes.initialize();
  
  // Launch browser with Hermes profile
  console.log('🌐 Launching browser...');
  const profileManager = new ProfileManager();
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
  
  // Check/ensure login (will prompt if needed)
  console.log('\n🔐 Checking Gemini session...\n');
  const sessionManager = new (await import('../src/olympus/hermes/session-manager.js')).SessionManager();
  await sessionManager.ensureLoggedIn(page);
  
  // Send message to Gemini
  console.log('\n📤 Sending message to Gemini...\n');
  
  try {
    const response = await hermes.sendToGemini(
      'General',
      'Hello! I am Hermes, the messenger of Olympus. Can you introduce yourself?'
    );
    
    console.log('\n✅ Response from Gemini:\n');
    console.log(response);
    console.log('\n');
    
    // Show metrics
    const metrics = hermes.getMetrics();
    console.log('📊 Metrics:');
    console.log(`  Messages sent: ${metrics.messagesSent}`);
    console.log(`  Responses received: ${metrics.responsesReceived}`);
    console.log(`  Average response time: ${metrics.averageResponseTime}ms`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  // Keep browser open for inspection
  console.log('\n✨ Press Ctrl+C to close browser\n');
  await new Promise(() => {}); // Keep alive
}

main().catch(console.error);
