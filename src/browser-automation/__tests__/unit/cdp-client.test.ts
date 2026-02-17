/**
 * CDP Client Unit Tests
 * 
 * Tests for the CDPClient class covering:
 * - Connection management
 * - Command execution
 * - Event handling
 * - Error handling
 * - Resource cleanup
 */

import { CDPClient } from '../../cdp-client';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('CDPClient', () => {
  let client: CDPClient;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    client = new CDPClient();
    
    // Create a mock WebSocket instance
    mockWs = {
      on: jest.fn(),
      once: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      removeAllListeners: jest.fn(),
      readyState: WebSocket.OPEN,
    } as any;

    // Mock WebSocket constructor
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to a CDP endpoint successfully', async () => {
      const endpoint = 'ws://localhost:9222/devtools/browser/test';
      
      // Simulate successful connection
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect(endpoint);

      expect(WebSocket).toHaveBeenCalledWith(endpoint);
      expect(client.isConnected()).toBe(true);
    });

    it('should reject if connection fails', async () => {
      const endpoint = 'ws://localhost:9222/devtools/browser/test';
      const error = new Error('Connection failed');

      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          // Call handler immediately to avoid timeout
          handler(error);
        }
      });

      await expect(client.connect(endpoint)).rejects.toThrow('Connection failed');
    });

    it('should throw if already connected', async () => {
      const endpoint = 'ws://localhost:9222/devtools/browser/test';

      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect(endpoint);
      await expect(client.connect(endpoint)).rejects.toThrow('CDP client is already connected');
    });

    it('should emit connected event on successful connection', async () => {
      const endpoint = 'ws://localhost:9222/devtools/browser/test';
      const connectedSpy = jest.fn();

      client.on('connected', connectedSpy);

      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect(endpoint);

      expect(connectedSpy).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');
    });

    it('should disconnect successfully', async () => {
      mockWs.once.mockImplementation((event: string, handler: any) => {
        if (event === 'close') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });

    it('should emit disconnected event on close', async () => {
      const disconnectedSpy = jest.fn();
      client.on('disconnected', disconnectedSpy);

      // Simulate close event
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) {
        closeHandler(1000, Buffer.from('Normal closure'));
      }

      expect(disconnectedSpy).toHaveBeenCalledWith({
        code: 1000,
        reason: 'Normal closure'
      });
    });

    it('should clean up resources on disconnect', async () => {
      mockWs.once.mockImplementation((event: string, handler: any) => {
        if (event === 'close') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.disconnect();

      expect(mockWs.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');

      expect(client.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');

      mockWs.once.mockImplementation((event: string, handler: any) => {
        if (event === 'close') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.disconnect();

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('sendCommand', () => {
    beforeEach(async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');
    });

    it('should send a command and receive response', async () => {
      const method = 'Browser.getVersion';
      const expectedResult = { product: 'Chrome/120.0' };

      // Mock send to trigger response
      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: expectedResult
            }));
          }, 0);
        }
      });

      const result = await client.sendCommand(method);

      expect(mockWs.send).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should send command with parameters', async () => {
      const method = 'Target.createTarget';
      const params = { url: 'https://example.com' };

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        expect(message.params).toEqual(params);
        
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: { targetId: 'test-target' }
            }));
          }, 0);
        }
      });

      await client.sendCommand(method, params);
    });

    it('should reject if command returns error', async () => {
      const method = 'Invalid.method';

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              error: { code: -32601, message: 'Method not found' }
            }));
          }, 0);
        }
      });

      await expect(client.sendCommand(method)).rejects.toThrow('CDP Error: Method not found (-32601)');
    });

    it('should throw if not connected', async () => {
      const disconnectedClient = new CDPClient();
      
      await expect(disconnectedClient.sendCommand('Browser.getVersion'))
        .rejects.toThrow('CDP client is not connected');
    });
  });

  describe('getBrowserVersion', () => {
    beforeEach(async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');
    });

    it('should retrieve browser version information', async () => {
      const versionData = {
        product: 'Chrome/120.0.6099.109',
        protocolVersion: '1.3',
        userAgent: 'Mozilla/5.0...',
        jsVersion: '12.0.267.17',
        revision: '@c7a8b35'
      };

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: versionData
            }));
          }, 0);
        }
      });

      const version = await client.getBrowserVersion();

      expect(version).toEqual({
        browser: versionData.product,
        protocolVersion: versionData.protocolVersion,
        userAgent: versionData.userAgent,
        v8Version: versionData.jsVersion,
        webKitVersion: versionData.revision
      });
    });
  });

  describe('getTargets', () => {
    beforeEach(async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');
    });

    it('should retrieve list of targets', async () => {
      const targetsData = {
        targetInfos: [
          {
            targetId: 'target-1',
            type: 'page',
            title: 'Example Page',
            url: 'https://example.com',
            attached: true
          },
          {
            targetId: 'target-2',
            type: 'page',
            title: 'Another Page',
            url: 'https://another.com',
            attached: false
          }
        ]
      };

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: targetsData
            }));
          }, 0);
        }
      });

      const targets = await client.getTargets();

      expect(targets).toHaveLength(2);
      expect(targets[0]).toEqual({
        targetId: 'target-1',
        type: 'page',
        title: 'Example Page',
        url: 'https://example.com',
        attached: true
      });
    });

    it('should handle empty target list', async () => {
      const targetsData = { targetInfos: [] };

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: targetsData
            }));
          }, 0);
        }
      });

      const targets = await client.getTargets();

      expect(targets).toHaveLength(0);
    });
  });

  describe('createTarget', () => {
    beforeEach(async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');
    });

    it('should create a new target with specified URL', async () => {
      const url = 'https://example.com';
      const targetId = 'new-target-123';

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        expect(message.method).toBe('Target.createTarget');
        expect(message.params).toEqual({ url });

        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: { targetId }
            }));
          }, 0);
        }
      });

      const target = await client.createTarget(url);

      expect(target).toEqual({
        targetId,
        type: 'page',
        title: '',
        url,
        attached: false
      });
    });

    it('should create target with about:blank URL', async () => {
      const url = 'about:blank';
      const targetId = 'blank-target';

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: { targetId }
            }));
          }, 0);
        }
      });

      const target = await client.createTarget(url);

      expect(target.url).toBe(url);
      expect(target.targetId).toBe(targetId);
    });
  });

  describe('closeTarget', () => {
    beforeEach(async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');
    });

    it('should close a target by ID', async () => {
      const targetId = 'target-to-close';

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        expect(message.method).toBe('Target.closeTarget');
        expect(message.params).toEqual({ targetId });

        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: { success: true }
            }));
          }, 0);
        }
      });

      await client.closeTarget(targetId);

      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should handle closing non-existent target', async () => {
      const targetId = 'non-existent-target';

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              error: { code: -32000, message: 'No target with given id found' }
            }));
          }, 0);
        }
      });

      await expect(client.closeTarget(targetId))
        .rejects.toThrow('CDP Error: No target with given id found (-32000)');
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');
    });

    it('should emit CDP events', (done) => {
      const eventMethod = 'Target.targetCreated';
      const eventParams = { targetInfo: { targetId: 'new-target' } };

      client.on(eventMethod, (params) => {
        expect(params).toEqual(eventParams);
        done();
      });

      // Simulate CDP event
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler(JSON.stringify({
          method: eventMethod,
          params: eventParams
        }));
      }
    });

    it('should emit generic event notification', (done) => {
      const eventMethod = 'Page.loadEventFired';
      const eventParams = { timestamp: 123456 };

      client.on('event', (method, params) => {
        expect(method).toBe(eventMethod);
        expect(params).toEqual(eventParams);
        done();
      });

      // Simulate CDP event
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler(JSON.stringify({
          method: eventMethod,
          params: eventParams
        }));
      }
    });
  });

  describe('resource cleanup', () => {
    it('should reject pending commands on disconnect', async () => {
      mockWs.on.mockImplementation((event: string, handler: any) => {
        if (event === 'open') {
          setTimeout(() => handler(), 0);
        }
      });

      await client.connect('ws://localhost:9222/devtools/browser/test');

      // Start a command but don't respond
      const commandPromise = client.sendCommand('Browser.getVersion');

      // Simulate close event
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) {
        closeHandler(1000, Buffer.from(''));
      }

      await expect(commandPromise).rejects.toThrow('CDP connection closed');
    });
  });
});
