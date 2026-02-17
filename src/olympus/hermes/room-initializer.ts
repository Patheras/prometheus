/**
 * Olympus - Room Initializer
 * 
 * Handles individual room initialization logic.
 * Creates new Gemini conversations, sends soul-defining prompts,
 * captures URLs, and stores room data in the database.
 */

import { Page } from 'playwright';
import { GeminiTabManager } from './gemini-tab-manager.js';
import { TimeoutManager } from './timeout-manager.js';
import { ResponseDetector } from './response-detector.js';
import { RoomDefinition } from './room-catalog.js';

/**
 * InitializationResult - Result of a room initialization attempt
 */
export interface InitializationResult {
  category: string;
  success: boolean;
  url?: string;
  error?: string;
  duration: number;
}

/**
 * RoomInitializer - Handles individual room initialization
 */
export class RoomInitializer {
  constructor(
    private tabManager: GeminiTabManager,
    private timeoutManager: TimeoutManager,
    private responseDetector: ResponseDetector,
    private page: Page
  ) {}

  /**
   * Initialize a single room
   * 
   * @param room - Room definition with category, soul prompt, and timeout
   * @returns InitializationResult with success status, URL, and duration
   */
  async initializeRoom(room: RoomDefinition): Promise<InitializationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n🏛️  Initializing ${room.category}...`);
      
      // Special case: Olympus Prime preservation
      if (room.category === 'Olympus Prime') {
        const currentUrl = this.page.url();
        if (await this.verifyRoomUrl(currentUrl)) {
          console.log(`✅ Olympus Prime already exists at: ${currentUrl}`);
          await this.storeRoomInDatabase(room.category, currentUrl);
          const duration = Date.now() - startTime;
          return {
            category: room.category,
            success: true,
            url: currentUrl,
            duration,
          };
        }
      }

      // Create new Gemini conversation
      console.log('📍 Creating new conversation...');
      await this.page.goto('https://gemini.google.com/app', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await this.page.waitForTimeout(2000);

      // Get timeout for this room type
      const timeout = this.timeoutManager.getTimeout(room.type, room.capability);

      // Send soul-defining prompt
      console.log('💬 Sending soul prompt...');
      await this.sendSoulPrompt(room.soulPrompt);

      // Wait for response completion
      console.log('⏳ Waiting for response...');
      const responseStatus = await this.responseDetector.waitForCompletion(this.page, timeout);

      if (responseStatus.timedOut) {
        console.log('⚠️  Response timeout - proceeding with URL capture');
      }

      // Capture conversation URL
      const url = this.page.url();
      console.log(`📋 Captured URL: ${url}`);

      // Verify URL pattern
      if (!await this.verifyRoomUrl(url)) {
        throw new Error(`Invalid URL pattern: ${url}`);
      }

      // Store in database
      await this.storeRoomInDatabase(room.category, url);

      const duration = Date.now() - startTime;
      console.log(`✅ ${room.category} initialized in ${duration}ms`);

      return {
        category: room.category,
        success: true,
        url,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to initialize ${room.category}: ${errorMessage}`);

      return {
        category: room.category,
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Send soul-defining prompt to Gemini
   * 
   * @param soulPrompt - The soul-defining prompt text
   */
  private async sendSoulPrompt(soulPrompt: string): Promise<void> {
    // Find input field
    const inputField = await this.page.locator('[contenteditable][class*="textarea"]').first();
    
    if (!await inputField.isVisible()) {
      throw new Error('Input field not found or not visible');
    }

    // Click and type
    await inputField.click();
    await this.page.waitForTimeout(500);
    await inputField.fill(soulPrompt);
    
    // Send message
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Verify that a URL matches the expected Gemini conversation pattern
   * 
   * @param url - URL to verify
   * @returns True if URL matches expected pattern
   */
  async verifyRoomUrl(url: string): Promise<boolean> {
    // Expected pattern: https://gemini.google.com/app/*
    const pattern = /^https:\/\/gemini\.google\.com\/app\/.+/;
    return pattern.test(url);
  }

  /**
   * Store room data in the database
   * 
   * @param category - Room category
   * @param url - Conversation URL
   */
  private async storeRoomInDatabase(category: string, url: string): Promise<void> {
    // Generate unique tab ID using category kebab-case
    const tabId = `tab-${category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and')}`;
    
    // Check if tab already exists
    const existingTab = this.tabManager.getTab(category);
    
    if (existingTab) {
      // Update existing record
      console.log(`📝 Updating existing tab: ${category}`);
      this.tabManager.updateTabMetadata(existingTab.id, {
        url,
        lastUsed: new Date(),
        status: 'active',
      });
    } else {
      // This shouldn't happen in normal flow since tabs are pre-initialized,
      // but handle it gracefully
      console.log(`📝 Creating new tab: ${category}`);
      // We need to insert directly into the database since the tab doesn't exist
      const db = (this.tabManager as any).db;
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, message_count, context_estimate, status, created_at, updated_at)
        VALUES ($id, $category, $url, $lastUsed, $messageCount, $contextEstimate, $status, $createdAt, $updatedAt)
        ON CONFLICT(category) DO UPDATE SET
          url = $url,
          last_used = $lastUsed,
          status = $status,
          updated_at = $updatedAt
      `).run({
        id: tabId,
        category,
        url,
        lastUsed: now,
        messageCount: 0,
        contextEstimate: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
    
    console.log(`💾 Stored ${category} in database`);
  }
}
