/**
 * Browser Automation Types
 * 
 * Core type definitions for the browser automation system.
 * Based on the design document specifications.
 */

// ============================================================================
// Browser Profile Types
// ============================================================================

export type BrowserProfileType = 'openclaw' | 'chrome-extension' | 'remote';

export interface BrowserProfile {
  name: string;
  type: BrowserProfileType;
  userDataDir: string;
  launchOptions: LaunchOptions;
  connectionOptions?: ConnectionOptions;
}

export interface LaunchOptions {
  headless: boolean;
  executablePath?: string;
  args: string[];
  defaultViewport: { width: number; height: number };
  timeout: number;
}

export interface ConnectionOptions {
  wsEndpoint?: string; // For remote
  extensionId?: string; // For chrome-extension
  gatewayUrl?: string; // For remote with gateway
  authToken?: string; // For remote with gateway
}

export interface Browser {
  id: string;
  profile: BrowserProfile;
  cdpEndpoint: string;
  playwrightBrowser: any; // PlaywrightBrowser type from playwright
  createdAt: number;
  lastUsedAt: number;
}

// ============================================================================
// CDP Types
// ============================================================================

export interface BrowserVersion {
  browser: string;
  protocolVersion: string;
  userAgent: string;
  v8Version: string;
  webKitVersion: string;
}

export interface Target {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached: boolean;
}

// ============================================================================
// Browser Action Types
// ============================================================================

export type BrowserAction =
  | NavigateAction
  | ClickAction
  | TypeAction
  | ScreenshotAction
  | SnapshotAction
  | PDFAction
  | ExecuteJSAction
  | WaitAction
  | ScrollAction
  | SelectAction
  | UploadAction;

export interface NavigateAction {
  type: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface ClickAction {
  type: 'click';
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  timeout?: number;
}

export interface TypeAction {
  type: 'type';
  selector: string;
  text: string;
  delay?: number;
  timeout?: number;
}

export interface ScreenshotAction {
  type: 'screenshot';
  fullPage?: boolean;
  format?: 'png' | 'jpeg';
  quality?: number;
  path?: string;
}

export interface SnapshotAction {
  type: 'snapshot';
  includeIframes?: boolean;
}

export interface PDFAction {
  type: 'pdf';
  path?: string;
  format?: string;
  width?: string;
  height?: string;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  printBackground?: boolean;
}

export interface ExecuteJSAction {
  type: 'execute_js';
  script: string;
  args?: any[];
}

export interface WaitAction {
  type: 'wait';
  condition: 'selector' | 'navigation' | 'load_state' | 'timeout';
  selector?: string;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface ScrollAction {
  type: 'scroll';
  target: 'element' | 'coordinates' | 'top' | 'bottom';
  selector?: string;
  x?: number;
  y?: number;
}

export interface SelectAction {
  type: 'select';
  selector: string;
  values: string[];
}

export interface UploadAction {
  type: 'upload';
  selector: string;
  filePaths: string[];
}

// ============================================================================
// Action Result Types
// ============================================================================

export interface ActionResult {
  success: boolean;
  action: BrowserAction;
  result?: any;
  error?: ActionError;
  executionTime: number;
  timestamp: number;
}

export interface ActionError {
  code: ErrorCode;
  message: string;
  details?: any;
  stack?: string;
}

export type ErrorCode =
  | 'ELEMENT_NOT_FOUND'
  | 'TIMEOUT'
  | 'NAVIGATION_FAILED'
  | 'BROWSER_DISCONNECTED'
  | 'INVALID_SELECTOR'
  | 'SCRIPT_ERROR'
  | 'NETWORK_ERROR'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_ERROR';

// ============================================================================
// Playwright Adapter Types
// ============================================================================

export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface NavigateResult {
  url: string;
  status: number;
  title: string;
  loadTime: number;
}

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
  timeout?: number;
}

export interface TypeOptions {
  delay?: number;
  timeout?: number;
}

export interface ScreenshotOptions {
  type?: 'png' | 'jpeg';
  quality?: number;
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
  path?: string;
}

export interface PDFOptions {
  path?: string;
  format?: string;
  width?: string;
  height?: string;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  printBackground?: boolean;
}

export interface PageSnapshot {
  url: string;
  title: string;
  html: string;
  accessibilityTree: AccessibilityNode[];
  viewport: { width: number; height: number };
  timestamp: number;
}

export interface AccessibilityNode {
  role: string;
  name: string;
  value?: string;
  children?: AccessibilityNode[];
}

export interface WaitOptions {
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

export type LoadState = 'load' | 'domcontentloaded' | 'networkidle';

// ============================================================================
// State Management Types
// ============================================================================

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export interface CookieFilter {
  name?: string;
  domain?: string;
  path?: string;
}

export interface GeolocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface BrowserState {
  cookies: Cookie[];
  localStorage: Record<string, Record<string, string>>; // origin -> items
  sessionStorage: Record<string, Record<string, string>>; // origin -> items
  geolocation?: GeolocationCoords;
  version: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface BrowserAutomationConfig {
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
    idleTimeout: number; // Close browser after idle (milliseconds)
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

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface ErrorResponse {
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
