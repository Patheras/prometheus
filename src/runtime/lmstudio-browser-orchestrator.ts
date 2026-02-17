/**
 * LM Studio Browser Orchestrator
 * 
 * Specialized orchestrator for browser automation with LM Studio.
 * Handles multi-step tool calling with proper reasoning and execution.
 */

import { callLMStudio, LMStudioConfig } from './lmstudio-provider.js';
import { RuntimeRequest, RuntimeResponse } from '../types/index.js';

export interface BrowserTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface OrchestratorConfig {
  lmstudio: LMStudioConfig;
  maxIterations?: number;
  temperature?: number;
  maxTokensPerStep?: number;
  verbose?: boolean;
}

/**
 * Browser Automation Orchestrator for LM Studio
 */
export class LMStudioBrowserOrchestrator {
  private config: OrchestratorConfig;
  private conversationHistory: any[] = [];
  private toolExecutor: (toolName: string, args: any) => Promise<ToolResult>;

  constructor(
    config: OrchestratorConfig,
    toolExecutor: (toolName: string, args: any) => Promise<ToolResult>
  ) {
    this.config = {
      maxIterations: 10,
      temperature: 0.2,
      maxTokensPerStep: 500,
      verbose: false,
      ...config,
    };
    this.toolExecutor = toolExecutor;
  }

  /**
   * Execute a browser automation task
   */
  async execute(userPrompt: string, tools: BrowserTool[]): Promise<{
    success: boolean;
    finalResponse: string;
    toolCallsMade: Array<{ tool: string; args: any; result: any }>;
    iterations: number;
    reasoning: string[];
  }> {
    this.conversationHistory = [];
    const toolCallsMade: Array<{ tool: string; args: any; result: any }> = [];
    const reasoning: string[] = [];

    // Add initial user message with clear instructions
    this.conversationHistory.push({
      role: 'system',
      content: `You are a browser automation assistant. You have these tools available:

AVAILABLE TOOLS:
- browser_navigate(url: string) - Go to a URL
- browser_type(selector: string, text: string) - Type text into an input
- browser_click(selector: string) - Click an element
- browser_screenshot(fullPage?: boolean) - Take a screenshot
- browser_get_text(selector: string) - Get text from an element
- browser_wait(selector: string, timeout?: number) - Wait for an element

INSTRUCTIONS:
1. Read the user's request
2. Think BRIEFLY (1 sentence max) in <think> tags
3. Call ONE tool using the exact function name and parameters
4. Wait for the tool result
5. Repeat until task is complete

EXAMPLE 1 - Navigate:
User: "Go to wikipedia.org"
Assistant: <think>Need to navigate</think>
[Then call browser_navigate with {"url": "https://wikipedia.org"}]

EXAMPLE 2 - Navigate and screenshot:
User: "Go to google.com and take a screenshot"
Step 1: <think>Navigate first</think>
[Call browser_navigate with {"url": "https://google.com"}]
Step 2: After receiving success, <think>Now screenshot</think>
[Call browser_screenshot with {}]
Step 3: After screenshot success, <think>Task complete</think>
[Respond: "Done! Navigated to google.com and took a screenshot."]

WHEN TO STOP:
- After completing ALL requested actions, respond with a summary
- Do NOT repeat actions that are already done
- If you already navigated and took screenshot, say "Done!" and stop

CRITICAL:
- Use EXACT tool names: browser_navigate, browser_type, browser_click, browser_screenshot, browser_get_text, browser_wait
- Do NOT make up tool names like "tool_name" or "navigate"
- Keep thinking SHORT (max 10 words)
- Call tools ONE AT A TIME

START NOW!`
    });

    this.conversationHistory.push({
      role: 'user',
      content: userPrompt
    });

    let iteration = 0;
    let finalResponse = '';

    while (iteration < this.config.maxIterations!) {
      iteration++;
      
      if (this.config.verbose) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Iteration ${iteration}/${this.config.maxIterations}`);
        console.log('='.repeat(60));
      }

      // Call LM Studio
      const response = await this.callModel(tools);
      
      if (!response.choices?.[0]?.message) {
        throw new Error('No response from LM Studio');
      }

      const message = response.choices[0].message;

      // Extract reasoning
      const thinkMatch = message.content?.match(/<think>([\s\S]*?)<\/think>/);
      if (thinkMatch) {
        const thinkContent = thinkMatch[1].trim();
        reasoning.push(thinkContent);
        
        if (this.config.verbose) {
          console.log('\n💭 Reasoning:', thinkContent.substring(0, 200) + '...');
        }
      }

      // Add assistant message to history
      this.conversationHistory.push(message);

      // Check for tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0]; // Process one at a time
        const toolName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        if (this.config.verbose) {
          console.log(`\n🔧 Tool Call: ${toolName}`);
          console.log(`   Arguments:`, args);
        }

        // Execute tool
        const result = await this.toolExecutor(toolName, args);
        
        if (this.config.verbose) {
          console.log(`   Result:`, result.success ? '✅ Success' : '❌ Failed');
          if (result.error) {
            console.log(`   Error:`, result.error);
          }
        }

        // Record tool call
        toolCallsMade.push({
          tool: toolName,
          args: args,
          result: result
        });

        // Add tool result to conversation
        this.conversationHistory.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(result)
        });

        // Continue to next iteration
        continue;
      }

      // No tool calls - check for final response
      if (message.content) {
        // Remove <think> tags from final response
        finalResponse = message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        
        if (this.config.verbose) {
          console.log('\n✅ Final Response:', finalResponse);
        }
        
        break;
      }

      // No tool calls and no content - something went wrong
      if (this.config.verbose) {
        console.log('\n⚠️  No tool calls and no content - stopping');
      }
      break;
    }

    if (iteration >= this.config.maxIterations!) {
      finalResponse = `Task incomplete: Reached maximum iterations (${this.config.maxIterations})`;
    }

    return {
      success: toolCallsMade.length > 0 || finalResponse.length > 0,
      finalResponse,
      toolCallsMade,
      iterations: iteration,
      reasoning
    };
  }

  /**
   * Call LM Studio model
   */
  private async callModel(tools: BrowserTool[]): Promise<any> {
    const endpoint = this.config.lmstudio.endpoint;
    const model = this.config.lmstudio.model;

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: this.conversationHistory,
        tools: tools,
        tool_choice: 'auto',
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokensPerStep,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio error: ${response.status} ${await response.text()}`);
    }

    return await response.json();
  }

  /**
   * Get conversation history
   */
  getHistory(): any[] {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
}

/**
 * Create browser automation tools definition
 */
export function createBrowserTools(): BrowserTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'browser_navigate',
        description: 'Navigate to a URL in the browser. Use this to open web pages.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to navigate to (must start with http:// or https://)'
            }
          },
          required: ['url']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'browser_type',
        description: 'Type text into an input field on the current page. Use this to fill forms or search boxes.',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the input element (e.g., "input[name=q]", "#search-box")'
            },
            text: {
              type: 'string',
              description: 'The text to type into the input field'
            }
          },
          required: ['selector', 'text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'browser_click',
        description: 'Click on an element on the current page. Use this to click buttons, links, or other clickable elements.',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the element to click (e.g., "button[type=submit]", "a.login-link")'
            }
          },
          required: ['selector']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'browser_wait',
        description: 'Wait for an element to appear on the page. Use this before interacting with dynamically loaded content.',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the element to wait for'
            },
            timeout: {
              type: 'number',
              description: 'Maximum time to wait in milliseconds (default: 5000)'
            }
          },
          required: ['selector']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'browser_screenshot',
        description: 'Take a screenshot of the current page. Returns a file path instead of base64 to save context.',
        parameters: {
          type: 'object',
          properties: {
            fullPage: {
              type: 'boolean',
              description: 'Capture the full scrollable page (default: false)'
            },
            path: {
              type: 'string',
              description: 'Optional file path to save screenshot. If not provided, auto-generates path in ./screenshots/'
            }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'browser_get_text',
        description: 'Get the text content of an element. Use this to read information from the page.',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the element to get text from'
            }
          },
          required: ['selector']
        }
      }
    }
  ];
}
