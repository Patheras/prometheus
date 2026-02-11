/**
 * Auth Profile Manager Tests
 * 
 * Tests for authentication profile management with round-robin selection,
 * failure tracking, and exponential backoff cooldown.
 * 
 * Requirements: 7.2
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AuthProfileManager } from './auth-profile-manager.js';
import { AuthProfile } from './types.js';

describe('AuthProfileManager', () => {
  let manager: AuthProfileManager;

  beforeEach(() => {
    manager = new AuthProfileManager();
  });

  describe('Profile Addition and Retrieval', () => {
    it('should add a profile to the pool', () => {
      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      const retrieved = manager.getProfile('profile-1');
      expect(retrieved).toEqual(profile);
    });

    it('should retrieve profiles by provider', () => {
      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      const profile3: AuthProfile = {
        id: 'profile-3',
        provider: 'openai',
        apiKey: 'test-key-3',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);
      manager.addProfile(profile3);

      const anthropicProfiles = manager.getProfilesForProvider('anthropic');
      expect(anthropicProfiles).toHaveLength(2);
      expect(anthropicProfiles.map(p => p.id)).toContain('profile-1');
      expect(anthropicProfiles.map(p => p.id)).toContain('profile-2');

      const openaiProfiles = manager.getProfilesForProvider('openai');
      expect(openaiProfiles).toHaveLength(1);
      expect(openaiProfiles[0].id).toBe('profile-3');
    });

    it('should return undefined for non-existent profile', () => {
      const retrieved = manager.getProfile('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should remove a profile', () => {
      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);
      expect(manager.getProfile('profile-1')).toBeDefined();

      const removed = manager.removeProfile('profile-1');
      expect(removed).toBe(true);
      expect(manager.getProfile('profile-1')).toBeUndefined();
    });

    it('should return false when removing non-existent profile', () => {
      const removed = manager.removeProfile('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('Round-Robin Selection', () => {
    it('should select the oldest used profile', () => {
      const now = Date.now();

      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: now - 1000,  // Used 1 second ago
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: now - 2000,  // Used 2 seconds ago (older)
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);

      const selected = manager.getAvailableProfile('anthropic');
      expect(selected?.id).toBe('profile-2');  // Oldest used
    });

    it('should update lastUsed timestamp when selecting', () => {
      const now = Date.now();

      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: now - 1000,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      const beforeSelect = profile.lastUsed;
      manager.getAvailableProfile('anthropic');
      const afterSelect = profile.lastUsed;

      expect(afterSelect).toBeGreaterThan(beforeSelect);
    });

    it('should rotate through profiles in round-robin fashion', () => {
      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      const profile3: AuthProfile = {
        id: 'profile-3',
        provider: 'anthropic',
        apiKey: 'test-key-3',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);
      manager.addProfile(profile3);

      // First selection - all have lastUsed=0, should get first in map order
      const first = manager.getAvailableProfile('anthropic');
      expect(first).toBeDefined();

      // Second selection - should get a different profile
      const second = manager.getAvailableProfile('anthropic');
      expect(second).toBeDefined();
      expect(second?.id).not.toBe(first?.id);

      // Third selection - should get the remaining profile
      const third = manager.getAvailableProfile('anthropic');
      expect(third).toBeDefined();
      expect(third?.id).not.toBe(first?.id);
      expect(third?.id).not.toBe(second?.id);

      // Fourth selection - should cycle back to the first selected
      const fourth = manager.getAvailableProfile('anthropic');
      expect(fourth?.id).toBe(first?.id);
    });

    it('should prefer recently successful profiles over round-robin', () => {
      const now = Date.now();
      const ONE_HOUR_MS = 3600000;

      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: now - 5000,  // Used 5 seconds ago (oldest)
        lastGood: 0,  // Never succeeded
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: now - 1000,  // Used 1 second ago (newest)
        lastGood: now - 30000,  // Succeeded 30 seconds ago (within 1 hour)
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 1
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);

      // Should prefer profile2 because it succeeded recently, even though profile1 is older
      const selected = manager.getAvailableProfile('anthropic');
      expect(selected?.id).toBe('profile-2');
    });

    it('should fall back to round-robin when no recently successful profiles', () => {
      const now = Date.now();
      const ONE_HOUR_MS = 3600000;

      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: now - 5000,  // Used 5 seconds ago (oldest)
        lastGood: now - (ONE_HOUR_MS + 1000),  // Succeeded over 1 hour ago
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 1
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: now - 1000,  // Used 1 second ago (newest)
        lastGood: 0,  // Never succeeded
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);

      // Should use round-robin (oldest used) since no profiles succeeded recently
      const selected = manager.getAvailableProfile('anthropic');
      expect(selected?.id).toBe('profile-1');
    });

    it('should prefer oldest recently successful profile when multiple are recent', () => {
      const now = Date.now();

      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: now - 5000,  // Used 5 seconds ago (oldest)
        lastGood: now - 30000,  // Succeeded 30 seconds ago
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 1
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: now - 1000,  // Used 1 second ago (newest)
        lastGood: now - 60000,  // Succeeded 1 minute ago
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 1
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);

      // Both succeeded recently, should use round-robin (oldest used)
      const selected = manager.getAvailableProfile('anthropic');
      expect(selected?.id).toBe('profile-1');
    });

    it('should return null when no profiles available for provider', () => {
      const selected = manager.getAvailableProfile('anthropic');
      expect(selected).toBeNull();
    });
  });

  describe('Cooldown Filtering', () => {
    it('should filter out profiles in cooldown', () => {
      const now = Date.now();

      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: now + 60000,  // In cooldown for 1 minute
        successCount: 0
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,  // Not in cooldown
        successCount: 0
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);

      const selected = manager.getAvailableProfile('anthropic');
      expect(selected?.id).toBe('profile-2');  // Only available profile
    });

    it('should return null when all profiles are in cooldown', () => {
      const now = Date.now();

      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: now + 60000,
        successCount: 0
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: now + 120000,
        successCount: 0
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);

      const selected = manager.getAvailableProfile('anthropic');
      expect(selected).toBeNull();
    });

    it('should include profiles whose cooldown has expired', () => {
      const now = Date.now();

      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: now - 1000,  // Cooldown expired 1 second ago
        successCount: 0
      };

      manager.addProfile(profile);

      const selected = manager.getAvailableProfile('anthropic');
      expect(selected?.id).toBe('profile-1');
    });
  });

  describe('Failure Tracking', () => {
    it('should increment failure count on markFailure', () => {
      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      manager.markFailure('profile-1');
      expect(profile.failureCount).toBe(1);

      manager.markFailure('profile-1');
      expect(profile.failureCount).toBe(2);
    });

    it('should apply exponential backoff cooldown on failure', () => {
      const baseDelayMs = 60000;  // 1 minute
      manager = new AuthProfileManager({ baseDelayMs });

      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      const now = Date.now();

      // First failure: baseDelay * 2^0 = 60000ms
      manager.markFailure('profile-1');
      expect(profile.cooldownUntil).toBeGreaterThanOrEqual(now + 60000);
      expect(profile.cooldownUntil).toBeLessThan(now + 60000 + 100);  // Allow small timing variance

      // Second failure: baseDelay * 2^1 = 120000ms
      const now2 = Date.now();
      manager.markFailure('profile-1');
      expect(profile.cooldownUntil).toBeGreaterThanOrEqual(now2 + 120000);
      expect(profile.cooldownUntil).toBeLessThan(now2 + 120000 + 100);

      // Third failure: baseDelay * 2^2 = 240000ms
      const now3 = Date.now();
      manager.markFailure('profile-1');
      expect(profile.cooldownUntil).toBeGreaterThanOrEqual(now3 + 240000);
      expect(profile.cooldownUntil).toBeLessThan(now3 + 240000 + 100);
    });

    it('should cap cooldown at maxCooldownMs', () => {
      const baseDelayMs = 60000;  // 1 minute
      const maxCooldownMs = 300000;  // 5 minutes
      manager = new AuthProfileManager({ baseDelayMs, maxCooldownMs });

      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      // Apply many failures to exceed max cooldown
      for (let i = 0; i < 10; i++) {
        manager.markFailure('profile-1');
      }

      const now = Date.now();
      const cooldownDuration = profile.cooldownUntil - now;

      // Should be capped at maxCooldownMs
      expect(cooldownDuration).toBeLessThanOrEqual(maxCooldownMs + 100);  // Allow timing variance
    });

    it('should throw error when marking failure for non-existent profile', () => {
      expect(() => {
        manager.markFailure('non-existent');
      }).toThrow('Profile not found: non-existent');
    });
  });

  describe('Success Tracking', () => {
    it('should increment success count on markSuccess', () => {
      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      manager.markSuccess('profile-1');
      expect(profile.successCount).toBe(1);

      manager.markSuccess('profile-1');
      expect(profile.successCount).toBe(2);
    });

    it('should update lastGood timestamp on success', () => {
      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      const beforeSuccess = profile.lastGood;
      manager.markSuccess('profile-1');
      const afterSuccess = profile.lastGood;

      expect(beforeSuccess).toBe(0);
      expect(afterSuccess).toBeGreaterThan(0);
      expect(afterSuccess).toBeGreaterThan(beforeSuccess);
    });

    it('should reset failure count on success', () => {
      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 5,  // Had previous failures
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      manager.markSuccess('profile-1');
      expect(profile.failureCount).toBe(0);
    });

    it('should clear cooldown on success', () => {
      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 2,
        cooldownUntil: Date.now() + 60000,  // In cooldown
        successCount: 0
      };

      manager.addProfile(profile);

      manager.markSuccess('profile-1');
      expect(profile.cooldownUntil).toBe(0);
    });

    it('should throw error when marking success for non-existent profile', () => {
      expect(() => {
        manager.markSuccess('non-existent');
      }).toThrow('Profile not found: non-existent');
    });
  });

  describe('Profile Counts', () => {
    it('should return correct profile count for provider', () => {
      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);

      expect(manager.getProfileCount('anthropic')).toBe(2);
      expect(manager.getProfileCount('openai')).toBe(0);
    });

    it('should return correct available profile count', () => {
      const now = Date.now();

      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,  // Available
        successCount: 0
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'anthropic',
        apiKey: 'test-key-2',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: now + 60000,  // In cooldown
        successCount: 0
      };

      const profile3: AuthProfile = {
        id: 'profile-3',
        provider: 'anthropic',
        apiKey: 'test-key-3',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,  // Available
        successCount: 0
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);
      manager.addProfile(profile3);

      expect(manager.getProfileCount('anthropic')).toBe(3);
      expect(manager.getAvailableProfileCount('anthropic')).toBe(2);
    });
  });

  describe('Clear', () => {
    it('should clear all profiles', () => {
      const profile1: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      const profile2: AuthProfile = {
        id: 'profile-2',
        provider: 'openai',
        apiKey: 'test-key-2',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile1);
      manager.addProfile(profile2);

      expect(manager.getProfileCount('anthropic')).toBe(1);
      expect(manager.getProfileCount('openai')).toBe(1);

      manager.clear();

      expect(manager.getProfileCount('anthropic')).toBe(0);
      expect(manager.getProfileCount('openai')).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should use custom base delay', () => {
      const customBaseDelay = 30000;  // 30 seconds
      manager = new AuthProfileManager({ baseDelayMs: customBaseDelay });

      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      const now = Date.now();
      manager.markFailure('profile-1');

      // First failure should use custom base delay
      expect(profile.cooldownUntil).toBeGreaterThanOrEqual(now + customBaseDelay);
      expect(profile.cooldownUntil).toBeLessThan(now + customBaseDelay + 100);
    });

    it('should use custom max cooldown', () => {
      const customMaxCooldown = 180000;  // 3 minutes
      manager = new AuthProfileManager({ maxCooldownMs: customMaxCooldown });

      const profile: AuthProfile = {
        id: 'profile-1',
        provider: 'anthropic',
        apiKey: 'test-key-1',
        lastUsed: 0,
        lastGood: 0,
        failureCount: 0,
        cooldownUntil: 0,
        successCount: 0
      };

      manager.addProfile(profile);

      // Apply many failures
      for (let i = 0; i < 10; i++) {
        manager.markFailure('profile-1');
      }

      const now = Date.now();
      const cooldownDuration = profile.cooldownUntil - now;

      // Should be capped at custom max
      expect(cooldownDuration).toBeLessThanOrEqual(customMaxCooldown + 100);
    });
  });
});
