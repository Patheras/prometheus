/**
 * Tests for PromotionRequestBuilder
 */

import { PromotionRequestBuilder, createPromotionRequestBuilder } from '../promotion-request-builder';
import { ChangeDescription, TestResults, ImpactAssessment, RollbackPlan } from '../dev-prod-manager';
import { SelfImprovementTask } from '../self-improvement-workflow';

describe('PromotionRequestBuilder', () => {
  let builder: PromotionRequestBuilder;

  const sampleChanges: ChangeDescription[] = [
    {
      file: 'src/memory/engine.ts',
      type: 'modified',
      linesAdded: 50,
      linesRemoved: 30,
      summary: 'Optimized memory allocation',
    },
  ];

  const sampleTestResults: TestResults = {
    passed: true,
    totalTests: 100,
    passedTests: 100,
    failedTests: 0,
    duration: 5000,
    failures: [],
    coverage: 85,
  };

  const sampleImpactAssessment: ImpactAssessment = {
    risk: 'low',
    affectedComponents: ['memory-engine'],
    estimatedDowntime: 0,
    rollbackComplexity: 'simple',
    benefits: ['Reduced memory usage by 20%'],
    risks: ['Potential edge cases in large files'],
  };

  const sampleRollbackPlan: RollbackPlan = {
    steps: ['Revert commit', 'Restart service'],
    estimatedTime: 5,
    dataBackupRequired: false,
    automatable: true,
  };

  beforeEach(() => {
    builder = createPromotionRequestBuilder();
  });

  describe('Builder Pattern', () => {
    it('should create builder', () => {
      expect(builder).toBeDefined();
    });

    it('should chain methods', () => {
      const result = builder
        .setTitle('Test')
        .setDescription('Description')
        .setChanges(sampleChanges);

      expect(result).toBe(builder);
    });

    it('should reset builder', () => {
      builder
        .setTitle('Test')
        .setDescription('Description')
        .reset();

      expect(() => builder.build()).toThrow('Invalid promotion request');
    });
  });

  describe('Building', () => {
    it('should build valid promotion request', () => {
      const template = builder
        .setTitle('Optimize memory')
        .setDescription('Reduce memory footprint')
        .setChanges(sampleChanges)
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan)
        .build();

      expect(template.title).toBe('Optimize memory');
      expect(template.changes.length).toBe(1);
      expect(template.testResults.passed).toBe(true);
    });

    it('should add single change', () => {
      builder
        .setTitle('Test')
        .setDescription('Test')
        .addChange(sampleChanges[0])
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const template = builder.build();
      expect(template.changes.length).toBe(1);
    });

    it('should build from task', () => {
      const task: SelfImprovementTask = {
        id: 'task-1',
        title: 'Optimize memory',
        description: 'Reduce footprint',
        category: 'performance',
        priority: 'high',
        estimatedEffort: 8,
        expectedBenefit: '20% less memory',
        createdAt: Date.now(),
        status: 'ready_for_promotion',
        changes: sampleChanges,
        testResults: sampleTestResults,
      };

      builder
        .fromTask(task)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const template = builder.build();
      expect(template.title).toBe(task.title);
      expect(template.description).toBe(task.description);
    });
  });

  describe('Validation', () => {
    it('should validate complete request', () => {
      builder
        .setTitle('Test')
        .setDescription('Description')
        .setChanges(sampleChanges)
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const validation = builder.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should require title', () => {
      builder
        .setDescription('Description')
        .setChanges(sampleChanges)
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const validation = builder.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Title'))).toBe(true);
    });

    it('should require description', () => {
      builder
        .setTitle('Test')
        .setChanges(sampleChanges)
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const validation = builder.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Description'))).toBe(true);
    });

    it('should require changes', () => {
      builder
        .setTitle('Test')
        .setDescription('Description')
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const validation = builder.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('change'))).toBe(true);
    });

    it('should require test results', () => {
      builder
        .setTitle('Test')
        .setDescription('Description')
        .setChanges(sampleChanges)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const validation = builder.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Test results'))).toBe(true);
    });

    it('should require passing tests', () => {
      builder
        .setTitle('Test')
        .setDescription('Description')
        .setChanges(sampleChanges)
        .setTestResults({
          ...sampleTestResults,
          passed: false,
          failedTests: 2,
        })
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const validation = builder.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('tests must pass'))).toBe(true);
    });

    it('should warn about high risk', () => {
      builder
        .setTitle('Test')
        .setDescription('Description')
        .setChanges(sampleChanges)
        .setTestResults(sampleTestResults)
        .setImpactAssessment({
          ...sampleImpactAssessment,
          risk: 'high',
        })
        .setRollbackPlan(sampleRollbackPlan);

      const validation = builder.validate();
      expect(validation.warnings.some(w => w.includes('high-risk'))).toBe(true);
    });

    it('should warn about downtime', () => {
      builder
        .setTitle('Test')
        .setDescription('Description')
        .setChanges(sampleChanges)
        .setTestResults(sampleTestResults)
        .setImpactAssessment({
          ...sampleImpactAssessment,
          estimatedDowntime: 10,
        })
        .setRollbackPlan(sampleRollbackPlan);

      const validation = builder.validate();
      expect(validation.warnings.some(w => w.includes('downtime'))).toBe(true);
    });

    it('should throw on invalid build', () => {
      builder.setTitle('Test');

      expect(() => builder.build()).toThrow('Invalid promotion request');
    });
  });

  describe('Formatting', () => {
    beforeEach(() => {
      builder
        .setTitle('Optimize memory')
        .setDescription('Reduce memory footprint')
        .setChanges(sampleChanges)
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);
    });

    it('should format as markdown', () => {
      const formatted = builder.buildFormatted();

      expect(formatted.markdown).toContain('# Optimize memory');
      expect(formatted.markdown).toContain('## Summary');
      expect(formatted.markdown).toContain('## Changes');
      expect(formatted.markdown).toContain('## Test Results');
      expect(formatted.markdown).toContain('## Impact Assessment');
      expect(formatted.markdown).toContain('## Rollback Plan');
    });

    it('should format as HTML', () => {
      const formatted = builder.buildFormatted();

      expect(formatted.html).toContain('<h1>Optimize memory</h1>');
      expect(formatted.html).toContain('class="promotion-request"');
      expect(formatted.html).toContain('class="summary-card"');
      expect(formatted.html).toContain('class="changes"');
    });

    it('should format as JSON', () => {
      const formatted = builder.buildFormatted();
      const parsed = JSON.parse(formatted.json);

      expect(parsed.title).toBe('Optimize memory');
      expect(parsed.changes).toBeDefined();
    });

    it('should generate summary', () => {
      const formatted = builder.buildFormatted();

      expect(formatted.summary.totalFiles).toBe(1);
      expect(formatted.summary.totalLinesAdded).toBe(50);
      expect(formatted.summary.totalLinesRemoved).toBe(30);
      expect(formatted.summary.testsPassed).toBe(true);
      expect(formatted.summary.coverage).toBe(85);
      expect(formatted.summary.riskLevel).toBe('low');
    });

    it('should include risk emoji in markdown', () => {
      const formatted = builder.buildFormatted();

      expect(formatted.markdown).toContain('🟢'); // Low risk emoji
    });

    it('should include change icons in markdown', () => {
      const formatted = builder.buildFormatted();

      expect(formatted.markdown).toContain('✏️'); // Modified icon
    });

    it('should escape HTML in HTML format', () => {
      builder.setTitle('Test <script>alert("xss")</script>');

      const formatted = builder.buildFormatted();

      expect(formatted.html).not.toContain('<script>');
      expect(formatted.html).toContain('&lt;script&gt;');
    });
  });

  describe('Summary Statistics', () => {
    it('should calculate total lines', () => {
      builder
        .setTitle('Test')
        .setDescription('Test')
        .setChanges([
          { file: 'a.ts', type: 'modified', linesAdded: 10, linesRemoved: 5, summary: 'A' },
          { file: 'b.ts', type: 'modified', linesAdded: 20, linesRemoved: 15, summary: 'B' },
        ])
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const formatted = builder.buildFormatted();

      expect(formatted.summary.totalLinesAdded).toBe(30);
      expect(formatted.summary.totalLinesRemoved).toBe(20);
    });

    it('should count files', () => {
      builder
        .setTitle('Test')
        .setDescription('Test')
        .setChanges([
          { file: 'a.ts', type: 'modified', linesAdded: 10, linesRemoved: 5, summary: 'A' },
          { file: 'b.ts', type: 'modified', linesAdded: 20, linesRemoved: 15, summary: 'B' },
          { file: 'c.ts', type: 'added', linesAdded: 30, linesRemoved: 0, summary: 'C' },
        ])
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan);

      const formatted = builder.buildFormatted();

      expect(formatted.summary.totalFiles).toBe(3);
    });
  });

  describe('Metadata', () => {
    it('should set metadata', () => {
      builder
        .setTitle('Test')
        .setDescription('Test')
        .setChanges(sampleChanges)
        .setTestResults(sampleTestResults)
        .setImpactAssessment(sampleImpactAssessment)
        .setRollbackPlan(sampleRollbackPlan)
        .setMetadata({
          taskId: 'task-123',
          category: 'performance',
        });

      const template = builder.build();

      expect(template.metadata?.taskId).toBe('task-123');
      expect(template.metadata?.category).toBe('performance');
    });
  });
});
