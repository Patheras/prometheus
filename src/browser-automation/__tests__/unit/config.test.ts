/**
 * Configuration Tests
 * 
 * Unit tests for configuration loading, validation, and merging.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  DEFAULT_CONFIG,
  DEFAULT_PROFILES,
  mergeConfig,
  loadConfig,
  loadConfigFromFile,
  validateConfig,
  loadConfigFromEnv,
} from '../../config/index.js';
import { BrowserAutomationConfig } from '../../types/index.js';

describe('Browser Automation Configuration', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(DEFAULT_CONFIG.controlServer.host).toBe('127.0.0.1');
      expect(DEFAULT_CONFIG.controlServer.port).toBe(18791);
      expect(DEFAULT_CONFIG.browser.defaultProfile).toBe('openclaw');
    });

    it('should have three default profiles', () => {
      expect(DEFAULT_PROFILES).toHaveLength(3);
      expect(DEFAULT_PROFILES.map((p) => p.name)).toEqual([
        'openclaw',
        'chrome-extension',
        'remote',
      ]);
    });

    it('should have openclaw profile with correct type', () => {
      const openclaw = DEFAULT_PROFILES.find((p) => p.name === 'openclaw');
      expect(openclaw).toBeDefined();
      expect(openclaw?.type).toBe('openclaw');
      expect(openclaw?.launchOptions.headless).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should validate default configuration successfully', () => {
      const result = validateConfig(DEFAULT_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-loopback host', () => {
      const config: BrowserAutomationConfig = {
        ...DEFAULT_CONFIG,
        controlServer: {
          ...DEFAULT_CONFIG.controlServer,
          host: '0.0.0.0',
        },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("must be '127.0.0.1'"))).toBe(true);
    });

    it('should reject invalid port numbers', () => {
      const config: BrowserAutomationConfig = {
        ...DEFAULT_CONFIG,
        controlServer: {
          ...DEFAULT_CONFIG.controlServer,
          port: 100, // Too low
        },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('between 1024 and 65535'))).toBe(true);
    });

    it('should reject negative timeout values', () => {
      const config: BrowserAutomationConfig = {
        ...DEFAULT_CONFIG,
        browser: {
          ...DEFAULT_CONFIG.browser,
          defaultTimeout: -1000,
        },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('timeout must be positive'))).toBe(true);
    });

    it('should reject invalid viewport dimensions', () => {
      const config: BrowserAutomationConfig = {
        ...DEFAULT_CONFIG,
        browser: {
          ...DEFAULT_CONFIG.browser,
          defaultViewport: { width: 0, height: 720 },
        },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('viewport dimensions must be positive'))).toBe(true);
    });

    it('should reject duplicate profile names', () => {
      const config: BrowserAutomationConfig = {
        ...DEFAULT_CONFIG,
        profiles: [
          DEFAULT_PROFILES[0]!,
          { ...DEFAULT_PROFILES[0]!, name: 'openclaw' }, // Duplicate
        ],
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate profile name'))).toBe(true);
    });

    it('should reject invalid log level', () => {
      const config: BrowserAutomationConfig = {
        ...DEFAULT_CONFIG,
        logging: {
          ...DEFAULT_CONFIG.logging,
          level: 'invalid' as any,
        },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid log level'))).toBe(true);
    });

    it('should reject missing default profile', () => {
      const config: BrowserAutomationConfig = {
        ...DEFAULT_CONFIG,
        browser: {
          ...DEFAULT_CONFIG.browser,
          defaultProfile: 'nonexistent',
        },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Default profile'))).toBe(true);
    });
  });

  describe('mergeConfig', () => {
    it('should merge custom config with defaults', () => {
      const custom = {
        browser: {
          headless: true,
        },
      };
      const merged = mergeConfig(custom);
      expect(merged.browser.headless).toBe(true);
      expect(merged.browser.defaultTimeout).toBe(
        DEFAULT_CONFIG.browser.defaultTimeout
      );
    });

    it('should preserve default values when no custom config provided', () => {
      const merged = mergeConfig();
      expect(merged).toEqual(DEFAULT_CONFIG);
    });

    it('should merge nested configuration objects', () => {
      const custom = {
        controlServer: {
          port: 19000,
        },
      };
      const merged = mergeConfig(custom);
      expect(merged.controlServer.port).toBe(19000);
      expect(merged.controlServer.host).toBe('127.0.0.1'); // Preserved
    });
  });

  describe('loadConfigFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should load port from environment', () => {
      process.env.BROWSER_CONTROL_PORT = '19000';
      const config = loadConfigFromEnv();
      expect(config.controlServer?.port).toBe(19000);
    });

    it('should load headless mode from environment', () => {
      process.env.BROWSER_HEADLESS = 'true';
      const config = loadConfigFromEnv();
      expect(config.browser?.headless).toBe(true);
    });

    it('should load log level from environment', () => {
      process.env.BROWSER_LOG_LEVEL = 'debug';
      const config = loadConfigFromEnv();
      expect(config.logging?.level).toBe('debug');
    });

    it('should load idle timeout from environment', () => {
      process.env.BROWSER_IDLE_TIMEOUT = '600000';
      const config = loadConfigFromEnv();
      expect(config.browser?.idleTimeout).toBe(600000);
    });

    it('should load default profile from environment', () => {
      process.env.BROWSER_DEFAULT_PROFILE = 'remote';
      const config = loadConfigFromEnv();
      expect(config.browser?.defaultProfile).toBe('remote');
    });

    it('should load paths from environment', () => {
      process.env.BROWSER_USER_DATA_DIR = '/custom/data';
      process.env.BROWSER_SCREENSHOT_DIR = '/custom/screenshots';
      process.env.BROWSER_DOWNLOAD_DIR = '/custom/downloads';
      const config = loadConfigFromEnv();
      expect(config.paths?.userDataBaseDir).toBe('/custom/data');
      expect(config.paths?.screenshotDir).toBe('/custom/screenshots');
      expect(config.paths?.downloadDir).toBe('/custom/downloads');
    });

    it('should return empty config when no env vars set', () => {
      const config = loadConfigFromEnv();
      expect(Object.keys(config)).toHaveLength(0);
    });
  });

  describe('loadConfigFromFile', () => {
    let tempDir: string;
    let configFilePath: string;

    beforeEach(() => {
      // Create temporary directory for test config files
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-automation-test-'));
      configFilePath = path.join(tempDir, 'test-config.json');
    });

    afterEach(() => {
      // Clean up temporary directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should load valid JSON configuration file', () => {
      const testConfig = {
        browser: {
          headless: true,
          defaultTimeout: 60000,
        },
        logging: {
          level: 'debug',
        },
      };

      fs.writeFileSync(configFilePath, JSON.stringify(testConfig, null, 2));
      const loaded = loadConfigFromFile(configFilePath);

      expect(loaded).toBeDefined();
      expect(loaded?.browser?.headless).toBe(true);
      expect(loaded?.browser?.defaultTimeout).toBe(60000);
      expect(loaded?.logging?.level).toBe('debug');
    });

    it('should return null for non-existent file', () => {
      const loaded = loadConfigFromFile(path.join(tempDir, 'nonexistent.json'));
      expect(loaded).toBeNull();
    });

    it('should throw error for invalid JSON', () => {
      fs.writeFileSync(configFilePath, '{ invalid json }');
      expect(() => loadConfigFromFile(configFilePath)).toThrow();
    });

    it('should throw error with descriptive message for parse errors', () => {
      fs.writeFileSync(configFilePath, '{ "browser": { "headless": }');
      expect(() => loadConfigFromFile(configFilePath)).toThrow(/Failed to load configuration/);
    });
  });

  describe('loadConfig', () => {
    let tempDir: string;
    let configFilePath: string;
    const originalEnv = process.env;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-automation-test-'));
      configFilePath = path.join(tempDir, 'config.json');
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      process.env = originalEnv;
    });

    it('should merge file config with defaults', () => {
      const fileConfig = {
        browser: {
          headless: true,
        },
      };

      fs.writeFileSync(configFilePath, JSON.stringify(fileConfig));
      const config = loadConfig(undefined, configFilePath);

      expect(config.browser.headless).toBe(true);
      expect(config.browser.defaultTimeout).toBe(DEFAULT_CONFIG.browser.defaultTimeout);
    });

    it('should prioritize env vars over file config', () => {
      const fileConfig = {
        browser: {
          headless: false,
        },
      };

      fs.writeFileSync(configFilePath, JSON.stringify(fileConfig));
      process.env.BROWSER_HEADLESS = 'true';

      const config = loadConfig(undefined, configFilePath);
      expect(config.browser.headless).toBe(true);
    });

    it('should prioritize env vars over custom config', () => {
      const customConfig = {
        browser: {
          headless: false,
        },
      };

      process.env.BROWSER_HEADLESS = 'true';
      const config = loadConfig(customConfig);
      expect(config.browser.headless).toBe(true);
    });

    it('should use defaults when no file or custom config provided', () => {
      const config = loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should handle missing config file gracefully', () => {
      const config = loadConfig(undefined, path.join(tempDir, 'nonexistent.json'));
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should merge all config sources with correct priority', () => {
      const fileConfig = {
        browser: {
          headless: true,
          defaultTimeout: 60000,
        },
        logging: {
          level: 'debug' as const,
        },
      };

      const customConfig = {
        browser: {
          defaultTimeout: 45000,
        },
        controlServer: {
          port: 19000,
        },
      };

      fs.writeFileSync(configFilePath, JSON.stringify(fileConfig));
      process.env.BROWSER_HEADLESS = 'false';

      const config = loadConfig(customConfig, configFilePath);

      // Env should override file
      expect(config.browser.headless).toBe(false);
      // File should override custom
      expect(config.logging.level).toBe('debug');
      // Custom should override default
      expect(config.controlServer.port).toBe(19000);
      // Default should be used when not specified
      expect(config.security.validateSelectors).toBe(true);
    });
  });
});
