/**
 * Self-Analyzer Tests
 * 
 * Tests for self-code analysis system.
 * 
 * Task 37.2: Apply quality analysis to self-code
 */

import { SelfAnalyzer } from '../self-analyzer';
import { createCodeQualityAnalyzer } from '../../analysis/code-quality-analyzer';
import { createDebtDetector } from '../../analysis/debt-detector';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SelfAnalyzer', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'self-analyzer-'));
    
    // Create mock Prometheus structure
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Self-Analysis Execution', () => {
    it('should analyze Prometheus codebase', async () => {
      // Create mock Prometheus files
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `
        function complexFunction(a, b, c, d, e, f) {
          if (a > 0) {
            if (b > 0) {
              return 42;
            }
          }
          return 0;
        }
        `
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: true,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      const result = await analyzer.runAnalysis();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('debt');
      expect(result).toHaveProperty('improvements');
      expect(result).toHaveProperty('metrics');
    });

    it('should apply same standards as external code', async () => {
      // Create problematic code
      await fs.writeFile(
        path.join(tempDir, 'src', 'bad.ts'),
        `
        // TODO: Fix this
        function bad(a, b, c, d, e, f, g) {
          return 42 * 3.14159;
        }
        `
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      const result = await analyzer.runAnalysis();

      // Should detect issues
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should detect technical debt in self-code', async () => {
      // Create code with debt
      await fs.writeFile(
        path.join(tempDir, 'src', 'debt.ts'),
        `
        // TODO: Implement properly
        // FIXME: This is broken
        function hasDebt() {
          return true;
        }
        `
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      const result = await analyzer.runAnalysis();

      // Should detect debt
      expect(result.debt.length).toBeGreaterThan(0);
    });

    it('should calculate self-metrics', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'simple.ts'),
        `
        function add(a: number, b: number) {
          return a + b;
        }
        `
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      const result = await analyzer.runAnalysis();

      expect(result.metrics.totalFiles).toBeGreaterThan(0);
      expect(result.metrics.totalLines).toBeGreaterThan(0);
      expect(result.metrics.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.metrics.qualityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Improvement Identification', () => {
    it('should identify improvement opportunities', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'improve.ts'),
        `
        function needsImprovement(a, b, c, d, e, f, g) {
          if (a) {
            if (b) {
              if (c) {
                return 42;
              }
            }
          }
          return 0;
        }
        `
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      const result = await analyzer.runAnalysis();

      // Should have issues or improvements
      expect(result.issues.length + result.improvements.length).toBeGreaterThan(0);
      
      if (result.improvements.length > 0) {
        expect(result.improvements[0]).toHaveProperty('type');
        expect(result.improvements[0]).toHaveProperty('priority');
        expect(result.improvements[0]).toHaveProperty('description');
        expect(result.improvements[0]).toHaveProperty('suggestion');
      }
    });

    it('should prioritize improvements by impact', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'multi.ts'),
        `
        // TODO: Low priority
        function low() { return 1; }
        
        function high(a, b, c, d, e, f, g, h) {
          if (a) {
            if (b) {
              if (c) {
                if (d) {
                  return 42;
                }
              }
            }
          }
          return 0;
        }
        `
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      const result = await analyzer.runAnalysis();

      if (result.improvements.length > 1) {
        // Higher impact should be first
        expect(result.improvements[0].estimatedImpact).toBeGreaterThanOrEqual(
          result.improvements[result.improvements.length - 1].estimatedImpact
        );
      }
    });
  });

  describe('Analysis History', () => {
    it('should track analysis history', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        'function test() { return 1; }'
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      await analyzer.runAnalysis();
      await analyzer.runAnalysis();

      const history = analyzer.getAnalysisHistory();

      expect(history.length).toBe(2);
    });

    it('should limit history to last 10 analyses', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        'function test() { return 1; }'
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      // Run 15 analyses
      for (let i = 0; i < 15; i++) {
        await analyzer.runAnalysis();
      }

      const history = analyzer.getAnalysisHistory();

      expect(history.length).toBe(10);
    });

    it('should get last analysis', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        'function test() { return 1; }'
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      await analyzer.runAnalysis();
      const last = analyzer.getLastAnalysis();

      expect(last).toHaveProperty('timestamp');
      expect(last).toHaveProperty('metrics');
    });
  });

  describe('Improvement Metrics', () => {
    it('should track improvement trends', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        'function test() { return 1; }'
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      await analyzer.runAnalysis();
      await analyzer.runAnalysis();

      const metrics = analyzer.getImprovementMetrics();

      expect(metrics).toHaveProperty('current');
      expect(metrics).toHaveProperty('previous');
      expect(metrics).toHaveProperty('trend');
      expect(['improving', 'stable', 'degrading']).toContain(metrics.trend);
    });

    it('should detect improving trend', async () => {
      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      // First analysis - bad code
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `
        function bad(a, b, c, d, e, f, g) {
          if (a) {
            if (b) {
              return 42;
            }
          }
          return 0;
        }
        `
      );
      await analyzer.runAnalysis();

      // Second analysis - improved code
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `
        function good(a: number, b: number) {
          return a + b;
        }
        `
      );
      await analyzer.runAnalysis();

      const metrics = analyzer.getImprovementMetrics();

      // Quality should improve
      expect(metrics.current.qualityScore).toBeGreaterThanOrEqual(
        metrics.previous!.qualityScore
      );
    });
  });

  describe('Periodic Analysis', () => {
    it('should start and stop periodic analysis', () => {
      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 1000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      analyzer.start();
      analyzer.stop();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should check if analysis is due', async () => {
      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 1000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      expect(analyzer.isAnalysisDue()).toBe(true);

      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        'function test() { return 1; }'
      );
      await analyzer.runAnalysis();

      expect(analyzer.isAnalysisDue()).toBe(false);
    });
  });

  describe('Post-Modification Trigger', () => {
    it('should trigger analysis after modification', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        'function test() { return 1; }'
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: true,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      const result = await analyzer.triggerPostModification(['src/test.ts']);

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
    });

    it('should not trigger if disabled', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        'function test() { return 1; }'
      );

      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      // Run initial analysis
      await analyzer.runAnalysis();
      const before = analyzer.getLastAnalysis();

      // Trigger should return last analysis without running new one
      const result = await analyzer.triggerPostModification(['src/test.ts']);

      expect(result.timestamp).toBe(before.timestamp);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: '/nonexistent/path',
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      // Should return empty result, not crash
      const result = await analyzer.runAnalysis();
      
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics.totalFiles).toBe(0);
    });

    it('should throw error when getting metrics without analysis', () => {
      const analyzer = new SelfAnalyzer(
        {
          prometheusRepoPath: tempDir,
          analysisInterval: 3600000,
          triggerOnModification: false,
        },
        createCodeQualityAnalyzer(),
        createDebtDetector()
      );

      expect(() => analyzer.getImprovementMetrics()).toThrow();
    });
  });
});
