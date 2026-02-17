/**
 * Remote Browser Connector
 * 
 * Handles WebSocket connections to remote browsers with Gateway authentication.
 * Provides browser version verification, connection error handling, and retry logic.
 * 
 * Requirements: 17.1, 17.2, 17.3, 17.5
 */

import WebSocket from 'ws';
import { BrowserProfile, BrowserVersion } from './types/index.js';

export interface RemoteConnectionOptions {
  wsEndpoint: string;
  gatewayUrl?: string;
  authToken?: string;
  refreshToken?: string; // Optional refresh token for token renewal
  timeout?: number;
  maxRetries?: number;
}

export interface RemoteConnectionResult {
  success: boolean;
  wsEndpoint?: string;
  browserVersion?: BrowserVersion;
  authToken?: string; // New token if refreshed
  refreshToken?: string; // New refresh token if refreshed
  error?: RemoteConnectionError;
}

export interface RemoteConnectionError {
  code: 'AUTH_FAILED' | 'CONNECTION_FAILED' | 'VERSION_INCOMPATIBLE' | 'TIMEOUT' | 'NETWORK_ERROR';
  message: string;
  details?: any;
  retrySuggestions?: string[];
}

export interface GatewayAuthResponse {
  success: boolean;
  wsEndpoint?: string;
  error?: string;
}

/**
 * Remote Browser Connector
 * 
 * Manages connections to remote browsers via WebSocket with Gateway authentication.
 */
export class RemoteBrowserConnector {
  private ws: WebSocket | null = null;
  private connectionOptions: RemoteConnectionOptions | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectBackoffMs = 1000; // Start with 1 second
  private reconnectTimer: NodeJS.Timeout | null = null;
  private currentAuthToken: string | null = null;
  private currentRefreshToken: string | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  /**
   * Connect to a remote browser
   * 
   * @param options Connection options including endpoint and authentication
   * @returns Connection result with success status and browser version
   */
  async connect(options: RemoteConnectionOptions): Promise<RemoteConnectionResult> {
    this.connectionOptions = options;
    this.reconnectAttempts = 0;
    this.currentAuthToken = options.authToken || null;
    this.currentRefreshToken = options.refreshToken || null;

    // If gateway authentication is required
    if (options.gatewayUrl && this.currentAuthToken) {
      const authResult = await this.authenticateWithGateway(
        options.gatewayUrl,
        this.currentAuthToken,
        options.timeout || 30000
      );

      if (!authResult.success) {
        // If authentication failed with 401, try to refresh token
        if (authResult.error?.includes('401') && this.currentRefreshToken) {
          const refreshResult = await this.refreshAuthToken(
            options.gatewayUrl,
            this.currentRefreshToken,
            options.timeout || 30000
          );

          if (refreshResult.success) {
            // Update tokens and retry authentication
            this.currentAuthToken = refreshResult.authToken!;
            this.currentRefreshToken = refreshResult.refreshToken!;
            
            const retryAuthResult = await this.authenticateWithGateway(
              options.gatewayUrl,
              this.currentAuthToken,
              options.timeout || 30000
            );

            if (!retryAuthResult.success) {
              return {
                success: false,
                error: {
                  code: 'AUTH_FAILED',
                  message: retryAuthResult.error || 'Gateway authentication failed after token refresh',
                  details: { gatewayUrl: options.gatewayUrl },
                  retrySuggestions: [
                    'Verify your authentication token is valid',
                    'Check if the gateway URL is correct',
                    'Ensure your account has permission to access remote browsers',
                  ],
                },
              };
            }

            options.wsEndpoint = retryAuthResult.wsEndpoint!;
          } else {
            return {
              success: false,
              error: {
                code: 'AUTH_FAILED',
                message: 'Token refresh failed',
                details: { gatewayUrl: options.gatewayUrl },
                retrySuggestions: [
                  'Re-authenticate with the gateway to obtain new tokens',
                  'Check if your refresh token is still valid',
                ],
              },
            };
          }
        } else {
          return {
            success: false,
            error: {
              code: 'AUTH_FAILED',
              message: authResult.error || 'Gateway authentication failed',
              details: { gatewayUrl: options.gatewayUrl },
              retrySuggestions: [
                'Verify your authentication token is valid',
                'Check if the gateway URL is correct',
                'Ensure your account has permission to access remote browsers',
              ],
            },
          };
        }
      } else {
        // Use the authenticated endpoint
        options.wsEndpoint = authResult.wsEndpoint!;
      }

      // Schedule token refresh (refresh 5 minutes before expiry, or every 50 minutes if no expiry)
      this.scheduleTokenRefresh(options.gatewayUrl, 50 * 60 * 1000);
    }

    // Establish WebSocket connection
    const connectionResult = await this.establishConnection(options.wsEndpoint, options.timeout || 30000);

    if (!connectionResult.success) {
      return connectionResult;
    }

    // Verify browser version compatibility
    const versionResult = await this.verifyBrowserVersion();

    if (!versionResult.success) {
      // Close the connection if version is incompatible
      this.disconnect();
      return versionResult;
    }

    return {
      success: true,
      wsEndpoint: options.wsEndpoint,
      browserVersion: versionResult.browserVersion,
      authToken: this.currentAuthToken || undefined,
      refreshToken: this.currentRefreshToken || undefined,
    };
  }

  /**
   * Authenticate with Gateway to get remote browser endpoint
   * 
   * @param gatewayUrl Gateway URL for authentication
   * @param authToken Authentication token
   * @param timeout Timeout in milliseconds
   * @returns Authentication result with WebSocket endpoint
   */
  private async authenticateWithGateway(
    gatewayUrl: string,
    authToken: string,
    timeout: number
  ): Promise<GatewayAuthResponse> {
    try {
      // Create authentication request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${gatewayUrl}/api/browser/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          requestedAt: Date.now(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          success: false,
          error: `Gateway authentication failed with status ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();

      if (!data.wsEndpoint) {
        return {
          success: false,
          error: 'Gateway did not return a WebSocket endpoint',
        };
      }

      return {
        success: true,
        wsEndpoint: data.wsEndpoint,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Gateway authentication timed out after ${timeout}ms`,
        };
      }

      return {
        success: false,
        error: `Gateway authentication error: ${error.message || String(error)}`,
      };
    }
  }

  /**
   * Establish WebSocket connection to remote browser
   * 
   * @param wsEndpoint WebSocket endpoint URL
   * @param timeout Timeout in milliseconds
   * @returns Connection result
   */
  private async establishConnection(
    wsEndpoint: string,
    timeout: number
  ): Promise<RemoteConnectionResult> {
    return new Promise((resolve) => {
      try {
        // Create WebSocket connection
        this.ws = new WebSocket(wsEndpoint);

        const timeoutId = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            resolve({
              success: false,
              error: {
                code: 'TIMEOUT',
                message: `Connection to remote browser timed out after ${timeout}ms`,
                details: { wsEndpoint },
                retrySuggestions: [
                  'Check if the remote browser is running and accessible',
                  'Verify network connectivity to the remote endpoint',
                  'Try increasing the connection timeout',
                ],
              },
            });
          }
        }, timeout);

        this.ws.on('open', () => {
          clearTimeout(timeoutId);
          resolve({
            success: true,
            wsEndpoint,
          });
        });

        this.ws.on('error', (error: Error) => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: {
              code: 'CONNECTION_FAILED',
              message: `Failed to connect to remote browser: ${error.message}`,
              details: { wsEndpoint, error: error.message },
              retrySuggestions: [
                'Verify the WebSocket endpoint URL is correct',
                'Check if the remote browser is running',
                'Ensure firewall rules allow WebSocket connections',
                'Verify network connectivity to the remote host',
              ],
            },
          });
        });

        this.ws.on('close', () => {
          // Handle unexpected disconnection
          this.handleDisconnection();
        });
      } catch (error: any) {
        resolve({
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: `Failed to create WebSocket connection: ${error.message || String(error)}`,
            details: { wsEndpoint },
            retrySuggestions: [
              'Verify the WebSocket endpoint URL format is correct',
              'Check if WebSocket protocol is supported',
            ],
          },
        });
      }
    });
  }

  /**
   * Verify browser version compatibility
   * Requires CDP protocol version 1.3 or higher
   * 
   * @returns Verification result with browser version
   */
  private async verifyBrowserVersion(): Promise<RemoteConnectionResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: 'WebSocket connection is not open',
          retrySuggestions: ['Reconnect to the remote browser'],
        },
      };
    }

    try {
      // Send Browser.getVersion command via CDP
      const versionInfo = await this.sendCDPCommand('Browser.getVersion', {});

      // Parse protocol version
      const protocolVersion = versionInfo.protocolVersion || '0.0';
      const [major, minor] = protocolVersion.split('.').map(Number);

      // Check if version is 1.3 or higher
      if (major < 1 || (major === 1 && minor < 3)) {
        return {
          success: false,
          error: {
            code: 'VERSION_INCOMPATIBLE',
            message: `Remote browser CDP protocol version ${protocolVersion} is not supported. Required: 1.3 or higher`,
            details: { browserVersion: versionInfo },
            retrySuggestions: [
              'Update the remote browser to a newer version',
              'Ensure the remote browser supports CDP protocol 1.3+',
            ],
          },
        };
      }

      // Return success with browser version
      return {
        success: true,
        browserVersion: {
          browser: versionInfo.product || 'Unknown',
          protocolVersion: versionInfo.protocolVersion || '0.0',
          userAgent: versionInfo.userAgent || '',
          v8Version: versionInfo.jsVersion || '',
          webKitVersion: versionInfo.revision || '',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: `Failed to verify browser version: ${error.message || String(error)}`,
          retrySuggestions: [
            'Check if the remote browser supports CDP protocol',
            'Verify the WebSocket connection is stable',
          ],
        },
      };
    }
  }

  /**
   * Send a CDP command to the remote browser
   * 
   * @param method CDP method name
   * @param params CDP method parameters
   * @returns CDP response
   */
  private async sendCDPCommand(method: string, params: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection is not open');
    }

    return new Promise((resolve, reject) => {
      const id = Date.now();
      const message = JSON.stringify({ id, method, params });

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === id) {
            this.ws?.off('message', messageHandler);
            if (response.error) {
              reject(new Error(response.error.message || 'CDP command failed'));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore parse errors for other messages
        }
      };

      this.ws.on('message', messageHandler);
      this.ws.send(message, (error) => {
        if (error) {
          this.ws?.off('message', messageHandler);
          reject(error);
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        this.ws?.off('message', messageHandler);
        reject(new Error('CDP command timed out'));
      }, 10000);
    });
  }

  /**
   * Handle disconnection and attempt reconnection with exponential backoff
   */
  private handleDisconnection(): void {
    // Don't reconnect if we've exceeded max attempts or if connection was manually closed
    if (!this.connectionOptions || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    // Calculate backoff delay (exponential: 1s, 2s, 4s, 8s, 16s)
    const delay = this.reconnectBackoffMs * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(
      `Remote browser disconnected. Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`
    );

    // Schedule reconnection
    this.reconnectTimer = setTimeout(async () => {
      if (this.connectionOptions) {
        const result = await this.establishConnection(
          this.connectionOptions.wsEndpoint,
          this.connectionOptions.timeout || 30000
        );

        if (result.success) {
          console.log('Successfully reconnected to remote browser');
          this.reconnectAttempts = 0; // Reset counter on success
        } else {
          console.error('Reconnection failed:', result.error?.message);
        }
      }
    }, delay);
  }

  /**
   * Disconnect from remote browser
   */
  disconnect(): void {
    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear token refresh timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear connection options to prevent auto-reconnect
    this.connectionOptions = null;
    this.reconnectAttempts = 0;
    this.currentAuthToken = null;
    this.currentRefreshToken = null;
  }

  /**
   * Refresh authentication token using refresh token
   * 
   * @param gatewayUrl Gateway URL for token refresh
   * @param refreshToken Refresh token
   * @param timeout Timeout in milliseconds
   * @returns Refresh result with new tokens
   */
  private async refreshAuthToken(
    gatewayUrl: string,
    refreshToken: string,
    timeout: number
  ): Promise<{ success: boolean; authToken?: string; refreshToken?: string; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${gatewayUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          success: false,
          error: `Token refresh failed with status ${response.status}: ${errorText}`,
        };
      }

      const data = await response.json();

      if (!data.authToken) {
        return {
          success: false,
          error: 'Gateway did not return a new auth token',
        };
      }

      return {
        success: true,
        authToken: data.authToken,
        refreshToken: data.refreshToken || refreshToken, // Use new refresh token if provided
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Token refresh timed out after ${timeout}ms`,
        };
      }

      return {
        success: false,
        error: `Token refresh error: ${error.message || String(error)}`,
      };
    }
  }

  /**
   * Schedule automatic token refresh
   * 
   * @param gatewayUrl Gateway URL for token refresh
   * @param intervalMs Interval in milliseconds (default: 50 minutes)
   */
  private scheduleTokenRefresh(gatewayUrl: string, intervalMs: number = 50 * 60 * 1000): void {
    // Clear existing timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // Schedule refresh
    this.tokenRefreshTimer = setTimeout(async () => {
      if (this.currentRefreshToken) {
        console.log('[RemoteBrowserConnector] Refreshing authentication token...');
        
        const refreshResult = await this.refreshAuthToken(
          gatewayUrl,
          this.currentRefreshToken,
          30000
        );

        if (refreshResult.success) {
          this.currentAuthToken = refreshResult.authToken!;
          this.currentRefreshToken = refreshResult.refreshToken!;
          console.log('[RemoteBrowserConnector] Token refreshed successfully');
          
          // Schedule next refresh
          this.scheduleTokenRefresh(gatewayUrl, intervalMs);
        } else {
          console.error('[RemoteBrowserConnector] Token refresh failed:', refreshResult.error);
          // Don't schedule next refresh if it failed
        }
      }
    }, intervalMs);
  }

  /**
   * Check if connected to remote browser
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get the WebSocket connection
   */
  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  /**
   * Get current reconnection attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Get current authentication token
   */
  getCurrentAuthToken(): string | null {
    return this.currentAuthToken;
  }

  /**
   * Get current refresh token
   */
  getCurrentRefreshToken(): string | null {
    return this.currentRefreshToken;
  }
}
