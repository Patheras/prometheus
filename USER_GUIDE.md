# Prometheus User Guide

Complete guide for using Prometheus Meta-Agent System.

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Using Workflows](#using-workflows)
5. [Consultation Interface](#consultation-interface)
6. [Configuration](#configuration)
7. [Best Practices](#best-practices)
8. [FAQ](#faq)

---

## Introduction

### What is Prometheus?

Prometheus is a self-improving meta-agent that acts as your:
- **Technical Product Owner**: Prioritizes work based on impact
- **Architect**: Analyzes and improves system architecture
- **Developer**: Applies patterns and refactorings
- **Analyst**: Tracks metrics and identifies issues

### Key Capabilities

- **Code Quality Analysis**: Detect issues, suggest improvements
- **Performance Optimization**: Identify bottlenecks, propose optimizations
- **Technical Debt Management**: Track and reduce debt systematically
- **Self-Improvement**: Apply same standards to own code
- **Pattern Application**: Learn and apply proven patterns
- **Decision Support**: Provide context for important decisions

---

## Getting Started

### First Time Setup

1. **Access Prometheus**
   ```bash
   # If running locally
   http://localhost:3000
   
   # If deployed
   https://admin.anots.com
   ```

2. **Authenticate**
   ```bash
   # Get your API token
   curl -X POST https://admin.anots.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "your-username", "password": "your-password"}'
   ```

3. **Configure Your Repository**
   ```json
   {
     "repoPath": "/path/to/your/project",
     "excludePaths": ["node_modules", "dist", ".git"],
     "language": "typescript"
   }
   ```

### Quick Start Example

```typescript
import { createCodeQualityWorkflow } from 'prometheus';

// Create workflow
const workflow = createCodeQualityWorkflow(
  qualityAnalyzer,
  priorityScorer,
  patternApplicator,
  memoryEngine
);

// Run analysis
const result = await workflow.execute({
  repoPath: './my-project',
  maxIssues: 10,
  autoApply: false  // Review before applying
});

console.log(`Found ${result.analysis.issuesFound} issues`);
console.log(`Quality score: ${result.analysis.averageQualityScore}/100`);
```

---

## Core Concepts

### 1. Workflows

Workflows are end-to-end processes that accomplish specific goals.

**Available Workflows**:
- **Code Quality**: Improve code quality
- **Performance**: Optimize performance
- **Debt Reduction**: Reduce technical debt
- **Self-Improvement**: Improve Prometheus itself

### 2. Engines

Engines are specialized components that power workflows.

**Engine Types**:
- **Memory Engine**: Stores code, decisions, patterns, metrics
- **Runtime Engine**: Manages LLM calls with fallback
- **Queue Engine**: Manages concurrent operations
- **Analysis Engine**: Analyzes code quality, performance, debt
- **Decision Engine**: Scores priorities, evaluates risks
- **Evolution Engine**: Applies patterns, self-improves

### 3. Consultation

Prometheus asks for your input on important decisions.

**Consultation Triggers**:
- High-impact changes
- High-risk optimizations
- Architectural changes
- Self-modifications
- Tie-breaking between options

### 4. Patterns

Patterns are proven solutions to common problems.

**Pattern Sources**:
- OpenClaw patterns (pre-loaded)
- Learned from your codebase
- Learned from outcomes

---

## Using Workflows

### Code Quality Workflow

**Purpose**: Detect and fix code quality issues

**When to Use**:
- After major feature development
- Before releases
- Regular maintenance (weekly/monthly)

**Example**:

```typescript
const result = await codeQualityWorkflow.execute({
  repoPath: './my-project',
  maxIssues: 20,
  minQualityScore: 70,
  autoApply: false
});

// Review results
console.log('Issues found:', result.analysis.issuesFound);
console.log('Quality score:', result.analysis.averageQualityScore);

// Review improvements
for (const improvement of result.improvements) {
  console.log(`[${improvement.priority}] ${improvement.description}`);
  console.log(`  Effort: ${improvement.effort} hours`);
}

// Apply selected improvements
// (Manual review recommended)
```

**Configuration Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `repoPath` | string | required | Path to repository |
| `maxIssues` | number | unlimited | Max issues to process |
| `minQualityScore` | number | 0 | Min score threshold |
| `autoApply` | boolean | false | Auto-apply fixes |

### Performance Workflow

**Purpose**: Detect and fix performance bottlenecks

**When to Use**:
- After performance degradation
- Before scaling up
- Regular optimization (monthly)

**Example**:

```typescript
const result = await performanceWorkflow.execute({
  timeRange: 7 * 24 * 60 * 60 * 1000,  // Last 7 days
  minSeverity: 'high',
  autoApply: false,
  runABTests: true
});

// Review bottlenecks
for (const bottleneck of result.bottlenecks) {
  console.log(`${bottleneck.operation}:`);
  console.log(`  P95 latency: ${bottleneck.p95Latency}ms`);
  console.log(`  Affected users: ${bottleneck.affectedUsers}`);
}

// Review proposals
for (const proposal of result.proposals) {
  console.log(`${proposal.description}:`);
  console.log(`  Estimated improvement: ${proposal.estimatedImprovement}%`);
  console.log(`  Risk: ${proposal.risk}`);
}
```

**Configuration Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeRange` | number | required | Time range in ms |
| `minSeverity` | string | 'low' | Min severity level |
| `autoApply` | boolean | false | Auto-apply optimizations |
| `runABTests` | boolean | false | Run A/B tests |

### Debt Reduction Workflow

**Purpose**: Detect and reduce technical debt

**When to Use**:
- Sprint planning
- Before major refactoring
- Regular cleanup (monthly)

**Example**:

```typescript
const result = await debtReductionWorkflow.execute({
  repoPath: './my-project',
  maxItems: 15,
  minPriority: 60,
  autoFix: true  // Auto-fix simple items
});

// Review debt
console.log('Total debt:', result.detection.totalDebt, 'hours');
console.log('Debt by type:', result.detection.debtByType);

// Review prioritized items
for (const item of result.prioritized) {
  console.log(`[${item.priority}] ${item.description}`);
  console.log(`  Effort: ${item.effort} hours`);
}

// Review fixes
console.log('Items fixed:', result.impact.itemsFixed);
console.log('Debt reduced:', result.impact.debtReduction, 'hours');
```

**Configuration Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `repoPath` | string | required | Path to repository |
| `maxItems` | number | unlimited | Max items to process |
| `minPriority` | number | 0 | Min priority threshold |
| `autoFix` | boolean | false | Auto-fix simple items |

### Self-Improvement Workflow

**Purpose**: Improve Prometheus's own code

**When to Use**:
- After adding new features
- Regular self-maintenance (weekly)
- Before major releases

**Example**:

```typescript
const result = await selfImprovementWorkflow.execute({
  prometheusRepoPath: './prometheus',
  maxImprovements: 10,
  requireConsultation: true,  // Ask before self-modifying
  autoApply: false
});

// Review self-analysis
console.log('Files analyzed:', result.analysis.filesAnalyzed);
console.log('Quality score:', result.analysis.qualityScore);

// Review improvements
for (const improvement of result.improvements) {
  console.log(`[${improvement.priority}] ${improvement.description}`);
  console.log(`  Type: ${improvement.type}`);
  console.log(`  Impact: ${improvement.impact}`);
}

// Review metrics
console.log('Quality improvement:', result.metrics.qualityImprovement);
console.log('Test coverage increase:', result.metrics.testCoverageIncrease);
```

**Configuration Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prometheusRepoPath` | string | required | Path to Prometheus |
| `maxImprovements` | number | unlimited | Max improvements |
| `requireConsultation` | boolean | true | Require consultation |
| `autoApply` | boolean | false | Auto-apply improvements |

---

## Consultation Interface

### Understanding Consultations

Prometheus asks for your input when:
- Changes have high impact
- Decisions involve high risk
- Multiple options are equally good
- Self-modifications are proposed

### Consultation Request Format

```json
{
  "id": "consultation-123",
  "type": "high_impact",
  "context": {
    "description": "Refactor authentication system",
    "affectedComponents": ["auth", "user", "session"],
    "estimatedImpact": 85,
    "risk": "medium"
  },
  "options": [
    {
      "id": "option-1",
      "description": "Use JWT tokens",
      "pros": ["Stateless", "Scalable"],
      "cons": ["Cannot revoke easily"],
      "recommendation": true
    },
    {
      "id": "option-2",
      "description": "Use session cookies",
      "pros": ["Easy to revoke", "Familiar"],
      "cons": ["Requires state", "Less scalable"]
    }
  ],
  "recommendation": "option-1",
  "reasoning": "JWT tokens provide better scalability..."
}
```

### Responding to Consultations

```typescript
// Approve recommendation
await prometheus.respondToConsultation('consultation-123', {
  decision: 'approve',
  selectedOption: 'option-1',
  feedback: 'Agreed, scalability is important'
});

// Reject and provide alternative
await prometheus.respondToConsultation('consultation-123', {
  decision: 'reject',
  feedback: 'Let\'s use option-2 for now, we can migrate later'
});

// Request more information
await prometheus.respondToConsultation('consultation-123', {
  decision: 'defer',
  feedback: 'Can you provide performance benchmarks?'
});
```

### Consultation Best Practices

1. **Review Context**: Understand what's being changed
2. **Consider Trade-offs**: Weigh pros and cons
3. **Provide Feedback**: Help Prometheus learn
4. **Ask Questions**: Request more information if needed
5. **Track Outcomes**: Review results after implementation

---

## Configuration

### Priority Weights

Customize how Prometheus prioritizes work:

```json
{
  "decision": {
    "priorityWeights": {
      "impact": 0.4,    // How much it affects users/system
      "urgency": 0.3,   // How time-sensitive it is
      "effort": 0.2,    // How much work it takes (inverted)
      "alignment": 0.1  // How well it aligns with goals
    }
  }
}
```

### Goal Alignment

Define your goals for better alignment:

```json
{
  "decision": {
    "goals": [
      {
        "description": "Improve code quality",
        "keywords": ["quality", "refactor", "clean"],
        "weight": 1.0
      },
      {
        "description": "Reduce technical debt",
        "keywords": ["debt", "todo", "fixme"],
        "weight": 0.9
      },
      {
        "description": "Optimize performance",
        "keywords": ["performance", "optimize", "speed"],
        "weight": 0.8
      }
    ]
  }
}
```

### Analysis Thresholds

Set quality thresholds:

```json
{
  "analysis": {
    "minQualityScore": 70,
    "maxComplexity": 15,
    "maxMethodLength": 50,
    "maxClassLength": 300,
    "enableCodeSmells": true
  }
}
```

### Self-Analysis

Configure self-improvement:

```json
{
  "evolution": {
    "selfAnalysisInterval": 86400000,  // 24 hours
    "triggerOnModification": true,
    "requireConsultation": true,
    "autoApplyThreshold": 80
  }
}
```

---

## Best Practices

### 1. Start Small

Begin with small, low-risk changes:

```typescript
// Start with analysis only
const result = await workflow.execute({
  repoPath: './my-project',
  maxIssues: 5,
  autoApply: false
});

// Review results, then gradually increase
```

### 2. Review Before Applying

Always review changes before auto-applying:

```typescript
// Review mode
const result = await workflow.execute({
  autoApply: false
});

// Review improvements
for (const improvement of result.improvements) {
  if (improvement.priority > 80) {
    // Apply high-priority improvements
  }
}
```

### 3. Use Consultation

Enable consultation for important decisions:

```typescript
const result = await selfImprovementWorkflow.execute({
  requireConsultation: true,  // Ask before self-modifying
  autoApply: false
});
```

### 4. Track Metrics

Monitor improvement over time:

```typescript
// Run regularly
const results = [];
for (let i = 0; i < 4; i++) {
  const result = await workflow.execute(config);
  results.push({
    week: i + 1,
    qualityScore: result.analysis.averageQualityScore,
    issuesFixed: result.impact.issuesFixed
  });
  
  // Wait a week
  await new Promise(resolve => setTimeout(resolve, 7 * 24 * 60 * 60 * 1000));
}

// Analyze trend
console.log('Quality trend:', results);
```

### 5. Provide Feedback

Help Prometheus learn from outcomes:

```typescript
// After applying changes
await prometheus.provideFeedback({
  decisionId: 'decision-123',
  outcome: 'success',
  actualImpact: 85,
  notes: 'Performance improved by 40%'
});
```

### 6. Regular Maintenance

Schedule regular workflow runs:

```bash
# Weekly code quality check
0 9 * * 1 /path/to/run-quality-workflow.sh

# Monthly debt reduction
0 9 1 * * /path/to/run-debt-workflow.sh

# Daily self-improvement
0 2 * * * /path/to/run-self-improvement.sh
```

---

## FAQ

### General

**Q: Is Prometheus domain-agnostic?**

A: Yes! Prometheus works with any TypeScript/JavaScript codebase. ANOTS is just the first use case.

**Q: Does Prometheus modify code automatically?**

A: Only if you enable `autoApply`. By default, it provides recommendations for you to review.

**Q: How does Prometheus learn?**

A: Prometheus learns from:
- Pattern outcomes (success/failure)
- Your feedback on decisions
- Code analysis results
- Performance metrics

### Workflows

**Q: Which workflow should I run first?**

A: Start with Code Quality workflow to get a baseline, then address specific issues with other workflows.

**Q: Can I run multiple workflows together?**

A: Yes, workflows are independent and can be run sequentially or in parallel.

**Q: How long do workflows take?**

A: Depends on codebase size:
- Small (< 10k LOC): 1-5 minutes
- Medium (10k-100k LOC): 5-30 minutes
- Large (> 100k LOC): 30+ minutes

### Consultation

**Q: What happens if I don't respond to a consultation?**

A: Prometheus will not proceed with the change. It will remain in "pending consultation" state.

**Q: Can I disable consultations?**

A: You can adjust consultation thresholds, but we recommend keeping them enabled for high-impact changes.

**Q: How do I provide good feedback?**

A: Be specific about:
- What worked well
- What didn't work
- Actual vs. expected impact
- Lessons learned

### Configuration

**Q: How do I customize priority weights?**

A: Edit `config/production.json` and adjust the `priorityWeights` section.

**Q: Can I add custom goals?**

A: Yes, add them to the `goals` array in configuration.

**Q: How do I change LLM providers?**

A: Update `runtime.defaultModel` and `runtime.fallbackChain` in configuration.

### Troubleshooting

**Q: Workflow is slow, how to speed up?**

A: Increase lane concurrency in configuration:
```json
{
  "queue": {
    "lanes": {
      "analysis": { "concurrency": 5 }
    }
  }
}
```

**Q: Getting "database locked" errors?**

A: Enable WAL mode:
```bash
sqlite3 data/prometheus.db "PRAGMA journal_mode=WAL;"
```

**Q: LLM requests timing out?**

A: Increase timeout and add fallback models:
```json
{
  "runtime": {
    "timeout": 60000,
    "fallbackChain": ["gpt-4", "claude-3-sonnet", "gpt-3.5-turbo"]
  }
}
```

---

## Getting Help

### Documentation
- [Deployment Guide](./DEPLOYMENT.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Architecture Documentation](./ARCHITECTURE.md)

### Support Channels
- GitHub Issues: https://github.com/your-org/prometheus/issues
- Email: support@prometheus.dev
- Slack: #prometheus-support

### Contributing
- See [CONTRIBUTING.md](./CONTRIBUTING.md)
- Join our community calls (Fridays 2 PM UTC)

---

**Last Updated**: 2026-02-09
**Version**: 1.0.0
