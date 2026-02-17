/**
 * Simple Browser Test
 * Test if browser can launch and navigate
 */

import { chromium } from 'playwright';

async function main() {
  console.log('🌐 Testing browser launch...');
  
  try {
    // Try without persistent context first
    const browser = await chromium.launch({
      headless: false,
    });
    
    const page = await browser.newPage();
    
    console.log('✅ Browser launched!');
    console.log('📍 Navigating to Google...');
    
    await page.goto('https://google.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    console.log('✅ Navigation successful!');
    console.log('⏳ Waiting 5 seconds...');
    
    await page.waitForTimeout(5000);
    
    console.log('🔒 Closing browser...');
    await browser.close();
    
    console.log('✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main().catch(console.error);
