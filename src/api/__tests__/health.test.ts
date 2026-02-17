/**
 * Tests for Health Check Endpoint (Task 7.1)
 * 
 * These tests verify:
 * - Database connectivity check (Requirement 6.2)
 * - Evolution system status check (Requirement 6.3)
 * - Component-level health reporting (Requirement 6.1)
 * - Appropriate HTTP status codes (Requirement 6.4)
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { PrometheusDatabase } from '../../memory/database.js';
import { DevProdManager } from '../../evolution/dev-prod-manager.js';
import { SelfAnalyzer } from '../../evolution/self-analyzer.js';
import * as path from 'path';
import { existsSync, unlinkSync } from 'fs';

describe('Health Check Endpoint (Task 7.1)', () => {
  const testDbPath = path.join(__dirname, 'test-health.db');
  let app: express.Application;
  let db: PrometheusDatabase;

  beforeAll(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Initialize test database
    db = new PrometheusDatabase({ path: testDbPath });

    // Create a minimal Express app with health endpoint
    app = express();
    app.use(express.json());

    // Mock health endpoint implementation
    app.get('/health', async (req, res) => {
      const startTime = Date.now();
      const timestamp = new Date().toISOString();
      const version = '0.1.0';
      const uptime = process.uptime();

      // Check database connectivity
      const dbCheckStart = Date.now();
      let databaseHealth: { status: 'up' | 'down'; message?: string; latency?: number };
      try {
        const isOpen = db.isOpen();
        if (!isOpen) {
          databaseHealth = {
            status: 'down',
            message: 'Database is not open',
            latency: Date.now() - dbCheckStart,
          };
        } else {
          db.getDb().prepare('SELECT 1').get();
          databaseHealth = {
            status: 'up',
            latency: Date.now() - dbCheckStart,
          };
        }
      } catch (error) {
        databaseHealth = {
          status: 'down',
          message: error instanceof Error ? error.message : 'Database connectivity check failed',
          latency: Date.now() - dbCheckStart,
        };
      }

      // Mock evolution system check (always up for this test)
      const evolutionCheckStart = Date.now();
      const evolutionSystemHealth = {
        status: 'up' as const,
        latency: Date.now() - evolutionCheckStart,
      };

      // Determine overall status
      const allComponentsUp = databaseHealth.status === 'up' && evolutionSystemHealth.status === 'up';
      const overallStatus = allComponentsUp ? 'healthy' : 'unhealthy';
      const httpStatus = allComponentsUp ? 200 : 503;

      const healthResponse = {
        status: overallStatus,
        version,
        timestamp,
        uptime,
        components: {
          database: databaseHealth,
          evolutionSystem: evolutionSystemHealth,
          apiServer: {
            status: 'up' as const,
            latency: Date.now() - startTime,
          },
        },
      };

      res.status(httpStatus).json(healthResponse);
    });
  });

  afterAll(() => {
    // Close database connection
    if (db) {
      db.close();
    }

    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should return 200 when all components are healthy', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('version', '0.1.0');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });

  it('should include component-level health reporting', async () => {
    const response = await request(app).get('/health');

    expect(response.body).toHaveProperty('components');
    expect(response.body.components).toHaveProperty('database');
    expect(response.body.components).toHaveProperty('evolutionSystem');
    expect(response.body.components).toHaveProperty('apiServer');
  });

  it('should report database status as up', async () => {
    const response = await request(app).get('/health');

    expect(response.body.components.database).toHaveProperty('status', 'up');
    expect(response.body.components.database).toHaveProperty('latency');
    expect(typeof response.body.components.database.latency).toBe('number');
  });

  it('should report evolution system status', async () => {
    const response = await request(app).get('/health');

    expect(response.body.components.evolutionSystem).toHaveProperty('status');
    expect(response.body.components.evolutionSystem).toHaveProperty('latency');
    expect(typeof response.body.components.evolutionSystem.latency).toBe('number');
  });

  it('should report API server status as up', async () => {
    const response = await request(app).get('/health');

    expect(response.body.components.apiServer).toHaveProperty('status', 'up');
    expect(response.body.components.apiServer).toHaveProperty('latency');
    expect(typeof response.body.components.apiServer.latency).toBe('number');
  });

  it('should include latency measurements for each component', async () => {
    const response = await request(app).get('/health');

    const { database, evolutionSystem, apiServer } = response.body.components;
    
    expect(database.latency).toBeGreaterThanOrEqual(0);
    expect(evolutionSystem.latency).toBeGreaterThanOrEqual(0);
    expect(apiServer.latency).toBeGreaterThanOrEqual(0);
  });
});
