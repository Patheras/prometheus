/**
 * Default Browser Automation Configuration
 * 
 * Provides default configuration values and profile definitions
 * for the browser automation system.
 */

import path from 'path';
import fs from 'fs';
import { BrowserAutomationConfig, BrowserProfile } from '../types/index.js';

/**
 * Default browser profiles
 */
export const DEFAULT_PROFILES: BrowserProfile[] = [
  {
    name: 'openclaw',
    type: 'openclaw',
    userDataDir: path.join(process.cwd(), '.browser-data', 'openclaw'),
    launchOptions: {
      headless: false,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: { width: 1280, height: 720 },
      timeout: 30000,
    },
  },
  {
    name: 'chrome-extension',
    type: 'chrome-extension',
    userDataDir: path.join(process.cwd(), '.browser-data', 'chrome-extension'),
    launchOptions: {
      headless: false,
      args: ['--no-first-run', '--no-default-browser-check'],
      defaultViewport: { width: 1280, height: 720 },
      timeout: 30000,
    },
    connectionOptions: {
      extensionId: undefined, // Set by extension
    },
  },
  {
    name: 'remote',
    type: 'remote',
    userDataDir: path.join(process.cwd(), '.browser-data', 'remote'),
    launchOptions: {
      headless: false,
      args: [],
      defaultViewport: { width: 1280, height: 720 },
      timeout: 30000,
    },
    connectionOptions: {
      wsEndpoint: undefined, // Set by user
      gatewayUrl: undefined, // Set by user
      authToken: undefined, // Set by user
    },
  },
];

/**
 * Default browser automation configuration
 */
export const DEFAULT_CONFIG: BrowserAutomationConfig = {
  controlServer: {
    enabled: true,
    port: 18791,
    host: '127.0.0.1', // Loopback only for security
  },

  browser: {
    executablePath: undefined, // Auto-detect Chrome/Chromium
    defaultProfile: 'openclaw',
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    defaultTimeout: 30000, // 30 seconds
    idleTimeout: 300000, // 5 minutes
  },

  profiles: DEFAULT_PROFILES,

  paths: {
    userDataBaseDir: path.join(process.cwd(), '.browser-data'),
    screenshotDir: path.join(process.cwd(), '.browser-data', 'screenshots'),
    downloadDir: path.join(process.cwd(), '.browser-data', 'downloads'),
  },

  logging: {
    level: 'info',
    logActions: true,
    logErrors: true,
  },

  security: {
    allowRemoteProfiles: false, // Disabled by default for security
    validateSelectors: true,
    sanitizeFilePaths: true,
  },
};

/**
 * Load configuration from environment variables
 * Overrides default config with environment-specific values
 */
export function loadConfigFromEnv(): Partial<BrowserAutomationConfig> {
  const envConfig: Partial<BrowserAutomationConfig> = {};

  // Control Server
  if (process.env.BROWSER_CONTROL_PORT) {
    envConfig.controlServer = {
      ...DEFAULT_CONFIG.controlServer,
      port: parseInt(process.env.BROWSER_CONTROL_PORT, 10),
    };
  }

  // Browser
  if (process.env.BROWSER_EXECUTABLE_PATH) {
    envConfig.browser = {
      ...DEFAULT_CONFIG.browser,
      executablePath: process.env.BROWSER_EXECUTABLE_PATH,
    };
  }

  if (process.env.BROWSER_HEADLESS === 'true') {
    envConfig.browser = {
      ...DEFAULT_CONFIG.browser,
      ...envConfig.browser,
      headless: true,
    };
  } else if (process.env.BROWSER_HEADLESS === 'false') {
    envConfig.browser = {
      ...DEFAULT_CONFIG.browser,
      ...envConfig.browser,
      headless: false,
    };
  }

  if (process.env.BROWSER_DEFAULT_TIMEOUT) {
    envConfig.browser = {
      ...DEFAULT_CONFIG.browser,
      ...envConfig.browser,
      defaultTimeout: parseInt(process.env.BROWSER_DEFAULT_TIMEOUT, 10),
    };
  }

  if (process.env.BROWSER_IDLE_TIMEOUT) {
    envConfig.browser = {
      ...DEFAULT_CONFIG.browser,
      ...envConfig.browser,
      idleTimeout: parseInt(process.env.BROWSER_IDLE_TIMEOUT, 10),
    };
  }

  if (process.env.BROWSER_DEFAULT_PROFILE) {
    envConfig.browser = {
      ...DEFAULT_CONFIG.browser,
      ...envConfig.browser,
      defaultProfile: process.env.BROWSER_DEFAULT_PROFILE,
    };
  }

  // Paths
  if (process.env.BROWSER_USER_DATA_DIR) {
    envConfig.paths = {
      ...DEFAULT_CONFIG.paths,
      userDataBaseDir: process.env.BROWSER_USER_DATA_DIR,
    };
  }

  if (process.env.BROWSER_SCREENSHOT_DIR) {
    envConfig.paths = {
      ...DEFAULT_CONFIG.paths,
      ...envConfig.paths,
      screenshotDir: process.env.BROWSER_SCREENSHOT_DIR,
    };
  }

  if (process.env.BROWSER_DOWNLOAD_DIR) {
    envConfig.paths = {
      ...DEFAULT_CONFIG.paths,
      ...envConfig.paths,
      downloadDir: process.env.BROWSER_DOWNLOAD_DIR,
    };
  }

  // Logging
  if (process.env.BROWSER_LOG_LEVEL) {
    envConfig.logging = {
      ...DEFAULT_CONFIG.logging,
      level: process.env.BROWSER_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
    };
  }

  // Security
  if (process.env.BROWSER_ALLOW_REMOTE === 'true') {
    envConfig.security = {
      ...DEFAULT_CONFIG.security,
      allowRemoteProfiles: true,
    };
  }

  return envConfig;
}

/**
 * Merge configurations with priority: env > custom > default
 */
export function mergeConfig(
  customConfig?: Partial<BrowserAutomationConfig>
): BrowserAutomationConfig {
  const envConfig = loadConfigFromEnv();

  return {
    ...DEFAULT_CONFIG,
    ...customConfig,
    ...envConfig,
    controlServer: {
      ...DEFAULT_CONFIG.controlServer,
      ...customConfig?.controlServer,
      ...envConfig.controlServer,
    },
    browser: {
      ...DEFAULT_CONFIG.browser,
      ...customConfig?.browser,
      ...envConfig.browser,
    },
    paths: {
      ...DEFAULT_CONFIG.paths,
      ...customConfig?.paths,
      ...envConfig.paths,
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      ...customConfig?.logging,
      ...envConfig.logging,
    },
    security: {
      ...DEFAULT_CONFIG.security,
      ...customConfig?.security,
      ...envConfig.security,
    },
    profiles: customConfig?.profiles || envConfig.profiles || DEFAULT_CONFIG.profiles,
  };
}

/**
 * Load configuration from a JSON file
 * Returns parsed configuration or null if file doesn't exist
 */
export function loadConfigFromFile(filePath: string): Partial<BrowserAutomationConfig> | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(fileContent);
    
    return config;
  } catch (error) {
    throw new Error(`Failed to load configuration from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Load configuration with priority: env > file > custom > default
 * Looks for config file at specified path or default locations
 */
export function loadConfig(
  customConfig?: Partial<BrowserAutomationConfig>,
  configFilePath?: string
): BrowserAutomationConfig {
  // Try to load from file
  let fileConfig: Partial<BrowserAutomationConfig> | null = null;
  
  if (configFilePath) {
    // Use specified config file path
    fileConfig = loadConfigFromFile(configFilePath);
  } else {
    // Try default locations
    const defaultPaths = [
      path.join(process.cwd(), 'browser-automation.config.json'),
      path.join(process.cwd(), '.browser-automation', 'config.json'),
    ];
    
    for (const defaultPath of defaultPaths) {
      fileConfig = loadConfigFromFile(defaultPath);
      if (fileConfig) {
        break;
      }
    }
  }

  // Merge with priority: env > file > custom > default
  const envConfig = loadConfigFromEnv();

  return {
    ...DEFAULT_CONFIG,
    ...customConfig,
    ...fileConfig,
    ...envConfig,
    controlServer: {
      ...DEFAULT_CONFIG.controlServer,
      ...customConfig?.controlServer,
      ...fileConfig?.controlServer,
      ...envConfig.controlServer,
    },
    browser: {
      ...DEFAULT_CONFIG.browser,
      ...customConfig?.browser,
      ...fileConfig?.browser,
      ...envConfig.browser,
    },
    paths: {
      ...DEFAULT_CONFIG.paths,
      ...customConfig?.paths,
      ...fileConfig?.paths,
      ...envConfig.paths,
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      ...customConfig?.logging,
      ...fileConfig?.logging,
      ...envConfig.logging,
    },
    security: {
      ...DEFAULT_CONFIG.security,
      ...customConfig?.security,
      ...fileConfig?.security,
      ...envConfig.security,
    },
    profiles: envConfig.profiles || fileConfig?.profiles || customConfig?.profiles || DEFAULT_CONFIG.profiles,
  };
}

