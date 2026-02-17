/**
 * Olympus - Hermes Simple Test
 * 
 * Very simple test - no navigation, just type and read
 */

import { chromium } from 'playwright';
import { HERMES_BROWSER_PROFILE } from '../src/olympus/hermes/config.js';

async function main() {
  console.log('🏛️  Hermes Simple Test\n');
  
  // Launch browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launchPersistentContext(
    HERMES_BROWSER_PROFILE.userDataDir,
    {
      headless: false,
      viewport: { width: 1920, height: 1080 },
    }
  );
  
  const page = await browser.newPage();
  
  console.log('\n📍 MANUEL: Gemini sayfasına git ve bir sohbet aç');
  console.log('Hazır olunca Enter\'a bas...\n');
  
  // Wait for user
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('\n✅ Devam ediyoruz!\n');
  
  // Find input
  console.log('🔍 Looking for input...');
  const input = await page.$('textarea');
  
  if (!input) {
    console.log('❌ No textarea found!');
    return;
  }
  
  console.log('✅ Found textarea!');
  
  // Type message
  console.log('⌨️  Typing message...');
  await input.click();
  await page.waitForTimeout(500);
  await input.fill('Test message from Hermes!');
  
  console.log('📤 Sending (press Enter)...');
  await page.keyboard.press('Enter');
  
  console.log('⏳ Waiting 10 seconds for response...');
  await page.waitForTimeout(10000);
  
  // Read all text
  console.log('📖 Reading page text...');
  const fullText = await page.evaluate(() => document.body.innerText);
  
  console.log('\n📄 Page content:\n');
  console.log(fullText);
  
  console.log('\n✨ Done! Press Ctrl+C to close\n');
  await new Promise(() => {});
}

main().catch(console.error);
