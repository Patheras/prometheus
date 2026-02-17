# Browser Tool Adapters

This directory contains the base class and implementations for browser automation tool adapters. Tool adapters expose browser capabilities as function calling tools with parameter validation, error handling, and result formatting.

## Overview

The `BrowserToolAdapter` base class provides:

- **Parameter validation** against JSON schema (OpenAI function calling format)
- **Action conversion** from tool parameters to `BrowserAction` objects
- **Error handling** with structured error responses
- **Result formatting** with consistent success/error structure
- **Integration** with `BrowserManager` for action execution

## Architecture

```
Tool Call (with parameters)
    ↓
BrowserToolAdapter.execute()
    ↓
1. Validate parameters against schema
    ↓
2. Convert parameters to BrowserAction
    ↓
3. Validate action with RequestValidator
    ↓
4. Execute action via BrowserManager
    ↓
5. Format and return result
```

## Creating a Tool Adapter

To create a new tool adapter, extend the `BrowserToolAdapter` base class and implement the `convertToAction` method:

```typescript
import { BrowserToolAdapter, ToolSchema } from './browser-tool-adapter';
import { BrowserManager } from '../browser-manager';
import { BrowserAction, ClickAction } from '../types';

class BrowserClickToolAdapter extends BrowserToolAdapter {
  constructor(browserManager: BrowserManager) {
    // Define the tool schema (OpenAI function calling format)
    const schema: ToolSchema = {
      name: 'browser_click',
      description: 'Click an element on the page',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector or XPath for the element to click',
          },
          button: {
            type: 'string',
            description: 'Mouse button to use',
            enum: ['left', 'right', 'middle'],
          },
          clickCount: {
            type: 'number',
            description: 'Number of clicks (1 for single, 2 for double)',
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait for element in milliseconds',
          },
        },
        required: ['selector'],
      },
    };

    super(browserManager, schema);
  }

  // Convert tool parameters to BrowserAction
  protected convertToAction(params: Record<string, any>): BrowserAction {
    return {
      type: 'click',
      selector: params.selector,
      button: params.button,
      clickCount: params.clickCount,
      timeout: params.timeout,
    } as ClickAction;
  }
}
```

## Using a Tool Adapter

```typescript
import { BrowserManager } from '../browser-manager';
import { ProfileManager } from '../profile-manager';
import { BrowserClickToolAdapter } from './browser-click-tool-adapter';

// Initialize browser manager
const profileManager = new ProfileManager();
const browserManager = new BrowserManager(profileManager);
await browserManager.start();

// Launch a browser
const profile = profileManager.getDefaultProfile();
await browserManager.launchBrowser(profile);

// Create tool adapter
const clickTool = new BrowserClickToolAdapter(browserManager);

// Get the tool schema (for registration in tool registry)
const schema = clickTool.getSchema();
console.log(schema);

// Execute the tool
const result = await clickTool.execute({
  selector: 'button#submit',
  button: 'left',
  clickCount: 1,
  timeout: 5000,
});

if (result.success) {
  console.log('Click successful:', result.data);
} else {
  console.error('Click failed:', result.error);
}
```

## Tool Result Format

All tool adapters return a `ToolResult` object:

```typescript
interface ToolResult {
  success: boolean;
  data?: any;                    // Present on success
  error?: {                      // Present on failure
    code: string;
    message: string;
    details?: any;
  };
  executionTime?: number;        // Execution time in milliseconds
  timestamp: number;             // Timestamp of execution
}
```

### Success Result

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "status": 200,
    "title": "Example Domain",
    "loadTime": 500
  },
  "executionTime": 500,
  "timestamp": 1234567890000
}
```

### Error Result

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Parameter validation failed",
    "details": [
      {
        "field": "url",
        "message": "Required parameter \"url\" is missing"
      }
    ]
  },
  "executionTime": 5,
  "timestamp": 1234567890000
}
```

## Error Codes

The base class uses the following error codes:

- `VALIDATION_ERROR` - Parameter validation failed (schema mismatch)
- `CONVERSION_ERROR` - Failed to convert parameters to action
- `ACTION_VALIDATION_ERROR` - Action validation failed (RequestValidator)
- `EXECUTION_ERROR` - Action execution failed (from BrowserManager)
- `UNEXPECTED_ERROR` - Unexpected error occurred

Additional error codes from `BrowserManager`:

- `ELEMENT_NOT_FOUND` - Element not found on page
- `TIMEOUT` - Action timeout exceeded
- `NAVIGATION_FAILED` - Navigation failed
- `BROWSER_DISCONNECTED` - Browser disconnected
- `INVALID_SELECTOR` - Invalid selector format
- `SCRIPT_ERROR` - JavaScript execution error
- `NETWORK_ERROR` - Network error
- `PERMISSION_DENIED` - Permission denied
- `UNKNOWN_ERROR` - Unknown error

## Validation

The base class performs two levels of validation:

### 1. Schema Validation

Validates parameters against the tool schema:

- Required parameters are present
- Parameter types match schema (string, number, boolean, array, object)
- Enum values are valid
- Array items match expected type
- Object properties match expected types

### 2. Action Validation

Validates the converted action using `RequestValidator`:

- URL format validation
- Selector injection pattern detection
- File path traversal prevention
- Timeout range validation
- Action-specific validation rules

## Best Practices

1. **Define clear schemas**: Use descriptive names and descriptions for parameters
2. **Use enums**: Constrain string parameters to valid values when possible
3. **Set required fields**: Mark parameters as required if they're essential
4. **Provide defaults**: Document default values in parameter descriptions
5. **Handle errors gracefully**: Let the base class handle validation errors
6. **Keep conversion simple**: The `convertToAction` method should be straightforward
7. **Test thoroughly**: Write unit tests for your tool adapter

## Testing

Example test for a tool adapter:

```typescript
import { BrowserClickToolAdapter } from './browser-click-tool-adapter';
import { BrowserManager } from '../browser-manager';

describe('BrowserClickToolAdapter', () => {
  let mockBrowserManager: any;
  let adapter: BrowserClickToolAdapter;

  beforeEach(() => {
    mockBrowserManager = {
      executeAction: jest.fn(),
    };
    adapter = new BrowserClickToolAdapter(mockBrowserManager);
  });

  it('should execute successfully with valid parameters', async () => {
    mockBrowserManager.executeAction.mockResolvedValue({
      success: true,
      action: { type: 'click', selector: 'button#submit' },
      result: { clicked: 'button#submit' },
      executionTime: 100,
      timestamp: Date.now(),
    });

    const result = await adapter.execute({
      selector: 'button#submit',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ clicked: 'button#submit' });
  });

  it('should fail validation when required parameter is missing', async () => {
    const result = await adapter.execute({});

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });
});
```

## Requirements

This implementation satisfies the following requirements:

- **Requirement 10.1**: Tool adapters follow OpenAI function calling schema
- **Requirement 10.10**: Parameters are validated against tool schema
- **Requirement 10.11**: Structured error responses are returned on failure

## See Also

- [BrowserManager](../browser-manager.ts) - Executes browser actions
- [RequestValidator](../validation/request-validator.ts) - Validates actions
- [Types](../types/index.ts) - Type definitions for actions and results
- [Examples](../examples/tool-adapter-demo.ts) - Usage examples
