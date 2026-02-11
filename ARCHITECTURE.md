# Prometheus System Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Integration Points](#integration-points)
5. [Deployment Architecture](#deployment-architecture)
6. [Technology Stack](#technology-stack)

---

## System Overview

Prometheus is a self-improving meta-agent system that acts as a Technical Product Owner, Architect, Developer, and Analyst. It manages, analyzes, and evolves software projects through data-driven decision-making and continuous self-improvement.

### Key Characteristics
- **Domain-Agnostic**: Can manage complex projects across different sectors
- **Self-Improving**: Learns from patterns and adapts over time
- **Data-Driven**: Makes decisions based on metrics, patterns, and historical data
- **Autonomous**: Operates independently with consultation triggers for high-impact decisions

### Deployment Model
- Runs on **admin.anots.com** as an independent service
- Has read/write access to **ANOTS development repository**
- Maintains its own **Prometheus product repository**
- Operates as a standalone service managing the ANOTS codebase

---

## Component Architecture

### 1. Memory Engine

**Purpose**: Multi-source memory system for codebase, decisions, metrics, and patterns.

**Key Features**:
- **Code Indexing**: Recursive directory scanning with metadata extraction
- **Hybrid Search**: Combines FTS5 keyword search (BM25) with vector similarity search
- **Embedding Cache**: SHA-256 content hashing with LRU eviction
- **Delta Sync**: Incremental updates using file hash comparison
- **Decision Memory**: Stores decisions with outcomes and affected components
- **Metric Memory**: Time-series storage with threshold flagging
- **Pattern Memory**: Stores proven patterns with success/failure tracking

**Storage**:
- SQLite database with sqlite-vec extension
- Tables: `code_files`, `code_chunks`, `code_chunks_vec`, `code_chunks_fts`, `decisions`, `metrics`, `patterns`, `embedding_cache`

**Search Algorithm**:
```
Combined Score = (0.3 × Keyword Score) + (0.7 × Vector Score)
Filter: Combined Score > Threshold
```

### 2. Runtime Engine

**Purpose**: Agent execution system with intelligent model selection and failover.

**Key Features**:
- **Model Selection**: Task-type-based model preferences with configuration overrides
- **Model Aliases**: Friendly names (e.g., "fast", "smart", "elite") mapped to specific models
- **Cascading Fallback**: Automatic failover through model chain on errors
- **Auth Rotation**: Round-robin profile selection with exponential backoff cooldown
- **Context Management**: Token estimation and window validation
- **Streaming Support**: Async iterator-based streaming with abort handling

**Model Catalog**:
- Supports multiple providers: OpenAI, Anthropic, Google, Azure, etc.
- Context windows: 16k to 2M tokens
- Task-specific preferences: coding, analysis, reasoning, etc.

**Error Classification**:
- Auth errors → Try different auth profile
- Rate limit → Exponential backoff
- Context window exceeded → Try larger model
- Timeout → Retry with timeout adjustment
- Unavailable → Try fallback model

### 3. Task Queue

**Purpose**: Lane-based queue system for concurrent task execution.

**Key Features**:
- **Lane Isolation**: Separate queues per lane (MAIN, ANALYSIS, DECISION, etc.)
- **Configurable Concurrency**: Per-lane maxConcurrent settings
- **FIFO Ordering**: Within-lane task ordering
- **Cross-Lane Concurrency**: Tasks in different lanes run concurrently
- **Error Isolation**: Failures in one lane don't affect others
- **Wait Time Monitoring**: Logs warnings for excessive queue waits

**Lane Types**:
- `MAIN`: General operations (concurrency: 1)
- `ANALYSIS`: Code analysis tasks (concurrency: 2)
- `DECISION`: Decision-making tasks (concurrency: 1)
- `EVOLUTION`: Self-improvement tasks (concurrency: 1)
- `REPO_*`: Per-repository lanes (concurrency: 1)

### 4. Analysis Engine

**Purpose**: System for analyzing code quality, performance, and technical debt.

**Key Features**:
- **Code Quality Analysis**: AST parsing, complexity calculation, code smell detection
- **Duplication Detection**: Hash-based duplicate code identification
- **Issue Ranking**: Severity and impact-based prioritization
- **Performance Analysis**: Bottleneck identification, anomaly detection
- **Technical Debt**: Debt detection, quantification, and threshold monitoring
- **Impact Assessment**: Component dependency analysis, risk/benefit estimation

**Analysis Types**:
- Cyclomatic complexity
- Method length
- Code duplication
- Outdated dependencies
- Missing tests
- Architectural violations
- Performance bottlenecks
- Anomalies (> 3 std dev)

### 5. Decision Engine

**Purpose**: System for evaluating priorities, impact, risk, and consultation triggers.

**Key Features**:
- **Priority Scoring**: Multi-factor scoring (impact, urgency, effort, alignment)
- **Risk Evaluation**: Likelihood and severity assessment with mitigation strategies
- **Consultation Triggers**: Automatic consultation for high-impact/high-risk decisions
- **Feedback Loop**: Incorporates user feedback to improve decision models

**Scoring Formula**:
```
Priority Score = (w1 × Impact) + (w2 × Urgency) + (w3 × Effort) + (w4 × Alignment)
Default weights: w1=0.4, w2=0.3, w3=0.2, w4=0.1
```

**Consultation Triggers**:
- High-impact changes (> threshold)
- High-risk decisions (severity: high)
- Architectural changes
- Breaking changes
- Security-related changes

### 6. Evolution Engine

**Purpose**: System for self-improvement, refactoring, and pattern application.

**Key Features**:
- **Self-Code Analysis**: Analyzes Prometheus's own codebase
- **Pattern Application**: Applies proven patterns from pattern library
- **Architecture Analysis**: Identifies architectural improvements
- **Agent Optimization**: Optimizes decision models and analysis algorithms
- **Learning Loop**: Tracks prediction accuracy and adjusts models

**Pattern Sources**:
- OpenClaw patterns (memory, runtime, concurrency)
- Custom patterns from successful implementations
- Industry best practices

---

## Data Flow

### 1. Code Indexing Flow
```
File System → Scanner → Chunker → Embedder → Database
                ↓
         Metadata Extractor
```

### 2. Search Flow
```
Query → Keyword Search (FTS5) ┐
                              ├→ Score Merger → Ranked Results
Query → Vector Search (vec)  ┘
```

### 3. Decision Flow
```
Task → Priority Scorer → Risk Evaluator → Consultation Check → Execution
                                              ↓
                                         User Feedback
                                              ↓
                                         Model Update
```

### 4. Analysis Flow
```
Codebase → Quality Analyzer → Issue Ranker → Recommendations
        → Performance Analyzer → Bottleneck Detector → Optimizations
        → Debt Detector → Quantifier → Threshold Check → Consultation
```

### 5. Runtime Flow
```
Request → Model Selector → Auth Manager → Context Validator → LLM Call
                                              ↓
                                         Error Classifier
                                              ↓
                                         Fallback Chain
```

---

## Integration Points

### 1. ANOTS Repository Integration
- **Access**: Read/write via Git
- **Operations**: Clone, pull, commit, push
- **Analysis**: Code quality, performance, debt
- **Improvements**: Automated refactoring, optimization

### 2. Supabase Integration
- **Purpose**: Store decisions, metrics, patterns
- **Tables**: `prometheus_decisions`, `prometheus_metrics`, `prometheus_patterns`
- **Real-time**: Subscribe to changes for live updates

### 3. GitHub Integration
- **Purpose**: Issue tracking, PR management
- **Operations**: Create issues, create PRs, comment
- **Webhooks**: Receive notifications on events

### 4. Monitoring Integration
- **Purpose**: System health and performance tracking
- **Metrics**: Queue depth, response time, error rate
- **Alerts**: Threshold violations, system errors

### 5. CI/CD Integration
- **Purpose**: Automated testing and deployment
- **Triggers**: On commit, on PR, on schedule
- **Actions**: Run tests, deploy changes, notify

---

## Deployment Architecture

### Production Deployment

```
┌─────────────────────────────────────────┐
│         admin.anots.com                 │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Prometheus Service              │ │
│  │                                   │ │
│  │  ┌─────────────┐  ┌────────────┐ │ │
│  │  │ API Server  │  │ WebSocket  │ │ │
│  │  │  (Express)  │  │   Server   │ │ │
│  │  └─────────────┘  └────────────┘ │ │
│  │                                   │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │   Core Engines              │ │ │
│  │  │  - Memory                   │ │ │
│  │  │  - Runtime                  │ │ │
│  │  │  - Queue                    │ │ │
│  │  │  - Analysis                 │ │ │
│  │  │  - Decision                 │ │ │
│  │  │  - Evolution                │ │ │
│  │  └─────────────────────────────┘ │ │
│  │                                   │ │
│  │  ┌─────────────┐                 │ │
│  │  │  SQLite DB  │                 │ │
│  │  │  + vec ext  │                 │ │
│  │  └─────────────┘                 │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
           │
           ├─────────────────┐
           │                 │
           ▼                 ▼
    ┌─────────────┐   ┌─────────────┐
    │   ANOTS     │   │  Supabase   │
    │ Repository  │   │  Database   │
    └─────────────┘   └─────────────┘
```

### Development Deployment

```
Local Machine
├── Prometheus Service (npm run dev)
├── SQLite Database (local file)
└── Mock Integrations (for testing)
```

### Scaling Considerations

**Current Architecture** (Single Instance):
- Suitable for: Small to medium projects
- Limitations: Single point of failure, limited concurrency

**Future Architecture** (Distributed):
- Multiple Prometheus instances
- Shared database (PostgreSQL with pgvector)
- Load balancer
- Message queue (Redis/RabbitMQ)
- Distributed task queue

---

## Technology Stack

### Core Technologies
- **Runtime**: Node.js >= 18.0.0
- **Language**: TypeScript 5.x
- **Database**: SQLite 3.x with sqlite-vec extension
- **API Server**: Express.js 4.x
- **WebSocket**: ws library
- **Testing**: Jest 29.x, fast-check 3.x

### Key Libraries
- **sqlite3**: SQLite database driver
- **sqlite-vec**: Vector similarity search extension
- **express**: Web server framework
- **ws**: WebSocket implementation
- **fast-check**: Property-based testing
- **supertest**: HTTP testing

### Development Tools
- **TypeScript**: Type checking and compilation
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Jest**: Test runner
- **ts-node**: TypeScript execution

### External Services
- **OpenAI**: GPT models
- **Anthropic**: Claude models
- **Google**: Gemini models
- **Azure**: Azure OpenAI models
- **Supabase**: Database and real-time
- **GitHub**: Repository management

---

## Performance Characteristics

### Memory Engine
- **Indexing Speed**: ~1000 files/minute
- **Search Latency**: < 100ms for hybrid search
- **Cache Hit Rate**: > 80% for embeddings
- **Storage**: ~1MB per 1000 code chunks

### Runtime Engine
- **Model Selection**: < 10ms
- **Fallback Time**: < 5s per attempt
- **Streaming Latency**: < 100ms first token
- **Concurrent Requests**: Limited by lane concurrency

### Task Queue
- **Enqueue Latency**: < 1ms
- **Dequeue Latency**: < 1ms
- **Max Queue Depth**: Unlimited (memory-bound)
- **Cross-Lane Concurrency**: Up to sum of all lane limits

### Analysis Engine
- **Code Analysis**: ~100 files/minute
- **Duplication Detection**: ~500 files/minute
- **Performance Analysis**: ~1000 metrics/second
- **Impact Assessment**: < 5s per change

---

## Security Considerations

### Authentication
- API keys stored in environment variables
- Auth profiles with rotation support
- No credentials in code or logs

### Authorization
- Repository access controlled by Git credentials
- Database access restricted to Prometheus service
- API endpoints protected by authentication

### Data Privacy
- Code stored locally in SQLite
- Embeddings cached with content hashing
- No sensitive data sent to external services (except LLM providers)

### Audit Trail
- All decisions logged with timestamps
- All metric changes tracked
- All pattern applications recorded

---

## Monitoring and Observability

### Metrics
- Queue depth per lane
- Response time per operation
- Error rate per component
- Cache hit rate
- Model usage statistics

### Logs
- Structured logging with levels (debug, info, warn, error)
- Request/response logging
- Error stack traces
- Performance timing

### Alerts
- Queue depth exceeds threshold
- Error rate exceeds threshold
- Response time exceeds threshold
- System resource usage high

### Dashboards
- System health overview
- Performance metrics
- Error trends
- Model usage breakdown

---

## Future Enhancements

### Short-term (3-6 months)
- PostgreSQL migration for better scalability
- Distributed task queue with Redis
- Enhanced monitoring with Prometheus/Grafana
- Multi-repository support

### Medium-term (6-12 months)
- Multi-instance deployment with load balancing
- Advanced pattern learning with ML
- Automated A/B testing for improvements
- Integration with more LLM providers

### Long-term (12+ months)
- Fully autonomous operation mode
- Cross-project pattern sharing
- Predictive analysis and proactive improvements
- Self-healing capabilities

---

## References

- [Requirements Document](../.kiro/specs/prometheus/requirements.md)
- [Design Document](../.kiro/specs/prometheus/design.md)
- [API Documentation](./API.md)
- [Database Schema](./DATABASE.md)
- [OpenClaw Patterns](../openclaw-learning/patterns/)
