# Design Document: Prometheus Standalone Setup

## Overview

This design document specifies the implementation approach for setting up Prometheus as a standalone system after being separated from another repository. The focus is on environment configuration, database initialization, dependency management, development workflows, production deployment, health monitoring, comprehensive documentation, error handling, testing infrastructure, configuration validation, and Supabase integration.

The design maintains the existing architecture and does not modify core backend API structure, frontend components, database schema, or evolution system logic. All changes are additive and focused on improving setup, configuration, and operational aspects.

## Architecture

### System Components

The Prometheus system consists of the following components that require proper setup:

1. **Backend API** (Express on port 4242)
   - REST endpoints for repositories, analysis, chat, stats, workspace, and evolution
   - Database connectivity (SQLite local or Supabase cloud)
   - Evolution system initialization (DevProdManager, SelfAnalyzer)
   - Environment variable validation
   - Health monitoring

2. **Frontend UI** (Next.js on port 3042)
   - React-based user interface
   - API proxy to backend
   - Static asset optimization
   - Development hot-reload

3. **Database Layer**
   - SQLite for local development (data/prometheus.db)
   - Supabase for cloud deployment (optional)
   - Schema migrations and validation
   - Automatic initialization

4. **Configuration System**
   - Environment variables (.env)
   - Validation on startup
   - Multiple LLM provider support
   - Platform-specific settings

### Setup Flow

```
Installation → Configuration → Database Init → Service Start → Health Check
     ↓              ↓               ↓              ↓              ↓
npm install    .env setup    Auto-create DB   Backend:4242   /health OK
                                               Frontend:3042
```

## Components and Interfaces

### 1. Environment Configuration Module

**Purpose**: Validate and manage environment variables

**Location**: `src/config/env-validator.ts`

**Interface**:
```typescript
interface EnvConfig {
  // Server
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  
  // Database
  databasePath: string;
  
  // LLM Providers
  azureOpenAI: {
    endpoint: string;
    apiKey: string;
    deploymentName: string;
    apiVersion: string;
    reasoningEffort?: string;
  };
  azureOpenAICodex?: {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion: string;
  };
  anthropicApiKey?: string;
  openaiApiKey?: string;
  
  // Integrations
  githubToken?: string;
  githubRepoOwner?: string;
  githubRepoName?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  variable: string;
  message: string;
  required: boolean;
}

class EnvValidator {
  validate(): ValidationResult;
  validateFormat(variable: string, value: string, format: 'url' | 'port' | 'path'): boolean;
  getRequiredVariables(): string[];
  getOptionalVariables(): string[];
}
```

**Behavior**:
- Validates presence of required variables
- Validates format of URLs, ports, paths
- Returns structured errors with variable names
- Distinguishes between required and optional variables
- Provides helpful error messages

### 2. Database Initialization Module

**Purpose**: Automatically initialize and validate database schema

**Location**: `src/scripts/init-db.ts` (enhanced)

**Interface**:
```typescript
interface DatabaseConfig {
  path: string;
}

interface InitResult {
  success: boolean;
  created: boolean;
  migrationsApplied: number;
  errors: string[];
}

class DatabaseInitializer {
  async initialize(config: DatabaseConfig): Promise<InitResult>;
  async validateSchema(): Promise<boolean>;
  async createDirectories(path: string): Promise<void>;
  async applyMigrations(): Promise<number>;
}
```

**Behavior**:
- Creates data directory if missing
- Creates database file if missing
- Applies all pending migrations
- Validates schema on startup
- Reports detailed errors with recovery steps

### 3. Startup Validation Module

**Purpose**: Validate system readiness before starting services

**Location**: `src/startup/validator.ts`

**Interface**:
```typescript
interface StartupChecks {
  environment: boolean;
  database: boolean;
  ports: boolean;
  dependencies: boolean;
}

class StartupValidator {
  async validateAll(): Promise<StartupChecks>;
  async checkPortAvailability(port: number): Promise<boolean>;
  async checkDatabaseConnectivity(): Promise<boolean>;
  async checkDependencies(): Promise<boolean>;
}
```

**Behavior**:
- Validates environment configuration
- Checks database connectivity
- Verifies ports are available
- Confirms critical dependencies are installed
- Prevents startup if critical checks fail

### 4. Health Check Module

**Purpose**: Provide comprehensive health monitoring

**Location**: `src/api/health.ts` (enhanced)

**Interface**:
```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  components: {
    database: ComponentHealth;
    evolutionSystem: ComponentHealth;
    apiServer: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'up' | 'down';
  message?: string;
  latency?: number;
}

class HealthChecker {
  async checkHealth(): Promise<HealthStatus>;
  async checkDatabase(): Promise<ComponentHealth>;
  async checkEvolutionSystem(): Promise<ComponentHealth>;
}
```

**Behavior**:
- Tests database connectivity
- Verifies evolution system status
- Reports component-level health
- Returns appropriate HTTP status codes
- Includes latency measurements

### 5. Documentation Generator

**Purpose**: Generate comprehensive setup documentation

**Location**: `scripts/generate-docs.ts`

**Files to Create/Update**:
- `SETUP.md` - Step-by-step setup guide
- `ENVIRONMENT.md` - Environment variable reference
- `TROUBLESHOOTING.md` - Common issues and solutions
- Updated `README.md` - Quick start section

**Content Structure**:
```markdown
# SETUP.md
1. Prerequisites
2. Installation Steps
3. Environment Configuration
4. Database Setup
5. Verification
6. Next Steps

# ENVIRONMENT.md
- Variable reference table
- Required vs Optional
- Format specifications
- Example values

# TROUBLESHOOTING.md
- Port already in use
- Database connection failed
- Missing dependencies
- Permission errors
- Platform-specific issues
```

## Data Models

### Environment Configuration

```typescript
interface EnvironmentConfig {
  server: {
    port: number;
    nodeEnv: string;
  };
  database: {
    path: string;
  };
  llmProviders: {
    primary: LLMProviderConfig;
    fallbacks: LLMProviderConfig[];
  };
  integrations: {
    github?: GitHubConfig;
    monitoring?: MonitoringConfig;
  };
}
```

### Validation Error Model

```typescript
interface ValidationError {
  type: 'missing' | 'invalid_format' | 'invalid_value';
  variable: string;
  message: string;
  expected?: string;
  actual?: string;
  suggestion?: string;
}
```

### Health Check Model

```typescript
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  components: Record<string, ComponentStatus>;
}

interface ComponentStatus {
  status: 'up' | 'down' | 'degraded';
  message?: string;
  latency?: number;
  lastCheck: string;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Environment Variable Validation Completeness

*For any* set of environment variables, when validation is performed, all missing required variables should be identified and reported in a single error message.

**Validates: Requirements 1.3, 8.2, 10.1**

### Property 2: Environment Variable Format Validation

*For any* environment variable with a specified format (URL, port, path), when an invalid value is provided, the validation should reject it and provide a clear error message indicating the expected format.

**Validates: Requirements 10.2**

### Property 3: Database Schema Consistency

*For any* newly created database, after initialization and migration application, the schema should match the expected schema definition exactly (all tables, indexes, and constraints present).

**Validates: Requirements 2.2, 2.5**

### Property 4: Database Directory Creation

*For any* database path with non-existent parent directories, the system should either create the directories successfully or report a permission error with specific details.

**Validates: Requirements 10.5**

### Property 5: Configuration Validation Prevents Startup

*For any* invalid configuration (missing required variables or invalid formats), the system should prevent startup and display all validation errors before attempting to initialize any services.

**Validates: Requirements 10.3**

### Property 6: Error Message Context Completeness

*For any* startup error, the logged error message should include sufficient context (component name, error type, timestamp) to diagnose the issue.

**Validates: Requirements 8.1**

### Property 7: Database Error Recovery Guidance

*For any* database initialization failure, the error message should include specific error details and at least one recovery step.

**Validates: Requirements 2.4, 8.3**

### Property 8: API Error Response Structure

*For any* API endpoint failure, the response should be a structured JSON object containing an error code, message, and HTTP status code.

**Validates: Requirements 8.5**

### Property 9: Port Availability Validation

*For any* required port, before starting a service, the system should verify the port is available and report an error if it's already in use.

**Validates: Requirements 10.6**

### Property 10: Health Check Database Connectivity

*For any* health check request, when the database is accessible, the health endpoint should return a successful status with database component marked as "up".

**Validates: Requirements 6.2**

### Property 11: Health Check Failure Status Codes

*For any* critical service failure (database, evolution system), the health endpoint should return an appropriate HTTP status code (503 Service Unavailable) and mark the failed component.

**Validates: Requirements 6.4**

### Property 13: Service Failure Isolation

*For any* service startup failure (backend or frontend), the error should be displayed and the other service should continue attempting to start.

**Validates: Requirements 4.4**

### Property 14: Production Build Optimization

*For any* production build, when NODE_ENV is set to "production", the system should use production-optimized configurations (minification, no source maps in client code, production React build).

**Validates: Requirements 5.5**

### Property 15: Log Level Environment Sensitivity

*For any* environment (development or production), the log level should be appropriate to the environment (debug in development, info/warn/error in production).

**Validates: Requirements 8.6**

### Property 16: Dependency Installation Success

*For any* missing dependency, when the system starts, it should detect the missing dependency and provide a clear error message indicating which dependency is missing and how to install it.

**Validates: Requirements 3.3**

## Error Handling

### Error Categories

1. **Configuration Errors**
   - Missing required environment variables
   - Invalid environment variable formats
   - Invalid configuration values
   - **Handling**: Prevent startup, display all errors, provide examples

2. **Database Errors**
   - Database file creation failure
   - Migration application failure
   - Schema validation failure
   - Connection failure (Supabase)
   - **Handling**: Log detailed error, provide recovery steps, exit gracefully

3. **Dependency Errors**
   - Missing npm packages
   - Native module compilation failure
   - Incompatible Node.js version
   - **Handling**: Display clear error, provide installation commands

4. **Runtime Errors**
   - Port already in use
   - Permission denied
   - Disk space exhausted
   - **Handling**: Log error with context, suggest solutions, exit gracefully

5. **Service Errors**
   - Backend startup failure
   - Frontend startup failure
   - Health check failure
   - **Handling**: Log error, continue other services if possible, report status

### Error Message Format

All error messages should follow this structure:

```
[ERROR] <Component>: <Brief Description>

Details:
  - <Specific error information>
  - <Context information>

Possible Solutions:
  1. <First solution>
  2. <Second solution>
  3. <Third solution>

For more help, see: <Documentation link>
```

### Error Logging

- **Development**: Full stack traces, debug information
- **Production**: Sanitized errors, no sensitive data, structured logs
- **All Environments**: Timestamp, component name, error type, context

## Testing Strategy

### Unit Tests

Unit tests will verify individual components and functions:

1. **Environment Validation Tests**
   - Test validation of each variable type
   - Test missing variable detection
   - Test format validation (URLs, ports, paths)
   - Test error message generation

2. **Database Initialization Tests**
   - Test database creation
   - Test directory creation
   - Test migration application
   - Test schema validation
   - Test error handling

3. **Health Check Tests**
   - Test health endpoint response
   - Test component status checking
   - Test failure scenarios
   - Test status code mapping

4. **Startup Validation Tests**
   - Test port availability checking
   - Test dependency verification
   - Test configuration validation
   - Test startup prevention on errors

### Property-Based Tests

Property-based tests will verify universal properties across many generated inputs:

1. **Property Test: Environment Validation Completeness**
   - Generate random sets of environment variables
   - Verify all missing required variables are detected
   - Verify error message includes all missing variables
   - **Iterations**: 100

2. **Property Test: Format Validation**
   - Generate random invalid URLs, ports, paths
   - Verify validation rejects all invalid formats
   - Verify error messages are clear
   - **Iterations**: 100

3. **Property Test: Database Schema Consistency**
   - Create multiple new databases
   - Verify schema matches expected definition
   - Verify all migrations applied
   - **Iterations**: 50

4. **Property Test: Error Message Context**
   - Simulate various startup errors
   - Verify all error messages include context
   - Verify error messages are actionable
   - **Iterations**: 100

5. **Property Test: Configuration Validation**
   - Generate random invalid configurations
   - Verify startup is prevented
   - Verify all errors are reported
   - **Iterations**: 100

### Integration Tests

Integration tests will verify component interactions:

1. **Full Startup Flow Test**
   - Test complete startup sequence
   - Verify environment validation
   - Verify database initialization
   - Verify service startup
   - Verify health check

2. **Database Initialization Flow Test**
   - Test with missing database
   - Test with missing directory
   - Test with existing database
   - Verify migrations applied correctly

3. **Error Recovery Flow Test**
   - Test recovery from configuration errors
   - Test recovery from database errors
   - Test recovery from service errors

### Smoke Tests

Smoke tests will verify basic functionality after setup:

1. **Installation Smoke Test**
   - Run npm install
   - Verify no errors
   - Verify all dependencies installed

2. **Configuration Smoke Test**
   - Copy .env.example to .env
   - Verify validation passes with example values
   - Verify services start

3. **Database Smoke Test**
   - Delete database
   - Start system
   - Verify database created
   - Verify schema valid

4. **Health Check Smoke Test**
   - Start system
   - Call /health endpoint
   - Verify 200 response
   - Verify all components "up"

### Test Configuration

All property-based tests should:
- Run minimum 100 iterations (50 for expensive tests)
- Use fast-check library
- Tag with feature name and property number
- Reference design document property

Example test tag:
```typescript
// Feature: prometheus-standalone-setup, Property 1: Environment Variable Validation Completeness
```

### Test Coverage Goals

- Environment validation: 100%
- Database initialization: 100%
- Health checks: 100%
- Startup validation: 100%
- Error handling: 90%
