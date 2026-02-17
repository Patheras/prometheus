/**
 * Request Validator
 * 
 * Validates and sanitizes request parameters for security.
 * Prevents injection attacks and directory traversal.
 * 
 * Requirements: 9.5, 9.6
 */

import path from 'path';
import { BrowserAction } from '../types/index.js';

/**
 * Validation error with details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Sanitization options
 */
export interface SanitizationOptions {
  allowedBaseDir?: string;
  maxPathLength?: number;
}

/**
 * Request validator for browser automation
 */
export class RequestValidator {
  private static readonly INJECTION_PATTERNS = [
    // SQL injection patterns
    /('|(--)|;|\*|\/\*|\*\/|xp_|sp_|exec|execute|select|insert|update|delete|drop|create|alter|union)/i,
    // Script injection patterns
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /data:text\/html/gi, // Data URI XSS
    /vbscript:/gi, // VBScript injection
    // Command injection patterns
    /[;&|`$(){}[\]<>]/,
    // Additional XSS patterns
    /<embed[^>]*>/gi,
    /<object[^>]*>/gi,
    /<applet[^>]*>/gi,
    /<meta[^>]*>/gi,
    /<link[^>]*>/gi,
    /<style[^>]*>.*?<\/style>/gi,
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.[\/\\]/g, // ../ or ..\
    /\.\.[\/\\]?$/g, // .. at end
    /^[\/\\]/g, // Absolute paths
    /[<>:"|?*]/g, // Invalid filename characters
  ];

  /**
   * Validate a browser action
   */
  static validateAction(action: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Check if action exists and has type
    if (!action || typeof action !== 'object') {
      errors.push({
        field: 'action',
        message: 'Action must be an object',
        value: action,
      });
      return { valid: false, errors };
    }

    if (!action.type || typeof action.type !== 'string') {
      errors.push({
        field: 'action.type',
        message: 'Action type is required and must be a string',
        value: action.type,
      });
      return { valid: false, errors };
    }

    // Validate based on action type
    switch (action.type) {
      case 'navigate':
        this.validateNavigateAction(action, errors);
        break;
      case 'click':
        this.validateClickAction(action, errors);
        break;
      case 'type':
        this.validateTypeAction(action, errors);
        break;
      case 'screenshot':
        this.validateScreenshotAction(action, errors);
        break;
      case 'snapshot':
        this.validateSnapshotAction(action, errors);
        break;
      case 'pdf':
        this.validatePDFAction(action, errors);
        break;
      case 'execute_js':
        this.validateExecuteJSAction(action, errors);
        break;
      case 'wait':
        this.validateWaitAction(action, errors);
        break;
      case 'scroll':
        this.validateScrollAction(action, errors);
        break;
      case 'select':
        this.validateSelectAction(action, errors);
        break;
      case 'upload':
        this.validateUploadAction(action, errors);
        break;
      default:
        errors.push({
          field: 'action.type',
          message: `Unknown action type: ${action.type}`,
          value: action.type,
        });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate navigate action
   */
  private static validateNavigateAction(action: any, errors: ValidationError[]): void {
    // URL is required
    if (!action.url || typeof action.url !== 'string') {
      errors.push({
        field: 'url',
        message: 'URL is required and must be a string',
        value: action.url,
      });
    } else {
      // Validate URL format
      try {
        new URL(action.url);
      } catch {
        errors.push({
          field: 'url',
          message: 'URL must be a valid URL',
          value: action.url,
        });
      }
    }

    // Validate waitUntil if provided
    if (action.waitUntil !== undefined) {
      const validWaitUntil = ['load', 'domcontentloaded', 'networkidle'];
      if (!validWaitUntil.includes(action.waitUntil)) {
        errors.push({
          field: 'waitUntil',
          message: `waitUntil must be one of: ${validWaitUntil.join(', ')}`,
          value: action.waitUntil,
        });
      }
    }

    // Validate timeout if provided
    if (action.timeout !== undefined) {
      this.validateTimeout(action.timeout, 'timeout', errors);
    }
  }

  /**
   * Validate click action
   */
  private static validateClickAction(action: any, errors: ValidationError[]): void {
    // Selector is required
    if (!action.selector || typeof action.selector !== 'string') {
      errors.push({
        field: 'selector',
        message: 'Selector is required and must be a string',
        value: action.selector,
      });
    } else {
      this.validateSelector(action.selector, 'selector', errors);
    }

    // Validate button if provided
    if (action.button !== undefined) {
      const validButtons = ['left', 'right', 'middle'];
      if (!validButtons.includes(action.button)) {
        errors.push({
          field: 'button',
          message: `button must be one of: ${validButtons.join(', ')}`,
          value: action.button,
        });
      }
    }

    // Validate clickCount if provided
    if (action.clickCount !== undefined) {
      this.validatePositiveInteger(action.clickCount, 'clickCount', errors, 1, 10);
    }

    // Validate timeout if provided
    if (action.timeout !== undefined) {
      this.validateTimeout(action.timeout, 'timeout', errors);
    }
  }

  /**
   * Validate type action
   */
  private static validateTypeAction(action: any, errors: ValidationError[]): void {
    // Selector is required
    if (!action.selector || typeof action.selector !== 'string') {
      errors.push({
        field: 'selector',
        message: 'Selector is required and must be a string',
        value: action.selector,
      });
    } else {
      this.validateSelector(action.selector, 'selector', errors);
    }

    // Text is required
    if (action.text === undefined || typeof action.text !== 'string') {
      errors.push({
        field: 'text',
        message: 'Text is required and must be a string',
        value: action.text,
      });
    }

    // Validate delay if provided
    if (action.delay !== undefined) {
      this.validatePositiveInteger(action.delay, 'delay', errors, 0, 1000);
    }

    // Validate timeout if provided
    if (action.timeout !== undefined) {
      this.validateTimeout(action.timeout, 'timeout', errors);
    }
  }

  /**
   * Validate screenshot action
   */
  private static validateScreenshotAction(action: any, errors: ValidationError[]): void {
    // Validate fullPage if provided
    if (action.fullPage !== undefined && typeof action.fullPage !== 'boolean') {
      errors.push({
        field: 'fullPage',
        message: 'fullPage must be a boolean',
        value: action.fullPage,
      });
    }

    // Validate format if provided
    if (action.format !== undefined) {
      const validFormats = ['png', 'jpeg'];
      if (!validFormats.includes(action.format)) {
        errors.push({
          field: 'format',
          message: `format must be one of: ${validFormats.join(', ')}`,
          value: action.format,
        });
      }
    }

    // Validate quality if provided
    if (action.quality !== undefined) {
      this.validatePositiveInteger(action.quality, 'quality', errors, 0, 100);
    }

    // Validate path if provided
    if (action.path !== undefined) {
      if (typeof action.path !== 'string') {
        errors.push({
          field: 'path',
          message: 'path must be a string',
          value: action.path,
        });
      } else {
        this.validateFilePath(action.path, 'path', errors);
      }
    }
  }

  /**
   * Validate snapshot action
   */
  private static validateSnapshotAction(action: any, errors: ValidationError[]): void {
    // Validate includeIframes if provided
    if (action.includeIframes !== undefined && typeof action.includeIframes !== 'boolean') {
      errors.push({
        field: 'includeIframes',
        message: 'includeIframes must be a boolean',
        value: action.includeIframes,
      });
    }
  }

  /**
   * Validate PDF action
   */
  private static validatePDFAction(action: any, errors: ValidationError[]): void {
    // Validate path if provided
    if (action.path !== undefined) {
      if (typeof action.path !== 'string') {
        errors.push({
          field: 'path',
          message: 'path must be a string',
          value: action.path,
        });
      } else {
        this.validateFilePath(action.path, 'path', errors);
      }
    }

    // Validate format if provided
    if (action.format !== undefined && typeof action.format !== 'string') {
      errors.push({
        field: 'format',
        message: 'format must be a string',
        value: action.format,
      });
    }

    // Validate printBackground if provided
    if (action.printBackground !== undefined && typeof action.printBackground !== 'boolean') {
      errors.push({
        field: 'printBackground',
        message: 'printBackground must be a boolean',
        value: action.printBackground,
      });
    }
  }

  /**
   * Validate execute JS action
   */
  private static validateExecuteJSAction(action: any, errors: ValidationError[]): void {
    // Script is required
    if (!action.script || typeof action.script !== 'string') {
      errors.push({
        field: 'script',
        message: 'Script is required and must be a string',
        value: action.script,
      });
      return;
    }

    // Validate JavaScript code for Node.js globals
    const jsValidation = this.validateJavaScriptCode(action.script);
    if (!jsValidation.valid) {
      errors.push(...jsValidation.errors);
    }

    // Validate args if provided
    if (action.args !== undefined && !Array.isArray(action.args)) {
      errors.push({
        field: 'args',
        message: 'args must be an array',
        value: action.args,
      });
    }
  }

  /**
   * Validate wait action
   */
  private static validateWaitAction(action: any, errors: ValidationError[]): void {
    // Condition is required
    if (!action.condition || typeof action.condition !== 'string') {
      errors.push({
        field: 'condition',
        message: 'Condition is required and must be a string',
        value: action.condition,
      });
      return;
    }

    const validConditions = ['selector', 'navigation', 'load_state', 'timeout'];
    if (!validConditions.includes(action.condition)) {
      errors.push({
        field: 'condition',
        message: `condition must be one of: ${validConditions.join(', ')}`,
        value: action.condition,
      });
      return;
    }

    // Validate based on condition type
    if (action.condition === 'selector') {
      if (!action.selector || typeof action.selector !== 'string') {
        errors.push({
          field: 'selector',
          message: 'selector is required for wait condition "selector"',
          value: action.selector,
        });
      } else {
        this.validateSelector(action.selector, 'selector', errors);
      }

      if (action.state !== undefined) {
        const validStates = ['attached', 'detached', 'visible', 'hidden'];
        if (!validStates.includes(action.state)) {
          errors.push({
            field: 'state',
            message: `state must be one of: ${validStates.join(', ')}`,
            value: action.state,
          });
        }
      }
    }

    if (action.condition === 'load_state') {
      if (!action.loadState || typeof action.loadState !== 'string') {
        errors.push({
          field: 'loadState',
          message: 'loadState is required for wait condition "load_state"',
          value: action.loadState,
        });
      } else {
        const validLoadStates = ['load', 'domcontentloaded', 'networkidle'];
        if (!validLoadStates.includes(action.loadState)) {
          errors.push({
            field: 'loadState',
            message: `loadState must be one of: ${validLoadStates.join(', ')}`,
            value: action.loadState,
          });
        }
      }
    }

    // Validate timeout if provided
    if (action.timeout !== undefined) {
      this.validateTimeout(action.timeout, 'timeout', errors);
    }
  }

  /**
   * Validate scroll action
   */
  private static validateScrollAction(action: any, errors: ValidationError[]): void {
    // Target is required
    if (!action.target || typeof action.target !== 'string') {
      errors.push({
        field: 'target',
        message: 'Target is required and must be a string',
        value: action.target,
      });
      return;
    }

    const validTargets = ['element', 'coordinates', 'top', 'bottom'];
    if (!validTargets.includes(action.target)) {
      errors.push({
        field: 'target',
        message: `target must be one of: ${validTargets.join(', ')}`,
        value: action.target,
      });
      return;
    }

    // Validate based on target type
    if (action.target === 'element') {
      if (!action.selector || typeof action.selector !== 'string') {
        errors.push({
          field: 'selector',
          message: 'selector is required for scroll target "element"',
          value: action.selector,
        });
      } else {
        this.validateSelector(action.selector, 'selector', errors);
      }
    }

    if (action.target === 'coordinates') {
      if (action.x === undefined || typeof action.x !== 'number') {
        errors.push({
          field: 'x',
          message: 'x coordinate is required for scroll target "coordinates"',
          value: action.x,
        });
      }
      if (action.y === undefined || typeof action.y !== 'number') {
        errors.push({
          field: 'y',
          message: 'y coordinate is required for scroll target "coordinates"',
          value: action.y,
        });
      }
    }
  }

  /**
   * Validate select action
   */
  private static validateSelectAction(action: any, errors: ValidationError[]): void {
    // Selector is required
    if (!action.selector || typeof action.selector !== 'string') {
      errors.push({
        field: 'selector',
        message: 'Selector is required and must be a string',
        value: action.selector,
      });
    } else {
      this.validateSelector(action.selector, 'selector', errors);
    }

    // Values is required
    if (!action.values || !Array.isArray(action.values)) {
      errors.push({
        field: 'values',
        message: 'Values is required and must be an array',
        value: action.values,
      });
    }
  }

  /**
   * Validate upload action
   */
  private static validateUploadAction(action: any, errors: ValidationError[]): void {
    // Selector is required
    if (!action.selector || typeof action.selector !== 'string') {
      errors.push({
        field: 'selector',
        message: 'Selector is required and must be a string',
        value: action.selector,
      });
    } else {
      this.validateSelector(action.selector, 'selector', errors);
    }

    // FilePaths is required
    if (!action.filePaths || !Array.isArray(action.filePaths)) {
      errors.push({
        field: 'filePaths',
        message: 'filePaths is required and must be an array',
        value: action.filePaths,
      });
    } else {
      // Validate each file path
      action.filePaths.forEach((filePath: any, index: number) => {
        if (typeof filePath !== 'string') {
          errors.push({
            field: `filePaths[${index}]`,
            message: 'File path must be a string',
            value: filePath,
          });
        } else {
          this.validateFilePath(filePath, `filePaths[${index}]`, errors);
        }
      });
    }
  }

  /**
   * Validate a selector for injection patterns
   */
  private static validateSelector(selector: string, field: string, errors: ValidationError[]): void {
    // Check for injection patterns
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(selector)) {
        errors.push({
          field,
          message: 'Selector contains potentially malicious patterns',
          value: selector,
        });
        return;
      }
    }

    // Check selector length
    if (selector.length > 1000) {
      errors.push({
        field,
        message: 'Selector is too long (max 1000 characters)',
        value: selector,
      });
    }
  }

  /**
   * Validate a file path for traversal attacks
   */
  private static validateFilePath(filePath: string, field: string, errors: ValidationError[]): void {
    // Check for path traversal patterns
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(filePath)) {
        errors.push({
          field,
          message: 'File path contains invalid characters or traversal patterns',
          value: filePath,
        });
        return;
      }
    }

    // Check path length
    if (filePath.length > 500) {
      errors.push({
        field,
        message: 'File path is too long (max 500 characters)',
        value: filePath,
      });
    }
  }

  /**
   * Validate a timeout value
   */
  private static validateTimeout(timeout: any, field: string, errors: ValidationError[]): void {
    if (typeof timeout !== 'number' || timeout < 0 || timeout > 300000) {
      errors.push({
        field,
        message: 'Timeout must be a number between 0 and 300000 (5 minutes)',
        value: timeout,
      });
    }
  }

  /**
   * Validate a positive integer within a range
   */
  private static validatePositiveInteger(
    value: any,
    field: string,
    errors: ValidationError[],
    min: number = 0,
    max: number = Number.MAX_SAFE_INTEGER
  ): void {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      errors.push({
        field,
        message: `${field} must be an integer between ${min} and ${max}`,
        value,
      });
    }
  }

  /**
   * Sanitize a file path to prevent directory traversal
   */
  static sanitizeFilePath(filePath: string, baseDir?: string): string {
    // If baseDir is provided, check for traversal BEFORE sanitization
    if (baseDir) {
      // Normalize both paths
      const resolvedPath = path.resolve(baseDir, filePath);
      const resolvedBase = path.resolve(baseDir);
      
      // Check if the resolved path is within the base directory
      if (!resolvedPath.startsWith(resolvedBase)) {
        throw new Error('File path escapes base directory');
      }
      
      return resolvedPath;
    }
    
    // Remove any path traversal patterns
    let sanitized = filePath.replace(/\.\.[\/\\]/g, '');
    
    // Remove leading slashes (absolute paths)
    sanitized = sanitized.replace(/^[\/\\]+/, '');
    
    // Remove invalid filename characters
    sanitized = sanitized.replace(/[<>:"|?*]/g, '');
    
    // Normalize the path
    sanitized = path.normalize(sanitized);
    
    return sanitized;
  }

  /**
   * Validate browser state structure
   */
  static validateBrowserState(state: any): ValidationResult {
    const errors: ValidationError[] = [];

    if (!state || typeof state !== 'object') {
      errors.push({
        field: 'state',
        message: 'State must be an object',
        value: state,
      });
      return { valid: false, errors };
    }

    // Validate cookies
    if (!Array.isArray(state.cookies)) {
      errors.push({
        field: 'cookies',
        message: 'cookies must be an array',
        value: state.cookies,
      });
    }

    // Validate localStorage
    if (typeof state.localStorage !== 'object' || state.localStorage === null) {
      errors.push({
        field: 'localStorage',
        message: 'localStorage must be an object',
        value: state.localStorage,
      });
    }

    // Validate sessionStorage
    if (typeof state.sessionStorage !== 'object' || state.sessionStorage === null) {
      errors.push({
        field: 'sessionStorage',
        message: 'sessionStorage must be an object',
        value: state.sessionStorage,
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Detect injection attempts in a string
   * Returns true if injection patterns are detected
   */
  static detectInjectionAttempt(value: string): boolean {
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect directory traversal attempts in a path
   * Returns true if traversal patterns are detected
   */
  static detectTraversalAttempt(path: string): boolean {
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(path)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validate JavaScript code for Node.js globals
   * Returns validation result with errors if Node.js globals are detected
   */
  static validateJavaScriptCode(script: string): ValidationResult {
    const errors: ValidationError[] = [];

    // List of Node.js globals that should not be accessible in page context
    const nodeGlobals = [
      'process',
      'require',
      '__dirname',
      '__filename',
      'module',
      'exports',
      'global',
      'Buffer',
      'setImmediate',
      'clearImmediate',
    ];

    // Check for Node.js globals
    for (const globalName of nodeGlobals) {
      // Match word boundaries to avoid false positives
      const regex = new RegExp(`\\b${globalName}\\b`, 'g');
      if (regex.test(script)) {
        errors.push({
          field: 'script',
          message: `JavaScript code contains Node.js global "${globalName}" which is not available in page context`,
          value: script,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
