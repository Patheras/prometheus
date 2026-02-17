# Design Document: Frontend-Backend Integration

## Overview

This design document outlines the architecture for integrating the Prometheus Next.js frontend with the Express backend API. The integration replaces mock data with real API calls, implements a centralized API client, establishes error handling patterns, and ensures proper loading state management across all frontend components.

The design follows a phased migration approach, starting with the API client infrastructure, then migrating each feature area (activity feed, promotions, analysis, dashboard) systematically. This ensures the application remains functional throughout the integration process.

### Key Design Principles

1. **Centralized API Client**: All backend communication flows through a single, well-tested API client module
2. **Type Safety**: Full TypeScript typing for all API requests and responses
3. **Error Resilience**: Graceful degradation with user-friendly error messages
4. **Progressive Enhancement**: Maintain existing functionality while adding real backend integration
5. **Developer Experience**: Clear patterns and abstractions for future API integrations

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Next.js Frontend (Port 3042)                │  │
│  │                                                       │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │   Pages     │  │  Components  │  │  API Client│  │  │
│  │  │ (UI Views)  │→ │  (UI Logic)  │→ │  (Network) │  │  │
│  │  └─────────────┘  └──────────────┘  └────────────┘  │  │
│  │                                            ↓          │  │
│  └────────────────────────────────────────────┼──────────┘  │
└─────────────────────────────────────────────────┼───────────┘
                                                  ↓
                                    HTTP Requests (fetch API)
                                                  ↓
┌─────────────────────────────────────────────────┼───────────┐
│                                                 ↓            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Express Backend (Port 4242)                    │ │
│  │                                                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │ │
│  │  │  Routes  │→ │ Business │→ │   Data   │           │ │
│  │  │ (API)    │  │  Logic   │  │  Layer   │           │ │
│  │  └──────────┘  └──────────┘  └──────────┘           │ │
│  └────────────────────────────────────────────────────────┘ │
│                         Server                               │
└──────────────────────────────────────────────────────────────┘
```

### Component Architecture

The frontend architecture consists of three main layers:

1. **Presentation Layer** (Pages & Components)
   - React components that render UI
   - Handle user interactions
   - Manage local UI state (loading, errors)
   - Call API client methods

2. **API Client Layer** (lib/api-client.ts)
   - Centralized HTTP client
   - Request/response transformation
   - Error handling and retry logic
   - Type-safe interfaces

3. **Backend Integration Layer** (Next.js API Routes - Optional Proxy)
   - Currently proxies requests via next.config.ts rewrites
   - Can be extended for server-side data fetching
   - Handles authentication/authorization (future)

### Data Flow

```
User Action → Component Event Handler → API Client Method
                                              ↓
                                    HTTP Request (fetch)
                                              ↓
                                    Backend Endpoint
                                              ↓
                                    JSON Response
                                              ↓
                                    API Client Transform
                                              ↓
                                    Component State Update
                                              ↓
                                    UI Re-render
```

## Components and Interfaces

### API Client Module

**Location**: `lib/api-client.ts`

The API client provides a centralized interface for all backend communication.

#### Core Interface

```typescript
interface ApiClientConfig {
  baseUrl: string
  timeout?: number
  headers?: Record<string, string>
}

interface ApiResponse<T> {
  data?: T
  error?: ApiError
  status: number
}

interface ApiError {
  message: string
  code?: string
  details?: unknown
}

class ApiClient {
  constructor(config: ApiClientConfig)
  
  // Core HTTP methods
  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>>
  async post<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<ApiResponse<T>>
  async patch<T>(endpoint: string, body: unknown, options?: RequestOptions): Promise<ApiResponse<T>>
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>>
  
  // Utility methods
  setAuthToken(token: string): void
  clearAuthToken(): void
  getBaseUrl(): string
}
```

#### Request Options

```typescript
interface RequestOptions {
  signal?: AbortSignal  // For request cancellation
  timeout?: number      // Override default timeout
  headers?: Record<string, string>  // Additional headers
  retries?: number      // Number of retry attempts
}
```

#### Error Handling

The API client implements a three-tier error handling strategy:

1. **Network Errors**: Connection failures, timeouts
   - Retry with exponential backoff
   - Return user-friendly error message

2. **HTTP Errors**: 4xx, 5xx status codes
   - Parse error response from backend
   - Return structured error object

3. **Parse Errors**: Invalid JSON responses
   - Log raw response for debugging
   - Return generic error message

```typescript
function handleApiError(error: unknown): ApiError {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: 'Unable to connect to server. Please check your connection.',
      code: 'NETWORK_ERROR'
    }
  }
  
  if (error instanceof Response) {
    return {
      message: error.statusText || 'Server error occurred',
      code: `HTTP_${error.status}`,
      details: await error.json().catch(() => null)
    }
  }
  
  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    details: error
  }
}
```

### Activity Feed Integration

**Backend Endpoint**: `GET /api/activity`

**Response Format**:
```typescript
interface ActivityResponse {
  activities: Activity[]
}

interface Activity {
  type: 'success' | 'warning' | 'info' | 'error'
  message: string
  time: string  // Human-readable (e.g., "2 minutes ago")
  timestamp: number  // Unix timestamp
  entityType?: 'repository' | 'promotion' | 'analysis' | 'chat'
  entityId?: string
}
```

**Frontend Implementation**:
- Remove mock data from `app/api/activity/route.ts`
- Update `app/dashboard/page.tsx` to call API client
- Implement loading and error states
- Add refresh mechanism

**Backend Implementation** (New):
- Create activity event aggregator
- Track events from: code analysis, promotions, repository changes, chat
- Store recent events in memory (last 100) or database
- Return sorted by timestamp descending

### Promotions Integration

**Backend Endpoints**:
- `GET /api/evolution/promotions/pending` - List pending promotions
- `POST /api/evolution/promotions/:promotionId/approve` - Approve promotion
- `POST /api/evolution/promotions/:promotionId/reject` - Reject promotion

**Response Formats**:
```typescript
interface PromotionsResponse {
  promotions: Promotion[]
}

interface Promotion {
  id: string
  title: string
  description: string
  type: 'bug_fix' | 'refactoring' | 'feature' | 'optimization'
  status: 'pending' | 'approved' | 'rejected' | 'deployed'
  createdAt: number
  filesChanged: number
  linesAdded: number
  linesRemoved: number
  repository: string
  files?: FileChange[]
}

interface FileChange {
  path: string
  additions: number
  deletions: number
  changes: number
  diff?: string
}

interface ApproveRequest {
  approvedBy: string
}

interface RejectRequest {
  rejectedBy: string
  reason: string
}
```

**Frontend Implementation**:
- Remove `app/api/promotions/route.ts` (mock data)
- Update `app/promotions/page.tsx` to call backend directly
- Implement approve/reject actions with confirmation
- Add loading states for actions
- Refresh list after actions complete

### Analysis Integration

**Backend Endpoints**:
- `POST /api/analyze/quality` - Run code quality analysis
- `POST /api/analyze/debt` - Run technical debt detection

**Request/Response Formats**:
```typescript
interface QualityAnalysisRequest {
  repositoryId?: string  // Optional: analyze specific repo
  filePath?: string      // Optional: analyze specific file
  sourceCode?: string    // Optional: analyze code snippet
}

interface QualityAnalysisResponse {
  issues: QualityIssue[]
  metrics: QualityMetrics
  timestamp: number
}

interface QualityIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
  rule?: string
}

interface QualityMetrics {
  totalIssues: number
  errorCount: number
  warningCount: number
  infoCount: number
  qualityScore: number  // 0-100
}

interface DebtAnalysisRequest {
  codebasePath: string
  options?: {
    includePatterns?: string[]
    excludePatterns?: string[]
  }
}

interface DebtAnalysisResponse {
  debt: DebtItem[]
  summary: DebtSummary
  timestamp: number
}

interface DebtItem {
  type: 'TODO' | 'FIXME' | 'HACK' | 'XXX' | 'CODE_SMELL'
  message: string
  file: string
  line: number
  severity: 'high' | 'medium' | 'low'
}

interface DebtSummary {
  totalItems: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
}
```

**Frontend Implementation**:
- Update `app/analysis/page.tsx` to call backend endpoints
- Display analysis results in UI
- Show loading spinner during analysis
- Handle long-running operations (analysis can take time)
- Display errors with retry option

### Dashboard Integration

**Backend Endpoint**: `GET /api/stats` (already exists)

**Frontend Implementation**:
- Already calls `/api/stats` correctly
- Add call to `/api/activity` (replacing mock)
- Implement error boundaries for each stat card
- Add manual refresh button
- Show partial data if some requests fail

## Data Models

### Environment Configuration

```typescript
interface EnvironmentConfig {
  apiUrl: string
  isDevelopment: boolean
  isProduction: boolean
}

function getEnvironmentConfig(): EnvironmentConfig {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4242'
  const nodeEnv = process.env.NODE_ENV || 'development'
  
  return {
    apiUrl,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production'
  }
}
```

### Loading State Model

```typescript
interface LoadingState<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  refetch: () => Promise<void>
}

function useApiData<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  dependencies: unknown[] = []
): LoadingState<T> {
  const [state, setState] = useState<LoadingState<T>>({
    data: null,
    loading: true,
    error: null,
    refetch: async () => {}
  })
  
  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    const response = await fetcher()
    
    if (response.error) {
      setState(prev => ({ ...prev, loading: false, error: response.error }))
    } else {
      setState(prev => ({ ...prev, loading: false, data: response.data }))
    }
  }, dependencies)
  
  useEffect(() => {
    fetchData()
  }, [fetchData])
  
  return {
    ...state,
    refetch: fetchData
  }
}
```

### Request Cancellation Model

```typescript
function useAbortController() {
  const abortControllerRef = useRef<AbortController | null>(null)
  
  useEffect(() => {
    return () => {
      // Cleanup: abort pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  const getSignal = () => {
    abortControllerRef.current = new AbortController()
    return abortControllerRef.current.signal
  }
  
  return { getSignal }
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Activity Event Aggregation Completeness

*For any* system event (code analysis, promotion, repository change, or chat interaction), when that event occurs, it should appear in the activity feed returned by the `/api/activity` endpoint.

**Validates: Requirements 1.2**

### Property 2: Activity Event Structure Completeness

*For any* activity event returned by the backend, it should contain all required fields: type, message, timestamp, and optionally entityType and entityId.

**Validates: Requirements 1.4**

### Property 3: Activity Event Ordering

*For any* list of activity events returned by the backend, the events should be sorted by timestamp in descending order (newest first).

**Validates: Requirements 1.5**

### Property 4: Promotion Data Display Completeness

*For any* promotion object returned by the backend, the frontend UI should display all required fields: title, description, type, status, timestamps, file changes, and repository name.

**Validates: Requirements 2.4**

### Property 5: Loading State Lifecycle

*For any* API request initiated by the frontend, the loading indicator should be shown when the request starts, and hidden when the request completes (either successfully or with an error).

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 6: Analysis Loading Feedback

*For any* analysis request (quality or debt), a loading indicator should be displayed while the request is in progress.

**Validates: Requirements 3.3**

### Property 7: Analysis Results Display

*For any* successful analysis response, the frontend should display the results in the UI.

**Validates: Requirements 3.4, 4.4**

### Property 8: Error Message Display

*For any* API error (network, server, or validation), the frontend should display an appropriate error message to the user.

**Validates: Requirements 3.5, 5.1, 5.2, 5.3**

### Property 9: Dashboard Partial Failure Handling

*For any* dashboard data request that fails, the frontend should display the successfully loaded data and show error states only for the failed sections.

**Validates: Requirements 4.5**

### Property 10: Dashboard Loading Indicators

*For any* dashboard data section that is loading, a loading indicator should be displayed for that specific section.

**Validates: Requirements 4.3**

### Property 11: Error Logging

*For any* API error that occurs, the error should be logged to the browser console with sufficient detail for debugging.

**Validates: Requirements 5.4**

### Property 12: Retry Mechanism Availability

*For any* retryable API error (network errors, 5xx server errors), the frontend should provide a retry mechanism to the user.

**Validates: Requirements 5.5**

### Property 13: Button Disabling During Requests

*For any* action button that triggers an API request, the button should be disabled while the request is in progress to prevent duplicate submissions.

**Validates: Requirements 6.4**

### Property 14: Long Operation Feedback

*For any* API operation that exceeds 2 seconds, additional visual feedback should be provided to indicate the operation is still in progress.

**Validates: Requirements 6.5**

### Property 15: URL Construction Correctness

*For any* API endpoint path and base URL, the API client should construct a valid full URL by correctly combining them.

**Validates: Requirements 7.3**

### Property 16: Data Refresh After Mutation

*For any* user action that modifies backend data (approve, reject, create, update, delete), the frontend should refresh the affected data after the action completes successfully.

**Validates: Requirements 8.1**

### Property 17: UI State Synchronization

*For any* data change in the backend, the frontend UI should update to reflect the new state.

**Validates: Requirements 8.3**

### Property 18: Concurrent Update Handling

*For any* set of concurrent API requests updating the same data, the final UI state should correctly reflect the last completed update without race conditions.

**Validates: Requirements 8.4**

### Property 19: Response Caching

*For any* API response that is cacheable, repeated requests within the cache validity period should use the cached data instead of making new network requests.

**Validates: Requirements 8.5**

### Property 20: API Client Request Configuration

*For any* API request made through the API client, it should include the correct base URL, headers, and authentication tokens.

**Validates: Requirements 9.2**

### Property 21: API Client Error Handling Consistency

*For any* API error handled by the API client, it should be transformed into a consistent error format regardless of the error source.

**Validates: Requirements 9.3**

### Property 22: Request Cancellation on Unmount

*For any* component that makes API requests, when the component unmounts, all pending requests should be cancelled to prevent memory leaks and state updates on unmounted components.

**Validates: Requirements 9.5**

### Property 23: UI Behavior Preservation During Migration

*For any* endpoint that is migrated from mock data to real backend calls, the UI behavior and user interactions should remain unchanged.

**Validates: Requirements 10.1**

## Error Handling

### Error Categories

The system handles three main categories of errors:

1. **Network Errors**
   - Connection failures
   - Timeouts
   - DNS resolution failures
   - **Handling**: Retry with exponential backoff, show connectivity error message

2. **HTTP Errors**
   - 4xx Client Errors (bad request, unauthorized, not found)
   - 5xx Server Errors (internal server error, service unavailable)
   - **Handling**: Parse error response, show specific error message, log details

3. **Application Errors**
   - Invalid JSON responses
   - Type mismatches
   - Unexpected data structures
   - **Handling**: Log raw response, show generic error, report to error tracking

### Error Recovery Strategies

```typescript
interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error
  let delay = config.initialDelay
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on client errors (4xx)
      if (error instanceof Response && error.status >= 400 && error.status < 500) {
        throw error
      }
      
      if (attempt < config.maxRetries) {
        await sleep(delay)
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay)
      }
    }
  }
  
  throw lastError!
}
```

### Error Boundaries

React error boundaries catch rendering errors and prevent the entire app from crashing:

```typescript
class ApiErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('API Error Boundary caught error:', error, errorInfo)
    // Could send to error tracking service here
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    
    return this.props.children
  }
}
```

### User-Friendly Error Messages

Error messages should be clear, actionable, and non-technical:

```typescript
function getUserFriendlyErrorMessage(error: ApiError): string {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    
    case 'HTTP_401':
      return 'Your session has expired. Please log in again.'
    
    case 'HTTP_403':
      return 'You don\'t have permission to perform this action.'
    
    case 'HTTP_404':
      return 'The requested resource was not found.'
    
    case 'HTTP_500':
    case 'HTTP_502':
    case 'HTTP_503':
      return 'The server is experiencing issues. Please try again in a few moments.'
    
    case 'TIMEOUT':
      return 'The request took too long to complete. Please try again.'
    
    default:
      return error.message || 'An unexpected error occurred. Please try again.'
  }
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific API endpoint calls with expected payloads
- Error handling for known error scenarios
- Component rendering with mock data
- User interaction flows (click, submit, etc.)
- Edge cases like empty responses, missing fields

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs
- Data structure validation across random inputs
- Error handling consistency across error types
- Loading state behavior across all API calls
- URL construction correctness for any base URL and endpoint

### Property-Based Testing Configuration

We will use **fast-check** for property-based testing in TypeScript/JavaScript. Each property test should:
- Run a minimum of 100 iterations
- Generate random but valid test data
- Reference the design document property it validates
- Use the tag format: `Feature: frontend-backend-integration, Property N: [property description]`

### Test Organization

```
tests/
├── unit/
│   ├── api-client.test.ts          # API client unit tests
│   ├── activity-feed.test.ts       # Activity feed integration
│   ├── promotions.test.ts          # Promotions integration
│   ├── analysis.test.ts            # Analysis integration
│   └── dashboard.test.ts           # Dashboard integration
├── property/
│   ├── api-client.property.test.ts # API client properties
│   ├── error-handling.property.test.ts # Error handling properties
│   ├── loading-states.property.test.ts # Loading state properties
│   └── data-sync.property.test.ts  # Data synchronization properties
└── integration/
    └── end-to-end.test.ts          # Full integration tests
```

### Example Property Test

```typescript
import fc from 'fast-check'

describe('Feature: frontend-backend-integration, Property 15: URL Construction Correctness', () => {
  it('should correctly construct full URLs from base URL and endpoint', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // Generate random base URLs
        fc.string().filter(s => s.startsWith('/')), // Generate endpoint paths
        (baseUrl, endpoint) => {
          const apiClient = new ApiClient({ baseUrl })
          const fullUrl = apiClient.constructUrl(endpoint)
          
          // Property: Full URL should start with base URL
          expect(fullUrl).toStartWith(baseUrl)
          
          // Property: Full URL should end with endpoint
          expect(fullUrl).toEndWith(endpoint)
          
          // Property: Full URL should be valid
          expect(() => new URL(fullUrl)).not.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Integration Testing

Integration tests verify the complete flow from user action to backend response:

1. **Activity Feed Flow**
   - User loads dashboard
   - Frontend calls `/api/activity`
   - Backend returns activity events
   - Frontend displays events in UI

2. **Promotion Approval Flow**
   - User clicks "Approve" on promotion
   - Frontend calls `/api/evolution/promotions/:id/approve`
   - Backend processes approval
   - Frontend refreshes promotion list
   - UI shows updated status

3. **Analysis Flow**
   - User selects repository and clicks "Run Analysis"
   - Frontend calls `/api/analyze/quality`
   - Backend performs analysis (may take time)
   - Frontend shows loading indicator
   - Backend returns results
   - Frontend displays results in UI

### Test Data Management

Use factories to generate consistent test data:

```typescript
function createMockActivity(overrides?: Partial<Activity>): Activity {
  return {
    type: 'success',
    message: 'Test activity',
    time: '1 minute ago',
    timestamp: Date.now(),
    ...overrides
  }
}

function createMockPromotion(overrides?: Partial<Promotion>): Promotion {
  return {
    id: 'test-id',
    title: 'Test Promotion',
    description: 'Test description',
    type: 'bug_fix',
    status: 'pending',
    createdAt: Date.now(),
    filesChanged: 1,
    linesAdded: 10,
    linesRemoved: 5,
    repository: 'test-repo',
    ...overrides
  }
}
```

### Mocking Strategy

For unit tests, mock the API client to avoid real network calls:

```typescript
jest.mock('@/lib/api-client')

const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('should call activity endpoint', async () => {
  mockApiClient.get.mockResolvedValue({
    data: { activities: [createMockActivity()] },
    status: 200
  })
  
  const { result } = renderHook(() => useActivity())
  
  await waitFor(() => {
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/activity')
    expect(result.current.data).toHaveLength(1)
  })
})
```

### Coverage Goals

- **Unit Test Coverage**: Minimum 80% line coverage
- **Property Test Coverage**: All 23 correctness properties implemented
- **Integration Test Coverage**: All major user flows covered
- **Error Path Coverage**: All error scenarios tested

### Continuous Integration

Tests should run automatically on:
- Every commit (unit tests only for speed)
- Every pull request (full test suite)
- Before deployment (full test suite + integration tests)

### Performance Testing

While not the primary focus, we should monitor:
- API response times (should be < 500ms for most endpoints)
- Frontend rendering performance (should be < 100ms)
- Memory usage (no memory leaks from uncancelled requests)
