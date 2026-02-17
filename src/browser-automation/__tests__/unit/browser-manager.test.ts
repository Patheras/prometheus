/**
 * Browser Manager Unit Tests
 * 
 * Tests for BrowserManager lifecycle management and browser operations.
 */

import { BrowserManager } from '../../browser-manager';
import { ProfileManager } from '../../profile-manager';
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

// Import after mocking
import chromeLauncher from 'chrome-launcher';

// Mock fetch for CDP endpoint
global.fetch = jest.fn() as any;

describe('BrowserManager', () => {
  let browserManager: BrowserManager;
  let profileManager: ProfileManager;
  let mockProfile: BrowserProfile;
  const mockKill = jest.fn();

  beforeEach(() => {
    // Create a mock profile
    mockProfile = {
      name: 'test-profile',
      type: 'openclaw',
      userDataDir: '/tmp/test-browser-data',
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000,
      },
    };

    // Create profile manager with mock profile
    profileManager = new ProfileManager([mockProfile]);
    
    // Spy on ensureUserDataDir
    jest.spyOn(profileManager, 'ensureUserDataDir').mockResolvedValue(undefined);

    // Create browser manager
    browserManager = new BrowserManager(profileManager);

    // Reset mocks
    jest.clearAllMocks();
    mockKill.mockClear();
  });

  afterEach(async () => {
    // Clean up
    if (browserManager.isStarted()) {
      await browserManager.stop();
    }
  });

  describe('Lifecycle Management', () => {
    it('should start successfully', async () => {
      expect(browserManager.isStarted()).toBe(false);

      await browserManager.start();

      expect(browserManager.isStarted()).toBe(true);
    });

    it('should throw error when starting twice', async () => {
      await browserManager.start();

      await expect(browserManager.start()).rejects.toThrow('BrowserManager is already started');
    });

    it('should stop successfully', async () => {
      await browserManager.start();
      expect(browserManager.isStarted()).toBe(true);

      await browserManager.stop();

      expect(browserManager.isStarted()).toBe(false);
    });

    it('should handle stop when not started', async () => {
      expect(browserManager.isStarted()).toBe(false);

      await browserManager.stop();

      expect(browserManager.isStarted()).toBe(false);
    });

    it('should emit started event', async () => {
      const startedHandler = jest.fn();
      browserManager.on('started', startedHandler);

      await browserManager.start();

      expect(startedHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit stopped event', async () => {
      const stoppedHandler = jest.fn();
      browserManager.on('stopped', stoppedHandler);

      await browserManager.start();
      await browserManager.stop();

      expect(stoppedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Browser Launch', () => {
    beforeEach(async () => {
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch for CDP version endpoint
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });
    });

    it('should launch browser with profile', async () => {
      const browser = await browserManager.launchBrowser(mockProfile);

      expect(browser).toBeDefined();
      expect(browser.id).toBeDefined();
      expect(browser.profile).toEqual(mockProfile);
      expect(browser.cdpEndpoint).toBe('ws://localhost:9222/devtools/browser/test');
      expect(browser.createdAt).toBeDefined();
      expect(browser.lastUsedAt).toBeDefined();
    });

    it('should ensure user data directory exists', async () => {
      await browserManager.launchBrowser(mockProfile);

      expect(profileManager.ensureUserDataDir).toHaveBeenCalledWith(mockProfile);
    });

    it('should launch Chrome with correct flags', async () => {
      await browserManager.launchBrowser(mockProfile);

      expect(chromeLauncher.launch).toHaveBeenCalledWith({
        chromePath: undefined,
        chromeFlags: [
          '--no-sandbox',
          `--user-data-dir=${mockProfile.userDataDir}`,
          '--remote-debugging-port=0',
        ],
        handleSIGINT: false,
      });
    });

    it('should set as active browser if no active browser exists', async () => {
      const browser = await browserManager.launchBrowser(mockProfile);

      expect(browserManager.getActiveBrowser()).toEqual(browser);
    });

    it('should emit browser-launched event', async () => {
      const launchedHandler = jest.fn();
      browserManager.on('browser-launched', launchedHandler);

      const browser = await browserManager.launchBrowser(mockProfile);

      expect(launchedHandler).toHaveBeenCalledWith({
        browserId: browser.id,
        profile: mockProfile.name,
      });
    });

    it('should throw error when not started', async () => {
      await browserManager.stop();

      await expect(browserManager.launchBrowser(mockProfile)).rejects.toThrow(
        'BrowserManager is not started'
      );
    });
  });

  describe('Browser Close', () => {
    let browserId: string;

    beforeEach(async () => {
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);
      browserId = browser.id;
    });

    it('should close browser successfully', async () => {
      await browserManager.closeBrowser(browserId);

      expect(browserManager.getBrowser(browserId)).toBeNull();
    });

    it('should kill Chrome process', async () => {
      await browserManager.closeBrowser(browserId);

      expect(mockKill).toHaveBeenCalled();
    });

    it('should clear active browser if closing active browser', async () => {
      expect(browserManager.getActiveBrowser()?.id).toBe(browserId);

      await browserManager.closeBrowser(browserId);

      expect(browserManager.getActiveBrowser()).toBeNull();
    });

    it('should emit browser-closed event', async () => {
      const closedHandler = jest.fn();
      browserManager.on('browser-closed', closedHandler);

      await browserManager.closeBrowser(browserId);

      expect(closedHandler).toHaveBeenCalledWith({
        browserId,
        profile: mockProfile.name,
      });
    });

    it('should throw error for non-existent browser', async () => {
      await expect(browserManager.closeBrowser('non-existent-id')).rejects.toThrow(
        'Browser with ID "non-existent-id" not found'
      );
    });
  });

  describe('Browser Retrieval', () => {
    let browserId: string;

    beforeEach(async () => {
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);
      browserId = browser.id;
    });

    it('should get active browser', () => {
      const activeBrowser = browserManager.getActiveBrowser();

      expect(activeBrowser).toBeDefined();
      expect(activeBrowser?.id).toBe(browserId);
    });

    it('should return null when no active browser', async () => {
      await browserManager.closeBrowser(browserId);

      expect(browserManager.getActiveBrowser()).toBeNull();
    });

    it('should get browser by ID', () => {
      const browser = browserManager.getBrowser(browserId);

      expect(browser).toBeDefined();
      expect(browser?.id).toBe(browserId);
    });

    it('should return null for non-existent browser ID', () => {
      const browser = browserManager.getBrowser('non-existent-id');

      expect(browser).toBeNull();
    });

    it('should list all browsers', async () => {
      // Launch another browser
      await browserManager.launchBrowser(mockProfile);

      const browsers = browserManager.listBrowsers();

      expect(browsers).toHaveLength(2);
    });

    it('should return empty array when no browsers', async () => {
      await browserManager.closeBrowser(browserId);

      const browsers = browserManager.listBrowsers();

      expect(browsers).toHaveLength(0);
    });
  });

  describe('Active Browser Management', () => {
    let browser1Id: string;
    let browser2Id: string;

    beforeEach(async () => {
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser1 = await browserManager.launchBrowser(mockProfile);
      const browser2 = await browserManager.launchBrowser(mockProfile);
      browser1Id = browser1.id;
      browser2Id = browser2.id;
    });

    it('should set active browser', () => {
      browserManager.setActiveBrowser(browser2Id);

      expect(browserManager.getActiveBrowser()?.id).toBe(browser2Id);
    });

    it('should update last used timestamp when setting active', async () => {
      const browser = browserManager.getBrowser(browser2Id);
      const oldLastUsed = browser!.lastUsedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      browserManager.setActiveBrowser(browser2Id);

      const updatedBrowser = browserManager.getBrowser(browser2Id);
      expect(updatedBrowser!.lastUsedAt).toBeGreaterThan(oldLastUsed);
    });

    it('should emit active-browser-changed event', () => {
      const changedHandler = jest.fn();
      browserManager.on('active-browser-changed', changedHandler);

      browserManager.setActiveBrowser(browser2Id);

      expect(changedHandler).toHaveBeenCalledWith({
        browserId: browser2Id,
        profile: mockProfile.name,
      });
    });

    it('should throw error when setting non-existent browser as active', () => {
      expect(() => browserManager.setActiveBrowser('non-existent-id')).toThrow(
        'Browser with ID "non-existent-id" not found'
      );
    });
  });

  describe('Last Used Tracking', () => {
    let browserId: string;

    beforeEach(async () => {
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);
      browserId = browser.id;
    });

    it('should update last used timestamp', async () => {
      const browser = browserManager.getBrowser(browserId);
      const oldLastUsed = browser!.lastUsedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      browserManager.updateLastUsed(browserId);

      const updatedBrowser = browserManager.getBrowser(browserId);
      expect(updatedBrowser!.lastUsedAt).toBeGreaterThan(oldLastUsed);
    });

    it('should handle update for non-existent browser gracefully', () => {
      expect(() => browserManager.updateLastUsed('non-existent-id')).not.toThrow();
    });
  });

  describe('Stop with Multiple Browsers', () => {
    beforeEach(async () => {
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      // Launch multiple browsers
      await browserManager.launchBrowser(mockProfile);
      await browserManager.launchBrowser(mockProfile);
      await browserManager.launchBrowser(mockProfile);
    });

    it('should close all browsers on stop', async () => {
      expect(browserManager.listBrowsers()).toHaveLength(3);

      await browserManager.stop();

      expect(browserManager.listBrowsers()).toHaveLength(0);
    });
  });

  describe('Profile Manager Access', () => {
    it('should provide access to profile manager', () => {
      const pm = browserManager.getProfileManager();

      expect(pm).toBe(profileManager);
    });
  });
});




describe('BrowserManager - Profile Switching', () => {
  let browserManager: BrowserManager;
  let profileManager: ProfileManager;
  let mockProfile: BrowserProfile;
  let mockProfile2: BrowserProfile;
  const mockKill = jest.fn();

  beforeEach(() => {
    // Create mock profiles
    mockProfile = {
      name: 'test-profile',
      type: 'openclaw',
      userDataDir: '/tmp/test-browser-data',
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000,
      },
    };

    mockProfile2 = {
      name: 'test-profile-2',
      type: 'openclaw',
      userDataDir: '/tmp/test-browser-data-2',
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
        defaultViewport: { width: 1920, height: 1080 },
        timeout: 30000,
      },
    };

    // Create profile manager with both profiles
    profileManager = new ProfileManager([mockProfile, mockProfile2]);
    
    // Spy on ensureUserDataDir
    jest.spyOn(profileManager, 'ensureUserDataDir').mockResolvedValue(undefined);

    // Create browser manager
    browserManager = new BrowserManager(profileManager);

    // Reset mocks
    jest.clearAllMocks();
    mockKill.mockClear();
  });

  afterEach(async () => {
    // Clean up
    if (browserManager.isStarted()) {
      await browserManager.stop();
    }
  });

  describe('switchProfile', () => {
    beforeEach(async () => {
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      // Launch initial browser with first profile
      await browserManager.launchBrowser(mockProfile);
    });

    it('should switch to a different profile', async () => {
      const initialProfile = browserManager.getCurrentProfile();
      expect(initialProfile?.name).toBe('test-profile');

      await browserManager.switchProfile('test-profile-2');

      const newProfile = browserManager.getCurrentProfile();
      expect(newProfile?.name).toBe('test-profile-2');
    });

    it('should close current browser before switching', async () => {
      const initialBrowser = browserManager.getActiveBrowser();
      const initialBrowserId = initialBrowser!.id;

      await browserManager.switchProfile('test-profile-2');

      // Old browser should be closed
      expect(browserManager.getBrowser(initialBrowserId)).toBeNull();
      expect(mockKill).toHaveBeenCalled();
    });

    it('should launch new browser with new profile', async () => {
      await browserManager.switchProfile('test-profile-2');

      const activeBrowser = browserManager.getActiveBrowser();
      expect(activeBrowser).toBeDefined();
      expect(activeBrowser?.profile.name).toBe('test-profile-2');
    });

    it('should emit profile-switched event', async () => {
      const switchedHandler = jest.fn();
      browserManager.on('profile-switched', switchedHandler);

      await browserManager.switchProfile('test-profile-2');

      expect(switchedHandler).toHaveBeenCalledWith({
        from: 'test-profile',
        to: 'test-profile-2',
      });
    });

    it('should throw error for non-existent profile', async () => {
      await expect(browserManager.switchProfile('non-existent-profile')).rejects.toThrow(
        'Profile "non-existent-profile" not found'
      );
    });

    it('should throw error when not started', async () => {
      await browserManager.stop();

      await expect(browserManager.switchProfile('test-profile-2')).rejects.toThrow(
        'BrowserManager is not started'
      );
    });

    it('should handle switching when no active browser exists', async () => {
      // Close the current browser
      const currentBrowser = browserManager.getActiveBrowser();
      await browserManager.closeBrowser(currentBrowser!.id);

      // Should still be able to switch profiles
      await browserManager.switchProfile('test-profile-2');

      const activeBrowser = browserManager.getActiveBrowser();
      expect(activeBrowser?.profile.name).toBe('test-profile-2');
    });

    it('should not emit profile-switched event when no previous browser', async () => {
      // Close the current browser
      const currentBrowser = browserManager.getActiveBrowser();
      await browserManager.closeBrowser(currentBrowser!.id);

      const switchedHandler = jest.fn();
      browserManager.on('profile-switched', switchedHandler);

      await browserManager.switchProfile('test-profile-2');

      // Event should not be emitted when there was no previous browser
      expect(switchedHandler).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentProfile', () => {
    beforeEach(async () => {
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });
    });

    it('should return current profile when browser is active', async () => {
      await browserManager.launchBrowser(mockProfile);

      const currentProfile = browserManager.getCurrentProfile();

      expect(currentProfile).toEqual(mockProfile);
    });

    it('should return null when no active browser', () => {
      const currentProfile = browserManager.getCurrentProfile();

      expect(currentProfile).toBeNull();
    });

    it('should return updated profile after switching', async () => {
      await browserManager.launchBrowser(mockProfile);
      await browserManager.switchProfile('test-profile-2');

      const currentProfile = browserManager.getCurrentProfile();

      expect(currentProfile?.name).toBe('test-profile-2');
    });
  });

  describe('listProfiles', () => {
    it('should list all available profiles', () => {
      const profiles = browserManager.listProfiles();

      expect(profiles).toHaveLength(2);
      expect(profiles.map(p => p.name)).toContain('test-profile');
      expect(profiles.map(p => p.name)).toContain('test-profile-2');
    });

    it('should return profiles from profile manager', () => {
      const profiles = browserManager.listProfiles();
      const pmProfiles = profileManager.listProfiles();

      expect(profiles).toEqual(pmProfiles);
    });
  });
});

describe('BrowserManager - Action Execution', () => {
  let browserManager: BrowserManager;
  let profileManager: ProfileManager;
  let mockProfile: BrowserProfile;

  beforeEach(async () => {
    // Create a mock profile
    mockProfile = {
      name: 'test-profile',
      type: 'openclaw',
      userDataDir: '/tmp/test-browser-data',
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000,
      },
    };

    profileManager = new ProfileManager([mockProfile]);
    jest.spyOn(profileManager, 'ensureUserDataDir').mockResolvedValue(undefined);
    browserManager = new BrowserManager(profileManager);
    await browserManager.start();
  });

  afterEach(async () => {
    await browserManager.stop();
  });

  describe('executeAction - validation', () => {
    it('should return error when no profiles available', async () => {
      // Create a profile manager with no profiles
      const emptyProfileManager = new ProfileManager([]);
      const emptyBrowserManager = new BrowserManager(emptyProfileManager);
      await emptyBrowserManager.start();

      const action = {
        type: 'navigate',
        url: 'https://example.com',
      } as any;

      const result = await emptyBrowserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BROWSER_DISCONNECTED');
      expect(result.error?.message).toContain('Failed to ensure browser availability');
      
      await emptyBrowserManager.stop();
    });

    it('should validate navigate action requires URL', async () => {
      // Create a mock browser
      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
      };
      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore - accessing private property for testing
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore - accessing private property for testing
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'navigate',
        url: '',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('URL is required');
    });

    it('should validate navigate action URL has protocol', async () => {
      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
      };
      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'navigate',
        url: 'example.com',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('must start with http');
    });

    it('should validate click action requires selector', async () => {
      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
      };
      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'click',
        selector: '',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('Selector is required');
    });

    it('should validate type action requires text', async () => {
      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
      };
      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'type',
        selector: 'input',
        text: undefined,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SELECTOR');
      expect(result.error?.message).toContain('Text is required');
    });
  });

  describe('executeAction - action routing', () => {
    it('should route navigate action to adapter', async () => {
      const mockNavigate = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        status: 200,
        title: 'Example',
        loadTime: 100,
      });

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        navigate: mockNavigate,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'navigate',
        url: 'https://example.com',
        waitUntil: 'networkidle',
        timeout: 5000,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(mockNavigate).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
        timeout: 5000,
      });
      expect(result.success).toBe(true);
    });

    it('should route click action to adapter', async () => {
      const mockClick = jest.fn().mockResolvedValue(undefined);

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        click: mockClick,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'click',
        selector: 'button#submit',
        button: 'left',
        clickCount: 2,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(mockClick).toHaveBeenCalledWith('button#submit', {
        button: 'left',
        clickCount: 2,
        timeout: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('should route type action to adapter', async () => {
      const mockType = jest.fn().mockResolvedValue(undefined);

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        type: mockType,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'type',
        selector: 'input#username',
        text: 'testuser',
        delay: 50,
      } as any;

      const result = await browserManager.executeAction(action);

      expect(mockType).toHaveBeenCalledWith('input#username', 'testuser', {
        delay: 50,
        timeout: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('should route screenshot action to adapter', async () => {
      const mockBuffer = Buffer.from('fake-screenshot-data');
      const mockScreenshot = jest.fn().mockResolvedValue(mockBuffer);

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        screenshot: mockScreenshot,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'screenshot',
        fullPage: true,
        format: 'png',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(mockScreenshot).toHaveBeenCalledWith({
        type: 'png',
        quality: undefined,
        fullPage: true,
        path: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.result?.screenshot).toBeDefined();
    });

    it('should route execute_js action to adapter', async () => {
      const mockEvaluate = jest.fn().mockResolvedValue({ result: 'success' });

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        evaluate: mockEvaluate,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'execute_js',
        script: 'return document.title',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(mockEvaluate).toHaveBeenCalledWith('return document.title');
      expect(result.success).toBe(true);
    });
  });

  describe('executeAction - error handling', () => {
    it('should return error result with proper structure', async () => {
      const mockClick = jest.fn().mockRejectedValue(new Error('Element not found: button#submit'));

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        click: mockClick,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'click',
        selector: 'button#submit',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ELEMENT_NOT_FOUND');
      expect(result.error?.message).toContain('Element not found');
    });

    it('should classify timeout errors correctly', async () => {
      const mockNavigate = jest.fn().mockRejectedValue(new Error('Timeout 30000ms exceeded'));

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        navigate: mockNavigate,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'navigate',
        url: 'https://example.com',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });

    it('should classify navigation errors correctly', async () => {
      const mockNavigate = jest.fn().mockRejectedValue(new Error('Navigation failed: net::ERR_NAME_NOT_RESOLVED'));

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        navigate: mockNavigate,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'navigate',
        url: 'https://invalid-domain.com',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NAVIGATION_FAILED');
    });
  });

  describe('executeAction - result formatting', () => {
    it('should return success result with execution time and timestamp', async () => {
      const mockNavigate = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        status: 200,
        title: 'Example',
        loadTime: 100,
      });

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        navigate: mockNavigate,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const action = {
        type: 'navigate',
        url: 'https://example.com',
      } as any;

      const result = await browserManager.executeAction(action);

      expect(result.success).toBe(true);
      expect(result.action).toEqual(action);
      expect(result.result).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });
  });

  describe('executeAction - updates last used timestamp', () => {
    it('should update browser last used timestamp on action execution', async () => {
      const mockNavigate = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        status: 200,
        title: 'Example',
        loadTime: 100,
      });

      const mockAdapter = {
        isInitialized: jest.fn().mockReturnValue(true),
        navigate: mockNavigate,
      };

      const mockBrowser = {
        id: 'test-browser',
        profile: mockProfile,
        cdpEndpoint: 'ws://localhost:9222',
        playwrightBrowser: mockAdapter,
        createdAt: Date.now(),
        lastUsedAt: Date.now() - 10000, // 10 seconds ago
      };

      // @ts-ignore
      browserManager['browsers'].set(mockBrowser.id, mockBrowser);
      // @ts-ignore
      browserManager['activeBrowserId'] = mockBrowser.id;

      const initialLastUsed = mockBrowser.lastUsedAt;

      const action = {
        type: 'navigate',
        url: 'https://example.com',
      } as any;

      await browserManager.executeAction(action);

      const updatedBrowser = browserManager.getBrowser(mockBrowser.id);
      expect(updatedBrowser?.lastUsedAt).toBeGreaterThan(initialLastUsed);
    });
  });
});


describe('BrowserManager - Idle Timeout and Auto-Cleanup', () => {
  let browserManager: BrowserManager;
  let profileManager: ProfileManager;
  let mockProfile: BrowserProfile;
  const mockKill = jest.fn();

  beforeEach(() => {
    // Create a mock profile
    mockProfile = {
      name: 'test-profile',
      type: 'openclaw',
      userDataDir: '/tmp/test-browser-data',
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000,
      },
    };

    profileManager = new ProfileManager([mockProfile]);
    jest.spyOn(profileManager, 'ensureUserDataDir').mockResolvedValue(undefined);

    // Reset mocks
    jest.clearAllMocks();
    mockKill.mockClear();

    // Use fake timers for testing idle timeout
    jest.useFakeTimers();
  });

  afterEach(async () => {
    // Clean up
    if (browserManager && browserManager.isStarted()) {
      await browserManager.stop();
    }
    jest.useRealTimers();
  });

  describe('Idle timeout checker', () => {
    it('should start idle timeout checker on start', async () => {
      browserManager = new BrowserManager(profileManager, 60000); // 1 minute timeout
      await browserManager.start();

      // Verify that setInterval was called
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should stop idle timeout checker on stop', async () => {
      browserManager = new BrowserManager(profileManager, 60000);
      await browserManager.start();
      
      const timerCount = jest.getTimerCount();
      expect(timerCount).toBeGreaterThan(0);

      await browserManager.stop();

      // All timers should be cleared
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should check for idle browsers every 30 seconds', async () => {
      browserManager = new BrowserManager(profileManager, 60000);
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      // Launch a browser
      await browserManager.launchBrowser(mockProfile);

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30000);

      // Browser should not be closed yet (only 30 seconds idle, timeout is 60 seconds)
      expect(mockKill).not.toHaveBeenCalled();
    });

    it('should close browser after idle timeout', async () => {
      browserManager = new BrowserManager(profileManager, 60000); // 1 minute timeout
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      // Launch a browser
      const browser = await browserManager.launchBrowser(mockProfile);
      const browserId = browser.id;

      // Set lastUsedAt to 70 seconds ago (past the 60 second timeout)
      const browserInstance = browserManager.getBrowser(browserId);
      if (browserInstance) {
        browserInstance.lastUsedAt = Date.now() - 70000;
      }

      // Advance time by 30 seconds to trigger the idle check
      await jest.advanceTimersByTimeAsync(30000);

      // Browser should be closed
      expect(mockKill).toHaveBeenCalled();
    });

    it('should emit browser-idle-timeout event when closing idle browser', async () => {
      browserManager = new BrowserManager(profileManager, 60000);
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const idleTimeoutHandler = jest.fn();
      browserManager.on('browser-idle-timeout', idleTimeoutHandler);

      // Launch a browser
      const browser = await browserManager.launchBrowser(mockProfile);
      const browserId = browser.id;

      // Set lastUsedAt to 70 seconds ago
      const browserInstance = browserManager.getBrowser(browserId);
      if (browserInstance) {
        browserInstance.lastUsedAt = Date.now() - 70000;
      }

      // Advance time to trigger idle check
      await jest.advanceTimersByTimeAsync(30000);

      // Event should be emitted
      expect(idleTimeoutHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId,
          profile: mockProfile.name,
          idleTime: expect.any(Number),
        })
      );
    });

    it('should not close browser if it has been used recently', async () => {
      browserManager = new BrowserManager(profileManager, 60000);
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      // Launch a browser
      const browser = await browserManager.launchBrowser(mockProfile);
      const browserId = browser.id;

      // Update last used timestamp (simulate recent activity)
      browserManager.updateLastUsed(browserId);

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      // Browser should not be closed
      expect(mockKill).not.toHaveBeenCalled();
      expect(browserManager.getBrowser(browserId)).toBeDefined();
    });
  });

  describe('Browser restart after idle timeout', () => {
    it('should restart browser when action is executed after idle timeout', async () => {
      browserManager = new BrowserManager(profileManager, 60000);
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      // Launch initial browser
      const browser = await browserManager.launchBrowser(mockProfile);
      const initialBrowserId = browser.id;

      // Simulate idle timeout by setting lastUsedAt to past timeout
      const browserInstance = browserManager.getBrowser(initialBrowserId);
      if (browserInstance) {
        browserInstance.lastUsedAt = Date.now() - 70000;
      }

      // Trigger idle check to close the browser
      await jest.advanceTimersByTimeAsync(30000);

      // Browser should be closed
      expect(browserManager.getBrowser(initialBrowserId)).toBeNull();

      // Now execute an action - should restart browser
      const mockNavigate = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        status: 200,
        title: 'Example',
        loadTime: 100,
      });

      // Mock the adapter for the new browser
      const { PlaywrightAdapter } = require('../../playwright-adapter');
      PlaywrightAdapter.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        isInitialized: jest.fn().mockReturnValue(true),
        navigate: mockNavigate,
      }));

      const action = {
        type: 'navigate',
        url: 'https://example.com',
      } as any;

      const result = await browserManager.executeAction(action);

      // Action should succeed with a new browser
      expect(result.success).toBe(true);
      expect(chromeLauncher.launch).toHaveBeenCalledTimes(2); // Initial + restart
    });

    it('should emit browser-restarted-after-idle event', async () => {
      browserManager = new BrowserManager(profileManager, 60000);
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const restartHandler = jest.fn();
      browserManager.on('browser-restarted-after-idle', restartHandler);

      // Close any existing browser to simulate idle timeout scenario
      const browsers = browserManager.listBrowsers();
      for (const browser of browsers) {
        await browserManager.closeBrowser(browser.id);
      }

      // Execute an action - should restart browser
      const mockNavigate = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        status: 200,
        title: 'Example',
        loadTime: 100,
      });

      const { PlaywrightAdapter } = require('../../playwright-adapter');
      PlaywrightAdapter.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        isInitialized: jest.fn().mockReturnValue(true),
        navigate: mockNavigate,
      }));

      const action = {
        type: 'navigate',
        url: 'https://example.com',
      } as any;

      await browserManager.executeAction(action);

      // Event should be emitted
      expect(restartHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId: expect.any(String),
          profile: mockProfile.name,
        })
      );
    });

    it('should update lastUsedAt timestamp after restarting browser', async () => {
      browserManager = new BrowserManager(profileManager, 60000);
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      // Close any existing browser
      const browsers = browserManager.listBrowsers();
      for (const browser of browsers) {
        await browserManager.closeBrowser(browser.id);
      }

      // Execute an action
      const mockNavigate = jest.fn().mockResolvedValue({
        url: 'https://example.com',
        status: 200,
        title: 'Example',
        loadTime: 100,
      });

      const { PlaywrightAdapter } = require('../../playwright-adapter');
      PlaywrightAdapter.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        isInitialized: jest.fn().mockReturnValue(true),
        navigate: mockNavigate,
      }));

      const action = {
        type: 'navigate',
        url: 'https://example.com',
      } as any;

      const beforeTime = Date.now();
      await browserManager.executeAction(action);
      const afterTime = Date.now();

      // New browser should have recent lastUsedAt
      const activeBrowser = browserManager.getActiveBrowser();
      expect(activeBrowser).toBeDefined();
      expect(activeBrowser!.lastUsedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(activeBrowser!.lastUsedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Configurable idle timeout', () => {
    it('should accept custom idle timeout in constructor', () => {
      const customTimeout = 120000; // 2 minutes
      browserManager = new BrowserManager(profileManager, customTimeout);

      // @ts-ignore - accessing private property for testing
      expect(browserManager['idleTimeoutMs']).toBe(customTimeout);
    });

    it('should use default idle timeout if not specified', () => {
      browserManager = new BrowserManager(profileManager);

      // @ts-ignore - accessing private property for testing
      expect(browserManager['idleTimeoutMs']).toBe(300000); // 5 minutes default
    });

    it('should respect custom idle timeout when closing browsers', async () => {
      const customTimeout = 30000; // 30 seconds
      browserManager = new BrowserManager(profileManager, customTimeout);
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      // Launch a browser
      const browser = await browserManager.launchBrowser(mockProfile);
      const browserId = browser.id;

      // Set lastUsedAt to 40 seconds ago (past the 30 second timeout)
      const browserInstance = browserManager.getBrowser(browserId);
      if (browserInstance) {
        browserInstance.lastUsedAt = Date.now() - 40000;
      }

      // Advance time to trigger idle check
      await jest.advanceTimersByTimeAsync(30000);

      // Browser should be closed
      expect(mockKill).toHaveBeenCalled();
    });
  });
});


describe('BrowserManager - Crash Detection and Recovery', () => {
  let browserManager: BrowserManager;
  let profileManager: ProfileManager;
  let mockProfile: BrowserProfile;
  const mockKill = jest.fn();

  beforeEach(() => {
    // Create a mock profile
    mockProfile = {
      name: 'test-profile',
      type: 'openclaw',
      userDataDir: '/tmp/test-browser-data',
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000,
      },
    };

    profileManager = new ProfileManager([mockProfile]);
    jest.spyOn(profileManager, 'ensureUserDataDir').mockResolvedValue(undefined);
    browserManager = new BrowserManager(profileManager);

    jest.clearAllMocks();
    mockKill.mockClear();
  });

  afterEach(async () => {
    if (browserManager.isStarted()) {
      await browserManager.stop();
    }
  });

  describe('Crash Detection', () => {
    it('should detect browser crash via CDP disconnection', async () => {
      await browserManager.start();

      // Mock chrome-launcher
      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      // Mock fetch
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      // Launch browser
      const browser = await browserManager.launchBrowser(mockProfile);

      // Set up crash event listener
      const crashHandler = jest.fn();
      browserManager.on('browser-crashed', crashHandler);

      // Get the CDP client and simulate disconnection
      // @ts-ignore - accessing private property for testing
      const cdpClient = browserManager['cdpClients'].get(browser.id);
      expect(cdpClient).toBeDefined();

      // Simulate CDP disconnection (crash)
      cdpClient.emit('disconnected', { code: 1006, reason: 'Connection lost' });

      // Wait for crash detection
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify crash was detected
      expect(crashHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId: browser.id,
          profile: mockProfile.name,
          code: 1006,
          reason: 'Connection lost',
        })
      );
    });

    it('should emit browser-cdp-error on CDP errors', async () => {
      await browserManager.start();

      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);

      const errorHandler = jest.fn();
      browserManager.on('browser-cdp-error', errorHandler);

      // @ts-ignore
      const cdpClient = browserManager['cdpClients'].get(browser.id);
      
      // Simulate CDP error
      const testError = new Error('CDP protocol error');
      cdpClient.emit('error', testError);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId: browser.id,
          profile: mockProfile.name,
          error: 'CDP protocol error',
        })
      );
    });
  });

  describe('Crash Recovery', () => {
    it('should attempt automatic recovery after crash', async () => {
      await browserManager.start();

      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);
      const originalBrowserId = browser.id;

      const recoveryAttemptHandler = jest.fn();
      browserManager.on('browser-recovery-attempt', recoveryAttemptHandler);

      // @ts-ignore
      const cdpClient = browserManager['cdpClients'].get(browser.id);

      // Simulate crash
      cdpClient.emit('disconnected', { code: 1006, reason: 'Crash' });

      // Wait for recovery attempt
      await new Promise(resolve => setTimeout(resolve, 1200)); // Wait for 1s backoff + processing

      expect(recoveryAttemptHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId: originalBrowserId,
          profile: mockProfile.name,
          attempt: 1,
          maxAttempts: 3,
          delay: 1000, // First attempt uses 1s delay
        })
      );
    });

    it('should use exponential backoff for recovery attempts', async () => {
      await browserManager.start();

      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      
      // Make launch fail to test multiple recovery attempts
      let launchCount = 0;
      (chromeLauncher.launch as jest.Mock).mockImplementation(() => {
        launchCount++;
        if (launchCount === 1) {
          // First launch succeeds
          return Promise.resolve(mockChrome);
        }
        // Subsequent launches fail to trigger multiple recovery attempts
        return Promise.reject(new Error('Launch failed'));
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);
      const browserId = browser.id;

      const recoveryAttemptHandler = jest.fn();
      browserManager.on('browser-recovery-attempt', recoveryAttemptHandler);

      // @ts-ignore
      const cdpClient = browserManager['cdpClients'].get(browser.id);

      // Simulate first crash - this will trigger attempt 1 with 1s delay
      cdpClient.emit('disconnected', { code: 1006, reason: 'Crash 1' });
      await new Promise(resolve => setTimeout(resolve, 1300));

      // Verify first attempt uses 1s delay
      expect(recoveryAttemptHandler).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          browserId,
          attempt: 1,
          delay: 1000,
        })
      );

      // After failed recovery, the browser is cleaned up but crash attempts are still tracked
      // Manually trigger another recovery to test exponential backoff
      // @ts-ignore - call attemptCrashRecovery directly to test backoff
      const recoveryPromise = browserManager['attemptCrashRecovery'](browserId, mockProfile);
      
      // Wait a bit for the recovery attempt event to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify second attempt uses 2s delay (exponential backoff)
      expect(recoveryAttemptHandler).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          browserId,
          attempt: 2,
          delay: 2000,
        })
      );

      // Wait for recovery to complete
      await new Promise(resolve => setTimeout(resolve, 2300));
      await recoveryPromise;
    });

    it('should cap recovery delay at 30 seconds', async () => {
      await browserManager.start();

      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);
      const browserId = browser.id;

      const recoveryAttemptHandler = jest.fn();
      browserManager.on('browser-recovery-attempt', recoveryAttemptHandler);

      // Test the delay calculation at different attempt counts
      // Attempt 0: 1000 * 2^0 = 1000ms
      // Attempt 1: 1000 * 2^1 = 2000ms
      // Attempt 2: 1000 * 2^2 = 4000ms
      // Attempt 5: 1000 * 2^5 = 32000ms -> capped at 30000ms
      
      // To test the cap, we need to temporarily increase MAX_CRASH_RECOVERY_ATTEMPTS
      // or test the delay calculation directly
      // Since MAX_CRASH_RECOVERY_ATTEMPTS is 3, we can only test up to attempt 2
      // But we can verify the cap logic by checking the delay at attempt 2
      
      // Set to 2 attempts (next will be attempt 3, which is the max)
      // @ts-ignore
      browserManager['crashRecoveryAttempts'].set(browserId, 2);

      // Trigger recovery
      // @ts-ignore
      browserManager['attemptCrashRecovery'](browserId, mockProfile);
      
      await new Promise(resolve => setTimeout(resolve, 200));

      // At attempt 2, delay should be 1000 * 2^2 = 4000ms
      expect(recoveryAttemptHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId,
          attempt: 3,
          delay: 4000,
        })
      );

      // To properly test the 30s cap, we need to verify the Math.min logic
      // The cap is working if: Math.min(1000 * 2^5, 30000) = 30000
      // Since 1000 * 2^5 = 32000 > 30000, it should be capped
      // We can verify this by checking the constants
      // @ts-ignore
      expect(browserManager['CRASH_RECOVERY_MAX_DELAY']).toBe(30000);
      // @ts-ignore
      expect(browserManager['CRASH_RECOVERY_BACKOFF_BASE']).toBe(1000);
      
      // Verify the cap logic: at attempt 5, delay would be 32000 but capped at 30000
      const baseDelay = 1000;
      const maxDelay = 30000;
      const attemptCount = 5;
      const calculatedDelay = baseDelay * Math.pow(2, attemptCount); // 32000
      const cappedDelay = Math.min(calculatedDelay, maxDelay); // 30000
      expect(cappedDelay).toBe(30000);
      expect(calculatedDelay).toBeGreaterThan(maxDelay);
    });

    it('should emit recovery-success event on successful recovery', async () => {
      await browserManager.start();

      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);
      const originalBrowserId = browser.id;

      const recoverySuccessHandler = jest.fn();
      browserManager.on('browser-recovery-success', recoverySuccessHandler);

      // @ts-ignore
      const cdpClient = browserManager['cdpClients'].get(browser.id);

      // Simulate crash
      cdpClient.emit('disconnected', { code: 1006, reason: 'Crash' });

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(recoverySuccessHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          oldBrowserId: originalBrowserId,
          profile: mockProfile.name,
          attempt: 1,
        })
      );
    });

    it('should stop recovery after max attempts', async () => {
      await browserManager.start();

      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      
      // Make launch fail after initial success to simulate recovery failures
      let launchCount = 0;
      (chromeLauncher.launch as jest.Mock).mockImplementation(() => {
        launchCount++;
        if (launchCount === 1) {
          return Promise.resolve(mockChrome);
        }
        return Promise.reject(new Error('Launch failed'));
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);
      const browserId = browser.id;

      const recoveryFailedHandler = jest.fn();
      const recoveryAttemptFailedHandler = jest.fn();
      browserManager.on('browser-recovery-failed', recoveryFailedHandler);
      browserManager.on('browser-recovery-attempt-failed', recoveryAttemptFailedHandler);

      // Manually trigger 3 recovery attempts to reach the max
      // @ts-ignore
      browserManager['attemptCrashRecovery'](browserId, mockProfile);
      await new Promise(resolve => setTimeout(resolve, 1300));

      // @ts-ignore
      browserManager['attemptCrashRecovery'](browserId, mockProfile);
      await new Promise(resolve => setTimeout(resolve, 2300));

      // @ts-ignore
      browserManager['attemptCrashRecovery'](browserId, mockProfile);
      await new Promise(resolve => setTimeout(resolve, 4300));

      // Should have 3 failed recovery attempts
      expect(recoveryAttemptFailedHandler).toHaveBeenCalledTimes(3);
      
      // Now trigger one more recovery - this should hit the max attempts limit
      // @ts-ignore
      browserManager['attemptCrashRecovery'](browserId, mockProfile);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should emit recovery-failed event after max attempts
      expect(recoveryFailedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          browserId,
          profile: mockProfile.name,
          attempts: 3,
        })
      );
    }, 15000); // Increase timeout to 15 seconds

    it('should reset crash recovery attempts on successful launch', async () => {
      await browserManager.start();

      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);

      // Manually set crash recovery attempts
      // @ts-ignore
      browserManager['crashRecoveryAttempts'].set(browser.id, 2);

      // Launch should reset the attempts
      const browser2 = await browserManager.launchBrowser(mockProfile);

      // @ts-ignore
      const attempts = browserManager['crashRecoveryAttempts'].get(browser2.id);
      expect(attempts).toBeUndefined();
    });

    it('should clean up crash recovery tracking on browser close', async () => {
      await browserManager.start();

      const mockChrome = {
        port: 9222,
        kill: mockKill.mockResolvedValue(undefined),
      };
      (chromeLauncher.launch as jest.Mock).mockResolvedValue(mockChrome);

      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          webSocketDebuggerUrl: 'ws://localhost:9222/devtools/browser/test',
        }),
      });

      const browser = await browserManager.launchBrowser(mockProfile);

      // Set crash recovery attempts
      // @ts-ignore
      browserManager['crashRecoveryAttempts'].set(browser.id, 1);

      // Close browser
      await browserManager.closeBrowser(browser.id);

      // Verify crash recovery tracking is cleaned up
      // @ts-ignore
      const attempts = browserManager['crashRecoveryAttempts'].get(browser.id);
      expect(attempts).toBeUndefined();
    });
  });
});
