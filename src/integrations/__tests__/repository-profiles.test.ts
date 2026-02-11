/**
 * Tests for RepositoryProfileManager
 */

import { RepositoryProfileManager, BranchingStrategy } from '../repository-profiles';
import { MemoryEngine } from '../../memory/engine';

describe('RepositoryProfileManager', () => {
  let memoryEngine: MemoryEngine;
  let profileManager: RepositoryProfileManager;

  beforeEach(() => {
    memoryEngine = new MemoryEngine({
      dbPath: ':memory:',
      embeddingProvider: 'mock',
    });
    profileManager = new RepositoryProfileManager(memoryEngine);
  });

  afterEach(async () => {
    await memoryEngine.close();
  });

  describe('Profile Creation', () => {
    it('should create a profile with default settings', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Test Profile',
      });

      expect(profile.id).toBeTruthy();
      expect(profile.repoId).toBe('test-repo');
      expect(profile.name).toBe('Test Profile');
      expect(profile.branching).toBeDefined();
      expect(profile.testing).toBeDefined();
      expect(profile.review).toBeDefined();
      expect(profile.createdAt).toBeTruthy();
      expect(profile.updatedAt).toBeTruthy();
    });

    it('should create a profile with custom settings', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Custom Profile',
        branching: {
          strategy: 'git-flow',
          mainBranch: 'main',
          developBranch: 'develop',
          featurePrefix: 'feature/',
          releasePrefix: 'release/',
        },
        testing: {
          commands: [
            { name: 'lint', command: 'npm run lint', required: true },
            { name: 'test', command: 'npm test', required: true },
          ],
          requireAllPass: true,
        },
        review: {
          required: true,
          minApprovals: 2,
        },
      });

      expect(profile.branching.strategy).toBe('git-flow');
      expect(profile.branching.developBranch).toBe('develop');
      expect(profile.testing.commands).toHaveLength(2);
      expect(profile.review.minApprovals).toBe(2);
    });

    it('should generate unique profile IDs', async () => {
      const profile1 = await profileManager.createProfile('repo1', { name: 'Profile 1' });
      const profile2 = await profileManager.createProfile('repo2', { name: 'Profile 2' });

      expect(profile1.id).not.toBe(profile2.id);
    });
  });

  describe('Profile Retrieval', () => {
    it('should retrieve a profile by repository ID', async () => {
      const created = await profileManager.createProfile('test-repo', {
        name: 'Test Profile',
      });

      const retrieved = await profileManager.getProfile('test-repo');

      expect(retrieved).toBeTruthy();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Profile');
    });

    it('should return null for non-existent repository', async () => {
      const profile = await profileManager.getProfile('non-existent');
      expect(profile).toBeNull();
    });

    it('should cache profiles', async () => {
      await profileManager.createProfile('test-repo', { name: 'Test' });

      // First retrieval
      const profile1 = await profileManager.getProfile('test-repo');
      // Second retrieval (should use cache)
      const profile2 = await profileManager.getProfile('test-repo');

      expect(profile1).toBe(profile2);
    });
  });

  describe('Profile Updates', () => {
    it('should update profile settings', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Original Name',
      });

      const updated = await profileManager.updateProfile(profile.id, {
        name: 'Updated Name',
        description: 'New description',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('New description');
      expect(updated.updatedAt).toBeGreaterThan(profile.updatedAt);
    });

    it('should preserve immutable fields', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Test',
      });

      const updated = await profileManager.updateProfile(profile.id, {
        id: 'different-id',
        repoId: 'different-repo',
        createdAt: 999,
      } as any);

      expect(updated.id).toBe(profile.id);
      expect(updated.repoId).toBe(profile.repoId);
      expect(updated.createdAt).toBe(profile.createdAt);
    });

    it('should throw error for non-existent profile', async () => {
      await expect(
        profileManager.updateProfile('non-existent', { name: 'Test' })
      ).rejects.toThrow('Profile not found');
    });
  });

  describe('Profile Deletion', () => {
    it('should delete a profile', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Test',
      });

      await profileManager.deleteProfile(profile.id);

      // Profile should no longer be retrievable
      const retrieved = await profileManager.getProfile('test-repo');
      expect(retrieved).toBeNull();
    });

    it('should throw error when deleting non-existent profile', async () => {
      await expect(
        profileManager.deleteProfile('non-existent')
      ).rejects.toThrow('Profile not found');
    });
  });

  describe('Templates', () => {
    it('should provide multiple templates', () => {
      const templates = profileManager.getTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.name && t.description && t.profile)).toBe(true);
    });

    it('should get specific template by name', () => {
      const template = profileManager.getTemplate('github-flow');

      expect(template).toBeTruthy();
      expect(template?.name).toBe('github-flow');
      expect(template?.profile.branching.strategy).toBe('github-flow');
    });

    it('should return null for non-existent template', () => {
      const template = profileManager.getTemplate('non-existent');
      expect(template).toBeNull();
    });

    it('should create profile from template', async () => {
      const profile = await profileManager.createFromTemplate('test-repo', 'github-flow');

      expect(profile.repoId).toBe('test-repo');
      expect(profile.branching.strategy).toBe('github-flow');
      expect(profile.branching.mainBranch).toBe('main');
    });

    it('should allow overriding template settings', async () => {
      const profile = await profileManager.createFromTemplate(
        'test-repo',
        'github-flow',
        {
          name: 'Custom Name',
          branching: {
            strategy: 'github-flow',
            mainBranch: 'master',
            featurePrefix: 'feat/',
          },
        }
      );

      expect(profile.name).toBe('Custom Name');
      expect(profile.branching.mainBranch).toBe('master');
      expect(profile.branching.featurePrefix).toBe('feat/');
    });

    it('should throw error for non-existent template', async () => {
      await expect(
        profileManager.createFromTemplate('test-repo', 'non-existent')
      ).rejects.toThrow('Template not found');
    });
  });

  describe('Profile Validation', () => {
    it('should validate a valid profile', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Valid Profile',
      });

      const validation = profileManager.validateProfile(profile);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing main branch', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Invalid',
        branching: {
          strategy: 'github-flow',
          mainBranch: '',
          featurePrefix: 'feature/',
        },
      });

      const validation = profileManager.validateProfile(profile);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Main branch'))).toBe(true);
    });

    it('should detect missing develop branch for git-flow', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Invalid',
        branching: {
          strategy: 'git-flow',
          mainBranch: 'main',
          featurePrefix: 'feature/',
        },
      });

      const validation = profileManager.validateProfile(profile);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Develop branch'))).toBe(true);
    });

    it('should detect missing test commands', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Invalid',
        testing: {
          commands: [],
          requireAllPass: true,
        },
      });

      const validation = profileManager.validateProfile(profile);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('test command'))).toBe(true);
    });

    it('should detect invalid review configuration', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Invalid',
        review: {
          required: true,
          minApprovals: 0,
        },
      });

      const validation = profileManager.validateProfile(profile);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('approvals'))).toBe(true);
    });
  });

  describe('Branching Strategies', () => {
    it('should support git-flow strategy', async () => {
      const profile = await profileManager.createFromTemplate('test-repo', 'git-flow');

      expect(profile.branching.strategy).toBe('git-flow');
      expect(profile.branching.mainBranch).toBe('main');
      expect(profile.branching.developBranch).toBe('develop');
      expect(profile.branching.featurePrefix).toBe('feature/');
      expect(profile.branching.releasePrefix).toBe('release/');
      expect(profile.branching.hotfixPrefix).toBe('hotfix/');
    });

    it('should support github-flow strategy', async () => {
      const profile = await profileManager.createFromTemplate('test-repo', 'github-flow');

      expect(profile.branching.strategy).toBe('github-flow');
      expect(profile.branching.mainBranch).toBe('main');
      expect(profile.branching.featurePrefix).toBe('feature/');
      expect(profile.branching.requireLinearHistory).toBe(true);
    });

    it('should support trunk-based strategy', async () => {
      const profile = await profileManager.createFromTemplate('test-repo', 'trunk-based');

      expect(profile.branching.strategy).toBe('trunk-based');
      expect(profile.branching.mainBranch).toBe('main');
      expect(profile.branching.maxBranchAge).toBe(2);
      expect(profile.branching.requireLinearHistory).toBe(true);
    });
  });

  describe('Testing Configuration', () => {
    it('should support multiple test commands', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Test',
        testing: {
          commands: [
            { name: 'lint', command: 'npm run lint', required: true },
            { name: 'unit', command: 'npm run test:unit', required: true },
            { name: 'e2e', command: 'npm run test:e2e', required: false },
          ],
          requireAllPass: true,
        },
      });

      expect(profile.testing.commands).toHaveLength(3);
      expect(profile.testing.commands[0].name).toBe('lint');
      expect(profile.testing.commands[2].required).toBe(false);
    });

    it('should support coverage configuration', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Test',
        testing: {
          commands: [{ name: 'test', command: 'npm test', required: true }],
          requireAllPass: true,
          coverage: {
            enabled: true,
            threshold: 80,
            reportPath: './coverage',
          },
        },
      });

      expect(profile.testing.coverage?.enabled).toBe(true);
      expect(profile.testing.coverage?.threshold).toBe(80);
    });
  });

  describe('Review Configuration', () => {
    it('should support review requirements', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Test',
        review: {
          required: true,
          minApprovals: 2,
          requireCodeOwners: true,
          requireAllResolved: true,
          allowSelfReview: false,
        },
      });

      expect(profile.review.required).toBe(true);
      expect(profile.review.minApprovals).toBe(2);
      expect(profile.review.requireCodeOwners).toBe(true);
    });

    it('should support reviewer assignment', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Test',
        review: {
          required: true,
          minApprovals: 1,
          reviewers: ['user1', 'user2'],
          autoAssign: true,
        },
      });

      expect(profile.review.reviewers).toEqual(['user1', 'user2']);
      expect(profile.review.autoAssign).toBe(true);
    });
  });

  describe('Quality Gates', () => {
    it('should support multiple quality gates', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Test',
        qualityGates: [
          { name: 'lint', type: 'lint', command: 'npm run lint', required: true, blocking: true },
          { name: 'security', type: 'security', command: 'npm audit', required: true, blocking: true },
          { name: 'format', type: 'format', command: 'npm run format:check', required: false },
        ],
      });

      expect(profile.qualityGates).toHaveLength(3);
      expect(profile.qualityGates[0].blocking).toBe(true);
      expect(profile.qualityGates[2].required).toBe(false);
    });
  });

  describe('Deployment Configuration', () => {
    it('should support deployment environments', async () => {
      const profile = await profileManager.createProfile('test-repo', {
        name: 'Test',
        deployment: {
          environments: [
            { name: 'staging', branch: 'develop', requireTests: true },
            { name: 'production', branch: 'main', requireTests: true, requireReview: true },
          ],
          requireApproval: true,
          rollbackStrategy: 'automatic',
        },
      });

      expect(profile.deployment?.environments).toHaveLength(2);
      expect(profile.deployment?.environments[1].name).toBe('production');
      expect(profile.deployment?.requireApproval).toBe(true);
    });
  });

  describe('Enterprise Template', () => {
    it('should have strict quality requirements', async () => {
      const profile = await profileManager.createFromTemplate('test-repo', 'enterprise');

      expect(profile.review.minApprovals).toBeGreaterThanOrEqual(3);
      expect(profile.review.requireCodeOwners).toBe(true);
      expect(profile.testing.commands.length).toBeGreaterThan(2);
      expect(profile.qualityGates.length).toBeGreaterThan(0);
    });

    it('should have coverage requirements', async () => {
      const profile = await profileManager.createFromTemplate('test-repo', 'enterprise');

      expect(profile.testing.coverage?.enabled).toBe(true);
      expect(profile.testing.coverage?.threshold).toBeGreaterThan(0);
    });
  });

  describe('Open Source Template', () => {
    it('should be community-friendly', async () => {
      const profile = await profileManager.createFromTemplate('test-repo', 'open-source');

      expect(profile.review.requireCodeOwners).toBe(false);
      expect(profile.branching.requireLinearHistory).toBe(false);
    });
  });
});
