/**
 * Tests for Dev Environment Isolation
 */

import {
  DevEnvironmentIsolation,
  createDevEnvironmentIsolation,
  EnvironmentConfig,
} from '../dev-environment-isolation';
import { DevProdManager } from '../dev-prod-manager';
import { MemoryEngine } from '../../memory/engine';

describe('DevEnvironmentIsolation', () => {
  let envIsolation: DevEnvironmentIsolation;
  let devProdManager: DevProdManager;
  let memoryEngine: MemoryEngine;
  let devConfig: EnvironmentConfig;
  let prodConfig: EnvironmentConfig;

  beforeEach(() => {
    // Create mock dev/prod manager
    devProdManager = {
      switchToDev: jest.fn().mockResolvedValue(undefined),
      switchToProd: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create mock memory engine
    memoryEngine = {} as any;

    // Create dev config
    devConfig = {
      name: 'dev',
      repoPath: '/path/to/dev',
      databasePath: '/data/dev/prometheus.db',
      storagePath: '/data/dev/storage',
      testCommand: 'npm test',
      buildCommand: 'npm run build',
      envVars: {
        NODE_ENV: 'development',
        DATABASE_URL: 'file:/data/dev/prometheus.db',
        STORAGE_PATH: '/data/dev/storage',
      },
      ports: {
        api: 3000,
        web: 3001,
        websocket: 3002,
      },
      resources: {
        maxMemoryMB: 2048,
        maxCpuPercent: 80,
        maxDiskMB: 10000,
      },
    };

    // Create prod config
    prodConfig = {
      name: 'prod',
      repoPath: '/path/to/prod',
      databasePath: '/data/prod/prometheus.db',
      storagePath: '/data/prod/storage',
      testCommand: 'npm test',
      buildCommand: 'npm run build',
      envVars: {
        NODE_ENV: 'production',
        DATABASE_URL: 'file:/data/prod/prometheus.db',
        STORAGE_PATH: '/data/prod/storage',
      },
      ports: {
        api: 4000,
        web: 4001,
        websocket: 4002,
      },
      resources: {
        maxMemoryMB: 4096,
        maxCpuPercent: 90,
        maxDiskMB: 50000,
      },
    };

    envIsolation = new DevEnvironmentIsolation(
      devProdManager,
      memoryEngine,
      devConfig,
      prodConfig
    );
  });

  describe('initialize', () => {
    it('should initialize successfully with isolated environments', async () => {
      await envIsolation.initialize();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});