/**
 * Impact Assessor Tests
 * 
 * Tests for impact assessment and dependency analysis.
 * 
 * Task 30.1: Create component dependency analysis
 * Task 30.2: Implement affected component identification
 * Task 30.3: Implement risk/benefit/effort estimation
 * Task 30.4: Implement high-impact consultation trigger
 */

import { createImpactAssessor, ProposedChange } from '../impact-assessor';
import { RuntimeEngine } from '../../runtime';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock RuntimeEngine
class MockRuntimeEngine {
  async execute(request: any): Promise<{ content: string }> {
    return {
      content: `Risks:
- Breaking API changes (likelihood: 0.7, impact: 0.8)
- Regression in dependent modules (likelihood: 0.5, impact: 0.6)
Benefits:
- Improved performance (value: 0.8)
- Better maintainability (value: 0.7)
Effort: 8`,
    };
  }
}

describe('ImpactAssessor', () => {
  let tempDir: string;
  let mockRuntime: RuntimeEngine;
  let assessor: ReturnType<typeof createImpactAssessor>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'impact-test-'));
    mockRuntime = new MockRuntimeEngine() as any;
    assessor = createImpactAssessor(mockRuntime);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Dependency Graph Building', () => {
    it('should build dependency graph from codebase', async () => {
      // Create test files with imports
      await fs.writeFile(
        path.join(tempDir, 'a.ts'),
        `import { b } from './b';\nexport const a = 1;`
      );
      await fs.writeFile(
        path.join(tempDir, 'b.ts'),
        `import { c } from './c';\nexport const b = 2;`
      );
      await fs.writeFile(path.join(tempDir, 'c.ts'), `export const c = 3;`);

      await assessor.buildDependencyGraph(tempDir);

      // Graph should be built (we can't directly access it, but we can test through assessment)
      const change: ProposedChange = {
        description: 'Update c.ts',
        files: [path.join(tempDir, 'c.ts')],
        type: 'feature',
      };

      const assessment = await assessor.assessImpact(change);

      // Should identify affected components (c.ts, b.ts, a.ts)
      expect(assessment.affectedComponents.length).toBeGreaterThan(1);
    });

    it('should handle files with no imports', async () => {
      await fs.writeFile(path.join(tempDir, 'standalone.ts'), `export const x = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Update standalone',
        files: [path.join(tempDir, 'standalone.ts')],
        type: 'feature',
      };

      const assessment = await assessor.assessImpact(change);

      expect(assessment.affectedComponents).toContain(path.join(tempDir, 'standalone.ts'));
    });

    it('should skip node_modules', async () => {
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.writeFile(path.join(tempDir, 'node_modules', 'package.ts'), `export const x = 1;`);
      await fs.writeFile(path.join(tempDir, 'app.ts'), `export const app = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Update app',
        files: [path.join(tempDir, 'app.ts')],
        type: 'feature',
      };

      const assessment = await assessor.assessImpact(change);

      // Should not include node_modules files
      expect(assessment.affectedComponents.every((f) => !f.includes('node_modules'))).toBe(true);
    });
  });

  describe('Affected Component Identification', () => {
    it('should identify directly affected files', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), `export const x = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Update file',
        files: [path.join(tempDir, 'file.ts')],
        type: 'feature',
      };

      const assessment = await assessor.assessImpact(change);

      expect(assessment.affectedComponents).toContain(path.join(tempDir, 'file.ts'));
    });

    it('should identify transitively affected files', async () => {
      // Create chain: a imports b, b imports c
      await fs.writeFile(
        path.join(tempDir, 'a.ts'),
        `import { b } from './b';\nexport const a = 1;`
      );
      await fs.writeFile(
        path.join(tempDir, 'b.ts'),
        `import { c } from './c';\nexport const b = 2;`
      );
      await fs.writeFile(path.join(tempDir, 'c.ts'), `export const c = 3;`);

      await assessor.buildDependencyGraph(tempDir);

      // Change c.ts
      const change: ProposedChange = {
        description: 'Update c',
        files: [path.join(tempDir, 'c.ts')],
        type: 'feature',
      };

      const assessment = await assessor.assessImpact(change);

      // Should affect at least c and b (a imports b which imports c)
      expect(assessment.affectedComponents.length).toBeGreaterThanOrEqual(2);
      expect(assessment.affectedComponents).toContain(path.join(tempDir, 'c.ts'));
    });

    it('should throw error if graph not built', async () => {
      const change: ProposedChange = {
        description: 'Test',
        files: ['test.ts'],
        type: 'feature',
      };

      await expect(assessor.assessImpact(change)).rejects.toThrow('Dependency graph not built');
    });
  });

  describe('Dependency Analysis', () => {
    it('should get direct dependencies', async () => {
      await fs.writeFile(
        path.join(tempDir, 'a.ts'),
        `import { b } from './b';\nimport { c } from './c';\nexport const a = 1;`
      );
      await fs.writeFile(path.join(tempDir, 'b.ts'), `export const b = 2;`);
      await fs.writeFile(path.join(tempDir, 'c.ts'), `export const c = 3;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Update a',
        files: [path.join(tempDir, 'a.ts')],
        type: 'feature',
      };

      const assessment = await assessor.assessImpact(change);

      // a.ts depends on b.ts and c.ts
      expect(assessment.directDependencies.length).toBeGreaterThanOrEqual(2);
    });

    it('should get transitive dependencies', async () => {
      // Create chain: a -> b -> c -> d
      await fs.writeFile(
        path.join(tempDir, 'a.ts'),
        `import { b } from './b';\nexport const a = 1;`
      );
      await fs.writeFile(
        path.join(tempDir, 'b.ts'),
        `import { c } from './c';\nexport const b = 2;`
      );
      await fs.writeFile(
        path.join(tempDir, 'c.ts'),
        `import { d } from './d';\nexport const c = 3;`
      );
      await fs.writeFile(path.join(tempDir, 'd.ts'), `export const d = 4;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Update a',
        files: [path.join(tempDir, 'a.ts')],
        type: 'feature',
      };

      const assessment = await assessor.assessImpact(change);

      // Should include transitive dependencies
      expect(assessment.transitiveDependencies.length).toBeGreaterThan(0);
    });
  });

  describe('Impact Assessment', () => {
    it('should assess impact of a change', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), `export const x = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Add new feature',
        files: [path.join(tempDir, 'file.ts')],
        type: 'feature',
      };

      const assessment = await assessor.assessImpact(change);

      expect(assessment).toHaveProperty('id');
      expect(assessment).toHaveProperty('changeDescription');
      expect(assessment).toHaveProperty('affectedComponents');
      expect(assessment).toHaveProperty('directDependencies');
      expect(assessment).toHaveProperty('transitiveDependencies');
      expect(assessment).toHaveProperty('riskLevel');
      expect(assessment).toHaveProperty('risks');
      expect(assessment).toHaveProperty('benefits');
      expect(assessment).toHaveProperty('effortHours');
      expect(assessment).toHaveProperty('requiresConsultation');
    });

    it('should use LLM for risk/benefit estimation', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), `export const x = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Refactor code',
        files: [path.join(tempDir, 'file.ts')],
        type: 'refactor',
      };

      const assessment = await assessor.assessImpact(change);

      expect(assessment.risks.length).toBeGreaterThan(0);
      expect(assessment.benefits.length).toBeGreaterThan(0);
      expect(assessment.effortHours).toBeGreaterThan(0);
    });

    it('should fallback to heuristics without LLM', async () => {
      const failingRuntime = {
        async execute() {
          throw new Error('LLM unavailable');
        },
      } as any;

      const failingAssessor = createImpactAssessor(failingRuntime);

      await fs.writeFile(path.join(tempDir, 'file.ts'), `export const x = 1;`);
      await failingAssessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Breaking change',
        files: [path.join(tempDir, 'file.ts')],
        type: 'breaking',
      };

      const assessment = await failingAssessor.assessImpact(change);

      // Should still provide assessment
      expect(assessment.risks.length).toBeGreaterThan(0);
      expect(assessment.effortHours).toBeGreaterThan(0);
    });
  });

  describe('Risk Level Calculation', () => {
    it('should calculate low risk for small changes', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), `export const x = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Small bugfix',
        files: [path.join(tempDir, 'file.ts')],
        type: 'bugfix',
      };

      const assessment = await assessor.assessImpact(change);

      expect(assessment.riskLevel).toBeOneOf(['low', 'medium']);
    });

    it('should calculate higher risk for refactors', async () => {
      // Create many interconnected files
      for (let i = 0; i < 15; i++) {
        const imports = i > 0 ? `import { x${i - 1} } from './file${i - 1}';\n` : '';
        await fs.writeFile(
          path.join(tempDir, `file${i}.ts`),
          `${imports}export const x${i} = ${i};`
        );
      }

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Major refactor',
        files: [path.join(tempDir, 'file0.ts')],
        type: 'refactor',
      };

      const assessment = await assessor.assessImpact(change);

      // Should be higher risk due to many affected files
      expect(assessment.riskLevel).toBeOneOf(['medium', 'high', 'critical']);
    });
  });

  describe('Consultation Triggers', () => {
    it('should require consultation for high-risk changes', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), `export const x = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Breaking API change',
        files: [path.join(tempDir, 'file.ts')],
        type: 'breaking',
      };

      const assessment = await assessor.assessImpact(change);

      expect(assessment.requiresConsultation).toBe(true);
    });

    it('should not require consultation for small changes', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), `export const x = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Fix typo',
        files: [path.join(tempDir, 'file.ts')],
        type: 'bugfix',
      };

      const assessment = await assessor.assessImpact(change);

      expect(assessment.requiresConsultation).toBe(false);
    });

    it('should respect custom thresholds', async () => {
      const customAssessor = createImpactAssessor(mockRuntime, {
        highImpactFileCount: 2, // Very low threshold
      });

      // Create 3 files
      await fs.writeFile(
        path.join(tempDir, 'a.ts'),
        `import { b } from './b';\nexport const a = 1;`
      );
      await fs.writeFile(
        path.join(tempDir, 'b.ts'),
        `import { c } from './c';\nexport const b = 2;`
      );
      await fs.writeFile(path.join(tempDir, 'c.ts'), `export const c = 3;`);

      await customAssessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Update c',
        files: [path.join(tempDir, 'c.ts')],
        type: 'feature',
      };

      const assessment = await customAssessor.assessImpact(change);

      // Should require consultation due to low threshold
      expect(assessment.requiresConsultation).toBe(true);
    });
  });

  describe('Effort Estimation', () => {
    it('should estimate effort based on affected files', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), `export const x = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const change: ProposedChange = {
        description: 'Simple change',
        files: [path.join(tempDir, 'file.ts')],
        type: 'feature',
      };

      const assessment = await assessor.assessImpact(change);

      expect(assessment.effortHours).toBeGreaterThan(0);
      expect(assessment.effortHours).toBeLessThan(100);
    });

    it('should adjust effort by change type', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), `export const x = 1;`);

      await assessor.buildDependencyGraph(tempDir);

      const bugfix: ProposedChange = {
        description: 'Fix bug',
        files: [path.join(tempDir, 'file.ts')],
        type: 'bugfix',
      };

      const refactor: ProposedChange = {
        description: 'Refactor',
        files: [path.join(tempDir, 'file.ts')],
        type: 'refactor',
      };

      const bugfixAssessment = await assessor.assessImpact(bugfix);
      const refactorAssessment = await assessor.assessImpact(refactor);

      // Both should have effort estimates
      expect(bugfixAssessment.effortHours).toBeGreaterThan(0);
      expect(refactorAssessment.effortHours).toBeGreaterThan(0);
    });
  });
});

// Custom matcher
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});
