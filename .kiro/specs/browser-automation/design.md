# Design Document: Browser Automation

## Overview

The Browser Automation feature adds comprehensive web browser control capabilities to Prometheus, enabling automated web interactions, data extraction, testing, and workflow automation. The design is inspired by OpenClaw's proven architecture and integrates seamlessly with Prometheus's existing tool system.

The system consists of several key components:

1. **Browser Manager**: Manages browser lifecycle, profiles, and connections
2. **CDP Client**: Low-level Chrome DevTools Protocol communication
3. **Playwright Adapter**: High-level action execution using Playwright
4. **Control Server**: HTTP/WebSocket server for browser control (loopback-only)
5. **State Manager**: Manages cookies, localStorage, sessionStorage, and other browser state
6. **Tool Adapters**: Exposes browser capabilities as function calling tools
7. **Profile Manager**: Manages multiple browser profiles (openclaw, chrome-extension, remote)

The architecture prioritizes security (loopback-only control, isolated profiles), reliability (error handling, automatic recovery), and developer experience (comprehensive tool schemas, clear error messages).

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Prometheus Core                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Tool Registry                           │  │
│  │  (Function Calling Interface)                        │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │         Browser Tool Adapters                        │  │
│  │  - browser_navigate    - browser_screenshot          │  │
│  │  - browser_click       - browser_snapshot            │  │
│  │  - browser_type        - browser_execute_js          │  │
│  │  - browser_get_cookies - browser_set_cookies         │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
└─────────────────────┼───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│           Browser Automation System                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Browser Manager                         │  │
│  │  - Lifecycle management                              │  │
│  │  - Profile switching                                 │  │
│  │  - Connection pooling                                │  │
│  └──────┬───────────────────────────────────────┬───────┘  │
│         │                                       │           │
│  ┌──────▼──────────┐                   ┌───────▼────────┐  │
│  │  CDP Client     │                   │  Playwright    │  │
│  │  - WebSocket    │                   │  Adapter       │  │
│  │  - Protocol     │                   │  - Actions     │  │
│  │  - Events       │                   │  - Selectors   │  │
│  └──────┬──────────┘                   └───────┬────────┘  │
│         │                                      │           │
│  ┌──────▼──────────────────────────────────────▼────────┐  │
│  │              Control Server                          │  │
│  │  - HTTP API (127.0.0.1:18791)                        │  │
│  │  - WebSocket connections                             │  │
│  └──────┬───────────────────────────────────────────────┘  │
│         │                                                   │
│  ┌──────▼───────────────────────────────────────────────┐  │
│  │         Profile Manager                              │  │
│  │  - openclaw (isolated instance)                      │  │
│  │  - chrome-extension (existing tabs)                  │  │
│  │  - remote (cloud browsers)                           │  │
│  └──────┬───────────────────────────────────────────────┘  │
│         │                                                   │
│  ┌──────▼───────────────────────────────────────────────┐  │
│  │         State Manager                                │  │
│  │  - Cookies                                           │  │
│  │  - localStorage / sessionStorage                     │  │
│  │  - Geolocation                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                      │
                      │ CDP Protocol
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Chrome/Chromium Browser                      │
│  - User Data Directory (isolated per profile)              │
│  - Debugging Port (--remote-debugging-port)                │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

**Action Execution Flow:**
```
LLM Function Call
    ↓
Tool Registry
    ↓
Browser Tool Adapter (validates parameters)
    ↓
Browser Manager (selects active browser)
    ↓
Playwright Adapter (executes action)
    ↓
CDP Client (sends protocol commands)
    ↓
Chrome Browser (performs action)
    ↓
Result (bubbles back up the chain)
```

**Browser Launch Flow:**
```
Browser Manager
    ↓
Profile Manager (loads profile config)
    ↓
Launch Chrome with args:
  - --remote-debugging-port=<dynamic>
  - --user-data-dir=<profile-specific>
  - --no-first-run
  - --no-default-browser-check
    ↓
CDP Client (connects to debugging port)
    ↓
Playwright (connects via CDP endpoint)
    ↓
Browser Ready
```

## Components and Interfaces

### 1. Browser Manager

**Purpose**: Central orchestrator for browser lifecycle and operations.

**Interface:**
```typescript
interface BrowserManager {
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Profile management
  switchProfile(profileName: string): Promise<void>;
  getCurrentProfile(): BrowserProfile;
  listProfiles(): BrowserProfile[];
  
  // Browser operations
  launchBrowser(profile: BrowserProfile): Promise<Browser>;
  closeBrowser(browserId: string): Promise<void>;
  getActiveBrowser(): Browser | null;
  
  // Action execution
  executeAction(action: BrowserAction): Promise<ActionResult>;
  
  // State management
  getState(): Promise<BrowserState>;
  setState(state: BrowserState): Promise<void>;
  clearState(): Promise<void>;
}

interface BrowserProfile {
  name: string;
  type: 'openclaw' | 'chrome-extension' | 'remote';
  userDataDir: string;
  launchOptions: LaunchOptions;
  connectionOptions?: ConnectionOptions;
}

interface LaunchOptions {
  headless: boolean;
  executablePath?: string;
  args: string[];
  defaultViewport: { width: number; height: number };
  timeout: number;
}

interface ConnectionOptions {
  wsEndpoint?: string; // For remote
  extensionId?: string; // For chrome-extension
  gatewayUrl?: string; // For remote with gateway
  authToken?: string; // For remote with gateway
}

interface Browser {
  id: string;
  profile: BrowserProfile;
  cdpEndpoint: string;
  playwrightBrowser: PlaywrightBrowser;
  createdAt: number;
  lastUsedAt: number;
}
```

**Key Responsibilities:**
- Launch and manage browser instances
- Switch between profiles
- Route actions to appropriate browser
- Handle browser crashes and reconnections
- Implement idle timeout and cleanup

### 2. CDP Client

**Purpose**: Low-level Chrome DevTools Protocol communication.

**Interface:**
```typescript
interface CDPClient {
  // Connection
  connect(endpoint: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Protocol methods
  sendCommand(method: string, params?: any): Promise<any>;
  on(event: string, handler: (params: any) => void): void;
  off(event: string, handler: (params: any) => void): void;
  
  // Common operations
  getBrowserVersion(): Promise<BrowserVersion>;
  getTargets(): Promise<Target[]>;
  createTarget(url: string): Promise<Target>;
  closeTarget(targetId: string): Promise<void>;
}

interface BrowserVersion {
  browser: string;
  protocolVersion: string;
  userAgent: string;
  v8Version: string;
  webKitVersion: string;
}

interface Target {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
}
```

**Key Responsibilities:**
- Establish WebSocket connection to browser
- Send CDP commands and receive responses
- Handle CDP events
- Manage target (tab/page) lifecycle
- Provide browser metadata

### 3. Playwright Adapter

**Purpose**: High-level action execution using Playwright.

**Interface:**
```typescript
interface PlaywrightAdapter {
  // Initialization
  initialize(cdpEndpoint: string): Promise<void>;
  close(): Promise<void>;
  
  // Navigation
  navigate(url: string, options?: NavigateOptions): Promise<NavigateResult>;
  goBack(): Promise<void>;
  goForward(): Promise<void>;
  reload(): Promise<void>;
  
  // Interaction
  click(selector: string, options?: ClickOptions): Promise<void>;
  type(selector: string, text: string, options?: TypeOptions): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  select(selector: string, values: string[]): Promise<void>;
  hover(selector: string): Promise<void>;
  
  // Capture
  screenshot(options?: ScreenshotOptions): Promise<Buffer>;
  pdf(options?: PDFOptions): Promise<Buffer>;
  snapshot(): Promise<PageSnapshot>;
  
  // Evaluation
  evaluate(script: string): Promise<any>;
  evaluateHandle(script: string): Promise<any>;
  
  // Waiting
  waitForSelector(selector: string, options?: WaitOptions): Promise<void>;
  waitForNavigation(options?: WaitOptions): Promise<void>;
  waitForLoadState(state: LoadState): Promise<void>;
  
  // State
  getCookies(): Promise<Cookie[]>;
  setCookies(cookies: Cookie[]): Promise<void>;
  getLocalStorage(): Promise<Record<string, string>>;
  setLocalStorage(items: Record<string, string>): Promise<void>;
}

interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

interface NavigateResult {
  url: string;
  status: number;
  title: string;
  loadTime: number;
}

interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
  timeout?: number;
}

interface TypeOptions {
  delay?: number;
  timeout?: number;
}

interface ScreenshotOptions {
  type?: 'png' | 'jpeg';
  quality?: number;
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
  path?: string;
}

interface PDFOptions {
  path?: string;
  format?: string;
  width?: string;
  height?: string;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  printBackground?: boolean;
}

interface PageSnapshot {
  url: string;
  title: string;
  html: string;
  accessibilityTree: AccessibilityNode[];
  viewport: { width: number; height: number };
  timestamp: number;
}

interface AccessibilityNode {
  role: string;
  name: string;
  value?: string;
  children?: AccessibilityNode[];
}

interface WaitOptions {
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

type LoadState = 'load' | 'domcontentloaded' | 'networkidle';

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

**Key Responsibilities:**
- Connect to browser via CDP endpoint
- Execute high-level actions using Playwright API
- Handle element selection and interaction
- Capture screenshots and snapshots
- Manage page state and navigation
- Provide robust error handling and retries

### 4. Control Server

**Purpose**: HTTP/WebSocket server for browser control (loopback-only).

**Interface:**
```typescript
interface ControlServer {
  // Lifecycle
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  
  // Server info
  getPort(): number;
  getAddress(): string;
}

// HTTP API Endpoints
// GET  /health - Health check
// POST /browser/launch - Launch browser with profile
// POST /browser/close - Close browser
// POST /browser/action - Execute action
// GET  /browser/state - Get browser state
// POST /browser/state - Set browser state
// GET  /browser/screenshot - Take screenshot
// GET  /browser/snapshot - Get page snapshot
```

**Key Responsibilities:**
- Bind to loopback address only (127.0.0.1)
- Provide HTTP API for browser control
- Handle WebSocket connections for real-time events
- Validate all incoming requests
- Return structured responses and errors

### 5. State Manager

**Purpose**: Manage browser state including cookies, storage, and geolocation.

**Interface:**
```typescript
interface StateManager {
  // Cookies
  getCookies(domain?: string): Promise<Cookie[]>;
  setCookies(cookies: Cookie[]): Promise<void>;
  deleteCookies(filter: CookieFilter): Promise<void>;
  clearAllCookies(): Promise<void>;
  
  // Storage
  getLocalStorage(origin: string): Promise<Record<string, string>>;
  setLocalStorage(origin: string, items: Record<string, string>): Promise<void>;
  getSessionStorage(origin: string): Promise<Record<string, string>>;
  setSessionStorage(origin: string, items: Record<string, string>): Promise<void>;
  clearStorage(origin: string): Promise<void>;
  
  // Geolocation
  setGeolocation(coords: GeolocationCoords): Promise<void>;
  clearGeolocation(): Promise<void>;
  
  // Full state
  exportState(): Promise<BrowserState>;
  importState(state: BrowserState): Promise<void>;
  clearAllState(): Promise<void>;
}

interface CookieFilter {
  name?: string;
  domain?: string;
  path?: string;
}

interface GeolocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface BrowserState {
  cookies: Cookie[];
  localStorage: Record<string, Record<string, string>>; // origin -> items
  sessionStorage: Record<string, Record<string, string>>; // origin -> items
  geolocation?: GeolocationCoords;
  version: string;
}
```

**Key Responsibilities:**
- Manage cookies across domains
- Manage localStorage and sessionStorage
- Override geolocation
- Export and import full browser state
- Serialize and deserialize state to JSON

### 6. Profile Manager

**Purpose**: Manage multiple browser profiles and their configurations.

**Interface:**
```typescript
interface ProfileManager {
  // Profile operations
  getProfile(name: string): BrowserProfile | null;
  listProfiles(): BrowserProfile[];
  createProfile(profile: BrowserProfile): Promise<void>;
  updateProfile(name: string, updates: Partial<BrowserProfile>): Promise<void>;
  deleteProfile(name: string): Promise<void>;
  
  // Default profiles
  getDefaultProfile(): BrowserProfile;
  setDefaultProfile(name: string): Promise<void>;
  
  // Profile validation
  validateProfile(profile: BrowserProfile): ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

**Key Responsibilities:**
- Load and save profile configurations
- Provide default profiles (openclaw, chrome-extension, remote)
- Validate profile configurations
- Manage user data directories per profile
- Handle profile-specific launch options

### 7. Browser Tool Adapters

**Purpose**: Expose browser capabilities as function calling tools.

**Tool Schemas:**

```typescript
// browser_navigate
{
  name: "browser_navigate",
  description: "Navigate the browser to a specified URL",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to navigate to (must include protocol)"
      },
      waitUntil: {
        type: "string",
        description: "When to consider navigation complete",
        enum: ["load", "domcontentloaded", "networkidle"]
      },
      timeout: {
        type: "number",
        description: "Maximum time to wait in milliseconds (default: 30000)"
      }
    },
    required: ["url"]
  }
}

// browser_click
{
  name: "browser_click",
  description: "Click an element on the page",
  parameters: {
    type: "object",
    properties: {
      selector: {
        type: "string",
        description: "CSS selector or XPath for the element to click"
      },
      button: {
        type: "string",
        description: "Mouse button to use",
        enum: ["left", "right", "middle"]
      },
      clickCount: {
        type: "number",
        description: "Number of clicks (1 for single, 2 for double)"
      },
      timeout: {
        type: "number",
        description: "Maximum time to wait for element in milliseconds"
      }
    },
    required: ["selector"]
  }
}

// browser_type
{
  name: "browser_type",
  description: "Type text into an input element",
  parameters: {
    type: "object",
    properties: {
      selector: {
        type: "string",
        description: "CSS selector or XPath for the input element"
      },
      text: {
        type: "string",
        description: "Text to type into the element"
      },
      delay: {
        type: "number",
        description: "Delay between keystrokes in milliseconds"
      },
      timeout: {
        type: "number",
        description: "Maximum time to wait for element in milliseconds"
      }
    },
    required: ["selector", "text"]
  }
}

// browser_screenshot
{
  name: "browser_screenshot",
  description: "Take a screenshot of the current page",
  parameters: {
    type: "object",
    properties: {
      fullPage: {
        type: "boolean",
        description: "Capture the full scrollable page (default: false)"
      },
      type: {
        type: "string",
        description: "Image format",
        enum: ["png", "jpeg"]
      },
      quality: {
        type: "number",
        description: "Image quality for JPEG (0-100)"
      },
      path: {
        type: "string",
        description: "File path to save screenshot (optional)"
      }
    },
    required: []
  }
}

// browser_snapshot
{
  name: "browser_snapshot",
  description: "Capture a snapshot of the page including DOM and accessibility tree",
  parameters: {
    type: "object",
    properties: {
      includeIframes: {
        type: "boolean",
        description: "Include iframe content in snapshot"
      }
    },
    required: []
  }
}

// browser_execute_js
{
  name: "browser_execute_js",
  description: "Execute JavaScript code in the page context",
  parameters: {
    type: "object",
    properties: {
      script: {
        type: "string",
        description: "JavaScript code to execute"
      },
      args: {
        type: "array",
        description: "Arguments to pass to the script",
        items: { type: "string" }
      }
    },
    required: ["script"]
  }
}

// browser_get_cookies
{
  name: "browser_get_cookies",
  description: "Get cookies for the current domain or all domains",
  parameters: {
    type: "object",
    properties: {
      domain: {
        type: "string",
        description: "Filter cookies by domain (optional)"
      }
    },
    required: []
  }
}

// browser_set_cookies
{
  name: "browser_set_cookies",
  description: "Set one or more cookies",
  parameters: {
    type: "object",
    properties: {
      cookies: {
        type: "array",
        description: "Array of cookies to set",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Cookie name" },
            value: { type: "string", description: "Cookie value" },
            domain: { type: "string", description: "Cookie domain" },
            path: { type: "string", description: "Cookie path" },
            expires: { type: "number", description: "Expiration timestamp" },
            httpOnly: { type: "boolean", description: "HTTP only flag" },
            secure: { type: "boolean", description: "Secure flag" },
            sameSite: { 
              type: "string", 
              description: "SameSite attribute",
              enum: ["Strict", "Lax", "None"]
            }
          }
        }
      }
    },
    required: ["cookies"]
  }
}

// browser_get_local_storage
{
  name: "browser_get_local_storage",
  description: "Get localStorage items for the current origin",
  parameters: {
    type: "object",
    properties: {},
    required: []
  }
}

// browser_set_local_storage
{
  name: "browser_set_local_storage",
  description: "Set localStorage items for the current origin",
  parameters: {
    type: "object",
    properties: {
      items: {
        type: "object",
        description: "Key-value pairs to set in localStorage"
      }
    },
    required: ["items"]
  }
}

// browser_wait_for_selector
{
  name: "browser_wait_for_selector",
  description: "Wait for an element to appear on the page",
  parameters: {
    type: "object",
    properties: {
      selector: {
        type: "string",
        description: "CSS selector or XPath for the element"
      },
      state: {
        type: "string",
        description: "State to wait for",
        enum: ["attached", "detached", "visible", "hidden"]
      },
      timeout: {
        type: "number",
        description: "Maximum time to wait in milliseconds"
      }
    },
    required: ["selector"]
  }
}
```

**Key Responsibilities:**
- Register tools in Tool Registry
- Validate tool parameters
- Convert tool calls to browser actions
- Handle tool execution errors
- Return structured results

## Data Models

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
  | ScrollAction
  | SelectAction
  | UploadAction;

interface NavigateAction {
  type: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

interface ClickAction {
  type: 'click';
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  timeout?: number;
}

interface TypeAction {
  type: 'type';
  selector: string;
  text: string;
  delay?: number;
  timeout?: number;
}

interface ScreenshotAction {
  type: 'screenshot';
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  path?: string;
}

interface SnapshotAction {
  type: 'snapshot';
  includeIframes?: boolean;
}

interface ExecuteJSAction {
  type: 'execute_js';
  script: string;
  args?: any[];
}

interface WaitAction {
  type: 'wait';
  condition: 'selector' | 'navigation' | 'load_state' | 'timeout';
  selector?: string;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

interface ScrollAction {
  type: 'scroll';
  target: 'element' | 'coordinates' | 'top' | 'bottom';
  selector?: string;
  x?: number;
  y?: number;
}

interface SelectAction {
  type: 'select';
  selector: string;
  values: string[];
}

interface UploadAction {
  type: 'upload';
  selector: string;
  filePaths: string[];
}
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

interface ActionError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

// Error codes
type ErrorCode =
  | 'ELEMENT_NOT_FOUND'
  | 'TIMEOUT'
  | 'NAVIGATION_FAILED'
  | 'BROWSER_DISCONNECTED'
  | 'INVALID_SELECTOR'
  | 'SCRIPT_ERROR'
  | 'NETWORK_ERROR'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_ERROR';
```

### Configuration

```typescript
interface BrowserAutomationConfig {
  // Server
  controlServer: {
    enabled: boolean;
    port: number;
    host: string; // Must be '127.0.0.1'
  };
  
  // Browser
  browser: {
    executablePath?: string;
    defaultProfile: string;
    headless: boolean;
    defaultViewport: { width: number; height: number };
    defaultTimeout: number;
    idleTimeout: number; // Close browser after idle
  };
  
  // Profiles
  profiles: BrowserProfile[];
  
  // Paths
  paths: {
    userDataBaseDir: string;
    screenshotDir: string;
    downloadDir: string;
  };
  
  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logActions: boolean;
    logErrors: boolean;
  };
  
  // Security
  security: {
    allowRemoteProfiles: boolean;
    validateSelectors: boolean;
    sanitizeFilePaths: boolean;
  };
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

After analyzing all acceptance criteria, I've identified properties that eliminate redundancy and provide comprehensive validation. Many similar criteria have been combined into single, more powerful properties.

### Property Reflection

Before writing properties, I identified several areas of redundancy:

- Multiple criteria about metadata retrieval (1.3, 4.3) can be combined into one property about metadata completeness
- Multiple criteria about error structure (11.1, 11.2, 11.3) can be combined into one property about error format
- Multiple criteria about storage operations (7.4, 7.5, 7.6) follow the same pattern and can be tested with one property
- Multiple criteria about action support (6.1-6.5, 6.9) are just listing available actions - these are better as examples
- Serialization criteria (15.1, 15.2, 15.4) are all covered by the round-trip property

### Core Properties

**Property 1: Browser state round-trip preservation**

*For any* valid browser state object (containing cookies, localStorage, sessionStorage, and geolocation), serializing to JSON then deserializing SHALL produce an equivalent object with all data preserved.

**Validates: Requirements 15.1, 15.2, 15.4**

**Property 2: Connection metadata completeness**

*For any* successful CDP connection, the retrieved browser metadata SHALL contain all required fields: version, user agent, viewport dimensions, and protocol version.

**Validates: Requirements 1.3**

**Property 3: Resource cleanup on disconnection**

*For any* browser instance, when the browser disconnects or closes, all associated resources (WebSocket connections, file handles, memory buffers) SHALL be released within 5 seconds.

**Validates: Requirements 1.5**

**Property 4: Connection failure error completeness**

*For any* CDP connection failure, the returned error SHALL contain the connection endpoint, failure reason, and timestamp.

**Validates: Requirements 1.4**

**Property 5: Action execution via Playwright**

*For any* supported browser action (navigate, click, type, screenshot, etc.), the action SHALL be executed through the Playwright API and return a result indicating success or failure.

**Validates: Requirements 2.1**

**Property 6: Navigation wait state compliance**

*For any* navigation action with waitUntil parameter, the action SHALL not complete until the page reaches the specified state (load, domcontentloaded, or networkidle).

**Validates: Requirements 2.2**

**Property 7: Element interaction success**

*For any* interaction action (click, type, hover) with a valid selector, if the element exists and is interactable, the action SHALL complete successfully.

**Validates: Requirements 2.3, 2.4**

**Property 8: Screenshot format compliance**

*For any* screenshot action, the returned image SHALL be in the specified format (PNG or JPEG) and SHALL be either a valid base64 string or a valid file path.

**Validates: Requirements 2.5, 5.4, 5.5**

**Property 9: Scroll position verification**

*For any* scroll action to coordinates (x, y), after the action completes, the page scroll position SHALL be at or near (within 10 pixels) the specified coordinates.

**Validates: Requirements 2.6**

**Property 10: Action error structure completeness**

*For any* failed browser action, the returned error SHALL contain the action type, selector (if applicable), failure reason, and error code.

**Validates: Requirements 2.7, 2.8, 11.1, 11.2, 11.3**

**Property 11: Profile isolation**

*For any* two different browser profiles, their User_Data_Directories SHALL be in separate filesystem locations with no shared files.

**Validates: Requirements 3.2, 9.2**

**Property 12: Profile switching cleanup**

*For any* profile switch operation, the system SHALL disconnect from the current browser before connecting to the new profile's browser, with no overlapping connections.

**Validates: Requirements 3.6**

**Property 13: Profile configuration persistence**

*For any* browser profile configuration, saving then loading the configuration SHALL produce an equivalent profile object with all settings preserved.

**Validates: Requirements 3.7**

**Property 14: Snapshot structure completeness**

*For any* page snapshot, the returned JSON object SHALL contain DOM structure, accessibility tree, page title, URL, and viewport dimensions.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

**Property 15: Full-page screenshot completeness**

*For any* full-page screenshot request, the captured image height SHALL be greater than or equal to the scrollable page height.

**Validates: Requirements 5.2**

**Property 16: Element screenshot bounds**

*For any* element-specific screenshot, the captured image dimensions SHALL match the element's bounding box dimensions (within 2 pixels).

**Validates: Requirements 5.3**

**Property 17: Screenshot quality configuration**

*For any* JPEG screenshot with specified quality Q (0-100), the output file size SHALL correlate with quality (higher quality = larger file size for same content).

**Validates: Requirements 5.6**

**Property 18: Cookie retrieval completeness**

*For any* domain with N cookies set, retrieving cookies for that domain SHALL return exactly N cookies with all fields (name, value, domain, path, expires, httpOnly, secure, sameSite) populated.

**Validates: Requirements 7.1**

**Property 19: Cookie round-trip preservation**

*For any* set of cookies, setting them then immediately retrieving them SHALL return equivalent cookies with all fields preserved.

**Validates: Requirements 7.2**

**Property 20: Cookie deletion effectiveness**

*For any* cookie matching deletion criteria, after deletion, retrieving cookies SHALL not include the deleted cookie.

**Validates: Requirements 7.3**

**Property 21: Storage round-trip preservation**

*For any* storage type (localStorage or sessionStorage) and any set of key-value pairs, setting the items then retrieving them SHALL return equivalent items with all keys and values preserved.

**Validates: Requirements 7.4, 7.5, 7.6**

**Property 22: Geolocation override effectiveness**

*For any* geolocation coordinates (latitude, longitude), after setting geolocation, executing JavaScript to read navigator.geolocation SHALL return the specified coordinates.

**Validates: Requirements 7.7**

**Property 23: State clearing completeness**

*For any* browser profile with state (cookies, localStorage, sessionStorage), after clearing all state, retrieving cookies and storage SHALL return empty collections.

**Validates: Requirements 7.8**

**Property 24: PDF generation success**

*For any* page that successfully loads, PDF generation SHALL produce a valid PDF buffer that can be parsed by PDF libraries.

**Validates: Requirements 8.1**

**Property 25: PDF configuration application**

*For any* PDF generation with specified page size, the resulting PDF SHALL have dimensions matching the specified size (within 1mm).

**Validates: Requirements 8.2**

**Property 26: Loopback-only binding**

*For any* connection attempt to the Control Server from a non-loopback address, the connection SHALL be rejected.

**Validates: Requirements 9.1**

**Property 27: Parameter validation for injection prevention**

*For any* action with parameters containing injection patterns (e.g., `'; DROP TABLE`, `<script>`, `../../etc/passwd`), the system SHALL either sanitize the input or reject the action with a validation error.

**Validates: Requirements 9.5**

**Property 28: Path sanitization for traversal prevention**

*For any* file path parameter containing directory traversal patterns (`../`, `..\\`), the system SHALL sanitize the path to prevent access outside allowed directories.

**Validates: Requirements 9.6**

**Property 29: JavaScript execution context isolation**

*For any* JavaScript execution, the code SHALL execute in the page context and SHALL NOT have access to Node.js globals (process, require, __dirname, etc.).

**Validates: Requirements 9.7**

**Property 30: Tool schema compliance**

*For any* registered browser tool, the tool schema SHALL conform to OpenAI function calling format with required fields: name, description, parameters.type, parameters.properties, parameters.required.

**Validates: Requirements 10.1**

**Property 31: Tool parameter validation**

*For any* tool call with parameters, if the parameters do not match the tool schema (missing required fields, wrong types), the system SHALL return a validation error before executing the tool.

**Validates: Requirements 10.10**

**Property 32: Tool error response structure**

*For any* failed tool execution, the returned error SHALL be a structured object containing success: false, error message, and error code.

**Validates: Requirements 10.11**

**Property 33: Browser crash recovery**

*For any* browser crash event, the system SHALL detect the crash within 10 seconds and attempt to restart the browser with the same profile.

**Validates: Requirements 11.4**

**Property 34: CDP reconnection with backoff**

*For any* CDP connection loss, the system SHALL attempt reconnection with exponentially increasing delays (1s, 2s, 4s, 8s, ...) up to a maximum of 5 attempts.

**Validates: Requirements 11.5**

**Property 35: Error logging completeness**

*For any* error that occurs, the system SHALL log an entry containing timestamp, error message, error code, and stack trace.

**Validates: Requirements 11.6, 14.2**

**Property 36: Graceful shutdown cleanup**

*For any* system shutdown, all browser instances SHALL be closed and all temporary files SHALL be deleted within 30 seconds.

**Validates: Requirements 12.2, 12.6**

**Property 37: Idle timeout enforcement**

*For any* browser instance idle for longer than the configured timeout, the instance SHALL be automatically closed and resources freed.

**Validates: Requirements 12.3**

**Property 38: Browser restart after idle timeout**

*For any* action requested after a browser was closed due to idle timeout, a new browser instance SHALL be launched before executing the action.

**Validates: Requirements 12.4**

**Property 39: Configuration validation on startup**

*For any* invalid configuration (e.g., port out of range, invalid path), the system SHALL fail to start and SHALL return a clear error message describing the configuration problem.

**Validates: Requirements 13.7**

**Property 40: Action logging completeness**

*For any* executed action, the system SHALL log an entry containing action type, parameters, execution time, and result status.

**Validates: Requirements 14.1**

**Property 41: Connection event logging**

*For any* browser connection or disconnection event, the system SHALL log an entry containing event type, browser metadata, and timestamp.

**Validates: Requirements 14.3**

**Property 42: Metrics exposure**

*For any* time period with N actions executed, the exposed metrics SHALL include total action count (N), error count, and average execution time.

**Validates: Requirements 14.6**

**Property 43: JSON parsing error descriptiveness**

*For any* invalid JSON input to state deserialization, the system SHALL return an error containing the parse error message and the location of the syntax error.

**Validates: Requirements 15.5**

**Property 44: State validation before application**

*For any* browser state object, before applying to the browser, the system SHALL validate that all required fields are present and have correct types, rejecting invalid states.

**Validates: Requirements 15.6**

**Property 45: Extension tab discovery**

*For any* active Extension Relay, querying for available tabs SHALL return a list of tabs with at least the tab ID, title, and URL for each tab.

**Validates: Requirements 16.2**

**Property 46: Extension tab connection**

*For any* valid tab ID from the Extension Relay, establishing a connection SHALL succeed and allow action execution on that tab.

**Validates: Requirements 16.3**

**Property 47: Extension tab action support**

*For any* standard browser action (navigate, click, type, screenshot), the action SHALL execute successfully on extension-controlled tabs with the same behavior as openclaw profile tabs.

**Validates: Requirements 16.4**

**Property 48: Extension tab closure handling**

*For any* extension-controlled tab that closes, the system SHALL detect the closure within 5 seconds and return an error for subsequent actions on that tab.

**Validates: Requirements 16.6**

**Property 49: Remote authentication requirement**

*For any* remote profile connection attempt without valid Gateway credentials, the connection SHALL be rejected with an authentication error.

**Validates: Requirements 17.2**

**Property 50: Remote browser version verification**

*For any* successful remote connection, the system SHALL verify the remote browser supports CDP protocol version 1.3 or higher, rejecting incompatible versions.

**Validates: Requirements 17.3**

**Property 51: Remote action support**

*For any* standard browser action, the action SHALL execute successfully on remote browsers with the same behavior as local browsers.

**Validates: Requirements 17.4**

**Property 52: Remote connection error details**

*For any* failed remote connection, the returned error SHALL contain the remote endpoint, authentication status, and suggested retry actions.

**Validates: Requirements 17.5**

**Property 53: Network interruption reconnection**

*For any* network interruption during a remote connection, the system SHALL attempt automatic reconnection with exponential backoff up to 5 attempts.

**Validates: Requirements 17.6**

**Property 54: Wait for element timeout**

*For any* wait for element action with timeout T, if the element does not appear within T milliseconds, the action SHALL fail with a timeout error.

**Validates: Requirements 18.1**

**Property 55: Wait for element disappearance**

*For any* wait for element disappearance with timeout T, if the element does not disappear within T milliseconds, the action SHALL fail with a timeout error.

**Validates: Requirements 18.2**

**Property 56: Network idle detection**

*For any* wait for network idle with duration D, the action SHALL not complete until there have been no network requests for at least D milliseconds.

**Validates: Requirements 18.3**

**Property 57: Wait timeout error details**

*For any* wait action that times out, the returned error SHALL contain the wait condition, timeout duration, and current state.

**Validates: Requirements 18.7**

## Error Handling

### Error Classification

The system classifies errors into the following categories:

1. **Connection Errors**: CDP connection failures, browser crashes, network issues
2. **Action Errors**: Element not found, timeout, invalid selector
3. **Validation Errors**: Invalid parameters, schema violations
4. **Security Errors**: Injection attempts, path traversal, unauthorized access
5. **Configuration Errors**: Invalid config, missing dependencies
6. **State Errors**: Invalid state format, deserialization failures

### Error Response Format

All errors follow a consistent structure:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    timestamp: number;
    context?: {
      action?: string;
      selector?: string;
      url?: string;
      [key: string]: any;
    };
  };
}
```

### Recovery Strategies

**Browser Crashes:**
- Detect crash via CDP disconnection
- Log crash event with context
- Attempt automatic restart with same profile
- If restart fails 3 times, mark browser as unavailable
- Notify user of crash and recovery status

**Connection Loss:**
- Detect via WebSocket close event
- Attempt reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Maximum 5 reconnection attempts
- If all attempts fail, close browser and clean up resources
- Return error to user with reconnection details

**Action Timeouts:**
- Cancel pending action
- Return timeout error with action details
- Browser remains connected and usable
- Suggest increasing timeout or checking page load

**Element Not Found:**
- Return error with selector and available elements
- Suggest alternative selectors
- Provide page snapshot for debugging
- Browser remains connected and usable

**Validation Errors:**
- Reject action before execution
- Return detailed validation error
- Suggest correct parameter format
- No browser state changes

## Testing Strategy

### Dual Testing Approach

The Browser Automation feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of browser actions (navigate to google.com, click button#submit)
- Edge cases (empty selectors, invalid URLs, missing elements)
- Integration points (Tool Registry registration, Playwright initialization)
- Error conditions (browser crash, connection loss, timeout)
- Configuration loading and validation

**Property-Based Tests** focus on:
- Universal properties across all inputs (round-trip preservation, metadata completeness)
- Randomized action sequences (navigate → click → type → screenshot)
- State management across random operations (set cookies → get cookies)
- Error handling across random invalid inputs (malformed selectors, injection attempts)
- Resource cleanup across random browser lifecycles

### Property-Based Testing Configuration

**Testing Library**: fast-check (already used in Prometheus)

**Test Configuration**:
- Minimum 100 iterations per property test
- Timeout: 60 seconds per property (browser operations are slower)
- Shrinking enabled for failure reproduction

**Property Test Tags**:
Each property test must include a comment tag:
```typescript
// Feature: browser-automation, Property 1: Browser state round-trip preservation
```

### Test Organization

```
src/browser-automation/
  __tests__/
    unit/
      browser-manager.test.ts
      cdp-client.test.ts
      playwright-adapter.test.ts
      state-manager.test.ts
      profile-manager.test.ts
      tool-adapters.test.ts
    
    property/
      state-roundtrip.property.test.ts
      action-execution.property.test.ts
      error-handling.property.test.ts
      security.property.test.ts
      lifecycle.property.test.ts
    
    integration/
      end-to-end.test.ts
      tool-registry-integration.test.ts
```

### Example Property Test

```typescript
import fc from 'fast-check';

// Feature: browser-automation, Property 1: Browser state round-trip preservation
describe('Browser State Round-Trip', () => {
  it('should preserve state through serialization and deserialization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          cookies: fc.array(cookieArbitrary()),
          localStorage: fc.dictionary(fc.string(), fc.string()),
          sessionStorage: fc.dictionary(fc.string(), fc.string()),
          geolocation: fc.option(geolocationArbitrary())
        }),
        async (state) => {
          const serialized = await stateManager.exportState(state);
          const deserialized = await stateManager.importState(serialized);
          
          expect(deserialized).toEqual(state);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Coverage Goals

- Unit test coverage: > 80% of lines
- Property test coverage: All 57 correctness properties
- Integration test coverage: All tool adapters and major workflows
- End-to-end test coverage: Complete user scenarios (navigate → interact → capture)

### Continuous Testing

- Run unit tests on every commit
- Run property tests on every PR
- Run integration tests nightly
- Run end-to-end tests before releases
- Monitor test execution time and optimize slow tests
