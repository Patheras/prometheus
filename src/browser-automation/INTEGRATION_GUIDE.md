# Browser Automation Integration Guide

Complete guide for integrating the Browser Automation system with Prometheus and other applications.

## Table of Contents

- [Overview](#overview)
- [Integration with Prometheus](#integration-with-prometheus)
- [Tool Registration Process](#tool-registration-process)
- [Security Considerations](#security-considerations)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)
- [Performance Optimization](#performance-optimization)
- [Monitoring and Observability](#monitoring-and-observability)

---

## Overview

The Browser Automation system integrates with Prometheus through:

1. **Tool Registry** - Exposes browser capabilities as function calling tools
2. **Control Server** - Provides HTTP/WebSocket API for browser control
3. **Event System** - Emits events for monitoring and logging
4. **Metrics Collection** - Tracks performance and usage metrics

### Architecture Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    Prometheus Core                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Tool Registry                           │  │
│  │  - Function calling interface                        │  │
│  │  - Schema validation                                 │  │
│  │  - Tool execution                                    │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │         Browser Tool Adapters (21 tools)            │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
└─────────────────────┼───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│           Browser Automation System                         │
│  - Browser Manager                                          │
│  - CDP Client                                               │
│  - Playwright Adapter                                       │
│  - State Manager                                            │
│  - Profile Manager                                          │
│  - Control Server (127.0.0.1:18791)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration with Prometheus

### Step 1: Initialize the System

Add browser automation initialization to your Prometheus startup sequence:

```typescript
// src/index.ts or main entry point
import { initializeBrowserAutomation } from './browser-automation/init.js';

async function startPrometheus() {
  // ... other Prometheus initialization ...

  // Initialize browser automation
  const browserSystem = await initializeBrowserAutomation({
    browser: {
      headless: true,
      defaultTimeout: 30000,
    },
    logging: {
      level: 'info',
      logActions: true,
    },
  });

  console.log('Browser automation system initialized');
  
  // ... continue Prometheus startup ...
}
```


### Step 2: Register Shutdown Handlers

Ensure graceful shutdown when Prometheus stops:

```typescript
import { registerShutdownHandlers } from './browser-automation/shutdown.js';

// Register signal handlers for graceful shutdown
registerShutdownHandlers();

// Or manually handle shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Prometheus...');
  await shutdownBrowserAutomation();
  process.exit(0);
});
```

### Step 3: Access Browser Manager

The browser manager is available through the system instance:

```typescript
const browserManager = browserSystem.getBrowserManager();

// Execute browser actions
const result = await browserManager.executeAction({
  type: 'navigate',
  url: 'https://example.com',
});
```

### Step 4: Use Tools via Tool Registry

Tools are automatically registered and available through the Tool Registry:

```typescript
import { getToolRegistry } from './tools/tool-registry.js';

const registry = getToolRegistry();
const navigateTool = registry.getTool('browser_navigate');

// Execute tool
const result = await navigateTool.executor(
  { url: 'https://example.com' },
  { conversationId: 'conv-123', timestamp: Date.now() }
);
```

---

## Tool Registration Process

### Automatic Registration

Tools are automatically registered during system initialization:

```typescript
// In init.ts
export async function initializeBrowserAutomation(config) {
  // ... initialize components ...
  
  // Register all browser tools
  registerBrowserTools(browserManager);
  
  return system;
}
```

### Manual Tool Registration

To register tools manually or add custom tools:

```typescript
import { BrowserToolAdapter } from './tool-adapters/browser-tool-adapter.js';
import { getToolRegistry } from './tools/tool-registry.js';

// Create custom tool adapter
class CustomBrowserTool extends BrowserToolAdapter {
  constructor(browserManager) {
    super(browserManager, {
      name: 'custom_browser_action',
      description: 'Custom browser action',
      parameters: {
        type: 'object',
        properties: {
          // ... parameter schema ...
        },
        required: [],
      },
    });
  }

  protected convertToAction(params) {
    // Convert parameters to BrowserAction
    return {
      type: 'custom',
      ...params,
    };
  }
}

// Register the tool
const registry = getToolRegistry();
const customTool = new CustomBrowserTool(browserManager);

registry.registerTool({
  name: customTool.getSchema().name,
  schema: customTool.getSchema(),
  executor: async (params, context) => {
    return await customTool.execute(params);
  },
});
```


### Available Tools

The system registers 21 browser automation tools:

**Navigation Tools:**
- `browser_navigate` - Navigate to URL
- `browser_back` - Go back in history
- `browser_forward` - Go forward in history
- `browser_reload` - Reload current page

**Interaction Tools:**
- `browser_click` - Click element
- `browser_type` - Type text
- `browser_fill` - Fill input
- `browser_hover` - Hover over element
- `browser_select` - Select option

**Capture Tools:**
- `browser_screenshot` - Take screenshot
- `browser_snapshot` - Capture page snapshot
- `browser_pdf` - Generate PDF

**State Management Tools:**
- `browser_get_cookies` - Get cookies
- `browser_set_cookies` - Set cookies
- `browser_get_local_storage` - Get localStorage
- `browser_set_local_storage` - Set localStorage

**Utility Tools:**
- `browser_execute_js` - Execute JavaScript
- `browser_wait_for_selector` - Wait for element
- `browser_scroll` - Scroll page
- `browser_wait_for_navigation` - Wait for navigation
- `browser_wait_for_load_state` - Wait for load state

### Tool Schema Format

All tools follow the OpenAI function calling schema:

```typescript
{
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: {
      [key: string]: {
        type: string;
        description: string;
        enum?: string[];
      };
    };
    required: string[];
  };
}
```

---

## Security Considerations

### 1. Loopback-Only Control Server

**Requirement:** The control server MUST bind only to 127.0.0.1 (loopback).

**Implementation:**
```typescript
const config = {
  controlServer: {
    enabled: true,
    port: 18791,
    host: '127.0.0.1', // MUST be loopback
  },
};
```

**Validation:**
The system validates this on startup and rejects non-loopback addresses:

```typescript
if (config.controlServer.host !== '127.0.0.1') {
  throw new Error('Control server must bind to loopback address (127.0.0.1)');
}
```

**Why:** Prevents external access to browser control, ensuring only local processes can control browsers.


### 2. Profile Isolation

**Requirement:** Each browser profile MUST have an isolated user data directory.

**Implementation:**
```typescript
const profiles = [
  {
    name: 'profile1',
    type: 'openclaw',
    userDataDir: './.browser-data/profile1', // Isolated
    // ...
  },
  {
    name: 'profile2',
    type: 'openclaw',
    userDataDir: './.browser-data/profile2', // Isolated
    // ...
  },
];
```

**Why:** Prevents data leakage between profiles, ensuring cookies, localStorage, and other state are isolated.

### 3. Input Validation and Sanitization

**Requirement:** All action parameters MUST be validated to prevent injection attacks.

**Implementation:**

The system uses `RequestValidator` to validate all actions:

```typescript
// URL validation
if (action.type === 'navigate') {
  if (!action.url.startsWith('http://') && !action.url.startsWith('https://')) {
    throw new Error('URL must start with http:// or https://');
  }
}

// Selector validation (injection detection)
if (action.selector) {
  const injectionPatterns = [
    /javascript:/i,
    /<script/i,
    /on\w+\s*=/i,
  ];
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(action.selector)) {
      throw new Error('Potential injection detected in selector');
    }
  }
}

// Path sanitization (traversal prevention)
if (action.path) {
  if (action.path.includes('../') || action.path.includes('..\\')) {
    throw new Error('Path traversal detected');
  }
}
```

**Best Practices:**
- Always validate user input before passing to browser actions
- Use parameterized queries when constructing selectors
- Sanitize file paths to prevent directory traversal
- Limit JavaScript execution to page context only

### 4. JavaScript Execution Context Isolation

**Requirement:** JavaScript MUST execute in page context, NOT Node.js context.

**Implementation:**

The system uses Playwright's `evaluate()` which executes in the page context:

```typescript
// SAFE: Executes in page context
const result = await page.evaluate('document.title');

// UNSAFE: Would execute in Node.js context (not used)
// eval(userScript); // NEVER DO THIS
```

**Validation:**

The system blocks access to Node.js globals:

```typescript
// Test that Node.js globals are not accessible
const hasNodeGlobals = await page.evaluate(() => {
  return typeof process !== 'undefined' || 
         typeof require !== 'undefined';
});

if (hasNodeGlobals) {
  throw new Error('JavaScript execution context is not properly isolated');
}
```


### 5. Remote Browser Security

**Requirement:** Remote profiles MUST require authentication.

**Implementation:**

```typescript
const remoteProfile = {
  name: 'remote',
  type: 'remote',
  connectionOptions: {
    wsEndpoint: 'wss://remote-browser.example.com',
    gatewayUrl: 'https://gateway.example.com',
    authToken: process.env.BROWSER_AUTH_TOKEN, // Required
  },
};

// System validates authentication
if (profile.type === 'remote' && !profile.connectionOptions?.authToken) {
  throw new Error('Remote profiles require authentication token');
}
```

**Configuration:**

Remote profiles must be explicitly enabled:

```typescript
const config = {
  security: {
    allowRemoteProfiles: true, // Must be true for remote connections
  },
};
```

**Best Practices:**
- Store authentication tokens in environment variables
- Use HTTPS/WSS for remote connections
- Rotate tokens regularly
- Implement token expiration
- Log all remote connection attempts

### 6. Rate Limiting and Resource Management

**Best Practices:**

```typescript
// Limit concurrent browser instances
const MAX_BROWSERS = 5;
if (browserManager.listBrowsers().length >= MAX_BROWSERS) {
  throw new Error('Maximum browser instances reached');
}

// Implement action timeouts
const config = {
  browser: {
    defaultTimeout: 30000, // 30 seconds
  },
};

// Implement idle timeout
const config = {
  browser: {
    idleTimeout: 300000, // 5 minutes
  },
};
```

---

## Troubleshooting Common Issues

### Issue 1: Browser Won't Launch

**Symptoms:**
- Timeout error during browser launch
- "Failed to launch browser" error
- Port already in use error

**Diagnosis:**

```typescript
// Check if Chrome is installed
const { execSync } = require('child_process');
try {
  const version = execSync('google-chrome --version').toString();
  console.log('Chrome version:', version);
} catch (error) {
  console.error('Chrome not found');
}

// Check for port conflicts
const net = require('net');
const server = net.createServer();
server.listen(18791, '127.0.0.1', () => {
  console.log('Port 18791 is available');
  server.close();
});
server.on('error', (err) => {
  console.error('Port 18791 is in use');
});
```

**Solutions:**

1. **Install Chrome/Chromium:**
```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser

# macOS
brew install --cask google-chrome

# Windows
# Download from https://www.google.com/chrome/
```

2. **Specify executable path:**
```typescript
const config = {
  browser: {
    executablePath: '/usr/bin/chromium-browser',
  },
};
```

3. **Change control server port:**
```typescript
const config = {
  controlServer: {
    port: 19000, // Use different port
  },
};
```

4. **Increase timeout:**
```typescript
const config = {
  browser: {
    defaultTimeout: 60000, // 60 seconds
  },
};
```


### Issue 2: Element Not Found

**Symptoms:**
- "Element not found" error
- Timeout waiting for element
- Actions fail on dynamic content

**Diagnosis:**

```typescript
// Take a screenshot to see current page state
const screenshot = await browserManager.executeAction({
  type: 'screenshot',
  fullPage: true,
});

// Check if page has loaded
const readyState = await browserManager.executeAction({
  type: 'execute_js',
  script: 'document.readyState',
});
console.log('Page ready state:', readyState.result);

// List all elements matching partial selector
const elements = await browserManager.executeAction({
  type: 'execute_js',
  script: `
    Array.from(document.querySelectorAll('button')).map(el => ({
      id: el.id,
      class: el.className,
      text: el.textContent.trim(),
    }))
  `,
});
console.log('Available buttons:', elements.result);
```

**Solutions:**

1. **Wait for element to appear:**
```typescript
await browserManager.executeAction({
  type: 'wait_for_selector',
  selector: 'button#submit',
  timeout: 10000,
});

await browserManager.executeAction({
  type: 'click',
  selector: 'button#submit',
});
```

2. **Wait for page to load:**
```typescript
await browserManager.executeAction({
  type: 'navigate',
  url: 'https://example.com',
  waitUntil: 'networkidle', // Wait for network to be idle
});
```

3. **Use more specific selectors:**
```typescript
// Bad: Too generic
selector: 'button'

// Good: Specific
selector: 'button#submit'
selector: 'button[type="submit"]'
selector: 'form#login button.primary'
```

4. **Handle dynamic content:**
```typescript
// Wait for AJAX to complete
await browserManager.executeAction({
  type: 'wait_for_load_state',
  state: 'networkidle',
});

// Wait for specific element
await browserManager.executeAction({
  type: 'wait_for_selector',
  selector: '.content-loaded',
  state: 'visible',
});
```

### Issue 3: Actions Timeout

**Symptoms:**
- Actions consistently timeout
- Slow page loads
- Network requests hang

**Diagnosis:**

```typescript
// Check network activity
const networkLog = await browserManager.executeAction({
  type: 'execute_js',
  script: `
    performance.getEntriesByType('resource').map(r => ({
      name: r.name,
      duration: r.duration,
      size: r.transferSize,
    }))
  `,
});
console.log('Network requests:', networkLog.result);

// Check page load time
const timing = await browserManager.executeAction({
  type: 'execute_js',
  script: `
    const t = performance.timing;
    ({
      domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
      loadComplete: t.loadEventEnd - t.navigationStart,
    })
  `,
});
console.log('Page timing:', timing.result);
```

**Solutions:**

1. **Increase timeout:**
```typescript
await browserManager.executeAction({
  type: 'navigate',
  url: 'https://slow-site.com',
  timeout: 60000, // 60 seconds
});
```

2. **Use different wait strategy:**
```typescript
// Don't wait for all network activity
await browserManager.executeAction({
  type: 'navigate',
  url: 'https://example.com',
  waitUntil: 'domcontentloaded', // Faster than 'networkidle'
});
```

3. **Block unnecessary resources:**
```typescript
// Block images and stylesheets for faster loading
const profile = {
  name: 'fast',
  type: 'openclaw',
  launchOptions: {
    args: [
      '--blink-settings=imagesEnabled=false',
      '--disable-remote-fonts',
    ],
  },
};
```


### Issue 4: State Not Persisting

**Symptoms:**
- Cookies disappear after browser restart
- localStorage not saved
- Session lost between runs

**Diagnosis:**

```typescript
// Check if state is being saved
const state = await browserManager.executeAction({
  type: 'export_state',
});
console.log('Current state:', {
  cookies: state.result.cookies.length,
  localStorage: Object.keys(state.result.localStorage).length,
});

// Check user data directory
const fs = require('fs');
const userDataDir = './.browser-data/openclaw';
console.log('User data dir exists:', fs.existsSync(userDataDir));
console.log('User data dir contents:', fs.readdirSync(userDataDir));
```

**Solutions:**

1. **Export state before closing:**
```typescript
// Before shutdown
const state = await browserManager.executeAction({
  type: 'export_state',
});
fs.writeFileSync('browser-state.json', JSON.stringify(state.result));

// After restart
const savedState = JSON.parse(fs.readFileSync('browser-state.json'));
await browserManager.executeAction({
  type: 'import_state',
  state: savedState,
});
```

2. **Use persistent profile:**
```typescript
const profile = {
  name: 'persistent',
  type: 'openclaw',
  userDataDir: './persistent-browser-data', // Persistent directory
};
```

3. **Verify directory permissions:**
```bash
# Check permissions
ls -la .browser-data/

# Fix permissions if needed
chmod -R 755 .browser-data/
```

### Issue 5: Remote Connection Fails

**Symptoms:**
- Cannot connect to remote browser
- Authentication errors
- WebSocket connection refused

**Diagnosis:**

```typescript
// Test WebSocket connection
const WebSocket = require('ws');
const ws = new WebSocket('ws://remote-browser:9222');

ws.on('open', () => {
  console.log('WebSocket connection successful');
  ws.close();
});

ws.on('error', (error) => {
  console.error('WebSocket connection failed:', error);
});

// Check remote browser is running
const http = require('http');
http.get('http://remote-browser:9222/json/version', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Remote browser info:', JSON.parse(data));
  });
}).on('error', (error) => {
  console.error('Cannot reach remote browser:', error);
});
```

**Solutions:**

1. **Verify remote browser is running:**
```bash
# On remote machine
chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0

# Check it's accessible
curl http://remote-ip:9222/json/version
```

2. **Check firewall rules:**
```bash
# Allow port 9222
sudo ufw allow 9222/tcp

# Check if port is open
telnet remote-ip 9222
```

3. **Enable remote profiles:**
```typescript
const config = {
  security: {
    allowRemoteProfiles: true, // Must be enabled
  },
};
```

4. **Verify authentication:**
```typescript
const profile = {
  type: 'remote',
  connectionOptions: {
    wsEndpoint: 'wss://remote-browser.com',
    authToken: process.env.BROWSER_AUTH_TOKEN, // Check token is set
  },
};

// Verify token is set
if (!process.env.BROWSER_AUTH_TOKEN) {
  console.error('BROWSER_AUTH_TOKEN not set');
}
```


### Issue 6: Memory Leaks

**Symptoms:**
- Memory usage grows over time
- Browser becomes slow
- System runs out of memory

**Diagnosis:**

```typescript
// Monitor memory usage
const usage = process.memoryUsage();
console.log('Memory usage:', {
  rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
  heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
  heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
});

// Check browser count
const browsers = browserManager.listBrowsers();
console.log('Active browsers:', browsers.length);

// Check for unclosed resources
const metrics = getMetricsCollector();
console.log('Metrics:', metrics.getMetrics());
```

**Solutions:**

1. **Enable idle timeout:**
```typescript
const config = {
  browser: {
    idleTimeout: 300000, // Close idle browsers after 5 minutes
  },
};
```

2. **Close browsers when done:**
```typescript
// Close specific browser
await browserManager.closeBrowser(browserId);

// Close all browsers
await browserManager.stop();
```

3. **Limit concurrent browsers:**
```typescript
const MAX_BROWSERS = 3;
const browsers = browserManager.listBrowsers();
if (browsers.length >= MAX_BROWSERS) {
  // Close oldest browser
  const oldest = browsers.sort((a, b) => a.createdAt - b.createdAt)[0];
  await browserManager.closeBrowser(oldest.id);
}
```

4. **Use headless mode:**
```typescript
const config = {
  browser: {
    headless: true, // Uses less memory
  },
};
```

---

## Performance Optimization

### 1. Use Headless Mode

Headless browsers use significantly less memory and CPU:

```typescript
const config = {
  browser: {
    headless: true,
  },
};
```

**When to use:**
- Automated testing
- Web scraping
- CI/CD pipelines
- Production environments

**When not to use:**
- Debugging (need to see browser)
- Visual testing
- Development

### 2. Optimize Wait Strategies

Choose the right wait strategy for your use case:

```typescript
// Fastest: Don't wait for network
waitUntil: 'domcontentloaded'

// Balanced: Wait for main resources
waitUntil: 'load'

// Slowest: Wait for all network activity
waitUntil: 'networkidle'
```

### 3. Reuse Browser Instances

Launching browsers is expensive. Reuse instances when possible:

```typescript
// Bad: Launch new browser for each action
for (const url of urls) {
  const browser = await browserManager.launchBrowser(profile);
  await browserManager.executeAction({ type: 'navigate', url });
  await browserManager.closeBrowser(browser.id);
}

// Good: Reuse browser instance
const browser = await browserManager.launchBrowser(profile);
for (const url of urls) {
  await browserManager.executeAction({ type: 'navigate', url });
}
await browserManager.closeBrowser(browser.id);
```

### 4. Disable Unnecessary Features

```typescript
const profile = {
  launchOptions: {
    args: [
      '--disable-extensions',
      '--disable-plugins',
      '--disable-images', // If images not needed
      '--disable-javascript', // If JS not needed
      '--disable-gpu',
      '--no-sandbox', // Only in Docker/CI
    ],
  },
};
```


### 5. Parallel Execution

Execute independent actions in parallel:

```typescript
// Sequential (slow)
await browserManager.executeAction({ type: 'navigate', url: url1 });
await browserManager.executeAction({ type: 'screenshot' });
await browserManager.executeAction({ type: 'navigate', url: url2 });
await browserManager.executeAction({ type: 'screenshot' });

// Parallel (fast) - requires multiple browser instances
const [result1, result2] = await Promise.all([
  (async () => {
    const browser1 = await browserManager.launchBrowser(profile);
    await browserManager.executeAction({ type: 'navigate', url: url1 });
    return await browserManager.executeAction({ type: 'screenshot' });
  })(),
  (async () => {
    const browser2 = await browserManager.launchBrowser(profile);
    await browserManager.executeAction({ type: 'navigate', url: url2 });
    return await browserManager.executeAction({ type: 'screenshot' });
  })(),
]);
```

### 6. Cache and Reuse State

Export and reuse browser state to avoid repeated logins:

```typescript
// First run: Login and save state
await browserManager.executeAction({ type: 'navigate', url: loginUrl });
// ... perform login ...
const state = await browserManager.executeAction({ type: 'export_state' });
fs.writeFileSync('session.json', JSON.stringify(state.result));

// Subsequent runs: Restore state
const savedState = JSON.parse(fs.readFileSync('session.json'));
await browserManager.executeAction({ type: 'import_state', state: savedState });
// Now logged in without repeating login flow
```

---

## Monitoring and Observability

### 1. Logging

The system provides comprehensive logging:

```typescript
import { getLogger } from './browser-automation/logger.js';

const logger = getLogger();

// Configure log level
logger.setLevel('debug'); // debug, info, warn, error

// Log custom events
logger.log('info', 'Custom event', { data: 'value' });

// Logs are automatically generated for:
// - Browser launches and closes
// - Action executions
// - Errors and failures
// - Connection events
```

**Log Output Example:**

```
[2024-01-15 10:30:45] INFO: Browser launched
  browserId: browser-abc123
  profile: openclaw
  
[2024-01-15 10:30:46] INFO: Action executed
  action: navigate
  url: https://example.com
  executionTime: 1250ms
  success: true
  
[2024-01-15 10:30:50] ERROR: Action failed
  action: click
  selector: button#nonexistent
  error: Element not found
  code: ELEMENT_NOT_FOUND
```

### 2. Metrics Collection

The system collects performance and usage metrics:

```typescript
import { getMetricsCollector } from './browser-automation/metrics-collector.js';

const metrics = getMetricsCollector();

// Get current metrics
const currentMetrics = metrics.getMetrics();
console.log('Metrics:', {
  totalActions: currentMetrics.totalActions,
  successfulActions: currentMetrics.successfulActions,
  failedActions: currentMetrics.failedActions,
  averageExecutionTime: currentMetrics.averageExecutionTime,
  browserLaunches: currentMetrics.browserLaunches,
  browserCrashes: currentMetrics.browserCrashes,
});

// Reset metrics
metrics.reset();
```

**Available Metrics:**

- `totalActions` - Total number of actions executed
- `successfulActions` - Number of successful actions
- `failedActions` - Number of failed actions
- `averageExecutionTime` - Average action execution time (ms)
- `browserLaunches` - Number of browser launches
- `browserCloses` - Number of browser closes
- `browserCrashes` - Number of browser crashes
- `idleTimeouts` - Number of idle timeout events
- `connections` - Connection events (connected/disconnected)


### 3. Event Monitoring

The Browser Manager emits events for monitoring:

```typescript
const browserManager = system.getBrowserManager();

// Monitor browser launches
browserManager.on('browser-launched', (info) => {
  console.log('Browser launched:', info.browserId);
  // Send to monitoring system
});

// Monitor browser closes
browserManager.on('browser-closed', (info) => {
  console.log('Browser closed:', info.browserId);
});

// Monitor crashes
browserManager.on('browser-crashed', (info) => {
  console.error('Browser crashed:', info.reason);
  // Alert on-call engineer
});

// Monitor idle timeouts
browserManager.on('browser-idle-timeout', (info) => {
  console.log('Browser idle timeout:', info.browserId);
});

// Monitor restarts
browserManager.on('browser-restarted-after-idle', (info) => {
  console.log('Browser restarted:', info.browserId);
});
```

### 4. Health Checks

Implement health checks for monitoring:

```typescript
// HTTP health check endpoint
app.get('/health/browser-automation', async (req, res) => {
  try {
    const browserManager = system.getBrowserManager();
    const metrics = getMetricsCollector().getMetrics();
    
    // Check if system is running
    const isRunning = browserManager.isStarted();
    
    // Check browser count
    const browsers = browserManager.listBrowsers();
    
    // Check error rate
    const errorRate = metrics.failedActions / metrics.totalActions;
    
    const health = {
      status: isRunning ? 'healthy' : 'unhealthy',
      browsers: {
        active: browsers.length,
        maxAllowed: 5,
      },
      metrics: {
        totalActions: metrics.totalActions,
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        averageExecutionTime: `${metrics.averageExecutionTime}ms`,
      },
      timestamp: new Date().toISOString(),
    };
    
    res.status(isRunning ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});
```

### 5. Prometheus Metrics Integration

Export metrics in Prometheus format:

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Define metrics
const actionCounter = new Counter({
  name: 'browser_automation_actions_total',
  help: 'Total number of browser actions',
  labelNames: ['action_type', 'status'],
});

const actionDuration = new Histogram({
  name: 'browser_automation_action_duration_seconds',
  help: 'Browser action duration in seconds',
  labelNames: ['action_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

const activeBrowsers = new Gauge({
  name: 'browser_automation_active_browsers',
  help: 'Number of active browser instances',
});

// Update metrics on actions
browserManager.on('action-executed', (info) => {
  actionCounter.inc({
    action_type: info.action.type,
    status: info.success ? 'success' : 'failure',
  });
  
  actionDuration.observe(
    { action_type: info.action.type },
    info.executionTime / 1000
  );
});

// Update browser count
setInterval(() => {
  activeBrowsers.set(browserManager.listBrowsers().length);
}, 10000);

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
try {
  const result = await browserManager.executeAction(action);
  
  if (!result.success) {
    // Handle action failure
    console.error('Action failed:', result.error);
    
    // Retry logic
    if (result.error.code === 'TIMEOUT') {
      // Retry with longer timeout
      action.timeout = action.timeout * 2;
      return await browserManager.executeAction(action);
    }
  }
  
  return result;
} catch (error) {
  // Handle unexpected errors
  console.error('Unexpected error:', error);
  
  // Attempt recovery
  await browserManager.stop();
  await browserManager.start();
}
```

### 2. Resource Cleanup

Always clean up resources:

```typescript
let browserManager;

try {
  browserManager = await initializeBrowserAutomation();
  // ... use browser automation ...
} finally {
  // Always cleanup, even if errors occur
  if (browserManager) {
    await shutdownBrowserAutomation();
  }
}
```

### 3. Configuration Management

Use environment-specific configurations:

```typescript
const config = {
  browser: {
    headless: process.env.NODE_ENV === 'production',
    defaultTimeout: process.env.BROWSER_TIMEOUT || 30000,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
```

### 4. Testing

Test browser automation in isolation:

```typescript
describe('Browser Automation', () => {
  let system;
  
  beforeAll(async () => {
    system = await initializeBrowserAutomation({
      browser: { headless: true },
    });
  });
  
  afterAll(async () => {
    await shutdownBrowserAutomation();
  });
  
  test('should navigate to URL', async () => {
    const browserManager = system.getBrowserManager();
    const result = await browserManager.executeAction({
      type: 'navigate',
      url: 'https://example.com',
    });
    
    expect(result.success).toBe(true);
    expect(result.result.url).toBe('https://example.com/');
  });
});
```

---

## Additional Resources

- [API Documentation](./API.md) - Complete API reference
- [Examples](./examples/README.md) - Usage examples
- [Configuration Guide](./config/README.md) - Configuration options
- [Tool Adapters Guide](./tool-adapters/README.md) - Tool development
- [Requirements](../../.kiro/specs/browser-automation/requirements.md) - System requirements
- [Design Document](../../.kiro/specs/browser-automation/design.md) - Architecture and design

## Support

For issues and questions:

1. Check the [Troubleshooting](#troubleshooting-common-issues) section
2. Review the [Examples](./examples/README.md)
3. Check the [API Documentation](./API.md)
4. Open an issue on GitHub

---

**Last Updated:** 2024-01-15
**Version:** 1.0.0
