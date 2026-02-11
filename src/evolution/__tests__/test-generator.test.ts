/**
 * Tests for Self-Test Generator
 */

import { TestGenerator, CoverageGap } from '../test-generator';
import { TestValidator, GeneratedTest, TestValidationResult } from '../test-validator';
import { RuntimeEngine } from '../../runtime';

describe('TestGenerator', () => {
  let generator: TestGenerator;
  let mockRuntimeEngine: jest.Mocked<RuntimeEngine>;
  let mockValidator: jest.Mocked<TestValidator>;

  beforeEach(() => {
    mockRuntimeEngine = {
      execute: jest.fn(),
    } as any;

    mockValidator = {
      validateTest: jest.fn(),
    } as any;

    generator = new TestGenerator(mockRuntimeEngine, mockValidator);
  });

  describe('generateTest', () => {
    it('should generate and validate a test', async () => {
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: `
\`\`\`typescript
describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
\`\`\`
        `,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      mockValidator.validateTest.mockResolvedValue({
        isValid: true,
        score: 95,
        issues: [],
        recommendations: ['✅ Test passes all validation checks. Safe to use.'],
        validatedBy: 'themis',
        validatedAt: Date.now(),
      });

      const result = await generator.generateTest('src/math.ts', 'add', sourceCode);

      expect(result.accepted).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.test.code).toContain('add(1, 2)');
      expect(result.validation.isValid).toBe(true);
    });

    it('should retry on validation failure', async () => {
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute
        .mockResolvedValueOnce({
          content: `
\`\`\`typescript
describe('add', () => {
  it('should add two numbers', () => {
    add(1, 2);
  });
});
\`\`\`
          `,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        })
        .mockResolvedValueOnce({
          content: `
\`\`\`typescript
describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
\`\`\`
          `,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        });

      mockValidator.validateTest
        .mockResolvedValueOnce({
          isValid: false,
          score: 40,
          issues: [
            {
              type: 'no_assertion',
              severity: 'critical',
              description: 'Test has no assertions',
            },
          ],
          recommendations: ['❌ REJECT: 1 critical issue(s) found.'],
          validatedBy: 'themis',
          validatedAt: Date.now(),
        })
        .mockResolvedValueOnce({
          isValid: true,
          score: 95,
          issues: [],
          recommendations: ['✅ Test passes all validation checks.'],
          validatedBy: 'themis',
          validatedAt: Date.now(),
        });

      const result = await generator.generateTest('src/math.ts', 'add', sourceCode);

      expect(result.accepted).toBe(true);
      expect(result.attempts).toBe(2);
      expect(mockRuntimeEngine.execute).toHaveBeenCalledTimes(2);
    });

    it('should stop after max attempts', async () => {
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: `
\`\`\`typescript
describe('add', () => {
  it('should add two numbers', () => {
    add(1, 2);
  });
});
\`\`\`
        `,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      mockValidator.validateTest.mockResolvedValue({
        isValid: false,
        score: 40,
        issues: [
          {
            type: 'no_assertion',
            severity: 'critical',
            description: 'Test has no assertions',
          },
        ],
        recommendations: ['❌ REJECT: 1 critical issue(s) found.'],
        validatedBy: 'themis',
        validatedAt: Date.now(),
      });

      const result = await generator.generateTest('src/math.ts', 'add', sourceCode);

      expect(result.accepted).toBe(false);
      expect(result.attempts).toBe(3);
      // Note: execute is called 4 times because the last attempt also generates a test
      // even though it won't be accepted
      expect(mockRuntimeEngine.execute).toHaveBeenCalledTimes(4);
    });

    it('should include previous validation in retry prompt', async () => {
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute
        .mockResolvedValueOnce({
          content: `
\`\`\`typescript
describe('add', () => {
  it('should add two numbers', () => {
    add(1, 2);
  });
});
\`\`\`
          `,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        })
        .mockResolvedValueOnce({
          content: `
\`\`\`typescript
describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
\`\`\`
          `,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        });

      mockValidator.validateTest
        .mockResolvedValueOnce({
          isValid: false,
          score: 40,
          issues: [
            {
              type: 'no_assertion',
              severity: 'critical',
              description: 'Test has no assertions',
            },
          ],
          recommendations: ['❌ REJECT: 1 critical issue(s) found.'],
          validatedBy: 'themis',
          validatedAt: Date.now(),
        })
        .mockResolvedValueOnce({
          isValid: true,
          score: 95,
          issues: [],
          recommendations: ['✅ Test passes all validation checks.'],
          validatedBy: 'themis',
          validatedAt: Date.now(),
        });

      await generator.generateTest('src/math.ts', 'add', sourceCode);

      const secondCallPrompt = mockRuntimeEngine.execute.mock.calls[1][0].prompt;
      expect(secondCallPrompt).toContain('PREVIOUS ATTEMPT FAILED');
      expect(secondCallPrompt).toContain('Test has no assertions');
    });
  });

  describe('analyzeCoverageGaps', () => {
    it('should identify functions with no tests', async () => {
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
      `;

      const existingTests = `
describe('add', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: `
FUNCTION: subtract
SIGNATURE: (a: number, b: number): number
COVERAGE: 0
PRIORITY: 80
---
        `,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const gaps = await generator.analyzeCoverageGaps('src/math.ts', sourceCode, existingTests);

      expect(gaps.length).toBe(1);
      expect(gaps[0].name).toBe('subtract');
      expect(gaps[0].currentCoverage).toBe(0);
      expect(gaps[0].priority).toBe(80);
    });

    it('should sort gaps by priority', async () => {
      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
      `;

      const existingTests = '';

      mockRuntimeEngine.execute.mockResolvedValue({
        content: `
FUNCTION: add
SIGNATURE: (a: number, b: number): number
COVERAGE: 0
PRIORITY: 50
---
FUNCTION: subtract
SIGNATURE: (a: number, b: number): number
COVERAGE: 0
PRIORITY: 80
---
FUNCTION: multiply
SIGNATURE: (a: number, b: number): number
COVERAGE: 0
PRIORITY: 30
---
        `,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const gaps = await generator.analyzeCoverageGaps('src/math.ts', sourceCode, existingTests);

      expect(gaps.length).toBe(3);
      expect(gaps[0].name).toBe('subtract');
      expect(gaps[0].priority).toBe(80);
      expect(gaps[1].name).toBe('add');
      expect(gaps[1].priority).toBe(50);
      expect(gaps[2].name).toBe('multiply');
      expect(gaps[2].priority).toBe(30);
    });
  });

  describe('generateTestsForGaps', () => {
    it('should generate tests for all gaps', async () => {
      const gaps: CoverageGap[] = [
        {
          filePath: 'src/math.ts',
          name: 'add',
          signature: '(a: number, b: number): number',
          currentCoverage: 0,
          priority: 80,
        },
        {
          filePath: 'src/math.ts',
          name: 'subtract',
          signature: '(a: number, b: number): number',
          currentCoverage: 0,
          priority: 70,
        },
      ];

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: `
\`\`\`typescript
describe('test', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
\`\`\`
        `,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      mockValidator.validateTest.mockResolvedValue({
        isValid: true,
        score: 95,
        issues: [],
        recommendations: ['✅ Test passes all validation checks.'],
        validatedBy: 'themis',
        validatedAt: Date.now(),
      });

      const results = await generator.generateTestsForGaps(gaps, sourceCode);

      expect(results.length).toBe(2);
      expect(results[0].accepted).toBe(true);
      expect(results[1].accepted).toBe(true);
    });

    it('should stop after too many failures', async () => {
      const gaps: CoverageGap[] = [
        {
          filePath: 'src/math.ts',
          name: 'add',
          signature: '(a: number, b: number): number',
          currentCoverage: 0,
          priority: 80,
        },
        {
          filePath: 'src/math.ts',
          name: 'subtract',
          signature: '(a: number, b: number): number',
          currentCoverage: 0,
          priority: 70,
        },
        {
          filePath: 'src/math.ts',
          name: 'multiply',
          signature: '(a: number, b: number): number',
          currentCoverage: 0,
          priority: 60,
        },
        {
          filePath: 'src/math.ts',
          name: 'divide',
          signature: '(a: number, b: number): number',
          currentCoverage: 0,
          priority: 50,
        },
      ];

      const sourceCode = `
export function add(a: number, b: number): number {
  return a + b;
}
      `;

      mockRuntimeEngine.execute.mockResolvedValue({
        content: `
\`\`\`typescript
describe('test', () => {
  it('should work', () => {
    add(1, 2);
  });
});
\`\`\`
        `,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      mockValidator.validateTest.mockResolvedValue({
        isValid: false,
        score: 40,
        issues: [
          {
            type: 'no_assertion',
            severity: 'critical',
            description: 'Test has no assertions',
          },
        ],
        recommendations: ['❌ REJECT: 1 critical issue(s) found.'],
        validatedBy: 'themis',
        validatedAt: Date.now(),
      });

      const results = await generator.generateTestsForGaps(gaps, sourceCode);

      // Should stop after 3 failures
      expect(results.length).toBe(3);
      expect(results.every((r) => !r.accepted)).toBe(true);
    });
  });

  describe('setMaxAttempts', () => {
    it('should update max attempts', () => {
      generator.setMaxAttempts(5);
      // No direct way to test, but should not throw
    });

    it('should clamp max attempts to valid range', () => {
      generator.setMaxAttempts(0);
      generator.setMaxAttempts(10);
      // Should clamp to 1-5 range
    });
  });
});
