/**
 * Configuration Validator
 * 
 * Validates browser automation configuration on startup
 * to ensure all settings are correct and safe.
 */

import { BrowserAutomationConfig, ValidationResult } from '../types/index.js';
import fs from 'fs';
import path from 'path';

/**
 * Validate the browser automation configuration
 * Returns validation result with any errors found
 */
export function validateConfig(config: BrowserAutomationConfig): ValidationResult {
  const errors: string[] = [];

  // Validate Control Server
  if (config.controlServer.enabled) {
    if (config.controlServer.host !== '127.0.0.1') {
      errors.push(
        `Control server host must be '127.0.0.1' for security (got '${config.controlServer.host}')`
      );
    }

    if (
      config.controlServer.port < 1024 ||
      config.controlServer.port > 65535
    ) {
      errors.push(
        `Control server port must be between 1024 and 65535 (got ${config.controlServer.port})`
      );
    }
  }

  // Validate Browser
  if (config.browser.executablePath) {
    if (!fs.existsSync(config.browser.executablePath)) {
      errors.push(
        `Browser executable path does not exist: ${config.browser.executablePath}`
      );
    }
  }

  if (config.browser.defaultTimeout < 0) {
    errors.push(
      `Browser default timeout must be positive (got ${config.browser.defaultTimeout})`
    );
  }

  if (config.browser.idleTimeout < 0) {
    errors.push(
      `Browser idle timeout must be positive (got ${config.browser.idleTimeout})`
    );
  }

  if (
    config.browser.defaultViewport.width <= 0 ||
    config.browser.defaultViewport.height <= 0
  ) {
    errors.push(
      `Browser viewport dimensions must be positive (got ${config.browser.defaultViewport.width}x${config.browser.defaultViewport.height})`
    );
  }

  // Validate Profiles
  if (!config.profiles || config.profiles.length === 0) {
    errors.push('At least one browser profile must be defined');
  } else {
    const profileNames = new Set<string>();
    for (const profile of config.profiles) {
      // Check for duplicate names
      if (profileNames.has(profile.name)) {
        errors.push(`Duplicate profile name: ${profile.name}`);
      }
      profileNames.add(profile.name);

      // Validate profile type
      if (!['openclaw', 'chrome-extension', 'remote'].includes(profile.type)) {
        errors.push(
          `Invalid profile type '${profile.type}' for profile '${profile.name}'`
        );
      }

      // Validate launch options
      if (profile.launchOptions.timeout < 0) {
        errors.push(
          `Profile '${profile.name}' timeout must be positive (got ${profile.launchOptions.timeout})`
        );
      }

      if (
        profile.launchOptions.defaultViewport.width <= 0 ||
        profile.launchOptions.defaultViewport.height <= 0
      ) {
        errors.push(
          `Profile '${profile.name}' viewport dimensions must be positive`
        );
      }

      // Note: Remote profiles are allowed in config even if not enabled
      // They just can't be used at runtime without allowRemoteProfiles
      // This allows users to define remote profiles in advance
    }

    // Check default profile exists
    const defaultProfileExists = config.profiles.some(
      (p) => p.name === config.browser.defaultProfile
    );
    if (!defaultProfileExists) {
      errors.push(
        `Default profile '${config.browser.defaultProfile}' not found in profiles list`
      );
    }
  }

  // Validate Paths
  const pathsToValidate = [
    { name: 'userDataBaseDir', path: config.paths.userDataBaseDir },
    { name: 'screenshotDir', path: config.paths.screenshotDir },
    { name: 'downloadDir', path: config.paths.downloadDir },
  ];

  for (const { name, path: dirPath } of pathsToValidate) {
    // Check for path traversal attempts
    const normalized = path.normalize(dirPath);
    if (normalized.includes('..')) {
      errors.push(
        `Path '${name}' contains directory traversal: ${dirPath}`
      );
    }

    // Check if path is absolute or relative to cwd
    if (!path.isAbsolute(dirPath) && !dirPath.startsWith('.')) {
      // Relative paths are okay, but warn about them
      // Not an error, just ensure they're valid
    }
  }

  // Validate Logging
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logging.level)) {
    errors.push(
      `Invalid log level '${config.logging.level}' (must be one of: ${validLogLevels.join(', ')})`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Ensure required directories exist
 * Creates directories if they don't exist
 */
export function ensureDirectories(config: BrowserAutomationConfig): void {
  const directories = [
    config.paths.userDataBaseDir,
    config.paths.screenshotDir,
    config.paths.downloadDir,
  ];

  // Add profile user data directories
  for (const profile of config.profiles) {
    directories.push(profile.userDataDir);
  }

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Validate and prepare configuration
 * Throws error if configuration is invalid
 */
export function validateAndPrepareConfig(
  config: BrowserAutomationConfig
): void {
  const validation = validateConfig(config);

  if (!validation.valid) {
    const errorMessage = [
      'Browser Automation configuration is invalid:',
      ...validation.errors.map((err) => `  - ${err}`),
    ].join('\n');
    throw new Error(errorMessage);
  }

  // Create required directories
  ensureDirectories(config);
}
