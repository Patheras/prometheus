/**
 * Memory Engine - Core Interface and Implementation
 * 
 * This module provides the main MemoryEngine interface and base implementation
 * for managing multi-source memory storage with hybrid search capabilities.
 * 
 * The Memory Engine provides:
 * - Codebase memory operations (indexing, searching code)
 * - Decision memory operations (storing, retrieving decisions)
 * - Metric memory operations (storing, querying metrics)
 * - Pattern memory operations (storing, searching patterns)
 * - Unified search across all memory sources
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 4.1
 */

import { PrometheusDatabase } from './database';
import {
  CodeFile,
  Decision,
  Metric,
  MetricQuery,
  MetricResult,
  Pattern,
  PatternOutcome,
  SearchOptions,
  SearchResult,
  MemorySource,
  Conversation,
  ConversationMessage,
} from './types';
import {
  appendMessageToFile,
  deleteConversationFile,
  type JSONLMessage,
} from './conversation-files';

// ============================================================================
// Memory Engine Interface
// ============================================================================

/**
 * Main interface for the Prometheus Memory Engine
 * 
 * Provides unified access to all memory operations across different sources:
 * - Codebase: Source code indexing and semantic search
 * - Decisions: Decision history with reasoning and outcomes
 * - Metrics: Performance and usage metrics with time-series queries
 * - Patterns: Architectural patterns and best practices
 */
export interface IMemoryEngine {
  // ========== Codebase Memory Operations ==========
  
  /**
   * Index a codebase repository
   * @param repoPath Path to the repository to index
   * @returns Promise that resolves when indexing is complete
   */
  indexCodebase(repoPath: string): Promise<void>;
  
  /**
   * Search code using hybrid search (vector + keyword)
   * @param query Search query string
   * @param options Search options (limit, weights, etc.)
   * @returns Promise with array of code search results
   */
  searchCode(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  /**
   * Get metadata for a specific file
   * @param path File path
   * @returns Promise with file metadata or null if not found
   */
  getFileMetadata(path: string): Promise<CodeFile | null>;
  
  // ========== Decision Memory Operations ==========
  
  /**
   * Store a decision with context and reasoning
   * @param decision Decision object to store
   * @returns Promise with the decision ID
   */
  storeDecision(decision: Omit<Decision, 'id'>): Promise<string>;
  
  /**
   * Update a decision with outcome information
   * @param id Decision ID
   * @param outcome Outcome data
   * @param lessonsLearned Lessons learned from the decision
   * @returns Promise that resolves when update is complete
   */
  updateDecisionOutcome(
    id: string,
    outcome: string,
    lessonsLearned: string
  ): Promise<void>;
  
  /**
   * Search for similar decisions
   * @param query Search query string
   * @param options Search options with additional filters (outcome, startTime, endTime)
   * @returns Promise with array of decision results
   */
  searchDecisions(query: string, options?: SearchOptions & {
    outcome?: 'success' | 'failure' | 'null';
    startTime?: number;
    endTime?: number;
  }): Promise<Decision[]>;
  
  // ========== Metric Memory Operations ==========
  
  /**
   * Store metrics (single or batch)
   * @param metrics Array of metrics to store
   * @returns Promise that resolves when storage is complete
   */
  storeMetrics(metrics: Metric[]): Promise<void>;
  
  /**
   * Query metrics with filtering and aggregation
   * @param query Metric query parameters
   * @returns Promise with metric results and aggregations
   */
  queryMetrics(query: MetricQuery): Promise<MetricResult>;
  
  /**
   * Detect anomalies in metrics
   * @param metricType Type of metric to analyze
   * @param options Optional threshold configuration
   * @returns Promise with array of anomalous metrics
   */
  detectAnomalies(
    metricType: string,
    options?: {
      thresholdType?: 'absolute' | 'percentage' | 'std_deviation';
      thresholdValue?: number;
      baselineWindow?: number;
    }
  ): Promise<Metric[]>;
  
  // ========== Pattern Memory Operations ==========
  
  /**
   * Store a pattern
   * @param pattern Pattern object to store
   * @returns Promise with the pattern ID
   */
  storePattern(pattern: Omit<Pattern, 'id'>): Promise<string>;
  
  /**
   * Search for patterns by problem description
   * @param problem Problem description
   * @param options Search options
   * @returns Promise with array of matching patterns
   */
  searchPatterns(problem: string, options?: SearchOptions): Promise<Pattern[]>;
  
  /**
   * Update pattern outcome (success/failure)
   * @param id Pattern ID
   * @param outcome Outcome information
   * @returns Promise that resolves when update is complete
   */
  updatePatternOutcome(id: string, outcome: PatternOutcome): Promise<void>;
  
  // ========== Unified Search Operations ==========
  
  /**
   * Search across all memory sources
   * @param query Search query string
   * @param sources Optional array of sources to search (defaults to all)
   * @param options Search options
   * @returns Promise with unified search results
   */
  search(
    query: string,
    sources?: MemorySource[],
    options?: SearchOptions
  ): Promise<SearchResult[]>;
  
  // ========== Conversation Memory Operations ==========
  
  /**
   * Create a new conversation
   * @param title Optional conversation title
   * @returns Promise with the conversation ID
   */
  createConversation(title?: string): Promise<string>;
  
  /**
   * Store a message in a conversation
   * @param conversationId Conversation ID
   * @param role Message role (user, assistant, system)
   * @param content Message content
   * @param metadata Optional metadata
   * @returns Promise with the message ID
   */
  storeMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<string>;
  
  /**
   * Get conversation history
   * @param conversationId Conversation ID
   * @param limit Optional limit on number of messages
   * @returns Promise with array of messages
   */
  getConversationHistory(
    conversationId: string,
    limit?: number
  ): Promise<ConversationMessage[]>;
  
  /**
   * Search conversations
   * @param query Search query string
   * @param options Search options
   * @returns Promise with array of search results
   */
  searchConversations(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>;
  
  /**
   * Get all conversations
   * @param limit Optional limit on number of conversations
   * @returns Promise with array of conversations
   */
  getAllConversations(limit?: number): Promise<Conversation[]>;
  
  /**
   * Update conversation title
   * @param conversationId Conversation ID
   * @param title New title
   * @returns Promise that resolves when update is complete
   */
  updateConversationTitle(conversationId: string, title: string): Promise<void>;
  
  /**
   * Delete a conversation and all its messages
   * @param conversationId Conversation ID
   * @returns Promise that resolves when deletion is complete
   */
  deleteConversation(conversationId: string): Promise<void>;
  
  // ========== Database Management ==========
  
  /**
   * Execute a function within a transaction
   * @param fn Function to execute in transaction
   * @returns Result of the function
   */
  transaction<T>(fn: () => T): T;
  
  /**
   * Close the database connection
   */
  close(): void;
}

// ============================================================================
// Memory Engine Base Implementation
// ============================================================================

/**
 * Base implementation of the Memory Engine
 * 
 * This class provides the core functionality for managing memory operations
 * across different sources. It handles database connections, transactions,
 * and provides the foundation for all memory operations.
 */
export class MemoryEngine implements IMemoryEngine {
  private db: PrometheusDatabase;
  private dbPath: string;
  
  /**
   * Create a new Memory Engine instance
   * @param db Database connection
   * @param dbPath Database file path (for locating conversation files)
   */
  constructor(db: PrometheusDatabase, dbPath?: string) {
    this.db = db;
    this.dbPath = dbPath || './data/prometheus.db';
  }
  
  // ========== Codebase Memory Operations ==========
  
  async indexCodebase(repoPath: string): Promise<void> {
    const { scanDirectory } = await import('./file-scanner');
    const { createCodeChunks } = await import('./chunker');
    const { readFileSync } = await import('fs');
    
    // Scan the repository
    console.log(`Scanning repository: ${repoPath}`);
    const scanResult = scanDirectory(repoPath);
    
    console.log(`Found ${scanResult.stats.totalFiles} files (${scanResult.stats.skippedFiles} skipped, ${scanResult.stats.errorFiles} errors)`);
    
    // Store files and chunks in database
    const dbInstance = this.db.getDb();
    
    this.transaction(() => {
      const insertFile = dbInstance.prepare(`
        INSERT OR REPLACE INTO code_files (path, repo, hash, language, size, last_modified)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const insertChunk = dbInstance.prepare(`
        INSERT OR REPLACE INTO code_chunks (id, file_path, start_line, end_line, text, hash, symbols, imports)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const file of scanResult.files) {
        // Insert file metadata
        insertFile.run(
          file.path,
          file.repo,
          file.hash,
          file.language,
          file.size,
          file.last_modified
        );
        
        // Read file content and create chunks
        try {
          const fullPath = require('path').join(repoPath, file.path);
          const content = readFileSync(fullPath, 'utf-8');
          const chunks = createCodeChunks(file, content);
          
          // Insert chunks
          for (const chunk of chunks) {
            insertChunk.run(
              chunk.id,
              chunk.file_path,
              chunk.start_line,
              chunk.end_line,
              chunk.text,
              chunk.hash,
              chunk.symbols,
              chunk.imports
            );
          }
        } catch (error) {
          console.error(`Error processing file ${file.path}:`, error);
        }
      }
    });
    
    console.log(`Indexed ${scanResult.files.length} files`);
    
    // Report errors if any
    if (scanResult.errors.length > 0) {
      console.warn(`Encountered ${scanResult.errors.length} errors during scanning:`);
      for (const error of scanResult.errors.slice(0, 10)) {
        console.warn(`  ${error.path}: ${error.error}`);
      }
      if (scanResult.errors.length > 10) {
        console.warn(`  ... and ${scanResult.errors.length - 10} more errors`);
      }
    }
  }
  
  async searchCode(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const { hybridSearchCode } = await import('./search');
    return hybridSearchCode(this.db, query, options);
  }
  
  async getFileMetadata(path: string): Promise<CodeFile | null> {
    const dbInstance = this.db.getDb();
    
    const result = dbInstance
      .prepare('SELECT * FROM code_files WHERE path = ?')
      .get(path) as CodeFile | undefined;
    
    return result || null;
  }
  
  // ========== Decision Memory Operations ==========
  
  /**
   * Store a decision with context, reasoning, alternatives, and chosen option
   * 
   * Requirements:
   * - 2.1: Store decision with context, reasoning, alternatives, chosen option
   * - 2.5: Link decisions to affected code components
   * 
   * @param decision Decision object (without id)
   * @returns Promise with the generated decision ID
   * @throws Error if required fields are missing
   */
  async storeDecision(decision: Omit<Decision, 'id'>): Promise<string> {
    // Validate required fields (Requirement 2.1)
    if (!decision.context || decision.context.trim() === '') {
      throw new Error('Decision context is required');
    }
    if (!decision.reasoning || decision.reasoning.trim() === '') {
      throw new Error('Decision reasoning is required');
    }
    if (!decision.alternatives || decision.alternatives.trim() === '') {
      throw new Error('Decision alternatives are required');
    }
    if (!decision.chosen_option || decision.chosen_option.trim() === '') {
      throw new Error('Decision chosen_option is required');
    }
    
    // Validate alternatives is valid JSON
    try {
      JSON.parse(decision.alternatives);
    } catch (error) {
      throw new Error('Decision alternatives must be valid JSON array');
    }
    
    // Validate affected_components is valid JSON if provided (Requirement 2.5)
    if (decision.affected_components) {
      try {
        JSON.parse(decision.affected_components);
      } catch (error) {
        throw new Error('Decision affected_components must be valid JSON array');
      }
    }
    
    const dbInstance = this.db.getDb();
    const id = this.generateId('decision');
    
    dbInstance
      .prepare(`
        INSERT INTO decisions (
          id, timestamp, context, reasoning, alternatives,
          chosen_option, outcome, lessons_learned, affected_components
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        decision.timestamp,
        decision.context,
        decision.reasoning,
        decision.alternatives,
        decision.chosen_option,
        decision.outcome || null,
        decision.lessons_learned || null,
        decision.affected_components || null
      );
    
    return id;
  }
  
  /**
   * Update a decision with outcome information
   * 
   * Requirements:
   * - 2.2: Update decision record with results and lessons learned
   * 
   * @param id Decision ID
   * @param outcome Outcome data (success/failure description)
   * @param lessonsLearned Lessons learned from the decision
   * @returns Promise that resolves when update is complete
   * @throws Error if decision not found
   */
  async updateDecisionOutcome(
    id: string,
    outcome: string,
    lessonsLearned: string
  ): Promise<void> {
    const dbInstance = this.db.getDb();
    
    // Check if decision exists
    const existing = dbInstance
      .prepare('SELECT id FROM decisions WHERE id = ?')
      .get(id);
    
    if (!existing) {
      throw new Error(`Decision not found: ${id}`);
    }
    
    dbInstance
      .prepare(`
        UPDATE decisions
        SET outcome = ?, lessons_learned = ?
        WHERE id = ?
      `)
      .run(outcome, lessonsLearned, id);
  }
  
  /**
   * Search for decisions by query with filtering
   * 
   * Requirements:
   * - 2.3: Return relevant past decisions with their outcomes
   * - 2.4: Support querying by decision type, outcome, and time period
   * 
   * @param query Search query string (searches context, reasoning, alternatives)
   * @param options Search options including filters
   * @returns Promise with array of matching decisions
   */
  async searchDecisions(query: string, options?: SearchOptions & {
    outcome?: 'success' | 'failure' | 'null';
    startTime?: number;
    endTime?: number;
  }): Promise<Decision[]> {
    const dbInstance = this.db.getDb();
    
    // Build SQL query with filters
    let sql = `
      SELECT * FROM decisions
      WHERE 1=1
    `;
    const params: any[] = [];
    
    // Text search across context, reasoning, and alternatives (Requirement 2.3)
    if (query && query.trim() !== '') {
      sql += ` AND (
        context LIKE ? OR
        reasoning LIKE ? OR
        alternatives LIKE ? OR
        chosen_option LIKE ?
      )`;
      const searchPattern = `%${query}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    // Filter by outcome (Requirement 2.4)
    if (options?.outcome) {
      if (options.outcome === 'null') {
        sql += ` AND outcome IS NULL`;
      } else if (options.outcome === 'success') {
        sql += ` AND outcome IS NOT NULL AND outcome LIKE ?`;
        params.push('%"success":true%');
      } else if (options.outcome === 'failure') {
        sql += ` AND outcome IS NOT NULL AND outcome LIKE ?`;
        params.push('%"success":false%');
      }
    }
    
    // Filter by time period (Requirement 2.4)
    if (options?.startTime) {
      sql += ` AND timestamp >= ?`;
      params.push(options.startTime);
    }
    if (options?.endTime) {
      sql += ` AND timestamp <= ?`;
      params.push(options.endTime);
    }
    
    // Sort by timestamp (most recent first) or relevance
    sql += ` ORDER BY timestamp DESC`;
    
    // Apply limit
    const limit = options?.limit || 50;
    sql += ` LIMIT ?`;
    params.push(limit);
    
    // Execute query
    const results = dbInstance.prepare(sql).all(...params) as Decision[];
    
    return results;
  }
  
  // ========== Metric Memory Operations ==========
  
  /**
   * Store metrics (single or batch)
   * 
   * Requirements:
   * - 3.1: Store metrics with timestamps and context
   * 
   * This method supports batch insertion of multiple metrics efficiently
   * using a database transaction. All metrics are validated before storage.
   * 
   * @param metrics Array of metrics to store
   * @returns Promise that resolves when storage is complete
   * @throws Error if validation fails for any metric
   */
  async storeMetrics(metrics: Metric[]): Promise<void> {
    // Validate input
    if (!Array.isArray(metrics)) {
      throw new Error('Metrics must be an array');
    }
    
    if (metrics.length === 0) {
      return; // Nothing to store
    }
    
    // Validate each metric (Requirement 3.1)
    for (let i = 0; i < metrics.length; i++) {
      const metric = metrics[i];
      
      // Validate required fields
      if (!metric.id || typeof metric.id !== 'string' || metric.id.trim() === '') {
        throw new Error(`Metric at index ${i}: id is required and must be a non-empty string`);
      }
      
      if (!metric.timestamp || typeof metric.timestamp !== 'number') {
        throw new Error(`Metric at index ${i}: timestamp is required and must be a number`);
      }
      
      if (!metric.metric_type || typeof metric.metric_type !== 'string' || metric.metric_type.trim() === '') {
        throw new Error(`Metric at index ${i}: metric_type is required and must be a non-empty string`);
      }
      
      if (!metric.metric_name || typeof metric.metric_name !== 'string' || metric.metric_name.trim() === '') {
        throw new Error(`Metric at index ${i}: metric_name is required and must be a non-empty string`);
      }
      
      if (typeof metric.value !== 'number') {
        throw new Error(`Metric at index ${i}: value is required and must be a number`);
      }
      
      // Validate context is valid JSON if provided
      if (metric.context !== null && metric.context !== undefined) {
        if (typeof metric.context !== 'string') {
          throw new Error(`Metric at index ${i}: context must be a string (JSON)`);
        }
        try {
          JSON.parse(metric.context);
        } catch (error) {
          throw new Error(`Metric at index ${i}: context must be valid JSON`);
        }
      }
    }
    
    const dbInstance = this.db.getDb();
    
    // Prepare statement for batch insertion
    const stmt = dbInstance.prepare(`
      INSERT INTO metrics (id, timestamp, metric_type, metric_name, value, context)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    // Use transaction for efficient batch insertion (Requirement 3.1)
    this.transaction(() => {
      for (const metric of metrics) {
        stmt.run(
          metric.id,
          metric.timestamp,
          metric.metric_type,
          metric.metric_name,
          metric.value,
          metric.context || null
        );
      }
    });
  }
  
  /**
   * Query metrics with filtering and aggregation
   * 
   * Requirements:
   * - 3.2: Support time-range queries and aggregations
   * 
   * Supports:
   * - Time range filtering (startTime, endTime)
   * - Metric type filtering
   * - Metric name filtering
   * - Aggregations: avg, sum, count, min, max, p50, p95, p99
   * 
   * @param query Metric query parameters
   * @returns Promise with metric results and aggregations
   */
  async queryMetrics(query: MetricQuery): Promise<MetricResult> {
    const dbInstance = this.db.getDb();
    
    // Build SQL query with filters
    let sql = `SELECT * FROM metrics WHERE 1=1`;
    const params: any[] = [];
    
    // Filter by metric type (Requirement 3.2)
    if (query.metric_type) {
      sql += ` AND metric_type = ?`;
      params.push(query.metric_type);
    }
    
    // Filter by metric name (Requirement 3.2)
    if (query.metric_name) {
      sql += ` AND metric_name = ?`;
      params.push(query.metric_name);
    }
    
    // Filter by time range (Requirement 3.2)
    if (query.start_time !== undefined) {
      sql += ` AND timestamp >= ?`;
      params.push(query.start_time);
    }
    if (query.end_time !== undefined) {
      sql += ` AND timestamp <= ?`;
      params.push(query.end_time);
    }
    
    // Sort by timestamp
    sql += ` ORDER BY timestamp ASC`;
    
    // Apply limit
    if (query.limit !== undefined) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
    }
    
    // Execute query to get metrics
    const metrics = dbInstance.prepare(sql).all(...params) as Metric[];
    
    // Calculate aggregations if we have metrics (Requirement 3.2)
    let aggregations: MetricResult['aggregations'] = undefined;
    
    if (metrics.length > 0) {
      const values = metrics.map(m => m.value);
      
      // Basic aggregations
      const sum = values.reduce((acc, val) => acc + val, 0);
      const count = values.length;
      const avg = sum / count;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      // Percentile calculations
      const sortedValues = [...values].sort((a, b) => a - b);
      const p50 = this.calculatePercentile(sortedValues, 50);
      const p95 = this.calculatePercentile(sortedValues, 95);
      const p99 = this.calculatePercentile(sortedValues, 99);
      
      aggregations = {
        avg,
        sum,
        count,
        min,
        max,
        p50,
        p95,
        p99,
      };
    }
    
    return {
      metrics,
      aggregations,
    };
  }
  
  /**
   * Calculate percentile value from sorted array
   * @param sortedValues Array of values sorted in ascending order
   * @param percentile Percentile to calculate (0-100)
   * @returns Percentile value
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) {
      return 0;
    }
    if (sortedValues.length === 1) {
      return sortedValues[0]!;
    }
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
      return sortedValues[lower]!;
    }
    
    return sortedValues[lower]! * (1 - weight) + sortedValues[upper]! * weight;
  }
  
  /**
   * Detect anomalies in metrics by comparing against thresholds
   * 
   * Requirements:
   * - 3.5: Flag metrics exceeding thresholds for analysis
   * 
   * Supports multiple threshold types:
   * - absolute: Direct value comparison (e.g., value > 1000)
   * - percentage: Percentage change from baseline (e.g., 50% increase)
   * - std_deviation: Statistical outliers (e.g., > 3 standard deviations)
   * 
   * @param metricType Type of metric to analyze
   * @param options Optional threshold configuration
   * @returns Promise with array of anomalous metrics
   */
  async detectAnomalies(
    metricType: string,
    options?: {
      thresholdType?: 'absolute' | 'percentage' | 'std_deviation';
      thresholdValue?: number;
      baselineWindow?: number; // milliseconds for baseline calculation
    }
  ): Promise<Metric[]> {
    const dbInstance = this.db.getDb();
    
    // Default options
    const thresholdType = options?.thresholdType || 'std_deviation';
    const thresholdValue = options?.thresholdValue || 3; // 3 std deviations by default
    const baselineWindow = options?.baselineWindow || 3600000; // 1 hour default
    
    // Query all metrics of the specified type
    const metrics = dbInstance
      .prepare(`
        SELECT * FROM metrics
        WHERE metric_type = ?
        ORDER BY timestamp ASC
      `)
      .all(metricType) as Metric[];
    
    if (metrics.length === 0) {
      return [];
    }
    
    const anomalies: Metric[] = [];
    
    switch (thresholdType) {
      case 'absolute':
        // Flag metrics exceeding absolute threshold
        for (const metric of metrics) {
          if (metric.value > thresholdValue) {
            anomalies.push(metric);
          }
        }
        break;
      
      case 'percentage':
        // Flag metrics with percentage change from baseline
        // Calculate baseline as average of recent metrics
        const now = Date.now();
        const baselineMetrics = metrics.filter(
          m => m.timestamp >= now - baselineWindow
        );
        
        if (baselineMetrics.length === 0) {
          // No baseline data, can't detect percentage anomalies
          break;
        }
        
        const baseline = baselineMetrics.reduce((sum, m) => sum + m.value, 0) / baselineMetrics.length;
        
        for (const metric of metrics) {
          const percentageChange = Math.abs((metric.value - baseline) / baseline) * 100;
          if (percentageChange > thresholdValue) {
            anomalies.push(metric);
          }
        }
        break;
      
      case 'std_deviation':
        // Flag metrics beyond N standard deviations from mean
        const values = metrics.map(m => m.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        // Handle case where stdDev is 0 or very small (all values are the same)
        if (stdDev === 0 || !isFinite(stdDev)) {
          // No variation in data, no anomalies can be detected
          break;
        }
        
        for (const metric of metrics) {
          const deviations = Math.abs(metric.value - mean) / stdDev;
          if (isFinite(deviations) && deviations > thresholdValue) {
            anomalies.push(metric);
          }
        }
        break;
    }
    
    return anomalies;
  }
  
  // ========== Pattern Memory Operations ==========
  
  async storePattern(pattern: Omit<Pattern, 'id'>): Promise<string> {
    const dbInstance = this.db.getDb();
    const id = this.generateId('pattern');
    
    dbInstance
      .prepare(`
        INSERT INTO patterns (
          id, name, category, problem, solution,
          example_code, applicability, success_count, failure_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        pattern.name,
        pattern.category,
        pattern.problem,
        pattern.solution,
        pattern.example_code || null,
        pattern.applicability || null,
        pattern.success_count || 0,
        pattern.failure_count || 0
      );
    
    return id;
  }
  
  async searchPatterns(_problem: string, _options?: SearchOptions): Promise<Pattern[]> {
    // TODO: Implement in task 11.2 (pattern search)
    throw new Error('Not implemented: searchPatterns');
  }
  
  async updatePatternOutcome(id: string, outcome: PatternOutcome): Promise<void> {
    const dbInstance = this.db.getDb();
    
    if (outcome.success) {
      dbInstance
        .prepare('UPDATE patterns SET success_count = success_count + 1 WHERE id = ?')
        .run(id);
    } else {
      dbInstance
        .prepare('UPDATE patterns SET failure_count = failure_count + 1 WHERE id = ?')
        .run(id);
    }
  }
  
  // ========== Unified Search Operations ==========
  
  async search(
    _query: string,
    _sources?: MemorySource[],
    _options?: SearchOptions
  ): Promise<SearchResult[]> {
    // TODO: Implement in task 8 (unified search)
    throw new Error('Not implemented: search');
  }
  
  // ========== Conversation Memory Operations ==========
  
  /**
   * Create a new conversation
   */
  async createConversation(title?: string): Promise<string> {
    const dbInstance = this.db.getDb();
    const id = this.generateId('conv');
    const now = Date.now();
    
    dbInstance
      .prepare(`
        INSERT INTO conversations (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(id, title || null, now, now);
    
    return id;
  }
  
  /**
   * Store a message in a conversation
   * 
   * Following OpenClaw pattern:
   * 1. Write to JSONL file (primary storage)
   * 2. Write to SQLite (indexed storage)
   * 
   * The JSONL file serves as the source of truth and can be
   * automatically re-indexed by the memory system.
   */
  async storeMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const dbInstance = this.db.getDb();
    
    // Validate conversation exists
    const conversation = dbInstance
      .prepare('SELECT id FROM conversations WHERE id = ?')
      .get(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const id = this.generateId('msg');
    const now = Date.now();
    
    // 1. Write to JSONL file (primary storage - OpenClaw pattern)
    const jsonlMessage: JSONLMessage = {
      role,
      content,
      timestamp: now,
      metadata,
    };
    
    try {
      await appendMessageToFile(this.dbPath, conversationId, jsonlMessage);
    } catch (error) {
      console.error('Failed to write message to JSONL file:', error);
      // Continue to SQLite write even if JSONL fails
    }
    
    // 2. Write to SQLite (indexed storage)
    dbInstance
      .prepare(`
        INSERT INTO conversation_messages (id, conversation_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        conversationId,
        role,
        content,
        now,
        metadata ? JSON.stringify(metadata) : null
      );
    
    // Update conversation updated_at
    dbInstance
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(now, conversationId);
    
    return id;
  }
  
  /**
   * Get conversation history
   */
  async getConversationHistory(
    conversationId: string,
    limit?: number
  ): Promise<ConversationMessage[]> {
    const dbInstance = this.db.getDb();
    
    let sql = `
      SELECT * FROM conversation_messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `;
    
    if (limit) {
      sql += ` LIMIT ?`;
    }
    
    const stmt = dbInstance.prepare(sql);
    const results = limit
      ? stmt.all(conversationId, limit)
      : stmt.all(conversationId);
    
    return results as ConversationMessage[];
  }
  
  /**
   * Search conversations
   * 
   * Uses FTS5 keyword search for finding relevant conversations.
   */
  async searchConversations(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const { searchConversationsKeyword } = await import('./conversation-search');
    return searchConversationsKeyword(this.db, query, options);
  }
  
  /**
   * Get all conversations
   */
  async getAllConversations(limit?: number): Promise<Conversation[]> {
    const dbInstance = this.db.getDb();
    
    let sql = `
      SELECT * FROM conversations
      ORDER BY updated_at DESC
    `;
    
    if (limit) {
      sql += ` LIMIT ?`;
    }
    
    const stmt = dbInstance.prepare(sql);
    const results = limit ? stmt.all(limit) : stmt.all();
    
    return results as Conversation[];
  }
  
  /**
   * Update conversation title
   */
  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const dbInstance = this.db.getDb();
    
    dbInstance
      .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, Date.now(), conversationId);
  }
  
  /**
   * Delete a conversation and all its messages
   * 
   * Deletes both SQLite records and JSONL file.
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const dbInstance = this.db.getDb();
    
    // Delete from SQLite (foreign key cascade will delete messages)
    dbInstance
      .prepare('DELETE FROM conversations WHERE id = ?')
      .run(conversationId);
    
    // Delete JSONL file
    try {
      await deleteConversationFile(this.dbPath, conversationId);
    } catch (error) {
      console.error('Failed to delete conversation JSONL file:', error);
      // Continue even if file deletion fails
    }
  }
  
  // ========== Database Management ==========
  
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn);
  }
  
  close(): void {
    this.db.close();
  }
  
  // ========== Helper Methods ==========
  
  /**
   * Generate a unique ID for a memory entity
   * @param prefix Prefix for the ID (e.g., 'decision', 'pattern')
   * @returns Unique ID string
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${prefix}_${timestamp}_${random}`;
  }
  
  /**
   * Get the underlying database instance
   * @returns Database instance
   */
  getDatabase(): PrometheusDatabase {
    return this.db;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Memory Engine instance
 * @param db Database connection
 * @param dbPath Optional database file path (for locating conversation files)
 * @returns Memory Engine instance
 */
export function createMemoryEngine(db: PrometheusDatabase, dbPath?: string): MemoryEngine {
  return new MemoryEngine(db, dbPath);
}
