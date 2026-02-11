# Prometheus Developer Guide

Complete guide for developers working on Prometheus Meta-Agent System.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Codebase Structure](#codebase-structure)
3. [Development Setup](#development-setup)
4. [Testing Approach](#testing-approach)
5. [Extension Points](#extension-points)
6. [Contributing](#contributing)
7. [Code Style](#code-style)
8. [Debugging](#debugging)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Workflows Layer                      │
│  (Code Quality, Performance, Debt, Self-Improvement)    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│                   Engines Layer                          │
├──────────────┬──────────────┬──────────────┬───────────┤
│   Analysis   │   Decision   │  Evolution   │  Runtime  │
│   Engine     │   Engine     │   Engine     │  Engine   │
└──────────────┴──────────────┴──────────────┴───────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│              Foundation Layer                            │
├──────────────┬──────────────┬──────────────────────────┤
│   Memory     │    Queue     │      Types               │
│   Engine     │   Engine     │                          │
└──────────────┴──────────────┴──────────────────────────┘
```

### Component Responsibilities

**Workflows** (High-level orchestration):
- Combine multiple engines
- Implement end-to-end processes
- Provide user-facing interfaces

**Engines** (Specialized capabilities):
- **Analysis**: Code quality, performance, debt detection
- **Decision**: Priority scoring, risk evaluation, consultation
- **Evolution**: Pattern application, self-improvement, optimization
- **Runtime**: LLM management, fallback, streaming

**Foundation** (Core infrastructure):
- **Memory**: Storage, search, indexing
- **Queue**: Concurrency, lane management
- **Types**: Shared type definitions

---

## Codebase Structure

```
prometheus/
├── src/
│   ├── memory/              # Memory Engine
│   │   ├── memory-engine.ts
│   │   ├── embedding-cache.ts
│   │   ├── indexer.ts
│   │   ├── searcher.ts
│   │   └── __tests__/
│   │
│   ├── runtime/             # Runtime Engine
│   │   ├── runtime-engine.ts
│   │   ├── model-selector.ts
│   │   ├── auth-manager.ts
│   │   ├── fallback-handler.ts
│   │   └── __tests__/
│   │
│   ├── queue/               # Queue Engine
│   │   ├── lane-queue.ts
│   │   ├── lane-types.ts
│   │   └── __tests__/
│   │
│   ├── analysis/            # Analysis Engine
│   │   ├── code-quality-analyzer.ts
│   │   ├── performance-analyzer.ts
│   │   ├── debt-detector.ts
│   │   ├── impact-assessor.ts
│   │   ├── types.ts
│   │   └── __tests__/
│   │
│   ├── decision/            # Decision Engine
│   │   ├── priority-scorer.ts
│   │   ├── risk-evaluator.ts
│   │   ├── consultation-manager.ts
│   │   └── __tests__/
│   │
│   ├── evolution/           # Evolution Engine
│   │   ├── self-analyzer.ts
│   │   ├── architecture-analyzer.ts
│   │   ├── pattern-applicator.ts
│   │   ├── agent-optimizer.ts
│   │   ├── test-validator.ts
│   │   ├── test-generator.ts
│   │   └── __tests__/
│   │
│   ├── workflows/           # End-to-End Workflows
│   │   ├── code-quality-workflow.ts
│   │   ├── performance-workflow.ts
│   │   ├── debt-reduction-workflow.ts
│   │   ├── self-improvement-workflow.ts
│   │   └── index.ts
│   │
│   ├── types/               # Shared Types
│   │   ├── index.ts
│   │   └── common.ts
│   │
│   └── index.ts             # Main entry point
│
├── data/                    # Database files
│   └── prometheus.db
│
├── config/                  # Configuration files
│   ├── development.json
│   ├── production.json
│   └── test.json
│
├── scripts/                 # Utility scripts
│   ├── db-init.ts
│   ├── seed-patterns.ts
│   └── backup-db.sh
│
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── PATTERNS.md
│
└── tests/                   # Integration tests
    ├── integration/
    └── e2e/
```

### File Naming Conventions

- **Classes**: `PascalCase.ts` (e.g., `MemoryEngine.ts`)
- **Functions**: `kebab-case.ts` (e.g., `create-analyzer.ts`)
- **Tests**: `*.test.ts` (e.g., `memory-engine.test.ts`)
- **Types**: `types.ts` or `*.types.ts`
- **Interfaces**: Defined in `types.ts` files

---

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git
- SQLite with sqlite-vec extension

### Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/prometheus.git
cd prometheus

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Initialize database
npm run db:init

# Seed patterns (optional)
npm run db:seed-patterns

# Build project
npm run build

# Run tests
npm test
```

### Development Workflow

```bash
# Start development mode (watch)
npm run dev

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- memory-engine.test.ts

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check
```

### Environment Variables

Create `.env` file:

```bash
# Database
DATABASE_PATH=./data/prometheus.db

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Development
NODE_ENV=development
LOG_LEVEL=debug
```

---

## Testing Approach

### Test Structure

Prometheus uses a comprehensive testing strategy:

1. **Unit Tests**: Test individual components
2. **Property-Based Tests**: Test invariants across many inputs
3. **Integration Tests**: Test component interactions
4. **End-to-End Tests**: Test complete workflows

### Unit Tests

Located in `__tests__/` directories next to source files.

**Example**:

```typescript
// src/memory/__tests__/memory-engine.test.ts
import { MemoryEngine } from '../memory-engine';

describe('MemoryEngine', () => {
  let engine: MemoryEngine;

  beforeEach(async () => {
    engine = new MemoryEngine({ dbPath: ':memory:' });
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.close();
  });

  describe('indexFile', () => {
    it('should index a file successfully', async () => {
      const result = await engine.indexFile({
        path: 'test.ts',
        content: 'export function test() {}',
        language: 'typescript'
      });

      expect(result.success).toBe(true);
      expect(result.chunksIndexed).toBeGreaterThan(0);
    });

    it('should handle duplicate files', async () => {
      await engine.indexFile({
        path: 'test.ts',
        content: 'export function test() {}',
        language: 'typescript'
      });

      // Index again
      const result = await engine.indexFile({
        path: 'test.ts',
        content: 'export function test() {}',
        language: 'typescript'
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });
});
```

### Property-Based Tests

Use `fast-check` for property-based testing.

**Example**:

```typescript
import * as fc from 'fast-check';

describe('PriorityScorer Properties', () => {
  it('should always return scores between 0 and 100', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          description: fc.string(),
          type: fc.constantFrom('feature', 'bugfix', 'refactor'),
          effortHours: fc.integer({ min: 1, max: 100 })
        }),
        (task) => {
          const scorer = new PriorityScorer();
          const score = scorer.scoreTask(task);
          
          expect(score.totalScore).toBeGreaterThanOrEqual(0);
          expect(score.totalScore).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

Test interactions between components.

**Example**:

```typescript
// tests/integration/workflow.test.ts
describe('Code Quality Workflow Integration', () => {
  let workflow: CodeQualityWorkflow;
  let memoryEngine: MemoryEngine;
  let qualityAnalyzer: CodeQualityAnalyzer;

  beforeAll(async () => {
    // Set up real components
    memoryEngine = new MemoryEngine({ dbPath: ':memory:' });
    await memoryEngine.initialize();
    
    qualityAnalyzer = new CodeQualityAnalyzer();
    
    workflow = new CodeQualityWorkflow(
      qualityAnalyzer,
      priorityScorer,
      patternApplicator,
      memoryEngine
    );
  });

  it('should complete full workflow', async () => {
    const result = await workflow.execute({
      repoPath: './test-fixtures/sample-project',
      maxIssues: 5,
      autoApply: false
    });

    expect(result.analysis.filesAnalyzed).toBeGreaterThan(0);
    expect(result.improvements.length).toBeGreaterThan(0);
  });
});
```

### Test Coverage

Aim for:
- **Unit Tests**: > 80% coverage
- **Integration Tests**: All major workflows
- **Property Tests**: All critical invariants

```bash
# Run coverage
npm run test:coverage

# View coverage report
open coverage/index.html
```

---

## Extension Points

### Adding a New Engine

1. **Create Engine Directory**:
   ```bash
   mkdir src/my-engine
   ```

2. **Define Types**:
   ```typescript
   // src/my-engine/types.ts
   export interface MyEngineConfig {
     option1: string;
     option2: number;
   }

   export interface MyEngineResult {
     success: boolean;
     data: any;
   }
   ```

3. **Implement Engine**:
   ```typescript
   // src/my-engine/my-engine.ts
   export class MyEngine {
     constructor(private config: MyEngineConfig) {}

     async process(input: any): Promise<MyEngineResult> {
       // Implementation
     }
   }
   ```

4. **Add Tests**:
   ```typescript
   // src/my-engine/__tests__/my-engine.test.ts
   describe('MyEngine', () => {
     // Tests
   });
   ```

5. **Export**:
   ```typescript
   // src/my-engine/index.ts
   export { MyEngine } from './my-engine';
   export type { MyEngineConfig, MyEngineResult } from './types';
   ```

### Adding a New Workflow

1. **Create Workflow File**:
   ```typescript
   // src/workflows/my-workflow.ts
   export class MyWorkflow {
     constructor(
       private engine1: Engine1,
       private engine2: Engine2
     ) {}

     async execute(config: MyWorkflowConfig): Promise<MyWorkflowResult> {
       // Step 1: Detect
       const detected = await this.detect();

       // Step 2: Prioritize
       const prioritized = await this.prioritize(detected);

       // Step 3: Apply
       const applied = await this.apply(prioritized);

       // Step 4: Measure
       const impact = await this.measure(applied);

       return { detected, prioritized, applied, impact };
     }
   }
   ```

2. **Add to Index**:
   ```typescript
   // src/workflows/index.ts
   export { MyWorkflow } from './my-workflow';
   export type { MyWorkflowConfig, MyWorkflowResult } from './my-workflow';
   ```

### Adding a New Pattern

1. **Define Pattern**:
   ```json
   {
     "id": "my-pattern-001",
     "name": "My Pattern",
     "category": "Performance",
     "problem": "Description of problem",
     "solution": "Description of solution",
     "example_code": "// Example code",
     "applicability": "When to use this pattern",
     "consequences": "Trade-offs and considerations"
   }
   ```

2. **Add to Pattern Catalog**:
   ```bash
   # Add to openclaw-learning/patterns/
   cp my-pattern.json openclaw-learning/patterns/
   ```

3. **Seed Database**:
   ```bash
   npm run db:seed-patterns
   ```

### Adding a New LLM Provider

1. **Implement Provider Interface**:
   ```typescript
   // src/runtime/providers/my-provider.ts
   export class MyProvider implements LLMProvider {
     async execute(request: LLMRequest): Promise<LLMResponse> {
       // Implementation
     }

     async stream(request: LLMRequest): AsyncIterator<string> {
       // Implementation
     }
   }
   ```

2. **Register Provider**:
   ```typescript
   // src/runtime/runtime-engine.ts
   const providers = {
     openai: new OpenAIProvider(),
     anthropic: new AnthropicProvider(),
     myProvider: new MyProvider()
   };
   ```

3. **Add to Configuration**:
   ```json
   {
     "runtime": {
       "providers": {
         "myProvider": {
           "apiKey": "...",
           "baseUrl": "..."
         }
       }
     }
   }
   ```

---

## Contributing

### Contribution Workflow

1. **Fork Repository**
2. **Create Feature Branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

3. **Make Changes**:
   - Write code
   - Add tests
   - Update documentation

4. **Run Tests**:
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

5. **Commit Changes**:
   ```bash
   git commit -m "feat: add my feature"
   ```

6. **Push Branch**:
   ```bash
   git push origin feature/my-feature
   ```

7. **Create Pull Request**

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Examples**:
```
feat(memory): add vector search caching
fix(runtime): handle timeout errors correctly
docs(api): update API documentation
test(decision): add property tests for priority scorer
```

### Code Review Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Types defined
- [ ] Error handling implemented
- [ ] Logging added
- [ ] Performance considered
- [ ] Security reviewed
- [ ] Backward compatibility maintained

---

## Code Style

### TypeScript Style

```typescript
// Use explicit types
function processData(input: string): ProcessedData {
  // Implementation
}

// Use interfaces for objects
interface Config {
  option1: string;
  option2: number;
}

// Use type for unions/intersections
type Status = 'pending' | 'complete' | 'failed';

// Use async/await
async function fetchData(): Promise<Data> {
  const response = await fetch(url);
  return response.json();
}

// Use optional chaining
const value = obj?.nested?.property;

// Use nullish coalescing
const result = value ?? defaultValue;
```

### Naming Conventions

```typescript
// Classes: PascalCase
class MemoryEngine {}

// Interfaces: PascalCase with 'I' prefix (optional)
interface IConfig {}

// Types: PascalCase
type TaskType = 'feature' | 'bugfix';

// Functions: camelCase
function calculateScore() {}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Private members: prefix with underscore
class MyClass {
  private _internalState: any;
}
```

### Error Handling

```typescript
// Use custom error classes
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Handle errors appropriately
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
    throw error;
  }
}
```

### Logging

```typescript
// Use structured logging
console.log('Processing file', {
  file: filePath,
  size: fileSize,
  timestamp: Date.now()
});

// Use appropriate log levels
console.debug('Detailed debug info');
console.info('Informational message');
console.warn('Warning message');
console.error('Error message', { error });
```

---

## Debugging

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Prometheus",
      "program": "${workspaceFolder}/dist/index.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Database Debugging

```bash
# Open database
sqlite3 data/prometheus.db

# List tables
.tables

# Describe table
.schema code_files

# Query data
SELECT * FROM code_files LIMIT 10;

# Explain query plan
EXPLAIN QUERY PLAN SELECT * FROM code_files WHERE path LIKE '%test%';
```

### Performance Profiling

```bash
# CPU profiling
node --prof dist/index.js

# Process profile
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --inspect dist/index.js
# Open chrome://inspect in Chrome
```

### Common Issues

**Issue**: Tests failing with "database locked"

**Solution**:
```bash
# Enable WAL mode
sqlite3 data/prometheus.db "PRAGMA journal_mode=WAL;"
```

**Issue**: Out of memory during tests

**Solution**:
```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

**Issue**: TypeScript errors after pulling changes

**Solution**:
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

---

## Resources

### Documentation
- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [User Guide](./USER_GUIDE.md)

### External Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [fast-check Documentation](https://github.com/dubzzz/fast-check)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

### Community
- GitHub Discussions: https://github.com/your-org/prometheus/discussions
- Slack: #prometheus-dev
- Weekly Dev Calls: Fridays 2 PM UTC

---

**Last Updated**: 2026-02-09
**Version**: 1.0.0
