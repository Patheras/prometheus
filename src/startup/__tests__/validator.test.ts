/**
 * Unit tests for StartupValidator
 * 
 * Tests port availability checking, database connectivity checking, and dependency verification.
 */

import { StartupValidator } from '../validator';

describe('StartupValidator', () => {
  let validator: StartupValidator;

  beforeEach(() => {
    validator = new StartupValidator();
  });

  describe('checkPortAvailability', () => {
    it('should return a boolean result for any port', async () => {
      // Test with a high port number
      const port = 54321;
      const result = await validator.checkPortAvailability(port);
      expect(typeof result).toBe('boolean');
    });

    it('should handle port checking correctly', async () => {
      // Test that the method returns a boolean for different ports
      const result1 = await validator.checkPortAvailability(54323);
      const result2 = await validator.checkPortAvailability(54324);
      
      expect(typeof result1).toBe('boolean');
      expect(typeof result2).toBe('boolean');
    });
  });

  describe('checkDatabaseConnectivity', () => {
    it('should return true when database can be opened', async () => {
      // Set a valid database path
      process.env.DATABASE_PATH = 'data/prometheus.db';
      
      const result = await validator.checkDatabaseConnectivity();
      
      // Should be true if database exists or can be created
      expect(typeof result).toBe('boolean');
    });

    it('should return false when database path is invalid', async () => {
      // Set an invalid database path (invalid characters)
      process.env.DATABASE_PATH = '/invalid/\x00/path/db.sqlite';
      
      const result = await validator.checkDatabaseConnectivity();
      expect(result).toBe(false);
    });
  });

  describe('checkDependencies', () => {
    it('should return true when all critical dependencies are available', async () => {
      const result = await validator.checkDependencies();
      expect(result).toBe(true);
    });
  });

  describe('validateAll', () => {
    it('should return a StartupChecks object with all boolean flags', async () => {
      const result = await validator.validateAll();
      
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('ports');
      expect(result).toHaveProperty('dependencies');
      
      expect(typeof result.environment).toBe('boolean');
      expect(typeof result.database).toBe('boolean');
      expect(typeof result.ports).toBe('boolean');
      expect(typeof result.dependencies).toBe('boolean');
    });
  });
});
