/**
 * CDP Client
 * 
 * Low-level Chrome DevTools Protocol communication via WebSocket.
 * Handles connection management, command execution, and event handling.
 * 
 * Requirements: 1.2, 1.5
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BrowserVersion, Target } from './types';

/**
 * CDP Client for Chrome DevTools Protocol communication
 */
export class CDPClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private endpoint: string | null = null;
  private messageId = 0;
  private pendingCommands = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private connected = false;

  /**
   * Connect to a Chrome DevTools Protocol endpoint
   * @param endpoint WebSocket endpoint URL (e.g., ws://localhost:9222/devtools/browser/...)
   */
  async connect(endpoint: string): Promise<void> {
    if (this.connected) {
      throw new Error('CDP client is already connected');
    }

    this.endpoint = endpoint;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(endpoint);

        // Connection opened
        this.ws.on('open', () => {
          this.connected = true;
          this.emit('connected');
          resolve();
        });

        // Message received
        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            this.emit('error', new Error(`Failed to parse CDP message: ${error}`));
          }
        });

        // Connection closed
        this.ws.on('close', (code: number, reason: Buffer) => {
          this.connected = false;
          this.cleanup();
          this.emit('disconnected', { code, reason: reason.toString() });
        });

        // Connection error
        this.ws.on('error', (error: Error) => {
          this.connected = false;
          this.emit('error', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the CDP endpoint
   */
  async disconnect(): Promise<void> {
    if (!this.ws) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }

      // Set up one-time close handler
      const onClose = () => {
        this.cleanup();
        resolve();
      };

      this.ws.once('close', onClose);

      // Close the WebSocket
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      } else {
        // Already closing or closed
        this.cleanup();
        resolve();
      }
    });
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Send a CDP command
   * @param method CDP method name (e.g., 'Browser.getVersion')
   * @param params Optional parameters for the command
   * @returns Promise resolving to the command result
   */
  async sendCommand(method: string, params?: any): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('CDP client is not connected');
    }

    const id = ++this.messageId;
    const message = {
      id,
      method,
      params: params || {}
    };

    return new Promise((resolve, reject) => {
      // Store the promise handlers
      this.pendingCommands.set(id, { resolve, reject });

      // Send the command
      try {
        this.ws!.send(JSON.stringify(message));
      } catch (error) {
        this.pendingCommands.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Get browser version information
   */
  async getBrowserVersion(): Promise<BrowserVersion> {
    const result = await this.sendCommand('Browser.getVersion');
    return {
      browser: result.product || 'Unknown',
      protocolVersion: result.protocolVersion || 'Unknown',
      userAgent: result.userAgent || 'Unknown',
      v8Version: result.jsVersion || 'Unknown',
      webKitVersion: result.revision || 'Unknown'
    };
  }

  /**
   * Get list of available targets (tabs/pages)
   */
  async getTargets(): Promise<Target[]> {
    const result = await this.sendCommand('Target.getTargets');
    return result.targetInfos.map((info: any) => ({
      targetId: info.targetId,
      type: info.type,
      title: info.title,
      url: info.url,
      attached: info.attached || false
    }));
  }

  /**
   * Create a new target (tab/page)
   * @param url URL to navigate to
   */
  async createTarget(url: string): Promise<Target> {
    const result = await this.sendCommand('Target.createTarget', { url });
    return {
      targetId: result.targetId,
      type: 'page',
      title: '',
      url,
      attached: false
    };
  }

  /**
   * Close a target (tab/page)
   * @param targetId Target ID to close
   */
  async closeTarget(targetId: string): Promise<void> {
    await this.sendCommand('Target.closeTarget', { targetId });
  }

  /**
   * Handle incoming CDP messages
   */
  private handleMessage(message: any): void {
    // Response to a command
    if (message.id !== undefined) {
      const pending = this.pendingCommands.get(message.id);
      if (pending) {
        this.pendingCommands.delete(message.id);
        
        if (message.error) {
          pending.reject(new Error(`CDP Error: ${message.error.message} (${message.error.code})`));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    // Event notification
    else if (message.method) {
      this.emit('event', message.method, message.params);
      this.emit(message.method, message.params);
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.connected = false;
    
    // Reject all pending commands
    for (const [id, pending] of this.pendingCommands.entries()) {
      pending.reject(new Error('CDP connection closed'));
    }
    this.pendingCommands.clear();

    // Remove WebSocket listeners
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
    }

    this.endpoint = null;
  }
}
