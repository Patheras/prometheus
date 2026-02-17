/**
 * Extension Relay Client
 * 
 * Communicates with Chrome extension to control existing browser tabs.
 * Supports tab discovery, tab connection, and error handling.
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.5
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';

/**
 * Tab information from extension
 */
export interface ExtensionTab {
  tabId: number;
  title: string;
  url: string;
  windowId: number;
  active: boolean;
}

/**
 * Extension relay connection options
 */
export interface ExtensionRelayOptions {
  extensionId?: string;
  wsEndpoint?: string;
  timeout?: number;
}

/**
 * Extension relay message types
 */
interface ExtensionMessage {
  type: 'discover_tabs' | 'connect_tab' | 'disconnect_tab' | 'tab_closed' | 'error';
  tabId?: number;
  tabs?: ExtensionTab[];
  error?: string;
  requestId?: string;
}

/**
 * Extension Relay Client
 * Manages communication with Chrome extension for tab control
 */
export class ExtensionRelayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected = false;
  private connectedTabId: number | null = null;
  private options: ExtensionRelayOptions;
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }> = new Map();
  private requestIdCounter = 0;

  constructor(options: ExtensionRelayOptions = {}) {
    super();
    this.options = {
      timeout: 30000,
      ...options,
    };
  }

  /**
   * Connect to the extension relay
   * @param wsEndpoint WebSocket endpoint for the extension relay
   */
  async connect(wsEndpoint: string): Promise<void> {
    if (this.connected) {
      throw new Error('Extension relay client is already connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        reject(new Error(`Extension relay connection timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      try {
        this.ws = new WebSocket(wsEndpoint);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.connected = true;
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.handleDisconnection(code, reason.toString());
        });

        this.ws.on('error', (error: Error) => {
          clearTimeout(timeout);
          this.emit('error', error);
          if (!this.connected) {
            reject(error);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the extension relay
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.ws) {
      return;
    }

    // Disconnect from current tab if connected
    if (this.connectedTabId !== null) {
      try {
        await this.disconnectTab(this.connectedTabId);
      } catch (error) {
        // Ignore errors during disconnect
        console.debug('Error disconnecting tab during relay disconnect:', error);
      }
    }

    return new Promise((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }

      this.ws.once('close', () => {
        this.connected = false;
        this.ws = null;
        this.emit('disconnected');
        resolve();
      });

      this.ws.close();
    });
  }

  /**
   * Check if connected to extension relay
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Discover available tabs from the extension
   * @returns List of available tabs
   */
  async discoverTabs(): Promise<ExtensionTab[]> {
    if (!this.connected) {
      throw new Error('Extension relay client is not connected. Call connect() first.');
    }

    const requestId = this.generateRequestId();
    const message: ExtensionMessage = {
      type: 'discover_tabs',
      requestId,
    };

    return this.sendRequest<ExtensionTab[]>(message, requestId);
  }

  /**
   * Connect to a specific tab
   * @param tabId Tab ID to connect to
   * @returns CDP WebSocket endpoint for the tab
   */
  async connectTab(tabId: number): Promise<string> {
    if (!this.connected) {
      throw new Error('Extension relay client is not connected. Call connect() first.');
    }

    if (this.connectedTabId !== null && this.connectedTabId !== tabId) {
      throw new Error(`Already connected to tab ${this.connectedTabId}. Disconnect first.`);
    }

    const requestId = this.generateRequestId();
    const message: ExtensionMessage = {
      type: 'connect_tab',
      tabId,
      requestId,
    };

    const wsEndpoint = await this.sendRequest<string>(message, requestId);
    this.connectedTabId = tabId;
    this.emit('tab-connected', { tabId });
    
    return wsEndpoint;
  }

  /**
   * Disconnect from the currently connected tab
   * @param tabId Tab ID to disconnect from
   */
  async disconnectTab(tabId: number): Promise<void> {
    if (!this.connected) {
      throw new Error('Extension relay client is not connected');
    }

    if (this.connectedTabId !== tabId) {
      throw new Error(`Not connected to tab ${tabId}`);
    }

    const requestId = this.generateRequestId();
    const message: ExtensionMessage = {
      type: 'disconnect_tab',
      tabId,
      requestId,
    };

    await this.sendRequest<void>(message, requestId);
    this.connectedTabId = null;
    this.emit('tab-disconnected', { tabId });
  }

  /**
   * Get the currently connected tab ID
   */
  getConnectedTabId(): number | null {
    return this.connectedTabId;
  }

  /**
   * Send a request to the extension and wait for response
   * @param message Message to send
   * @param requestId Request ID for tracking
   * @returns Response data
   */
  private sendRequest<T>(message: ExtensionMessage, requestId: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('Extension relay client is not connected'));
        return;
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Extension relay request timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve: (value: any) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      // Send message
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages from the extension
   * @param data Message data
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: ExtensionMessage = JSON.parse(data.toString());

      // Handle tab closed notification
      if (message.type === 'tab_closed' && message.tabId !== undefined) {
        this.handleTabClosed(message.tabId);
        return;
      }

      // Handle error response
      if (message.type === 'error' && message.requestId) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          this.pendingRequests.delete(message.requestId);
          pending.reject(new Error(message.error || 'Unknown extension relay error'));
        }
        return;
      }

      // Handle response to pending request
      if (message.requestId) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          this.pendingRequests.delete(message.requestId);
          
          // Extract response data based on message type
          let responseData: any;
          if (message.type === 'discover_tabs') {
            responseData = message.tabs || [];
          } else if (message.type === 'connect_tab') {
            // Response should contain the CDP WebSocket endpoint
            responseData = (message as any).wsEndpoint;
          } else {
            responseData = undefined;
          }
          
          pending.resolve(responseData);
        }
      }
    } catch (error) {
      console.error('Error handling extension relay message:', error);
      this.emit('error', error);
    }
  }

  /**
   * Handle tab closed notification
   * @param tabId Tab ID that was closed
   */
  private handleTabClosed(tabId: number): void {
    if (this.connectedTabId === tabId) {
      this.connectedTabId = null;
      this.emit('tab-closed', { tabId });
    }
  }

  /**
   * Handle disconnection from extension relay
   * @param code Close code
   * @param reason Close reason
   */
  private handleDisconnection(code: number, reason: string): void {
    this.connected = false;
    this.connectedTabId = null;
    this.ws = null;

    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error('Extension relay disconnected'));
    }
    this.pendingRequests.clear();

    this.emit('disconnected', { code, reason });
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${++this.requestIdCounter}_${Date.now()}`;
  }

  /**
   * Check if the extension is installed and available
   * This is a helper method that attempts to connect and discover tabs
   * @param wsEndpoint WebSocket endpoint to test
   * @returns True if extension is available, false otherwise
   */
  static async checkExtensionAvailable(wsEndpoint: string, timeout: number = 5000): Promise<boolean> {
    const client = new ExtensionRelayClient({ timeout });
    
    try {
      await client.connect(wsEndpoint);
      await client.discoverTabs();
      await client.disconnect();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get installation instructions for the extension
   */
  static getInstallationInstructions(): string {
    return `
Extension Relay is not installed or not available.

To use the chrome-extension profile, you need to:
1. Install the Browser Automation Extension from the Chrome Web Store
2. Enable the extension in your browser
3. Ensure the extension is configured to allow connections from this application
4. Restart your browser if necessary

For more information, visit: https://github.com/your-org/browser-automation-extension
    `.trim();
  }
}
