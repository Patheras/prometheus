/**
 * Usage Examples for Repository Pattern Tracker
 * 
 * These examples demonstrate how to use the RepositoryPatternTracker
 * to learn and apply repository-specific conventions.
 */

import { RepositoryManager } from './repository-manager';
import { RepositoryPatternTracker } from './repository-pattern-tracker';
import { MemoryEngine } from '../memory/engine';

/**
 * Example 1: Analyze a repository and learn its patterns
 */
export async function example1_analyzeRepository() {
  console.log('\n=== Example 1: Analyze Repository Patterns ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  const repoManager = new RepositoryManager(memoryEngine, {
    prometheusRepoPath: '/path/to/prometheus',
  });

  // Add a repository to manage
  await repoManager.addRepository({
    id: 'my-app',
    provider: 'github',
    url: 'https://github.com/myorg/my-app',
    localPath: '/path/to/my-app',
    auth: {
      type: 'token',
      token: process.env.GITHUB_TOKEN!,
    },
  });

  // Create pattern tracker
  const tracker = new RepositoryPatternTracker('my-app', memoryEngine);

  // Analyze the repository
  const analysis = await tracker.analyzeRepository('/path/to/my-app');

  console.log(`Analyzed repository: ${analysis.repoId}`);
  console.log(`Found ${analysis.patterns.length} patterns`);
  console.log(`Learned ${analysis.conventions.length} conventions`);
  console.log(`Detected ${analysis.violations.length} violations`);
  console.log(`Generated ${analysis.recommendations.length} recommendations`);

  // Show patterns by category
  console.log('\nPatterns by category:');
  const categories = ['naming', 'structure', 'testing', 'code-style'] as const;
  for (const category of categories) {
    const patterns = tracker.getPatternsByCategory(category);
    console.log(`  ${category}: ${patterns.length} patterns`);
  }

  await memoryEngine.close();
}

/**
 * Example 2: Get high-confidence conventions
 */
export async function example2_getConventions() {
  console.log('\n=== Example 2: Get High-Confidence Conventions ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  const tracker = new RepositoryPatternTracker('my-app', memoryEngine);
  await tracker.analyzeRepository('/path/to/my-app');

  // Get high-confidence patterns
  const highConfidence = tracker.getHighConfidencePatterns(0.8);

  console.log(`Found ${highConfidence.length} high-confidence patterns:\n`);

  for (const pattern of highConfidence) {
    console.log(`${pattern.category}: ${pattern.name}`);
    console.log(`  Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log(`  Occurrences: ${pattern.occurrences}`);
    console.log(`  Examples: ${pattern.examples.slice(0, 2).join(', ')}`);
    console.log();
  }

  await memoryEngine.close();
}

/**
 * Example 3: Check for pattern violations
 */
export async function example3_checkViolations() {
  console.log('\n=== Example 3: Check Pattern Violations ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  const tracker = new RepositoryPatternTracker('my-app', memoryEngine);
  const analysis = await tracker.analyzeRepository('/path/to/my-app');

  if (analysis.violations.length > 0) {
    console.log(`Found ${analysis.violations.length} violations:\n`);

    for (const violation of analysis.violations) {
      console.log(`${violation.severity.toUpperCase()}: ${violation.file}`);
      if (violation.line) {
        console.log(`  Line ${violation.line}`);
      }
      console.log(`  Issue: ${violation.description}`);
      console.log(`  Suggestion: ${violation.suggestion}`);
      console.log();
    }
  } else {
    console.log('No violations found! Repository follows all learned conventions.');
  }

  await memoryEngine.close();
}

/**
 * Example 4: Get recommendations for improvement
 */
export async function example4_getRecommendations() {
  console.log('\n=== Example 4: Get Improvement Recommendations ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  const tracker = new RepositoryPatternTracker('my-app', memoryEngine);
  const analysis = await tracker.analyzeRepository('/path/to/my-app');

  console.log('Recommendations for improving repository consistency:\n');

  for (const recommendation of analysis.recommendations) {
    console.log(`• ${recommendation}`);
  }

  await memoryEngine.close();
}

/**
 * Example 5: Compare patterns across repositories
 */
export async function example5_compareRepositories() {
  console.log('\n=== Example 5: Compare Repository Patterns ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  // Analyze two repositories
  const tracker1 = new RepositoryPatternTracker('repo-a', memoryEngine);
  const tracker2 = new RepositoryPatternTracker('repo-b', memoryEngine);

  const analysis1 = await tracker1.analyzeRepository('/path/to/repo-a');
  const analysis2 = await tracker2.analyzeRepository('/path/to/repo-b');

  console.log('Repository A:');
  console.log(`  Patterns: ${analysis1.patterns.length}`);
  console.log(`  Conventions: ${analysis1.conventions.length}`);
  console.log(`  Violations: ${analysis1.violations.length}`);

  console.log('\nRepository B:');
  console.log(`  Patterns: ${analysis2.patterns.length}`);
  console.log(`  Conventions: ${analysis2.conventions.length}`);
  console.log(`  Violations: ${analysis2.violations.length}`);

  // Compare naming conventions
  const naming1 = tracker1.getPatternsByCategory('naming');
  const naming2 = tracker2.getPatternsByCategory('naming');

  console.log('\nNaming Convention Comparison:');
  console.log(`  Repo A: ${naming1.map(p => p.name).join(', ')}`);
  console.log(`  Repo B: ${naming2.map(p => p.name).join(', ')}`);

  await memoryEngine.close();
}

/**
 * Example 6: Track pattern evolution over time
 */
export async function example6_trackEvolution() {
  console.log('\n=== Example 6: Track Pattern Evolution ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  const tracker = new RepositoryPatternTracker('my-app', memoryEngine);

  // Analyze multiple times to see evolution
  console.log('Initial analysis...');
  const analysis1 = await tracker.analyzeRepository('/path/to/my-app');
  console.log(`Patterns: ${analysis1.patterns.length}`);

  // Simulate time passing and code changes
  console.log('\nAfter code changes...');
  const analysis2 = await tracker.analyzeRepository('/path/to/my-app');
  console.log(`Patterns: ${analysis2.patterns.length}`);

  // Compare pattern confidence
  const patterns1 = tracker.getPatterns();
  console.log('\nPattern confidence evolution:');
  for (const pattern of patterns1.slice(0, 5)) {
    console.log(`  ${pattern.name}: ${(pattern.confidence * 100).toFixed(1)}%`);
    console.log(`    Occurrences: ${pattern.occurrences}`);
    console.log(`    Last seen: ${new Date(pattern.lastSeen).toLocaleString()}`);
  }

  await memoryEngine.close();
}

/**
 * Example 7: Use patterns to guide code generation
 */
export async function example7_guideCodeGeneration() {
  console.log('\n=== Example 7: Use Patterns to Guide Code Generation ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  const tracker = new RepositoryPatternTracker('my-app', memoryEngine);
  await tracker.analyzeRepository('/path/to/my-app');

  // Get conventions to follow
  const namingPatterns = tracker.getPatternsByCategory('naming');
  const testingPatterns = tracker.getPatternsByCategory('testing');
  const stylePatterns = tracker.getPatternsByCategory('code-style');

  console.log('When generating code for this repository, follow these conventions:\n');

  console.log('Naming:');
  for (const pattern of namingPatterns.filter(p => p.confidence > 0.7)) {
    console.log(`  • ${pattern.description}`);
    console.log(`    Example: ${pattern.examples[0]}`);
  }

  console.log('\nTesting:');
  for (const pattern of testingPatterns.filter(p => p.confidence > 0.7)) {
    console.log(`  • ${pattern.description}`);
    console.log(`    Example: ${pattern.examples[0]}`);
  }

  console.log('\nCode Style:');
  for (const pattern of stylePatterns.filter(p => p.confidence > 0.7)) {
    console.log(`  • ${pattern.description}`);
  }

  await memoryEngine.close();
}

/**
 * Example 8: Integrate with repository workflow
 */
export async function example8_integrateWithWorkflow() {
  console.log('\n=== Example 8: Integrate Pattern Tracking with Workflow ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  const repoManager = new RepositoryManager(memoryEngine, {
    prometheusRepoPath: '/path/to/prometheus',
  });

  await repoManager.addRepository({
    id: 'my-app',
    provider: 'github',
    url: 'https://github.com/myorg/my-app',
    localPath: '/path/to/my-app',
    auth: {
      type: 'token',
      token: process.env.GITHUB_TOKEN!,
    },
  });

  // Set repository context
  repoManager.setCurrentRepository('my-app');

  // Analyze patterns before making changes
  const tracker = new RepositoryPatternTracker('my-app', memoryEngine);
  const analysis = await tracker.analyzeRepository('/path/to/my-app');

  console.log('Learned repository conventions:');
  for (const convention of analysis.conventions) {
    console.log(`  • ${convention.type}: ${convention.pattern}`);
  }

  // Now when making changes, follow the learned conventions
  console.log('\nApplying changes that follow repository conventions...');

  // After changes, check for violations
  const newAnalysis = await tracker.analyzeRepository('/path/to/my-app');
  if (newAnalysis.violations.length > 0) {
    console.log(`\nWarning: ${newAnalysis.violations.length} convention violations detected!`);
    for (const violation of newAnalysis.violations) {
      console.log(`  • ${violation.file}: ${violation.description}`);
    }
  } else {
    console.log('\nAll changes follow repository conventions ✓');
  }

  await memoryEngine.close();
}

/**
 * Example 9: Export patterns for documentation
 */
export async function example9_exportPatterns() {
  console.log('\n=== Example 9: Export Patterns for Documentation ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  const tracker = new RepositoryPatternTracker('my-app', memoryEngine);
  const analysis = await tracker.analyzeRepository('/path/to/my-app');

  // Generate markdown documentation
  const markdown = generatePatternDocumentation(analysis);
  console.log(markdown);

  await memoryEngine.close();
}

function generatePatternDocumentation(analysis: any): string {
  let md = `# ${analysis.repoId} - Code Conventions\n\n`;
  md += `Generated: ${new Date().toLocaleString()}\n\n`;

  md += `## Summary\n\n`;
  md += `- **Patterns Identified**: ${analysis.patterns.length}\n`;
  md += `- **Conventions Learned**: ${analysis.conventions.length}\n`;
  md += `- **Violations Detected**: ${analysis.violations.length}\n\n`;

  md += `## Conventions\n\n`;
  for (const convention of analysis.conventions) {
    md += `### ${convention.pattern}\n\n`;
    md += `**Type**: ${convention.type}\n\n`;
    md += `**Confidence**: ${(convention.confidence * 100).toFixed(1)}%\n\n`;
    md += `**Examples**:\n`;
    for (const example of convention.examples.slice(0, 3)) {
      md += `- \`${example}\`\n`;
    }
    md += `\n`;
  }

  if (analysis.recommendations.length > 0) {
    md += `## Recommendations\n\n`;
    for (const rec of analysis.recommendations) {
      md += `- ${rec}\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Example 10: Monitor pattern consistency over time
 */
export async function example10_monitorConsistency() {
  console.log('\n=== Example 10: Monitor Pattern Consistency ===\n');

  const memoryEngine = new MemoryEngine({
    dbPath: './data/prometheus.db',
    embeddingProvider: 'openai',
  });

  const tracker = new RepositoryPatternTracker('my-app', memoryEngine);

  // Analyze periodically
  const results = [];
  for (let i = 0; i < 3; i++) {
    const analysis = await tracker.analyzeRepository('/path/to/my-app');
    results.push({
      timestamp: Date.now(),
      patternCount: analysis.patterns.length,
      violationCount: analysis.violations.length,
      avgConfidence: analysis.patterns.reduce((sum, p) => sum + p.confidence, 0) / analysis.patterns.length,
    });

    console.log(`Analysis ${i + 1}:`);
    console.log(`  Patterns: ${analysis.patterns.length}`);
    console.log(`  Violations: ${analysis.violations.length}`);
    console.log(`  Avg Confidence: ${(results[i].avgConfidence * 100).toFixed(1)}%`);
    console.log();

    // Simulate time passing
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Show trend
  console.log('Consistency Trend:');
  if (results[2].avgConfidence > results[0].avgConfidence) {
    console.log('  ✓ Pattern confidence is improving');
  } else {
    console.log('  ⚠ Pattern confidence is declining');
  }

  if (results[2].violationCount < results[0].violationCount) {
    console.log('  ✓ Violations are decreasing');
  } else if (results[2].violationCount > results[0].violationCount) {
    console.log('  ⚠ Violations are increasing');
  }

  await memoryEngine.close();
}

// Run examples
if (require.main === module) {
  (async () => {
    try {
      await example1_analyzeRepository();
      await example2_getConventions();
      await example3_checkViolations();
      await example4_getRecommendations();
      await example5_compareRepositories();
      await example6_trackEvolution();
      await example7_guideCodeGeneration();
      await example8_integrateWithWorkflow();
      await example9_exportPatterns();
      await example10_monitorConsistency();
    } catch (error) {
      console.error('Error running examples:', error);
    }
  })();
}
