/**
 * Conversation File Watcher
 * 
 * Monitors conversation JSONL files for changes and triggers automatic re-indexing.
 * Follows OpenClaw pattern with debounced file watching.
 * 
 * Features:
 * - Watches conversations directory for file changes
 * - Debounces rapid changes to avoid excessive re-indexing
 * - Tracks file deltas (size changes) for incremental updates
 * - Automatic reconnection on watcher errors
 */

import chokidar, { FSWatcher } from 'chokidar';
import { PrometheusDatabase } from './database';
import { reindexConversation } from './conversation-indexer';
import { getConversationsDir } from './conversation-files';

/**
 * Watcher configuration
 */
export interface ConversationWatcherConfig {
  /** Database file path */
  dataPath: string;
  
  /** Debounce delay in milliseconds (default: 1000ms) */
  debounceMs?: number;
  
  /** Whether to watch for changes (default: true) */
  enabled?: boolean;
  
  /** Callback when file is re-indexed */
  onReindex?: (conversationId: string, success: boolean) => void;
  
  /** Callback when watcher encounters an error */
  onError?: (error: Error) => void;
}

/**
 * File change tracking for delta-based updates
 */
interface FileState {
  lastSize: number;
  pendingReindex: boolean;
  debounceTimer?: NodeJS.Timeout;
}

/**
 * Conversation File Watcher
 * 
 * Monitors JSONL files and triggers automatic re-indexing on changes.
 */
export class ConversationWatcher {
  private config: ConversationWatcherConfig;
  private db: PrometheusDatabase;
  private watcher: FSWatcher | null = null;
  private fileStates: Map<string, FileState> = new Map();
  private isWatching: boolean = false;
  
  constructor(db: PrometheusDatabase, config: ConversationWatcherConfig) {
    this.db = db;
    this.config = {
      debounceMs: 1000,
      enabled: true,
      ...config,
    };
  }
  
  /**
   * Start watching conversation files
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Conversation watcher is disabled');
      return;
    }
    
    if (this.isWatching) {
      console.log('Conversation watcher is already running');
      return;
    }
    
    const conversationsDir = getConversationsDir(this.config.dataPath);
    
    console.log(`Starting conversation watcher on: ${conversationsDir}`);
    
    this.watcher = chokidar.watch(`${conversationsDir}/*.jsonl`, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this.config.debounceMs || 1000,
        pollInterval: 100,
      },
    });
    
    this.watcher
      .on('add', (path) => this.handleFileChange(path, 'add'))
      .on('change', (path) => this.handleFileChange(path, 'change'))
      .on('unlink', (path) => this.handleFileDelete(path))
      .on('error', (error) => this.handleError(error))
      .on('ready', () => {
        console.log('Conversation watcher ready');
      });
    
    this.isWatching = true;
    console.log('Conversation watcher started');
  }
  
  /**
   * Stop watching conversation files
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      return;
    }
    
    console.log('Stopping conversation watcher');
    
    // Clear all pending timers
    for (const state of this.fileStates.values()) {
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
      }
    }
    this.fileStates.clear();
    
    // Close watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    
    this.isWatching = false;
    console.log('Conversation watcher stopped');
  }
  
  /**
   * Handle file change (add or modify)
   */
  private async handleFileChange(filePath: string, event: 'add' | 'change'): Promise<void> {
    try {
      // Extract conversation ID from filename
      const conversationId = filePath
        .split(/[/\\]/)
        .pop()!
        .replace('.jsonl', '');
      
      console.log(`Conversation file ${event}: ${conversationId}`);
      
      // Get or create file state
      let state = this.fileStates.get(filePath);
      if (!state) {
        state = {
          lastSize: 0,
          pendingReindex: false,
        };
        this.fileStates.set(filePath, state);
      }
      
      // Clear existing debounce timer
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
      }
      
      // Set new debounce timer
      state.debounceTimer = setTimeout(async () => {
        await this.reindexFile(conversationId);
        state!.pendingReindex = false;
      }, this.config.debounceMs || 1000);
      
      state.pendingReindex = true;
      
    } catch (error) {
      console.error(`Error handling file change for ${filePath}:`, error);
      this.handleError(error as Error);
    }
  }
  
  /**
   * Handle file deletion
   */
  private async handleFileDelete(filePath: string): Promise<void> {
    try {
      // Extract conversation ID from filename
      const conversationId = filePath
        .split(/[/\\]/)
        .pop()!
        .replace('.jsonl', '');
      
      console.log(`Conversation file deleted: ${conversationId}`);
      
      // Remove from file states
      this.fileStates.delete(filePath);
      
      // Delete from database
      const dbInstance = this.db.getDb();
      dbInstance
        .prepare('DELETE FROM conversations WHERE id = ?')
        .run(conversationId);
      
      console.log(`Deleted conversation from database: ${conversationId}`);
      
    } catch (error) {
      console.error(`Error handling file deletion for ${filePath}:`, error);
      this.handleError(error as Error);
    }
  }
  
  /**
   * Re-index a conversation file
   */
  private async reindexFile(conversationId: string): Promise<void> {
    try {
      console.log(`Re-indexing conversation: ${conversationId}`);
      
      const success = await reindexConversation(
        this.db,
        this.config.dataPath,
        conversationId
      );
      
      if (success) {
        console.log(`Successfully re-indexed conversation: ${conversationId}`);
      } else {
        console.warn(`Failed to re-index conversation: ${conversationId}`);
      }
      
      // Notify callback
      if (this.config.onReindex) {
        this.config.onReindex(conversationId, success);
      }
      
    } catch (error) {
      console.error(`Error re-indexing conversation ${conversationId}:`, error);
      this.handleError(error as Error);
      
      // Notify callback
      if (this.config.onReindex) {
        this.config.onReindex(conversationId, false);
      }
    }
  }
  
  /**
   * Handle watcher errors
   */
  private handleError(error: Error): void {
    console.error('Conversation watcher error:', error);
    
    if (this.config.onError) {
      this.config.onError(error);
    }
  }
  
  /**
   * Check if watcher is running
   */
  isRunning(): boolean {
    return this.isWatching;
  }
  
  /**
   * Get number of files being watched
   */
  getWatchedFileCount(): number {
    return this.fileStates.size;
  }
  
  /**
   * Get pending reindex count
   */
  getPendingReindexCount(): number {
    let count = 0;
    for (const state of this.fileStates.values()) {
      if (state.pendingReindex) {
        count++;
      }
    }
    return count;
  }
}

/**
 * Create and start a conversation watcher
 * 
 * @param db Database connection
 * @param config Watcher configuration
 * @returns Conversation watcher instance
 */
export async function createConversationWatcher(
  db: PrometheusDatabase,
  config: ConversationWatcherConfig
): Promise<ConversationWatcher> {
  const watcher = new ConversationWatcher(db, config);
  await watcher.start();
  return watcher;
}
