# Browser Automation Module

Comprehensive browser automation capabilities for Prometheus, enabling automated web interactions, data extraction, testing, and workflow automation.

## Architecture

The browser automation system consists of several key components:

- **Browser Manager**: Manages browser lifecycle, profiles, and connections
- **CDP Client**: Low-level Chrome DevTools Protocol communication
- **Playwright Adapter**: High-level action execution using Playwright
- **Control Server**: HTTP/WebSocket server for browser control (loopback-only)
- **State Manager**: Manages cookies, localStorage, sessionStorage, and other browser state
- **Tool Adapters**: Exposes browser capabilities as function calling tools
- **Profile Manager**: Manages multiple browser profiles (openclaw, chrome-extension, remote)

## Directory Structure

```
src/browser-automation/
├── config/                 # Configuration management
│   ├── default-config.ts   # Default configuration and profiles
│   ├── validator.ts        # Configuration validation
│   └── index.ts           # Config module exports
├── types/                  # TypeScript type definitions
│   └── index.ts           # All type definitions
├── cdp/                    # CDP client (to be implemented)
├── playwright/             # Playwright adapter (to be implemented)
├── manager/                # Browser manager (to be implemented)
├── state/                  # State manager (to be implemented)
├── profiles/               # Profile manager (to be implemented)
├── server/                 # Control server (to be implemented)
├── tools/                  # Tool adapters (to be implemented)
├── __tests__/             # Tests
│   ├── unit/              # Unit tests
│   ├── property/          # Property-based tests
│   └── integration/       # Integration tests
├── index.ts               # Main module entry point
└── README.md              # This file
```

## Configuration

The system uses a hierarchical configuration approach:

1. **Default Configuration**: Sensible defaults defined in `config/default-config.ts`
2. **Environment Variables**: Override defaults via environment variables
3. **Custom Configuration**: Programmatic configuration via API

### Environment Variables

- `BROWSER_CONTROL_PORT`: Control server port (default: 18791)
- `BROWSER_EXECUTABLE_PATH`: Path to Chrome/Chromium executable
- `BROWSER_HEADLESS`: Run browser in headless mode (true/false)
- `BROWSER_DEFAULT_TIMEOUT`: Default timeout for actions in milliseconds
- `BROWSER_LOG_LEVEL`: Logging level (debug/info/warn/error)
- `BROWSER_ALLOW_REMOTE`: Allow remote browser profiles (true/false)

### Default Profiles

Three profiles are provided by default:

1. **openclaw**: Isolated Chrome instance with dedicated user data directory
2. **chrome-extension**: Connect to existing Chrome tabs via extension
3. **remote**: Connect to remote browsers via WebSocket

## Security

The browser automation system prioritizes security:

- **Loopback-only control**: Control server binds to 127.0.0.1 only
- **Isolated profiles**: Each profile has its own user data directory
- **Path sanitization**: File paths are validated to prevent traversal attacks
- **Parameter validation**: All action parameters are validated
- **JavaScript context isolation**: Scripts execute in page context, not Node.js

## Requirements

- Node.js >= 18.0.0
- Playwright
- Chrome/Chromium browser
- WebSocket support (ws package)
- chrome-launcher

## Installation

Dependencies are installed via npm:

```bash
npm install playwright chrome-launcher ws
```

## Usage

```typescript
import { DEFAULT_CONFIG, mergeConfig, validateAndPrepareConfig } from './browser-automation';

// Load and validate configuration
const config = mergeConfig({
  browser: {
    headless: true,
  },
});

validateAndPrepareConfig(config);

// Browser automation system will be initialized here
// (Implementation in progress)
```

## Testing

The module uses a dual testing approach:

- **Unit Tests**: Specific examples and edge cases
- **Property-Based Tests**: Universal properties across all inputs

Run tests:

```bash
npm test
```

## Status

**Current Status**: Task 1 Complete - Project structure and dependencies set up

**Next Steps**:
- Implement CDP Client (Task 2)
- Implement Playwright Adapter (Task 3)
- Implement State Manager (Task 5)
- Implement Profile Manager (Task 6)
- Implement Browser Manager (Task 7)

## References

- [Design Document](../../../.kiro/specs/browser-automation/design.md)
- [Requirements Document](../../../.kiro/specs/browser-automation/requirements.md)
- [Tasks](../../../.kiro/specs/browser-automation/tasks.md)
