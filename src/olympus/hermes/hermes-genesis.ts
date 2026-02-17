/**
 * Olympus - Hermes Genesis
 * 
 * Main orchestration script for initializing all 20 specialized Gemini rooms.
 * Handles browser setup, component initialization, sequential room processing,
 * Olympus Prime preservation, error handling, and summary reporting.
 */

import { chromium, BrowserContext, Page } from 'playwright';
import Database from 'better-sqlite3';
import { GeminiTabManager } from './gemini-tab-manager.js';
import { TimeoutManager } from './timeout-manager.js';
import { ResponseDetector } from './response-detector.js';
import { RoomInitializer, InitializationResult } from './room-initializer.js';
import { ROOM_CATALOG, getAllRooms, TIMEOUT_CONFIG } from './room-catalog.js';

/**
 * GenesisConfig - Configuration for Genesis initialization
 */
export interface GenesisConfig {
  databasePath: string;
  browserProfilePath: string;
  headless?: boolean;
}

/**
 * GenesisSummary - Summary of Genesis execution
 */
export interface GenesisSummary {
  totalRooms: number;
  successful: number;
  failed: number;
  results: InitializationResult[];
  duration: number;
}

/**
 * Run Genesis - Initialize all 20 specialized Gemini rooms
 * 
 * @param config - Genesis configuration
 * @returns GenesisSummary with results
 */
export async function runGenesis(config: GenesisConfig): Promise<GenesisSummary> {
  const startTime = Date.now();
  
  console.log('🏛️  OLYMPUS GENESIS - Initializing 20 Specialized Rooms');
  console.log('='.repeat(70));
  console.log();
  
  // Initialize database
  console.log('💾 Opening database...');
  const db = new Database(config.databasePath);
  
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Initialize browser context
    console.log('🌐 Launching browser with persistent profile...');
    context = await chromium.launchPersistentContext(config.browserProfilePath, {
      headless: config.headless ?? false,
      viewport: { width: 1280, height: 720 },
    });
    
    page = context.pages()[0] || await context.newPage();
    
    // Navigate to Gemini
    console.log('📍 Navigating to Gemini...');
    await page.goto('https://gemini.google.com/app', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    await page.waitForTimeout(2000);
    
    // Verify login status
    const isLoggedIn = await page.locator('[contenteditable][class*="textarea"]').count() > 0;
    
    if (!isLoggedIn) {
      console.log();
      console.log('⚠️  PLEASE LOGIN TO GEMINI MANUALLY');
      console.log('⚠️  After login, press Enter to continue...');
      console.log();
      await waitForUserInput();
    } else {
      console.log('✅ Already logged in!');
    }
    
    console.log();
    console.log('🔧 Initializing components...');
    
    // Initialize components
    const tabManager = new GeminiTabManager(db);
    await tabManager.initialize();
    
    const timeoutManager = new TimeoutManager(TIMEOUT_CONFIG);
    const responseDetector = new ResponseDetector();
    const roomInitializer = new RoomInitializer(
      tabManager,
      timeoutManager,
      responseDetector,
      page
    );
    
    console.log('✅ Components initialized');
    console.log();
    
    // Load room catalog
    const allRooms = getAllRooms();
    console.log(`📚 Loaded ${allRooms.length} room definitions`);
    console.log(`   - Forge rooms: ${ROOM_CATALOG.forgeRooms.length}`);
    console.log(`   - Mind rooms: ${ROOM_CATALOG.mindRooms.length}`);
    console.log();
    
    // Initialize results tracking
    const results: InitializationResult[] = [];
    
    // Process all rooms sequentially
    console.log('🚀 Starting sequential room initialization...');
    console.log('='.repeat(70));
    
    for (let i = 0; i < allRooms.length; i++) {
      const room = allRooms[i];
      if (!room) continue; // Skip if room is undefined
      
      const roomNumber = i + 1;
      
      console.log();
      console.log(`[${roomNumber}/20] ${room.category}`);
      console.log('-'.repeat(70));
      
      try {
        // Initialize room
        const result = await roomInitializer.initializeRoom(room);
        results.push(result);
        
        // Log result
        if (result.success) {
          console.log(`✅ Success (${result.duration}ms)`);
        } else {
          console.log(`❌ Failed: ${result.error}`);
        }
        
        // Small delay between rooms
        if (i < allRooms.length - 1) {
          await page.waitForTimeout(1000);
        }
        
      } catch (error) {
        // Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Unexpected error: ${errorMessage}`);
        
        results.push({
          category: room.category,
          success: false,
          error: errorMessage,
          duration: 0,
        });
      }
    }
    
    // Generate summary
    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    const summary: GenesisSummary = {
      totalRooms: allRooms.length,
      successful,
      failed,
      results,
      duration,
    };
    
    // Display summary report
    console.log();
    console.log('='.repeat(70));
    console.log('📊 GENESIS SUMMARY');
    console.log('='.repeat(70));
    console.log();
    console.log(`Total rooms:        ${summary.totalRooms}`);
    console.log(`✅ Successful:      ${summary.successful}`);
    console.log(`❌ Failed:          ${summary.failed}`);
    console.log(`⏱️  Total duration:  ${(summary.duration / 1000).toFixed(2)}s`);
    console.log();
    
    // Display failed rooms if any
    if (failed > 0) {
      console.log('❌ Failed Rooms:');
      for (const result of results.filter(r => !r.success)) {
        console.log(`   - ${result.category}: ${result.error}`);
      }
      console.log();
    }
    
    // Display successful rooms
    console.log('✅ Successful Rooms:');
    for (const result of results.filter(r => r.success)) {
      console.log(`   - ${result.category}`);
    }
    console.log();
    
    console.log('='.repeat(70));
    console.log('🎉 GENESIS COMPLETE');
    console.log('='.repeat(70));
    console.log();
    console.log('Browser will remain open for inspection.');
    console.log('Press Ctrl+C to exit.');
    console.log();
    
    return summary;
    
  } catch (error) {
    console.error();
    console.error('❌ FATAL ERROR:', error);
    throw error;
    
  } finally {
    // Close database
    db.close();
    console.log('💾 Database closed');
    
    // Note: Browser context is kept open for manual inspection
    // User can close it manually or press Ctrl+C
  }
}

/**
 * Wait for user input (Enter key)
 */
async function waitForUserInput(): Promise<void> {
  return new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });
}

/**
 * Main entry point when run directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const config: GenesisConfig = {
    databasePath: './data/prometheus.db',
    browserProfilePath: './browser-data/olympus-hermes',
    headless: false,
  };
  
  runGenesis(config)
    .then(() => {
      // Keep process alive for browser inspection
      return new Promise(() => {});
    })
    .catch((error) => {
      console.error('Genesis failed:', error);
      process.exit(1);
    });
}
