/**
 * Control Server Validation Integration Tests
 * 
 * Tests that validation and sanitization work correctly in the ControlServer.
 */

import request from 'supertest';
import { ControlServer } from '../../control-server.js';

describe('ControlServer Validation Integration', () => {
  let controlServer: ControlServer;

  beforeAll(async () => {
    // Create control server without browser manager for validation testing
    controlServer = new ControlServer();
    
    // Start the server
    await controlServer.start(18792); // Use different port for testing
  });

  afterAll(async () => {
    await controlServer.stop();
  });

  describe('POST /browser/action validation', () => {
    it('should reject action without type', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/action')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
      expect(response.body.error.details).toBeDefined();
    });

    it('should reject navigate action with invalid URL', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/action')
        .send({
          type: 'navigate',
          url: 'not-a-valid-url',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });

    it('should reject click action with injection pattern in selector', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/action')
        .send({
          type: 'click',
          selector: "'; DROP TABLE users; --",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });

    it('should reject screenshot action with path traversal', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/action')
        .send({
          type: 'screenshot',
          path: '../../../etc/passwd',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });

    it('should reject upload action with path traversal in filePaths', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/action')
        .send({
          type: 'upload',
          selector: '#file-input',
          filePaths: ['../../../etc/passwd'],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });

    it('should reject type action with invalid timeout', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/action')
        .send({
          type: 'type',
          selector: '#input',
          text: 'hello',
          timeout: -1,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });

    it('should reject screenshot action with invalid quality', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/action')
        .send({
          type: 'screenshot',
          quality: 150,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });
  });

  describe('POST /browser/state validation', () => {
    it('should reject invalid browser state', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/state')
        .send({
          cookies: 'not-an-array',
          localStorage: {},
          sessionStorage: {},
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });

    it('should reject state without required fields', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/state')
        .send({
          cookies: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });
  });

  describe('GET /browser/screenshot validation', () => {
    it('should reject invalid format', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .get('/browser/screenshot')
        .query({ format: 'gif' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });

    it('should reject invalid quality', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .get('/browser/screenshot')
        .query({ quality: '150' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });
  });

  describe('POST /browser/pdf validation', () => {
    it('should reject path with traversal', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/pdf')
        .send({
          path: '../../../etc/passwd',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
    });
  });

  describe('Structured error responses', () => {
    it('should return structured error with code, message, and timestamp', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/action')
        .send({
          type: 'invalid-type',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should include validation details in error response', async () => {
      const response = await request(`http://127.0.0.1:18792`)
        .post('/browser/action')
        .send({
          type: 'click',
          // Missing selector
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('details');
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(response.body.error.details.length).toBeGreaterThan(0);
      expect(response.body.error.details[0]).toHaveProperty('field');
      expect(response.body.error.details[0]).toHaveProperty('message');
    });
  });
});
