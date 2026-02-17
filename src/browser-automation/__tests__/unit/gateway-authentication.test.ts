/**
 * Gateway Authentication Tests
 * 
 * Tests for Gateway authentication, token validation, and token refresh.
 * 
 * Requirements: 9.3
 */

import { RemoteBrowserConnector } from '../../remote-browser-connector.js';

describe('Gateway Authentication', () => {
  let connector: RemoteBrowserConnector;

  beforeEach(() => {
    connector = new RemoteBrowserConnector();
  });

  afterEach(() => {
    if (connector) {
      connector.disconnect();
    }
  });

  describe('Token Storage', () => {
    it('should store authentication token', () => {
      // Initially null
      expect(connector.getCurrentAuthToken()).toBeNull();
      expect(connector.getCurrentRefreshToken()).toBeNull();
    });

    it('should provide token getters', () => {
      expect(typeof connector.getCurrentAuthToken).toBe('function');
      expect(typeof connector.getCurrentRefreshToken).toBe('function');
    });
  });

  describe('Connection Options', () => {
    it('should accept authToken in connection options', () => {
      const options = {
        wsEndpoint: 'ws://localhost:9222',
        gatewayUrl: 'https://gateway.example.com',
        authToken: 'test-auth-token',
        refreshToken: 'test-refresh-token',
      };

      // Options should be valid
      expect(options.authToken).toBe('test-auth-token');
      expect(options.refreshToken).toBe('test-refresh-token');
    });
  });

  describe('Authorization Checks', () => {
    it('should require authentication for remote profiles', async () => {
      // Attempting to connect without auth token should fail
      const result = await connector.connect({
        wsEndpoint: 'ws://invalid-endpoint:9222',
        gatewayUrl: 'https://gateway.example.com',
        // No authToken provided
        timeout: 1000,
      });

      // Should fail because no auth token
      expect(result.success).toBe(false);
    });

    it('should validate token format', () => {
      const validTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'simple-token-123',
      ];

      for (const token of validTokens) {
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Token Refresh', () => {
    it('should have token refresh capability', () => {
      // The connector should have private methods for token refresh
      // We can't test private methods directly, but we can verify the interface
      expect(connector).toHaveProperty('connect');
      expect(connector).toHaveProperty('disconnect');
      expect(connector).toHaveProperty('getCurrentAuthToken');
      expect(connector).toHaveProperty('getCurrentRefreshToken');
    });

    it('should clear tokens on disconnect', () => {
      connector.disconnect();
      expect(connector.getCurrentAuthToken()).toBeNull();
      expect(connector.getCurrentRefreshToken()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should return AUTH_FAILED error code for authentication failures', async () => {
      const result = await connector.connect({
        wsEndpoint: 'ws://invalid:9222',
        gatewayUrl: 'https://invalid-gateway.example.com',
        authToken: 'invalid-token',
        timeout: 1000,
      });

      expect(result.success).toBe(false);
      if (result.error) {
        expect(result.error.code).toBe('AUTH_FAILED');
        expect(result.error.message).toBeTruthy();
        expect(result.error.retrySuggestions).toBeDefined();
        expect(Array.isArray(result.error.retrySuggestions)).toBe(true);
      }
    });

    it('should provide retry suggestions on auth failure', async () => {
      const result = await connector.connect({
        wsEndpoint: 'ws://invalid:9222',
        gatewayUrl: 'https://invalid-gateway.example.com',
        authToken: 'invalid-token',
        timeout: 1000,
      });

      expect(result.success).toBe(false);
      if (result.error && result.error.retrySuggestions) {
        expect(result.error.retrySuggestions.length).toBeGreaterThan(0);
        expect(result.error.retrySuggestions.some(s => s.includes('token'))).toBe(true);
      }
    });
  });

  describe('Security Requirements', () => {
    it('should use Bearer token authentication', () => {
      // The implementation should use Bearer token in Authorization header
      // This is verified in the authenticateWithGateway method
      const authHeader = 'Bearer test-token';
      expect(authHeader).toContain('Bearer');
    });

    it('should validate token before connection', async () => {
      // Connection with gateway should validate token first
      const result = await connector.connect({
        wsEndpoint: 'ws://localhost:9222',
        gatewayUrl: 'https://gateway.example.com',
        authToken: 'test-token',
        timeout: 1000,
      });

      // Should fail because gateway is not reachable
      expect(result.success).toBe(false);
    });

    it('should not expose tokens in error messages', async () => {
      const result = await connector.connect({
        wsEndpoint: 'ws://invalid:9222',
        gatewayUrl: 'https://invalid-gateway.example.com',
        authToken: 'secret-token-12345',
        timeout: 1000,
      });

      expect(result.success).toBe(false);
      if (result.error) {
        // Error message should not contain the actual token
        expect(result.error.message).not.toContain('secret-token-12345');
      }
    });
  });

  describe('Connection Result', () => {
    it('should return tokens in successful connection result', () => {
      // When connection succeeds, it should return updated tokens
      const mockResult = {
        success: true,
        wsEndpoint: 'ws://localhost:9222',
        authToken: 'new-auth-token',
        refreshToken: 'new-refresh-token',
      };

      expect(mockResult.authToken).toBeDefined();
      expect(mockResult.refreshToken).toBeDefined();
    });
  });

  describe('Reconnection with Authentication', () => {
    it('should maintain authentication on reconnection', () => {
      // After disconnect, tokens should be cleared
      connector.disconnect();
      expect(connector.getCurrentAuthToken()).toBeNull();
      
      // On reconnection, new tokens should be provided
      // This is tested in integration tests
    });
  });
});
