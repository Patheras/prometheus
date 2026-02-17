/**
 * Type definitions for Prometheus Memory Engine
 * 
 * These types define the data structures used throughout the memory system
 * for codebase indexing, decision tracking, metrics, and patterns.
 */

// ============================================================================
// Database Configuration Types
// ============================================================================

export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
  verbose?: boolean;
}

// ============================================================================
// Codebase Memory Types
// ============================================================================

export interface CodeFile {
  path: string;
  repo: string;
  hash: string;
  language: string | null;
  size: number;
  last_modified: number;
}

export interface CodeChunk {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  text: string;
  hash: string;
  symbols: string | null; // JSON array of symbols
  imports: string | null; // JSON array of imports
}

export interface CodeChunkWithEmbedding extends CodeChunk {
  embedding: number[];
}

// ============================================================================
// Decision Memory Types
// ============================================================================

export interface Decision {
  id: string;
  timestamp: number;
  context: string;
  reasoning: string;
  alternatives: string; // JSON array
  chosen_option: string;
  outcome: string | null;
  lessons_learned: string | null;
  affected_components: string | null; // JSON array
}

export interface DecisionAlternative {
  option: string;
  pros: string[];
  cons: string[];
  estimated_effort: string;
}

export interface DecisionOutcome {
  success: boolean;
  actual_effort: string;
  unexpected_issues: string[];
  lessons: string[];
}

// ============================================================================
// Metric Memory Types
// ============================================================================

export interface Metric {
  id: string;
  timestamp: number;
  metric_type: string;
  metric_name: string;
  value: number;
  context: string | null; // JSON object
}

export interface MetricContext {
  endpoint?: string;
  operation?: string;
  user_id?: string;
  session_id?: string;
  [key: string]: unknown;
}

export interface MetricQuery {
  metric_type?: string;
  metric_name?: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
}

export interface MetricResult {
  metrics: Metric[];
  aggregations?: {
    avg?: number;
    sum?: number;
    count?: number;
    min?: number;
    max?: number;
    p50?: number;
    p95?: number;
    p99?: number;
  };
}

// ============================================================================
// Pattern Memory Types
// ============================================================================

export interface Pattern {
  id: string;
  name: string;
  category: string;
  problem: string;
  solution: string;
  example_code: string | null;
  applicability: string | null;
  success_count: number;
  failure_count: number;
}

export interface PatternOutcome {
  success: boolean;
  context: string;
  notes: string;
}

// ============================================================================
// Embedding Cache Types
// ============================================================================

export interface EmbeddingCacheEntry {
  provider: string;
  model: string;
  hash: string;
  embedding: string; // JSON array
  dims: number;
  updated_at: number;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  keywordWeight?: number;
  vectorWeight?: number;
  sources?: MemorySource[];
}

export interface SearchResult {
  id: string;
  source: MemorySource;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
}

export type MemorySource = 'code' | 'decisions' | 'metrics' | 'patterns' | 'conversations';

// ============================================================================
// Migration Types
// ============================================================================

export interface Migration {
  name: string;
  up: (db: any) => void;
  down?: (db: any) => void;
}

export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: number;
}

// ============================================================================
// Conversation Memory Types
// ============================================================================

export interface Conversation {
  id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata: string | null; // JSON object
  tool_calls?: string | null; // JSON array of tool calls
  tool_results?: string | null; // JSON array of tool results
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  result: any;
  success: boolean;
  executionTime: number;
}

export interface ConversationMessageMetadata {
  model?: string;
  provider?: string;
  tokens?: number;
  [key: string]: unknown;
}
