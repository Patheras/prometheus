# Implementation Plan: Frontend-Backend Integration

## Overview

This implementation plan converts the frontend-backend integration design into actionable coding tasks. The approach follows a phased migration strategy: first building the API client infrastructure, then migrating each feature area (activity feed, promotions, analysis, dashboard) systematically. Each task builds incrementally to ensure the application remains functional throughout the integration process.

## Tasks

- [x] 1. Create API client infrastructure
  - [x] 1.1 Implement core API client module
    - Create `lib/api-client.ts` with ApiClient class
    - Implement HTTP methods (get, post, patch, delete)
    - Add request/response type definitions
    - Implement error handling and transformation
    - Add request timeout and cancellation support
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ]* 1.2 Write property test for API client URL construction
    - **Property 15: URL Construction Correctness**
    - **Validates: Requirements 7.3**

  - [ ]* 1.3 Write property test for API client error handling consistency
    - **Property 21: API Client Error Handling Consistency**
    - **Validates: Requirements 9.3**

  - [ ]* 1.4 Write property test for request configuration
    - **Property 20: API Client Request Configuration**
    - **Validates: Requirements 9.2**

  - [x] 1.5 Create environment configuration module
    - Create `lib/config.ts` for environment variables
    - Read NEXT_PUBLIC_API_URL with fallback to localhost:4242
    - Export configuration object for use across app
    - _Requirements: 7.1, 7.2_

  - [ ]* 1.6 Write unit test for environment configuration
    - Test reading NEXT_PUBLIC_API_URL
    - Test fallback to default URL
    - _Requirements: 7.1, 7.2_

- [ ] 2. Create custom hooks for API data fetching
  - [ ] 2.1 Implement useApiData hook
    - Create `lib/hooks/useApiData.ts`
    - Implement loading state management
    - Add error handling
    - Add refetch functionality
    - Support request cancellation on unmount
    - _Requirements: 6.1, 6.2, 6.3, 9.5_

  - [ ]* 2.2 Write property test for loading state lifecycle
    - **Property 5: Loading State Lifecycle**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 2.3 Write property test for request cancellation
    - **Property 22: Request Cancellation on Unmount**
    - **Validates: Requirements 9.5**

  - [ ] 2.4 Implement useAbortController hook
    - Create `lib/hooks/useAbortController.ts`
    - Manage AbortController lifecycle
    - Cleanup on component unmount
    - _Requirements: 9.5_

- [ ] 3. Checkpoint - Verify API client infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement backend activity feed endpoint
  - [x] 4.1 Create activity event aggregator
    - Create `src/api/activity.ts` in backend
    - Implement event aggregation from code analysis, promotions, repositories, chat
    - Store recent events (last 100) in memory or database
    - Implement GET /api/activity endpoint handler
    - Return events sorted by timestamp descending
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ]* 4.2 Write property test for activity event aggregation
    - **Property 1: Activity Event Aggregation Completeness**
    - **Validates: Requirements 1.2**

  - [ ]* 4.3 Write property test for activity event structure
    - **Property 2: Activity Event Structure Completeness**
    - **Validates: Requirements 1.4**

  - [ ]* 4.4 Write property test for activity event ordering
    - **Property 3: Activity Event Ordering**
    - **Validates: Requirements 1.5**

  - [x] 4.5 Register activity endpoint in backend index.ts
    - Import activity handler
    - Add route: app.get('/api/activity', handleGetActivity)
    - _Requirements: 1.1_

- [x] 5. Integrate activity feed in frontend
  - [x] 5.1 Remove mock activity API route
    - Delete `app/api/activity/route.ts`
    - _Requirements: 1.3_

  - [x] 5.2 Update dashboard to call real activity endpoint
    - Modify `app/dashboard/page.tsx`
    - Use API client to call /api/activity
    - Implement loading and error states
    - Display activity events in UI
    - _Requirements: 1.3, 4.2, 6.1, 6.2, 6.3_

  - [ ]* 5.3 Write unit test for dashboard activity integration
    - Test API call is made to /api/activity
    - Test loading state display
    - Test error state display
    - _Requirements: 1.3, 4.2_

  - [ ]* 5.4 Write property test for error message display
    - **Property 8: Error Message Display**
    - **Validates: Requirements 3.5, 5.1, 5.2, 5.3**

- [ ] 6. Checkpoint - Verify activity feed integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrate promotions in frontend
  - [x] 7.1 Remove mock promotions API route
    - Delete `app/api/promotions/route.ts`
    - _Requirements: 2.1_

  - [x] 7.2 Update promotions page to call backend
    - Modify `app/promotions/page.tsx`
    - Use API client to call /api/evolution/promotions/pending
    - Implement loading and error states
    - _Requirements: 2.1, 6.1, 6.2, 6.3_

  - [x] 7.3 Implement promotion approve action
    - Add approve handler in promotions page
    - Call /api/evolution/promotions/:id/approve with user ID
    - Show loading state during request
    - Refresh promotions list after success
    - Handle errors with user-friendly messages
    - _Requirements: 2.2, 2.5, 6.4, 8.1_

  - [x] 7.4 Implement promotion reject action
    - Add reject handler in promotions page
    - Show confirmation dialog with reason input
    - Call /api/evolution/promotions/:id/reject with user ID and reason
    - Show loading state during request
    - Refresh promotions list after success
    - Handle errors with user-friendly messages
    - _Requirements: 2.3, 2.5, 6.4, 8.1_

  - [ ]* 7.5 Write property test for promotion data display
    - **Property 4: Promotion Data Display Completeness**
    - **Validates: Requirements 2.4**

  - [ ]* 7.6 Write property test for data refresh after mutation
    - **Property 16: Data Refresh After Mutation**
    - **Validates: Requirements 8.1**

  - [ ]* 7.7 Write property test for button disabling during requests
    - **Property 13: Button Disabling During Requests**
    - **Validates: Requirements 6.4**

  - [ ]* 7.8 Write unit tests for promotion actions
    - Test approve action calls correct endpoint
    - Test reject action calls correct endpoint
    - Test list refresh after actions
    - _Requirements: 2.2, 2.3, 2.5_

- [ ] 8. Checkpoint - Verify promotions integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Integrate code analysis in frontend
  - [ ] 9.1 Update analysis page to call backend endpoints
    - Modify `app/analysis/page.tsx`
    - Implement quality analysis action calling /api/analyze/quality
    - Implement debt detection action calling /api/analyze/debt
    - Pass selected repository information in requests
    - _Requirements: 3.1, 3.2_

  - [ ] 9.2 Implement analysis loading states
    - Show loading spinner during analysis
    - Disable action buttons during analysis
    - Show progress message for long-running operations
    - _Requirements: 3.3, 6.4, 6.5_

  - [ ] 9.3 Implement analysis results display
    - Display quality analysis results (issues, metrics)
    - Display debt detection results (debt items, summary)
    - Format results in user-friendly UI
    - _Requirements: 3.4_

  - [ ] 9.4 Implement analysis error handling
    - Show error messages for failed analysis
    - Provide retry button for errors
    - Log errors to console
    - _Requirements: 3.5, 5.4, 5.5_

  - [ ]* 9.5 Write property test for analysis loading feedback
    - **Property 6: Analysis Loading Feedback**
    - **Validates: Requirements 3.3**

  - [ ]* 9.6 Write property test for analysis results display
    - **Property 7: Analysis Results Display**
    - **Validates: Requirements 3.4, 4.4**

  - [ ]* 9.7 Write property test for long operation feedback
    - **Property 14: Long Operation Feedback**
    - **Validates: Requirements 6.5**

  - [ ]* 9.8 Write unit tests for analysis integration
    - Test quality analysis API call
    - Test debt detection API call
    - Test results display
    - Test error handling
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [ ] 10. Checkpoint - Verify analysis integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Enhance dashboard integration
  - [ ] 11.1 Update dashboard to use real activity endpoint
    - Already done in task 5.2, verify it's working
    - _Requirements: 4.2_

  - [ ] 11.2 Implement dashboard loading indicators
    - Add loading state for stats section
    - Add loading state for activity section
    - Show loading indicators independently for each section
    - _Requirements: 4.3_

  - [ ] 11.3 Implement dashboard partial failure handling
    - Handle stats request failure gracefully
    - Handle activity request failure gracefully
    - Show available data even if some requests fail
    - Display error states for failed sections only
    - _Requirements: 4.5_

  - [ ] 11.4 Add manual refresh mechanism
    - Add refresh button to dashboard
    - Implement refresh handler that refetches all data
    - Show loading states during refresh
    - _Requirements: 8.2_

  - [ ]* 11.5 Write property test for dashboard loading indicators
    - **Property 10: Dashboard Loading Indicators**
    - **Validates: Requirements 4.3**

  - [ ]* 11.6 Write property test for dashboard partial failure handling
    - **Property 9: Dashboard Partial Failure Handling**
    - **Validates: Requirements 4.5**

  - [ ]* 11.7 Write unit tests for dashboard integration
    - Test stats API call
    - Test activity API call
    - Test partial failure handling
    - Test refresh mechanism
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 8.2_

- [ ] 12. Implement comprehensive error handling
  - [ ] 12.1 Create error utility functions
    - Create `lib/errors.ts`
    - Implement getUserFriendlyErrorMessage function
    - Implement error logging function
    - Add error categorization (network, HTTP, application)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 12.2 Create error display components
    - Create `components/ui/error-display.tsx`
    - Implement ErrorDisplay component with retry button
    - Implement ErrorBoundary component
    - Style error states consistently
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [ ] 12.3 Implement retry mechanism
    - Add retry logic to API client with exponential backoff
    - Implement retry button in error displays
    - Handle non-retryable errors (4xx) appropriately
    - _Requirements: 5.5_

  - [ ]* 12.4 Write property test for error logging
    - **Property 11: Error Logging**
    - **Validates: Requirements 5.4**

  - [ ]* 12.5 Write property test for retry mechanism
    - **Property 12: Retry Mechanism Availability**
    - **Validates: Requirements 5.5**

  - [ ]* 12.6 Write unit tests for error handling
    - Test network error handling
    - Test HTTP error handling
    - Test validation error handling
    - Test retry logic
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 13. Implement data synchronization features
  - [ ] 13.1 Add UI state synchronization
    - Ensure UI updates when data changes
    - Implement optimistic updates where appropriate
    - Handle concurrent updates without race conditions
    - _Requirements: 8.3, 8.4_

  - [ ] 13.2 Implement response caching
    - Add caching layer to API client
    - Cache GET requests with configurable TTL
    - Invalidate cache on mutations
    - _Requirements: 8.5_

  - [ ]* 13.3 Write property test for UI state synchronization
    - **Property 17: UI State Synchronization**
    - **Validates: Requirements 8.3**

  - [ ]* 13.4 Write property test for concurrent update handling
    - **Property 18: Concurrent Update Handling**
    - **Validates: Requirements 8.4**

  - [ ]* 13.5 Write property test for response caching
    - **Property 19: Response Caching**
    - **Validates: Requirements 8.5**

- [ ] 14. Ensure backward compatibility
  - [ ] 14.1 Verify UI behavior preservation
    - Test all migrated pages maintain existing UI behavior
    - Verify user interactions work as before
    - Check TypeScript types are preserved
    - _Requirements: 10.1, 10.5_

  - [ ]* 14.2 Write property test for UI behavior preservation
    - **Property 23: UI Behavior Preservation During Migration**
    - **Validates: Requirements 10.1**

  - [ ]* 14.3 Write integration tests for complete user flows
    - Test activity feed flow end-to-end
    - Test promotion approval flow end-to-end
    - Test analysis flow end-to-end
    - Test dashboard flow end-to-end

- [ ] 15. Final checkpoint - Complete integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a phased approach: infrastructure → backend → frontend → enhancements
- All API calls should go through the centralized API client
- Error handling should be consistent across all features
- Loading states should be implemented for all async operations
