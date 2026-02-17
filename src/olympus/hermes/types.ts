/**
 * Olympus - Hermes Types
 * 
 * Type definitions for Hermes (The Messenger)
 */

/**
 * Gemini Tab - Represents a Gemini conversation tab
 */
export interface GeminiTab {
  id: string;                    // "tab-coding"
  category: string;              // "Coding"
  url: string;                   // "https://gemini.google.com/app/..."
  lastUsed: Date;
  messageCount: number;
  contextEstimate: number;       // Estimated tokens used
  gemId?: string;                // Associated Gem ID
  conversationHistory: GeminiMessage[];
  status: 'active' | 'idle' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Gemini Message - A message in a conversation
 */
export interface GeminiMessage {
  id: string;
  tabId: string;
  role: 'user' | 'model';
  content: string;
  tokensEstimate?: number;
  timestamp: Date;
}

/**
 * Parsed Response - Structured Gemini response
 */
export interface ParsedResponse {
  content: string;               // Main response text
  codeBlocks: CodeBlock[];       // Extracted code
  images: string[];              // Image URLs
  links: string[];               // Links
  thinking?: string;             // <think> content if present
  metadata: ResponseMetadata;
}

/**
 * Code Block - Extracted code from response
 */
export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
}

/**
 * Response Metadata
 */
export interface ResponseMetadata {
  timestamp: Date;
  tokensEstimate: number;
  streamingDuration?: number;
  category: string;
}

/**
 * Gemini Gem - Persistent memory/instructions
 */
export interface GeminiGem {
  id: string;
  name: string;
  instructions: string;
  knowledge: string[];           // Persistent facts
  createdAt: Date;
  associatedTabs: string[];
}

/**
 * Element Ref - OpenClaw-style element reference
 */
export interface ElementRef {
  id: string;                    // e12
  role: string;                  // button, textbox, link
  name: string;                  // Accessible name
  selector: string;              // CSS selector (fallback)
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Snapshot - Accessibility tree snapshot
 */
export interface Snapshot {
  refs: Map<string, ElementRef>;
  tree: string;                  // Formatted tree
  timestamp: Date;
  url: string;
}

/**
 * Tab Health - Health status of a tab
 */
export interface TabHealth {
  tabId: string;
  category: string;
  status: 'healthy' | 'warning' | 'error';
  lastUsed: Date;
  messageCount: number;
  contextUsage: number;          // 0-1 (percentage)
  issues: string[];
}

/**
 * Hermes Metrics - Performance metrics
 */
export interface HermesMetrics {
  messagesSent: number;
  responsesReceived: number;
  averageResponseTime: number;
  errors: number;
  tabSwitches: number;
  gemsCreated: number;
  snapshotsTaken: number;
  refActionsPerformed: number;
}

/**
 * Console Message - Browser console log
 */
export interface ConsoleMessage {
  type: 'log' | 'info' | 'warn' | 'error';
  text: string;
  timestamp: Date;
  url?: string;
}

/**
 * Browser Action - Action to perform in browser
 */
export type BrowserAction =
  | NavigateAction
  | ClickAction
  | TypeAction
  | SnapshotAction
  | WaitAction;

export interface NavigateAction {
  type: 'navigate';
  url: string;
}

export interface ClickAction {
  type: 'click';
  ref: string;                   // Element ref (e12)
}

export interface TypeAction {
  type: 'type';
  ref: string;                   // Element ref (e15)
  text: string;
}

export interface SnapshotAction {
  type: 'snapshot';
  interactive?: boolean;         // Only interactive elements
}

export interface WaitAction {
  type: 'wait';
  ref: string;
  timeout?: number;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Error Classification
 */
export enum ErrorType {
  TRANSIENT = 'transient',       // Retry
  PERMANENT = 'permanent',       // Don't retry
  USER_ERROR = 'user_error',     // Invalid input
}

/**
 * Hermes Configuration
 */
export interface HermesConfig {
  browser: {
    profile: string;
    headless: boolean;
    viewport: { width: number; height: number };
  };
  gemini: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  tabs: {
    count: number;
    categories: string[];
  };
  context: {
    maxTokensPerTab: number;
    rotationThreshold: number;
    estimationMethod: 'tiktoken' | 'simple';
  };
  rateLimit: {
    maxRequestsPerMinute: number;
    cooldownMs: number;
  };
}
