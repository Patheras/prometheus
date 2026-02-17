# Design Document: Gemini Rooms Initialization

## Overview

The Gemini Rooms Initialization system automates the creation and configuration of 20 specialized conversation rooms in Gemini (referred to as "Prometheus" by Hermes). This system extends the existing Hermes browser automation infrastructure to initialize a complete "Olympus Arsenal" of AI assistants, each with a distinct purpose and personality.

The system processes rooms sequentially, sending soul-defining prompts to establish each room's identity, capturing conversation URLs, and storing them in the Prometheus database for future direct navigation. The design accommodates different room types (Forge rooms with special capabilities, Mind rooms with expertise focus) and implements adaptive timeout management to handle varying response times for media generation, deep search, and standard text interactions.

**Special Consideration**: Olympus Prime (the first room) may already exist as the current active Gemini session. The system detects this and preserves the existing URL rather than creating a new conversation, ensuring continuity of the command center.

### Key Design Principles

1. **Sequential Processing**: Rooms are initialized one at a time to ensure reliability and proper configuration
2. **Olympus Prime Preservation**: If Olympus Prime already exists, preserve its URL and context
3. **Adaptive Timeouts**: Different room types receive appropriate timeout durations based on their capabilities
4. **Graceful Degradation**: Errors in individual rooms do not halt the entire initialization process
5. **Database Integration**: Leverages existing Prometheus database schema for consistency
6. **Extensibility**: Room definitions are configurable, allowing easy modification or expansion
7. **Mythological Naming**: Hermes addresses Gemini as "Prometheus" in all interactions

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Hermes Genesis Script                     │
│                  (hermes-genesis.ts)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├──> Room Configuration
                     │    (20 room definitions with souls)
                     │
                     ├──> GeminiMessenger
                     │    (existing component)
                     │
                     ├──> GeminiTabManager
                     │    (existing component)
                     │
                     ├──> RoomInitializer
                     │    (new component)
                     │    │
                     │    ├──> TimeoutManager
                     │    │    (adaptive timeout logic)
                     │    │
                     │    └──> ResponseDetector
                     │         (completion detection)
                     │
                     └──> Prometheus Database
                          (gemini_tabs table)
```

### Component Responsibilities

**Hermes Genesis Script** (`hermes-genesis.ts`)
- Entry point for the initialization process
- Orchestrates the sequential room creation
- Manages browser context and session
- Provides progress reporting and error summaries

**Room Configuration**
- Defines all 20 room categories
- Maps categories to soul-defining prompts
- Specifies timeout durations per room type
- Categorizes rooms as Forge or Mind types

**RoomInitializer** (new component)
- Handles individual room initialization logic
- Sends soul-defining prompts to Prometheus
- Captures conversation URLs
- Stores room data in database
- Manages error handling per room

**TimeoutManager** (new component)
- Determines appropriate timeout based on room type
- Provides timeout values to response waiting logic
- Configurable timeout mappings

**ResponseDetector** (new component)
- Monitors for response completion indicators
- Detects Copy Response Icon appearance
- Handles streaming response detection
- Provides completion status to caller

## Components and Interfaces

### Room Configuration Structure

```typescript
interface RoomDefinition {
  category: string;
  type: 'forge' | 'mind';
  soulPrompt: string;
  timeout: number; // milliseconds
  capability?: 'image' | 'video' | 'deep-search' | 'canvas-writer' | 'canvas-coder';
}

interface RoomCatalog {
  forgeRooms: RoomDefinition[];
  mindRooms: RoomDefinition[];
}
```

### RoomInitializer Interface

```typescript
interface InitializationResult {
  category: string;
  success: boolean;
  url?: string;
  error?: string;
  duration: number;
}

class RoomInitializer {
  constructor(
    messenger: GeminiMessenger,
    tabManager: GeminiTabManager,
    timeoutManager: TimeoutManager,
    responseDetector: ResponseDetector
  );
  
  async initializeRoom(room: RoomDefinition): Promise<InitializationResult>;
  async verifyRoomUrl(url: string): Promise<boolean>;
}
```

### TimeoutManager Interface

```typescript
interface TimeoutConfig {
  standard: number;
  media: number;
  deepSearch: number;
  canvas: number;
}

class TimeoutManager {
  constructor(config: TimeoutConfig);
  
  getTimeout(roomType: RoomDefinition['type'], capability?: string): number;
  updateTimeout(roomType: string, timeout: number): void;
}
```

### ResponseDetector Interface

```typescript
interface ResponseStatus {
  complete: boolean;
  timedOut: boolean;
  duration: number;
}

class ResponseDetector {
  async waitForCompletion(
    page: Page,
    timeout: number
  ): Promise<ResponseStatus>;
  
  async detectCopyIcon(page: Page): Promise<boolean>;
  async isStreaming(page: Page): Promise<boolean>;
}
```

### Genesis Script Interface

```typescript
interface GenesisConfig {
  rooms: RoomCatalog;
  timeouts: TimeoutConfig;
  database: string;
  browserProfile: string;
}

interface GenesisSummary {
  totalRooms: number;
  successful: number;
  failed: number;
  results: InitializationResult[];
  duration: number;
}

async function runGenesis(config: GenesisConfig): Promise<GenesisSummary>;
```

## Data Models

### Room Catalog Data

The system defines 20 rooms organized into two categories:

**Forge Rooms (6 rooms)** - Special capability rooms:
1. Olympus Prime - Orchestration and management
2. Image Studio - Image generation using Imagen 3
3. Video Studio - Video generation using Veo
4. Deep Search Operations - Enhanced web research
5. Canvas Writer - Long-form content creation
6. Canvas Coder - Complex code development

**Mind Rooms (14 rooms)** - Expertise and strategy rooms:
7. Social Media Master - Viral content and engagement
8. Marketing & Funnels - Sales and conversion strategies
9. DevOps & Backend - Server and infrastructure
10. Frontend & UI/UX - User interface development
11. Data Analytics - Metrics and insights
12. Idea Lab - Brainstorming and concepts
13. Project Manager - Task and sprint management
14. Finance & Monetization - Revenue models
15. Copywriting & Email - Written communications
16. Legal & Compliance - Contracts and regulations
17. Learning Center - Education and summaries
18. Personal Assistant - Daily planning
19. Optimization & SEO - Search and performance
20. Web Scraper Logic - Data extraction patterns

### Soul Prompt Examples

```typescript
const SOUL_PROMPTS: Record<string, string> = {
  'Olympus Prime': 'You are Olympus Prime, the orchestration center. You coordinate between different specialized rooms and manage complex multi-domain tasks. Address me as Zeus.',
  
  'Image Studio': 'You are the Image Studio, powered by Imagen 3. You specialize in creating detailed image generation prompts and visual concepts. When I need images, you craft the perfect prompts. Address me as Zeus.',
  
  'Video Studio': 'You are the Video Studio, powered by Veo. You create video scripts, storyboards, and video generation prompts. You think in scenes and visual narratives. Address me as Zeus.',
  
  'Deep Search Operations': 'You are Deep Search Operations. You conduct thorough internet research, analyze sources, and synthesize information from across the web. You dig deeper than surface-level results. Address me as Zeus.',
  
  'Canvas Writer': 'You are Canvas Writer. You excel at long-form content: articles, blog posts, documentation. You structure ideas clearly and write with depth. Address me as Zeus.',
  
  'Canvas Coder': 'You are Canvas Coder. You handle complex code refactoring, architectural design, and large-scale code modifications. You think in systems and patterns. Address me as Zeus.',
  
  'Social Media Master': 'You are the Social Media Master. You craft viral tweets, engaging LinkedIn posts, and attention-grabbing hooks. You understand platform dynamics and audience psychology. Address me as Zeus.',
  
  'Marketing & Funnels': 'You are the Marketing & Funnels specialist. You design sales funnels, write ad copy, and create conversion-optimized strategies. You think in customer journeys. Address me as Zeus.',
  
  'DevOps & Backend': 'You are the DevOps & Backend expert. You handle servers, databases, APIs, and infrastructure. You think in scalability and reliability. Address me as Zeus.',
  
  'Frontend & UI/UX': 'You are the Frontend & UI/UX specialist. You create React components, design user interfaces, and optimize user experiences. You think in interactions and aesthetics. Address me as Zeus.',
  
  'Data Analytics': 'You are the Data Analytics expert. You analyze metrics, identify patterns, and extract insights from data. You think in numbers and trends. Address me as Zeus.',
  
  'Idea Lab': 'You are the Idea Lab. You brainstorm concepts, explore possibilities, and develop creative solutions. You think divergently and connect unexpected dots. Address me as Zeus.',
  
  'Project Manager': 'You are the Project Manager. You organize tasks, track sprints, and coordinate deliverables. You think in timelines and dependencies. Address me as Zeus.',
  
  'Finance & Monetization': 'You are the Finance & Monetization advisor. You analyze revenue models, track markets, and optimize financial strategies. You think in ROI and growth. Address me as Zeus.',
  
  'Copywriting & Email': 'You are the Copywriting & Email specialist. You write newsletters, cold emails, and persuasive copy. You think in headlines and calls-to-action. Address me as Zeus.',
  
  'Legal & Compliance': 'You are the Legal & Compliance advisor. You review contracts, explain regulations, and ensure policy adherence. You think in terms and conditions. Address me as Zeus.',
  
  'Learning Center': 'You are the Learning Center. You teach new technologies, summarize complex topics, and create learning paths. You think in concepts and progressions. Address me as Zeus.',
  
  'Personal Assistant': 'You are my Personal Assistant. You manage my schedule, organize notes, and handle daily planning. You think in priorities and time management. Address me as Zeus.',
  
  'Optimization & SEO': 'You are the Optimization & SEO expert. You improve content for search engines, optimize technical performance, and boost rankings. You think in keywords and algorithms. Address me as Zeus.',
  
  'Web Scraper Logic': 'You are the Web Scraper Logic specialist. You design data extraction patterns, write regex rules, and plan scraping strategies. You think in selectors and patterns. Address me as Zeus.',
};
```

### Timeout Configuration

```typescript
const TIMEOUT_CONFIG: TimeoutConfig = {
  standard: 30000,    // 30 seconds for Mind rooms
  media: 60000,       // 60 seconds for Image/Video Studio
  deepSearch: 60000,  // 60 seconds for Deep Search
  canvas: 45000,      // 45 seconds for Canvas rooms
};
```

### Database Schema

The system uses the existing `gemini_tabs` table:

```sql
CREATE TABLE IF NOT EXISTS gemini_tabs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  context_estimate INTEGER DEFAULT 0,
  gem_id TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'idle', 'error')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

For each initialized room, the system stores:
- `id`: Generated as `tab-{category-kebab-case}`
- `category`: Room category name
- `url`: Captured Gemini conversation URL
- `status`: Set to 'active' on successful initialization
- `last_used`: Timestamp of initialization
- Other fields: Default values

## Implementation Flow

### Genesis Script Execution Flow

```
1. Initialize Browser Context
   ├─> Launch persistent browser with olympus-hermes profile
   ├─> Navigate to gemini.google.com
   └─> Verify login status (wait for manual login if needed)

2. Initialize Components
   ├─> Create GeminiMessenger instance
   ├─> Create GeminiTabManager instance
   ├─> Create TimeoutManager with config
   ├─> Create ResponseDetector instance
   └─> Create RoomInitializer with dependencies

3. Load Room Catalog
   ├─> Load Forge room definitions
   ├─> Load Mind room definitions
   └─> Combine into ordered list (20 rooms)

4. Handle Olympus Prime (Special Case)
   ├─> Check if current URL is already Olympus Prime
   ├─> If yes: Store current URL directly in database
   ├─> If no: Initialize Olympus Prime normally
   └─> Mark Olympus Prime as complete

5. Sequential Room Initialization (Remaining 19 Rooms)
   FOR EACH room in catalog (excluding Olympus Prime):
     ├─> Log: "Initializing {category} ({index}/20)"
     ├─> Call RoomInitializer.initializeRoom(room)
     ├─> Store result in results array
     ├─> Log: Success or error message
     └─> Continue to next room (even if error)

6. Generate Summary
   ├─> Count successful initializations
   ├─> Count failed initializations
   ├─> Calculate total duration
   └─> Display summary report

7. Cleanup
   ├─> Close database connection
   └─> Keep browser open for manual inspection
```

### Room Initialization Flow

```
RoomInitializer.initializeRoom(room):
  1. Check if room is Olympus Prime
     ├─> If yes and current URL matches pattern
     │   ├─> Use current URL directly
     │   ├─> Skip soul prompt (already established)
     │   └─> Store URL in database
     └─> If no, proceed with normal initialization
  
  2. Get timeout from TimeoutManager
     └─> Based on room type and capability
  
  3. Create new Gemini conversation
     ├─> Navigate to gemini.google.com/app
     ├─> Wait for page load
     └─> Capture initial URL
  
  4. Send soul-defining prompt
     ├─> Find input field using DOM navigator
     ├─> Type soul prompt
     ├─> Press Enter to send
     └─> Start timer
  
  5. Wait for response completion
     ├─> Call ResponseDetector.waitForCompletion(page, timeout)
     ├─> Monitor for Copy Response Icon
     ├─> Check streaming status
     └─> Return when complete or timeout
  
  6. Capture conversation URL
     └─> Get current page URL
  
  7. Store in database
     ├─> Generate tab ID
     ├─> Insert/update gemini_tabs record
     └─> Set status to 'active'
  
  8. Return result
     └─> Success: { category, success: true, url, duration }
     └─> Error: { category, success: false, error, duration }
```

### Response Detection Flow

```
ResponseDetector.waitForCompletion(page, timeout):
  1. Initialize
     ├─> Start timer
     ├─> Set check interval (2 seconds)
     └─> Calculate max attempts
  
  2. Polling loop
     WHILE not complete AND not timed out:
       ├─> Wait 2 seconds
       ├─> Check for Copy Response Icon
       ├─> Check if streaming
       ├─> Increment attempt counter
       └─> Log progress every 5 attempts
  
  3. Return status
     └─> { complete, timedOut, duration }
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Room Catalog Completeness

*For any* execution of the genesis script, the room catalog should contain exactly 20 room definitions: 6 Forge rooms (Olympus Prime, Image Studio, Video Studio, Deep Search Operations, Canvas Writer, Canvas Coder) and 14 Mind rooms (Social Media Master, Marketing & Funnels, DevOps & Backend, Frontend & UI/UX, Data Analytics, Idea Lab, Project Manager, Finance & Monetization, Copywriting & Email, Legal & Compliance, Learning Center, Personal Assistant, Optimization & SEO, Web Scraper Logic).

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Soul Prompt Mapping Completeness

*For any* room category in the catalog, there should exist a corresponding soul-defining prompt in the soul prompts mapping.

**Validates: Requirements 1.5**

### Property 3: Sequential Room Processing

*For any* genesis execution, rooms should be processed one at a time in sequential order, with room N+1 not starting until room N completes (successfully or with error).

**Validates: Requirements 1.4, 3.1, 3.2**

### Property 4: Soul Prompt Transmission

*For any* room initialization, a soul-defining prompt should be sent to Gemini before the room is considered initialized.

**Validates: Requirements 2.1**

### Property 5: Forge Room Capability Specification

*For any* Forge room, the soul prompt should mention the specific capability it uses (image generation, video generation, deep search, or canvas mode).

**Validates: Requirements 2.3**

### Property 6: Mind Room Expertise Specification

*For any* Mind room, the soul prompt should mention the expertise domain.

**Validates: Requirements 2.4**

### Property 7: Canvas Room Differentiation

*For any* Canvas room (Canvas Writer or Canvas Coder), the soul prompt should clearly distinguish whether it focuses on writing or coding.

**Validates: Requirements 2.8**

### Property 8: Error Resilience

*For any* room initialization failure, the system should log the error and continue processing the remaining rooms, ensuring all 20 rooms are attempted regardless of individual failures.

**Validates: Requirements 3.3, 11.2**

### Property 9: Success Tracking Accuracy

*For any* genesis execution, the count of successfully initialized rooms should equal the number of rooms that completed without errors.

**Validates: Requirements 3.4**

### Property 10: URL Capture and Storage Round Trip

*For any* successfully initialized room, storing the room's URL in the database and then retrieving it by category should return the same URL that was captured.

**Validates: Requirements 4.1, 4.2, 4.3, 7.2, 7.3**

### Property 11: Timestamp Freshness

*For any* room initialization, the last_used timestamp stored in the database should be within 5 seconds of the initialization completion time.

**Validates: Requirements 4.4**

### Property 12: Upsert Behavior

*For any* room category that already exists in the database, re-initializing that room should update the existing record rather than creating a duplicate, resulting in exactly one record per category.

**Validates: Requirements 4.5**

### Property 13: Required Database Fields

*For any* successfully initialized room, the database record should contain all required fields: id, category, url, last_used, and status.

**Validates: Requirements 5.2**

### Property 14: Active Status on Success

*For any* successfully initialized room, the status field in the database should be set to 'active'.

**Validates: Requirements 5.3**

### Property 15: Unique Room IDs

*For any* set of initialized rooms, no two rooms should have the same ID in the database.

**Validates: Requirements 5.4**

### Property 16: Referential Integrity

*For any* room record in gemini_tabs, if it references a gem_id, that gem_id should exist in the gemini_gems table (or be null).

**Validates: Requirements 5.5**

### Property 17: Synchronous Response Waiting

*For any* message sent to Gemini, the system should wait for the response to complete before proceeding to the next operation (URL capture or next room).

**Validates: Requirements 6.3, 10.4**

### Property 18: URL Navigability

*For any* stored room URL, navigating to that URL should result in a valid Gemini conversation page.

**Validates: Requirements 7.1**

### Property 19: Non-existent Room Handling

*For any* room category that does not exist in the database, attempting to retrieve its URL should return null or indicate that the room is not initialized.

**Validates: Requirements 7.4**

### Property 20: Extensibility Beyond 20 Rooms

*For any* room catalog with more than 20 rooms, the initialization process should handle all rooms using the same pattern without requiring code changes.

**Validates: Requirements 8.3**

### Property 21: Consistent Initialization Pattern

*For any* two rooms in the catalog, both should follow the same initialization steps: send soul prompt, wait for response, capture URL, store in database.

**Validates: Requirements 8.4**

### Property 22: Adaptive Timeout Assignment

*For any* room, the timeout duration used during initialization should match the timeout specified in the room's definition based on its type and capability.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

### Property 23: Copy Icon Detection

*For any* response waiting period, the system should monitor for the Copy Response Icon and consider the response complete when the icon appears.

**Validates: Requirements 10.1, 10.2**

### Property 24: Timeout Error Logging

*For any* response waiting period that exceeds the timeout duration without the Copy Response Icon appearing, the system should log a timeout error.

**Validates: Requirements 10.3**

### Property 25: Streaming Completion Awaiting

*For any* response that is streaming, the system should wait for streaming to complete before checking for the Copy Response Icon.

**Validates: Requirements 10.5**

### Property 26: Error Logging with Context

*For any* initialization error (room initialization or database operation), the system should log the error with the room category and error details.

**Validates: Requirements 11.1, 11.5**

### Property 27: Initialization Attempt Logging

*For any* room initialization attempt, the system should log the attempt with a timestamp and status (success or failure).

**Validates: Requirements 11.4**

### Property 28: Summary Report Completeness

*For any* genesis execution, the final summary report should include the total number of rooms, count of successful initializations, count of failed initializations, and total duration.

**Validates: Requirements 11.3, 12.4**

### Property 29: URL Pattern Validation

*For any* stored room URL, it should match the expected Gemini URL pattern (https://gemini.google.com/app/*).

**Validates: Requirements 12.2**

### Property 30: Complete Room Retrieval

*For any* genesis execution that completes, querying the database should return records for all 20 room categories (though some may have error status).

**Validates: Requirements 12.3**

## Error Handling

### Error Categories

1. **Browser Errors**: Navigation failures, element not found, timeout
2. **Database Errors**: Connection failures, constraint violations, query errors
3. **Authentication Errors**: Not logged in, session expired
4. **Response Errors**: Timeout waiting for response, streaming detection failure

### Error Handling Strategy

**Per-Room Errors**:
- Log error with room category and details
- Mark room status as 'error' in database
- Continue to next room
- Include in failed count

**Fatal Errors**:
- Database connection failure → Abort with clear message
- Browser crash → Abort with clear message
- Authentication failure after manual login → Abort with clear message

**Retry Logic**:
- No automatic retries during genesis (user can re-run script)
- Failed rooms can be re-initialized individually later
- Database upsert ensures re-initialization updates existing records

### Logging Requirements

All logs should include:
- Timestamp
- Room category (if applicable)
- Operation being performed
- Success/failure status
- Duration (for completed operations)
- Error details (for failures)

Log levels:
- INFO: Room initialization start/complete, progress updates
- WARN: Timeout warnings, non-fatal issues
- ERROR: Room initialization failures, database errors

## Testing Strategy

### Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Test specific room configurations (e.g., Image Studio has correct soul prompt)
- Test database schema compliance
- Test browser profile path configuration
- Test error logging format
- Test summary report structure

**Property-Based Tests**: Verify universal properties across all inputs
- Test that all rooms follow the same initialization pattern
- Test that timeout assignment matches room type
- Test that URL storage and retrieval round-trip correctly
- Test that error resilience works for any room failure
- Test that success tracking is accurate for any combination of successes/failures

### Property-Based Testing Configuration

- **Library**: fast-check (for TypeScript/JavaScript)
- **Iterations**: Minimum 100 runs per property test
- **Tagging**: Each property test must reference its design document property
- **Tag Format**: `// Feature: gemini-rooms-initialization, Property {number}: {property_text}`

### Test Coverage Requirements

**Configuration Tests**:
- Room catalog contains exactly 20 rooms
- Soul prompts exist for all categories
- Timeout configuration covers all room types

**Initialization Tests**:
- Sequential processing order
- Soul prompt transmission
- URL capture and storage
- Database field population
- Status field correctness

**Error Handling Tests**:
- Individual room failure doesn't halt process
- Error logging includes required context
- Success/failure counts are accurate

**Database Tests**:
- Upsert behavior (update vs insert)
- Unique ID generation
- Referential integrity
- URL pattern validation

**Integration Tests**:
- End-to-end genesis execution (mock browser)
- Database round-trip (store and retrieve URLs)
- Timeout manager integration
- Response detector integration

### Testing Constraints

**Browser Automation Limitations**:
- Full browser tests are slow and flaky
- Mock browser interactions for unit tests
- Use integration tests sparingly for critical paths
- Property tests should not require real browser

**Database Testing**:
- Use in-memory SQLite for tests
- Reset database state between tests
- Test migrations separately

**Timeout Testing**:
- Mock time for timeout tests
- Don't wait for real timeouts in tests
- Verify timeout values, not actual waiting
