/**
 * Request Validator Tests
 * 
 * Tests for request validation and sanitization.
 */

import { RequestValidator } from '../../validation/request-validator.js';

describe('RequestValidator', () => {
  describe('validateAction', () => {
    it('should reject non-object actions', () => {
      const result = RequestValidator.validateAction(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('action');
    });

    it('should reject actions without type', () => {
      const result = RequestValidator.validateAction({});
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('action.type');
    });

    it('should reject unknown action types', () => {
      const result = RequestValidator.validateAction({ type: 'unknown' });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('action.type');
    });

    describe('navigate action', () => {
      it('should accept valid navigate action', () => {
        const result = RequestValidator.validateAction({
          type: 'navigate',
          url: 'https://example.com',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject navigate without URL', () => {
        const result = RequestValidator.validateAction({
          type: 'navigate',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'url')).toBe(true);
      });

      it('should reject invalid URL', () => {
        const result = RequestValidator.validateAction({
          type: 'navigate',
          url: 'not-a-url',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'url')).toBe(true);
      });

      it('should reject invalid waitUntil', () => {
        const result = RequestValidator.validateAction({
          type: 'navigate',
          url: 'https://example.com',
          waitUntil: 'invalid',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'waitUntil')).toBe(true);
      });

      it('should reject invalid timeout', () => {
        const result = RequestValidator.validateAction({
          type: 'navigate',
          url: 'https://example.com',
          timeout: -1,
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'timeout')).toBe(true);
      });
    });

    describe('click action', () => {
      it('should accept valid click action', () => {
        const result = RequestValidator.validateAction({
          type: 'click',
          selector: '#button',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject click without selector', () => {
        const result = RequestValidator.validateAction({
          type: 'click',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'selector')).toBe(true);
      });

      it('should reject selector with injection patterns', () => {
        const result = RequestValidator.validateAction({
          type: 'click',
          selector: "'; DROP TABLE users; --",
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'selector')).toBe(true);
      });

      it('should reject selector with script tags', () => {
        const result = RequestValidator.validateAction({
          type: 'click',
          selector: '<script>alert("xss")</script>',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'selector')).toBe(true);
      });

      it('should reject invalid button', () => {
        const result = RequestValidator.validateAction({
          type: 'click',
          selector: '#button',
          button: 'invalid',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'button')).toBe(true);
      });

      it('should reject invalid clickCount', () => {
        const result = RequestValidator.validateAction({
          type: 'click',
          selector: '#button',
          clickCount: 100,
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'clickCount')).toBe(true);
      });
    });

    describe('type action', () => {
      it('should accept valid type action', () => {
        const result = RequestValidator.validateAction({
          type: 'type',
          selector: '#input',
          text: 'hello',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject type without selector', () => {
        const result = RequestValidator.validateAction({
          type: 'type',
          text: 'hello',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'selector')).toBe(true);
      });

      it('should reject type without text', () => {
        const result = RequestValidator.validateAction({
          type: 'type',
          selector: '#input',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'text')).toBe(true);
      });
    });

    describe('screenshot action', () => {
      it('should accept valid screenshot action', () => {
        const result = RequestValidator.validateAction({
          type: 'screenshot',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid format', () => {
        const result = RequestValidator.validateAction({
          type: 'screenshot',
          format: 'gif',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'format')).toBe(true);
      });

      it('should reject invalid quality', () => {
        const result = RequestValidator.validateAction({
          type: 'screenshot',
          quality: 150,
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'quality')).toBe(true);
      });

      it('should reject path with traversal', () => {
        const result = RequestValidator.validateAction({
          type: 'screenshot',
          path: '../../etc/passwd',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'path')).toBe(true);
      });
    });

    describe('upload action', () => {
      it('should accept valid upload action', () => {
        const result = RequestValidator.validateAction({
          type: 'upload',
          selector: '#file-input',
          filePaths: ['file1.txt', 'file2.txt'],
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject upload without filePaths', () => {
        const result = RequestValidator.validateAction({
          type: 'upload',
          selector: '#file-input',
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'filePaths')).toBe(true);
      });

      it('should reject filePaths with traversal', () => {
        const result = RequestValidator.validateAction({
          type: 'upload',
          selector: '#file-input',
          filePaths: ['../../../etc/passwd'],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field.startsWith('filePaths'))).toBe(true);
      });
    });
  });

  describe('sanitizeFilePath', () => {
    it('should remove path traversal patterns', () => {
      const sanitized = RequestValidator.sanitizeFilePath('../../../etc/passwd');
      expect(sanitized).not.toContain('..');
    });

    it('should remove leading slashes', () => {
      const sanitized = RequestValidator.sanitizeFilePath('/etc/passwd');
      expect(sanitized).not.toMatch(/^[\/\\]/);
    });

    it('should remove invalid filename characters', () => {
      const sanitized = RequestValidator.sanitizeFilePath('file<>:"|?*.txt');
      expect(sanitized).not.toMatch(/[<>:"|?*]/);
    });

    it('should throw error if path escapes base directory', () => {
      expect(() => {
        RequestValidator.sanitizeFilePath('../outside', '/base/dir');
      }).toThrow('File path escapes base directory');
    });

    it('should allow valid paths within base directory', () => {
      const sanitized = RequestValidator.sanitizeFilePath('subdir/file.txt', '/base/dir');
      expect(sanitized).toContain('subdir');
      expect(sanitized).toContain('file.txt');
    });
  });

  describe('validateBrowserState', () => {
    it('should accept valid browser state', () => {
      const result = RequestValidator.validateBrowserState({
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        version: '1.0',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object state', () => {
      const result = RequestValidator.validateBrowserState(null);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'state')).toBe(true);
    });

    it('should reject state without cookies array', () => {
      const result = RequestValidator.validateBrowserState({
        cookies: 'not-an-array',
        localStorage: {},
        sessionStorage: {},
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'cookies')).toBe(true);
    });

    it('should reject state without localStorage object', () => {
      const result = RequestValidator.validateBrowserState({
        cookies: [],
        localStorage: null,
        sessionStorage: {},
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'localStorage')).toBe(true);
    });

    it('should reject state without sessionStorage object', () => {
      const result = RequestValidator.validateBrowserState({
        cookies: [],
        localStorage: {},
        sessionStorage: null,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'sessionStorage')).toBe(true);
    });
  });
});
