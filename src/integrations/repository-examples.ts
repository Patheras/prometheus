/**
 * Repository Connector Usage Examples
 * 
 * This file demonstrates how to use the generic RepositoryConnector
 * and RepositoryManager for different Git providers and scenarios.
 */

import { RepositoryManager } from './repository-manager';
import { RepositoryConfig, RepositoryProfile } from './repository-connector';
import { MemoryEngine } from '../memory/engine';

/**
 * Example 1: Managing ANOTS repository
 */
export function createAnotsRepositoryConfig(): RepositoryConfig {
  return {
    id: 'anots',
    name: 'ANOTS Marketing Automation',
    provider: 'github',
    repoUrl: 'https://github.com/your-org/anots.git',
    localPath: './repos/anots',
    branch: 'main',
    credentials: {
      token: process.env['GITHUB_TOKEN'],
    },
    profile: {
      branchingStrategy: 'github-flow',
      mainBranch: 'main',
      featureBranchPrefix: 'feature/',
      testCommand: 'npm test',
      buildCommand: 'npm run build',
      lintCommand: 'npm run lint',
      reviewRequired: true,
      autoMerge: false,
    },
  };
}

/**
 * Example 2: Managing a GitLab repository
 */
export function createGitLabRepositoryConfig(): RepositoryConfig {
  return {
    id: 'my-gitlab-project',
    name: 'My GitLab Project',
    provider: 'gitlab',
    repoUrl: 'https://gitlab.com/your-org/project.git',
    localPath: './repos/gitlab-project',
    branch: 'develop',
    credentials: {
      token: process.env['GITLAB_TOKEN'],
    },
    profile: {
      branchingStrategy: 'git-flow',
      mainBranch: 'main',
      developBranch: 'develop',
      featureBranchPrefix: 'feature/',
      testCommand: 'yarn test',
      buildCommand: 'yarn build',
      reviewRequired: true,
      autoMerge: false,
    },
  };
}

/**
 * Example 3: Managing a Bitbucket repository
 */
export function createBitbucketRepositoryConfig(): RepositoryConfig {
  return {
    id: 'bitbucket-app',
    name: 'Bitbucket Application',
    provider: 'bitbucket',
    repoUrl: 'https://bitbucket.org/your-org/app.git',
    localPath: './repos/bitbucket-app',
    credentials: {
      token: process.env['BITBUCKET_TOKEN'],
    },
    profile: {
      branchingStrategy: 'trunk-based',
      mainBranch: 'trunk',
      featureBranchPrefix: 'task/',
      testCommand: 'pnpm test',
      reviewRequired: false,
      autoMerge: true,
    },
  };
}

/**
 * Example 4: Initialize Repository Manager with multiple repositories
 */
export async function initializeMultiRepoManager(memoryEngine: MemoryEngine): Promise<RepositoryManager> {
  const manager = new RepositoryManager(
    memoryEngine,
    {
      prometheusRepoPath: './prometheus', // Prometheus own repo (protected)
    }
  );

  // Initialize all repositories
  await manager.initializeAll();

  // Set up global change listener
  manager.onAnyRepositoryChange((event) => {
    console.log(`Change detected in ${event.repoId}: ${event.type} - ${event.path}`);
  });

  return manager;
}

/**
 * Example 5: Working with a specific repository
 */
export async function workWithRepository(manager: RepositoryManager) {
  // Set context to ANOTS repository
  // manager.setContext('anots'); // Method not available

  // Get the repository connector
  const anotsRepo = manager.getRepository('anots');

  // Get repository status
  const status = await anotsRepo.getStatus();
  console.log('ANOTS Status:', status);

  // Create a feature branch
  await anotsRepo.createBranch('feature/new-dashboard');

  // Make changes (in your code)
  // ... modify files ...

  // Commit changes
  await anotsRepo.commit('Add new dashboard component');

  // Push to remote
  await anotsRepo.push();

  // Clear context when done
  // manager.clearContext(); // Method not available
}

/**
 * Example 6: Adding a new repository dynamically
 */
export async function addNewRepository(manager: RepositoryManager) {
  const newRepoConfig: RepositoryConfig = {
    id: 'new-project',
    name: 'New Project',
    provider: 'github',
    repoUrl: 'https://github.com/your-org/new-project.git',
    localPath: './repos/new-project',
    credentials: {
      token: process.env['GITHUB_TOKEN'],
    },
    profile: {
      branchingStrategy: 'github-flow',
      mainBranch: 'main',
      featureBranchPrefix: 'feat/',
      testCommand: 'npm test',
      reviewRequired: true,
      autoMerge: false,
    },
  };

  await manager.addRepository(newRepoConfig);
  console.log('New repository added successfully');
}

/**
 * Example 7: Verifying repository separation
 */
export function verifyRepositorySeparation(manager: RepositoryManager) {
  // This should return true (ANOTS repo)
  const isValidAnots = manager.verifyRepositorySeparation(
    './repos/anots/src/components/Button.tsx',
    'anots'
  );
  console.log('Valid ANOTS path:', isValidAnots);

  // This should return false (Prometheus repo - protected)
  const isValidPrometheus = manager.verifyRepositorySeparation(
    './prometheus/src/memory/engine.ts'
  );
  console.log('Valid Prometheus path (should be false):', isValidPrometheus);

  // This should return false (wrong repository)
  const isValidWrongRepo = manager.verifyRepositorySeparation(
    './repos/gitlab-project/src/index.ts',
    'anots' // Expecting ANOTS but path is in GitLab project
  );
  console.log('Valid wrong repo (should be false):', isValidWrongRepo);
}

/**
 * Example 8: Getting repository from file path
 */
export function getRepositoryFromPath(manager: RepositoryManager, filePath: string) {
  const repoId = manager.getRepositoryIdFromPath(filePath);
  
  if (repoId) {
    console.log(`File ${filePath} belongs to repository: ${repoId}`);
    const repo = manager.getRepository(repoId);
    console.log('Repository config:', repo.getConfig());
  } else {
    console.log(`File ${filePath} does not belong to any managed repository`);
  }
}

/**
 * Example 9: Updating repository profile
 */
export function updateRepositoryProfile(manager: RepositoryManager) {
  const updatedProfile: Partial<RepositoryProfile> = {
    autoMerge: true,
    testCommand: 'npm run test:ci',
  };

  manager.updateRepositoryProfile('anots', updatedProfile);
  console.log('Repository profile updated');
}

/**
 * Example 10: Getting all repository statuses
 */
export async function getAllRepositoryStatuses(manager: RepositoryManager) {
  const statuses = await manager.getAllStatuses();
  
  console.log('All Repository Statuses:');
  for (const status of statuses) {
    console.log(`
      ID: ${status.id}
      Name: ${status.name}
      Provider: ${status.provider}
      Branch: ${status.currentBranch}
      Commit: ${status.commitHash.substring(0, 7)}
      Files: ${status.fileCount}
      Indexed: ${status.isIndexed}
    `);
  }
}
