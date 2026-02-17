/**
 * State Manager Unit Tests
 * 
 * Tests for cookie management functionality via CDP.
 */

import { StateManager } from '../../state-manager';
import { CDPClient } from '../../cdp-client';
import { Cookie } from '../../types/index';

describe('StateManager', () => {
  let cdpClient: CDPClient;
  let stateManager: StateManager;

  beforeEach(() => {
    cdpClient = new CDPClient();
    stateManager = new StateManager(cdpClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCookies', () => {
    it('should retrieve all cookies when no domain is specified', async () => {
      // Mock CDP client
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        cookies: [
          {
            name: 'session',
            value: 'abc123',
            domain: 'example.com',
            path: '/',
            expires: 1234567890,
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
          },
          {
            name: 'token',
            value: 'xyz789',
            domain: 'test.com',
            path: '/api',
            expires: 9876543210,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
          },
        ],
      });

      const cookies = await stateManager.getCookies();

      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toEqual({
        name: 'session',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        expires: 1234567890,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      });
      expect(cookies[1]).toEqual({
        name: 'token',
        value: 'xyz789',
        domain: 'test.com',
        path: '/api',
        expires: 9876543210,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      });
      expect(cdpClient.sendCommand).toHaveBeenCalledWith('Network.getAllCookies');
    });

    it('should filter cookies by domain when domain is specified', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        cookies: [
          {
            name: 'session',
            value: 'abc123',
            domain: 'example.com',
            path: '/',
            expires: 1234567890,
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
          },
          {
            name: 'token',
            value: 'xyz789',
            domain: 'test.com',
            path: '/api',
            expires: 9876543210,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
          },
        ],
      });

      const cookies = await stateManager.getCookies('example.com');

      expect(cookies).toHaveLength(1);
      expect(cookies[0].domain).toBe('example.com');
    });

    it('should handle cookies with missing optional fields', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        cookies: [
          {
            name: 'basic',
            value: 'value',
            domain: 'example.com',
            path: '/',
          },
        ],
      });

      const cookies = await stateManager.getCookies();

      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toEqual({
        name: 'basic',
        value: 'value',
        domain: 'example.com',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'None',
      });
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.getCookies()).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Network error'));

      await expect(stateManager.getCookies()).rejects.toThrow('Failed to get cookies');
    });
  });

  describe('setCookies', () => {
    it('should set multiple cookies via CDP', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const cookies: Cookie[] = [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          expires: 1234567890,
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
        },
        {
          name: 'token',
          value: 'xyz789',
          domain: 'test.com',
          path: '/api',
          expires: 9876543210,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ];

      await stateManager.setCookies(cookies);

      expect(sendCommandSpy).toHaveBeenCalledTimes(2);
      expect(sendCommandSpy).toHaveBeenNthCalledWith(1, 'Network.setCookie', {
        name: 'session',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        expires: 1234567890,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      });
      expect(sendCommandSpy).toHaveBeenNthCalledWith(2, 'Network.setCookie', {
        name: 'token',
        value: 'xyz789',
        domain: 'test.com',
        path: '/api',
        expires: 9876543210,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      });
    });

    it('should handle cookies with expires = -1 (session cookies)', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const cookies: Cookie[] = [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
        },
      ];

      await stateManager.setCookies(cookies);

      expect(sendCommandSpy).toHaveBeenCalledWith('Network.setCookie', {
        name: 'session',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        expires: undefined, // -1 should be converted to undefined
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      });
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.setCookies([])).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Network error'));

      const cookies: Cookie[] = [
        {
          name: 'test',
          value: 'value',
          domain: 'example.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: 'None',
        },
      ];

      await expect(stateManager.setCookies(cookies)).rejects.toThrow('Failed to set cookies');
    });
  });

  describe('deleteCookies', () => {
    it('should delete cookies matching name filter', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      
      // Mock getCookies to return test cookies
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand')
        .mockResolvedValueOnce({
          cookies: [
            {
              name: 'session',
              value: 'abc123',
              domain: 'example.com',
              path: '/',
            },
            {
              name: 'token',
              value: 'xyz789',
              domain: 'example.com',
              path: '/',
            },
          ],
        })
        .mockResolvedValue({ success: true });

      await stateManager.deleteCookies({ name: 'session' });

      expect(sendCommandSpy).toHaveBeenCalledWith('Network.getAllCookies');
      expect(sendCommandSpy).toHaveBeenCalledWith('Network.deleteCookies', {
        name: 'session',
        domain: 'example.com',
        path: '/',
      });
      expect(sendCommandSpy).toHaveBeenCalledTimes(2); // getAllCookies + 1 delete
    });

    it('should delete cookies matching domain filter', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand')
        .mockResolvedValueOnce({
          cookies: [
            {
              name: 'session',
              value: 'abc123',
              domain: 'example.com',
              path: '/',
            },
            {
              name: 'token',
              value: 'xyz789',
              domain: 'test.com',
              path: '/',
            },
          ],
        })
        .mockResolvedValue({ success: true });

      await stateManager.deleteCookies({ domain: 'example.com' });

      expect(sendCommandSpy).toHaveBeenCalledWith('Network.deleteCookies', {
        name: 'session',
        domain: 'example.com',
        path: '/',
      });
      expect(sendCommandSpy).toHaveBeenCalledTimes(2); // getAllCookies + 1 delete
    });

    it('should delete cookies matching multiple filters', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand')
        .mockResolvedValueOnce({
          cookies: [
            {
              name: 'session',
              value: 'abc123',
              domain: 'example.com',
              path: '/',
            },
            {
              name: 'session',
              value: 'xyz789',
              domain: 'example.com',
              path: '/api',
            },
            {
              name: 'token',
              value: 'def456',
              domain: 'example.com',
              path: '/',
            },
          ],
        })
        .mockResolvedValue({ success: true });

      await stateManager.deleteCookies({ name: 'session', path: '/' });

      expect(sendCommandSpy).toHaveBeenCalledWith('Network.deleteCookies', {
        name: 'session',
        domain: 'example.com',
        path: '/',
      });
      expect(sendCommandSpy).toHaveBeenCalledTimes(2); // getAllCookies + 1 delete (only one matches all filters)
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.deleteCookies({ name: 'test' })).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Network error'));

      await expect(stateManager.deleteCookies({ name: 'test' })).rejects.toThrow('Failed to delete cookies');
    });
  });

  describe('clearAllCookies', () => {
    it('should clear all cookies via CDP', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      await stateManager.clearAllCookies();

      expect(sendCommandSpy).toHaveBeenCalledWith('Network.clearBrowserCookies');
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.clearAllCookies()).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Network error'));

      await expect(stateManager.clearAllCookies()).rejects.toThrow('Failed to clear all cookies');
    });
  });

  describe('getLocalStorage', () => {
    it('should retrieve localStorage items for an origin', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        entries: [
          ['key1', 'value1'],
          ['key2', 'value2'],
          ['key3', 'value3'],
        ],
      });

      const items = await stateManager.getLocalStorage('https://example.com');

      expect(items).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
      expect(cdpClient.sendCommand).toHaveBeenCalledWith('DOMStorage.getDOMStorageItems', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: true,
        },
      });
    });

    it('should return empty object when no localStorage items exist', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        entries: [],
      });

      const items = await stateManager.getLocalStorage('https://example.com');

      expect(items).toEqual({});
    });

    it('should handle missing entries field', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({});

      const items = await stateManager.getLocalStorage('https://example.com');

      expect(items).toEqual({});
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.getLocalStorage('https://example.com')).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Storage error'));

      await expect(stateManager.getLocalStorage('https://example.com')).rejects.toThrow('Failed to get localStorage');
    });
  });

  describe('setLocalStorage', () => {
    it('should set multiple localStorage items', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const items = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      };

      await stateManager.setLocalStorage('https://example.com', items);

      expect(sendCommandSpy).toHaveBeenCalledTimes(3);
      expect(sendCommandSpy).toHaveBeenNthCalledWith(1, 'DOMStorage.setDOMStorageItem', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: true,
        },
        key: 'key1',
        value: 'value1',
      });
      expect(sendCommandSpy).toHaveBeenNthCalledWith(2, 'DOMStorage.setDOMStorageItem', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: true,
        },
        key: 'key2',
        value: 'value2',
      });
      expect(sendCommandSpy).toHaveBeenNthCalledWith(3, 'DOMStorage.setDOMStorageItem', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: true,
        },
        key: 'key3',
        value: 'value3',
      });
    });

    it('should handle empty items object', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      await stateManager.setLocalStorage('https://example.com', {});

      expect(sendCommandSpy).not.toHaveBeenCalled();
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.setLocalStorage('https://example.com', { key: 'value' })).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Storage error'));

      await expect(stateManager.setLocalStorage('https://example.com', { key: 'value' })).rejects.toThrow('Failed to set localStorage');
    });
  });

  describe('getSessionStorage', () => {
    it('should retrieve sessionStorage items for an origin', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        entries: [
          ['sessionKey1', 'sessionValue1'],
          ['sessionKey2', 'sessionValue2'],
        ],
      });

      const items = await stateManager.getSessionStorage('https://example.com');

      expect(items).toEqual({
        sessionKey1: 'sessionValue1',
        sessionKey2: 'sessionValue2',
      });
      expect(cdpClient.sendCommand).toHaveBeenCalledWith('DOMStorage.getDOMStorageItems', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: false,
        },
      });
    });

    it('should return empty object when no sessionStorage items exist', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        entries: [],
      });

      const items = await stateManager.getSessionStorage('https://example.com');

      expect(items).toEqual({});
    });

    it('should handle missing entries field', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({});

      const items = await stateManager.getSessionStorage('https://example.com');

      expect(items).toEqual({});
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.getSessionStorage('https://example.com')).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Storage error'));

      await expect(stateManager.getSessionStorage('https://example.com')).rejects.toThrow('Failed to get sessionStorage');
    });
  });

  describe('setSessionStorage', () => {
    it('should set multiple sessionStorage items', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const items = {
        sessionKey1: 'sessionValue1',
        sessionKey2: 'sessionValue2',
      };

      await stateManager.setSessionStorage('https://example.com', items);

      expect(sendCommandSpy).toHaveBeenCalledTimes(2);
      expect(sendCommandSpy).toHaveBeenNthCalledWith(1, 'DOMStorage.setDOMStorageItem', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: false,
        },
        key: 'sessionKey1',
        value: 'sessionValue1',
      });
      expect(sendCommandSpy).toHaveBeenNthCalledWith(2, 'DOMStorage.setDOMStorageItem', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: false,
        },
        key: 'sessionKey2',
        value: 'sessionValue2',
      });
    });

    it('should handle empty items object', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      await stateManager.setSessionStorage('https://example.com', {});

      expect(sendCommandSpy).not.toHaveBeenCalled();
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.setSessionStorage('https://example.com', { key: 'value' })).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Storage error'));

      await expect(stateManager.setSessionStorage('https://example.com', { key: 'value' })).rejects.toThrow('Failed to set sessionStorage');
    });
  });

  describe('clearStorage', () => {
    it('should clear both localStorage and sessionStorage for an origin', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      await stateManager.clearStorage('https://example.com');

      expect(sendCommandSpy).toHaveBeenCalledTimes(2);
      expect(sendCommandSpy).toHaveBeenNthCalledWith(1, 'DOMStorage.clear', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: true,
        },
      });
      expect(sendCommandSpy).toHaveBeenNthCalledWith(2, 'DOMStorage.clear', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: false,
        },
      });
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.clearStorage('https://example.com')).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Storage error'));

      await expect(stateManager.clearStorage('https://example.com')).rejects.toThrow('Failed to clear storage');
    });
  });

  describe('exportState', () => {
    it('should export all cookies and state structure', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        cookies: [
          {
            name: 'session',
            value: 'abc123',
            domain: 'example.com',
            path: '/',
            expires: 1234567890,
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
          },
        ],
      });

      const state = await stateManager.exportState();

      expect(state).toHaveProperty('cookies');
      expect(state).toHaveProperty('localStorage');
      expect(state).toHaveProperty('sessionStorage');
      expect(state).toHaveProperty('version');
      expect(state.cookies).toHaveLength(1);
      expect(state.cookies[0]).toEqual({
        name: 'session',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        expires: 1234567890,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      });
      expect(state.localStorage).toEqual({});
      expect(state.sessionStorage).toEqual({});
      expect(state.version).toBe('1.0.0');
    });

    it('should export empty state when no cookies exist', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        cookies: [],
      });

      const state = await stateManager.exportState();

      expect(state.cookies).toEqual([]);
      expect(state.localStorage).toEqual({});
      expect(state.sessionStorage).toEqual({});
      expect(state.version).toBe('1.0.0');
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.exportState()).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when export fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Network error'));

      await expect(stateManager.exportState()).rejects.toThrow('Failed to export state');
    });
  });

  describe('exportStateAsJSON', () => {
    it('should export state as pretty-printed JSON string', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        cookies: [
          {
            name: 'session',
            value: 'abc123',
            domain: 'example.com',
            path: '/',
            expires: 1234567890,
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
          },
        ],
      });

      const jsonString = await stateManager.exportStateAsJSON();

      // Verify it's valid JSON
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Verify it's pretty-printed (contains newlines and indentation)
      expect(jsonString).toContain('\n');
      expect(jsonString).toContain('  ');

      // Verify the parsed content matches expected structure
      const parsed = JSON.parse(jsonString);
      expect(parsed).toHaveProperty('cookies');
      expect(parsed).toHaveProperty('localStorage');
      expect(parsed).toHaveProperty('sessionStorage');
      expect(parsed).toHaveProperty('version');
      expect(parsed.cookies).toHaveLength(1);
      expect(parsed.version).toBe('1.0.0');
    });

    it('should export empty state as JSON string', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({
        cookies: [],
      });

      const jsonString = await stateManager.exportStateAsJSON();

      const parsed = JSON.parse(jsonString);
      expect(parsed.cookies).toEqual([]);
      expect(parsed.localStorage).toEqual({});
      expect(parsed.sessionStorage).toEqual({});
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.exportStateAsJSON()).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when export fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Network error'));

      await expect(stateManager.exportStateAsJSON()).rejects.toThrow('Failed to export state');
    });
  });

  describe('importState', () => {
    it('should import valid state with cookies', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const state = {
        cookies: [
          {
            name: 'session',
            value: 'abc123',
            domain: 'example.com',
            path: '/',
            expires: 1234567890,
            httpOnly: true,
            secure: true,
            sameSite: 'Strict' as const,
          },
        ],
        localStorage: {},
        sessionStorage: {},
        version: '1.0.0',
      };

      await stateManager.importState(state);

      // Should clear state first (clearBrowserCookies + clearBrowserCache)
      expect(sendCommandSpy).toHaveBeenCalledWith('Network.clearBrowserCookies');
      expect(sendCommandSpy).toHaveBeenCalledWith('Network.clearBrowserCache');
      
      // Should set cookies
      expect(sendCommandSpy).toHaveBeenCalledWith('Network.setCookie', {
        name: 'session',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        expires: 1234567890,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      });
    });

    it('should import state with localStorage and sessionStorage', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const state = {
        cookies: [],
        localStorage: {
          'https://example.com': {
            key1: 'value1',
            key2: 'value2',
          },
        },
        sessionStorage: {
          'https://example.com': {
            sessionKey: 'sessionValue',
          },
        },
        version: '1.0.0',
      };

      await stateManager.importState(state);

      // Should set localStorage items
      expect(sendCommandSpy).toHaveBeenCalledWith('DOMStorage.setDOMStorageItem', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: true,
        },
        key: 'key1',
        value: 'value1',
      });
      expect(sendCommandSpy).toHaveBeenCalledWith('DOMStorage.setDOMStorageItem', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: true,
        },
        key: 'key2',
        value: 'value2',
      });

      // Should set sessionStorage items
      expect(sendCommandSpy).toHaveBeenCalledWith('DOMStorage.setDOMStorageItem', {
        storageId: {
          securityOrigin: 'https://example.com',
          isLocalStorage: false,
        },
        key: 'sessionKey',
        value: 'sessionValue',
      });
    });

    it('should import state with geolocation', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const state = {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        geolocation: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 50,
        },
        version: '1.0.0',
      };

      await stateManager.importState(state);

      // Should set geolocation
      expect(sendCommandSpy).toHaveBeenCalledWith('Emulation.setGeolocationOverride', {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 50,
      });
    });

    it('should validate state structure and reject invalid state', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);

      // Invalid: not an object
      await expect(stateManager.importState(null as any)).rejects.toThrow('Invalid state: must be an object');

      // Invalid: cookies not an array
      await expect(stateManager.importState({ cookies: 'invalid' } as any)).rejects.toThrow('Invalid state: cookies must be an array');

      // Invalid: localStorage not an object
      await expect(stateManager.importState({ cookies: [], localStorage: null } as any)).rejects.toThrow('Invalid state: localStorage must be an object');

      // Invalid: sessionStorage not an object
      await expect(stateManager.importState({ cookies: [], localStorage: {}, sessionStorage: null } as any)).rejects.toThrow('Invalid state: sessionStorage must be an object');
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      const state = {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        version: '1.0.0',
      };

      await expect(stateManager.importState(state)).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when import fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Network error'));

      const state = {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        version: '1.0.0',
      };

      await expect(stateManager.importState(state)).rejects.toThrow('Failed to import state');
    });

    it('should handle empty state gracefully', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const state = {
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        version: '1.0.0',
      };

      await stateManager.importState(state);

      // Should still clear state
      expect(sendCommandSpy).toHaveBeenCalledWith('Network.clearBrowserCookies');
      expect(sendCommandSpy).toHaveBeenCalledWith('Network.clearBrowserCache');
    });
  });

  describe('clearAllState', () => {
    it('should clear all cookies and cache', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      await stateManager.clearAllState();

      expect(sendCommandSpy).toHaveBeenCalledWith('Network.clearBrowserCookies');
      expect(sendCommandSpy).toHaveBeenCalledWith('Network.clearBrowserCache');
      expect(sendCommandSpy).toHaveBeenCalledWith('Emulation.clearGeolocationOverride');
    });

    it('should handle geolocation clear error gracefully', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand')
        .mockResolvedValueOnce({ success: true }) // clearBrowserCookies
        .mockResolvedValueOnce({ success: true }) // clearBrowserCache
        .mockRejectedValueOnce(new Error('Geolocation not set')); // clearGeolocationOverride

      // Should not throw error even if geolocation clear fails
      await expect(stateManager.clearAllState()).resolves.not.toThrow();

      expect(sendCommandSpy).toHaveBeenCalledWith('Network.clearBrowserCookies');
      expect(sendCommandSpy).toHaveBeenCalledWith('Network.clearBrowserCache');
      expect(sendCommandSpy).toHaveBeenCalledWith('Emulation.clearGeolocationOverride');
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.clearAllState()).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when clear fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Network error'));

      await expect(stateManager.clearAllState()).rejects.toThrow('Failed to clear all state');
    });
  });

  describe('round-trip state preservation', () => {
    it('should preserve state through export and import cycle', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      
      const originalCookies = [
        {
          name: 'session',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          expires: 1234567890,
          httpOnly: true,
          secure: true,
          sameSite: 'Strict' as const,
        },
        {
          name: 'token',
          value: 'xyz789',
          domain: 'test.com',
          path: '/api',
          expires: 9876543210,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ];

      // Mock export
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValueOnce({
        cookies: originalCookies,
      });

      const exportedState = await stateManager.exportState();

      // Mock import (clear + set cookies)
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      await stateManager.importState(exportedState);

      // Mock second export to verify
      jest.spyOn(cdpClient, 'sendCommand').mockResolvedValueOnce({
        cookies: originalCookies,
      });

      const reExportedState = await stateManager.exportState();

      // Verify round-trip preservation
      expect(reExportedState.cookies).toEqual(exportedState.cookies);
      expect(reExportedState.localStorage).toEqual(exportedState.localStorage);
      expect(reExportedState.sessionStorage).toEqual(exportedState.sessionStorage);
      expect(reExportedState.version).toEqual(exportedState.version);
    });
  });

  describe('setGeolocation', () => {
    it('should set geolocation with all coordinates', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const coords = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 50,
      };

      await stateManager.setGeolocation(coords);

      expect(sendCommandSpy).toHaveBeenCalledWith('Emulation.setGeolocationOverride', {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 50,
      });
    });

    it('should set geolocation with default accuracy when not provided', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const coords = {
        latitude: 51.5074,
        longitude: -0.1278,
      };

      await stateManager.setGeolocation(coords);

      expect(sendCommandSpy).toHaveBeenCalledWith('Emulation.setGeolocationOverride', {
        latitude: 51.5074,
        longitude: -0.1278,
        accuracy: 100, // Default accuracy
      });
    });

    it('should handle negative coordinates', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const coords = {
        latitude: -33.8688,
        longitude: 151.2093,
        accuracy: 10,
      };

      await stateManager.setGeolocation(coords);

      expect(sendCommandSpy).toHaveBeenCalledWith('Emulation.setGeolocationOverride', {
        latitude: -33.8688,
        longitude: 151.2093,
        accuracy: 10,
      });
    });

    it('should handle zero coordinates', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      const coords = {
        latitude: 0,
        longitude: 0,
        accuracy: 1,
      };

      await stateManager.setGeolocation(coords);

      expect(sendCommandSpy).toHaveBeenCalledWith('Emulation.setGeolocationOverride', {
        latitude: 0,
        longitude: 0,
        accuracy: 1,
      });
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      const coords = {
        latitude: 37.7749,
        longitude: -122.4194,
      };

      await expect(stateManager.setGeolocation(coords)).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Emulation error'));

      const coords = {
        latitude: 37.7749,
        longitude: -122.4194,
      };

      await expect(stateManager.setGeolocation(coords)).rejects.toThrow('Failed to set geolocation');
    });
  });

  describe('clearGeolocation', () => {
    it('should clear geolocation override via CDP', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      const sendCommandSpy = jest.spyOn(cdpClient, 'sendCommand').mockResolvedValue({ success: true });

      await stateManager.clearGeolocation();

      expect(sendCommandSpy).toHaveBeenCalledWith('Emulation.clearGeolocationOverride');
    });

    it('should throw error when CDP client is not connected', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(false);

      await expect(stateManager.clearGeolocation()).rejects.toThrow('CDP client is not connected');
    });

    it('should throw error when CDP command fails', async () => {
      jest.spyOn(cdpClient, 'isConnected').mockReturnValue(true);
      jest.spyOn(cdpClient, 'sendCommand').mockRejectedValue(new Error('Emulation error'));

      await expect(stateManager.clearGeolocation()).rejects.toThrow('Failed to clear geolocation');
    });
  });
});
