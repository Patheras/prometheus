# Requirements Document

## Introduction

This specification defines the integration requirements for connecting the Prometheus Next.js frontend (port 3042) with the Express backend (port 4242). Currently, several frontend components use mock data instead of calling real backend endpoints. This integration will replace all mock data with actual API calls, implement proper error handling, loading states, and ensure data synchronization between frontend and backend.

## Glossary

- **Frontend**: The Next.js application running on port 3042 that provides the user interface
- **Backend**: The Express API server running on port 4242 that handles business logic and data persistence
- **API_Route**: Next.js API route handlers in the `app/api/` directory
- **Backend_Endpoint**: Express route handlers in the backend `src/` directory
- **Mock_Data**: Hardcoded data in the frontend that simulates backend responses
- **Activity_Feed**: A chronological list of system events displayed on the dashboard
- **Promotion**: A code change proposal from Prometheus that requires human approval
- **Analysis**: Code quality or technical debt detection performed on a repository

## Requirements

### Requirement 1: Activity Feed System

**User Story:** As a user, I want to see real system activity on the dashboard, so that I can monitor what Prometheus is doing in real-time.

#### Acceptance Criteria

1. THE Backend SHALL implement a `/api/activity` endpoint that returns system activity events
2. WHEN the Backend generates activity events, THE Backend SHALL aggregate events from code analysis, promotions, repository changes, and chat interactions
3. WHEN the Frontend requests activity data, THE Frontend SHALL call the Backend `/api/activity` endpoint instead of using mock data
4. WHEN activity events are returned, THE Backend SHALL include event type, message, timestamp, and related entity identifiers
5. THE Backend SHALL return activity events sorted by timestamp in descending order

### Requirement 2: Promotions Integration

**User Story:** As a user, I want to review and approve code promotions from the backend, so that I can control which changes are applied to my codebase.

#### Acceptance Criteria

1. WHEN the Frontend requests pending promotions, THE Frontend SHALL call the Backend `/api/evolution/promotions/pending` endpoint
2. WHEN a user approves a promotion, THE Frontend SHALL call the Backend `/api/evolution/promotions/:promotionId/approve` endpoint with the user identifier
3. WHEN a user rejects a promotion, THE Frontend SHALL call the Backend `/api/evolution/promotions/:promotionId/reject` endpoint with the user identifier and rejection reason
4. THE Frontend SHALL display promotion data in the format returned by the Backend
5. WHEN promotion actions complete, THE Frontend SHALL refresh the promotions list to reflect the updated state

### Requirement 3: Code Analysis Integration

**User Story:** As a user, I want to run code quality and technical debt analysis from the frontend, so that I can assess repository health.

#### Acceptance Criteria

1. WHEN a user triggers quality analysis, THE Frontend SHALL call the Backend `/api/analyze/quality` endpoint with the selected repository information
2. WHEN a user triggers debt detection, THE Frontend SHALL call the Backend `/api/analyze/debt` endpoint with the selected repository path
3. WHEN analysis is in progress, THE Frontend SHALL display a loading indicator
4. WHEN analysis completes, THE Frontend SHALL display the analysis results returned by the Backend
5. IF analysis fails, THEN THE Frontend SHALL display an error message with details from the Backend response

### Requirement 4: Dashboard Data Integration

**User Story:** As a user, I want the dashboard to display real system statistics, so that I have accurate information about Prometheus status.

#### Acceptance Criteria

1. THE Frontend SHALL call the Backend `/api/stats` endpoint to retrieve system statistics
2. THE Frontend SHALL call the Backend `/api/activity` endpoint to retrieve recent activity
3. WHEN dashboard data is loading, THE Frontend SHALL display loading indicators for each data section
4. WHEN dashboard data loads successfully, THE Frontend SHALL display all statistics and activity in the UI
5. IF any data request fails, THEN THE Frontend SHALL display the available data and show error states for failed sections

### Requirement 5: Error Handling and User Feedback

**User Story:** As a user, I want clear feedback when API calls fail, so that I understand what went wrong and can take appropriate action.

#### Acceptance Criteria

1. WHEN an API call fails with a network error, THE Frontend SHALL display a user-friendly error message indicating connectivity issues
2. WHEN an API call fails with a server error, THE Frontend SHALL display the error message from the Backend response
3. WHEN an API call fails with a validation error, THE Frontend SHALL display the specific validation errors to the user
4. THE Frontend SHALL log all API errors to the browser console for debugging purposes
5. WHEN an error occurs, THE Frontend SHALL provide a retry mechanism where appropriate

### Requirement 6: Loading State Management

**User Story:** As a user, I want to see loading indicators during API calls, so that I know the system is processing my request.

#### Acceptance Criteria

1. WHEN an API call is initiated, THE Frontend SHALL display a loading indicator in the relevant UI component
2. WHEN an API call completes successfully, THE Frontend SHALL hide the loading indicator and display the results
3. WHEN an API call fails, THE Frontend SHALL hide the loading indicator and display an error state
4. THE Frontend SHALL disable action buttons during API calls to prevent duplicate requests
5. THE Frontend SHALL provide visual feedback for long-running operations exceeding 2 seconds

### Requirement 7: Environment Configuration

**User Story:** As a developer, I want proper environment configuration for API endpoints, so that the frontend can connect to the backend in different environments.

#### Acceptance Criteria

1. THE Frontend SHALL read the backend API URL from the `NEXT_PUBLIC_API_URL` environment variable
2. WHERE the `NEXT_PUBLIC_API_URL` is not set, THE Frontend SHALL use `http://localhost:4242` as the default
3. THE Frontend SHALL construct full API URLs by combining the base URL with endpoint paths
4. THE Frontend SHALL support different API URLs for development, staging, and production environments
5. THE Frontend SHALL validate that the API URL is accessible before making requests

### Requirement 8: Data Synchronization

**User Story:** As a user, I want the frontend to stay synchronized with backend data, so that I always see the current state of the system.

#### Acceptance Criteria

1. WHEN a user performs an action that modifies backend data, THE Frontend SHALL refresh the affected data after the action completes
2. WHEN the Frontend displays a list view, THE Frontend SHALL provide a manual refresh mechanism
3. WHEN critical data changes occur, THE Frontend SHALL update the UI to reflect the new state
4. THE Frontend SHALL handle concurrent data updates gracefully without race conditions
5. THE Frontend SHALL cache API responses appropriately to reduce unnecessary network requests

### Requirement 9: API Client Abstraction

**User Story:** As a developer, I want a centralized API client, so that API calls are consistent and maintainable across the frontend.

#### Acceptance Criteria

1. THE Frontend SHALL implement a centralized API client module for making backend requests
2. THE API_Client SHALL handle request configuration including base URL, headers, and authentication
3. THE API_Client SHALL implement consistent error handling for all API calls
4. THE API_Client SHALL provide typed interfaces for request and response data
5. THE API_Client SHALL support request cancellation for cleanup on component unmount

### Requirement 10: Backward Compatibility

**User Story:** As a developer, I want to maintain existing functionality during migration, so that the application remains stable throughout the integration process.

#### Acceptance Criteria

1. WHEN migrating an endpoint, THE Frontend SHALL maintain the existing UI behavior
2. THE Frontend SHALL preserve all existing user interactions and workflows
3. IF a Backend endpoint is not yet available, THEN THE Frontend SHALL continue using mock data with a console warning
4. THE Frontend SHALL not introduce breaking changes to component interfaces during migration
5. THE Frontend SHALL maintain existing TypeScript types and interfaces where possible
