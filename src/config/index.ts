/**
 * Configuration management for Prometheus
 */

import { PrometheusConfig } from '../types/index.js';

/**
 * Load configuration from environment variables
 */
export function loadConfig(): PrometheusConfig {
  return {
    server: {
      port: parseInt(process.env['PORT'] || '3000', 10),
      host: process.env['HOST'] || 'localhost',
    },
    database: {
      path: process.env['DATABASE_PATH'] || './data/prometheus.db',
    },
    llm: {
      providers: {
        anthropic: {
          apiKey: process.env['ANTHROPIC_API_KEY'] || '',
          models: ['claude-sonnet-4-5', 'claude-opus-4-6'],
          contextWindow: 200000,
        },
        openai: {
          apiKey: process.env['OPENAI_API_KEY'] || '',
          models: ['gpt-4-turbo', 'o1'],
          contextWindow: 128000,
        },
      },
      defaultProvider: 'anthropic',
    },
    integrations: {
      github: process.env['GITHUB_TOKEN']
        ? {
            token: process.env['GITHUB_TOKEN'],
            owner: process.env['GITHUB_REPO_OWNER'] || '',
            repo: process.env['GITHUB_REPO_NAME'] || '',
          }
        : undefined,
      supabase: process.env['SUPABASE_URL']
        ? {
            url: process.env['SUPABASE_URL'],
            key: process.env['SUPABASE_KEY'] || '',
          }
        : undefined,
      anots: {
        repoPath: process.env['ANOTS_REPO_PATH'] || '../anots',
        prometheusRepoPath: process.env['PROMETHEUS_REPO_PATH'] || './',
      },
    },
    monitoring: {
      enabled: process.env['ENABLE_METRICS'] === 'true',
      port: parseInt(process.env['METRICS_PORT'] || '9090', 10),
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: PrometheusConfig): void {
  if (!config.server.port || config.server.port < 1 || config.server.port > 65535) {
    throw new Error('Invalid server port');
  }

  if (!config.database.path) {
    throw new Error('Database path is required');
  }

  // Validate at least one LLM provider is configured
  const hasProvider = Object.values(config.llm.providers).some((p) => p.apiKey);
  if (!hasProvider) {
    console.warn('Warning: No LLM providers configured. Some features will not work.');
  }
}
