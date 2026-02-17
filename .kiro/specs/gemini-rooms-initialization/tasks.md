# Implementation Plan: Gemini Rooms Initialization

## Overview

This implementation plan creates the Genesis system for initializing 20 specialized Gemini rooms (Gems) with distinct purposes. The system builds on the existing Hermes infrastructure, adding new components for adaptive timeout management, response detection, and room initialization orchestration. The implementation preserves Olympus Prime if it already exists and initializes the remaining 19 rooms sequentially.

## Tasks

- [x] 1. Create room configuration module
  - Create `src/olympus/hermes/room-catalog.ts` with all 20 room definitions
  - Define RoomDefinition and RoomCatalog interfaces
  - Export ROOM_CATALOG constant with 6 Forge rooms and 14 Mind rooms
  - Export SOUL_PROMPTS mapping for all categories
  - Export TIMEOUT_CONFIG with timeout values per room type
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ]* 1.1 Write property test for room catalog completeness
  - **Property 1: Room Catalog Completeness**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [ ]* 1.2 Write property test for soul prompt mapping
  - **Property 2: Soul Prompt Mapping Completeness**
  - **Validates: Requirements 1.5**

- [ ] 2. Implement TimeoutManager component
  - [x] 2.1 Create `src/olympus/hermes/timeout-manager.ts`
    - Implement TimeoutManager class with TimeoutConfig interface
    - Implement getTimeout() method that returns timeout based on room type and capability
    - Implement updateTimeout() method for runtime configuration
    - Support 'forge' and 'mind' room types
    - Map capabilities (image, video, deep-search, canvas-writer, canvas-coder) to timeouts
    - _Requirements: 9.6_

  - [ ]* 2.2 Write property test for adaptive timeout assignment
    - **Property 22: Adaptive Timeout Assignment**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

- [ ] 3. Implement ResponseDetector component
  - [x] 3.1 Create `src/olympus/hermes/response-detector.ts`
    - Implement ResponseDetector class with ResponseStatus interface
    - Implement waitForCompletion() method with polling loop
    - Implement detectCopyIcon() method using DOM selectors
    - Implement isStreaming() method to check streaming status
    - Use 2-second polling interval
    - Log progress every 5 attempts
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

  - [ ]* 3.2 Write property test for copy icon detection
    - **Property 23: Copy Icon Detection**
    - **Validates: Requirements 10.1, 10.2**

  - [ ]* 3.3 Write property test for timeout error logging
    - **Property 24: Timeout Error Logging**
    - **Validates: Requirements 10.3**

  - [ ]* 3.4 Write property test for streaming completion
    - **Property 25: Streaming Completion Awaiting**
    - **Validates: Requirements 10.5**

- [ ] 4. Implement RoomInitializer component
  - [x] 4.1 Create `src/olympus/hermes/room-initializer.ts`
    - Implement RoomInitializer class with InitializationResult interface
    - Accept GeminiMessenger, GeminiTabManager, TimeoutManager, ResponseDetector in constructor
    - Implement initializeRoom() method with full initialization flow
    - Handle Olympus Prime special case (check current URL, skip soul prompt if exists)
    - Implement verifyRoomUrl() method to validate URL pattern
    - Generate unique tab IDs using category kebab-case
    - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 5.3, 5.4, 6.3, 10.4, 12.2_

  - [ ]* 4.2 Write property test for soul prompt transmission
    - **Property 4: Soul Prompt Transmission**
    - **Validates: Requirements 2.1**

  - [ ]* 4.3 Write property test for URL capture and storage round trip
    - **Property 10: URL Capture and Storage Round Trip**
    - **Validates: Requirements 4.1, 4.2, 4.3, 7.2, 7.3**

  - [ ]* 4.4 Write property test for timestamp freshness
    - **Property 11: Timestamp Freshness**
    - **Validates: Requirements 4.4**

  - [ ]* 4.5 Write property test for upsert behavior
    - **Property 12: Upsert Behavior**
    - **Validates: Requirements 4.5**

  - [ ]* 4.6 Write property test for required database fields
    - **Property 13: Required Database Fields**
    - **Validates: Requirements 5.2**

  - [ ]* 4.7 Write property test for active status on success
    - **Property 14: Active Status on Success**
    - **Validates: Requirements 5.3**

  - [ ]* 4.8 Write property test for unique room IDs
    - **Property 15: Unique Room IDs**
    - **Validates: Requirements 5.4**

  - [ ]* 4.9 Write property test for URL pattern validation
    - **Property 29: URL Pattern Validation**
    - **Validates: Requirements 12.2**

- [x] 5. Checkpoint - Ensure component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Create Genesis script
  - [x] 6.1 Create `src/olympus/hermes/hermes-genesis.ts`
    - Implement main Genesis orchestration script
    - Initialize browser context with persistent profile
    - Navigate to Gemini and verify login
    - Initialize all components (Messenger, TabManager, TimeoutManager, ResponseDetector, RoomInitializer)
    - Load room catalog from room-catalog.ts
    - Implement Olympus Prime detection and preservation logic
    - Implement sequential room initialization loop for remaining 19 rooms
    - Track successful and failed initializations
    - Generate and display summary report
    - Handle errors gracefully (log and continue)
    - _Requirements: 1.4, 3.1, 3.2, 3.3, 3.4, 11.1, 11.2, 11.3, 11.4, 11.5, 12.4_

  - [ ]* 6.2 Write property test for sequential room processing
    - **Property 3: Sequential Room Processing**
    - **Validates: Requirements 1.4, 3.1, 3.2**

  - [ ]* 6.3 Write property test for error resilience
    - **Property 8: Error Resilience**
    - **Validates: Requirements 3.3, 11.2**

  - [ ]* 6.4 Write property test for success tracking accuracy
    - **Property 9: Success Tracking Accuracy**
    - **Validates: Requirements 3.4**

  - [ ]* 6.5 Write property test for error logging with context
    - **Property 26: Error Logging with Context**
    - **Validates: Requirements 11.1, 11.5**

  - [ ]* 6.6 Write property test for initialization attempt logging
    - **Property 27: Initialization Attempt Logging**
    - **Validates: Requirements 11.4**

  - [ ]* 6.7 Write property test for summary report completeness
    - **Property 28: Summary Report Completeness**
    - **Validates: Requirements 11.3, 12.4**

- [ ] 7. Add soul prompt content validation
  - [x] 7.1 Implement soul prompt validators
    - Create validation functions for Forge room prompts (check capability mention)
    - Create validation functions for Mind room prompts (check expertise mention)
    - Create validation function for Canvas room differentiation
    - Add validators to room-catalog.ts
    - _Requirements: 2.3, 2.4, 2.8_

  - [ ]* 7.2 Write property test for Forge room capability specification
    - **Property 5: Forge Room Capability Specification**
    - **Validates: Requirements 2.3**

  - [ ]* 7.3 Write property test for Mind room expertise specification
    - **Property 6: Mind Room Expertise Specification**
    - **Validates: Requirements 2.4**

  - [ ]* 7.4 Write property test for Canvas room differentiation
    - **Property 7: Canvas Room Differentiation**
    - **Validates: Requirements 2.8**

- [ ] 8. Implement URL retrieval and navigation helpers
  - [x] 8.1 Add room URL retrieval methods to GeminiTabManager
    - Implement getRoomUrl(category: string) method
    - Return null for non-existent rooms
    - Return most recent URL for existing rooms
    - Implement navigateToRoom(category: string) helper
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.2 Write property test for URL navigability
    - **Property 18: URL Navigability**
    - **Validates: Requirements 7.1**

  - [ ]* 8.3 Write property test for non-existent room handling
    - **Property 19: Non-existent Room Handling**
    - **Validates: Requirements 7.4**

- [ ] 9. Add extensibility and consistency tests
  - [ ]* 9.1 Write property test for extensibility beyond 20 rooms
    - **Property 20: Extensibility Beyond 20 Rooms**
    - **Validates: Requirements 8.3**

  - [ ]* 9.2 Write property test for consistent initialization pattern
    - **Property 21: Consistent Initialization Pattern**
    - **Validates: Requirements 8.4**

- [ ] 10. Add database integrity tests
  - [ ]* 10.1 Write property test for referential integrity
    - **Property 16: Referential Integrity**
    - **Validates: Requirements 5.5**

  - [ ]* 10.2 Write property test for synchronous response waiting
    - **Property 17: Synchronous Response Waiting**
    - **Validates: Requirements 6.3, 10.4**

  - [ ]* 10.3 Write property test for complete room retrieval
    - **Property 30: Complete Room Retrieval**
    - **Validates: Requirements 12.3**

- [ ] 11. Create example script and documentation
  - [x] 11.1 Create `examples/hermes-genesis.ts` entry point
    - Import and call Genesis script from src/olympus/hermes/hermes-genesis.ts
    - Add command-line argument parsing for options (e.g., --skip-prime)
    - Add usage documentation in comments
    - _Requirements: All_

  - [x] 11.2 Update HERMES_QUICKSTART.md
    - Add Genesis initialization section
    - Document Olympus Prime preservation behavior
    - Add example commands and expected output
    - Document troubleshooting steps

- [x] 12. Final checkpoint - Integration testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The Genesis script should be runnable as a standalone command
- Olympus Prime special handling ensures continuity of the command center
- All soul prompts include "Address me as Zeus" to establish the mythological naming convention
