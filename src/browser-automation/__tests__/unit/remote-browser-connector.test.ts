/**
 * Unit Tests for Remote Browser Connector
 * 
 * Tests WebSocket connection, Gateway authentication, version verification,
 * and error handling with retry suggestions.
 */

import { RemoteBrowserConnector } from '../../remote-browser-connector';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

// Mock fetch for Gateway authentication
global.fetch = jest.fn() as jest.Mock;

describe('RemoteBrowserConnector', () => {
  let connector: RemoteBrowserConnector;
  let mockWs: any;

  beforeEach(() => {
    connector = new RemoteBrowserConnector();
    
    // Create mock WebSocket instance
    mockWs = {
      readyState: WebSocket.CONNECTING,
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      off: jest.fn(),
    };

    // Mock WebSocket constructor
    (WebSocket as any).mockImplementation(() => mockWs);
    
    // Reset fetch mock
    jest.clearAllMocks();
  });

  afterEach(() => {
    connector.disconnect();
  });

  describe('connect', () => {
    it('should successfully connect to remote browser without gateway', async () => {
      const wsEndpoint = 'ws://remote-browser:9222/devtools/browser';

      // Simulate successful connection
      mockWs.readyState = WebSocket.OPEN;
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1]();
        }, 10);
        return mockWs;
      });

      // Mock CDP Browser.getVersion response
      mockWs.send.mockImplementation((message: string, callback: any) => {
        callback();
        const data = JSON.parse(message);
        setTimeout(() => {
          const response = JSON.stringify({
            id: data.id,
            result: {
              product: 'Chrome/120.0.0.0',
              protocolVersion: '1.3',
              userAgent: 'Mozilla/5.0...',
              jsVersion: '12.0.0.0',
              revision: '@abc123',
            },
          });
          mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1](response);
        }, 10);
      });

      const result = await connector.connect({ wsEndpoint });

      expect(result.success).toBe(true);
      expect(result.wsEndpoint).toBe(wsEndpoint);
      expect(result.browserVersion).toBeDefined();
      expect(result.browserVersion?.protocolVersion).toBe('1.3');
    });

    it('should authenticate with gateway before connecting', async () => {
      const gatewayUrl = 'https://gateway.example.com';
      const authToken = 'test-token-123';
      const authenticatedEndpoint = 'ws://authenticated-browser:9222/devtools/browser';

      // Mock successful gateway authentication
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ wsEndpoint: authenticatedEndpoint }),
      });

      // Simulate successful connection
      mockWs.readyState = WebSocket.OPEN;
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1]();
        }, 10);
        return mockWs;
      });

      // Mock CDP Browser.getVersion response
      mockWs.send.mockImplementation((message: string, callback: any) => {
        callback();
        const data = JSON.parse(message);
        setTimeout(() => {
          const response = JSON.stringify({
            id: data.id,
            result: {
              product: 'Chrome/120.0.0.0',
              protocolVersion: '1.3',
              userAgent: 'Mozilla/5.0...',
              jsVersion: '12.0.0.0',
              revision: '@abc123',
            },
          });
          mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1](response);
        }, 10);
      });

      const result = await connector.connect({
        wsEndpoint: 'ws://placeholder',
        gatewayUrl,
        authToken,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${gatewayUrl}/api/browser/connect`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${authToken}`,
          }),
        })
      );

      expect(result.success).toBe(true);
      expect(result.wsEndpoint).toBe(authenticatedEndpoint);
    });

    it('should fail with AUTH_FAILED when gateway authentication fails', async () => {
      const gatewayUrl = 'https://gateway.example.com';
      const authToken = 'invalid-token';

      // Mock failed gateway authentication
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const result = await connector.connect({
        wsEndpoint: 'ws://placeholder',
        gatewayUrl,
        authToken,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_FAILED');
      expect(result.error?.message).toContain('Gateway authentication failed');
      expect(result.error?.retrySuggestions).toBeDefined();
      expect(result.error?.retrySuggestions?.length).toBeGreaterThan(0);
    });

    it('should fail with CONNECTION_FAILED when WebSocket connection fails', async () => {
      const wsEndpoint = 'ws://unreachable:9222/devtools/browser';

      // Simulate connection error
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1](
            new Error('Connection refused')
          );
        }, 10);
        return mockWs;
      });

      const result = await connector.connect({ wsEndpoint });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_FAILED');
      expect(result.error?.message).toContain('Connection refused');
      expect(result.error?.retrySuggestions).toBeDefined();
      expect(result.error?.retrySuggestions).toContain('Verify the WebSocket endpoint URL is correct');
    });

    it('should fail with TIMEOUT when connection times out', async () => {
      const wsEndpoint = 'ws://slow-browser:9222/devtools/browser';
      const timeout = 100;

      // Simulate connection that never completes
      (WebSocket as any).mockImplementation((url: string) => {
        // Don't trigger any events
        return mockWs;
      });

      const result = await connector.connect({ wsEndpoint, timeout });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
      expect(result.error?.message).toContain(`timed out after ${timeout}ms`);
      expect(result.error?.retrySuggestions).toContain('Try increasing the connection timeout');
    });

    it('should fail with VERSION_INCOMPATIBLE when browser version is too old', async () => {
      const wsEndpoint = 'ws://old-browser:9222/devtools/browser';

      // Simulate successful connection
      mockWs.readyState = WebSocket.OPEN;
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1]();
        }, 10);
        return mockWs;
      });

      // Mock CDP Browser.getVersion response with old protocol version
      mockWs.send.mockImplementation((message: string, callback: any) => {
        callback();
        const data = JSON.parse(message);
        setTimeout(() => {
          const response = JSON.stringify({
            id: data.id,
            result: {
              product: 'Chrome/80.0.0.0',
              protocolVersion: '1.2', // Too old (need 1.3+)
              userAgent: 'Mozilla/5.0...',
              jsVersion: '8.0.0.0',
              revision: '@old123',
            },
          });
          mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1](response);
        }, 10);
      });

      const result = await connector.connect({ wsEndpoint });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VERSION_INCOMPATIBLE');
      expect(result.error?.message).toContain('protocol version 1.2 is not supported');
      expect(result.error?.message).toContain('Required: 1.3 or higher');
      expect(result.error?.retrySuggestions).toContain('Update the remote browser to a newer version');
    });

    it('should accept browser with protocol version 1.3', async () => {
      const wsEndpoint = 'ws://browser:9222/devtools/browser';

      mockWs.readyState = WebSocket.OPEN;
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1]();
        }, 10);
        return mockWs;
      });

      mockWs.send.mockImplementation((message: string, callback: any) => {
        callback();
        const data = JSON.parse(message);
        setTimeout(() => {
          const response = JSON.stringify({
            id: data.id,
            result: {
              product: 'Chrome/100.0.0.0',
              protocolVersion: '1.3',
              userAgent: 'Mozilla/5.0...',
              jsVersion: '10.0.0.0',
              revision: '@abc123',
            },
          });
          mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1](response);
        }, 10);
      });

      const result = await connector.connect({ wsEndpoint });

      expect(result.success).toBe(true);
      expect(result.browserVersion?.protocolVersion).toBe('1.3');
    });

    it('should accept browser with protocol version higher than 1.3', async () => {
      const wsEndpoint = 'ws://browser:9222/devtools/browser';

      mockWs.readyState = WebSocket.OPEN;
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1]();
        }, 10);
        return mockWs;
      });

      mockWs.send.mockImplementation((message: string, callback: any) => {
        callback();
        const data = JSON.parse(message);
        setTimeout(() => {
          const response = JSON.stringify({
            id: data.id,
            result: {
              product: 'Chrome/120.0.0.0',
              protocolVersion: '1.5',
              userAgent: 'Mozilla/5.0...',
              jsVersion: '12.0.0.0',
              revision: '@abc123',
            },
          });
          mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1](response);
        }, 10);
      });

      const result = await connector.connect({ wsEndpoint });

      expect(result.success).toBe(true);
      expect(result.browserVersion?.protocolVersion).toBe('1.5');
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection', async () => {
      const wsEndpoint = 'ws://browser:9222/devtools/browser';

      mockWs.readyState = WebSocket.OPEN;
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1]();
        }, 10);
        return mockWs;
      });

      mockWs.send.mockImplementation((message: string, callback: any) => {
        callback();
        const data = JSON.parse(message);
        setTimeout(() => {
          const response = JSON.stringify({
            id: data.id,
            result: {
              product: 'Chrome/120.0.0.0',
              protocolVersion: '1.3',
              userAgent: 'Mozilla/5.0...',
              jsVersion: '12.0.0.0',
              revision: '@abc123',
            },
          });
          mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1](response);
        }, 10);
      });

      await connector.connect({ wsEndpoint });
      expect(connector.isConnected()).toBe(true);

      connector.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
      expect(connector.isConnected()).toBe(false);
    });

    it('should prevent auto-reconnect after manual disconnect', async () => {
      const wsEndpoint = 'ws://browser:9222/devtools/browser';

      mockWs.readyState = WebSocket.OPEN;
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1]();
        }, 10);
        return mockWs;
      });

      mockWs.send.mockImplementation((message: string, callback: any) => {
        callback();
        const data = JSON.parse(message);
        setTimeout(() => {
          const response = JSON.stringify({
            id: data.id,
            result: {
              product: 'Chrome/120.0.0.0',
              protocolVersion: '1.3',
              userAgent: 'Mozilla/5.0...',
              jsVersion: '12.0.0.0',
              revision: '@abc123',
            },
          });
          mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1](response);
        }, 10);
      });

      await connector.connect({ wsEndpoint });
      connector.disconnect();

      // Simulate disconnection event
      mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1]();

      // Wait a bit to ensure no reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(connector.getReconnectAttempts()).toBe(0);
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      const wsEndpoint = 'ws://browser:9222/devtools/browser';

      mockWs.readyState = WebSocket.OPEN;
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1]();
        }, 10);
        return mockWs;
      });

      mockWs.send.mockImplementation((message: string, callback: any) => {
        callback();
        const data = JSON.parse(message);
        setTimeout(() => {
          const response = JSON.stringify({
            id: data.id,
            result: {
              product: 'Chrome/120.0.0.0',
              protocolVersion: '1.3',
              userAgent: 'Mozilla/5.0...',
              jsVersion: '12.0.0.0',
              revision: '@abc123',
            },
          });
          mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1](response);
        }, 10);
      });

      await connector.connect({ wsEndpoint });

      expect(connector.isConnected()).toBe(true);
    });

    it('should return false when not connected', () => {
      expect(connector.isConnected()).toBe(false);
    });

    it('should return false after disconnect', async () => {
      const wsEndpoint = 'ws://browser:9222/devtools/browser';

      mockWs.readyState = WebSocket.OPEN;
      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1]();
        }, 10);
        return mockWs;
      });

      mockWs.send.mockImplementation((message: string, callback: any) => {
        callback();
        const data = JSON.parse(message);
        setTimeout(() => {
          const response = JSON.stringify({
            id: data.id,
            result: {
              product: 'Chrome/120.0.0.0',
              protocolVersion: '1.3',
              userAgent: 'Mozilla/5.0...',
              jsVersion: '12.0.0.0',
              revision: '@abc123',
            },
          });
          mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1](response);
        }, 10);
      });

      await connector.connect({ wsEndpoint });
      connector.disconnect();

      expect(connector.isConnected()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should provide retry suggestions for connection failures', async () => {
      const wsEndpoint = 'ws://unreachable:9222/devtools/browser';

      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1](
            new Error('ECONNREFUSED')
          );
        }, 10);
        return mockWs;
      });

      const result = await connector.connect({ wsEndpoint });

      expect(result.error?.retrySuggestions).toBeDefined();
      expect(result.error?.retrySuggestions?.length).toBeGreaterThan(0);
      expect(result.error?.retrySuggestions).toContain('Verify the WebSocket endpoint URL is correct');
      expect(result.error?.retrySuggestions).toContain('Check if the remote browser is running');
    });

    it('should include connection details in error', async () => {
      const wsEndpoint = 'ws://test:9222/devtools/browser';

      (WebSocket as any).mockImplementation((url: string) => {
        setTimeout(() => {
          mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1](
            new Error('Network error')
          );
        }, 10);
        return mockWs;
      });

      const result = await connector.connect({ wsEndpoint });

      expect(result.error?.details).toBeDefined();
      expect(result.error?.details.wsEndpoint).toBe(wsEndpoint);
    });
  });
});
