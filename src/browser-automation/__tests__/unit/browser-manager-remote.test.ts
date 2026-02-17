/**
 * Unit Tests for Browser Manager - Remote Profile Support
 * 
 * Tests remote browser connection, network interruption detection,
 * and automatic reconnection with backoff.
 */

import { BrowserManager } from '../../browser-manager';
import { ProfileManager } from '../../profile-manager';
import { RemoteBrowserConnector } from '../../remote-browser-connector';
import { BrowserProfile } from '../../types/index';

// Mock chrome-launcher
jest.mock('chrome-launcher', () => ({
  launch: jest.fn(),
}));

// Mock CDPClient
jest.mock('../../cdp-client', () => {
  const EventEmitter = require('events');
  return {
    CDPClient: jest.fn().mockImplementation(() => {
      const emitter = new EventEmitter();
      return {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
        on: emitter.on.bind(emitter),
        off: emitter.off.bind(emitter),
        emit: emitter.emit.bind(emitter),
        removeAllListeners: emitter.removeAllListeners.bind(emitter),
      };
    }),
  };
});

// Mock PlaywrightAdapter
jest.mock('../../playwright-adapter', () => ({
  PlaywrightAdapter: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

// Mock RemoteBrowserConnector
jest.mock('../../remote-browser-connector');

// Import after mocking
import chromeLauncher from 'chrome-launcher';
import { CDPClient } from '../../cdp-client';
import { PlaywrightAdapter } from '../../playwright-adapter';

// Mock fetch for CDP endpoint
global.fetch = jest.fn() as any;

describe('BrowserManager - Remote Profile Support', () => {
  let browserManager: BrowserManager;
  let profileManager: ProfileManager;
  let mockRemoteConnector: any;

  const remoteProfile: BrowserProfile = {
    name: 'test-remote',
    type: 'remote',
    userDataDir: '/tmp/test-remote',
    launchOptions: {
      headless: true,
      args: [],
      defaultViewport: { width: 1280, height: 720 },
      timeout: 30000,
    },
    connectionOptions: {
      wsEndpoint: 'ws://remote-browser:9222/devtools/browser',
      gatewayUrl: 'https://gateway.example.com',
      authToken: 'test-token-123',
    },
  };

  beforeEach(() => {
    // Create profile manager with remote profile
    profileManager = new ProfileManager([remoteProfile]);

    // Create browser manager
    browserManager = new BrowserManager(profileManager, 300000);

    // Create mock remote connector
    mockRemoteConnector = {
      connect: jest.fn().mockResolvedValue({
        success: true,
        wsEndpoint: 'ws://authenticated-browser:9222/devtools/browser',
        browserVersion: {
          browser: 'Chrome/120.0.0.0',
          protocolVersion: '1.3',
          userAgent: 'Mozilla/5.0...',
          v8Version: '12.0.0.0',
          webKitVersion: '@abc123',
        },
      }),
      disconnect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      getReconnectAttempts: jest.fn().mockReturnValue(0),
    };

    // Mock RemoteBrowserConnector constructor
    (RemoteBrowserConnector as jest.Mock).mockImplementation(() => mockRemoteConnector);
  });

  afterEach(async () => {
    if (browserManager.isStarted()) {
      await browserManager.stop();
    }
  });

  describe('launchBrowser with remote profile', () => {
    it('should successfully launch remote browser with gateway authentication', async () => {
      await browserManager.start();

      const browser = await browserManager.launchBrowser(remoteProfile);

      expect(browser).toBeDefined();
      expect(browser.profile.name).toBe('test-remote');
      expect(browser.profile.type).toBe('remote');
      expect(mockRemoteConnector.connect).toHaveBeenCalledWith({
        wsEndpoint: 'ws://remote-browser:9222/devtools/browser',
        gatewayUrl: 'https://gateway.example.com',
        authToken: 'test-token-123',
        timeout: 30000,
      });
      
      // Get the CDP client instance that was created
      const CDPClientMock = CDPClient as jest.Mock;
      const cdpInstance = CDPClientMock.mock.results[CDPClientMock.mock.results.length - 1].value;
      expect(cdpInstance.connect).toHaveBeenCalledWith('ws://authenticated-browser:9222/devtools/browser');
      
      // Get the Playwright adapter instance that was created
      const PlaywrightAdapterMock = PlaywrightAdapter as jest.Mock;
      const playwrightInstance = PlaywrightAdapterMock.mock.results[PlaywrightAdapterMock.mock.results.length - 1].value;
      expect(playwrightInstance.initialize).toHaveBeenCalledWith('ws://authenticated-browser:9222/devtools/browser');
    });

    it('should successfully launch remote browser without gateway', async () => {
      const profileWithoutGateway: BrowserProfile = {
        ...remoteProfile,
        connectionOptions: {
          wsEndpoint: 'ws://direct-browser:9222/devtools/browser',
        },
      };

      profileManager = new ProfileManager([profileWithoutGateway]);
      browserManager = new BrowserManager(profileManager, 300000);

      await browserManager.start();

      const browser = await browserManager.launchBrowser(profileWithoutGateway);

      expect(browser).toBeDefined();
      expect(mockRemoteConnector.connect).toHaveBeenCalledWith({
        wsEndpoint: 'ws://direct-browser:9222/devtools/browser',
        gatewayUrl: undefined,
        authToken: undefined,
        timeout: 30000,
      });
    });

    it('should fail when connection options are missing', async () => {
      const profileWithoutOptions: BrowserProfile = {
        ...remoteProfile,
        connectionOptions: undefined,
      };

      profileManager = new ProfileManager([profileWithoutOptions]);
      browserManager = new BrowserManager(profileManager, 300000);

      await browserManager.start();

      await expect(browserManager.launchBrowser(profileWithoutOptions)).rejects.toThrow(
        'Connection options are required for remote profile'
      );
    });

    it('should fail when remote connection fails', async () => {
      mockRemoteConnector.connect = jest.fn().mockResolvedValue({
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to remote browser',
          retrySuggestions: [
            'Check if the remote browser is running',
            'Verify network connectivity',
          ],
        },
      });

      await browserManager.start();

      await expect(browserManager.launchBrowser(remoteProfile)).rejects.toThrow(
        'Failed to connect to remote browser'
      );
      await expect(browserManager.launchBrowser(remoteProfile)).rejects.toThrow(
        'Check if the remote browser is running'
      );
    });

    it('should emit browser-launched event with remote flag', async () => {
      await browserManager.start();

      const launchedHandler = jest.fn();
      browserManager.on('browser-launched', launchedHandler);

      await browserManager.launchBrowser(remoteProfile);

      expect(launchedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: 'test-remote',
          remote: true,
          browserVersion: expect.objectContaining({
            protocolVersion: '1.3',
          }),
        })
      );
    });
  });

  describe('closeBrowser with remote profile', () => {
    it('should disconnect remote connector when closing browser', async () => {
      await browserManager.start();

      const browser = await browserManager.launchBrowser(remoteProfile);

      await browserManager.closeBrowser(browser.id);

      expect(mockRemoteConnector.disconnect).toHaveBeenCalled();
      
      // Get the CDP client instance
      const CDPClientMock = CDPClient as jest.Mock;
      const cdpInstance = CDPClientMock.mock.results[CDPClientMock.mock.results.length - 1].value;
      expect(cdpInstance.disconnect).toHaveBeenCalled();
      
      // Get the Playwright adapter instance
      const PlaywrightAdapterMock = PlaywrightAdapter as jest.Mock;
      const playwrightInstance = PlaywrightAdapterMock.mock.results[PlaywrightAdapterMock.mock.results.length - 1].value;
      expect(playwrightInstance.close).toHaveBeenCalled();
    });
  });

  describe('network interruption handling', () => {
    it('should emit remote-connection-lost event when connection is lost', async () => {
      await browserManager.start();

      const connectionLostHandler = jest.fn();
      browserManager.on('remote-connection-lost', connectionLostHandler);

      const browser = await browserManager.launchBrowser(remoteProfile);

      // Simulate connection loss
      mockRemoteConnector.isConnected = jest.fn().mockReturnValue(false);
      mockRemoteConnector.getReconnectAttempts = jest.fn().mockReturnValue(1);

      // Wait for the periodic check to run
      await new Promise(resolve => setTimeout(resolve, 5500));

      expect(connectionLostHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId: browser.id,
          profile: 'test-remote',
          reconnectAttempts: 1,
        })
      );
    });

    it('should emit remote-connection-restored event when connection is restored', async () => {
      await browserManager.start();

      const connectionRestoredHandler = jest.fn();
      browserManager.on('remote-connection-restored', connectionRestoredHandler);

      const browser = await browserManager.launchBrowser(remoteProfile);

      // Simulate connection loss
      mockRemoteConnector.isConnected = jest.fn().mockReturnValue(false);
      mockRemoteConnector.getReconnectAttempts = jest.fn().mockReturnValue(1);

      // Wait for the periodic check to detect loss
      await new Promise(resolve => setTimeout(resolve, 5500));

      // Simulate connection restoration
      mockRemoteConnector.isConnected = jest.fn().mockReturnValue(true);

      // Wait for the periodic check to detect restoration
      await new Promise(resolve => setTimeout(resolve, 5500));

      expect(connectionRestoredHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId: browser.id,
          profile: 'test-remote',
        })
      );
    }, 15000); // Increase timeout to 15 seconds

    it('should close browser after max reconnection attempts', async () => {
      await browserManager.start();

      const reconnectionFailedHandler = jest.fn();
      browserManager.on('remote-reconnection-failed', reconnectionFailedHandler);

      const browser = await browserManager.launchBrowser(remoteProfile);

      // Simulate max reconnection attempts reached
      mockRemoteConnector.isConnected = jest.fn().mockReturnValue(false);
      mockRemoteConnector.getReconnectAttempts = jest.fn().mockReturnValue(5);

      // Wait for the periodic check to run
      await new Promise(resolve => setTimeout(resolve, 5500));

      expect(reconnectionFailedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId: browser.id,
          profile: 'test-remote',
        })
      );

      // Browser should be closed
      expect(browserManager.getBrowser(browser.id)).toBeNull();
    });
  });

  describe('switchProfile to remote', () => {
    it('should switch from openclaw to remote profile', async () => {
      const openclawProfile: BrowserProfile = {
        name: 'openclaw',
        type: 'openclaw',
        userDataDir: '/tmp/openclaw',
        launchOptions: {
          headless: true,
          args: [],
          defaultViewport: { width: 1280, height: 720 },
          timeout: 30000,
        },
      };

      profileManager = new ProfileManager([openclawProfile, remoteProfile]);
      browserManager = new BrowserManager(profileManager, 300000);

      await browserManager.start();

      // Mock chrome-launcher for openclaw profile
      const mockChrome = {
        port: 9222,
        kill: jest.fn().mockResolvedValue(undefined),
      };
      const chromeLaunch = require('chrome-launcher').launch;
      chromeLaunch.mockResolvedValue(mockChrome);

      // Mock fetch for CDP version endpoint
      global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser',
        }),
      });

      // Launch openclaw browser first
      await browserManager.launchBrowser(openclawProfile);

      const profileSwitchedHandler = jest.fn();
      browserManager.on('profile-switched', profileSwitchedHandler);

      // Switch to remote profile
      await browserManager.switchProfile('test-remote');

      expect(profileSwitchedHandler).toHaveBeenCalledWith({
        from: 'openclaw',
        to: 'test-remote',
      });

      const currentProfile = browserManager.getCurrentProfile();
      expect(currentProfile?.name).toBe('test-remote');
      expect(currentProfile?.type).toBe('remote');
    });
  });
});
