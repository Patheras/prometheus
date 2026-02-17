/**
 * Tests for EnvValidator
 * 
 * Tests environment variable validation including:
 * - Required variable detection
 * - Format validation (URLs, ports, paths)
 * - Error message generation
 */

import { EnvValidator } from './env-validator.js';

describe('EnvValidator', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validate', () => {
    it('should pass validation with all required variables set', () => {
      // Set all required variables
      process.env.PORT = '4242';
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_PATH = './data/prometheus.db';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4';
      process.env.AZURE_OPENAI_API_VERSION = '2024-12-01-preview';

      const validator = new EnvValidator();
      const result = validator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      // Clear all environment variables
      process.env = {};

      const validator = new EnvValidator();
      const result = validator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check that all required variables are reported
      const requiredVars = validator.getRequiredVariables();
      const errorVariables = result.errors.map(e => e.variable);
      
      for (const requiredVar of requiredVars) {
        expect(errorVariables).toContain(requiredVar);
      }
    });

    it('should report all missing required variables in a single validation', () => {
      // Clear all environment variables
      process.env = {};

      const validator = new EnvValidator();
      const result = validator.validate();

      const requiredVars = validator.getRequiredVariables();
      expect(result.errors).toHaveLength(requiredVars.length);
    });

    it('should mark errors as required for required variables', () => {
      process.env = {};

      const validator = new EnvValidator();
      const result = validator.validate();

      for (const error of result.errors) {
        expect(error.required).toBe(true);
      }
    });
  });

  describe('format validation - PORT', () => {
    beforeEach(() => {
      // Set all required variables except PORT
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_PATH = './data/prometheus.db';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4';
      process.env.AZURE_OPENAI_API_VERSION = '2024-12-01-preview';
    });

    it('should accept valid port numbers', () => {
      const validPorts = ['1', '80', '443', '4242', '8080', '65535'];

      for (const port of validPorts) {
        process.env.PORT = port;
        const validator = new EnvValidator();
        const result = validator.validate();
        
        const portErrors = result.errors.filter(e => e.variable === 'PORT');
        expect(portErrors).toHaveLength(0);
      }
    });

    it('should reject invalid port numbers', () => {
      // Test port 0
      process.env.PORT = '0';
      let validator = new EnvValidator();
      let result = validator.validate();
      let portErrors = result.errors.filter(e => e.variable === 'PORT');
      expect(portErrors.length).toBeGreaterThan(0);

      // Test negative port
      process.env.PORT = '-1';
      validator = new EnvValidator();
      result = validator.validate();
      portErrors = result.errors.filter(e => e.variable === 'PORT');
      expect(portErrors.length).toBeGreaterThan(0);

      // Test port above range
      process.env.PORT = '65536';
      validator = new EnvValidator();
      result = validator.validate();
      portErrors = result.errors.filter(e => e.variable === 'PORT');
      expect(portErrors.length).toBeGreaterThan(0);

      // Test non-numeric port
      process.env.PORT = 'abc';
      validator = new EnvValidator();
      result = validator.validate();
      portErrors = result.errors.filter(e => e.variable === 'PORT');
      expect(portErrors.length).toBeGreaterThan(0);
    });

    it('should provide clear error message for invalid port', () => {
      process.env.PORT = 'invalid';
      
      const validator = new EnvValidator();
      const result = validator.validate();
      
      const portError = result.errors.find(e => e.variable === 'PORT');
      expect(portError).toBeDefined();
      expect(portError?.message).toContain('port');
      expect(portError?.message).toContain('1');
      expect(portError?.message).toContain('65535');
    });
  });

  describe('format validation - NODE_ENV', () => {
    beforeEach(() => {
      // Set all required variables except NODE_ENV
      process.env.PORT = '4242';
      process.env.DATABASE_PATH = './data/prometheus.db';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4';
      process.env.AZURE_OPENAI_API_VERSION = '2024-12-01-preview';
    });

    it('should accept valid NODE_ENV values', () => {
      const validEnvs = ['development', 'production', 'test'];

      for (const env of validEnvs) {
        process.env.NODE_ENV = env;
        const validator = new EnvValidator();
        const result = validator.validate();
        
        const envErrors = result.errors.filter(e => e.variable === 'NODE_ENV');
        expect(envErrors).toHaveLength(0);
      }
    });

    it('should reject invalid NODE_ENV values', () => {
      const invalidEnvs = ['dev', 'prod', 'staging', 'local'];

      for (const env of invalidEnvs) {
        process.env.NODE_ENV = env;
        const validator = new EnvValidator();
        const result = validator.validate();
        
        const envErrors = result.errors.filter(e => e.variable === 'NODE_ENV');
        expect(envErrors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('format validation - URLs', () => {
    beforeEach(() => {
      // Set all required variables
      process.env.PORT = '4242';
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_PATH = './data/prometheus.db';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4';
      process.env.AZURE_OPENAI_API_VERSION = '2024-12-01-preview';
    });

    it('should accept valid URLs with http or https', () => {
      const validUrls = [
        'http://localhost:8080',
        'https://api.example.com',
        'https://test.openai.azure.com',
        'http://192.168.1.1:3000'
      ];

      for (const url of validUrls) {
        process.env.AZURE_OPENAI_ENDPOINT = url;
        const validator = new EnvValidator();
        const result = validator.validate();
        
        const urlErrors = result.errors.filter(e => e.variable === 'AZURE_OPENAI_ENDPOINT');
        expect(urlErrors).toHaveLength(0);
      }
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'ftp://example.com',
        'example.com',
        'www.example.com',
        '//example.com',
        'htp://example.com'
      ];

      for (const url of invalidUrls) {
        process.env.AZURE_OPENAI_ENDPOINT = url;
        const validator = new EnvValidator();
        const result = validator.validate();
        
        const urlErrors = result.errors.filter(e => e.variable === 'AZURE_OPENAI_ENDPOINT');
        expect(urlErrors.length).toBeGreaterThan(0);
      }
    });

    it('should validate optional URL fields', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      process.env.SUPABASE_URL = 'invalid-url';

      const validator = new EnvValidator();
      const result = validator.validate();

      const supabaseError = result.errors.find(e => e.variable === 'SUPABASE_URL');
      expect(supabaseError).toBeDefined();
      expect(supabaseError?.required).toBe(false);
    });
  });

  describe('format validation - paths', () => {
    beforeEach(() => {
      // Set all required variables except DATABASE_PATH
      process.env.PORT = '4242';
      process.env.NODE_ENV = 'development';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'gpt-4';
      process.env.AZURE_OPENAI_API_VERSION = '2024-12-01-preview';
    });

    it('should accept valid file paths', () => {
      const validPaths = [
        './data/prometheus.db',
        '/var/lib/prometheus.db',
        'C:\\data\\prometheus.db',
        '../data/test.db',
        'prometheus.db'
      ];

      for (const path of validPaths) {
        process.env.DATABASE_PATH = path;
        const validator = new EnvValidator();
        const result = validator.validate();
        
        const pathErrors = result.errors.filter(e => e.variable === 'DATABASE_PATH');
        expect(pathErrors).toHaveLength(0);
      }
    });

    it('should reject paths with invalid characters', () => {
      const invalidPaths = [
        'data<test>.db',
        'data|test.db',
        'data"test".db',
        'data?test.db',
        'data*test.db'
      ];

      for (const path of invalidPaths) {
        process.env.DATABASE_PATH = path;
        const validator = new EnvValidator();
        const result = validator.validate();
        
        const pathErrors = result.errors.filter(e => e.variable === 'DATABASE_PATH');
        expect(pathErrors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateFormat', () => {
    it('should validate URL format correctly', () => {
      const validator = new EnvValidator();

      expect(validator.validateFormat('TEST', 'https://example.com', 'url')).toBe(true);
      expect(validator.validateFormat('TEST', 'http://example.com', 'url')).toBe(true);
      expect(validator.validateFormat('TEST', 'ftp://example.com', 'url')).toBe(false);
      expect(validator.validateFormat('TEST', 'example.com', 'url')).toBe(false);
    });

    it('should validate port format correctly', () => {
      const validator = new EnvValidator();

      expect(validator.validateFormat('TEST', '80', 'port')).toBe(true);
      expect(validator.validateFormat('TEST', '65535', 'port')).toBe(true);
      expect(validator.validateFormat('TEST', '1', 'port')).toBe(true);
      expect(validator.validateFormat('TEST', '0', 'port')).toBe(false);
      expect(validator.validateFormat('TEST', '65536', 'port')).toBe(false);
      expect(validator.validateFormat('TEST', 'abc', 'port')).toBe(false);
    });

    it('should validate path format correctly', () => {
      const validator = new EnvValidator();

      expect(validator.validateFormat('TEST', './data/test.db', 'path')).toBe(true);
      expect(validator.validateFormat('TEST', '/var/lib/test.db', 'path')).toBe(true);
      expect(validator.validateFormat('TEST', 'data<test>.db', 'path')).toBe(false);
      expect(validator.validateFormat('TEST', 'data|test.db', 'path')).toBe(false);
    });
  });

  describe('getRequiredVariables', () => {
    it('should return list of required variables', () => {
      const validator = new EnvValidator();
      const required = validator.getRequiredVariables();

      expect(required).toContain('PORT');
      expect(required).toContain('NODE_ENV');
      expect(required).toContain('DATABASE_PATH');
      expect(required).toContain('AZURE_OPENAI_ENDPOINT');
      expect(required).toContain('AZURE_OPENAI_API_KEY');
      expect(required).toContain('AZURE_OPENAI_DEPLOYMENT_NAME');
      expect(required).toContain('AZURE_OPENAI_API_VERSION');
    });

    it('should return a copy of the array', () => {
      const validator = new EnvValidator();
      const required1 = validator.getRequiredVariables();
      const required2 = validator.getRequiredVariables();

      expect(required1).not.toBe(required2);
      expect(required1).toEqual(required2);
    });
  });

  describe('getOptionalVariables', () => {
    it('should return list of optional variables', () => {
      const validator = new EnvValidator();
      const optional = validator.getOptionalVariables();

      expect(optional).toContain('GITHUB_TOKEN');
      expect(optional).toContain('ANTHROPIC_API_KEY');
      expect(optional).toContain('OPENAI_API_KEY');
    });

    it('should return a copy of the array', () => {
      const validator = new EnvValidator();
      const optional1 = validator.getOptionalVariables();
      const optional2 = validator.getOptionalVariables();

      expect(optional1).not.toBe(optional2);
      expect(optional1).toEqual(optional2);
    });
  });

  describe('error messages', () => {
    it('should include variable name in error message', () => {
      process.env = {};

      const validator = new EnvValidator();
      const result = validator.validate();

      for (const error of result.errors) {
        expect(error.message).toContain(error.variable);
      }
    });

    it('should provide actionable error messages', () => {
      process.env = {};

      const validator = new EnvValidator();
      const result = validator.validate();

      for (const error of result.errors) {
        expect(error.message.length).toBeGreaterThan(10);
        expect(error.message).toBeTruthy();
      }
    });
  });
});
