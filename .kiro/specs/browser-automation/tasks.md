# Implementation Plan: Browser Automation

## Overview

This implementation plan breaks down the Browser Automation feature into incremental, testable steps. The approach follows a bottom-up strategy: build core components first (CDP client, Playwright adapter), then compose them into higher-level managers (Browser Manager, State Manager), and finally expose everything through tool adapters. Each major component includes property-based tests to validate correctness properties from the design document.

The implementation prioritizes:
1. Core browser control capabilities (CDP, Playwright)
2. State management and persistence
3. Profile management and isolation
4. Tool integration with Prometheus
5. Security and error handling
6. Observability and logging

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create directory structure: `src/browser-automation/`
  - Install dependencies: `playwright`, `ws` (WebSocket), `chrome-launcher`
  - Set up TypeScript types and interfaces from design document
  - Create configuration schema and default config
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [ ] 2. Implement CDP Client
  - [x] 2.1 Create CDP client with WebSocket connection
    - Implement `CDPClient` class with connect/disconnect methods
    - Implement `sendCommand` for sending CDP protocol commands
    - Implement event handling with `on`/`off` methods
    - Add connection state tracking and error handling
    - _Requirements: 1.2, 1.5_
  
  - [x] 2.2 Add browser metadata retrieval
    - Implement `getBrowserVersion` to retrieve browser info via CDP
    - Implement `getTargets` to list available tabs/pages
    - Implement `createTarget` and `closeTarget` for tab management
    - _Requirements: 1.3_
  
  - [ ]* 2.3 Write property test for CDP connection
    - **Property 2: Connection metadata completeness**
    - **Validates: Requirements 1.3**
  
  - [ ]* 2.4 Write property test for CDP error handling
    - **Property 4: Connection failure error completeness**
    - **Validates: Requirements 1.4**
  
  - [ ]* 2.5 Write property test for resource cleanup
    - **Property 3: Resource cleanup on disconnection**
    - **Validates: Requirements 1.5**

- [ ] 3. Implement Playwright Adapter
  - [x] 3.1 Create Playwright adapter with CDP connection
    - Implement `PlaywrightAdapter` class
    - Connect to browser via CDP endpoint using Playwright
    - Implement initialization and cleanup methods
    - _Requirements: 2.1_
  
  - [x] 3.2 Implement navigation actions
    - Implement `navigate` with waitUntil options (load, domcontentloaded, networkidle)
    - Implement `goBack`, `goForward`, `reload`
    - Add navigation result tracking (URL, status, title, loadTime)
    - _Requirements: 2.2, 6.1_
  
  - [x] 3.3 Implement interaction actions
    - Implement `click` with button and clickCount options
    - Implement `type` with delay option
    - Implement `fill`, `hover`, `select`
    - Add timeout handling for all interactions
    - _Requirements: 2.3, 2.4, 6.2, 6.3, 6.4_
  
  - [x] 3.4 Implement capture actions
    - Implement `screenshot` with fullPage, clip, quality options
    - Implement `pdf` with page size, margins, orientation options
    - Implement `snapshot` to capture DOM and accessibility tree
    - _Requirements: 2.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 8.1, 8.2, 8.3_
  
  - [x] 3.5 Implement scroll and wait actions
    - Implement scroll actions (to element, to coordinates, to top/bottom)
    - Implement `waitForSelector` with state options
    - Implement `waitForNavigation` and `waitForLoadState`
    - _Requirements: 2.6, 6.5, 18.1, 18.2, 18.3, 18.5_
  
  - [x] 3.6 Implement JavaScript evaluation
    - Implement `evaluate` to execute JavaScript in page context
    - Implement `evaluateHandle` for object handles
    - Add context isolation validation
    - _Requirements: 6.10, 9.7_
  
  - [ ]* 3.7 Write property test for action execution
    - **Property 5: Action execution via Playwright**
    - **Validates: Requirements 2.1**
  
  - [ ]* 3.8 Write property test for navigation wait states
    - **Property 6: Navigation wait state compliance**
    - **Validates: Requirements 2.2**
  
  - [ ]* 3.9 Write property test for element interactions
    - **Property 7: Element interaction success**
    - **Validates: Requirements 2.3, 2.4**
  
  - [ ]* 3.10 Write property test for action errors
    - **Property 10: Action error structure completeness**
    - **Validates: Requirements 2.7, 2.8, 11.1, 11.2, 11.3**

- [x] 4. Checkpoint - Ensure core browser control works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement State Manager
  - [x] 5.1 Create state manager for cookies
    - Implement `getCookies` to retrieve cookies via CDP
    - Implement `setCookies` to set cookies via CDP
    - Implement `deleteCookies` with filtering
    - Implement `clearAllCookies`
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 5.2 Implement storage management
    - Implement `getLocalStorage` and `setLocalStorage` via CDP
    - Implement `getSessionStorage` and `setSessionStorage` via CDP
    - Implement `clearStorage` for origin
    - _Requirements: 7.4, 7.5, 7.6_
  
  - [x] 5.3 Implement geolocation override
    - Implement `setGeolocation` via CDP Emulation domain
    - Implement `clearGeolocation`
    - _Requirements: 7.7_
  
  - [x] 5.4 Implement full state export/import
    - Implement `exportState` to serialize all state to JSON
    - Implement `importState` to deserialize and apply state
    - Implement `clearAllState` to reset browser state
    - Add JSON pretty printing for exported state
    - _Requirements: 7.8, 15.1, 15.2, 15.3_
  
  - [ ]* 5.5 Write property test for browser state round-trip
    - **Property 1: Browser state round-trip preservation**
    - **Validates: Requirements 15.1, 15.2, 15.4**
  
  - [ ]* 5.6 Write property test for cookie operations
    - **Property 18: Cookie retrieval completeness**
    - **Property 19: Cookie round-trip preservation**
    - **Property 20: Cookie deletion effectiveness**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  
  - [ ]* 5.7 Write property test for storage operations
    - **Property 21: Storage round-trip preservation**
    - **Validates: Requirements 7.4, 7.5, 7.6**
  
  - [ ]* 5.8 Write property test for state clearing
    - **Property 23: State clearing completeness**
    - **Validates: Requirements 7.8**

- [x] 6. Implement Profile Manager
  - [x] 6.1 Create profile manager with default profiles
    - Implement `ProfileManager` class
    - Define default profiles: openclaw, chrome-extension, remote
    - Implement profile CRUD operations (get, list, create, update, delete)
    - Implement profile validation
    - _Requirements: 3.1, 3.7_
  
  - [x] 6.2 Implement profile configuration persistence
    - Implement config file loading from JSON
    - Implement config file saving with pretty printing
    - Add configuration validation on load
    - _Requirements: 3.7, 13.1_
  
  - [x] 6.3 Implement user data directory management
    - Create isolated user data directories per profile
    - Implement directory creation and cleanup
    - Add path sanitization for security
    - _Requirements: 3.2, 3.5, 9.2, 9.6_
  
  - [ ]* 6.4 Write property test for profile isolation
    - **Property 11: Profile isolation**
    - **Validates: Requirements 3.2, 9.2**
  
  - [ ]* 6.5 Write property test for profile configuration persistence
    - **Property 13: Profile configuration persistence**
    - **Validates: Requirements 3.7**

- [x] 7. Implement Browser Manager
  - [x] 7.1 Create browser manager with lifecycle management
    - Implement `BrowserManager` class
    - Implement `start` and `stop` methods
    - Implement browser launch with chrome-launcher
    - Implement browser close and cleanup
    - Add browser instance tracking
    - _Requirements: 12.1, 12.2, 12.5_
  
  - [x] 7.2 Implement profile switching
    - Implement `switchProfile` to change active profile
    - Implement `getCurrentProfile` and `listProfiles`
    - Add profile switching with cleanup
    - _Requirements: 3.6_
  
  - [x] 7.3 Implement action execution routing
    - Implement `executeAction` to route actions to Playwright adapter
    - Add action validation and error handling
    - Implement action result formatting
    - _Requirements: 2.1, 2.7, 2.8_
  
  - [x] 7.4 Implement idle timeout and auto-cleanup
    - Track last action time per browser instance
    - Implement idle timeout checker (runs every 30 seconds)
    - Close idle browsers and clean up resources
    - Implement browser restart on next action
    - _Requirements: 12.3, 12.4_
  
  - [x] 7.5 Implement crash detection and recovery
    - Detect browser crashes via CDP disconnection
    - Implement automatic restart with exponential backoff
    - Add crash logging and user notification
    - _Requirements: 11.4_
  
  - [ ]* 7.6 Write property test for profile switching
    - **Property 12: Profile switching cleanup**
    - **Validates: Requirements 3.6**
  
  - [ ]* 7.7 Write property test for crash recovery
    - **Property 33: Browser crash recovery**
    - **Validates: Requirements 11.4**
  
  - [ ]* 7.8 Write property test for idle timeout
    - **Property 37: Idle timeout enforcement**
    - **Property 38: Browser restart after idle timeout**
    - **Validates: Requirements 12.3, 12.4**

- [x] 8. Checkpoint - Ensure browser lifecycle and state management work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Control Server
  - [x] 9.1 Create HTTP server with loopback-only binding
    - Implement `ControlServer` class with Express
    - Bind to 127.0.0.1 only (reject other interfaces)
    - Implement health check endpoint
    - Add request logging
    - _Requirements: 1.1, 9.1_
  
  - [x] 9.2 Implement browser control endpoints
    - POST /browser/launch - Launch browser with profile
    - POST /browser/close - Close browser
    - POST /browser/action - Execute action
    - GET /browser/state - Get browser state
    - POST /browser/state - Set browser state
    - _Requirements: 12.5_
  
  - [x] 9.3 Implement capture endpoints
    - GET /browser/screenshot - Take screenshot
    - GET /browser/snapshot - Get page snapshot
    - POST /browser/pdf - Generate PDF
    - _Requirements: 4.1, 5.1, 8.1_
  
  - [x] 9.4 Add request validation and error handling
    - Validate all request parameters
    - Implement parameter sanitization for security
    - Return structured error responses
    - _Requirements: 9.5, 9.6_
  
  - [ ]* 9.5 Write property test for loopback-only binding
    - **Property 26: Loopback-only binding**
    - **Validates: Requirements 9.1**
  
  - [ ]* 9.6 Write property test for parameter validation
    - **Property 27: Parameter validation for injection prevention**
    - **Validates: Requirements 9.5**
  
  - [ ]* 9.7 Write property test for path sanitization
    - **Property 28: Path sanitization for traversal prevention**
    - **Validates: Requirements 9.6**

- [x] 10. Implement Browser Tool Adapters
  - [x] 10.1 Create tool adapter base class
    - Implement `BrowserToolAdapter` base class
    - Add parameter validation against schema
    - Add error handling and result formatting
    - Integrate with Browser Manager
    - _Requirements: 10.1, 10.10, 10.11_
  
  - [x] 10.2 Implement navigation tools
    - Implement `browser_navigate` tool with schema
    - Implement `browser_back`, `browser_forward`, `browser_reload` tools
    - Register tools in Tool Registry
    - _Requirements: 10.2, 6.1_
  
  - [x] 10.3 Implement interaction tools
    - Implement `browser_click` tool with schema
    - Implement `browser_type` tool with schema
    - Implement `browser_fill`, `browser_hover`, `browser_select` tools
    - Register tools in Tool Registry
    - _Requirements: 10.3, 10.4, 6.2, 6.3, 6.4_
  
  - [x] 10.4 Implement capture tools
    - Implement `browser_screenshot` tool with schema
    - Implement `browser_snapshot` tool with schema
    - Implement `browser_pdf` tool with schema
    - Register tools in Tool Registry
    - _Requirements: 10.5, 10.6, 4.1, 5.1, 8.1_
  
  - [x] 10.5 Implement state management tools
    - Implement `browser_get_cookies` tool with schema
    - Implement `browser_set_cookies` tool with schema
    - Implement `browser_get_local_storage` tool with schema
    - Implement `browser_set_local_storage` tool with schema
    - Register tools in Tool Registry
    - _Requirements: 10.8, 10.9, 7.1, 7.2, 7.4, 7.5_
  
  - [x] 10.6 Implement utility tools
    - Implement `browser_execute_js` tool with schema
    - Implement `browser_wait_for_selector` tool with schema
    - Implement `browser_scroll` tool with schema
    - Register tools in Tool Registry
    - _Requirements: 10.7, 6.10, 18.1_
  
  - [ ]* 10.7 Write property test for tool schema compliance
    - **Property 30: Tool schema compliance**
    - **Validates: Requirements 10.1**
  
  - [ ]* 10.8 Write property test for tool parameter validation
    - **Property 31: Tool parameter validation**
    - **Validates: Requirements 10.10**
  
  - [ ]* 10.9 Write property test for tool error responses
    - **Property 32: Tool error response structure**
    - **Validates: Requirements 10.11**

- [x] 11. Implement Extension Relay Support
  - [x] 11.1 Create extension relay client
    - Implement communication protocol with Chrome extension
    - Implement tab discovery from extension
    - Implement tab connection establishment
    - Add error handling for missing extension
    - _Requirements: 16.1, 16.2, 16.3, 16.5_
  
  - [x] 11.2 Integrate extension profile with Browser Manager
    - Add extension profile support to Browser Manager
    - Implement tab selection and connection
    - Add tab closure detection and handling
    - _Requirements: 3.3, 16.6_
  
  - [ ]* 11.3 Write property test for extension tab discovery
    - **Property 45: Extension tab discovery**
    - **Validates: Requirements 16.2**
  
  - [ ]* 11.4 Write property test for extension action support
    - **Property 47: Extension tab action support**
    - **Validates: Requirements 16.4**

- [x] 12. Implement Remote Browser Support
  - [x] 12.1 Create remote browser connector
    - Implement WebSocket connection to remote browser
    - Implement Gateway authentication
    - Implement browser version verification
    - Add connection error handling with retry suggestions
    - _Requirements: 17.1, 17.2, 17.3, 17.5_
  
  - [x] 12.2 Integrate remote profile with Browser Manager
    - Add remote profile support to Browser Manager
    - Implement network interruption detection
    - Implement automatic reconnection with backoff
    - _Requirements: 3.4, 17.6_
  
  - [ ]* 12.3 Write property test for remote authentication
    - **Property 49: Remote authentication requirement**
    - **Validates: Requirements 17.2**
  
  - [ ]* 12.4 Write property test for remote action support
    - **Property 51: Remote action support**
    - **Validates: Requirements 17.4**
  
  - [ ]* 12.5 Write property test for network interruption handling
    - **Property 53: Network interruption reconnection**
    - **Validates: Requirements 17.6**

- [x] 13. Checkpoint - Ensure all profiles and remote support work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement Logging and Observability
  - [x] 14.1 Add action logging
    - Log all actions with type, parameters, execution time
    - Integrate with Prometheus logging infrastructure
    - Add configurable log levels
    - _Requirements: 14.1, 14.4, 14.5_
  
  - [x] 14.2 Add error logging
    - Log all errors with context and stack traces
    - Add error classification
    - _Requirements: 14.2, 11.6_
  
  - [x] 14.3 Add connection event logging
    - Log browser connections and disconnections
    - Include browser metadata in logs
    - _Requirements: 14.3_
  
  - [x] 14.4 Implement metrics collection
    - Track action count, error rate, execution time
    - Expose metrics via metrics endpoint
    - Integrate with Prometheus metrics system
    - _Requirements: 14.6_
  
  - [ ]* 14.5 Write property test for action logging
    - **Property 40: Action logging completeness**
    - **Validates: Requirements 14.1**
  
  - [ ]* 14.6 Write property test for error logging
    - **Property 35: Error logging completeness**
    - **Validates: Requirements 11.6, 14.2**
  
  - [ ]* 14.7 Write property test for metrics exposure
    - **Property 42: Metrics exposure**
    - **Validates: Requirements 14.6**

- [x] 15. Implement Security Features
  - [x] 15.1 Add input validation and sanitization
    - Validate all action parameters
    - Sanitize file paths to prevent traversal
    - Detect and reject injection attempts
    - _Requirements: 9.5, 9.6_
  
  - [x] 15.2 Add JavaScript execution context isolation
    - Verify JavaScript executes in page context only
    - Block access to Node.js globals
    - Add execution sandboxing
    - _Requirements: 9.7_
  
  - [x] 15.3 Add Gateway authentication for remote profiles
    - Implement authentication token validation
    - Add token refresh mechanism
    - Implement authorization checks
    - _Requirements: 9.3_
  
  - [ ]* 15.4 Write property test for JavaScript context isolation
    - **Property 29: JavaScript execution context isolation**
    - **Validates: Requirements 9.7**

- [x] 16. Implement Configuration System
  - [x] 16.1 Create configuration schema and defaults
    - Define `BrowserAutomationConfig` interface
    - Implement default configuration values
    - Add configuration file loading (JSON)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
  
  - [x] 16.2 Add configuration validation
    - Validate configuration on startup
    - Check port ranges, paths, timeouts
    - Return clear error messages for invalid config
    - _Requirements: 13.7_
  
  - [x] 16.3 Add environment variable support
    - Load config from environment variables
    - Override file config with env vars
    - Document all configuration options
    - _Requirements: 13.1_
  
  - [ ]* 16.4 Write property test for configuration validation
    - **Property 39: Configuration validation on startup**
    - **Validates: Requirements 13.7**

- [x] 17. Integration and Wiring
  - [x] 17.1 Wire all components together
    - Initialize Browser Manager with Profile Manager and State Manager
    - Initialize Control Server with Browser Manager
    - Register all tool adapters in Tool Registry
    - Add startup sequence and shutdown sequence
    - _Requirements: 10.12, 12.1, 12.2_
  
  - [x] 17.2 Add initialization script
    - Create initialization function for Browser Automation System
    - Load configuration and validate
    - Start Control Server
    - Launch default browser profile
    - _Requirements: 1.1, 12.1_
  
  - [x] 17.3 Add shutdown script
    - Create shutdown function for graceful cleanup
    - Close all browser instances
    - Stop Control Server
    - Clean up temporary files
    - _Requirements: 12.2, 12.6_
  
  - [ ]* 17.4 Write property test for graceful shutdown
    - **Property 36: Graceful shutdown cleanup**
    - **Validates: Requirements 12.2, 12.6**

- [x] 18. Write Integration Tests
  - [x]* 18.1 Write end-to-end workflow tests
    - Test complete workflow: launch → navigate → interact → capture → close
    - Test profile switching workflow
    - Test state export/import workflow
    - Test error recovery workflow
  
  - [x]* 18.2 Write tool integration tests
    - Test all tools via Tool Registry
    - Test tool parameter validation
    - Test tool error handling
    - Test tool execution through Tool Execution Engine
    - _Requirements: 10.12_

- [x] 19. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Documentation and Examples
  - [x] 20.1 Write API documentation
    - Document all public interfaces
    - Document configuration options
    - Document error codes and messages
    - Add JSDoc comments to all public methods
  
  - [x] 20.2 Create usage examples
    - Create example: Basic navigation and screenshot
    - Create example: Form filling and submission
    - Create example: State management (cookies, localStorage)
    - Create example: Multi-profile usage
    - Create example: Remote browser connection
  
  - [x] 20.3 Write integration guide
    - Document how to integrate with Prometheus
    - Document tool registration process
    - Document security considerations
    - Document troubleshooting common issues

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows and tool integration
- The implementation follows a bottom-up approach: core components → managers → tools → integration
- Security features are integrated throughout rather than added at the end
- All browser operations use Playwright for consistency and reliability
- CDP is used for low-level operations not available in Playwright (cookies, storage, geolocation)
