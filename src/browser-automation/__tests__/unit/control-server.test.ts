/**
 * Unit tests for ControlServer
 * 
 * Tests loopback-only binding, health check endpoint, browser control endpoints, and request logging.
 */

import { ControlServer } from '../../control-server';

// Mock BrowserManager to avoid chrome-launcher import issues
const mockBrowserManager = {
  isStarted: jest.fn().mockReturnValue(true),
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  launchBrowser: jest.fn(),
  closeBrowser: jest.fn(),
  getBrowser: jest.fn(),
  getActiveBrowser: jest.fn(),
  executeAction: jest.fn(),
  getProfileManager: jest.fn().mockReturnValue({
    getProfile: jest.fn()
  }),
  cdpClients: new Map()
};

describe('ControlServer', () => {
  let server: ControlServer;

  beforeEach(() => {
    server = new ControlServer();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (server.isRunning()) {
      await server.stop();
    }
  });

  describe('Lifecycle', () => {
    it('should start on loopback address', async () => {
      await server.start(18791);
      
      expect(server.isRunning()).toBe(true);
      expect(server.getPort()).toBe(18791);
      expect(server.getAddress()).toBe('127.0.0.1');
    });

    it('should stop gracefully', async () => {
      await server.start(18792);
      expect(server.isRunning()).toBe(true);
      
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should throw error if already running', async () => {
      await server.start(18793);
      
      await expect(server.start(18793)).rejects.toThrow(
        'Control server is already running'
      );
    });

    it('should handle port already in use', async () => {
      const server2 = new ControlServer();
      
      await server.start(18794);
      
      await expect(server2.start(18794)).rejects.toThrow(
        'Port 18794 is already in use'
      );
      
      await server2.stop();
    });
  });

  describe('Health Check Endpoint', () => {
    it('should respond to health check', async () => {
      await server.start(18795);
      
      const response = await fetch('http://127.0.0.1:18795/health');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeGreaterThan(0);
      expect(data.server.host).toBe('127.0.0.1');
      expect(data.server.port).toBe(18795);
      expect(data.server.running).toBe(true);
    });
  });

  describe('Loopback-Only Binding', () => {
    it('should bind to 127.0.0.1', async () => {
      await server.start(18796);
      
      expect(server.getAddress()).toBe('127.0.0.1');
      
      // Verify we can connect via loopback
      const response = await fetch('http://127.0.0.1:18796/health');
      expect(response.status).toBe(200);
    });

    it('should not be accessible from external addresses', async () => {
      await server.start(18797);
      
      // This test verifies the server is bound to loopback only
      // In a real environment, attempting to connect from a non-loopback
      // address would fail. We verify the binding address is correct.
      expect(server.getAddress()).toBe('127.0.0.1');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      await server.start(18798);
      
      const response = await fetch('http://127.0.0.1:18798/unknown');
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('not found');
    });
  });

  describe('Request Logging', () => {
    it('should log incoming requests', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await server.start(18799);
      await fetch('http://127.0.0.1:18799/health');
      
      // Verify request was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET /health')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Browser Control Endpoints', () => {
    beforeEach(() => {
      server.setBrowserManager(mockBrowserManager as any);
    });

    describe('POST /browser/launch', () => {
      it('should return error when browser manager is not initialized', async () => {
        const serverWithoutManager = new ControlServer();
        await serverWithoutManager.start(18800);

        const response = await fetch('http://127.0.0.1:18800/browser/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileName: 'openclaw' })
        });

        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SERVICE_UNAVAILABLE');

        await serverWithoutManager.stop();
      });

      it('should return error when profileName is missing', async () => {
        await server.start(18801);

        const response = await fetch('http://127.0.0.1:18801/browser/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INVALID_PARAMETER');
      });

      it('should return error when profile does not exist', async () => {
        mockBrowserManager.getProfileManager().getProfile.mockReturnValue(null);
        await server.start(18802);

        const response = await fetch('http://127.0.0.1:18802/browser/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileName: 'nonexistent' })
        });

        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('PROFILE_NOT_FOUND');
      });

      it('should launch browser successfully', async () => {
        const mockProfile = {
          name: 'openclaw',
          type: 'openclaw',
          userDataDir: '/tmp/test',
          launchOptions: {
            headless: true,
            args: [],
            defaultViewport: { width: 1280, height: 720 },
            timeout: 30000
          }
        };

        const mockBrowser = {
          id: 'test-browser-id',
          profile: mockProfile,
          cdpEndpoint: 'ws://localhost:9222',
          playwrightBrowser: {},
          createdAt: Date.now(),
          lastUsedAt: Date.now()
        };

        mockBrowserManager.getProfileManager().getProfile.mockReturnValue(mockProfile);
        mockBrowserManager.launchBrowser.mockResolvedValue(mockBrowser);

        await server.start(18803);

        const response = await fetch('http://127.0.0.1:18803/browser/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileName: 'openclaw' })
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.browserId).toBe('test-browser-id');
        expect(data.data.profile).toBe('openclaw');
      });
    });

    describe('POST /browser/close', () => {
      it('should return error when browser manager is not initialized', async () => {
        const serverWithoutManager = new ControlServer();
        await serverWithoutManager.start(18804);

        const response = await fetch('http://127.0.0.1:18804/browser/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ browserId: 'test-id' })
        });

        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SERVICE_UNAVAILABLE');

        await serverWithoutManager.stop();
      });

      it('should return error when browserId is missing', async () => {
        await server.start(18805);

        const response = await fetch('http://127.0.0.1:18805/browser/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INVALID_PARAMETER');
      });

      it('should return error when browser does not exist', async () => {
        mockBrowserManager.getBrowser.mockReturnValue(null);
        await server.start(18806);

        const response = await fetch('http://127.0.0.1:18806/browser/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ browserId: 'nonexistent-id' })
        });

        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('BROWSER_NOT_FOUND');
      });

      it('should close browser successfully', async () => {
        const mockBrowser = {
          id: 'test-browser-id',
          profile: { name: 'openclaw' },
          cdpEndpoint: 'ws://localhost:9222',
          playwrightBrowser: {},
          createdAt: Date.now(),
          lastUsedAt: Date.now()
        };

        mockBrowserManager.getBrowser.mockReturnValue(mockBrowser);
        mockBrowserManager.closeBrowser.mockResolvedValue(undefined);

        await server.start(18807);

        const response = await fetch('http://127.0.0.1:18807/browser/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ browserId: 'test-browser-id' })
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.browserId).toBe('test-browser-id');
        expect(mockBrowserManager.closeBrowser).toHaveBeenCalledWith('test-browser-id');
      });
    });

    describe('POST /browser/action', () => {
      it('should return error when browser manager is not initialized', async () => {
        const serverWithoutManager = new ControlServer();
        await serverWithoutManager.start(18808);

        const action = {
          type: 'navigate',
          url: 'https://example.com'
        };

        const response = await fetch('http://127.0.0.1:18808/browser/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });

        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SERVICE_UNAVAILABLE');

        await serverWithoutManager.stop();
      });

      it('should return error when action is missing', async () => {
        await server.start(18809);

        const response = await fetch('http://127.0.0.1:18809/browser/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INVALID_PARAMETER');
      });

      it('should return error when action type is missing', async () => {
        await server.start(18810);

        const response = await fetch('http://127.0.0.1:18810/browser/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://example.com' })
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INVALID_PARAMETER');
      });

      it('should execute action successfully', async () => {
        const action = {
          type: 'navigate',
          url: 'https://example.com'
        };

        const mockResult = {
          success: true,
          action,
          result: { url: 'https://example.com', status: 200, title: 'Example', loadTime: 100 },
          executionTime: 100,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18811);

        const response = await fetch('http://127.0.0.1:18811/browser/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.success).toBe(true);
        expect(mockBrowserManager.executeAction).toHaveBeenCalledWith(action);
      });

      it('should return error when action fails', async () => {
        const action = {
          type: 'click',
          selector: '#nonexistent'
        };

        const mockResult = {
          success: false,
          action,
          error: {
            code: 'ELEMENT_NOT_FOUND',
            message: 'Element not found: #nonexistent'
          },
          executionTime: 50,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18812);

        const response = await fetch('http://127.0.0.1:18812/browser/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('ELEMENT_NOT_FOUND');
      });
    });

    describe('GET /browser/state', () => {
      it('should return error when browser manager is not initialized', async () => {
        const serverWithoutManager = new ControlServer();
        await serverWithoutManager.start(18813);

        const response = await fetch('http://127.0.0.1:18813/browser/state');
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SERVICE_UNAVAILABLE');

        await serverWithoutManager.stop();
      });

      it('should return error when no active browser', async () => {
        mockBrowserManager.getActiveBrowser.mockReturnValue(null);
        await server.start(18814);

        const response = await fetch('http://127.0.0.1:18814/browser/state');
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('NO_ACTIVE_BROWSER');
      });
    });

    describe('POST /browser/state', () => {
      it('should return error when browser manager is not initialized', async () => {
        const serverWithoutManager = new ControlServer();
        await serverWithoutManager.start(18815);

        const state = {
          cookies: [],
          localStorage: {},
          sessionStorage: {},
          version: '1.0.0'
        };

        const response = await fetch('http://127.0.0.1:18815/browser/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });

        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SERVICE_UNAVAILABLE');

        await serverWithoutManager.stop();
      });

      it('should return error when state is missing', async () => {
        await server.start(18816);

        const response = await fetch('http://127.0.0.1:18816/browser/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INVALID_PARAMETER');
      });

      it('should return error when no active browser', async () => {
        mockBrowserManager.getActiveBrowser.mockReturnValue(null);
        await server.start(18817);

        const state = {
          cookies: [],
          localStorage: {},
          sessionStorage: {},
          version: '1.0.0'
        };

        const response = await fetch('http://127.0.0.1:18817/browser/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });

        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('NO_ACTIVE_BROWSER');
      });
    });
  });

  describe('Capture Endpoints', () => {
    beforeEach(() => {
      server.setBrowserManager(mockBrowserManager as any);
    });

    describe('GET /browser/screenshot', () => {
      it('should return error when browser manager is not initialized', async () => {
        const serverWithoutManager = new ControlServer();
        await serverWithoutManager.start(18818);

        const response = await fetch('http://127.0.0.1:18818/browser/screenshot');
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SERVICE_UNAVAILABLE');

        await serverWithoutManager.stop();
      });

      it('should take screenshot successfully', async () => {
        const mockResult = {
          success: true,
          action: { type: 'screenshot', fullPage: false, format: 'png' },
          result: {
            screenshot: 'base64encodedimage',
            format: 'png'
          },
          executionTime: 100,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18819);

        const response = await fetch('http://127.0.0.1:18819/browser/screenshot');
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.screenshot).toBe('base64encodedimage');
        expect(data.data.format).toBe('png');
      });

      it('should take full page screenshot with query parameters', async () => {
        const mockResult = {
          success: true,
          action: { type: 'screenshot', fullPage: true, format: 'jpeg', quality: 80 },
          result: {
            screenshot: 'base64encodedimage',
            format: 'jpeg'
          },
          executionTime: 150,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18820);

        const response = await fetch('http://127.0.0.1:18820/browser/screenshot?fullPage=true&format=jpeg&quality=80');
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockBrowserManager.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'screenshot',
            fullPage: true,
            format: 'jpeg',
            quality: 80
          })
        );
      });

      it('should return error when screenshot fails', async () => {
        const mockResult = {
          success: false,
          action: { type: 'screenshot' },
          error: {
            code: 'SCREENSHOT_FAILED',
            message: 'Failed to capture screenshot'
          },
          executionTime: 50,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18821);

        const response = await fetch('http://127.0.0.1:18821/browser/screenshot');
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SCREENSHOT_FAILED');
      });
    });

    describe('GET /browser/snapshot', () => {
      it('should return error when browser manager is not initialized', async () => {
        const serverWithoutManager = new ControlServer();
        await serverWithoutManager.start(18822);

        const response = await fetch('http://127.0.0.1:18822/browser/snapshot');
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SERVICE_UNAVAILABLE');

        await serverWithoutManager.stop();
      });

      it('should capture snapshot successfully', async () => {
        const mockResult = {
          success: true,
          action: { type: 'snapshot', includeIframes: false },
          result: {
            url: 'https://example.com',
            title: 'Example',
            html: '<html>...</html>',
            accessibilityTree: [],
            viewport: { width: 1280, height: 720 },
            timestamp: Date.now()
          },
          executionTime: 200,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18823);

        const response = await fetch('http://127.0.0.1:18823/browser/snapshot');
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.url).toBe('https://example.com');
        expect(data.data.title).toBe('Example');
      });

      it('should capture snapshot with iframes', async () => {
        const mockResult = {
          success: true,
          action: { type: 'snapshot', includeIframes: true },
          result: {
            url: 'https://example.com',
            title: 'Example',
            html: '<html>...</html>',
            accessibilityTree: [],
            viewport: { width: 1280, height: 720 },
            timestamp: Date.now()
          },
          executionTime: 250,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18824);

        const response = await fetch('http://127.0.0.1:18824/browser/snapshot?includeIframes=true');
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockBrowserManager.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'snapshot',
            includeIframes: true
          })
        );
      });

      it('should return error when snapshot fails', async () => {
        const mockResult = {
          success: false,
          action: { type: 'snapshot' },
          error: {
            code: 'SNAPSHOT_FAILED',
            message: 'Failed to capture snapshot'
          },
          executionTime: 50,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18825);

        const response = await fetch('http://127.0.0.1:18825/browser/snapshot');
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SNAPSHOT_FAILED');
      });
    });

    describe('POST /browser/pdf', () => {
      it('should return error when browser manager is not initialized', async () => {
        const serverWithoutManager = new ControlServer();
        await serverWithoutManager.start(18826);

        const response = await fetch('http://127.0.0.1:18826/browser/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('SERVICE_UNAVAILABLE');

        await serverWithoutManager.stop();
      });

      it('should generate PDF successfully', async () => {
        const mockResult = {
          success: true,
          action: { type: 'pdf' },
          result: {
            pdf: 'base64encodedpdf'
          },
          executionTime: 300,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18827);

        const response = await fetch('http://127.0.0.1:18827/browser/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.pdf).toBe('base64encodedpdf');
      });

      it('should generate PDF with options', async () => {
        const pdfOptions = {
          format: 'A4',
          width: '210mm',
          height: '297mm',
          margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
          printBackground: true
        };

        const mockResult = {
          success: true,
          action: { type: 'pdf', ...pdfOptions },
          result: {
            pdf: 'base64encodedpdf'
          },
          executionTime: 350,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18828);

        const response = await fetch('http://127.0.0.1:18828/browser/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pdfOptions)
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockBrowserManager.executeAction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'pdf',
            format: 'A4',
            printBackground: true
          })
        );
      });

      it('should return error when PDF generation fails', async () => {
        const mockResult = {
          success: false,
          action: { type: 'pdf' },
          error: {
            code: 'PDF_GENERATION_FAILED',
            message: 'Failed to generate PDF'
          },
          executionTime: 50,
          timestamp: Date.now()
        };

        mockBrowserManager.executeAction.mockResolvedValue(mockResult);

        await server.start(18829);

        const response = await fetch('http://127.0.0.1:18829/browser/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('PDF_GENERATION_FAILED');
      });
    });
  });
});
