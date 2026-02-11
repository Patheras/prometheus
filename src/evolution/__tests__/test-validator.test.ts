/**
 * Tests for Themis - Independent Test Validator
 */

import { TestValidator, GeneratedTest } from '../test-validator';
import { RuntimeEngine } from '../../runtime';

describe('TestValidator (Themis)', () => {
  let validator: TestValidator;
  let mockRuntimeEngine: jest.Mocked<RuntimeEngine>;

  beforeEach(() => {
    mockRuntimeEngine = {
      execute: jest.fn(),
    } as any;

    validator = new TestValidator(mockRuntimeEngine);
  });

  describe('validateTest', () => {
    it('should validate a correct test', async () => {
      const test: GeneratedTest = {
        code: `
describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
        `,
        target: {
          filePath: 'src/math.ts',
          name: 'add',
        },
        description: 'Test for add',
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: 'No issues found.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await validator.validateTest(test, sourceCode);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.validatedBy).toBe('themis');
    });

    it('should detect missing assertions', async () => {
      const test: GeneratedTest = {
        code: `
describe('add', () => {
  it('should add two numbers', () => {
    add(1, 2);
  });
});
        `,
        target: {
          filePath: 'src/math.ts',
          name: 'add',
        },
        description: 'Test for add',
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: 'No issues found.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await validator.validateTest(test, sourceCode);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'no_assertion',
          severity: 'critical',
        })
      );
    });

    it('should detect tautologies', async () => {
      const test: GeneratedTest = {
        code: `
describe('add', () => {
  it('should add two numbers', () => {
    expect(true).toBe(true);
  });
});
        `,
        target: {
          filePath: 'src/math.ts',
          name: 'add',
        },
        description: 'Test for add',
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: 'No issues found.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await validator.validateTest(test, sourceCode);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'tautology',
          severity: 'high',
        })
      );
    });

    it('should detect hallucinated functions', async () => {
      const test: GeneratedTest = {
        code: `
describe('add', () => {
  it('should add two numbers', () => {
    expect(multiply(1, 2)).toBe(2);
  });
});
        `,
        target: {
          filePath: 'src/math.ts',
          name: 'add',
        },
        description: 'Test for add',
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: 'No issues found.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await validator.validateTest(test, sourceCode);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'hallucination',
          severity: 'critical',
          description: expect.stringContaining('multiply'),
        })
      );
    });

    it('should detect potential flakiness', async () => {
      const test: GeneratedTest = {
        code: `
describe('add', () => {
  it('should add two numbers', () => {
    const timestamp = Date.now();
    expect(add(1, 2)).toBe(3);
  });
});
        `,
        target: {
          filePath: 'src/math.ts',
          name: 'add',
        },
        description: 'Test for add',
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: 'No issues found.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await validator.validateTest(test, sourceCode);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'flaky',
          severity: 'medium',
        })
      );
    });

    it('should detect syntax errors', async () => {
      const test: GeneratedTest = {
        code: `
describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  }
});
        `,
        target: {
          filePath: 'src/math.ts',
          name: 'add',
        },
        description: 'Test for add',
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: 'No issues found.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await validator.validateTest(test, sourceCode);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'syntax_error',
          severity: 'critical',
        })
      );
    });

    it('should parse semantic issues from LLM', async () => {
      const test: GeneratedTest = {
        code: `
describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(5);
  });
});
        `,
        target: {
          filePath: 'src/math.ts',
          name: 'add',
        },
        description: 'Test for add',
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: `
ISSUE: wrong_assertion
SEVERITY: high
DESCRIPTION: Test expects 5 but add(1, 2) returns 3
---
        `,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await validator.validateTest(test, sourceCode);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'wrong_assertion',
          severity: 'high',
          description: expect.stringContaining('expects 5'),
        })
      );
    });

    it('should calculate validation score correctly', async () => {
      const test: GeneratedTest = {
        code: `
describe('add', () => {
  it('should add two numbers', () => {
    expect(true).toBe(true);
  });
});
        `,
        target: {
          filePath: 'src/math.ts',
          name: 'add',
        },
        description: 'Test for add',
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: 'No issues found.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await validator.validateTest(test, sourceCode);

      // Should have tautology (high = -15)
      expect(result.score).toBeLessThan(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should generate recommendations', async () => {
      const test: GeneratedTest = {
        code: `
describe('add', () => {
  it('should add two numbers', () => {
    add(1, 2);
  });
});
        `,
        target: {
          filePath: 'src/math.ts',
          name: 'add',
        },
        description: 'Test for add',
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: 'No issues found.',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await validator.validateTest(test, sourceCode);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toContain('REJECT');
    });
  });
});
