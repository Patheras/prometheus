/**
 * Profile Manager
 * 
 * Manages browser profiles including CRUD operations and validation.
 * Provides default profiles (openclaw, chrome-extension, remote) and
 * supports custom profile creation.
 */

import { BrowserProfile, ValidationResult } from './types/index.js';
import { DEFAULT_PROFILES } from './config/default-config.js';
import { promises as fs } from 'fs';
import path from 'path';

export class ProfileManager {
  private profiles: Map<string, BrowserProfile>;
  private defaultProfileName: string;

  constructor(initialProfiles: BrowserProfile[] = DEFAULT_PROFILES) {
    this.profiles = new Map();
    this.defaultProfileName = 'openclaw';

    // Load initial profiles
    for (const profile of initialProfiles) {
      this.profiles.set(profile.name, profile);
    }
  }

  /**
   * Get a profile by name
   */
  getProfile(name: string): BrowserProfile | null {
    return this.profiles.get(name) || null;
  }

  /**
   * List all profiles
   */
  listProfiles(): BrowserProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Create a new profile
   * @throws Error if profile already exists or validation fails
   */
  async createProfile(profile: BrowserProfile): Promise<void> {
    // Check if profile already exists
    if (this.profiles.has(profile.name)) {
      throw new Error(`Profile '${profile.name}' already exists`);
    }

    // Validate profile
    const validation = this.validateProfile(profile);
    if (!validation.valid) {
      throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
    }

    // Add profile
    this.profiles.set(profile.name, profile);
  }

  /**
   * Update an existing profile
   * @throws Error if profile doesn't exist or validation fails
   */
  async updateProfile(name: string, updates: Partial<BrowserProfile>): Promise<void> {
    const existingProfile = this.profiles.get(name);
    if (!existingProfile) {
      throw new Error(`Profile '${name}' not found`);
    }

    // Merge updates with existing profile
    const updatedProfile: BrowserProfile = {
      ...existingProfile,
      ...updates,
      // Ensure name cannot be changed through updates
      name: existingProfile.name,
      // Deep merge nested objects
      launchOptions: {
        ...existingProfile.launchOptions,
        ...updates.launchOptions,
        defaultViewport: {
          ...existingProfile.launchOptions.defaultViewport,
          ...updates.launchOptions?.defaultViewport,
        },
      },
      connectionOptions: updates.connectionOptions
        ? {
            ...existingProfile.connectionOptions,
            ...updates.connectionOptions,
          }
        : existingProfile.connectionOptions,
    };

    // Validate updated profile
    const validation = this.validateProfile(updatedProfile);
    if (!validation.valid) {
      throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
    }

    // Update profile
    this.profiles.set(name, updatedProfile);
  }

  /**
   * Delete a profile
   * @throws Error if profile doesn't exist or is the default profile
   */
  async deleteProfile(name: string): Promise<void> {
    if (!this.profiles.has(name)) {
      throw new Error(`Profile '${name}' not found`);
    }

    // Prevent deletion of default profile
    if (name === this.defaultProfileName) {
      throw new Error(`Cannot delete default profile '${name}'`);
    }

    this.profiles.delete(name);
  }

  /**
   * Get the default profile
   */
  getDefaultProfile(): BrowserProfile {
    const profile = this.profiles.get(this.defaultProfileName);
    if (!profile) {
      throw new Error(`Default profile '${this.defaultProfileName}' not found`);
    }
    return profile;
  }

  /**
   * Set the default profile
   * @throws Error if profile doesn't exist
   */
  async setDefaultProfile(name: string): Promise<void> {
    if (!this.profiles.has(name)) {
      throw new Error(`Profile '${name}' not found`);
    }
    this.defaultProfileName = name;
  }

  /**
   * Validate a profile configuration
   */
  validateProfile(profile: BrowserProfile): ValidationResult {
    const errors: string[] = [];

    // Validate name
    if (!profile.name || typeof profile.name !== 'string' || profile.name.trim() === '') {
      errors.push('Profile name is required and must be a non-empty string');
    }

    // Validate type
    const validTypes: string[] = ['openclaw', 'chrome-extension', 'remote'];
    if (!profile.type || !validTypes.includes(profile.type)) {
      errors.push(`Profile type must be one of: ${validTypes.join(', ')}`);
    }

    // Validate userDataDir
    if (!profile.userDataDir || typeof profile.userDataDir !== 'string') {
      errors.push('userDataDir is required and must be a string');
    }

    // Validate launchOptions
    if (!profile.launchOptions) {
      errors.push('launchOptions is required');
    } else {
      // Validate headless
      if (typeof profile.launchOptions.headless !== 'boolean') {
        errors.push('launchOptions.headless must be a boolean');
      }

      // Validate args
      if (!Array.isArray(profile.launchOptions.args)) {
        errors.push('launchOptions.args must be an array');
      }

      // Validate defaultViewport
      if (!profile.launchOptions.defaultViewport) {
        errors.push('launchOptions.defaultViewport is required');
      } else {
        if (
          typeof profile.launchOptions.defaultViewport.width !== 'number' ||
          profile.launchOptions.defaultViewport.width <= 0
        ) {
          errors.push('launchOptions.defaultViewport.width must be a positive number');
        }
        if (
          typeof profile.launchOptions.defaultViewport.height !== 'number' ||
          profile.launchOptions.defaultViewport.height <= 0
        ) {
          errors.push('launchOptions.defaultViewport.height must be a positive number');
        }
      }

      // Validate timeout
      if (
        typeof profile.launchOptions.timeout !== 'number' ||
        profile.launchOptions.timeout <= 0
      ) {
        errors.push('launchOptions.timeout must be a positive number');
      }
    }

    // Validate connectionOptions for specific profile types
    if (profile.type === 'chrome-extension') {
      if (!profile.connectionOptions) {
        errors.push('connectionOptions is required for chrome-extension profile');
      }
    }

    if (profile.type === 'remote') {
      if (!profile.connectionOptions) {
        errors.push('connectionOptions is required for remote profile');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Load profiles from a JSON configuration file
   * @param filePath Path to the configuration file
   * @throws Error if file cannot be read, JSON is invalid, or validation fails
   */
  async loadFromFile(filePath: string): Promise<void> {
    try {
      // Read file
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // Parse JSON
      let config: any;
      try {
        config = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON in configuration file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Validate structure
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('Configuration file must contain a JSON object');
      }

      if (!Array.isArray(config.profiles)) {
        throw new Error('Configuration must contain a "profiles" array');
      }

      // Validate and load each profile
      const validationErrors: string[] = [];
      for (const profile of config.profiles) {
        const validation = this.validateProfile(profile);
        if (!validation.valid) {
          validationErrors.push(`Profile '${profile.name || 'unknown'}': ${validation.errors.join(', ')}`);
        }
      }

      if (validationErrors.length > 0) {
        throw new Error(`Profile validation failed:\n${validationErrors.join('\n')}`);
      }

      // Clear existing profiles and load new ones
      this.profiles.clear();
      for (const profile of config.profiles) {
        this.profiles.set(profile.name, profile);
      }

      // Load default profile name if specified
      if (config.defaultProfile && typeof config.defaultProfile === 'string') {
        if (this.profiles.has(config.defaultProfile)) {
          this.defaultProfileName = config.defaultProfile;
        } else {
          throw new Error(`Default profile '${config.defaultProfile}' not found in loaded profiles`);
        }
      }
    } catch (error: any) {
      // Handle file not found error
      if (error?.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${filePath}`);
      }
      // Re-throw other errors as-is
      throw error;
    }
  }

  /**
   * Save profiles to a JSON configuration file with pretty printing
   * @param filePath Path to save the configuration file
   * @throws Error if file cannot be written
   */
  async saveToFile(filePath: string): Promise<void> {
    try {
      // Create configuration object
      const config = {
        defaultProfile: this.defaultProfileName,
        profiles: this.listProfiles(),
      };

      // Serialize to JSON with pretty printing (2-space indentation)
      const jsonContent = JSON.stringify(config, null, 2);

      // Ensure directory exists
      const directory = path.dirname(filePath);
      await fs.mkdir(directory, { recursive: true });

      // Write file
      await fs.writeFile(filePath, jsonContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save configuration file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sanitize a file path to prevent directory traversal attacks
   * Removes ../ and ..\ patterns and normalizes the path
   * @param inputPath Path to sanitize
   * @returns Sanitized path
   */
  sanitizePath(inputPath: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Path must be a non-empty string');
    }

    // Remove any ../ or ..\ patterns to prevent directory traversal
    let sanitized = inputPath.replace(/\.\.[/\\]/g, '');
    
    // Also remove any standalone .. at the end
    sanitized = sanitized.replace(/\.\.$/, '');
    
    // Normalize the path to resolve any remaining relative segments
    sanitized = path.normalize(sanitized);
    
    // Additional check: ensure the normalized path doesn't contain ..
    if (sanitized.includes('..')) {
      throw new Error('Invalid path: directory traversal detected');
    }
    
    return sanitized;
  }

  /**
   * Ensure user data directory exists for a profile
   * Creates the directory if it doesn't exist
   * @param profile Browser profile
   * @throws Error if directory creation fails
   */
  async ensureUserDataDir(profile: BrowserProfile): Promise<void> {
    if (!profile || !profile.userDataDir) {
      throw new Error('Profile must have a userDataDir');
    }

    // Sanitize the path to prevent directory traversal
    const sanitizedPath = this.sanitizePath(profile.userDataDir);
    
    try {
      // Check if directory exists
      await fs.access(sanitizedPath);
    } catch (error: any) {
      // Directory doesn't exist, create it
      if (error?.code === 'ENOENT') {
        try {
          await fs.mkdir(sanitizedPath, { recursive: true });
        } catch (mkdirError) {
          throw new Error(`Failed to create user data directory: ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
        }
      } else {
        // Other access error
        throw new Error(`Failed to access user data directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Clean up user data directory for a profile
   * Removes the directory and all its contents
   * @param profile Browser profile
   * @throws Error if directory cleanup fails
   */
  async cleanupUserDataDir(profile: BrowserProfile): Promise<void> {
    if (!profile || !profile.userDataDir) {
      throw new Error('Profile must have a userDataDir');
    }

    // Sanitize the path to prevent directory traversal
    const sanitizedPath = this.sanitizePath(profile.userDataDir);
    
    try {
      // Check if directory exists before attempting to remove
      await fs.access(sanitizedPath);
      
      // Remove directory and all contents
      await fs.rm(sanitizedPath, { recursive: true, force: true });
    } catch (error: any) {
      // If directory doesn't exist, that's fine (already cleaned up)
      if (error?.code === 'ENOENT') {
        return;
      }
      
      // Other errors should be thrown
      throw new Error(`Failed to cleanup user data directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
