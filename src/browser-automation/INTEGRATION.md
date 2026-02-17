# Browser Automation System Integration Guide

This document describes how all components of the Browser Automation System are wired together and how to use the system.

## Architecture Overview

The Browser Automation System consists of several key components that work together:

```
┌─────────────────────────────────────────────────────────────┐
│                 BrowserAutomationSystem                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Initialization & Wiring                 │  │
│  │  - Loads configuration                               │  │
│  │  - Creates all components                            │  │
│  │  - Registers tools in Tool Registry                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Profile    │  │   Browser    │  │   Control    │    │
│  │   Manager    │──│   Manager    │──│   Server     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                           │                                 │
│                    ┌──────┴──────┐                         │
│                    │             │                         │
│              ┌─────▼────┐  ┌────▼─────┐                   │
│              │   CDP    │  │Playwright│                   │
│              │  Client  │  │ Adapter  │                   │
│              └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │Tool Registry │
              │  (21 tools)  │
              └──────────────┘
```

## Component Wiring

### 1. Profile Manager

The Profile Manager is initialized first with:
- User data base directory path
- List of available profiles (openclaw, chrome-extension, remote)

```typescript
const profileManager = new ProfileManager(
  config.paths.userDataBaseDir,
  config.profiles
);
```

### 2. Browser Manager

The Browser Manager is initialized with:
- Profile Manager instance (for profile management)
- Idle timeout configuration (for automatic cleanup)

```typescript
const browserManager = new BrowserManager(
  profileManager,
  config.browser.idleTimeout
);
```

The Browser Manager internally creates:
- CDP Client instances (for low-level browser control)
- Playwright Adapter instances (for high-level actions)
- State Manager instances (for cookies, storage, etc.)

### 3. Control Server

The Control Server is initialized with:
- Browser Manager instance (for handling browser operations)

```typescript
const controlServer = new ControlServer(browserManager);
```

### 4. Tool Registration

All browser tool adapters are registered in the Tool Registry:

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

## Usage

### Quick Start

The simplest way to get started:

```typescript
import { quickStart, shutdownBrowserAutomation } from './browser-automation';

// Initialize with development defaults
const system = await quickStart();

// Use the system...

// Shutdown when done
await shutdownBrowserAutomation();
```

### Custom Configuration

For more control over configuration:

```typescript
import { initializeBrowserAutomation, shutdownBrowserAutomation } from './browser-automation';

// Initialize with custom config
const system = await initializeBrowserAutomation({
  controlServer: {
    enabled: true,
    port: 18791,
    host: '127.0.0.1',
  },
  browser: {
    headless: false,
    defaultProfile: 'openclaw',
    defaultTimeout: 30000,
    idleTimeout: 300000,
  },
  logging: {
    level: 'info',
    logActions: true,
    logErrors: true,
  },
});

// Use the system...

// Shutdown when done
await shutdownBrowserAutomation();
```

### Accessing Components

Once initialized, you can access individual components:

```typescript
const system = await initializeBrowserAutomation();

// Access Browser Manager
const browserManager = system.getBrowserManager();
const browsers = browserManager.listBrowsers();

// Access Control Server
const controlServer = system.getControlServer();
const serverAddress = controlServer.getAddress();

// Access Profile Manager
const profileManager = system.getProfileManager();
const profiles = profileManager.listProfiles();
```

### Using Tools

Tools are automatically registered in the Tool Registry:

```typescript
import { getToolRegistry } from '../tools/tool-registry';

// Get the registry
const registry = getToolRegistry();

// Get a specific tool
const navigateTool = registry.getTool('browser_navigate');

// Execute the tool
const result = await navigateTool.executor(
  { url: 'https://example.com' },
  { conversationId: 'test', timestamp: Date.now() }
);
```

## Initialization Sequence

When `initialize()` is called, the following happens in order:

1. **Configuration Validation**
   - Validates control server host (must be 127.0.0.1)
   - Validates port range (1024-65535)
   - Validates timeout values (non-negative)
   - Validates required paths
   - Validates default profile exists

2. **Browser Manager Start**
   - Starts idle timeout checker
   - Prepares for browser launches

3. **Control Server Start** (if enabled)
   - Binds to loopback address (127.0.0.1)
   - Starts HTTP server on configured port
   - Sets up API endpoints

4. **Default Browser Launch** (if configured)
   - Launches browser with default profile
   - Establishes CDP connection
   - Initializes Playwright adapter

5. **Tool Registration**
   - Creates all tool adapter instances
   - Registers each tool in Tool Registry
   - Validates tool schemas

## Shutdown Sequence

When `shutdown()` is called, the following happens in order:

1. **Close All Browsers**
   - Closes each browser instance
   - Disconnects CDP clients
   - Cleans up Playwright adapters

2. **Stop Browser Manager**
   - Stops idle timeout checker
   - Releases all resources

3. **Stop Control Server**
   - Closes all HTTP connections
   - Stops server

4. **Clean Up Temporary Files**
   - Removes temporary screenshots
   - Removes temporary downloads
   - Cleans up other temp files

## Error Handling

The system includes comprehensive error handling:

### Initialization Errors

If initialization fails, the system automatically attempts cleanup:

```typescript
try {
  await system.initialize();
} catch (error) {
  // System automatically calls shutdown() on init failure
  console.error('Initialization failed:', error);
}
```

### Runtime Errors

Runtime errors are logged and returned in structured format:

```typescript
const result = await browserManager.executeAction(action);
if (!result.success) {
  console.error('Action failed:', result.error);
  // Error includes: code, message, details
}
```

### Shutdown Errors

Shutdown is designed to be resilient:

```typescript
// Graceful shutdown with timeout
await gracefulShutdown({ timeout: 30000 });

// Force shutdown (skip cleanup)
await gracefulShutdown({ force: true });
```

## Signal Handlers

Register signal handlers for graceful shutdown on process termination:

```typescript
import { registerShutdownHandlers } from './browser-automation';

// Register handlers at application startup
registerShutdownHandlers();

// Now SIGINT, SIGTERM, uncaughtException, and unhandledRejection
// will trigger graceful shutdown
```

## Configuration Options

### Control Server

```typescript
controlServer: {
  enabled: boolean;        // Enable/disable server
  port: number;           // Port (1024-65535)
  host: string;           // Must be '127.0.0.1'
}
```

### Browser

```typescript
browser: {
  executablePath?: string;     // Custom Chrome path
  defaultProfile: string;      // Default profile name
  headless: boolean;           // Headless mode
  defaultViewport: {           // Default viewport size
    width: number;
    height: number;
  };
  defaultTimeout: number;      // Action timeout (ms)
  idleTimeout: number;         // Idle timeout (ms)
}
```

### Paths

```typescript
paths: {
  userDataBaseDir: string;     // User data directory
  screenshotDir: string;       // Screenshot directory
  downloadDir: string;         // Download directory
}
```

### Logging

```typescript
logging: {
  level: 'debug' | 'info' | 'warn' | 'error';
  logActions: boolean;         // Log all actions
  logErrors: boolean;          // Log all errors
}
```

## Examples

See the `examples/` directory for complete examples:

- `system-integration-demo.ts` - Complete integration demo
- `action-execution-demo.ts` - Action execution examples
- `tool-adapter-demo.ts` - Tool adapter usage
- `control-server-demo.ts` - Control server API usage

## Testing

Integration tests verify the wiring:

```bash
npm test -- src/browser-automation/__tests__/integration/system-integration.test.ts
```

## Requirements Validation

This integration satisfies the following requirements:

- **Requirement 1.1**: Control Server binds to 127.0.0.1:18791
- **Requirement 10.12**: Tools registered in Tool Registry
- **Requirement 12.1**: System launches default browser on startup
- **Requirement 12.2**: System gracefully closes all browsers on shutdown

