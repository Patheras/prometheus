/**
 * Olympus - Hermes Session Manager
 * 
 * Manages Gemini session persistence
 */

import { Page } from 'playwright';
import { DEFAULT_HERMES_CONFIG } from './config.js';

export class SessionManager {
  /**
   * Check if user is logged in to Gemini
   */
  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      // Navigate to Gemini
      await page.goto(DEFAULT_HERMES_CONFIG.gemini.baseUrl, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });
      
      // Wait a bit for page to load
      await page.waitForTimeout(2000);
      
      // Check for login indicators
      const url = page.url();
      
      // If redirected to accounts.google.com, not logged in
      if (url.includes('accounts.google.com')) {
        return false;
      }
      
      // Check for Gemini app elements (means logged in)
      const appElement = await page.$('[data-app-root]');
      if (appElement) {
        return true;
      }
      
      // Check for input field (means logged in and ready)
      const inputElement = await page.$('textarea[aria-label*="prompt"]');
      if (inputElement) {
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Error checking login status:', error);
      return false;
    }
  }
  
  /**
   * Wait for user to login manually
   */
  async waitForManualLogin(page: Page, timeoutMs: number = 300000): Promise<void> {
    console.log('\n🔐 Please login to Gemini manually in the browser...');
    console.log('   1. Go to gemini.google.com');
    console.log('   2. Sign in with your Google account');
    console.log('   3. Select "Stay signed in"');
    console.log('   4. Wait for Gemini to load...\n');
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const loggedIn = await this.isLoggedIn(page);
      
      if (loggedIn) {
        console.log('✅ Login successful! Session saved.\n');
        return;
      }
      
      // Check every 2 seconds
      await page.waitForTimeout(2000);
    }
    
    throw new Error('Login timeout - please try again');
  }
  
  /**
   * Ensure user is logged in (login if needed)
   */
  async ensureLoggedIn(page: Page): Promise<void> {
    console.log('🔍 Checking Gemini login status...');
    
    const loggedIn = await this.isLoggedIn(page);
    
    if (loggedIn) {
      console.log('✅ Already logged in to Gemini!');
      return;
    }
    
    console.log('⚠️  Not logged in - manual login required');
    await this.waitForManualLogin(page);
  }
  
  /**
   * Clear session (logout)
   */
  async clearSession(page: Page): Promise<void> {
    console.log('🗑️  Clearing Gemini session...');
    
    // Clear cookies
    const context = page.context();
    await context.clearCookies();
    
    // Clear storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    console.log('✅ Session cleared');
  }
}
