# 🏛️ Hermes - The Messenger

Hermes is the messenger agent that bridges Olympus with Gemini 3 Pro. He uses browser automation to communicate with Gemini's web interface, treating each Gemini tab as a "living database" with 1M context each.

## 🎯 Features

- **20 Categorized Tabs**: Each with 1M context window
- **Context Hijacking**: Use Gemini tabs as persistent databases
- **Session Persistence**: Login once, use forever
- **OpenClaw Patterns**: Snapshot-based, ref-based actions
- **Error Recovery**: Automatic retry with exponential backoff
- **Metrics Tracking**: Monitor performance and usage

## 🚀 Quick Start

### 1. First Time Setup (Login)

```bash
# Run the hello world example
npm run hermes:hello

# Browser will open - login manually:
# 1. Go to gemini.google.com
# 2. Sign in with your Google account
# 3. Select "Stay signed in"
# 4. Wait for Gemini to load
```

### 2. Subsequent Uses (Automatic)

```bash
# Just run - already logged in!
npm run hermes:hello
```

## 📖 Usage

### Basic Example

```typescript
import { chromium } from 'playwright';
import Database from 'better-sqlite3';
import { GeminiMessenger, HERMES_BROWSER_PROFILE } from './src/olympus/hermes/index.js';

// Initialize
const db = new Database('./data/prometheus.db');
const hermes = new GeminiMessenger(db);
await hermes.initialize();

// Launch browser with persistent profile
const browser = await chromium.launchPersistentContext(
  HERMES_BROWSER_PROFILE.userDataDir,
  {
    headless: false,
    viewport: { width: 1920, height: 1080 },
  }
);

const page = await browser.newPage();
hermes.setPage(page);

// Send message
const response = await hermes.sendToGemini(
  'Coding',
  'Write a React component for a todo list'
);

console.log(response);
```

### Available Categories

1. Coding
2. Design
3. Social Media
4. Content Creation
5. Research
6. SEO
7. Video Generation
8. Image Generation
9. Data Analysis
10. Marketing
11. Documentation
12. Testing
13. DevOps
14. Security
15. Performance
16. Architecture
17. UI/UX
18. API Design
19. Database
20. General

## 🔐 Session Management

Hermes uses **persistent browser profiles** to maintain your Gemini session:

- **Profile Location**: `./browser-data/olympus-hermes/`
- **Cookies**: Automatically saved
- **Session**: Persists across restarts
- **Login**: Only needed once!

### Manual Session Check

```typescript
import { SessionManager } from './src/olympus/hermes/session-manager.js';

const sessionManager = new SessionManager();

// Check if logged in
const isLoggedIn = await sessionManager.isLoggedIn(page);

// Ensure logged in (prompts if needed)
await sessionManager.ensureLoggedIn(page);

// Clear session (logout)
await sessionManager.clearSession(page);
```

## 📊 Metrics

Track Hermes performance:

```typescript
const metrics = hermes.getMetrics();

console.log(metrics);
// {
//   messagesSent: 10,
//   responsesReceived: 10,
//   averageResponseTime: 5234,
//   errors: 0,
//   tabSwitches: 3,
//   gemsCreated: 0,
//   snapshotsTaken: 0,
//   refActionsPerformed: 0
// }
```

## 🏥 Tab Health

Monitor tab health:

```typescript
const tabManager = hermes.getTabManager();

// Get all tab health
const allHealth = tabManager.getAllTabHealth();

// Get specific tab health
const codingHealth = tabManager.getTabHealth('tab-coding');

console.log(codingHealth);
// {
//   tabId: 'tab-coding',
//   category: 'Coding',
//   status: 'healthy',
//   lastUsed: Date,
//   messageCount: 5,
//   contextUsage: 0.05,
//   issues: []
// }
```

## 🛠️ Advanced Features

### Context Management

```typescript
// Update context estimate
tabManager.updateContextEstimate('Coding', 1000);

// Reset tab context (when near limit)
tabManager.resetTabContext('Coding');
```

### Error Handling

```typescript
try {
  const response = await hermes.sendToGemini('Coding', 'Hello');
} catch (error) {
  console.error('Failed to send message:', error);
  
  // Check metrics for error count
  const metrics = hermes.getMetrics();
  console.log(`Total errors: ${metrics.errors}`);
}
```

## 🔧 Configuration

Customize Hermes behavior:

```typescript
import { DEFAULT_HERMES_CONFIG } from './src/olympus/hermes/config.js';

// Modify config
DEFAULT_HERMES_CONFIG.gemini.timeout = 180000; // 3 minutes
DEFAULT_HERMES_CONFIG.gemini.retryAttempts = 5;
DEFAULT_HERMES_CONFIG.rateLimit.maxRequestsPerMinute = 30;
```

## 🧪 Testing

Run tests:

```bash
npm test src/olympus/hermes/__tests__/
```

## 📝 Architecture

```
┌─────────────────────────────────────────┐
│         GeminiMessenger                 │
│  (Main orchestrator)                    │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│   Tab    │ │ Response │ │ Session  │
│ Manager  │ │  Parser  │ │ Manager  │
└──────────┘ └──────────┘ └──────────┘
```

## 🏛️ Mythology

> "Hermes, messenger of the gods, swift and cunning, carries messages between Olympus and the mortal realm."

In Olympus, Hermes bridges the gap between Zeus (you) and Gemini 3 Pro, carrying messages swiftly and reliably across the digital realm.

## 📚 Learn More

- [Design Document](../../../.kiro/specs/olympus-hermes/design.md)
- [Requirements](../../../.kiro/specs/olympus-hermes/requirements.md)
- [Tasks](../../../.kiro/specs/olympus-hermes/tasks.md)

---

**Version**: 0.1.0  
**Status**: ✅ Core functionality complete  
**Next**: OpenClaw snapshot integration
