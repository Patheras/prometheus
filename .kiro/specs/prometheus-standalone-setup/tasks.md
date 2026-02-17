# Implementation Plan: Prometheus Standalone Setup

## Overview

This implementation plan focuses on setting up Prometheus as a standalone system with proper environment configuration, database initialization, comprehensive documentation, and validation. The plan does not modify existing backend logic, API endpoints, or core architecture—only adds setup improvements and validation.

## Tasks

- [x] 1. Update environment configuration
  - Update .env.example with comprehensive documentation
  - Add comments indicating required vs optional variables
  - Update default frontend port to 3042
  - Document LLM provider configuration
  - _Requirements: 1.1, 1.2, 1.6_

- [ ] 2. Create environment validation module
  - [x] 2.1 Implement EnvValidator class
    - Create src/config/env-validator.ts
    - Implement validation for required variables
    - Implement format validation (URLs, ports, paths)
    - Generate structured error messages
    - _Requirements: 1.3, 1.4, 10.1, 10.2_
  
  - [ ]* 2.2 Write property test for environment validation
    - **Property 1: Environment Variable Validation Completeness**
    - **Validates: Requirements 1.3, 8.2, 10.1**
  
  - [ ]* 2.3 Write property test for format validation
    - **Property 2: Environment Variable Format Validation**
    - **Validates: Requirements 10.2**
  
  - [ ]* 2.4 Write unit tests for EnvValidator
    - Test missing variable detection
    - Test format validation for URLs, ports, paths
    - Test error message generation
    - _Requirements: 1.3, 10.2_

- [ ] 3. Enhance database initialization
  - [x] 3.1 Update init-db.ts script
    - Add directory creation logic
    - Improve error messages with recovery steps
    - Add schema validation after initialization
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_
  
  - [ ]* 3.2 Write property test for database schema consistency
    - **Property 3: Database Schema Consistency**
    - **Validates: Requirements 2.2, 2.5**
  
  - [ ]* 3.3 Write property test for directory creation
    - **Property 4: Database Directory Creation**
    - **Validates: Requirements 10.5**
  
  - [ ]* 3.4 Write unit tests for database initialization
    - Test database creation
    - Test directory creation
    - Test migration application
    - Test error handling
    - _Requirements: 2.1, 2.2, 2.4, 2.6_

- [ ] 4. Create startup validation module
  - [x] 4.1 Implement StartupValidator class
    - Create src/startup/validator.ts
    - Implement environment validation check
    - Implement database connectivity check
    - Implement port availability check
    - Implement dependency verification
    - _Requirements: 10.3, 10.6_
  
  - [ ]* 4.2 Write property test for configuration validation
    - **Property 5: Configuration Validation Prevents Startup**
    - **Validates: Requirements 10.3**
  
  - [ ]* 4.3 Write property test for port availability
    - **Property 9: Port Availability Validation**
    - **Validates: Requirements 10.6**
  
  - [ ]* 4.4 Write unit tests for StartupValidator
    - Test port availability checking
    - Test database connectivity checking
    - Test dependency verification
    - _Requirements: 10.3, 10.6_

- [ ] 5. Integrate validation into backend startup
  - [x] 5.1 Update src/index.ts with startup validation
    - Add EnvValidator call at startup
    - Add StartupValidator call before service start
    - Prevent startup on validation failure
    - Display all validation errors
    - _Requirements: 10.3_
  
  - [ ]* 5.2 Write property test for error message context
    - **Property 6: Error Message Context Completeness**
    - **Validates: Requirements 8.1**
  
  - [ ]* 5.3 Write property test for database error handling
    - **Property 7: Database Error Recovery Guidance**
    - **Validates: Requirements 2.4, 8.3**

- [x] 6. Checkpoint - Ensure validation works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Enhance health check endpoint
  - [x] 7.1 Update src/api/health.ts
    - Add database connectivity check
    - Add evolution system status check
    - Add component-level health reporting
    - Return appropriate HTTP status codes
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ]* 7.2 Write property test for health check database connectivity
    - **Property 10: Health Check Database Connectivity**
    - **Validates: Requirements 6.2**
  
  - [ ]* 7.3 Write property test for health check failure status codes
    - **Property 11: Health Check Failure Status Codes**
    - **Validates: Requirements 6.4**
  
  - [ ]* 7.4 Write unit tests for health check
    - Test health endpoint response
    - Test component status checking
    - Test failure scenarios
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 8. Update package.json scripts
  - [x] 8.1 Update development scripts
    - Change frontend port to 3042 in dev script
    - Update start-dev.bat to use port 3042
    - Add validation script
    - _Requirements: 4.1, 4.2, 4.3, 10.4_
  
  - [ ]* 8.2 Write unit tests for script verification
    - Test that required scripts exist
    - Test script configurations
    - _Requirements: 4.1, 5.1, 5.3, 9.1_

- [ ] 9. Create comprehensive documentation
  - [x] 9.1 Create SETUP.md
    - Write prerequisites section
    - Write installation steps
    - Write environment configuration guide
    - Write database setup instructions
    - Write verification steps
    - _Requirements: 7.1, 7.5, 7.6_
  
  - [x] 9.2 Create ENVIRONMENT.md
    - Document all environment variables
    - Create variable reference table
    - Mark required vs optional
    - Provide format specifications
    - Include example values
    - _Requirements: 7.2_
  
  - [x] 9.3 Create TROUBLESHOOTING.md
    - Document port already in use issue
    - Document database connection failures
    - Document missing dependencies
    - Document permission errors
    - Document platform-specific issues
    - _Requirements: 7.3_
  
  - [x] 9.4 Update README.md
    - Add quick start section
    - Update port references to 3042
    - Link to SETUP.md
    - _Requirements: 7.1, 7.5_
  
  - [x] 9.5 Document directory structure
    - Add directory structure section to SETUP.md
    - Explain purpose of each major directory
    - _Requirements: 7.4_

- [ ] 10. Create platform-specific startup scripts
  - [x] 10.1 Update start-dev.bat for Windows
    - Change frontend port to 3042
    - Add validation before startup
    - Improve error messages
    - _Requirements: 4.2, 4.3, 4.6_
  
  - [x] 10.2 Create start-dev.sh for Unix
    - Create shell script equivalent
    - Use port 3042
    - Add validation before startup
    - _Requirements: 4.2, 4.3, 4.6_
  
  - [x] 10.3 Update test-backend.bat
    - Update port references
    - Add health check test
    - _Requirements: 6.5_

- [ ] 11. Add error handling improvements
  - [x] 11.1 Enhance error logging in src/index.ts
    - Add structured error logging
    - Include component name and context
    - Add timestamp to all errors
    - _Requirements: 8.1, 8.4_
  
  - [ ]* 11.2 Write property test for API error responses
    - **Property 8: API Error Response Structure**
    - **Validates: Requirements 8.5**
  
  - [ ]* 11.3 Write property test for log level sensitivity
    - **Property 15: Log Level Environment Sensitivity**
    - **Validates: Requirements 8.6**

- [ ] 12. Create smoke tests
  - [x] 12.1 Create smoke test suite
    - Create tests/smoke/installation.test.ts
    - Create tests/smoke/configuration.test.ts
    - Create tests/smoke/database.test.ts
    - Create tests/smoke/health-check.test.ts
    - _Requirements: 9.4_
  
  - [ ]* 12.2 Write smoke tests
    - Test npm install succeeds
    - Test configuration validation
    - Test database initialization
    - Test health check endpoint
    - _Requirements: 9.4_

- [ ] 13. Update Next.js configuration
  - [x] 13.1 Update next.config.ts
    - Change default port to 3042
    - Verify API proxy configuration
    - _Requirements: 4.2_
  
  - [x] 13.2 Update package.json dev script
    - Add -p 3042 flag to next dev
    - _Requirements: 4.2_

- [x] 14. Final checkpoint - Verify complete setup
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- No changes to existing backend logic, API endpoints, or core architecture
- All changes are additive and focused on setup improvements
