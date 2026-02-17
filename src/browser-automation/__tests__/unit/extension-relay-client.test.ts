/**
 * Extension Relay Client Unit Tests
 * 
 * Tests for the ExtensionRelayClient class that communicates with
 * Chrome extension for tab control.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ExtensionRelayClient, ExtensionTab } from '../../extension-relay-client.js';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('ExtensionRelayClient', () => {
  let client: ExtensionRelayClient;
  let mockWs: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock WebSocket
    mockWs = {
      on: jest.fn(),
      once: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    };

    // Mock WebSocket constructor
    (WebSocket as any).mockImplementation(() => mockWs);

    client = new ExtensionRelayClient({ timeout: 5000 });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  describe('connect', () => {
    it('should connect to extension relay successfully', async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');

      // Simulate WebSocket open event
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      expect(openHandler).toBeDefined();
      openHandler();

      await connectPromise;

      expect(client.isConnected()).toBe(true);
    });

    it('should reject if connection times out', async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');

      // Don't trigger open event, let it timeout
      await expect(connectPromise).rejects.toThrow('Extension relay connection timeout');
    });

    it('should reject if WebSocket error occurs', async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');

      // Simulate WebSocket error event
      const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      expect(errorHandler).toBeDefined();
      errorHandler(new Error('Connection failed'));

      await expect(connectPromise).rejects.toThrow('Connection failed');
    });

    it('should throw error if already connected', async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');

      // Simulate WebSocket open event
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      await connectPromise;

      // Try to connect again
      await expect(client.connect('ws://localhost:9222/extension')).rejects.toThrow(
        'Extension relay client is already connected'
      );
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();
      await connectPromise;
    });

    it('should disconnect from extension relay', async () => {
      const disconnectPromise = client.disconnect();

      // Simulate WebSocket close event
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      expect(closeHandler).toBeDefined();
      closeHandler(1000, Buffer.from('Normal closure'));

      await disconnectPromise;

      expect(client.isConnected()).toBe(false);
      expect(mockWs.close).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await client.disconnect();
      
      // Should not throw and should handle gracefully
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('discoverTabs', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();
      await connectPromise;
    });

    it('should discover available tabs', async () => {
      const mockTabs: ExtensionTab[] = [
        { tabId: 1, title: 'Tab 1', url: 'https://example.com', windowId: 1, active: true },
        { tabId: 2, title: 'Tab 2', url: 'https://google.com', windowId: 1, active: false },
      ];

      const discoverPromise = client.discoverTabs();

      // Simulate response
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      expect(messageHandler).toBeDefined();

      // Get the request ID from the sent message
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('discover_tabs');
      expect(sentMessage.requestId).toBeDefined();

      // Send response
      messageHandler(
        JSON.stringify({
          type: 'discover_tabs',
          requestId: sentMessage.requestId,
          tabs: mockTabs,
        })
      );

      const tabs = await discoverPromise;
      expect(tabs).toEqual(mockTabs);
    });

    it('should throw error if not connected', async () => {
      await client.disconnect();
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1000, Buffer.from('Normal closure'));

      await expect(client.discoverTabs()).rejects.toThrow(
        'Extension relay client is not connected'
      );
    });

    it('should handle timeout when discovering tabs', async () => {
      const discoverPromise = client.discoverTabs();

      // Don't send response, let it timeout
      await expect(discoverPromise).rejects.toThrow('Extension relay request timeout');
    });
  });

  describe('connectTab', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();
      await connectPromise;
    });

    it('should connect to a specific tab', async () => {
      const tabId = 123;
      const mockWsEndpoint = 'ws://localhost:9222/devtools/page/ABC123';

      const connectTabPromise = client.connectTab(tabId);

      // Simulate response
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('connect_tab');
      expect(sentMessage.tabId).toBe(tabId);

      messageHandler(
        JSON.stringify({
          type: 'connect_tab',
          requestId: sentMessage.requestId,
          wsEndpoint: mockWsEndpoint,
        })
      );

      const wsEndpoint = await connectTabPromise;
      expect(wsEndpoint).toBe(mockWsEndpoint);
      expect(client.getConnectedTabId()).toBe(tabId);
    });

    it('should throw error if already connected to a different tab', async () => {
      // Connect to first tab
      const connectTabPromise1 = client.connectTab(123);
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const sentMessage1 = JSON.parse(mockWs.send.mock.calls[0][0]);
      messageHandler(
        JSON.stringify({
          type: 'connect_tab',
          requestId: sentMessage1.requestId,
          wsEndpoint: 'ws://localhost:9222/devtools/page/ABC123',
        })
      );
      await connectTabPromise1;

      // Try to connect to second tab
      await expect(client.connectTab(456)).rejects.toThrow(
        'Already connected to tab 123. Disconnect first.'
      );
    });

    it('should throw error if not connected to relay', async () => {
      await client.disconnect();
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1000, Buffer.from('Normal closure'));

      await expect(client.connectTab(123)).rejects.toThrow(
        'Extension relay client is not connected'
      );
    });
  });

  describe('disconnectTab', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();
      await connectPromise;

      // Connect to a tab
      const connectTabPromise = client.connectTab(123);
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      messageHandler(
        JSON.stringify({
          type: 'connect_tab',
          requestId: sentMessage.requestId,
          wsEndpoint: 'ws://localhost:9222/devtools/page/ABC123',
        })
      );
      await connectTabPromise;
    });

    it('should disconnect from a tab', async () => {
      const disconnectTabPromise = client.disconnectTab(123);

      // Simulate response
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const sentMessages = mockWs.send.mock.calls.map((call: any) => JSON.parse(call[0]));
      const disconnectMessage = sentMessages.find((msg: any) => msg.type === 'disconnect_tab');
      expect(disconnectMessage).toBeDefined();

      messageHandler(
        JSON.stringify({
          type: 'disconnect_tab',
          requestId: disconnectMessage.requestId,
        })
      );

      await disconnectTabPromise;
      expect(client.getConnectedTabId()).toBeNull();
    });

    it('should throw error if not connected to the specified tab', async () => {
      await expect(client.disconnectTab(456)).rejects.toThrow('Not connected to tab 456');
    });
  });

  describe('tab closure detection', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();
      await connectPromise;

      // Connect to a tab
      const connectTabPromise = client.connectTab(123);
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      messageHandler(
        JSON.stringify({
          type: 'connect_tab',
          requestId: sentMessage.requestId,
          wsEndpoint: 'ws://localhost:9222/devtools/page/ABC123',
        })
      );
      await connectTabPromise;
    });

    it('should emit tab-closed event when tab is closed', (done) => {
      client.on('tab-closed', (info) => {
        expect(info.tabId).toBe(123);
        expect(client.getConnectedTabId()).toBeNull();
        done();
      });

      // Simulate tab closed message
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(
        JSON.stringify({
          type: 'tab_closed',
          tabId: 123,
        })
      );
    });

    it('should not emit tab-closed event for different tab', (done) => {
      let eventEmitted = false;
      
      client.on('tab-closed', () => {
        eventEmitted = true;
      });

      // Simulate tab closed message for different tab
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(
        JSON.stringify({
          type: 'tab_closed',
          tabId: 456, // Different tab
        })
      );

      // Wait a bit to ensure event is not emitted
      setTimeout(() => {
        expect(eventEmitted).toBe(false);
        done();
      }, 100);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('ws://localhost:9222/extension');
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();
      await connectPromise;
    });

    it('should handle error response from extension', async () => {
      const discoverPromise = client.discoverTabs();

      // Simulate error response
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);

      messageHandler(
        JSON.stringify({
          type: 'error',
          requestId: sentMessage.requestId,
          error: 'Extension not available',
        })
      );

      await expect(discoverPromise).rejects.toThrow('Extension not available');
    });

    it('should reject pending requests on disconnection', async () => {
      const discoverPromise = client.discoverTabs();

      // Simulate disconnection
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, Buffer.from('Abnormal closure'));

      await expect(discoverPromise).rejects.toThrow('Extension relay disconnected');
    });
  });

  describe('static methods', () => {
    it('should check if extension is available', async () => {
      // Mock successful connection and discovery
      const checkPromise = ExtensionRelayClient.checkExtensionAvailable(
        'ws://localhost:9222/extension',
        1000
      );

      // Simulate successful connection
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Simulate successful tab discovery
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      messageHandler(
        JSON.stringify({
          type: 'discover_tabs',
          requestId: sentMessage.requestId,
          tabs: [],
        })
      );

      // Simulate disconnect
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1000, Buffer.from('Normal closure'));

      const available = await checkPromise;
      expect(available).toBe(true);
    });

    it('should return false if extension is not available', async () => {
      const checkPromise = ExtensionRelayClient.checkExtensionAvailable(
        'ws://localhost:9222/extension',
        1000
      );

      // Simulate connection error
      const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      errorHandler(new Error('Connection refused'));

      const available = await checkPromise;
      expect(available).toBe(false);
    });

    it('should return installation instructions', () => {
      const instructions = ExtensionRelayClient.getInstallationInstructions();
      expect(instructions).toContain('Extension Relay is not installed');
      expect(instructions).toContain('Install the Browser Automation Extension');
    });
  });
});
