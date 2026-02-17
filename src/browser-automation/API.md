# Browser Automation API Documentation

Complete API reference for the Browser Automation system.

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
  - [BrowserManager](#browsermanager)
  - [CDPClient](#cdpclient)
  - [PlaywrightAdapter](#playwrightadapter)
  - [StateManager](#statemanager)
  - [ProfileManager](#profilemanager)
  - [ControlServer](#controlserver)
- [Tool Adapters](#tool-adapters)
- [Configuration](#configuration)
- [Error Codes](#error-codes)
- [Type Definitions](#type-definitions)

---

## Overview

The Browser Automation API provides programmatic control over Chrome/Chromium browsers using the Chrome DevTools Protocol (CDP) and Playwright. The system supports multiple browser profiles, comprehensive action capabilities, state management, and tool integration.

**Key Features:**
- Multi-profile browser support (isolated, extension, remote)
- Comprehensive browser actions (navigate, click, type, screenshot, etc.)
- State management (cookies, localStorage, sessionStorage)
- Security-first design (loopback-only control, isolated profiles)
- Tool integration for LLM function calling

---

## Core Components

### BrowserManager

Central orchestrator for browser lifecycle and operations.

#### Constructor

```typescript
constructor(
  profileManager: ProfileManager,
  idleTimeout: number = 300000
)
```

**Parameters:**
- `profileManager` - Profile manager instance for managing browser profiles
- `idleTimeout` - Time in milliseconds before closing idle browsers (default: 5 minutes)

#### Methods

##### start()

Start the browser manager and idle timeout checker.

```typescript
async start(): Promise<void>
```

**Example:**
```typescript
const browserManager = new BrowserManager(profileManager);
await browserManager.start();
```

---

##### stop()

Stop the browser manager and close all browsers.

```typescript
async stop(): Promise<void>
```

**Example:**
```typescript
await browserManager.stop();
```

---

##### launchBrowser()

Launch a new browser instance with the specified profile.

```typescript
async launchBrowser(profile: BrowserProfile): Promise<Browser>
```

**Parameters:**
- `profile` - Browser profile configuration

**Returns:** Browser instance with CDP endpoint and Playwright browser

**Throws:**
- `Error` if browser launch fails
- `Error` if CDP connection fails

**Example:**
```typescript
const profile = profileManager.getProfile('openclaw');
const browser = await browserManager.launchBrowser(profile);
console.log('Browser launched:', browser.id);
```

---

##### closeBrowser()

Close a specific browser instance.

```typescript
async closeBrowser(browserId: string): Promise<void>
```

**Parameters:**
- `browserId` - Unique identifier of the browser to close

**Example:**
```typescript
await browserManager.closeBrowser('browser-123');
```

---

##### getActiveBrowser()

Get the currently active browser instance.

```typescript
getActiveBrowser(): Browser | null
```

**Returns:** Active browser or null if no browser is active

**Example:**
```typescript
const browser = browserManager.getActiveBrowser();
if (browser) {
  console.log('Active browser:', browser.id);
}
```

---

##### executeAction()

Execute a browser action on the active browser.

```typescript
async executeAction(action: BrowserAction): Promise<ActionResult>
```

**Parameters:**
- `action` - Browser action to execute (navigate, click, type, etc.)

**Returns:** Action result with success status, data, and execution time

**Example:**
```typescript
const result = await browserManager.executeAction({
  type: 'navigate',
  url: 'https://example.com',
  waitUntil: 'networkidle',
});

if (result.success) {
  console.log('Navigation successful:', result.result);
} else {
  console.error('Navigation failed:', result.error);
}
```

---

##### switchProfile()

Switch to a different browser profile.

```typescript
async switchProfile(profileName: string): Promise<void>
```

**Parameters:**
- `profileName` - Name of the profile to switch to

**Throws:**
- `Error` if profile not found
- `Error` if browser launch fails

**Example:**
```typescript
await browserManager.switchProfile('chrome-extension');
```

---

##### getCurrentProfile()

Get the current active profile.

```typescript
getCurrentProfile(): BrowserProfile | null
```

**Returns:** Current profile or null if no profile is active

---

##### listBrowsers()

List all active browser instances.

```typescript
listBrowsers(): Browser[]
```

**Returns:** Array of active browser instances

---

### CDPClient

Low-level Chrome DevTools Protocol client for browser communication.

#### Constructor

```typescript
constructor()
```

#### Methods

##### connect()

Connect to a browser via CDP WebSocket endpoint.

```typescript
async connect(endpoint: string): Promise<void>
```

**Parameters:**
- `endpoint` - WebSocket endpoint URL (e.g., `ws://127.0.0.1:9222/devtools/browser/...`)

**Throws:**
- `Error` if connection fails
- `Error` if endpoint is invalid

**Example:**
```typescript
const cdpClient = new CDPClient();
await cdpClient.connect('ws://127.0.0.1:9222/devtools/browser/abc123');
```

---

##### disconnect()

Disconnect from the browser.

```typescript
async disconnect(): Promise<void>
```

---

##### isConnected()

Check if the client is connected to a browser.

```typescript
isConnected(): boolean
```

**Returns:** True if connected, false otherwise

---

##### sendCommand()

Send a CDP command to the browser.

```typescript
async sendCommand(method: string, params?: any): Promise<any>
```

**Parameters:**
- `method` - CDP method name (e.g., `'Page.navigate'`, `'Runtime.evaluate'`)
- `params` - Optional parameters for the command

**Returns:** Command response from the browser

**Throws:**
- `Error` if not connected
- `Error` if command fails

**Example:**
```typescript
const result = await cdpClient.sendCommand('Page.navigate', {
  url: 'https://example.com'
});
```

---

##### on()

Register an event handler for CDP events.

```typescript
on(event: string, handler: (params: any) => void): void
```

**Parameters:**
- `event` - CDP event name (e.g., `'Page.loadEventFired'`)
- `handler` - Event handler function

**Example:**
```typescript
cdpClient.on('Page.loadEventFired', (params) => {
  console.log('Page loaded:', params);
});
```

---

##### off()

Unregister an event handler.

```typescript
off(event: string, handler: (params: any) => void): void
```

---

##### getBrowserVersion()

Get browser version information.

```typescript
async getBrowserVersion(): Promise<BrowserVersion>
```

**Returns:** Browser version details including protocol version, user agent, etc.

**Example:**
```typescript
const version = await cdpClient.getBrowserVersion();
console.log('Browser:', version.browser);
console.log('Protocol:', version.protocolVersion);
```

---

### PlaywrightAdapter

High-level browser action execution using Playwright.

#### Constructor

```typescript
constructor()
```

#### Methods

##### initialize()

Initialize the adapter and connect to a browser via CDP.

```typescript
async initialize(cdpEndpoint: string): Promise<void>
```

**Parameters:**
- `cdpEndpoint` - CDP WebSocket endpoint URL

**Throws:**
- `Error` if connection fails

**Example:**
```typescript
const adapter = new PlaywrightAdapter();
await adapter.initialize('ws://127.0.0.1:9222/devtools/browser/abc123');
```

---

##### close()

Close the adapter and disconnect from the browser.

```typescript
async close(): Promise<void>
```

---

##### navigate()

Navigate to a URL.

```typescript
async navigate(
  url: string,
  options?: NavigateOptions
): Promise<NavigateResult>
```

**Parameters:**
- `url` - URL to navigate to
- `options` - Navigation options (waitUntil, timeout)

**Returns:** Navigation result with URL, status, title, and load time

**Example:**
```typescript
const result = await adapter.navigate('https://example.com', {
  waitUntil: 'networkidle',
  timeout: 30000,
});
console.log('Loaded:', result.title);
```

---

##### click()

Click an element on the page.

```typescript
async click(
  selector: string,
  options?: ClickOptions
): Promise<void>
```

**Parameters:**
- `selector` - CSS selector or XPath for the element
- `options` - Click options (button, clickCount, delay, timeout)

**Throws:**
- `Error` if element not found
- `Error` if timeout exceeded

**Example:**
```typescript
await adapter.click('button#submit', {
  button: 'left',
  clickCount: 1,
  timeout: 5000,
});
```

---

##### type()

Type text into an input element.

```typescript
async type(
  selector: string,
  text: string,
  options?: TypeOptions
): Promise<void>
```

**Parameters:**
- `selector` - CSS selector or XPath for the input element
- `text` - Text to type
- `options` - Type options (delay, timeout)

**Example:**
```typescript
await adapter.type('input[name="email"]', 'user@example.com', {
  delay: 50,
  timeout: 5000,
});
```

---

##### screenshot()

Take a screenshot of the page.

```typescript
async screenshot(options?: ScreenshotOptions): Promise<Buffer>
```

**Parameters:**
- `options` - Screenshot options (type, quality, fullPage, clip, path)

**Returns:** Screenshot image as a Buffer

**Example:**
```typescript
const screenshot = await adapter.screenshot({
  type: 'png',
  fullPage: true,
  path: './screenshot.png',
});
```

---

##### evaluate()

Execute JavaScript in the page context.

```typescript
async evaluate(script: string): Promise<any>
```

**Parameters:**
- `script` - JavaScript code to execute

**Returns:** Result of the script execution

**Example:**
```typescript
const title = await adapter.evaluate('document.title');
console.log('Page title:', title);
```

---

##### waitForSelector()

Wait for an element to appear on the page.

```typescript
async waitForSelector(
  selector: string,
  options?: WaitOptions
): Promise<void>
```

**Parameters:**
- `selector` - CSS selector or XPath for the element
- `options` - Wait options (timeout, state)

**Throws:**
- `Error` if timeout exceeded

**Example:**
```typescript
await adapter.waitForSelector('.loading-complete', {
  state: 'visible',
  timeout: 10000,
});
```

---

### StateManager

Manages browser state including cookies, storage, and geolocation.

#### Constructor

```typescript
constructor(cdpClient: CDPClient, playwrightAdapter: PlaywrightAdapter)
```

**Parameters:**
- `cdpClient` - CDP client instance
- `playwrightAdapter` - Playwright adapter instance

#### Methods

##### getCookies()

Get all cookies for the current domain or all domains.

```typescript
async getCookies(domain?: string): Promise<Cookie[]>
```

**Parameters:**
- `domain` - Optional domain filter

**Returns:** Array of cookies

**Example:**
```typescript
const cookies = await stateManager.getCookies('example.com');
console.log('Cookies:', cookies);
```

---

##### setCookies()

Set one or more cookies.

```typescript
async setCookies(cookies: Cookie[]): Promise<void>
```

**Parameters:**
- `cookies` - Array of cookies to set

**Example:**
```typescript
await stateManager.setCookies([
  {
    name: 'session',
    value: 'abc123',
    domain: 'example.com',
    path: '/',
    expires: Date.now() + 86400000,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  },
]);
```

---

##### deleteCookies()

Delete cookies matching the specified filter.

```typescript
async deleteCookies(filter: CookieFilter): Promise<void>
```

**Parameters:**
- `filter` - Cookie filter (name, domain, path)

**Example:**
```typescript
await stateManager.deleteCookies({
  name: 'session',
  domain: 'example.com',
});
```

---

##### getLocalStorage()

Get localStorage items for the current origin.

```typescript
async getLocalStorage(origin: string): Promise<Record<string, string>>
```

**Parameters:**
- `origin` - Origin URL (e.g., `https://example.com`)

**Returns:** Object with key-value pairs from localStorage

**Example:**
```typescript
const storage = await stateManager.getLocalStorage('https://example.com');
console.log('localStorage:', storage);
```

---

##### setLocalStorage()

Set localStorage items for the current origin.

```typescript
async setLocalStorage(
  origin: string,
  items: Record<string, string>
): Promise<void>
```

**Parameters:**
- `origin` - Origin URL
- `items` - Key-value pairs to set

**Example:**
```typescript
await stateManager.setLocalStorage('https://example.com', {
  theme: 'dark',
  language: 'en',
});
```

---

##### exportState()

Export all browser state to a JSON object.

```typescript
async exportState(): Promise<BrowserState>
```

**Returns:** Browser state object with cookies, localStorage, sessionStorage, and geolocation

**Example:**
```typescript
const state = await stateManager.exportState();
console.log('Exported state:', JSON.stringify(state, null, 2));
```

---

##### importState()

Import browser state from a JSON object.

```typescript
async importState(state: BrowserState): Promise<void>
```

**Parameters:**
- `state` - Browser state object to import

**Example:**
```typescript
await stateManager.importState(savedState);
```

---

##### clearAllState()

Clear all browser state (cookies, storage, cache).

```typescript
async clearAllState(): Promise<void>
```

**Example:**
```typescript
await stateManager.clearAllState();
```

---

### ProfileManager

Manages browser profiles and their configurations.

#### Constructor

```typescript
constructor(
  userDataBaseDir: string = './.browser-data',
  profiles: BrowserProfile[] = DEFAULT_PROFILES
)
```

**Parameters:**
- `userDataBaseDir` - Base directory for user data
- `profiles` - Array of browser profiles

#### Methods

##### getProfile()

Get a profile by name.

```typescript
getProfile(name: string): BrowserProfile | null
```

**Parameters:**
- `name` - Profile name

**Returns:** Profile or null if not found

**Example:**
```typescript
const profile = profileManager.getProfile('openclaw');
```

---

##### listProfiles()

List all available profiles.

```typescript
listProfiles(): BrowserProfile[]
```

**Returns:** Array of all profiles

---

##### createProfile()

Create a new profile.

```typescript
async createProfile(profile: BrowserProfile): Promise<void>
```

**Parameters:**
- `profile` - Profile configuration

**Throws:**
- `Error` if profile name already exists
- `Error` if profile validation fails

**Example:**
```typescript
await profileManager.createProfile({
  name: 'my-profile',
  type: 'openclaw',
  userDataDir: './.browser-data/my-profile',
  launchOptions: {
    headless: false,
    args: [],
    defaultViewport: { width: 1280, height: 720 },
    timeout: 30000,
  },
});
```

---

##### getDefaultProfile()

Get the default profile.

```typescript
getDefaultProfile(): BrowserProfile
```

**Returns:** Default profile (openclaw)

---

### ControlServer

HTTP/WebSocket server for browser control (loopback-only).

#### Constructor

```typescript
constructor(browserManager: BrowserManager)
```

**Parameters:**
- `browserManager` - Browser manager instance

#### Methods

##### start()

Start the control server.

```typescript
async start(port: number = 18791): Promise<void>
```

**Parameters:**
- `port` - Port to bind the server (default: 18791)

**Throws:**
- `Error` if port is already in use
- `Error` if binding fails

**Example:**
```typescript
const server = new ControlServer(browserManager);
await server.start(18791);
console.log('Server started on http://127.0.0.1:18791');
```

---

##### stop()

Stop the control server.

```typescript
async stop(): Promise<void>
```

---

##### isRunning()

Check if the server is running.

```typescript
isRunning(): boolean
```

**Returns:** True if running, false otherwise

---

##### getPort()

Get the server port.

```typescript
getPort(): number
```

**Returns:** Port number

---

##### getAddress()

Get the server address.

```typescript
getAddress(): string
```

**Returns:** Server address (e.g., `http://127.0.0.1:18791`)

---

## Tool Adapters

Tool adapters expose browser capabilities as function calling tools with OpenAI-compatible schemas.

### Available Tools

#### Navigation Tools

- **browser_navigate** - Navigate to a URL
- **browser_back** - Go back in history
- **browser_forward** - Go forward in history
- **browser_reload** - Reload current page

#### Interaction Tools

- **browser_click** - Click an element
- **browser_type** - Type text into an input
- **browser_fill** - Fill an input with text
- **browser_hover** - Hover over an element
- **browser_select** - Select an option from a dropdown

#### Capture Tools

- **browser_screenshot** - Take a screenshot
- **browser_snapshot** - Capture page snapshot (DOM + accessibility tree)
- **browser_pdf** - Generate a PDF of the page

#### State Management Tools

- **browser_get_cookies** - Get cookies
- **browser_set_cookies** - Set cookies
- **browser_get_local_storage** - Get localStorage
- **browser_set_local_storage** - Set localStorage

#### Utility Tools

- **browser_execute_js** - Execute JavaScript
- **browser_wait_for_selector** - Wait for an element
- **browser_scroll** - Scroll the page
- **browser_wait_for_navigation** - Wait for navigation
- **browser_wait_for_load_state** - Wait for load state

### Tool Schema Format

All tools follow the OpenAI function calling schema format:

```typescript
interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterSchema>;
    required: string[];
  };
}
```

### Using Tools

```typescript
import { getToolRegistry } from '../tools/tool-registry';

// Get the registry
const registry = getToolRegistry();

// Get a tool
const navigateTool = registry.getTool('browser_navigate');

// Get the schema
const schema = navigateTool.schema;

// Execute the tool
const result = await navigateTool.executor(
  { url: 'https://example.com' },
  { conversationId: 'test', timestamp: Date.now() }
);
```

---

## Configuration

### Configuration Object

```typescript
interface BrowserAutomationConfig {
  controlServer: {
    enabled: boolean;
    port: number;
    host: string;
  };
  browser: {
    executablePath?: string;
    defaultProfile: string;
    headless: boolean;
    defaultViewport: { width: number; height: number };
    defaultTimeout: number;
    idleTimeout: number;
  };
  profiles: BrowserProfile[];
  paths: {
    userDataBaseDir: string;
    screenshotDir: string;
    downloadDir: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logActions: boolean;
    logErrors: boolean;
  };
  security: {
    allowRemoteProfiles: boolean;
    validateSelectors: boolean;
    sanitizeFilePaths: boolean;
  };
}
```

### Loading Configuration

```typescript
import { loadConfig } from './config';

// Load with defaults
const config = loadConfig();

// Load with custom config
const config = loadConfig({
  browser: {
    headless: true,
  },
});

// Load from file
const config = loadConfig(undefined, './my-config.json');
```

See [Configuration README](./config/README.md) for complete configuration documentation.

---

## Error Codes

### Connection Errors

- **`BROWSER_DISCONNECTED`** - Browser disconnected unexpectedly
- **`CDP_CONNECTION_FAILED`** - Failed to establish CDP connection
- **`NETWORK_ERROR`** - Network error occurred

### Action Errors

- **`ELEMENT_NOT_FOUND`** - Element not found on page
- **`TIMEOUT`** - Action timeout exceeded
- **`NAVIGATION_FAILED`** - Navigation failed
- **`INVALID_SELECTOR`** - Invalid CSS selector or XPath
- **`SCRIPT_ERROR`** - JavaScript execution error

### Validation Errors

- **`VALIDATION_ERROR`** - Parameter validation failed
- **`ACTION_VALIDATION_ERROR`** - Action validation failed
- **`CONVERSION_ERROR`** - Failed to convert parameters to action

### Security Errors

- **`PERMISSION_DENIED`** - Permission denied
- **`INJECTION_DETECTED`** - Injection attempt detected
- **`PATH_TRAVERSAL_DETECTED`** - Path traversal attempt detected

### System Errors

- **`CONFIGURATION_ERROR`** - Configuration error
- **`INITIALIZATION_ERROR`** - Initialization failed
- **`UNKNOWN_ERROR`** - Unknown error occurred

---

## Type Definitions

### BrowserProfile

```typescript
interface BrowserProfile {
  name: string;
  type: 'openclaw' | 'chrome-extension' | 'remote';
  userDataDir: string;
  launchOptions: LaunchOptions;
  connectionOptions?: ConnectionOptions;
}
```

### LaunchOptions

```typescript
interface LaunchOptions {
  headless: boolean;
  executablePath?: string;
  args: string[];
  defaultViewport: { width: number; height: number };
  timeout: number;
}
```

### Browser

```typescript
interface Browser {
  id: string;
  profile: BrowserProfile;
  cdpEndpoint: string;
  playwrightBrowser: PlaywrightBrowser;
  createdAt: number;
  lastUsedAt: number;
}
```

### BrowserAction

```typescript
type BrowserAction =
  | NavigateAction
  | ClickAction
  | TypeAction
  | ScreenshotAction
  | SnapshotAction
  | ExecuteJSAction
  | WaitAction
  | ScrollAction;
```

### ActionResult

```typescript
interface ActionResult {
  success: boolean;
  action: BrowserAction;
  result?: any;
  error?: ActionError;
  executionTime: number;
  timestamp: number;
}
```

### Cookie

```typescript
interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}
```

### BrowserState

```typescript
interface BrowserState {
  cookies: Cookie[];
  localStorage: Record<string, Record<string, string>>;
  sessionStorage: Record<string, Record<string, string>>;
  geolocation?: GeolocationCoords;
  version: string;
}
```

---

## See Also

- [README](./README.md) - Module overview
- [Integration Guide](./INTEGRATION.md) - System integration
- [Configuration Guide](./config/README.md) - Configuration options
- [Tool Adapters Guide](./tool-adapters/README.md) - Tool adapter development
- [Examples](./examples/) - Usage examples
