/**
 * Chat Handler with Function Calling
 * 
 * Handles chat requests with tool execution support.
 */

import { Request, Response } from 'express';
import { createMemoryEngine, initializeDatabase } from '../memory/index.js';
import { loadConfig } from '../config/index.js';
import {
  getAzureOpenAIConfig,
  getAzureOpenAICodexConfig,
  callAzureOpenAIWithTools,
  RuntimeResponseWithTools,
} from '../runtime/azure-openai-provider.js';
import { RuntimeRequest, ModelRef } from '../types/index.js';
import { getToolRegistry, registerAllTools, getToolExecutionEngine } from '../tools/index.js';
import { ToolExecutionContext } from '../tools/types.js';
import { ChatRequest, ChatResponse } from './chat.js';

// Register all tools on module load
registerAllTools();

/**
 * Handle chat request with tools
 * 
 * @param req Express request
 * @param res Express response
 */
export async function handleChatRequestWithTools(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { conversationId, message } = req.body as ChatRequest;
    
    // Validate input
    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({
        error: 'Message is required and must be a non-empty string',
      });
      return;
    }
    
    // Load config and initialize memory engine
    const config = loadConfig();
    const db = await initializeDatabase({ path: config.database.path });
    const memoryEngine = createMemoryEngine(db, config.database.path);
    
    try {
      // Get or create conversation
      let convId = conversationId;
      if (!convId) {
        convId = await memoryEngine.createConversation();
      }
      
      // Store user message
      await memoryEngine.storeMessage(convId, 'user', message);
      
      // Get tool registry and schemas
      const toolRegistry = getToolRegistry();
      const toolSchemas = toolRegistry.getAllSchemas();
      
      console.log(`[Chat] Available tools: ${toolSchemas.length}`);
      
      // Get Azure OpenAI config
      const azureConfig = getAzureOpenAIConfig();
      const azureCodexConfig = getAzureOpenAICodexConfig();
      
      if (!azureConfig && !azureCodexConfig) {
        res.status(500).json({
          error: 'Azure OpenAI configuration not found',
        });
        return;
      }
      
      const config_to_use = azureConfig || azureCodexConfig!;
      const model: ModelRef = {
        provider: 'azure-openai',
        model: config_to_use.deploymentName,
      };
      
      // Build initial context
      const history = await memoryEngine.getConversationHistory(convId, 10);
      const context = await buildContextFromHistory(history);
      
      // Prepare runtime request
      const runtimeRequest: RuntimeRequest = {
        taskType: 'consultation',
        prompt: message,
        context,
      };
      
      // Build initial messages
      const messages: any[] = [
        {
          role: 'system',
          content: context,
        },
        {
          role: 'user',
          content: message,
        },
      ];
      
      // Tool execution loop
      const maxIterations = 10;
      let iteration = 0;
      let response: RuntimeResponseWithTools;
      const toolExecutionEngine = getToolExecutionEngine();
      let totalToolCallsExecuted = 0;
      const toolExecutionSummary: Array<{
        tool: string;
        success: boolean;
        error?: string;
      }> = [];
      
      do {
        iteration++;
        console.log(`[Chat] Iteration ${iteration}/${maxIterations}`);
        
        // Call LLM with tools
        try {
          response = await callAzureOpenAIWithTools(
            runtimeRequest,
            model,
            config_to_use,
            toolSchemas,
            messages
          );
        } catch (error) {
          console.error('[Chat] LLM call failed:', error);
          
          // Return error response
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          res.status(500).json({
            error: 'LLM call failed',
            message: errorMessage,
          });
          return;
        }
        
        // Check if tool execution is required
        if (response.requiresToolExecution && response.toolCalls) {
          console.log(`[Chat] Tool calls requested: ${response.toolCalls.length}`);
          
          // Add assistant message with tool calls to messages
          messages.push({
            role: 'assistant',
            content: response.content || null,
            tool_calls: response.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          });
          
          // Execute tools
          for (const toolCall of response.toolCalls) {
            totalToolCallsExecuted++;
            
            console.log(`[Chat] Executing tool: ${toolCall.name}`);
            console.log(`[Chat] Tool arguments:`, JSON.stringify(toolCall.arguments, null, 2));
            
            const executionContext: ToolExecutionContext = {
              conversationId: convId,
              timestamp: Date.now(),
            };
            
            try {
              // Validate tool exists
              const tool = toolRegistry.getTool(toolCall.name);
              if (!tool) {
                const errorResult = {
                  success: false,
                  error: `Tool '${toolCall.name}' not found`,
                  data: null,
                };
                
                console.error(`[Chat] Tool not found: ${toolCall.name}`);
                
                // Add error result to messages
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: toolCall.name,
                  content: JSON.stringify(errorResult),
                });
                
                toolExecutionSummary.push({
                  tool: toolCall.name,
                  success: false,
                  error: `Tool not found`,
                });
                
                continue;
              }
              
              // Validate arguments against schema
              const schema = tool.schema;
              const requiredParams = schema.parameters?.required || [];
              const missingParams = requiredParams.filter(
                param => !(param in toolCall.arguments)
              );
              
              if (missingParams.length > 0) {
                const errorResult = {
                  success: false,
                  error: `Missing required parameters: ${missingParams.join(', ')}`,
                  data: null,
                };
                
                console.error(
                  `[Chat] Validation failed for ${toolCall.name}: missing ${missingParams.join(', ')}`
                );
                
                // Add validation error to messages
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: toolCall.name,
                  content: JSON.stringify(errorResult),
                });
                
                toolExecutionSummary.push({
                  tool: toolCall.name,
                  success: false,
                  error: `Missing required parameters: ${missingParams.join(', ')}`,
                });
                
                continue;
              }
              
              // Execute tool
              const startTime = Date.now();
              const result = await toolExecutionEngine.executeTool(
                toolCall.name,
                toolCall.arguments,
                executionContext
              );
              const executionTime = Date.now() - startTime;
              
              console.log(
                `[Chat] Tool ${toolCall.name} executed in ${executionTime}ms: ${
                  result.success ? 'SUCCESS' : 'FAILED'
                }`
              );
              
              if (!result.success && result.error) {
                console.error(`[Chat] Tool error:`, result.error);
              }
              
              // Add tool result to messages
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.name,
                content: JSON.stringify(result),
              });
              
              toolExecutionSummary.push({
                tool: toolCall.name,
                success: result.success,
                error: result.error,
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`[Chat] Tool execution exception:`, error);
              
              // Add error result to messages
              const errorResult = {
                success: false,
                error: `Tool execution failed: ${errorMessage}`,
                data: null,
              };
              
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolCall.name,
                content: JSON.stringify(errorResult),
              });
              
              toolExecutionSummary.push({
                tool: toolCall.name,
                success: false,
                error: errorMessage,
              });
            }
          }
          
          // Continue loop to get final response
        } else {
          // No more tool calls, we have final response
          console.log(`[Chat] Final response received`);
          break;
        }
        
        // Check iteration limit
        if (iteration >= maxIterations) {
          console.warn(`[Chat] Max iterations (${maxIterations}) reached`);
          response.content = (response.content || '') + '\n\n[Note: Maximum tool execution iterations reached]';
          break;
        }
      } while (response.requiresToolExecution);
      
      // Store final assistant message
      const messageId = await memoryEngine.storeMessage(
        convId,
        'assistant',
        response.content || '',
        {
          model: response.model.model,
          provider: response.model.provider,
          usage: response.usage,
        }
      );
      
      console.log(`[Chat] Conversation completed`);
      console.log(`[Chat] Total tool calls executed: ${totalToolCallsExecuted}`);
      console.log(`[Chat] Tool execution summary:`, toolExecutionSummary);
      
      // Return response with tool execution metadata
      const chatResponse: ChatResponse & {
        toolCallsExecuted?: number;
        toolExecutionSummary?: Array<{ tool: string; success: boolean; error?: string }>;
      } = {
        conversationId: convId,
        messageId,
        content: response.content || '',
        role: 'assistant',
        timestamp: Date.now(),
        model: response.model.model,
        provider: response.model.provider,
        usage: response.usage,
      };
      
      // Add tool execution metadata if tools were used
      if (totalToolCallsExecuted > 0) {
        chatResponse.toolCallsExecuted = totalToolCallsExecuted;
        chatResponse.toolExecutionSummary = toolExecutionSummary;
      }
      
      res.json(chatResponse);
    } finally {
      memoryEngine.close();
    }
  } catch (error) {
    console.error('Chat request error:', error);
    res.status(500).json({
      error: 'Chat request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Build context from conversation history
 */
async function buildContextFromHistory(_history: any[]): Promise<string> {
  const { getCapabilityRegistry } = await import('../self-awareness/capability-registry.js');
  const registry = getCapabilityRegistry();
  const capabilitiesPrompt = registry.generateSystemPrompt();
  
  // Load NECTAR and IDENTITY
  let nectarContent = '';
  let identityContent = '';
  
  try {
    const path = await import('path');
    const fs = await import('fs');
    const nectarPath = path.join(process.cwd(), '.prometheus', 'NECTAR.md');
    if (fs.existsSync(nectarPath)) {
      nectarContent = fs.readFileSync(nectarPath, 'utf-8');
    }
  } catch (error) {
    console.warn('Could not load NECTAR.md:', error);
  }
  
  try {
    const path = await import('path');
    const fs = await import('fs');
    const identityPath = path.join(process.cwd(), '.prometheus', 'IDENTITY.md');
    if (fs.existsSync(identityPath)) {
      identityContent = fs.readFileSync(identityPath, 'utf-8');
    }
  } catch (error) {
    console.warn('Could not load IDENTITY.md:', error);
  }
  
  const systemPrompt = `${capabilitiesPrompt}

${nectarContent ? '---\n\n' + nectarContent : ''}

${identityContent ? '---\n\n' + identityContent : ''}

---

CURRENT STATUS:
- Working directory: ${process.cwd()}
- I have access to my own codebase
- I can now use tools to interact with the system
- All tool calls are logged and tracked

AVAILABLE TOOLS:
You have access to tools that allow you to:
- Analyze code quality and detect technical debt
- List and manage repositories
- Read files from workspaces
- Get system statistics
- Run self-analysis and check evolution status

When you need to perform an action, use the appropriate tool. The system will execute it and provide you with the results.`;

  return systemPrompt;
}
