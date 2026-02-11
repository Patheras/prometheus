/**
 * Auth Profile Manager
 * 
 * Manages authentication profiles with round-robin selection,
 * failure tracking, and exponential backoff cooldown.
 * 
 * Requirements: 7.2
 */

import { AuthProfile } from './types.js';

/**
 * Configuration for auth profile management
 */
export type AuthProfileConfig = {
  baseDelayMs?: number;    // Base delay for cooldown (default: 60000 = 1 minute)
  maxCooldownMs?: number;  // Maximum cooldown duration (default: 3600000 = 1 hour)
};

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<AuthProfileConfig> = {
  baseDelayMs: 60000,      // 1 minute
  maxCooldownMs: 3600000   // 1 hour
};

/**
 * AuthProfileManager manages a pool of authentication profiles
 * with round-robin selection, failure tracking, and cooldown.
 */
export class AuthProfileManager {
  private profiles: Map<string, AuthProfile> = new Map();
  private config: Required<AuthProfileConfig>;

  constructor(config: AuthProfileConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a profile to the pool
   * @param profile - The authentication profile to add
   */
  addProfile(profile: AuthProfile): void {
    this.profiles.set(profile.id, profile);
  }

  /**
   * Get the next available profile for a provider using round-robin selection
   * Prefers profiles that have been recently successful (within 1 hour)
   * @param provider - The provider name (e.g., 'anthropic', 'openai')
   * @returns The next available profile, or null if none available
   */
  getAvailableProfile(provider: string): AuthProfile | null {
    const now = Date.now();
    const ONE_HOUR_MS = 3600000;
    
    // Filter profiles for this provider that are not in cooldown
    const availableProfiles = Array.from(this.profiles.values())
      .filter(p => p.provider === provider)
      .filter(p => p.cooldownUntil === 0 || now >= p.cooldownUntil);

    if (availableProfiles.length === 0) {
      return null;
    }

    // Sort by lastUsed (oldest first) for round-robin
    availableProfiles.sort((a, b) => a.lastUsed - b.lastUsed);

    // Prefer profiles that worked recently (within 1 hour)
    const recentlyGood = availableProfiles.filter(p => 
      p.lastGood > 0 && (now - p.lastGood) < ONE_HOUR_MS
    );

    // Select the first recently good profile, or fall back to oldest used
    const selected = recentlyGood[0] || availableProfiles[0];

    // Update lastUsed timestamp
    selected.lastUsed = now;

    return selected;
  }

  /**
   * Mark a profile as successful
   * Resets failure count and clears cooldown
   * Updates lastGood timestamp for preference tracking
   * @param profileId - The profile ID
   */
  markSuccess(profileId: string): void {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    profile.successCount += 1;
    profile.failureCount = 0;
    profile.cooldownUntil = 0;
    profile.lastGood = Date.now();
  }

  /**
   * Mark a profile as failed
   * Increments failure count and applies exponential backoff cooldown
   * @param profileId - The profile ID
   */
  markFailure(profileId: string): void {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    profile.failureCount += 1;

    // Calculate cooldown with exponential backoff: baseDelay * 2^failureCount
    const cooldownMs = Math.min(
      this.config.baseDelayMs * Math.pow(2, profile.failureCount - 1),
      this.config.maxCooldownMs
    );

    profile.cooldownUntil = Date.now() + cooldownMs;
  }

  /**
   * Get all profiles for a provider
   * @param provider - The provider name
   * @returns Array of profiles for the provider
   */
  getProfilesForProvider(provider: string): AuthProfile[] {
    return Array.from(this.profiles.values())
      .filter(p => p.provider === provider);
  }

  /**
   * Get a profile by ID
   * @param profileId - The profile ID
   * @returns The profile, or undefined if not found
   */
  getProfile(profileId: string): AuthProfile | undefined {
    return this.profiles.get(profileId);
  }

  /**
   * Remove a profile from the pool
   * @param profileId - The profile ID
   * @returns true if removed, false if not found
   */
  removeProfile(profileId: string): boolean {
    return this.profiles.delete(profileId);
  }

  /**
   * Get the count of profiles for a provider
   * @param provider - The provider name
   * @returns Number of profiles
   */
  getProfileCount(provider: string): number {
    return this.getProfilesForProvider(provider).length;
  }

  /**
   * Get the count of available (not in cooldown) profiles for a provider
   * @param provider - The provider name
   * @returns Number of available profiles
   */
  getAvailableProfileCount(provider: string): number {
    const now = Date.now();
    return this.getProfilesForProvider(provider)
      .filter(p => p.cooldownUntil === 0 || now >= p.cooldownUntil)
      .length;
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear();
  }
}
