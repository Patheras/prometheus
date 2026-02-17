/**
 * Olympus - Gemini Tab Manager
 * 
 * Manages 20 Gemini tabs as "living databases"
 * Each tab maintains 1M context for a specific category
 */

import { Database } from 'better-sqlite3';
import { GeminiTab, TabHealth } from './types.js';
import { DEFAULT_HERMES_CONFIG } from './config.js';

export class GeminiTabManager {
  private tabs: Map<string, GeminiTab> = new Map();
  private db: Database;
  
  constructor(database: Database) {
    this.db = database;
  }
  
  /**
   * Initialize tabs from database
   */
  async initialize(): Promise<void> {
    console.log('🏛️  Hermes: Initializing tab manager...');
    
    // Load tabs from database
    const rows = this.db.prepare(`
      SELECT * FROM gemini_tabs ORDER BY category
    `).all() as any[];
    
    for (const row of rows) {
      const tab: GeminiTab = {
        id: row.id,
        category: row.category,
        url: row.url || '',
        lastUsed: new Date(row.last_used),
        messageCount: row.message_count,
        contextEstimate: row.context_estimate,
        gemId: row.gem_id,
        conversationHistory: [],
        status: row.status as 'active' | 'idle' | 'error',
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
      
      this.tabs.set(tab.category, tab);
    }
    
    console.log(`✅ Loaded ${this.tabs.size} tabs`);
    
    // Initialize missing tabs
    await this.initializeTabs();
  }
  
  /**
   * Initialize 20 category tabs (create if not exist)
   */
  async initializeTabs(): Promise<void> {
    const categories = DEFAULT_HERMES_CONFIG.tabs.categories;
    
    for (const category of categories) {
      // Check if tab exists
      if (this.tabs.has(category)) {
        continue;
      }
      
      // Create new tab
      const tabId = `tab-${category.toLowerCase().replace(/\s+/g, '-')}`;
      const now = new Date();
      
      const tab: GeminiTab = {
        id: tabId,
        category,
        url: '',  // Will be set when first used
        lastUsed: now,
        messageCount: 0,
        contextEstimate: 0,
        conversationHistory: [],
        status: 'idle',
        createdAt: now,
        updatedAt: now,
      };
      
      // Insert into database
      this.db.prepare(`
        INSERT INTO gemini_tabs (id, category, url, last_used, message_count, context_estimate, status, created_at, updated_at)
        VALUES ($id, $category, $url, $lastUsed, $messageCount, $contextEstimate, $status, $createdAt, $updatedAt)
      `).run({
        id: tab.id,
        category: tab.category,
        url: tab.url,
        lastUsed: tab.lastUsed.toISOString(),
        messageCount: tab.messageCount,
        contextEstimate: tab.contextEstimate,
        status: tab.status,
        createdAt: tab.createdAt.toISOString(),
        updatedAt: tab.updatedAt.toISOString(),
      });
      
      // Add to memory
      this.tabs.set(category, tab);
      
      console.log(`✅ Created tab: ${category} (${tabId})`);
    }
    
    console.log(`🎯 Total tabs: ${this.tabs.size}/${categories.length}`);
  }
  
  /**
   * Get tab by category
   */
  getTab(category: string): GeminiTab | undefined {
    return this.tabs.get(category);
  }
  
  /**
   * List all tabs
   */
  listTabs(): GeminiTab[] {
    return Array.from(this.tabs.values());
  }
  
  /**
   * Update tab metadata
   */
  updateTabMetadata(tabId: string, metadata: Partial<GeminiTab>): void {
    // Find tab by ID
    const tab = Array.from(this.tabs.values()).find(t => t.id === tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }
    
    // Update in memory
    Object.assign(tab, metadata);
    tab.updatedAt = new Date();
    
    // Update in database
    const updates: string[] = [];
    const params: any = { id: tabId };
    
    if (metadata.url !== undefined) {
      updates.push('url = $url');
      params.url = metadata.url;
    }
    if (metadata.lastUsed !== undefined) {
      updates.push('last_used = $lastUsed');
      params.lastUsed = metadata.lastUsed.toISOString();
    }
    if (metadata.messageCount !== undefined) {
      updates.push('message_count = $messageCount');
      params.messageCount = metadata.messageCount;
    }
    if (metadata.contextEstimate !== undefined) {
      updates.push('context_estimate = $contextEstimate');
      params.contextEstimate = metadata.contextEstimate;
    }
    if (metadata.gemId !== undefined) {
      updates.push('gem_id = $gemId');
      params.gemId = metadata.gemId;
    }
    if (metadata.status !== undefined) {
      updates.push('status = $status');
      params.status = metadata.status;
    }
    
    if (updates.length > 0) {
      const sql = `UPDATE gemini_tabs SET ${updates.join(', ')} WHERE id = $id`;
      this.db.prepare(sql).run(params);
    }
  }
  
  /**
   * Get tab health
   */
  getTabHealth(tabId: string): TabHealth {
    const tab = Array.from(this.tabs.values()).find(t => t.id === tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }
    
    const contextUsage = tab.contextEstimate / DEFAULT_HERMES_CONFIG.context.maxTokensPerTab;
    const issues: string[] = [];
    
    // Check for issues
    if (contextUsage > 0.9) {
      issues.push('Context near limit (>90%)');
    }
    if (tab.status === 'error') {
      issues.push('Tab in error state');
    }
    const daysSinceUsed = (Date.now() - tab.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUsed > 7) {
      issues.push(`Unused for ${Math.floor(daysSinceUsed)} days`);
    }
    
    // Determine status
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (issues.length > 0) {
      status = tab.status === 'error' ? 'error' : 'warning';
    }
    
    return {
      tabId: tab.id,
      category: tab.category,
      status,
      lastUsed: tab.lastUsed,
      messageCount: tab.messageCount,
      contextUsage,
      issues,
    };
  }
  
  /**
   * Get all tab health
   */
  getAllTabHealth(): TabHealth[] {
    return Array.from(this.tabs.values()).map(tab => this.getTabHealth(tab.id));
  }
  
  /**
   * Mark tab as used
   */
  markTabUsed(category: string): void {
    const tab = this.tabs.get(category);
    if (!tab) {
      throw new Error(`Tab ${category} not found`);
    }
    
    this.updateTabMetadata(tab.id, {
      lastUsed: new Date(),
      status: 'active',
    });
  }
  
  /**
   * Increment message count
   */
  incrementMessageCount(category: string): void {
    const tab = this.tabs.get(category);
    if (!tab) {
      throw new Error(`Tab ${category} not found`);
    }
    
    this.updateTabMetadata(tab.id, {
      messageCount: tab.messageCount + 1,
    });
  }
  
  /**
   * Update context estimate
   */
  updateContextEstimate(category: string, tokens: number): void {
    const tab = this.tabs.get(category);
    if (!tab) {
      throw new Error(`Tab ${category} not found`);
    }
    
    this.updateTabMetadata(tab.id, {
      contextEstimate: tab.contextEstimate + tokens,
    });
  }
  
  /**
   * Reset tab context (for rotation)
   */
  resetTabContext(category: string): void {
    const tab = this.tabs.get(category);
    if (!tab) {
      throw new Error(`Tab ${category} not found`);
    }
    
    this.updateTabMetadata(tab.id, {
      contextEstimate: 0,
      messageCount: 0,
    });
    
    // Clear conversation history
    this.db.prepare(`
      DELETE FROM gemini_messages WHERE tab_id = ?
    `).run(tab.id);
  }
  
  /**
   * Get room URL by category
   * Returns null if room doesn't exist or has no URL
   */
  getRoomUrl(category: string): string | null {
    const tab = this.tabs.get(category);
    if (!tab || !tab.url) {
      return null;
    }
    return tab.url;
  }
  
  /**
   * Navigate to room by category
   * Returns the URL to navigate to, or null if room doesn't exist
   */
  async navigateToRoom(category: string): Promise<string | null> {
    const url = this.getRoomUrl(category);
    if (!url) {
      console.log(`⚠️  Room "${category}" not found or has no URL`);
      return null;
    }
    
    console.log(`🚀 Navigating to room: ${category}`);
    return url;
  }
}
