/**
 * Control Server
 * 
 * HTTP server for browser control with loopback-only binding.
 * Provides REST API endpoints for browser automation operations.
 * 
 * Security: Binds ONLY to 127.0.0.1 (loopback) to prevent external access.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { BrowserManager } from './browser-manager.js';
import { StateManager } from './state-manager.js';
import { BrowserAction, BrowserState } from './types/index.js';
import { RequestValidator } from './validation/request-validator.js';

/**
 * ControlServer provides HTTP API for browser control.
 * 
 * Key features:
 * - Loopback-only binding (127.0.0.1) for security
 * - Health check endpoint
 * - Browser control endpoints
 * - Request logging
 * - Graceful shutdown
 */
export class ControlServer {
  private app: Express;
  private server: Server | null = null;
  private port: number = 18791;
  private host: string = '127.0.0.1';
  private isServerRunning: boolean = false;
  private browserManager: BrowserManager | null = null;

  constructor(browserManager?: BrowserManager) {
    this.browserManager = browserManager || null;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Set the browser manager (can be called after construction)
   * @param browserManager Browser manager instance
   */
  setBrowserManager(browserManager: BrowserManager): void {
    this.browserManager = browserManager;
  }

  /**
   * Set up Express middleware
   */
  private setupMiddleware(): void {
    // Parse JSON request bodies
    this.app.use(express.json());

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  /**
   * Set up API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        server: {
          host: this.host,
          port: this.port,
          running: this.isServerRunning
        }
      });
    });

    // Browser control endpoints
    
    // POST /browser/launch - Launch browser with profile
    this.app.post('/browser/launch', async (req: Request, res: Response) => {
      try {
        if (!this.browserManager) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Browser manager is not initialized',
              timestamp: Date.now()
            }
          });
        }

        const { profileName } = req.body;

        if (!profileName || typeof profileName !== 'string') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'profileName is required and must be a string',
              timestamp: Date.now()
            }
          });
        }

        // Get the profile
        const profile = this.browserManager.getProfileManager().getProfile(profileName);
        if (!profile) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'PROFILE_NOT_FOUND',
              message: `Profile "${profileName}" not found`,
              timestamp: Date.now()
            }
          });
        }

        // Launch the browser
        const browser = await this.browserManager.launchBrowser(profile);

        res.json({
          success: true,
          data: {
            browserId: browser.id,
            profile: browser.profile.name,
            cdpEndpoint: browser.cdpEndpoint,
            createdAt: browser.createdAt
          },
          timestamp: Date.now()
        });
      } catch (error: any) {
        console.error('[ControlServer] Error launching browser:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'LAUNCH_FAILED',
            message: error.message || 'Failed to launch browser',
            timestamp: Date.now()
          }
        });
      }
    });

    // POST /browser/close - Close browser
    this.app.post('/browser/close', async (req: Request, res: Response) => {
      try {
        if (!this.browserManager) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Browser manager is not initialized',
              timestamp: Date.now()
            }
          });
        }

        const { browserId } = req.body;

        if (!browserId || typeof browserId !== 'string') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'browserId is required and must be a string',
              timestamp: Date.now()
            }
          });
        }

        // Check if browser exists
        const browser = this.browserManager.getBrowser(browserId);
        if (!browser) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'BROWSER_NOT_FOUND',
              message: `Browser with ID "${browserId}" not found`,
              timestamp: Date.now()
            }
          });
        }

        // Close the browser
        await this.browserManager.closeBrowser(browserId);

        res.json({
          success: true,
          data: {
            browserId,
            message: 'Browser closed successfully'
          },
          timestamp: Date.now()
        });
      } catch (error: any) {
        console.error('[ControlServer] Error closing browser:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'CLOSE_FAILED',
            message: error.message || 'Failed to close browser',
            timestamp: Date.now()
          }
        });
      }
    });

    // POST /browser/action - Execute action
    this.app.post('/browser/action', async (req: Request, res: Response) => {
      try {
        const action = req.body as BrowserAction;

        // Validate the action FIRST (before checking browser manager)
        const validationResult = RequestValidator.validateAction(action);
        if (!validationResult.valid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'Action validation failed',
              details: validationResult.errors,
              timestamp: Date.now()
            }
          });
        }

        // Now check if browser manager is available
        if (!this.browserManager) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Browser manager is not initialized',
              timestamp: Date.now()
            }
          });
        }

        // Sanitize file paths if present
        if ('path' in action && action.path) {
          try {
            action.path = RequestValidator.sanitizeFilePath(action.path);
          } catch (error: any) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_PATH',
                message: error.message || 'Invalid file path',
                timestamp: Date.now()
              }
            });
          }
        }

        // Sanitize file paths in upload action
        if (action.type === 'upload' && 'filePaths' in action && action.filePaths) {
          try {
            action.filePaths = action.filePaths.map(fp => 
              RequestValidator.sanitizeFilePath(fp)
            );
          } catch (error: any) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_PATH',
                message: error.message || 'Invalid file path',
                timestamp: Date.now()
              }
            });
          }
        }

        // Execute the action
        const result = await this.browserManager.executeAction(action);

        // Return the result (success or error)
        if (result.success) {
          res.json({
            success: true,
            data: result,
            timestamp: Date.now()
          });
        } else {
          res.status(400).json({
            success: false,
            error: {
              code: result.error?.code || 'ACTION_FAILED',
              message: result.error?.message || 'Action execution failed',
              details: result.error?.details,
              timestamp: Date.now()
            }
          });
        }
      } catch (error: any) {
        console.error('[ControlServer] Error executing action:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'EXECUTION_FAILED',
            message: error.message || 'Failed to execute action',
            timestamp: Date.now()
          }
        });
      }
    });

    // GET /browser/state - Get browser state
    this.app.get('/browser/state', async (req: Request, res: Response) => {
      try {
        if (!this.browserManager) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Browser manager is not initialized',
              timestamp: Date.now()
            }
          });
        }

        // Get the active browser
        const activeBrowser = this.browserManager.getActiveBrowser();
        if (!activeBrowser) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NO_ACTIVE_BROWSER',
              message: 'No active browser found',
              timestamp: Date.now()
            }
          });
        }

        // Get the CDP client for the active browser
        const cdpClient = (this.browserManager as any).cdpClients.get(activeBrowser.id);
        if (!cdpClient) {
          return res.status(500).json({
            success: false,
            error: {
              code: 'CDP_CLIENT_NOT_FOUND',
              message: 'CDP client not found for active browser',
              timestamp: Date.now()
            }
          });
        }

        // Create a state manager and export state
        const stateManager = new StateManager(cdpClient);
        const state = await stateManager.exportState();

        res.json({
          success: true,
          data: state,
          timestamp: Date.now()
        });
      } catch (error: any) {
        console.error('[ControlServer] Error getting browser state:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'STATE_RETRIEVAL_FAILED',
            message: error.message || 'Failed to get browser state',
            timestamp: Date.now()
          }
        });
      }
    });

    // POST /browser/state - Set browser state
    this.app.post('/browser/state', async (req: Request, res: Response) => {
      try {
        const state = req.body as BrowserState;

        // Validate state structure FIRST (before checking browser manager)
        const validationResult = RequestValidator.validateBrowserState(state);
        if (!validationResult.valid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'Browser state validation failed',
              details: validationResult.errors,
              timestamp: Date.now()
            }
          });
        }

        // Now check if browser manager is available
        if (!this.browserManager) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Browser manager is not initialized',
              timestamp: Date.now()
            }
          });
        }

        // Get the active browser
        const activeBrowser = this.browserManager.getActiveBrowser();
        if (!activeBrowser) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NO_ACTIVE_BROWSER',
              message: 'No active browser found',
              timestamp: Date.now()
            }
          });
        }

        // Get the CDP client for the active browser
        const cdpClient = (this.browserManager as any).cdpClients.get(activeBrowser.id);
        if (!cdpClient) {
          return res.status(500).json({
            success: false,
            error: {
              code: 'CDP_CLIENT_NOT_FOUND',
              message: 'CDP client not found for active browser',
              timestamp: Date.now()
            }
          });
        }

        // Create a state manager and import state
        const stateManager = new StateManager(cdpClient);
        await stateManager.importState(state);

        res.json({
          success: true,
          data: {
            message: 'Browser state set successfully'
          },
          timestamp: Date.now()
        });
      } catch (error: any) {
        console.error('[ControlServer] Error setting browser state:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'STATE_UPDATE_FAILED',
            message: error.message || 'Failed to set browser state',
            timestamp: Date.now()
          }
        });
      }
    });

    // Capture endpoints

    // GET /browser/screenshot - Take screenshot
    this.app.get('/browser/screenshot', async (req: Request, res: Response) => {
      try {
        // Parse query parameters
        const fullPage = req.query.fullPage === 'true';
        const format = (req.query.format as 'png' | 'jpeg') || 'png';
        const quality = req.query.quality ? parseInt(req.query.quality as string) : undefined;
        const path = req.query.path as string | undefined;

        // Validate format FIRST (before checking browser manager)
        if (format && !['png', 'jpeg'].includes(format)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'format must be either "png" or "jpeg"',
              timestamp: Date.now()
            }
          });
        }

        // Validate quality
        if (quality !== undefined && (isNaN(quality) || quality < 0 || quality > 100)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'quality must be a number between 0 and 100',
              timestamp: Date.now()
            }
          });
        }

        // Create screenshot action
        const action: BrowserAction = {
          type: 'screenshot',
          fullPage,
          format,
          quality,
          path,
        };

        // Validate and sanitize the action
        const validationResult = RequestValidator.validateAction(action);
        if (!validationResult.valid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'Screenshot action validation failed',
              details: validationResult.errors,
              timestamp: Date.now()
            }
          });
        }

        // Sanitize path if present
        if (action.path) {
          try {
            action.path = RequestValidator.sanitizeFilePath(action.path);
          } catch (error: any) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_PATH',
                message: error.message || 'Invalid file path',
                timestamp: Date.now()
              }
            });
          }
        }

        // Now check if browser manager is available
        if (!this.browserManager) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Browser manager is not initialized',
              timestamp: Date.now()
            }
          });
        }

        // Execute the action
        const result = await this.browserManager.executeAction(action);

        // Return the result
        if (result.success) {
          res.json({
            success: true,
            data: result.result,
            timestamp: Date.now()
          });
        } else {
          res.status(400).json({
            success: false,
            error: {
              code: result.error?.code || 'SCREENSHOT_FAILED',
              message: result.error?.message || 'Screenshot capture failed',
              details: result.error?.details,
              timestamp: Date.now()
            }
          });
        }
      } catch (error: any) {
        console.error('[ControlServer] Error taking screenshot:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'SCREENSHOT_FAILED',
            message: error.message || 'Failed to take screenshot',
            timestamp: Date.now()
          }
        });
      }
    });

    // GET /browser/snapshot - Get page snapshot
    this.app.get('/browser/snapshot', async (req: Request, res: Response) => {
      try {
        if (!this.browserManager) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Browser manager is not initialized',
              timestamp: Date.now()
            }
          });
        }

        // Parse query parameters
        const includeIframes = req.query.includeIframes === 'true';

        // Create snapshot action
        const action: BrowserAction = {
          type: 'snapshot',
          includeIframes,
        };

        // Execute the action
        const result = await this.browserManager.executeAction(action);

        // Return the result
        if (result.success) {
          res.json({
            success: true,
            data: result.result,
            timestamp: Date.now()
          });
        } else {
          res.status(400).json({
            success: false,
            error: {
              code: result.error?.code || 'SNAPSHOT_FAILED',
              message: result.error?.message || 'Snapshot capture failed',
              details: result.error?.details,
              timestamp: Date.now()
            }
          });
        }
      } catch (error: any) {
        console.error('[ControlServer] Error capturing snapshot:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'SNAPSHOT_FAILED',
            message: error.message || 'Failed to capture snapshot',
            timestamp: Date.now()
          }
        });
      }
    });

    // POST /browser/pdf - Generate PDF
    this.app.post('/browser/pdf', async (req: Request, res: Response) => {
      try {
        // Parse request body for PDF options
        const { path, format, width, height, margin, printBackground } = req.body;

        // Create PDF action
        const action: BrowserAction = {
          type: 'pdf',
          path,
          format,
          width,
          height,
          margin,
          printBackground,
        };

        // Validate the action FIRST (before checking browser manager)
        const validationResult = RequestValidator.validateAction(action);
        if (!validationResult.valid) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: 'PDF action validation failed',
              details: validationResult.errors,
              timestamp: Date.now()
            }
          });
        }

        // Sanitize path if present
        if (action.path) {
          try {
            action.path = RequestValidator.sanitizeFilePath(action.path);
          } catch (error: any) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_PATH',
                message: error.message || 'Invalid file path',
                timestamp: Date.now()
              }
            });
          }
        }

        // Now check if browser manager is available
        if (!this.browserManager) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Browser manager is not initialized',
              timestamp: Date.now()
            }
          });
        }

        // Execute the action
        const result = await this.browserManager.executeAction(action);

        // Return the result
        if (result.success) {
          res.json({
            success: true,
            data: result.result,
            timestamp: Date.now()
          });
        } else {
          res.status(400).json({
            success: false,
            error: {
              code: result.error?.code || 'PDF_GENERATION_FAILED',
              message: result.error?.message || 'PDF generation failed',
              details: result.error?.details,
              timestamp: Date.now()
            }
          });
        }
      } catch (error: any) {
        console.error('[ControlServer] Error generating PDF:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'PDF_GENERATION_FAILED',
            message: error.message || 'Failed to generate PDF',
            timestamp: Date.now()
          }
        });
      }
    });

    // GET /metrics - Get metrics in Prometheus format
    this.app.get('/metrics', (req: Request, res: Response) => {
      try {
        const { getMetricsCollector } = require('./metrics-collector.js');
        const metrics = getMetricsCollector();
        
        // Return metrics in Prometheus format
        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(metrics.getPrometheusMetrics());
      } catch (error: any) {
        console.error('[ControlServer] Error getting metrics:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'METRICS_ERROR',
            message: error.message || 'Failed to get metrics',
            timestamp: Date.now()
          }
        });
      }
    });

    // GET /metrics/json - Get metrics in JSON format
    this.app.get('/metrics/json', (req: Request, res: Response) => {
      try {
        const { getMetricsCollector } = require('./metrics-collector.js');
        const metrics = getMetricsCollector();
        
        res.json({
          success: true,
          data: metrics.getMetrics(),
          timestamp: Date.now()
        });
      } catch (error: any) {
        console.error('[ControlServer] Error getting metrics:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'METRICS_ERROR',
            message: error.message || 'Failed to get metrics',
            timestamp: Date.now()
          }
        });
      }
    });

    // GET /logs - Get logs
    this.app.get('/logs', (req: Request, res: Response) => {
      try {
        const { getLogger } = require('./logger.js');
        const logger = getLogger();
        
        const { type } = req.query;
        
        let logs;
        if (type && typeof type === 'string') {
          logs = logger.getLogsByType(type as any);
        } else {
          logs = logger.getLogs();
        }
        
        res.json({
          success: true,
          data: {
            logs,
            count: logs.length
          },
          timestamp: Date.now()
        });
      } catch (error: any) {
        console.error('[ControlServer] Error getting logs:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'LOGS_ERROR',
            message: error.message || 'Failed to get logs',
            timestamp: Date.now()
          }
        });
      }
    });

    // 404 handler for unknown routes
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.path} not found`,
          timestamp: Date.now()
        }
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(`[ERROR] ${err.message}`, err.stack);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message,
          timestamp: Date.now()
        }
      });
    });
  }

  /**
   * Start the control server
   * 
   * @param port - Port to bind to (default: 18791)
   * @throws Error if server fails to start or if attempting to bind to non-loopback address
   */
  async start(port: number = 18791): Promise<void> {
    if (this.isServerRunning) {
      throw new Error('Control server is already running');
    }

    this.port = port;

    // SECURITY: Ensure we only bind to loopback address
    if (this.host !== '127.0.0.1' && this.host !== 'localhost') {
      throw new Error(
        `Security violation: Control server must bind to loopback address only. ` +
        `Attempted to bind to: ${this.host}`
      );
    }

    return new Promise((resolve, reject) => {
      try {
        // Bind to loopback address ONLY
        this.server = this.app.listen(this.port, this.host, () => {
          this.isServerRunning = true;
          console.log(
            `[ControlServer] Started on ${this.host}:${this.port} (loopback-only)`
          );
          resolve();
        });

        this.server.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${this.port} is already in use`));
          } else if (error.code === 'EACCES') {
            reject(new Error(`Permission denied to bind to port ${this.port}`));
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the control server
   */
  async stop(): Promise<void> {
    if (!this.isServerRunning || !this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.isServerRunning = false;
          this.server = null;
          console.log('[ControlServer] Stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.isServerRunning;
  }

  /**
   * Get the port the server is bound to
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get the address the server is bound to
   */
  getAddress(): string {
    return this.host;
  }
}
