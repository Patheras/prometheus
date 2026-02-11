/**
 * Repository Profiles System
 * 
 * Configurable profiles for repository-specific settings:
 * - Branching strategies
 * - Test commands
 * - Review requirements
 * - Quality gates
 * - Deployment workflows
 */

import { MemoryEngine } from '../memory/engine';

export type BranchingStrategy = 
  | 'git-flow'           // main, develop, feature/*, release/*, hotfix/*
  | 'github-flow'        // main, feature/*
  | 'trunk-based'        // main, short-lived branches
  | 'gitlab-flow'        // main, environment branches
  | 'custom';            // User-defined

export interface BranchingConfig {
  strategy: BranchingStrategy;
  mainBranch: string;
  developBranch?: string;
  featurePrefix: string;
  releasePrefix?: string;
  hotfixPrefix?: string;
  maxBranchAge?: number; // days
  requireLinearHistory?: boolean;
}

export interface TestConfig {
  commands: TestCommand[];
  requireAllPass: boolean;
  timeout?: number; // milliseconds
  parallel?: boolean;
  coverage?: CoverageConfig;
}

export interface TestCommand {
  name: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  required: boolean;
  failFast?: boolean;
}

export interface CoverageConfig {
  enabled: boolean;
  threshold?: number; // percentage
  reportPath?: string;
}

export interface ReviewConfig {
  required: boolean;
  minApprovals: number;
  requireCodeOwners?: boolean;
  requireAllResolved?: boolean;
  allowSelfReview?: boolean;
  reviewers?: string[];
  autoAssign?: boolean;
}

export interface QualityGate {
  name: string;
  type: 'lint' | 'format' | 'type-check' | 'security' | 'custom';
  command: string;
  required: boolean;
  blocking?: boolean;
}

export interface DeploymentConfig {
  environments: DeploymentEnvironment[];
  requireApproval?: boolean;
  autoMerge?: boolean;
  rollbackStrategy?: 'automatic' | 'manual';
}

export interface DeploymentEnvironment {
  name: string;
  branch?: string;
  url?: string;
  requireTests?: boolean;
  requireReview?: boolean;
}

export interface RepositoryProfile {
  id: string;
  repoId: string;
  name: string;
  description?: string;
  branching: BranchingConfig;
  testing: TestConfig;
  review: ReviewConfig;
  qualityGates: QualityGate[];
  deployment?: DeploymentConfig;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileTemplate {
  name: string;
  description: string;
  profile: Omit<RepositoryProfile, 'id' | 'repoId' | 'createdAt' | 'updatedAt'>;
}

/**
 * Repository Profile Manager
 */
export class RepositoryProfileManager {
  private memoryEngine: MemoryEngine;
  private profiles: Map<string, RepositoryProfile> = new Map();

  constructor(memoryEngine: MemoryEngine) {
    this.memoryEngine = memoryEngine;
  }

  /**
   * Create a new repository profile
   */
  async createProfile(
    repoId: string,
    config: Partial<RepositoryProfile>
  ): Promise<RepositoryProfile> {
    const profile: RepositoryProfile = {
      id: config.id || `${repoId}-profile-${Date.now()}`,
      repoId,
      name: config.name || 'Default Profile',
      description: config.description,
      branching: config.branching || this.getDefaultBranchingConfig(),
      testing: config.testing || this.getDefaultTestingConfig(),
      review: config.review || this.getDefaultReviewConfig(),
      qualityGates: config.qualityGates || [],
      deployment: config.deployment,
      metadata: config.metadata || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.profiles.set(profile.id, profile);
    await this.saveProfile(profile);

    console.log(`[${repoId}] Created profile: ${profile.name}`);
    return profile;
  }

  /**
   * Get profile for repository
   */
  async getProfile(repoId: string): Promise<RepositoryProfile | null> {
    // Check cache first
    for (const profile of this.profiles.values()) {
      if (profile.repoId === repoId) {
        return profile;
      }
    }

    // Load from memory engine
    await this.loadProfiles(repoId);

    // Check again
    for (const profile of this.profiles.values()) {
      if (profile.repoId === repoId) {
        return profile;
      }
    }

    return null;
  }

  /**
   * Update profile
   */
  async updateProfile(
    profileId: string,
    updates: Partial<RepositoryProfile>
  ): Promise<RepositoryProfile> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const updated: RepositoryProfile = {
      ...profile,
      ...updates,
      id: profile.id,
      repoId: profile.repoId,
      createdAt: profile.createdAt,
      updatedAt: Date.now(),
    };

    this.profiles.set(profileId, updated);
    await this.saveProfile(updated);

    console.log(`[${profile.repoId}] Updated profile: ${profile.name}`);
    return updated;
  }

  /**
   * Delete profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    this.profiles.delete(profileId);
    // Note: In real implementation, delete from memory engine
    console.log(`[${profile.repoId}] Deleted profile: ${profile.name}`);
  }

  /**
   * Create profile from template
   */
  async createFromTemplate(
    repoId: string,
    templateName: string,
    overrides?: Partial<RepositoryProfile>
  ): Promise<RepositoryProfile> {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    return this.createProfile(repoId, {
      ...template.profile,
      ...overrides,
    });
  }

  /**
   * Get available templates
   */
  getTemplates(): ProfileTemplate[] {
    return [
      this.getGitFlowTemplate(),
      this.getGitHubFlowTemplate(),
      this.getTrunkBasedTemplate(),
      this.getEnterpriseTemplate(),
      this.getOpenSourceTemplate(),
    ];
  }

  /**
   * Get specific template
   */
  getTemplate(name: string): ProfileTemplate | null {
    const templates = this.getTemplates();
    return templates.find(t => t.name === name) || null;
  }

  /**
   * Validate profile configuration
   */
  validateProfile(profile: RepositoryProfile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate branching config
    if (!profile.branching.mainBranch) {
      errors.push('Main branch is required');
    }

    if (profile.branching.strategy === 'git-flow' && !profile.branching.developBranch) {
      errors.push('Develop branch is required for git-flow strategy');
    }

    // Validate testing config
    if (profile.testing.commands.length === 0) {
      errors.push('At least one test command is required');
    }

    for (const cmd of profile.testing.commands) {
      if (!cmd.name || !cmd.command) {
        errors.push(`Invalid test command: ${JSON.stringify(cmd)}`);
      }
    }

    // Validate review config
    if (profile.review.required && profile.review.minApprovals < 1) {
      errors.push('Minimum approvals must be at least 1 when review is required');
    }

    // Validate quality gates
    for (const gate of profile.qualityGates) {
      if (!gate.name || !gate.command) {
        errors.push(`Invalid quality gate: ${JSON.stringify(gate)}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default branching config
   */
  private getDefaultBranchingConfig(): BranchingConfig {
    return {
      strategy: 'github-flow',
      mainBranch: 'main',
      featurePrefix: 'feature/',
      requireLinearHistory: false,
    };
  }

  /**
   * Get default testing config
   */
  private getDefaultTestingConfig(): TestConfig {
    return {
      commands: [
        {
          name: 'unit-tests',
          command: 'npm test',
          required: true,
        },
      ],
      requireAllPass: true,
      timeout: 300000, // 5 minutes
    };
  }

  /**
   * Get default review config
   */
  private getDefaultReviewConfig(): ReviewConfig {
    return {
      required: true,
      minApprovals: 1,
      requireAllResolved: true,
      allowSelfReview: false,
    };
  }

  /**
   * Git Flow template
   */
  private getGitFlowTemplate(): ProfileTemplate {
    return {
      name: 'git-flow',
      description: 'Git Flow branching strategy with develop and release branches',
      profile: {
        name: 'Git Flow',
        branching: {
          strategy: 'git-flow',
          mainBranch: 'main',
          developBranch: 'develop',
          featurePrefix: 'feature/',
          releasePrefix: 'release/',
          hotfixPrefix: 'hotfix/',
          requireLinearHistory: false,
        },
        testing: {
          commands: [
            { name: 'lint', command: 'npm run lint', required: true },
            { name: 'test', command: 'npm test', required: true },
            { name: 'build', command: 'npm run build', required: true },
          ],
          requireAllPass: true,
          timeout: 600000,
        },
        review: {
          required: true,
          minApprovals: 2,
          requireCodeOwners: true,
          requireAllResolved: true,
          allowSelfReview: false,
        },
        qualityGates: [
          { name: 'lint', type: 'lint', command: 'npm run lint', required: true, blocking: true },
          { name: 'type-check', type: 'type-check', command: 'npm run type-check', required: true, blocking: true },
        ],
      },
    };
  }

  /**
   * GitHub Flow template
   */
  private getGitHubFlowTemplate(): ProfileTemplate {
    return {
      name: 'github-flow',
      description: 'Simple GitHub Flow with feature branches',
      profile: {
        name: 'GitHub Flow',
        branching: {
          strategy: 'github-flow',
          mainBranch: 'main',
          featurePrefix: 'feature/',
          requireLinearHistory: true,
        },
        testing: {
          commands: [
            { name: 'test', command: 'npm test', required: true },
          ],
          requireAllPass: true,
          timeout: 300000,
        },
        review: {
          required: true,
          minApprovals: 1,
          requireAllResolved: true,
          allowSelfReview: false,
        },
        qualityGates: [
          { name: 'lint', type: 'lint', command: 'npm run lint', required: true, blocking: true },
        ],
      },
    };
  }

  /**
   * Trunk-Based Development template
   */
  private getTrunkBasedTemplate(): ProfileTemplate {
    return {
      name: 'trunk-based',
      description: 'Trunk-based development with short-lived branches',
      profile: {
        name: 'Trunk-Based',
        branching: {
          strategy: 'trunk-based',
          mainBranch: 'main',
          featurePrefix: '',
          maxBranchAge: 2, // 2 days max
          requireLinearHistory: true,
        },
        testing: {
          commands: [
            { name: 'test', command: 'npm test', required: true, failFast: true },
          ],
          requireAllPass: true,
          timeout: 180000,
          parallel: true,
        },
        review: {
          required: true,
          minApprovals: 1,
          requireAllResolved: false,
          allowSelfReview: false,
          autoAssign: true,
        },
        qualityGates: [
          { name: 'lint', type: 'lint', command: 'npm run lint', required: true, blocking: true },
        ],
      },
    };
  }

  /**
   * Enterprise template
   */
  private getEnterpriseTemplate(): ProfileTemplate {
    return {
      name: 'enterprise',
      description: 'Enterprise-grade with strict quality gates and approvals',
      profile: {
        name: 'Enterprise',
        branching: {
          strategy: 'git-flow',
          mainBranch: 'main',
          developBranch: 'develop',
          featurePrefix: 'feature/',
          releasePrefix: 'release/',
          hotfixPrefix: 'hotfix/',
          requireLinearHistory: true,
        },
        testing: {
          commands: [
            { name: 'lint', command: 'npm run lint', required: true },
            { name: 'type-check', command: 'npm run type-check', required: true },
            { name: 'unit-tests', command: 'npm run test:unit', required: true },
            { name: 'integration-tests', command: 'npm run test:integration', required: true },
            { name: 'e2e-tests', command: 'npm run test:e2e', required: false },
          ],
          requireAllPass: true,
          timeout: 1800000, // 30 minutes
          coverage: {
            enabled: true,
            threshold: 80,
          },
        },
        review: {
          required: true,
          minApprovals: 3,
          requireCodeOwners: true,
          requireAllResolved: true,
          allowSelfReview: false,
        },
        qualityGates: [
          { name: 'lint', type: 'lint', command: 'npm run lint', required: true, blocking: true },
          { name: 'type-check', type: 'type-check', command: 'tsc --noEmit', required: true, blocking: true },
          { name: 'security', type: 'security', command: 'npm audit', required: true, blocking: true },
        ],
        deployment: {
          environments: [
            { name: 'staging', branch: 'develop', requireTests: true, requireReview: true },
            { name: 'production', branch: 'main', requireTests: true, requireReview: true },
          ],
          requireApproval: true,
          rollbackStrategy: 'automatic',
        },
      },
    };
  }

  /**
   * Open Source template
   */
  private getOpenSourceTemplate(): ProfileTemplate {
    return {
      name: 'open-source',
      description: 'Open source project with community contributions',
      profile: {
        name: 'Open Source',
        branching: {
          strategy: 'github-flow',
          mainBranch: 'main',
          featurePrefix: '',
          requireLinearHistory: false,
        },
        testing: {
          commands: [
            { name: 'lint', command: 'npm run lint', required: true },
            { name: 'test', command: 'npm test', required: true },
          ],
          requireAllPass: true,
          timeout: 600000,
        },
        review: {
          required: true,
          minApprovals: 1,
          requireCodeOwners: false,
          requireAllResolved: true,
          allowSelfReview: false,
        },
        qualityGates: [
          { name: 'lint', type: 'lint', command: 'npm run lint', required: true, blocking: true },
        ],
      },
    };
  }

  /**
   * Save profile to memory engine
   */
  private async saveProfile(profile: RepositoryProfile): Promise<void> {
    try {
      // Store as a pattern for now (in real implementation, use dedicated storage)
      await this.memoryEngine.storePattern({
        name: `repo-profile-${profile.id}`,
        category: 'repository-profile',
        problem: `Profile for ${profile.repoId}`,
        solution: JSON.stringify(profile),
        example_code: '',
        applicability: `Repository: ${profile.repoId}`,
        metadata: {
          profileId: profile.id,
          repoId: profile.repoId,
          profileData: profile,
        },
      });
    } catch (error) {
      console.error(`Failed to save profile ${profile.id}:`, error);
    }
  }

  /**
   * Load profiles from memory engine
   */
  private async loadProfiles(repoId: string): Promise<void> {
    try {
      const results = await this.memoryEngine.searchPatterns(`repo:${repoId}`);
      
      for (const result of results) {
        if (result.category === 'repository-profile' && result.metadata?.profileData) {
          const profile = result.metadata.profileData as RepositoryProfile;
          if (profile.repoId === repoId) {
            this.profiles.set(profile.id, profile);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not load profiles for ${repoId}:`, error);
    }
  }
}
