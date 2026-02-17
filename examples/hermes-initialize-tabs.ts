/**
 * Hermes - Initialize All Tabs
 * 
 * Opens all 20 Gemini tabs and sends initial context message
 */

import { chromium } from 'playwright';
import Database from 'better-sqlite3';
import { GeminiMessenger } from '../src/olympus/hermes/gemini-messenger.js';

const TAB_CATEGORIES = [
  'Coding',
  'Design',
  'Social Media',
  'Content Creation',
  'Research',
  'SEO',
  'Video Generation',
  'Image Generation',
  'Data Analysis',
  'Marketing',
  'Documentation',
  'Testing',
  'DevOps',
  'Security',
  'Performance',
  'Architecture',
  'UI/UX',
  'API Design',
  'Database',
  'General',
];

const INITIAL_MESSAGES: Record<string, string> = {
  'Coding': 'You are my coding assistant. Help me write clean, efficient code. Focus on best practices and modern patterns.',
  'Design': 'You are my design consultant. Help me create beautiful, user-friendly designs. Focus on aesthetics and usability.',
  'Social Media': 'You are my social media strategist. Help me create engaging content for various platforms.',
  'Content Creation': 'You are my content writer. Help me create compelling articles, blogs, and copy.',
  'Research': 'You are my research assistant. Help me find information, analyze data, and draw insights.',
  'SEO': 'You are my SEO expert. Help me optimize content for search engines and improve rankings.',
  'Video Generation': 'You are my video script writer. Help me create engaging video scripts and storyboards.',
  'Image Generation': 'You are my image prompt engineer. Help me create detailed prompts for AI image generation.',
  'Data Analysis': 'You are my data analyst. Help me analyze datasets, find patterns, and visualize insights.',
  'Marketing': 'You are my marketing strategist. Help me create effective marketing campaigns and strategies.',
  'Documentation': 'You are my technical writer. Help me create clear, comprehensive documentation.',
  'Testing': 'You are my QA engineer. Help me design test cases and ensure software quality.',
  'DevOps': 'You are my DevOps engineer. Help me with CI/CD, deployment, and infrastructure.',
  'Security': 'You are my security expert. Help me identify vulnerabilities and implement security best practices.',
  'Performance': 'You are my performance engineer. Help me optimize code and system performance.',
  'Architecture': 'You are my system architect. Help me design scalable, maintainable systems.',
  'UI/UX': 'You are my UX designer. Help me create intuitive, delightful user experiences.',
  'API Design': 'You are my API architect. Help me design clean, RESTful APIs.',
  'Database': 'You are my database expert. Help me design efficient database schemas and queries.',
  'General': 'You are my general assistant. Help me with various tasks and questions.',
};

async function main() {
  console.log('🏛️  Hermes - Initialize All Tabs');
  console.log('='.repeat(60));
  
  const db = new Database('./data/prometheus.db');
  
  console.log('🌐 Launching browser with persistent profile...');
  const context = await chromium.launchPersistentContext('./browser-data/olympus-hermes', {
    headless: false,
    viewport: { width: 1280, height: 720 },
  });
  
  const page = context.pages()[0] || await context.newPage();
  
  console.log('📍 Opening Gemini...');
  await page.goto('https://gemini.google.com/app', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  
  await page.waitForTimeout(2000);
  
  const isLoggedIn = await page.locator('[contenteditable][class*="textarea"]').count() > 0;
  
  if (!isLoggedIn) {
    console.log('\n⚠️  PLEASE LOGIN TO GEMINI MANUALLY');
    console.log('⚠️  After login, press Enter to continue...\n');
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });
  } else {
    console.log('✅ Already logged in!');
  }
  
  try {
    const hermes = new GeminiMessenger(db, page);
    await hermes.initialize();
    
    console.log('\n🚀 Initializing all tabs...\n');
    
    for (let i = 0; i < TAB_CATEGORIES.length; i++) {
      const category = TAB_CATEGORIES[i];
      const message = INITIAL_MESSAGES[category];
      
      console.log(`\n[${ i + 1}/20] 📂 ${category}`);
      console.log('='.repeat(60));
      
      try {
        const response = await hermes.sendToGemini(category, message);
        console.log(`✅ Response: ${response.substring(0, 100)}...`);
        
        // Small delay between tabs
        await page.waitForTimeout(2000);
        
      } catch (error) {
        console.error(`❌ Failed to initialize ${category}:`, error);
      }
    }
    
    console.log('\n\n🎉 All tabs initialized!');
    console.log('='.repeat(60));
    
    const metrics = hermes.getMetrics();
    console.log('\n📊 Final Metrics:');
    console.log(`   Messages sent: ${metrics.messagesSent}`);
    console.log(`   Responses received: ${metrics.responsesReceived}`);
    console.log(`   Average response time: ${metrics.averageResponseTime}ms`);
    console.log(`   Errors: ${metrics.errors}`);
    
    console.log('\n✅ Olympus system ready!');
    console.log('Press Ctrl+C to exit...');
    
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    db.close();
  }
}

main().catch(console.error);
