/**
 * Startup Validator
 * 
 * Validates system readiness before starting services.
 * Checks environment configuration, database connectivity, port availability, and dependencies.
 * 
 * Requirements: 10.3, 10.6
 */

import { EnvValidator } from '../config/env-validator';
import { PrometheusDatabase } from '../memory/database';
import { createServer } from 'net';

export interface StartupChecks {
  environment: boolean;
  database: boolean;
  ports: boolean;
  dependencies: boolean;
}

export class StartupValidator {
  private envValidator: EnvValidator;

  constructor() {
    this.envValidator = new EnvValidator();
  }

  /**
   * Validate all startup requirements
   */
  async validateAll(): Promise<StartupChecks> {
    const checks: StartupChecks = {
      environment: false,
      database: false,
      ports: false,
      dependencies: false
    };

    // Check environment configuration
    const envResult = this.envValidator.validate();
    checks.environment = envResult.valid;

    // Check database connectivity
    checks.database = await this.checkDatabaseConnectivity();

    // Check port availability (backend: 4242, frontend: 3042)
    const backendPortAvailable = await this.checkPortAvailability(4242);
    // Frontend may already be running, so we only check backend port
    checks.ports = backendPortAvailable;

    // Check dependencies
    checks.dependencies = await this.checkDependencies();

    return checks;
  }

  /**
   * Check if a port is available
   */
  async checkPortAvailability(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();

      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          // Other errors also indicate port is not available
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port);
    });
  }

  /**
   * Check database connectivity
   */
  async checkDatabaseConnectivity(): Promise<boolean> {
    try {
      const dbPath = process.env.DATABASE_PATH || 'data/prometheus.db';
      
      // Try to open database connection
      const db = new PrometheusDatabase({
        path: dbPath,
        readonly: false
      });

      // Check if database is open
      const isOpen = db.isOpen();

      // Close the connection
      db.close();

      return isOpen;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if critical dependencies are available
   */
  async checkDependencies(): Promise<boolean> {
    try {
      // Verify critical modules can be imported
      // These are already imported at the top, but we can verify they're functional
      
      // Check better-sqlite3 (native module)
      await import('better-sqlite3');
      
      // Check express
      await import('express');
      
      // Check other critical dependencies
      await import('dotenv');
      
      return true;
    } catch (error) {
      return false;
    }
  }
}
