/**
 * Security Validator
 * 
 * Validates tool arguments and execution context for security issues.
 */

import * as path from 'path';

export interface SecurityValidationResult {
  valid: boolean;
  error?: string;
  violations?: string[];
}

/**
 * Security Validator for tool execution
 */
export class SecurityValidator {
  private allowedEndpoints: Set<string>;
  private baseDirectory: string;

  constructor(config?: {
    allowedEndpoints?: string[];
    baseDirectory?: string;
  }) {
    // Default allowed endpoints (localhost backend only)
    this.allowedEndpoints = new Set(config?.allowedEndpoints || [
      'http://localhost:4242',
      'http://127.0.0.1:4242',
    ]);
    
    this.baseDirectory = config?.baseDirectory || process.cwd();
  }

  /**
   * Validate file path for path traversal attacks
   * 
   * Rejects:
   * - Paths with ".." (parent directory)
   * - Absolute paths
   * - Paths outside base directory
   */
  validateFilePath(filePath: string): SecurityValidationResult {
    const violations: string[] = [];

    // Check for null or empty
    if (!filePath || typeof filePath !== 'string') {
      return {
        valid: false,
        error: 'File path is required and must be a string',
      };
    }

    // Check for parent directory traversal
    if (filePath.includes('..')) {
      violations.push('Path contains ".." (parent directory traversal)');
    }

    // Check for absolute paths (Windows and Unix)
    if (path.isAbsolute(filePath)) {
      violations.push('Absolute paths are not allowed');
    }

    // Check for common path traversal patterns
    const dangerousPatterns = [
      /\.\./,           // Parent directory
      /^\/+/,           // Leading slashes
      /^[a-zA-Z]:\\/,   // Windows drive letters
      /~\//,            // Home directory
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(filePath)) {
        violations.push(`Path matches dangerous pattern: ${pattern}`);
      }
    }

    // Normalize and check if path escapes base directory
    try {
      const normalizedPath = path.normalize(filePath);
      const resolvedPath = path.resolve(this.baseDirectory, normalizedPath);
      
      if (!resolvedPath.startsWith(this.baseDirectory)) {
        violations.push('Path escapes base directory');
      }
    } catch (error) {
      violations.push('Path normalization failed');
    }

    if (violations.length > 0) {
      return {
        valid: false,
        error: 'Path traversal detected',
        violations,
      };
    }

    return { valid: true };
  }

  /**
   * Validate API endpoint URL
   * 
   * Only allows calls to configured backend endpoints
   */
  validateEndpoint(url: string): SecurityValidationResult {
    const violations: string[] = [];

    // Check for null or empty
    if (!url || typeof url !== 'string') {
      return {
        valid: false,
        error: 'URL is required and must be a string',
      };
    }

    try {
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;

      // Check if origin is in allowed list
      if (!this.allowedEndpoints.has(origin)) {
        violations.push(`Endpoint ${origin} is not in allowed list`);
      }

      // Additional checks
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        violations.push(`Protocol ${parsedUrl.protocol} is not allowed`);
      }

    } catch (error) {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }

    if (violations.length > 0) {
      return {
        valid: false,
        error: 'Endpoint not allowed',
        violations,
      };
    }

    return { valid: true };
  }

  /**
   * Validate tool arguments for security issues
   */
  validateToolArguments(
    toolName: string,
    args: Record<string, any>
  ): SecurityValidationResult {
    const violations: string[] = [];

    // Check for file path arguments
    const filePathKeys = ['filePath', 'path', 'codebasePath', 'file'];
    for (const key of filePathKeys) {
      if (key in args && typeof args[key] === 'string') {
        const result = this.validateFilePath(args[key]);
        if (!result.valid) {
          violations.push(`${key}: ${result.error}`);
          if (result.violations) {
            violations.push(...result.violations.map(v => `  - ${v}`));
          }
        }
      }
    }

    // Check for URL arguments
    const urlKeys = ['url', 'endpoint', 'apiUrl'];
    for (const key of urlKeys) {
      if (key in args && typeof args[key] === 'string') {
        const result = this.validateEndpoint(args[key]);
        if (!result.valid) {
          violations.push(`${key}: ${result.error}`);
          if (result.violations) {
            violations.push(...result.violations.map(v => `  - ${v}`));
          }
        }
      }
    }

    if (violations.length > 0) {
      return {
        valid: false,
        error: 'Security validation failed',
        violations,
      };
    }

    return { valid: true };
  }

  /**
   * Add allowed endpoint
   */
  addAllowedEndpoint(endpoint: string): void {
    this.allowedEndpoints.add(endpoint);
  }

  /**
   * Remove allowed endpoint
   */
  removeAllowedEndpoint(endpoint: string): void {
    this.allowedEndpoints.delete(endpoint);
  }

  /**
   * Get all allowed endpoints
   */
  getAllowedEndpoints(): string[] {
    return Array.from(this.allowedEndpoints);
  }
}

/**
 * Global security validator instance
 */
let globalValidator: SecurityValidator | null = null;

/**
 * Get or create global security validator
 */
export function getSecurityValidator(): SecurityValidator {
  if (!globalValidator) {
    globalValidator = new SecurityValidator();
  }
  return globalValidator;
}

/**
 * Initialize security validator with custom config
 */
export function initializeSecurityValidator(config?: {
  allowedEndpoints?: string[];
  baseDirectory?: string;
}): SecurityValidator {
  globalValidator = new SecurityValidator(config);
  return globalValidator;
}
