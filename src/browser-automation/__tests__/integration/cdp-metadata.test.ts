/**
 * CDP Metadata Integration Tests
 * 
 * Integration tests for browser metadata retrieval and target management.
 * These tests verify that getBrowserVersion, getTargets, createTarget, 
 * and closeTarget work correctly together.
 * 
 * Requirements: 1.3
 */

import { CDPClient } from '../../cdp-client';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('CDP Metadata Integration', () => {
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

    // Setup default connection behavior
    mockWs.on.mockImplementation((event: string, handler: any) => {
      if (event === 'open') {
        setTimeout(() => handler(), 0);
      }
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      mockWs.once.mockImplementation((event: string, handler: any) => {
        if (event === 'close') {
          setTimeout(() => handler(), 0);
        }
      });
      await client.disconnect();
    }
    jest.clearAllMocks();
  });

  describe('Browser metadata retrieval workflow', () => {
    it('should retrieve browser version after connecting', async () => {
      await client.connect('ws://localhost:9222/devtools/browser/test');

      const versionData = {
        product: 'Chrome/120.0.6099.109',
        protocolVersion: '1.3',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        jsVersion: '12.0.267.17',
        revision: '@c7a8b35'
      };

      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler && message.method === 'Browser.getVersion') {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: versionData
            }));
          }, 0);
        }
      });

      const version = await client.getBrowserVersion();

      expect(version.browser).toBe('Chrome/120.0.6099.109');
      expect(version.protocolVersion).toBe('1.3');
      expect(version.userAgent).toContain('Mozilla/5.0');
    });
  });

  describe('Target management workflow', () => {
    beforeEach(async () => {
      await client.connect('ws://localhost:9222/devtools/browser/test');
    });

    it('should create target, list targets, and close target', async () => {
      const testUrl = 'https://example.com';
      let createdTargetId: string;

      // Mock responses for all commands
      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        
        if (!messageHandler) return;

        // Create target
        if (message.method === 'Target.createTarget') {
          createdTargetId = 'new-target-123';
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: { targetId: createdTargetId }
            }));
          }, 0);
        }
        // Get targets
        else if (message.method === 'Target.getTargets') {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: {
                targetInfos: [
                  {
                    targetId: createdTargetId,
                    type: 'page',
                    title: 'Example Domain',
                    url: testUrl,
                    attached: false
                  }
                ]
              }
            }));
          }, 0);
        }
        // Close target
        else if (message.method === 'Target.closeTarget') {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: { success: true }
            }));
          }, 0);
        }
      });

      // Step 1: Create a new target
      const newTarget = await client.createTarget(testUrl);
      expect(newTarget.url).toBe(testUrl);
      expect(newTarget.type).toBe('page');

      // Step 2: List targets and verify the new target exists
      const targets = await client.getTargets();
      expect(targets).toHaveLength(1);
      expect(targets[0].url).toBe(testUrl);
      expect(targets[0].targetId).toBe(newTarget.targetId);

      // Step 3: Close the target
      await client.closeTarget(newTarget.targetId);
      
      // Verify close command was sent
      const closeCalls = (mockWs.send as jest.Mock).mock.calls
        .map(call => JSON.parse(call[0]))
        .filter(msg => msg.method === 'Target.closeTarget');
      
      expect(closeCalls).toHaveLength(1);
      expect(closeCalls[0].params.targetId).toBe(newTarget.targetId);
    });

    it('should handle multiple targets', async () => {
      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        
        if (!messageHandler) return;

        if (message.method === 'Target.getTargets') {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              result: {
                targetInfos: [
                  {
                    targetId: 'target-1',
                    type: 'page',
                    title: 'Page 1',
                    url: 'https://example.com',
                    attached: true
                  },
                  {
                    targetId: 'target-2',
                    type: 'page',
                    title: 'Page 2',
                    url: 'https://another.com',
                    attached: false
                  },
                  {
                    targetId: 'target-3',
                    type: 'background_page',
                    title: 'Extension',
                    url: 'chrome-extension://abc123',
                    attached: false
                  }
                ]
              }
            }));
          }, 0);
        }
      });

      const targets = await client.getTargets();

      expect(targets).toHaveLength(3);
      expect(targets.filter(t => t.type === 'page')).toHaveLength(2);
      expect(targets.filter(t => t.type === 'background_page')).toHaveLength(1);
    });
  });

  describe('Error handling in metadata operations', () => {
    beforeEach(async () => {
      await client.connect('ws://localhost:9222/devtools/browser/test');
    });

    it('should handle errors when retrieving browser version', async () => {
      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        
        if (messageHandler && message.method === 'Browser.getVersion') {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              error: { code: -32000, message: 'Browser not available' }
            }));
          }, 0);
        }
      });

      await expect(client.getBrowserVersion())
        .rejects.toThrow('CDP Error: Browser not available (-32000)');
    });

    it('should handle errors when creating target with invalid URL', async () => {
      mockWs.send.mockImplementation((data: string) => {
        const message = JSON.parse(data);
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')?.[1];
        
        if (messageHandler && message.method === 'Target.createTarget') {
          setTimeout(() => {
            messageHandler(JSON.stringify({
              id: message.id,
              error: { code: -32602, message: 'Invalid URL' }
            }));
          }, 0);
        }
      });

      await expect(client.createTarget('invalid-url'))
        .rejects.toThrow('CDP Error: Invalid URL (-32602)');
    });
  });
});
