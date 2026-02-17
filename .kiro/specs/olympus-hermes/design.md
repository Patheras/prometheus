# Olympus - Hermes (The Messenger) Design

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    OLYMPUS LAYER                        │
│                                                         │
│  ┌──────────┐         ┌──────────┐                    │
│  │  ZEUS    │────────▶│ HERMES   │                    │
│  │(Orchestr)│         │(Messenger)│                    │
│  └──────────┘         └──────────┘                    │
│                            │                            │
└────────────────────────────┼────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│              PROMETHEUS CORE                            │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Browser    │  │    Memory    │  │   Runtime   │ │
│  │  Automation  │  │    Engine    │  │   Engine    │ │
│  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                  GEMINI 3 PRO                           │
│                                                         │
│  Tab 1: Coding    │ Tab 11: Documentation              │
│  Tab 2: Design    │ Tab 12: Testing                    │
│  Tab 3: Social    │ Tab 13: DevOps                     │
│  ...              │ ...                                 │
│  Tab 20: General  │ (Each: 1M context)                 │
└─────────────────────────────────────────────────────────┘
```

## 2. Core Components

### 2.1 GeminiMessenger (Main Class)

**Responsibility:** Bridge between Olympus and Gemini

```typescript
class GeminiMessenger {
  private browserManager: BrowserManager;
  private tabManager: GeminiTabManager;
  private responseParser: GeminiResponseParser;
  private gemManager: GeminiGemManager;
  
  async sendToGemini(category: string, message: string): Promise<string>
  async createGem(category: string, instructions: string): Promise<string>
  async getTabHealth(): Promise<TabHealth[]>
}
```

### 2.2 GeminiTabManager

**Responsibility:** Manage 20 Gemini tabs as "living databases"

```typescript
class GeminiTabManager {
  private tabs: Map<string, GeminiTab>;
  private db: Database;
  
  async initializeTabs(): Promise<void>
  async getTab(category: string): Promise<GeminiTab>
  async switchToTab(tabId: string): Promise<void>
  async updateTabMetadata(tabId: string, metadata: Partial<GeminiTab>): Promise<void>
  async getTabHealth(tabId: string): Promise<TabHealth>
}
```

### 2.3 GeminiResponseParser

**Responsibility:** Extract and parse Gemini responses

```typescript
class GeminiResponseParser {
  async waitForResponse(page: Page, timeout: number): Promise<string>
  async detectStreaming(page: Page): Promise<boolean>
  async extractResponse(page: Page): Promise<ParsedResponse>
  parseMarkdown(content: string): ParsedResponse
}
```

### 2.4 GeminiGemManager

**Responsibility:** Create and manage Gemini Gems (persistent memory)

```typescript
class GeminiGemManager {
  async createGem(name: string, instructions: string): Promise<string>
  async listGems(): Promise<GeminiGem[]>
  async associateGemWithTab(gemId: string, tabId: string): Promise<void>
}
```

## 3. Data Models

### 3.1 GeminiTab

```typescript
interface GeminiTab {
  id: string;                    // "tab-coding"
  category: string;              // "Coding"
  url: string;                   // "https://gemini.google.com/app/..."
  lastUsed: Date;
  messageCount: number;
  contextEstimate: number;       // Estimated tokens used
  gemId?: string;                // Associated Gem ID
  conversationHistory: Message[];
  status: 'active' | 'idle' | 'error';
}
```

### 3.2 ParsedResponse

```typescript
interface ParsedResponse {
  content: string;               // Main response text
  codeBlocks: CodeBlock[];       // Extracted code
  images: string[];              // Image URLs
  links: string[];               // Links
  thinking?: string;             // <think> content if present
  metadata: {
    timestamp: Date;
    tokensEstimate: number;
    streamingDuration?: number;
  };
}
```

### 3.3 GeminiGem

```typescript
interface GeminiGem {
  id: string;
  name: string;
  instructions: string;
  knowledge: string[];           // Persistent facts
  createdAt: Date;
  associatedTabs: string[];
}
```

## 4. Key Design Decisions

### 4.1 Context Hijacking Strategy

**Problem:** How to use Gemini tabs as "living databases"?

**Solution:** 
1. **One tab per category** - Each tab maintains its own context
2. **Persistent conversations** - Never clear tab history
3. **Context rotation** - When approaching 1M limit, summarize and start fresh
4. **Gem association** - Link Gems to tabs for persistent instructions

**Example:**
```typescript
// Tab "Coding" maintains context across multiple requests
await hermes.sendToGemini('Coding', 'Write a React component');
// ... later ...
await hermes.sendToGemini('Coding', 'Now add TypeScript types');
// Gemini remembers the previous component!
```

### 4.2 Selector Strategy (Resilient to UI Changes)

**Problem:** Gemini UI can change, breaking selectors

**Solution:** Multi-layered selector strategy

```typescript
const SELECTORS = {
  input: [
    'textarea[aria-label*="prompt"]',
    'textarea[placeholder*="Enter"]',
    'div[contenteditable="true"]',
    '.input-area textarea',
  ],
  response: [
    '.model-response',
    '[data-message-author-role="model"]',
    '.response-container',
    '.markdown-content',
  ],
  streamingIndicator: [
    '.typing-indicator',
    '[data-streaming="true"]',
    '.response-loading',
  ],
};

// Try each selector until one works
async function findElement(page: Page, selectors: string[]): Promise<ElementHandle> {
  for (const selector of selectors) {
    try {
      const element = await page.waitForSelector(selector, { timeout: 2000 });
      if (element) return element;
    } catch {}
  }
  throw new Error('No selector matched');
}
```

### 4.3 Response Streaming Detection

**Problem:** Gemini streams responses, need to wait for completion

**Solution:** Multi-signal detection

```typescript
async function waitForResponseComplete(page: Page): Promise<void> {
  // Strategy 1: Wait for streaming indicator to disappear
  await page.waitForSelector('.typing-indicator', { state: 'hidden', timeout: 120000 });
  
  // Strategy 2: Wait for content to stabilize (no changes for 2 seconds)
  let lastContent = '';
  let stableCount = 0;
  
  while (stableCount < 4) {  // 4 checks * 500ms = 2 seconds stable
    await page.waitForTimeout(500);
    const currentContent = await page.locator('.model-response').textContent();
    
    if (currentContent === lastContent) {
      stableCount++;
    } else {
      stableCount = 0;
      lastContent = currentContent;
    }
  }
  
  // Strategy 3: Look for "Copy" button (appears when response is done)
  await page.waitForSelector('button[aria-label*="Copy"]', { timeout: 5000 });
}
```

### 4.4 Tab Initialization

**Problem:** How to create and manage 20 tabs?

**Solution:** Lazy initialization + persistent storage

```typescript
async function initializeTabs(): Promise<void> {
  const categories = [
    'Coding', 'Design', 'Social Media', 'Content Creation',
    'Research', 'SEO', 'Video Generation', 'Image Generation',
    'Data Analysis', 'Marketing', 'Documentation', 'Testing',
    'DevOps', 'Security', 'Performance', 'Architecture',
    'UI/UX', 'API Design', 'Database', 'General',
  ];
  
  for (const category of categories) {
    // Check if tab exists in DB
    let tab = await db.getTab(category);
    
    if (!tab) {
      // Create new conversation in Gemini
      await page.goto('https://gemini.google.com/app');
      await page.click('button[aria-label="New chat"]');
      
      const url = page.url();
      
      tab = {
        id: `tab-${category.toLowerCase().replace(/\s+/g, '-')}`,
        category,
        url,
        lastUsed: new Date(),
        messageCount: 0,
        contextEstimate: 0,
        conversationHistory: [],
        status: 'active',
      };
      
      await db.saveTab(tab);
    }
    
    this.tabs.set(category, tab);
  }
}
```

### 4.5 Error Recovery

**Problem:** Gemini might timeout, error, or UI might change

**Solution:** Retry with exponential backoff + fallback strategies

```typescript
async function sendWithRetry(
  category: string,
  message: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.sendToGemini(category, message);
    } catch (error) {
      lastError = error;
      
      // Classify error
      if (error.message.includes('selector')) {
        // UI changed - try alternative selectors
        await this.updateSelectors();
      } else if (error.message.includes('timeout')) {
        // Timeout - wait longer
        await this.increaseTimeout();
      } else if (error.message.includes('session')) {
        // Session expired - re-login
        await this.refreshSession();
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

## 5. Implementation Plan

### Phase 1: Core Messaging (Day 1-2)

**Files to create:**
```
src/olympus/hermes/
├── index.ts
├── gemini-messenger.ts          # Main class
├── gemini-tab-manager.ts        # Tab management
├── gemini-response-parser.ts    # Response parsing
├── selectors.ts                 # Selector strategies
└── types.ts                     # TypeScript types
```

**Key functions:**
1. `initializeTabs()` - Create 20 tabs
2. `sendToGemini()` - Send message and get response
3. `waitForResponse()` - Handle streaming
4. `parseResponse()` - Extract content

### Phase 2: Gem Management (Day 3-4)

**Files to create:**
```
src/olympus/hermes/
├── gemini-gem-manager.ts        # Gem CRUD
└── gem-tab-associator.ts        # Link Gems to tabs
```

**Key functions:**
1. `createGem()` - Create persistent memory
2. `associateGemWithTab()` - Link Gem to category
3. `listGems()` - Get all Gems

### Phase 3: Health & Monitoring (Day 5)

**Files to create:**
```
src/olympus/hermes/
├── tab-health-monitor.ts        # Monitor tab health
└── context-estimator.ts         # Estimate context usage
```

**Key functions:**
1. `getTabHealth()` - Check tab status
2. `estimateContextUsage()` - Calculate tokens
3. `rotateContext()` - Summarize and refresh

### Phase 4: Testing (Day 6)

**Files to create:**
```
src/olympus/hermes/__tests__/
├── gemini-messenger.test.ts
├── tab-manager.test.ts
└── integration.test.ts
```

## 6. Database Schema

```sql
-- Gemini tabs
CREATE TABLE gemini_tabs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  last_used TIMESTAMP NOT NULL,
  message_count INTEGER DEFAULT 0,
  context_estimate INTEGER DEFAULT 0,
  gem_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversation history (for context estimation)
CREATE TABLE gemini_messages (
  id TEXT PRIMARY KEY,
  tab_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'user' or 'model'
  content TEXT NOT NULL,
  tokens_estimate INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tab_id) REFERENCES gemini_tabs(id)
);

-- Gemini Gems
CREATE TABLE gemini_gems (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  instructions TEXT NOT NULL,
  knowledge TEXT,  -- JSON array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gem-Tab associations
CREATE TABLE gem_tab_associations (
  gem_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (gem_id, tab_id),
  FOREIGN KEY (gem_id) REFERENCES gemini_gems(id),
  FOREIGN KEY (tab_id) REFERENCES gemini_tabs(id)
);

-- Indexes
CREATE INDEX idx_tabs_category ON gemini_tabs(category);
CREATE INDEX idx_tabs_last_used ON gemini_tabs(last_used);
CREATE INDEX idx_messages_tab_id ON gemini_messages(tab_id);
CREATE INDEX idx_messages_timestamp ON gemini_messages(timestamp);
```

## 7. Configuration

```typescript
// src/olympus/hermes/config.ts
export const HERMES_CONFIG = {
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
      'Coding', 'Design', 'Social Media', 'Content Creation',
      'Research', 'SEO', 'Video Generation', 'Image Generation',
      'Data Analysis', 'Marketing', 'Documentation', 'Testing',
      'DevOps', 'Security', 'Performance', 'Architecture',
      'UI/UX', 'API Design', 'Database', 'General',
    ],
  },
  
  context: {
    maxTokensPerTab: 1000000,  // 1M context
    rotationThreshold: 900000,  // Rotate at 90%
    estimationMethod: 'tiktoken',  // or 'simple'
  },
  
  rateLimit: {
    maxRequestsPerMinute: 20,
    cooldownMs: 3000,
  },
};
```

## 8. Usage Example

```typescript
// Initialize Hermes
const hermes = new GeminiMessenger({
  browserManager: new BrowserManager(profileManager),
  database: memoryEngine.db,
});

await hermes.initialize();

// Send message to Coding tab
const response = await hermes.sendToGemini('Coding', `
  Write a React component for a todo list with TypeScript.
  Include add, delete, and toggle functionality.
`);

console.log(response);
// Gemini's response with code...

// Follow-up message (context preserved!)
const response2 = await hermes.sendToGemini('Coding', `
  Now add localStorage persistence to the component.
`);

// Create a Gem for persistent instructions
await hermes.createGem('Coding', `
  You are a senior TypeScript developer.
  Always use functional components with hooks.
  Follow React best practices.
  Include proper TypeScript types.
`);

// Check tab health
const health = await hermes.getTabHealth();
console.log(health);
// [
//   { category: 'Coding', messageCount: 2, contextUsage: 0.05, status: 'active' },
//   { category: 'Design', messageCount: 0, contextUsage: 0, status: 'idle' },
//   ...
// ]
```

## 9. Correctness Properties

### 9.1 Message Delivery
**Property:** Every message sent to Gemini must receive a response or error
```typescript
// Test: Send message, verify response or error
const result = await hermes.sendToGemini('Coding', 'Hello');
assert(result !== null && result !== undefined);
```

### 9.2 Context Preservation
**Property:** Follow-up messages in the same tab must have access to previous context
```typescript
// Test: Send two related messages, verify second understands first
await hermes.sendToGemini('Coding', 'My name is Zeus');
const response = await hermes.sendToGemini('Coding', 'What is my name?');
assert(response.includes('Zeus'));
```

### 9.3 Tab Isolation
**Property:** Messages in different tabs must not interfere with each other
```typescript
// Test: Send different messages to different tabs
await hermes.sendToGemini('Coding', 'Write Python code');
await hermes.sendToGemini('Design', 'Create a logo');
const response = await hermes.sendToGemini('Coding', 'What language?');
assert(response.includes('Python'));
```

## 10. Next Steps

1. ✅ Requirements approved
2. ✅ Design approved
3. 🔄 Create tasks.md
4. 🔄 Implement Phase 1 (Core Messaging)
5. 🔄 Test with real Gemini
6. 🔄 Iterate based on feedback

**Ready to code! 🚀**
