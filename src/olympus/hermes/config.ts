/**
 * Olympus - Hermes Configuration
 * 
 * Configuration for Hermes (The Messenger)
 */

import { HermesConfig } from './types.js';

/**
 * Default Hermes Configuration
 */
export const DEFAULT_HERMES_CONFIG: HermesConfig = {
  browser: {
    profile: 'olympus-hermes',
    headless: false,  // Keep visible for debugging
    viewport: { width: 1920, height: 1080 },
  },
  
  gemini: {
    baseUrl: 'https://gemini.google.com',
    timeout: 120000,  // 2 minutes for long responses
    retryAttempts: 3,
    retryDelay: 3000,
  },
  
  tabs: {
    count: 20,
    categories: [
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
    ],
  },
  
  context: {
    maxTokensPerTab: 1000000,  // 1M context per tab
    rotationThreshold: 900000,  // Rotate at 90% (900K tokens)
    estimationMethod: 'simple',  // Use simple estimation for now
  },
  
  rateLimit: {
    maxRequestsPerMinute: 20,
    cooldownMs: 3000,  // 3 seconds between requests
  },
};

/**
 * Browser Profile Configuration for Hermes
 */
export const HERMES_BROWSER_PROFILE = {
  name: 'olympus-hermes',
  type: 'openclaw' as const,
  userDataDir: './browser-data/olympus-hermes',
  color: '#FFD700',  // Gold for Hermes (messenger of the gods)
  launchOptions: {
    headless: false,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',  // Hide automation
      '--disable-dev-shm-usage',  // Overcome limited resource problems
      '--no-sandbox',  // Required for some environments
    ],
  },
};

/**
 * Gemini Selectors (Multi-layered for resilience)
 */
export const GEMINI_SELECTORS = {
  input: [
    'textarea[aria-label*="prompt"]',
    'textarea[aria-label*="Enter"]',
    'textarea[placeholder*="Enter"]',
    'div[contenteditable="true"]',
    '.input-area textarea',
    'textarea.ql-editor',
  ],
  
  response: [
    '.model-response',
    '[data-message-author-role="model"]',
    '.response-container',
    '.markdown-content',
    '.message-content',
  ],
  
  streamingIndicator: [
    '.typing-indicator',
    '[data-streaming="true"]',
    '.response-loading',
    '.loading-dots',
  ],
  
  copyButton: [
    'button[aria-label*="Copy"]',
    'button[title*="Copy"]',
    '.copy-button',
  ],
  
  newChatButton: [
    'button[aria-label*="New chat"]',
    'button[title*="New chat"]',
    '.new-chat-button',
  ],
  
  gemsButton: [
    'button[aria-label*="Gems"]',
    'a[href*="/gems"]',
    '.gems-button',
  ],
};

/**
 * Timeout Configuration
 */
export const TIMEOUTS = {
  navigation: 30000,        // 30 seconds
  elementWait: 10000,       // 10 seconds
  responseWait: 120000,     // 2 minutes
  streamingCheck: 500,      // 500ms between checks
  stableContent: 2000,      // 2 seconds of stable content
};

/**
 * Retry Configuration
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 3000,          // 3 seconds
  maxDelay: 30000,          // 30 seconds
  exponentialBase: 2,       // 2^attempt * baseDelay
};
