# Implementation Plan: Prometheus Function Calling

## Overview

This implementation plan breaks down the function calling feature into discrete coding tasks. The implementation will be done in TypeScript, building on the existing Prometheus codebase. Each task builds incrementally, with testing integrated throughout.

## Tasks

- [x] 1. Create tool registry infrastructure
  - Create `src/tools/` directory structure
  - Define core TypeScript interfaces for tool schemas, executors, and results
  - Implement `ToolRegistry` class with registration and retrieval methods
  - Add tool schema validation against OpenAI format
  - _Requirements: 1.1, 1.2, 1.10_

- [ ]* 1.1 Write property test for tool schema completeness
  - **Property 1: Tool Schema Completeness**
  - **Validates: Requirements 1.2, 1.8, 1.10**

- [ ]* 1.2 Write property test for OpenAI format compliance
  - **Property 2: Tool Schema OpenAI Format Compliance**
  - **Validates: Requirements 1.10**

- [x] 2. Define tool schemas for backend API endpoints
  - [x] 2.1 Create tool schema for code quality analysis (`analyze_code_quality`)
    - Define schema with filePath and sourceCode parameters
    - Map to `/api/analyze/quality` endpoint
    - _Requirements: 1.3_
  
  - [x] 2.2 Create tool schema for technical debt detection (`detect_technical_debt`)
    - Define schema with codebasePath and options parameters
    - Map to `/api/analyze/debt` endpoint
    - _Requirements: 1.3_
  
  - [x] 2.3 Create tool schema for repository listing (`list_repositories`)
    - Define schema with no required parameters
    - Map to `/api/repositories` GET endpoint
    - _Requirements: 1.4_
  
  - [x] 2.4 Create tool schema for file reading (`read_workspace_file`)
    - Define schema with repoId and filePath parameters
    - Map to `/api/workspace/:repoId/files` endpoint
    - _Requirements: 1.6_
  
  - [x] 2.5 Create tool schema for system stats (`get_system_stats`)
    - Define schema with optional category parameter (enum)
    - Map to `/api/stats` endpoint
    - _Requirements: 1.7_
  
  - [x] 2.6 Create tool schema for self-analysis (`run_self_analysis`)
    - Define schema with optional scope parameter (enum)
    - Map to `/api/evolution/analysis/run` endpoint
    - _Requirements: 1.5_

- [ ]* 2.7 Write property test for enum parameter validation
  - **Property 3: Enum Parameter Validation**
  - **Validates: Requirements 1.9**

- [x] 3. Implement tool execution engine
  - [x] 3.1 Create `ToolExecutionEngine` class
    - Implement tool routing by name
    - Add argument validation against schemas
    - Implement timeout handling (30 second default)
    - Add execution metrics tracking
    - _Requirements: 3.1, 3.6, 3.10_
  
  - [x] 3.2 Create `APIToolExecutor` class
    - Implement HTTP request execution (GET, POST, PUT, DELETE)
    - Add header and authentication token handling
    - Implement error handling with structured error messages
    - Add result validation and sanitization
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.7, 3.9_
  
  - [x] 3.3 Implement circuit breaker pattern
    - Create `CircuitBreaker` class
    - Track failure counts per tool
    - Implement open/closed/half-open states
    - Add cooldown period handling
    - _Requirements: 5.9_

- [ ]* 3.4 Write property test for tool routing correctness
  - **Property 8: Tool Routing Correctness**
  - **Validates: Requirements 3.1**

- [ ]* 3.5 Write property test for HTTP method correctness
  - **Property 9: HTTP Method Correctness**
  - **Validates: Requirements 3.2, 3.3**

- [ ]* 3.6 Write property test for error message structure
  - **Property 10: Error Message Structure**
  - **Validates: Requirements 3.5, 5.1, 5.5**

- [ ]* 3.7 Write property test for result sanitization
  - **Property 12: Result Sanitization**
  - **Validates: Requirements 3.9, 9.2**

- [ ]* 3.8 Write property test for metrics tracking
  - **Property 13: Metrics Tracking Completeness**
  - **Validates: Requirements 3.10, 8.1, 8.2, 8.3**

- [x] 4. Checkpoint - Ensure tool execution engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Enhance Azure OpenAI provider for function calling
  - [x] 5.1 Update `AzureOpenAIRequest` interface to include tools and tool_choice
    - Add tools array field for tool schemas
    - Add tool_choice field for tool selection strategy
    - _Requirements: 2.1_
  
  - [x] 5.2 Update `AzureOpenAIResponse` interface to include tool_calls
    - Add tool_calls array to message structure
    - Handle null content when tool calls present
    - _Requirements: 2.2_
  
  - [x] 5.3 Create `ToolMessage` interface for tool results
    - Define role as 'tool'
    - Add tool_call_id field
    - Add content field for JSON result
    - _Requirements: 2.6_
  
  - [x] 5.4 Implement `callAzureOpenAIWithTools` function
    - Accept tool schemas as parameter
    - Include tools in API request
    - Parse tool calls from response
    - Return tool calls with requiresToolExecution flag
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 5.5 Add tool call support to streaming mode
    - Parse tool calls from streaming chunks
    - Handle tool calls in SSE stream
    - _Requirements: 2.8_
  
  - [x] 5.6 Implement fallback to text-only mode
    - Check model capabilities for tools support
    - Fall back to regular callAzureOpenAI if tools not supported
    - _Requirements: 2.9, 5.6_

- [ ]* 5.7 Write property test for tool call parsing
  - **Property 4: Tool Call Parsing Completeness**
  - **Validates: Requirements 2.2, 2.3, 2.4**

- [ ]* 5.8 Write property test for tool result formatting
  - **Property 6: Tool Result Message Formatting**
  - **Validates: Requirements 2.6, 4.6**

- [ ]* 5.9 Write unit test for fallback to text-only mode
  - Test with model that doesn't support tools
  - Verify text-only mode activated
  - _Requirements: 2.9, 5.6_

- [x] 6. Update memory engine for tool call storage
  - [x] 6.1 Add tool_calls column to messages table
    - Create database migration
    - Add tool_calls TEXT column (JSON array)
    - Add tool_results TEXT column (JSON array)
    - _Requirements: 4.1, 4.2_
  
  - [x] 6.2 Update `storeMessage` method to handle tool calls
    - Accept optional toolCalls parameter
    - Serialize tool calls to JSON
    - Store in tool_calls column
    - _Requirements: 4.1_
  
  - [x] 6.3 Create `storeToolResult` method
    - Accept conversationId, toolCallId, and result
    - Update message with tool result
    - Store execution metadata
    - _Requirements: 4.2_
  
  - [x] 6.4 Update `getConversationHistory` to include tool calls
    - Parse tool_calls JSON from database
    - Parse tool_results JSON from database
    - Include in returned messages
    - _Requirements: 4.3_
  
  - [x] 6.5 Implement conversation history limiting
    - Calculate total tokens in history
    - Truncate older messages when limit exceeded
    - Prioritize recent messages and tool results
    - _Requirements: 4.7, 4.8_

- [ ]* 6.6 Write property test for tool call persistence round trip
  - **Property 14: Tool Call Persistence Round Trip**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.9, 4.10**

- [ ]* 6.7 Write property test for message ordering preservation
  - **Property 15: Message Ordering Preservation**
  - **Validates: Requirements 4.5**

- [ ]* 6.8 Write property test for context window management
  - **Property 16: Context Window Management**
  - **Validates: Requirements 4.7, 4.8**

- [x] 7. Checkpoint - Ensure memory engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate function calling into chat handler
  - [x] 8.1 Create `handleChatRequestWithTools` function
    - Get tool schemas from registry
    - Build messages from conversation history
    - Call Azure OpenAI with tools
    - _Requirements: 2.1, 4.4_
  
  - [x] 8.2 Implement tool execution loop
    - Check if response requires tool execution
    - Execute tools using execution engine
    - Store tool calls and results in memory
    - Continue conversation with tool results
    - Limit iterations to prevent infinite loops (max 10)
    - _Requirements: 2.7, 6.1, 6.2, 6.3, 6.4_
  
  - [x] 8.3 Add tool call validation
    - Validate arguments against schemas before execution
    - Return validation errors to LLM if invalid
    - _Requirements: 2.5_
  
  - [x] 8.4 Implement error handling
    - Handle tool execution failures
    - Format errors for LLM
    - Allow LLM to retry with corrected parameters
    - Handle backend API unavailability
    - Handle timeouts
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 8.5 Add logging for tool calls
    - Log all tool executions with arguments
    - Log all tool results
    - Log all tool errors with context
    - _Requirements: 2.10, 5.7_
  
  - [x] 8.6 Update chat response to include tool execution metadata
    - Add toolCallsExecuted count
    - Add tool execution summary
    - Include tool errors if any
    - _Requirements: 6.7_

- [ ]* 8.7 Write property test for conversation loop termination
  - **Property 7: Conversation Loop Termination**
  - **Validates: Requirements 2.7, 6.4**

- [ ]* 8.8 Write property test for argument validation
  - **Property 5: Tool Argument Validation**
  - **Validates: Requirements 2.5, 9.1, 9.10**

- [ ]* 8.9 Write property test for multi-step state preservation
  - **Property 18: Multi-Step State Preservation**
  - **Validates: Requirements 6.2, 6.3, 6.6**

- [ ]* 8.10 Write integration test for single tool call flow
  - Test complete flow: user message → tool call → final response
  - _Requirements: 2.1, 2.2, 3.1, 3.2_

- [ ]* 8.11 Write integration test for multi-step tool call flow
  - Test multiple tool calls in sequence
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 9. Checkpoint - Ensure chat integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement security features
  - [x] 10.1 Add path traversal prevention
    - Validate file paths in tool arguments
    - Reject paths with "..", absolute paths, symlinks
    - _Requirements: 9.2_
  
  - [x] 10.2 Add endpoint restriction
    - Validate API URLs against configured backend endpoint
    - Reject calls to unauthorized endpoints
    - _Requirements: 9.3_
  
  - [x] 10.3 Implement rate limiting
    - Track tool calls per conversation per time window
    - Reject calls exceeding rate limit
    - Return rate limit error
    - _Requirements: 9.6_
  
  - [x] 10.4 Add audit logging
    - Log all tool executions with full context
    - Include conversation ID, user ID, tool name, arguments, results
    - Log security violations (path traversal, unauthorized access)
    - _Requirements: 9.7, 9.8_
  
  - [x] 10.5 Implement sensitive data filtering
    - Scan tool results for sensitive patterns (API keys, passwords, tokens)
    - Redact sensitive data before returning to LLM
    - _Requirements: 9.5_

- [ ]* 10.6 Write property test for path traversal prevention
  - **Property 21: Path Traversal Prevention**
  - **Validates: Requirements 9.2**

- [ ]* 10.7 Write property test for endpoint restriction
  - **Property 22: Endpoint Restriction**
  - **Validates: Requirements 9.3**

- [ ]* 10.8 Write property test for rate limiting enforcement
  - **Property 23: Rate Limiting Enforcement**
  - **Validates: Requirements 9.6**

- [ ]* 10.9 Write property test for audit logging completeness
  - **Property 24: Audit Logging Completeness**
  - **Validates: Requirements 9.7**

- [x] 11. Add monitoring and metrics
  - [x] 11.1 Create `ToolMetrics` class
    - Track tool call counts by tool name
    - Measure execution latency (p50, p95, p99)
    - Calculate success rates
    - Track circuit breaker state changes
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_
  
  - [x] 11.2 Expose tool metrics through `/api/stats` endpoint
    - Add tool metrics to stats response
    - Include per-tool statistics
    - Include circuit breaker states
    - _Requirements: 8.10_
  
  - [x] 11.3 Add tool execution logging
    - Log tool execution start and end
    - Log execution time
    - Log success/failure status
    - _Requirements: 2.10, 5.7_

- [ ]* 11.4 Write unit tests for metrics tracking
  - Test metrics are updated correctly
  - Test metrics calculations
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 12. Create configuration and documentation
  - [x] 12.1 Add tool configuration to config file
    - Add TOOL_CALLING_ENABLED flag
    - Add TOOL_MAX_ITERATIONS setting
    - Add TOOL_TIMEOUT_MS setting
    - Add TOOL_RATE_LIMIT setting
    - Add circuit breaker configuration
    - _Requirements: Configuration_

  - [x] 12.2 Update API documentation
    - Document tool calling capability
    - Document available tools and their schemas
    - Document error codes and handling
    - Document rate limits and restrictions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  
  - [x] 12.3 Add tool usage examples
    - Create example conversations with tool calls
    - Document multi-step operations
    - Document error recovery patterns
    - _Requirements: 7.2_

- [ ] 13. Final integration and testing
  - [ ]* 13.1 Write integration test for error recovery
    - Test tool failure → LLM retry → success
    - _Requirements: 5.2_
  
  - [ ]* 13.2 Write integration test for circuit breaker
    - Test repeated failures trigger circuit breaker
    - Test circuit breaker rejects subsequent calls
    - _Requirements: 5.9_
  
  - [ ]* 13.3 Write integration test for conversation resumption
    - Test storing conversation with tool calls
    - Test resuming conversation with tool history
    - _Requirements: 4.10_
  
  - [ ] 13.4 Perform end-to-end testing
    - Test all tools with real backend API
    - Test multi-step operations
    - Test error scenarios
    - Test security features
    - _Requirements: All_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- All code will be written in TypeScript
- Tool schemas follow OpenAI function calling format
- Backend API endpoints already exist, no new endpoints needed
- Testing uses Jest with property-based testing library (fast-check)
