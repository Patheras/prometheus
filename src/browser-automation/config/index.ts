/**
 * Browser Automation Configuration Module
 * 
 * Exports configuration utilities, defaults, and validators.
 */

export {
  DEFAULT_CONFIG,
  DEFAULT_PROFILES,
  loadConfigFromEnv,
  loadConfigFromFile,
  loadConfig,
  mergeConfig,
} from './default-config.js';

export {
  validateConfig,
  ensureDirectories,
  validateAndPrepareConfig,
} from './validator.js';
