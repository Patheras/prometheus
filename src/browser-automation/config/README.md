# Browser Automation Configuration

This document describes all configuration options for the Browser Automation system.

## Configuration Sources

Configuration is loaded from multiple sources with the following priority (highest to lowest):

1. **Environment Variables** - Override all other sources
2. **JSON Configuration File** - Override custom and default config
3. **Custom Configuration** - Programmatically provided config
4. **Default Configuration** - Built-in defaults

## Loading Configuration

### From Code

```typescript
import { loadConfig } from './config/index.js';

// Load with defaults
const config = loadConfig();

// Load with custom config file path
const config = loadConfig(undefined, './my-config.json');

// Load with custom config object
const config = loadConfig({
  browser: {
    headless: true,
  },
});

// Load with both custom config and file
const config = loadConfig(customConfig, './my-config.json');
```

### From JSON File

The system automatically looks for configuration files in these locations:

1. `./browser-automation.config.json` (current working directory)
2. `./.browser-automation/config.json`

You can also specify a custom path when loading configuration.

Example `browser-automation.config.json`:

```json
{
  "browser": {
    "headless": true,
    "defaultTimeout": 60000
  },
  "logging": {
    "level": "debug"
  }
}
```

## Configuration Options

### Control Server

Controls the HTTP/WebSocket server for browser control.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `controlServer.enabled` | boolean | `true` | Enable/disable the control server |
| `controlServer.port` | number | `18791` | Port to bind the server (1024-65535) |
| `controlServer.host` | string | `'127.0.0.1'` | Host to bind (must be loopback for security) |

**Environment Variables:**
- `BROWSER_CONTROL_PORT` - Override the control server port

### Browser

General browser settings.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `browser.executablePath` | string? | `undefined` | Path to Chrome/Chromium executable (auto-detected if not set) |
| `browser.defaultProfile` | string | `'openclaw'` | Default profile to use on startup |
| `browser.headless` | boolean | `false` | Run browser in headless mode |
| `browser.defaultViewport` | object | `{width: 1280, height: 720}` | Default viewport dimensions |
| `browser.defaultTimeout` | number | `30000` | Default timeout for actions (milliseconds) |
| `browser.idleTimeout` | number | `300000` | Close browser after idle time (milliseconds, 5 minutes) |

**Environment Variables:**
- `BROWSER_EXECUTABLE_PATH` - Override browser executable path
- `BROWSER_HEADLESS` - Set to `'true'` or `'false'` to override headless mode
- `BROWSER_DEFAULT_TIMEOUT` - Override default timeout (milliseconds)
- `BROWSER_IDLE_TIMEOUT` - Override idle timeout (milliseconds)
- `BROWSER_DEFAULT_PROFILE` - Override default profile name

### Profiles

Browser profiles define how to connect to browsers. The system includes three default profiles:

1. **openclaw** - Launches a new isolated Chrome instance
2. **chrome-extension** - Connects to existing Chrome tabs via extension
3. **remote** - Connects to remote browsers via WebSocket

You can define custom profiles in the configuration:

```json
{
  "profiles": [
    {
      "name": "my-profile",
      "type": "openclaw",
      "userDataDir": "./.browser-data/my-profile",
      "launchOptions": {
        "headless": false,
        "args": ["--no-first-run"],
        "defaultViewport": { "width": 1920, "height": 1080 },
        "timeout": 30000
      }
    }
  ]
}
```

### Paths

File system paths for browser data.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `paths.userDataBaseDir` | string | `./.browser-data` | Base directory for browser user data |
| `paths.screenshotDir` | string | `./.browser-data/screenshots` | Directory for screenshots |
| `paths.downloadDir` | string | `./.browser-data/downloads` | Directory for downloads |

**Environment Variables:**
- `BROWSER_USER_DATA_DIR` - Override user data base directory
- `BROWSER_SCREENSHOT_DIR` - Override screenshot directory
- `BROWSER_DOWNLOAD_DIR` - Override download directory

### Logging

Logging configuration.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logging.level` | string | `'info'` | Log level: `'debug'`, `'info'`, `'warn'`, `'error'` |
| `logging.logActions` | boolean | `true` | Log all browser actions |
| `logging.logErrors` | boolean | `true` | Log all errors |

**Environment Variables:**
- `BROWSER_LOG_LEVEL` - Override log level

### Security

Security settings.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `security.allowRemoteProfiles` | boolean | `false` | Allow remote browser connections |
| `security.validateSelectors` | boolean | `true` | Validate CSS selectors before use |
| `security.sanitizeFilePaths` | boolean | `true` | Sanitize file paths to prevent traversal |

**Environment Variables:**
- `BROWSER_ALLOW_REMOTE` - Set to `'true'` to allow remote profiles

## Environment Variables Reference

Complete list of supported environment variables:

| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `BROWSER_CONTROL_PORT` | number | `19000` | Control server port |
| `BROWSER_EXECUTABLE_PATH` | string | `/usr/bin/chromium` | Browser executable path |
| `BROWSER_HEADLESS` | boolean | `true` | Headless mode |
| `BROWSER_DEFAULT_TIMEOUT` | number | `60000` | Default timeout (ms) |
| `BROWSER_IDLE_TIMEOUT` | number | `600000` | Idle timeout (ms) |
| `BROWSER_DEFAULT_PROFILE` | string | `openclaw` | Default profile name |
| `BROWSER_USER_DATA_DIR` | string | `/path/to/data` | User data directory |
| `BROWSER_SCREENSHOT_DIR` | string | `/path/to/screenshots` | Screenshot directory |
| `BROWSER_DOWNLOAD_DIR` | string | `/path/to/downloads` | Download directory |
| `BROWSER_LOG_LEVEL` | string | `debug` | Log level |
| `BROWSER_ALLOW_REMOTE` | boolean | `true` | Allow remote profiles |

## Validation

Configuration is validated on startup. The following validations are performed:

### Control Server
- Host must be `'127.0.0.1'` (loopback only for security)
- Port must be between 1024 and 65535

### Browser
- Executable path must exist (if specified)
- Timeouts must be positive numbers
- Viewport dimensions must be positive

### Profiles
- At least one profile must be defined
- Profile names must be unique
- Profile types must be valid: `'openclaw'`, `'chrome-extension'`, or `'remote'`
- Default profile must exist in profiles list

### Paths
- Paths must not contain directory traversal patterns (`../`)

### Logging
- Log level must be one of: `'debug'`, `'info'`, `'warn'`, `'error'`

If validation fails, the system will throw an error with clear messages describing all validation issues.

## Example Configurations

### Development Configuration

```json
{
  "browser": {
    "headless": false,
    "defaultTimeout": 60000
  },
  "logging": {
    "level": "debug",
    "logActions": true
  }
}
```

### Production Configuration

```json
{
  "browser": {
    "headless": true,
    "defaultTimeout": 30000,
    "idleTimeout": 600000
  },
  "logging": {
    "level": "warn",
    "logActions": false
  },
  "security": {
    "allowRemoteProfiles": false
  }
}
```

### Testing Configuration

```json
{
  "browser": {
    "headless": true,
    "defaultTimeout": 10000
  },
  "logging": {
    "level": "error",
    "logActions": false
  }
}
```

### Remote Browser Configuration

```json
{
  "browser": {
    "defaultProfile": "remote"
  },
  "profiles": [
    {
      "name": "remote",
      "type": "remote",
      "userDataDir": "./.browser-data/remote",
      "launchOptions": {
        "headless": false,
        "args": [],
        "defaultViewport": { "width": 1280, "height": 720 },
        "timeout": 30000
      },
      "connectionOptions": {
        "wsEndpoint": "ws://remote-browser:9222",
        "gatewayUrl": "https://gateway.example.com",
        "authToken": "your-auth-token"
      }
    }
  ],
  "security": {
    "allowRemoteProfiles": true
  }
}
```

## Programmatic Configuration

You can also configure the system programmatically:

```typescript
import { BrowserManager } from './browser-manager.js';
import { loadConfig } from './config/index.js';

// Load configuration
const config = loadConfig({
  browser: {
    headless: true,
    defaultTimeout: 60000,
  },
  logging: {
    level: 'debug',
  },
});

// Initialize browser manager with config
const browserManager = new BrowserManager(config);
await browserManager.start();
```

## Configuration Validation

To validate a configuration without starting the system:

```typescript
import { validateConfig } from './config/index.js';

const validation = validateConfig(myConfig);

if (!validation.valid) {
  console.error('Configuration errors:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
}
```

## Directory Creation

The system automatically creates required directories on startup:

- User data base directory
- Screenshot directory
- Download directory
- Profile-specific user data directories

You don't need to create these directories manually.
