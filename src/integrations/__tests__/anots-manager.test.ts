/**
 * Tests for ANOTS Manager
 */

import { AnotsManager, AnotsPattern } from '../anots-manager';
import { MemoryEngine } from '../../memory/engine';
import { join } from 'path';
import { tmpdir } from 'os';

describe('AnotsManager', () => {
  let manager: AnotsManager;
  let memoryEngine: MemoryEngine;
  let anotsRepoPath: string;
  let prometheusRepoPath: string;

  beforeEach(async () => {
    // Set up paths
    const tempDir = tmpdir();
    anotsRepoPath = join(tempDir, 'anots-repo');
    prometheusRepoPath = join(tempDir, 'prometheus-repo');

    // Mock memory engine
    memoryEngine = {
      searchPatterns: jest.fn().mockResolvedValue([]),
      storePattern: jest.fn().mockResolvedValue('pattern-id'),
      updatePatternOutcome: jest.fn().mockResolvedValue(undefined),
    } as unknown as MemoryEngine;

    manager = new AnotsManager(memoryEngine, anotsRepoPath, prometheusRepoPath);
    await manager.initializePatterns();
  });

  describe('Pattern Management', () => {
    it('should initialize with default patterns', async () => {
      const patterns = manager.getAllPatterns();
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.name === 'Supabase RLS Pattern')).toBe(true);
      expect(patterns.some(p => p.name === 'API Route Naming')).toBe(true);
    });

    it('should get patterns by category', () => {
      const architecturePatterns = manager.getPatternsByCategory('architecture');
      const namingPatterns = manager.getPatternsByCategory('naming');

      expect(architecturePatterns.length).toBeGreaterThan(0);
      expect(namingPatterns.length).toBeGreaterThan(0);
      expect(architecturePatterns.every(p => p.category === 'architecture')).toBe(true);
    });

    it('should track pattern usage', async () => {
      const patterns = manager.getAllPatterns();
      const patternId = patterns[0].id;

      await manager.trackPatternUsage(patternId, true);

      const pattern = manager.getPattern(patternId);
      expect(pattern?.usageCount).toBe(1);
      expect(memoryEngine.updatePatternOutcome).toHaveBeenCalledWith(
        patternId,
        expect.objectContaining({ success: true })
      );
    });

    it('should get most used patterns', async () => {
      const patterns = manager.getAllPatterns();
      
      // Track usage for different patterns
      await manager.trackPatternUsage(patterns[0].id, true);
      await manager.trackPatternUsage(patterns[0].id, true);
      await manager.trackPatternUsage(patterns[1].id, true);

      const mostUsed = manager.getMostUsedPatterns(2);
      
      expect(mostUsed.length).toBe(2);
      expect(mostUsed[0].usageCount).toBeGreaterThanOrEqual(mostUsed[1].usageCount);
    });

    it('should learn new patterns', async () => {
      const newPattern: Omit<AnotsPattern, 'id' | 'usageCount' | 'lastUsed'> = {
        name: 'Custom Pattern',
        category: 'testing',
        description: 'A custom testing pattern',
        example: 'test("example", () => {})',
        applicability: 'All test files',
      };

      const patternId = await manager.learnPattern(newPattern);

      expect(patternId).toBeTruthy();
      
      const learned = manager.getPattern(patternId);
      expect(learned?.name).toBe('Custom Pattern');
      expect(learned?.category).toBe('testing');
    });

    it('should throw error for non-existent pattern', async () => {
      await expect(
        manager.trackPatternUsage('non-existent-id', true)
      ).rejects.toThrow('Pattern not found');
    });
  });

  describe('Branching Strategy', () => {
    it('should validate correct branch names', () => {
      const validNames = [
        'prometheus/feature-name',
        'prometheus/bug-fix',
        'prometheus/update-123',
      ];

      for (const name of validNames) {
        const violations = manager.validateBranchName(name);
        expect(violations.length).toBe(0);
      }
    });

    it('should reject invalid branch names', () => {
      const invalidNames = [
        'feature/name',           // Wrong prefix
        'prometheus/Feature',     // Uppercase
        'prometheus/feature_name', // Underscore
        'prometheus/feature name', // Space
      ];

      for (const name of invalidNames) {
        const violations = manager.validateBranchName(name);
        expect(violations.length).toBeGreaterThan(0);
        expect(violations[0].type).toBe('branch_naming');
      }
    });

    it('should detect protected branch violations', () => {
      const protectedBranches = ['main', 'production', 'staging'];

      for (const branch of protectedBranches) {
        const violations = manager.validateBranchName(branch);
        expect(violations.some(v => v.type === 'protected_branch')).toBe(true);
      }
    });

    it('should check if branch requires PR', () => {
      expect(manager.requiresPullRequest('main')).toBe(true);
      expect(manager.requiresPullRequest('production')).toBe(true);
      expect(manager.requiresPullRequest('prometheus/feature')).toBe(false);
    });

    it('should get branching strategy', () => {
      const strategy = manager.getBranchingStrategy();

      expect(strategy.branchPrefix).toBe('prometheus/');
      expect(strategy.baseBranch).toBe('main');
      expect(strategy.protectedBranches).toContain('main');
      expect(strategy.autoDeleteOnMerge).toBe(true);
    });

    it('should update branching strategy', () => {
      manager.updateBranchingStrategy({
        branchPrefix: 'custom/',
        autoDeleteOnMerge: false,
      });

      const strategy = manager.getBranchingStrategy();
      expect(strategy.branchPrefix).toBe('custom/');
      expect(strategy.autoDeleteOnMerge).toBe(false);
    });
  });

  describe('Repository Separation', () => {
    it('should verify ANOTS repository paths', () => {
      const anotsPath = join(anotsRepoPath, 'src', 'components', 'Button.tsx');
      const violations = manager.verifyRepositorySeparation(anotsPath);

      expect(violations.length).toBe(0);
    });

    it('should reject Prometheus repository modifications', () => {
      const prometheusPath = join(prometheusRepoPath, 'src', 'memory', 'engine.ts');
      const violations = manager.verifyRepositorySeparation(prometheusPath);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('repository_separation');
      expect(violations[0].severity).toBe('error');
    });

    it('should warn about paths outside repositories', () => {
      const outsidePath = '/some/random/path/file.ts';
      const violations = manager.verifyRepositorySeparation(outsidePath);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('repository_separation');
      expect(violations[0].severity).toBe('warning');
    });

    it('should get repository info for ANOTS path', () => {
      const anotsPath = join(anotsRepoPath, 'src', 'app.ts');
      const repoInfo = manager.getRepositoryInfo(anotsPath);

      expect(repoInfo).not.toBeNull();
      expect(repoInfo?.type).toBe('anots');
      expect(repoInfo?.name).toBe('ANOTS');
      expect(repoInfo?.allowedOperations).toContain('write');
    });

    it('should get repository info for Prometheus path', () => {
      const prometheusPath = join(prometheusRepoPath, 'src', 'index.ts');
      const repoInfo = manager.getRepositoryInfo(prometheusPath);

      expect(repoInfo).not.toBeNull();
      expect(repoInfo?.type).toBe('prometheus');
      expect(repoInfo?.name).toBe('Prometheus');
      expect(repoInfo?.allowedOperations).toContain('read');
      expect(repoInfo?.allowedOperations).not.toContain('write');
    });

    it('should return null for unknown paths', () => {
      const unknownPath = '/unknown/path/file.ts';
      const repoInfo = manager.getRepositoryInfo(unknownPath);

      expect(repoInfo).toBeNull();
    });

    it('should handle path normalization', () => {
      // Test with different path separators
      const windowsPath = anotsRepoPath.replace(/\//g, '\\') + '\\src\\file.ts';
      const unixPath = anotsRepoPath + '/src/file.ts';

      const violations1 = manager.verifyRepositorySeparation(windowsPath);
      const violations2 = manager.verifyRepositorySeparation(unixPath);

      expect(violations1.length).toBe(0);
      expect(violations2.length).toBe(0);
    });
  });

  describe('Operation Validation', () => {
    it('should allow write operations on ANOTS repo', () => {
      const anotsPath = join(anotsRepoPath, 'src', 'file.ts');
      const violations = manager.validateOperation(anotsPath, 'write');

      expect(violations.length).toBe(0);
    });

    it('should allow read operations on Prometheus repo', () => {
      const prometheusPath = join(prometheusRepoPath, 'src', 'file.ts');
      const violations = manager.validateOperation(prometheusPath, 'read');

      expect(violations.length).toBe(0);
    });

    it('should reject write operations on Prometheus repo', () => {
      const prometheusPath = join(prometheusRepoPath, 'src', 'file.ts');
      const violations = manager.validateOperation(prometheusPath, 'write');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('repository_separation');
    });

    it('should reject operations on unknown paths', () => {
      const unknownPath = '/unknown/path/file.ts';
      const violations = manager.validateOperation(unknownPath, 'write');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].message).toContain('not in a known repository');
    });

    it('should validate multiple operation types', () => {
      const anotsPath = join(anotsRepoPath, 'src', 'file.ts');
      const operations = ['read', 'write', 'create', 'delete', 'branch', 'commit', 'pr'];

      for (const op of operations) {
        const violations = manager.validateOperation(anotsPath, op);
        expect(violations.length).toBe(0);
      }
    });
  });

  describe('Pattern Categories', () => {
    it('should have patterns in all categories', () => {
      const categories: AnotsPattern['category'][] = [
        'architecture',
        'naming',
        'testing',
        'deployment',
        'api',
        'ui',
      ];

      for (const category of categories) {
        const patterns = manager.getPatternsByCategory(category);
        expect(patterns.length).toBeGreaterThan(0);
      }
    });

    it('should filter patterns correctly by category', () => {
      const testingPatterns = manager.getPatternsByCategory('testing');
      const apiPatterns = manager.getPatternsByCategory('api');

      expect(testingPatterns.every(p => p.category === 'testing')).toBe(true);
      expect(apiPatterns.every(p => p.category === 'api')).toBe(true);
      
      // Ensure they're different sets
      const testingIds = new Set(testingPatterns.map(p => p.id));
      const apiIds = new Set(apiPatterns.map(p => p.id));
      const intersection = [...testingIds].filter(id => apiIds.has(id));
      expect(intersection.length).toBe(0);
    });
  });
});
