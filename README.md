# Prometheus Meta-Agent System

> A self-improving meta-agent that acts as Technical Product Owner, Architect, Developer, and Analyst

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3.45-orange.svg)](https://www.sqlite.org/)
[![Tests](https://img.shields.io/badge/Tests-81.4%25-yellow.svg)](./PHASE_1-12_COMPLETION_REPORT.md)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## 🎯 Overview

Prometheus is a sophisticated meta-agent system that goes beyond simple task execution. It owns the project vision, makes data-driven decisions, and continuously evolves both itself and the systems it manages. Built with patterns learned from OpenClaw, Prometheus combines advanced memory systems, intelligent runtime management, and self-improvement capabilities.

### Key Capabilities

- 🔍 **Intelligent Code Analysis** - AST-based parsing, complexity analysis, code smell detection
- ⚡ **Performance Optimization** - Bottleneck identification, A/B testing, automated rollout
- 🏗️ **Architecture Refactoring** - Coupling detection, circular dependency analysis, refactoring strategies
- 🎨 **Pattern Learning** - Pattern detection, adaptation, and application with success tracking
- 🧠 **Self-Improvement** - Analyzes own code, proposes optimizations, dev/prod separation
- 🎲 **Smart Decision Making** - Priority scoring, risk evaluation, consultation triggers
- 🔄 **Concurrency Control** - Lane-based queue system preventing race conditions
- 🤖 **Model Management** - Task-based selection, cascading fallback, auth rotation

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- SQLite 3.45+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/prometheus.git
cd prometheus

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

### Basic Usage

```typescript
import { MemoryEngine } from './src/memory';
import { RuntimeExecutor } from './src/runtime';
import { AnalysisEngine } from './src/analysis';

// Initialize engines
const memory = new MemoryEngine('./data/prometheus.db');
await memory.initialize();

const runtime = new RuntimeExecutor(config);
const analysis = new AnalysisEngine(memory, runtime);

// Analyze code quality
const issues = await analysis.analyzeCodeQuality('./src');
console.log(`Found ${issues.length} quality issues`);

// Get optimization suggestions
const suggestions = await analysis.suggestOptimizations(issues);
```

## 📚 Documentation

### Core Documentation
- [Phase 1-12 Completion Report](./PHASE_1-12_COMPLETION_REPORT.md) - Detailed progress report
- [Architecture Guide](./ARCHITECTURE.md) - System architecture overview
- [API Documentation](./API.md) - API reference
- [Developer Guide](./DEVELOPER_GUIDE.md) - Development guidelines

### Component Documentation
- [Memory Engine](./docs/memory-engine.md) - Memory system architecture
- [Runtime Engine](./docs/runtime-engine.md) - Model management and execution
- [Analysis Engine](./docs/analysis-engine.md) - Code analysis capabilities
- [Decision Engine](./docs/decision-engine.md) - Decision-making system
- [Evolution Engine](./docs/evolution-engine.md) - Self-improvement system

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Prometheus Meta-Agent                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Memory     │  │   Runtime    │  │   Queue      │     │
│  │   Engine     │  │   Engine     │  │   System     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Analysis   │  │   Decision   │  │  Evolution   │     │
│  │   Engine     │  │   Engine     │  │   Engine     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Memory Engine
- **Codebase Memory:** Hybrid search (FTS5 + vector similarity)
- **Decision Memory:** Past decisions with outcomes
- **Metric Memory:** Performance and usage metrics
- **Pattern Memory:** Learned patterns with success rates
- **Embedding Cache:** Content-hash-based caching

### Runtime Engine
- **Model Selection:** Task-type-based model selection
- **Cascading Fallback:** Automatic fallback with auth rotation
- **Context Management:** Token estimation and window guards
- **Streaming:** Async streaming with abort support

### Evolution Engine
- **Self-Analyzer:** Analyzes own code with same standards
- **Architecture Analyzer:** Detects coupling, circular deps, scalability issues
- **Pattern Applicator:** Applies learned patterns with adaptation
- **Agent Optimizer:** A/B testing and optimization rollout
- **Dev/Prod Separation:** Safe self-improvement workflow

## 📊 Current Status

### Phase Completion
- ✅ **Phase 1-12:** Core Implementation Complete (100%)
- 🔄 **Phase 13:** Repository Management (67% - core features done)
- ⏳ **Phase 14-15:** External Integrations (deferred)
- ✅ **Phase 16:** End-to-End Workflows (83%)

### Test Coverage
- **Memory Engine:** 100% ✅
- **Runtime Engine:** 100% ✅
- **Task Queue:** 100% ✅
- **Analysis Engine:** 100% ✅
- **Decision Engine:** 100% ✅
- **Evolution Engine:** 81.4% (184/226 tests passing)

### Known Issues
- Mock configuration in workflow tests (non-critical)
- See [PHASE_1-12_COMPLETION_REPORT.md](./PHASE_1-12_COMPLETION_REPORT.md) for details

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- memory-engine.test.ts

# Run with coverage
npm test -- --coverage

# Run property-based tests
npm test -- --testNamePattern="Property"
```

### Test Structure
- **Unit Tests:** Jest-based unit tests for all modules
- **Property-Based Tests:** fast-check for edge case discovery
- **Integration Tests:** End-to-end workflow testing

## 🛠️ Development

### Project Structure

```
prometheus/
├── src/
│   ├── memory/          # Memory Engine
│   ├── runtime/         # Runtime Engine
│   ├── queue/           # Task Queue System
│   ├── analysis/        # Analysis Engine
│   ├── decision/        # Decision Engine
│   ├── evolution/       # Evolution Engine
│   ├── integration/     # External Integrations
│   └── types/           # TypeScript Types
├── data/                # SQLite Databases
├── docs/                # Documentation
├── examples/            # Usage Examples
└── __tests__/           # Test Files
```

### Key Technologies
- **TypeScript 5.0** - Type-safe development
- **SQLite + sqlite-vec** - Vector-enabled database
- **Jest + fast-check** - Testing framework
- **Node.js 20+** - Runtime environment

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Write Tests First**
   ```typescript
   describe('YourFeature', () => {
     it('should do something', () => {
       // Test implementation
     });
   });
   ```

3. **Implement Feature**
   ```typescript
   export class YourFeature {
     // Implementation
   }
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Submit PR**
   - Ensure all tests pass
   - Update documentation
   - Add changelog entry

## 🔮 Roadmap

### Completed ✅
- [x] Memory Engine with hybrid search
- [x] Runtime Engine with cascading fallback
- [x] Lane-based concurrency control
- [x] Code quality analysis
- [x] Performance optimization
- [x] Architecture refactoring
- [x] Pattern learning and application
- [x] Self-improvement system
- [x] Dev/prod separation

### In Progress 🔄
- [ ] Admin Portal UI (separate spec)
- [ ] Multi-tenant SaaS architecture
- [ ] Repository management enhancements

### Planned 📋
- [ ] Supabase integration
- [ ] GitHub integration
- [ ] Monitoring system integration
- [ ] CI/CD integration
- [ ] Domain adaptation system
- [ ] Advanced consultation interface

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Areas for Contribution
- 🐛 Bug fixes and improvements
- 📝 Documentation enhancements
- 🧪 Additional test coverage
- ✨ New features and capabilities
- 🎨 UI/UX improvements (Admin Portal)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenClaw Project** - For proven patterns in memory, runtime, and concurrency
- **Anthropic** - For Claude models powering intelligent analysis
- **SQLite Team** - For the robust database engine
- **TypeScript Team** - For the excellent type system

## 📞 Contact

- **Project Lead:** [Your Name]
- **Email:** [your.email@example.com]
- **Issues:** [GitHub Issues](https://github.com/your-org/prometheus/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/prometheus/discussions)

---

**Built with ❤️ by the Prometheus Team**

*Last Updated: February 9, 2026*
