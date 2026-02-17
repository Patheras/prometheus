/**
 * Self-Test Generator
 * 
 * Generates tests for Prometheus's own code.
 * Works with Themis (TestValidator) to ensure quality.
 */

import { RuntimeExecutor } from '../runtime/runtime-executor';
import { TestValidator, GeneratedTest, TestValidationResult } from './test-validator';

/**
 * Test generation result
 */
export type TestGenerationResult = {
  /** Generated test */
  test: GeneratedTest;
  /** Validation result from Themis */
  validation: TestValidationResult;
  /** Whether test was accepted */
  accepted: boolean;
  /** Generation attempts */
  attempts: number;
  /** Generated at timestamp */
  generatedAt: number;
};

/**
 * Test coverage gap
 */
export type CoverageGap = {
  /** File path */
  filePath: string;
  /** Function/class name */
  name: string;
  /** Function signature */
  signature: string;
  /** Current coverage (0-100) */
  currentCoverage: number;
  /** Priority (0-100) */
  priority: number;
};

/**
 * Self-Test Generator
 * 
 * Generates tests for Prometheus code with validation.
 */
export class TestGenerator {
  private maxAttempts = 3;

  constructor(
    private runtimeEngine: RuntimeExecutor,
    private testValidator: TestValidator
  ) {}

  /**
   * Generate test for a function
   * 
   * Uses LLM to generate test, then validates with Themis.
   * Retries if validation fails.
   * 
   * @param filePath - Source file path
   * @param functionName - Function to test
   * @param sourceCode - Source code
   * @returns Test generation result
   */
  async generateTest(
    filePath: string,
    functionName: string,
    sourceCode: string
  ): Promise<TestGenerationResult> {
    let attempts = 0;
    let lastValidation: TestValidationResult | null = null;

    while (attempts < this.maxAttempts) {
      attempts++;

      // Generate test
      const test = await this.generateTestCode(filePath, functionName, sourceCode, lastValidation);

      // Validate with Themis
      const validation = await this.testValidator.validateTest(test, sourceCode);

      // Check if accepted
      if (validation.isValid) {
        return {
          test,
          validation,
          accepted: true,
          attempts,
          generatedAt: Date.now(),
        };
      }

      // Store validation for next attempt
      lastValidation = validation;

      console.log(
        `Test generation attempt ${attempts}/${this.maxAttempts} failed. Score: ${validation.score}`
      );
    }

    // All attempts failed
    return {
      test: await this.generateTestCode(filePath, functionName, sourceCode, lastValidation),
      validation: lastValidation!,
      accepted: false,
      attempts,
      generatedAt: Date.now(),
    };
  }

  /**
   * Generate test code using LLM
   */
  private async generateTestCode(
    filePath: string,
    functionName: string,
    sourceCode: string,
    previousValidation?: TestValidationResult | null
  ): Promise<GeneratedTest> {
    const prompt = this.buildGenerationPrompt(
      filePath,
      functionName,
      sourceCode,
      previousValidation
    );

    try {
      const response = await this.runtimeEngine.execute({
        taskType: 'code_analysis',
        prompt,
        context: `You are a test generation expert. 
Generate high-quality, comprehensive tests.
Focus on edge cases and real behavior.
DO NOT hallucinate - only test actual functionality in the source code.`,
        maxTokens: 1000,
      });

      const code = this.extractTestCode(response.content);

      return {
        code,
        target: {
          filePath,
          name: functionName,
        },
        description: `Test for ${functionName}`,
        generatedBy: 'prometheus',
        generatedAt: Date.now(),
      };
    } catch (error) {
      throw new Error(`Test generation failed: ${error}`);
    }
  }

  /**
   * Build test generation prompt
   */
  private buildGenerationPrompt(
    _filePath: string,
    functionName: string,
    sourceCode: string,
    previousValidation?: TestValidationResult | null
  ): string {
    let prompt = `Generate a comprehensive test for this function.

SOURCE CODE:
\`\`\`typescript
${sourceCode}
\`\`\`

TARGET FUNCTION: ${functionName}

Requirements:
1. Test the actual behavior of the function
2. Include edge cases (null, undefined, empty, boundary values)
3. Use meaningful assertions
4. DO NOT test non-existent functionality
5. DO NOT use hallucinated functions or imports
6. Make tests deterministic (no Date.now(), Math.random())

`;

    if (previousValidation) {
      prompt += `\nPREVIOUS ATTEMPT FAILED with score ${previousValidation.score}.
Issues found:
${previousValidation.issues.map((i) => `- [${i.severity}] ${i.description}`).join('\n')}

Fix these issues in the new test.
`;
    }

    prompt += `\nGenerate ONLY the test code, wrapped in \`\`\`typescript blocks.`;

    return prompt;
  }

  /**
   * Extract test code from LLM response
   */
  private extractTestCode(response: string): string {
    // Extract code from markdown code blocks
    const match = response.match(/```(?:typescript|ts)?\n([\s\S]*?)\n```/);
    if (match && match[1]) {
      return match[1].trim();
    }

    // If no code block, return as-is
    return response.trim();
  }

  /**
   * Analyze test coverage gaps
   * 
   * Identifies functions that need tests.
   * 
   * @param filePath - Source file to analyze
   * @param sourceCode - Source code
   * @param existingTests - Existing test code
   * @returns Coverage gaps
   */
  async analyzeCoverageGaps(
    filePath: string,
    sourceCode: string,
    existingTests: string
  ): Promise<CoverageGap[]> {
    const prompt = `Analyze test coverage for this code.

SOURCE CODE:
\`\`\`typescript
${sourceCode}
\`\`\`

EXISTING TESTS:
\`\`\`typescript
${existingTests}
\`\`\`

Identify:
1. Functions that have NO tests
2. Functions with incomplete test coverage
3. Missing edge cases

For each gap, provide:
FUNCTION: [name]
SIGNATURE: [signature]
COVERAGE: [0-100]
PRIORITY: [0-100]
---`;

    try {
      const response = await this.runtimeEngine.execute({
        taskType: 'code_analysis',
        prompt,
        context: 'You are a test coverage analyzer. Be thorough and precise.',
        maxTokens: 800,
      });

      return this.parseCoverageGaps(response.content, filePath);
    } catch (error) {
      console.warn('Coverage analysis failed:', error);
      return [];
    }
  }

  /**
   * Parse coverage gaps from LLM response
   */
  private parseCoverageGaps(response: string, filePath: string): CoverageGap[] {
    const gaps: CoverageGap[] = [];
    const blocks = response.split('---').filter((b) => b.trim());

    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim());

      let name = '';
      let signature = '';
      let currentCoverage = 0;
      let priority = 50;

      for (const line of lines) {
        if (line.startsWith('FUNCTION:')) {
          name = line.substring(9).trim();
        } else if (line.startsWith('SIGNATURE:')) {
          signature = line.substring(10).trim();
        } else if (line.startsWith('COVERAGE:')) {
          const cov = parseInt(line.substring(9).trim(), 10);
          if (!isNaN(cov)) {
            currentCoverage = cov;
          }
        } else if (line.startsWith('PRIORITY:')) {
          const pri = parseInt(line.substring(9).trim(), 10);
          if (!isNaN(pri)) {
            priority = pri;
          }
        }
      }

      if (name) {
        gaps.push({
          filePath,
          name,
          signature,
          currentCoverage,
          priority,
        });
      }
    }

    // Sort by priority (highest first)
    return gaps.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate tests for all coverage gaps
   * 
   * @param gaps - Coverage gaps to fill
   * @param sourceCode - Source code
   * @returns Test generation results
   */
  async generateTestsForGaps(
    gaps: CoverageGap[],
    sourceCode: string
  ): Promise<TestGenerationResult[]> {
    const results: TestGenerationResult[] = [];

    for (const gap of gaps) {
      console.log(`Generating test for ${gap.name} (priority: ${gap.priority})...`);

      const result = await this.generateTest(gap.filePath, gap.name, sourceCode);

      results.push(result);

      // Stop if we hit too many failures
      if (!result.accepted && results.filter((r) => !r.accepted).length >= 3) {
        console.warn('Too many test generation failures. Stopping.');
        break;
      }
    }

    return results;
  }

  /**
   * Set maximum generation attempts
   */
  setMaxAttempts(attempts: number): void {
    this.maxAttempts = Math.max(1, Math.min(attempts, 5));
  }
}

/**
 * Create a test generator instance
 * 
 * @param runtimeEngine - Runtime engine for LLM calls
 * @param testValidator - Test validator (Themis)
 * @returns Test generator instance
 */
export function createTestGenerator(
  runtimeEngine: RuntimeExecutor,
  testValidator: TestValidator
): TestGenerator {
  return new TestGenerator(runtimeEngine, testValidator);
}
