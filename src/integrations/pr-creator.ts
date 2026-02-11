/**
 * Pull Request Creator
 * 
 * Creates pull requests via Git provider APIs:
 * - GitHub API
 * - GitLab API
 * - Bitbucket API
 */

import { GitProvider } from './repository-connector';
import { PullRequestInfo } from './repository-workflow';

export interface PRCreatorConfig {
  provider: GitProvider;
  repoOwner: string;
  repoName: string;
  token: string;
  apiUrl?: string; // For self-hosted instances
}

export interface CreatedPR {
  id: number | string;
  number?: number; // GitHub/Bitbucket
  iid?: number; // GitLab
  url: string;
  webUrl: string;
}

export class PRCreator {
  private config: PRCreatorConfig;

  constructor(config: PRCreatorConfig) {
    this.config = {
      apiUrl: this.getDefaultApiUrl(config.provider),
      ...config,
    };
  }

  /**
   * Get default API URL for provider
   */
  private getDefaultApiUrl(provider: GitProvider): string {
    switch (provider) {
      case 'github':
        return 'https://api.github.com';
      case 'gitlab':
        return 'https://gitlab.com/api/v4';
      case 'bitbucket':
        return 'https://api.bitbucket.org/2.0';
      default:
        return '';
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(prInfo: PullRequestInfo): Promise<CreatedPR> {
    switch (this.config.provider) {
      case 'github':
        return await this.createGitHubPR(prInfo);
      case 'gitlab':
        return await this.createGitLabMR(prInfo);
      case 'bitbucket':
        return await this.createBitbucketPR(prInfo);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Create GitHub Pull Request
   */
  private async createGitHubPR(prInfo: PullRequestInfo): Promise<CreatedPR> {
    const url = `${this.config.apiUrl}/repos/${this.config.repoOwner}/${this.config.repoName}/pulls`;

    const body = {
      title: prInfo.title,
      body: prInfo.description,
      head: prInfo.branch,
      base: prInfo.baseBranch,
      draft: !prInfo.testsPassed, // Create as draft if tests failed
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        number: data.number,
        url: data.url,
        webUrl: data.html_url,
      };
    } catch (error) {
      throw new Error(`Failed to create GitHub PR: ${error}`);
    }
  }

  /**
   * Create GitLab Merge Request
   */
  private async createGitLabMR(prInfo: PullRequestInfo): Promise<CreatedPR> {
    // Get project ID first
    const projectId = await this.getGitLabProjectId();
    
    const url = `${this.config.apiUrl}/projects/${projectId}/merge_requests`;

    const body = {
      source_branch: prInfo.branch,
      target_branch: prInfo.baseBranch,
      title: prInfo.title,
      description: prInfo.description,
      remove_source_branch: true,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitLab API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        iid: data.iid,
        url: data.web_url,
        webUrl: data.web_url,
      };
    } catch (error) {
      throw new Error(`Failed to create GitLab MR: ${error}`);
    }
  }

  /**
   * Get GitLab project ID
   */
  private async getGitLabProjectId(): Promise<string> {
    const encodedPath = encodeURIComponent(`${this.config.repoOwner}/${this.config.repoName}`);
    const url = `${this.config.apiUrl}/projects/${encodedPath}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get project: ${response.status}`);
      }

      const data = await response.json();
      return data.id.toString();
    } catch (error) {
      throw new Error(`Failed to get GitLab project ID: ${error}`);
    }
  }

  /**
   * Create Bitbucket Pull Request
   */
  private async createBitbucketPR(prInfo: PullRequestInfo): Promise<CreatedPR> {
    const url = `${this.config.apiUrl}/repositories/${this.config.repoOwner}/${this.config.repoName}/pullrequests`;

    const body = {
      title: prInfo.title,
      description: prInfo.description,
      source: {
        branch: {
          name: prInfo.branch,
        },
      },
      destination: {
        branch: {
          name: prInfo.baseBranch,
        },
      },
      close_source_branch: true,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bitbucket API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        number: data.id,
        url: data.links.self.href,
        webUrl: data.links.html.href,
      };
    } catch (error) {
      throw new Error(`Failed to create Bitbucket PR: ${error}`);
    }
  }

  /**
   * Add comment to pull request
   */
  async addComment(prNumber: number | string, comment: string): Promise<void> {
    switch (this.config.provider) {
      case 'github':
        await this.addGitHubComment(prNumber as number, comment);
        break;
      case 'gitlab':
        await this.addGitLabComment(prNumber as number, comment);
        break;
      case 'bitbucket':
        await this.addBitbucketComment(prNumber as number, comment);
        break;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Add GitHub comment
   */
  private async addGitHubComment(prNumber: number, comment: string): Promise<void> {
    const url = `${this.config.apiUrl}/repos/${this.config.repoOwner}/${this.config.repoName}/issues/${prNumber}/comments`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: comment }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add GitHub comment: ${response.status}`);
    }
  }

  /**
   * Add GitLab comment
   */
  private async addGitLabComment(mrIid: number, comment: string): Promise<void> {
    const projectId = await this.getGitLabProjectId();
    const url = `${this.config.apiUrl}/projects/${projectId}/merge_requests/${mrIid}/notes`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: comment }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add GitLab comment: ${response.status}`);
    }
  }

  /**
   * Add Bitbucket comment
   */
  private async addBitbucketComment(prId: number, comment: string): Promise<void> {
    const url = `${this.config.apiUrl}/repositories/${this.config.repoOwner}/${this.config.repoName}/pullrequests/${prId}/comments`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: { raw: comment } }),
    });

    if (!response.ok) {
      throw new Error(`Failed to add Bitbucket comment: ${response.status}`);
    }
  }

  /**
   * Request reviewers for pull request
   */
  async requestReviewers(prNumber: number | string, reviewers: string[]): Promise<void> {
    switch (this.config.provider) {
      case 'github':
        await this.requestGitHubReviewers(prNumber as number, reviewers);
        break;
      case 'gitlab':
        await this.requestGitLabReviewers(prNumber as number, reviewers);
        break;
      case 'bitbucket':
        await this.requestBitbucketReviewers(prNumber as number, reviewers);
        break;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Request GitHub reviewers
   */
  private async requestGitHubReviewers(prNumber: number, reviewers: string[]): Promise<void> {
    const url = `${this.config.apiUrl}/repos/${this.config.repoOwner}/${this.config.repoName}/pulls/${prNumber}/requested_reviewers`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reviewers }),
    });

    if (!response.ok) {
      throw new Error(`Failed to request GitHub reviewers: ${response.status}`);
    }
  }

  /**
   * Request GitLab reviewers
   */
  private async requestGitLabReviewers(mrIid: number, reviewers: string[]): Promise<void> {
    const projectId = await this.getGitLabProjectId();
    
    // Get user IDs for reviewers
    const reviewerIds: number[] = [];
    for (const username of reviewers) {
      const userId = await this.getGitLabUserId(username);
      if (userId) {
        reviewerIds.push(userId);
      }
    }

    const url = `${this.config.apiUrl}/projects/${projectId}/merge_requests/${mrIid}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reviewer_ids: reviewerIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to request GitLab reviewers: ${response.status}`);
    }
  }

  /**
   * Get GitLab user ID by username
   */
  private async getGitLabUserId(username: string): Promise<number | null> {
    const url = `${this.config.apiUrl}/users?username=${username}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        },
      });

      if (!response.ok) return null;

      const users = await response.json();
      return users.length > 0 ? users[0].id : null;
    } catch {
      return null;
    }
  }

  /**
   * Request Bitbucket reviewers
   */
  private async requestBitbucketReviewers(prId: number, reviewers: string[]): Promise<void> {
    const url = `${this.config.apiUrl}/repositories/${this.config.repoOwner}/${this.config.repoName}/pullrequests/${prId}`;

    const reviewerObjects = reviewers.map(username => ({
      username,
    }));

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reviewers: reviewerObjects }),
    });

    if (!response.ok) {
      throw new Error(`Failed to request Bitbucket reviewers: ${response.status}`);
    }
  }
}
