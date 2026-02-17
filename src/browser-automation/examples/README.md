# Browser Automation Examples

This directory contains comprehensive examples demonstrating how to use the Browser Automation system.

## Quick Start Examples

### Example 1: Basic Navigation and Screenshot

**File:** `01-basic-navigation-screenshot.ts`

Learn the fundamentals:
- Initialize the browser automation system
- Navigate to a URL
- Take screenshots (viewport and full-page)
- Proper cleanup

**Run:**
```bash
npm run example:basic
```

### Example 2: Form Filling and Submission

**File:** `02-form-filling-submission.ts`

Learn form automation:
- Fill text inputs
- Select dropdown options
- Check checkboxes
- Submit forms
- Wait for navigation

**Run:**
```bash
npm run example:forms
```

### Example 3: State Management

**File:** `03-state-management.ts`

Learn state management:
- Set and get cookies
- Manage localStorage and sessionStorage
- Export and import browser state
- Clear browser state
- Session persistence patterns

**Run:**
```bash
npm run example:state
```

### Example 4: Multi-Profile Usage

**File:** `04-multi-profile-usage.ts`

Learn profile management:
- Use different browser profiles
- Switch between profiles
- Profile isolation
- Custom profile creation
- Chrome extension profile

**Run:**
```bash
npm run example:profiles
```

### Example 5: Remote Browser Connection

**File:** `05-remote-browser-connection.ts`

Learn remote browser automation:
- Connect to remote browsers
- Gateway authentication
- Cloud browser services (BrowserStack)
- Self-hosted remote browsers
- Docker-based browsers

**Run:**
```bash
npm run example:remote
```

## Advanced Examples

### Action Execution Demo

**File:** `action-execution-demo.ts`

Comprehensive action execution examples with error handling and validation.

### Control Server Demo

**File:** `control-server-demo.ts`

Using the HTTP/WebSocket control server API.

### Geolocation Demo

**File:** `geolocation-demo.ts`

Override browser geolocation for testing location-based features.

### Interaction Actions Demo

**File:** `interaction-actions-demo.ts`

Advanced interaction patterns: hover, drag-and-drop, keyboard shortcuts.

### Playwright Adapter Demo

**File:** `playwright-adapter-demo.ts`

Direct usage of the Playwright adapter for low-level control.

### State Export/Import Demo

**File:** `state-export-import-demo.ts`

Detailed state management with round-trip preservation.

### System Integration Demo

**File:** `system-integration-demo.ts`

Complete system integration showing all components working together.

### Tool Adapter Demo

**File:** `tool-adapter-demo.ts`

Using browser tools through the Tool Registry for LLM function calling.

## Running Examples

### Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

### Run Individual Examples

```bash
# Basic examples
node dist/browser-automation/examples/01-basic-navigation-screenshot.js
node dist/browser-automation/examples/02-form-filling-submission.js
node dist/browser-automation/examples/03-state-management.js
node dist/browser-automation/examples/04-multi-profile-usage.js
node dist/browser-automation/examples/05-remote-browser-connection.js

# Advanced examples
node dist/browser-automation/examples/action-execution-demo.js
node dist/browser-automation/examples/control-server-demo.js
node dist/browser-automation/examples/geolocation-demo.js
```

### Run with TypeScript (ts-node)

```bash
npx ts-node src/browser-automation/examples/01-basic-navigation-screenshot.ts
```

## Example Patterns

### Pattern 1: Quick Start

```typescript
import { quickStart, shutdownBrowserAutomation } from './browser-automation';

const system = await quickStart();
const browserManager = system.getBrowserManager();

// Your automation code here

await shutdownBrowserAutomation();
```

### Pattern 2: Custom Configuration

```typescript
import { initializeBrowserAutomation, shutdownBrowserAutomation } from './browser-automation';

const system = await initializeBrowserAutomation({
  browser: {
    headless: true,
    defaultTimeout: 60000,
  },
  logging: {
    level: 'debug',
  },
});

// Your automation code here

await shutdownBrowserAutomation();
```

### Pattern 3: Error Handling

```typescript
try {
  const result = await browserManager.executeAction({
    type: 'navigate',
    url: 'https://example.com',
  });

  if (!result.success) {
    console.error('Action failed:', result.error);
    // Handle error
  }
} catch (error) {
  console.error('Unexpected error:', error);
} finally {
  await shutdownBrowserAutomation();
}
```

### Pattern 4: Action Chaining

```typescript
// Navigate
await browserManager.executeAction({
  type: 'navigate',
  url: 'https://example.com',
  waitUntil: 'networkidle',
});

// Fill form
await browserManager.executeAction({
  type: 'type',
  selector: 'input[name="email"]',
  text: 'user@example.com',
});

// Submit
await browserManager.executeAction({
  type: 'click',
  selector: 'button[type="submit"]',
});

// Wait for result
await browserManager.executeAction({
  type: 'wait_for_selector',
  selector: '.success-message',
  timeout: 10000,
});
```

### Pattern 5: State Persistence

```typescript
// Save session
const state = await browserManager.executeAction({
  type: 'export_state',
});
fs.writeFileSync('session.json', JSON.stringify(state.result));

// Later, restore session
const savedState = JSON.parse(fs.readFileSync('session.json', 'utf-8'));
await browserManager.executeAction({
  type: 'import_state',
  state: savedState,
});
```

## Common Use Cases

### Web Scraping

```typescript
// Navigate to page
await browserManager.executeAction({
  type: 'navigate',
  url: 'https://example.com/data',
  waitUntil: 'networkidle',
});

// Extract data
const data = await browserManager.executeAction({
  type: 'execute_js',
  script: `
    Array.from(document.querySelectorAll('.item')).map(item => ({
      title: item.querySelector('.title').textContent,
      price: item.querySelector('.price').textContent,
    }))
  `,
});

console.log('Scraped data:', data.result);
```

### Automated Testing

```typescript
// Navigate to app
await browserManager.executeAction({
  type: 'navigate',
  url: 'http://localhost:3000',
  waitUntil: 'networkidle',
});

// Test login
await browserManager.executeAction({
  type: 'type',
  selector: '#username',
  text: 'testuser',
});

await browserManager.executeAction({
  type: 'type',
  selector: '#password',
  text: 'testpass',
});

await browserManager.executeAction({
  type: 'click',
  selector: '#login-button',
});

// Verify success
const result = await browserManager.executeAction({
  type: 'wait_for_selector',
  selector: '.dashboard',
  timeout: 5000,
});

console.log('Login test:', result.success ? 'PASSED' : 'FAILED');
```

### Screenshot Monitoring

```typescript
const urls = [
  'https://example.com',
  'https://example.com/about',
  'https://example.com/contact',
];

for (const url of urls) {
  await browserManager.executeAction({
    type: 'navigate',
    url,
    waitUntil: 'networkidle',
  });

  const screenshot = await browserManager.executeAction({
    type: 'screenshot',
    fullPage: true,
    format: 'png',
  });

  const filename = url.replace(/[^a-z0-9]/gi, '_') + '.png';
  fs.writeFileSync(filename, Buffer.from(screenshot.result.screenshot, 'base64'));
  console.log(`Screenshot saved: ${filename}`);
}
```

## Troubleshooting

### Browser Won't Launch

**Problem:** Browser fails to launch with timeout error.

**Solution:**
- Check Chrome/Chromium is installed
- Verify executable path in configuration
- Increase timeout in launch options
- Check for port conflicts (default: 18791)

### Element Not Found

**Problem:** Actions fail with "element not found" error.

**Solution:**
- Wait for element to appear: `wait_for_selector`
- Check selector syntax (CSS or XPath)
- Verify page has loaded: `waitUntil: 'networkidle'`
- Take a screenshot to debug: `type: 'screenshot'`

### Remote Connection Fails

**Problem:** Cannot connect to remote browser.

**Solution:**
- Verify remote browser is running
- Check WebSocket endpoint is correct
- Ensure `allowRemoteProfiles: true` in config
- Verify network connectivity and firewall rules
- Check authentication credentials

### State Not Persisting

**Problem:** Cookies or localStorage not persisting between sessions.

**Solution:**
- Export state before closing: `export_state`
- Import state after launching: `import_state`
- Verify user data directory is writable
- Check profile isolation settings

## Additional Resources

- [API Documentation](../API.md)
- [Integration Guide](../INTEGRATION.md)
- [Configuration Guide](../config/README.md)
- [Tool Adapters Guide](../tool-adapters/README.md)
- [Requirements Document](../../../.kiro/specs/browser-automation/requirements.md)
- [Design Document](../../../.kiro/specs/browser-automation/design.md)

## Contributing Examples

To contribute a new example:

1. Create a new file: `XX-descriptive-name.ts`
2. Include comprehensive comments
3. Demonstrate a specific use case
4. Include error handling
5. Add cleanup code
6. Update this README
7. Add npm script in package.json

Example template:

```typescript
/**
 * Example X: Your Example Title
 * 
 * This example demonstrates:
 * - Feature 1
 * - Feature 2
 * - Feature 3
 * 
 * Requirements: X.X, Y.Y
 */

import { initializeBrowserAutomation, shutdownBrowserAutomation } from '../init.js';

async function yourExample() {
  console.log('=== Example X: Your Example Title ===\n');

  try {
    const system = await initializeBrowserAutomation();
    const browserManager = system.getBrowserManager();

    // Your example code here

    console.log('=== Example completed successfully! ===');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await shutdownBrowserAutomation();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  yourExample().catch(console.error);
}

export { yourExample };
```
