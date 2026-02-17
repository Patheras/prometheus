# Implementation Plan: Chat Conversation Management

## Overview

This implementation plan breaks down the chat conversation management feature into incremental coding tasks. The approach follows a bottom-up strategy: build core utilities first (token counting, importance scoring), then window management and summarization, then integrate with existing chat API, and finally implement frontend virtualization. Each task builds on previous work and includes testing sub-tasks to validate functionality early.

## Tasks

- [ ] 1. Set up token counting infrastructure
  - [ ] 1.1 Install tiktoken library and type definitions
    - Add `tiktoken` and `@types/tiktoken` to package.json
    - Install dependencies
    - _Requirements: 1.1, 1.2_
  
  - [ ] 1.2 Implement TokenCounter interface and TiktokenCounter class
    - Create `src/memory/token-counter.ts`
    - Implement `countTokens()`, `countMessageTokens()`, and `countMessagesTokens()` methods
    - Add encoder caching for performance
    - Handle model-to-encoding mapping (gpt-4 → cl100k_base, etc.)
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 1.3 Write property test for token counting accuracy
    - **Property 2: Context token calculation accuracy**
    - **Validates: Requirements 1.2**
    - Generate random message arrays, verify sum of individual counts equals total
  
  - [ ]* 1.4 Write unit tests for token counter edge cases
    - Test empty strings, very long strings, special characters, emojis
    - Test different model encodings
    - Test encoder caching
    - _Requirements: 1.1, 1.2_

- [ ] 2. Implement message importance scoring
  - [ ] 2.1 Create ImportanceScorer interface and DefaultImportanceScorer class
    - Create `src/memory/importance-scorer.ts`
    - Implement scoring algorithm (role-based + recency + tool calls)
    - Define ConversationContext interface
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 2.2 Write property test for importance scoring rules
    - **Property 11: Message importance scoring rules**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Generate messages with different roles and timestamps, verify scoring rules
  
  - [ ]* 2.3 Write unit tests for importance scoring edge cases
    - Test system messages score highest
    - Test tool call bonus
    - Test recency decay
    - Test content length penalty
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 3. Enhance message storage to track tokens and importance
  - [ ] 3.1 Update storeMessage() to calculate and store token count
    - Modify `src/memory/engine.ts` storeMessage method
    - Instantiate TokenCounter
    - Calculate tokens for each message
    - Store in metadata JSON field
    - _Requirements: 1.1_
  
  - [ ] 3.2 Update storeMessage() to calculate and store importance score
    - Instantiate ImportanceScorer
    - Calculate importance score for each message
    - Store in metadata JSON field
    - _Requirements: 4.1_
  
  - [ ]* 3.3 Write property test for token count storage
    - **Property 1: Token count storage**
    - **Validates: Requirements 1.1**
    - Generate random messages, store them, verify metadata contains token count
  
  - [ ]* 3.4 Write unit tests for enhanced message storage
    - Test token count is stored correctly
    - Test importance score is stored correctly
    - Test metadata JSON structure
    - _Requirements: 1.1, 4.1_

- [ ] 4. Implement conversation summarization
  - [ ] 4.1 Create ConversationSummarizer interface and LLMConversationSummarizer class
    - Create `src/memory/conversation-summarizer.ts`
    - Implement `summarize()` method with LLM call
    - Implement `storeSummary()` method
    - Implement fallback summary generation
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 4.2 Add summarization prompt template
    - Create prompt that emphasizes key information retention
    - Include instructions for preserving user preferences
    - Include instructions for chronological ordering
    - _Requirements: 11.1, 11.2, 11.3, 11.5_
  
  - [ ]* 4.3 Write property test for summary storage format
    - **Property 9: Summary storage format**
    - **Validates: Requirements 3.3**
    - Generate summaries, verify stored as system message with correct metadata
  
  - [ ]* 4.4 Write property test for summary token budget compliance
    - **Property 21: Summary token budget compliance**
    - **Validates: Requirements 11.4**
    - Generate summaries with token budgets, verify they don't exceed limit
  
  - [ ]* 4.5 Write unit tests for summarization
    - Test summary generation with small message batch
    - Test summary generation with large message batch
    - Test fallback summary when LLM fails
    - Test error handling
    - _Requirements: 3.1, 3.2, 3.5_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement sliding window manager
  - [ ] 6.1 Create WindowManager interface and SlidingWindowManager class
    - Create `src/memory/window-manager.ts`
    - Implement `selectMessagesForContext()` method
    - Implement active window selection logic
    - Implement importance-based message selection
    - Integrate with TokenCounter and ImportanceScorer
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 4.5_
  
  - [ ] 6.2 Integrate ConversationSummarizer into WindowManager
    - Call summarizer for excluded messages
    - Handle summarization failures gracefully
    - Include summary in window result
    - _Requirements: 1.5, 3.1, 3.4_
  
  - [ ]* 6.3 Write property test for token budget enforcement
    - **Property 3: Token budget enforcement**
    - **Validates: Requirements 1.3**
    - Generate conversations and token budgets, verify context never exceeds budget
  
  - [ ]* 6.4 Write property test for recent message prioritization
    - **Property 4: Recent message prioritization**
    - **Validates: Requirements 1.4, 2.1, 2.2**
    - Generate conversations requiring reduction, verify N most recent always included
  
  - [ ]* 6.5 Write property test for active window consistency
    - **Property 5: Active window consistency**
    - **Validates: Requirements 2.1, 2.5**
    - Generate conversations with > N messages, verify active window contains exactly N most recent
  
  - [ ]* 6.6 Write property test for summary inclusion
    - **Property 6: Summary inclusion for long conversations**
    - **Validates: Requirements 2.3**
    - Generate long conversations, verify summary included when messages excluded
  
  - [ ]* 6.7 Write property test for window size configuration
    - **Property 7: Window size configuration**
    - **Validates: Requirements 2.4**
    - Test with different window sizes, verify behavior changes accordingly
  
  - [ ]* 6.8 Write property test for importance-based retention
    - **Property 12: Importance-based retention**
    - **Validates: Requirements 4.5**
    - Generate mixed-importance messages, verify high-importance retained preferentially
  
  - [ ]* 6.9 Write unit tests for window manager
    - Test window with exactly N messages
    - Test window with fewer than N messages
    - Test window sliding behavior
    - Test summarization trigger
    - _Requirements: 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 7. Implement enhanced context builder
  - [ ] 7.1 Create ContextBuilder interface and EnhancedContextBuilder class
    - Create `src/memory/context-builder.ts`
    - Implement `buildContext()` method
    - Integrate with WindowManager
    - Format context with summary and messages
    - _Requirements: 1.2, 1.3_
  
  - [ ]* 7.2 Write property test for summary placement in context
    - **Property 10: Summary placement in context**
    - **Validates: Requirements 3.4**
    - Generate conversations with summaries, verify summary appears before active window
  
  - [ ]* 7.3 Write unit tests for context builder
    - Test context formatting
    - Test system prompt inclusion
    - Test token budget reservation for system prompt
    - Test context with and without summary
    - _Requirements: 1.2, 1.3, 3.4_

- [ ] 8. Add configuration management
  - [ ] 8.1 Create ConversationManagementConfig interface and loader
    - Create `src/config/conversation-management.ts`
    - Define configuration schema
    - Implement `loadConversationManagementConfig()` function
    - Load from environment variables with defaults
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 8.2 Write property test for configuration loading
    - **Property 22: Configuration loading**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
    - Set environment variables, verify system loads and uses them
  
  - [ ]* 8.3 Write unit tests for configuration
    - Test loading from environment variables
    - Test default values
    - Test invalid configuration handling
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 9. Integrate with existing chat API
  - [ ] 9.1 Update chat-with-tools.ts to use EnhancedContextBuilder
    - Replace existing context building with EnhancedContextBuilder
    - Load conversation management configuration
    - Pass token budget to context builder
    - Handle context result with summary
    - _Requirements: 1.2, 1.3_
  
  - [ ] 9.2 Update buildContextFromHistory() to use new context format
    - Modify to accept ContextResult
    - Format messages for LLM API
    - Include summary as system message if present
    - _Requirements: 3.4_
  
  - [ ]* 9.3 Write integration tests for chat API with windowing
    - Test end-to-end chat flow with short conversation
    - Test end-to-end chat flow with long conversation requiring windowing
    - Test end-to-end chat flow with summarization
    - _Requirements: 1.2, 1.3, 2.1, 3.1_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement conversation archiving
  - [ ] 11.1 Create ConversationArchiver interface and FileSystemConversationArchiver class
    - Create `src/memory/conversation-archiver.ts`
    - Implement `archiveOldConversations()` method
    - Implement `restoreConversation()` method
    - Implement `listArchivedConversations()` method
    - Create archive directory structure
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 11.2 Write property test for archive identification
    - **Property 17: Archive identification**
    - **Validates: Requirements 8.1**
    - Generate conversations with old timestamps, verify identified for archiving
  
  - [ ]* 11.3 Write property test for archive round-trip preservation
    - **Property 18: Archive round-trip preservation**
    - **Validates: Requirements 8.2, 8.3, 8.4**
    - Archive and restore conversations, verify messages preserved
  
  - [ ]* 11.4 Write unit tests for archiving
    - Test archiving single conversation
    - Test archiving multiple conversations
    - Test restoring archived conversation
    - Test listing archived conversations
    - Test error handling for corrupted archives
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ] 11.5 Add background archiving job
    - Create scheduled task to run archiving periodically
    - Use configuration for archive age threshold
    - Log archiving operations
    - _Requirements: 8.5_

- [ ] 12. Add token usage tracking API
  - [ ] 12.1 Add getConversationTokens() method to MemoryEngine
    - Calculate total tokens for a conversation
    - Return token count and message count
    - Cache results for performance
    - _Requirements: 7.2_
  
  - [ ]* 12.2 Write property test for conversation token total maintenance
    - **Property 16: Conversation token total maintenance**
    - **Validates: Requirements 7.2**
    - Add messages to conversation, verify running total equals sum of message tokens
  
  - [ ] 12.3 Add API endpoint for token usage metrics
    - Create GET /api/conversations/:id/tokens endpoint
    - Return token count, message count, and usage percentage
    - _Requirements: 7.3_
  
  - [ ]* 12.4 Write unit tests for token tracking API
    - Test token calculation for conversation
    - Test API endpoint response format
    - Test caching behavior
    - _Requirements: 7.2, 7.3_

- [ ] 13. Implement frontend virtual scrolling
  - [ ] 13.1 Install react-window or react-virtuoso library
    - Choose virtual scrolling library
    - Add to package.json
    - Install dependencies
    - _Requirements: 5.1_
  
  - [ ] 13.2 Create VirtualMessageList component
    - Create `components/chat/VirtualMessageList.tsx`
    - Implement virtual scrolling with react-window/react-virtuoso
    - Handle dynamic item heights
    - Implement scroll-to-top loading trigger
    - _Requirements: 5.1, 5.2, 5.3, 6.2_
  
  - [ ] 13.3 Add message pagination to ChatPanel
    - Update `components/chat/ChatPanel.tsx`
    - Implement page-based message loading
    - Add loading indicator
    - Handle scroll position preservation
    - Prevent duplicate loading
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 13.4 Write property test for virtual scroll DOM efficiency
    - **Property 13: Virtual scroll DOM efficiency**
    - **Validates: Requirements 5.1, 5.3**
    - Render large message lists, verify DOM element count proportional to viewport
  
  - [ ]* 13.5 Write property test for paginated loading size
    - **Property 14: Paginated loading size**
    - **Validates: Requirements 6.1**
    - Load pages with different sizes, verify correct number returned
  
  - [ ]* 13.6 Write property test for message list deduplication
    - **Property 15: Message list deduplication**
    - **Validates: Requirements 6.4**
    - Load multiple pages, verify no duplicate messages
  
  - [ ]* 13.7 Write unit tests for virtual message list
    - Test initial render
    - Test scroll-to-top loading
    - Test loading indicator display
    - Test scroll position preservation
    - Test end-of-list indicator
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 14. Add token counter display to frontend
  - [ ] 14.1 Create TokenCounter component
    - Create `components/chat/TokenCounter.tsx`
    - Fetch token count from API
    - Display current tokens and percentage of limit
    - Update in real-time as messages are added
    - _Requirements: 7.4_
  
  - [ ] 14.2 Integrate TokenCounter into ChatPanel
    - Add TokenCounter to chat header or footer
    - Wire up to conversation ID
    - Handle loading and error states
    - _Requirements: 7.4_
  
  - [ ]* 14.3 Write unit tests for token counter component
    - Test rendering with token data
    - Test loading state
    - Test error state
    - Test real-time updates
    - _Requirements: 7.4_

- [ ] 15. Add error handling and graceful degradation
  - [ ] 15.1 Add error handling to WindowManager
    - Wrap summarization in try-catch
    - Fall back to active window only on summarization failure
    - Log errors with context
    - _Requirements: 3.5, 10.1_
  
  - [ ] 15.2 Add error handling to TokenCounter
    - Wrap tiktoken calls in try-catch
    - Fall back to character-based estimation (1 token ≈ 4 chars)
    - Log warnings when using fallback
    - _Requirements: 10.2_
  
  - [ ] 15.3 Add error handling to VirtualMessageList
    - Wrap virtual scroll in error boundary
    - Fall back to traditional rendering on error
    - Display user-friendly error messages
    - _Requirements: 10.3, 10.5_
  
  - [ ]* 15.4 Write unit tests for error handling
    - Test summarization failure handling
    - Test token counting failure handling
    - Test virtual scroll failure handling
    - Test error logging
    - Test user-friendly error messages
    - _Requirements: 3.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 16. Add database indexes for performance
  - [ ] 16.1 Create migration for conversation indexes
    - Add index on conversations.updated_at for archiving queries
    - Add index on conversation_messages.timestamp for ordering
    - Add index on conversation_messages.conversation_id for joins
    - _Requirements: 12.5_
  
  - [ ]* 16.2 Write unit tests for index existence
    - Verify indexes exist on tables
    - Test query performance with indexes
    - _Requirements: 12.5_

- [ ] 17. Add caching for conversation metadata
  - [ ] 17.1 Implement in-memory cache for conversation metadata
    - Create simple LRU cache
    - Cache conversation token totals
    - Cache conversation message counts
    - Set TTL for cache entries
    - _Requirements: 12.3_
  
  - [ ]* 17.2 Write unit tests for caching
    - Test cache hit and miss
    - Test cache invalidation
    - Test TTL expiration
    - _Requirements: 12.3_

- [ ] 18. Add optimistic UI updates for new messages
  - [ ] 18.1 Update ChatPanel to show messages immediately
    - Add message to UI state before API confirmation
    - Show pending indicator on message
    - Handle API errors by removing or marking failed
    - _Requirements: 12.4_
  
  - [ ]* 18.2 Write unit tests for optimistic updates
    - Test message appears immediately
    - Test pending indicator
    - Test error handling
    - _Requirements: 12.4_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Integration and documentation
  - [ ] 20.1 Update environment variable documentation
    - Document all new configuration options in .env.example
    - Add comments explaining each option
    - Include recommended values
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 20.2 Add migration guide for existing conversations
    - Document how to backfill token counts for existing messages
    - Document how to backfill importance scores
    - Create migration script if needed
    - _Requirements: 1.1, 4.1_
  
  - [ ]* 20.3 Write end-to-end integration tests
    - Test complete user flow: create conversation, add messages, view history
    - Test conversation with windowing and summarization
    - Test conversation archiving and restoration
    - Test error recovery scenarios
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: utilities → core logic → integration → frontend
- Token counting and importance scoring are foundational and built first
- Window management and summarization build on the foundation
- Frontend work comes last to allow backend testing in isolation
- Error handling is added after core functionality is working
- Performance optimizations (caching, indexes) come near the end
