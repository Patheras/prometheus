/**
 * Chat API Endpoint
 * 
 * Provides conversational interface to Prometheus using:
 * - RuntimeExecutor for LLM calls
 * - MemoryEngine for conversation storage
 * - QueueSystem for concurrency control
 */

import { Request, Response } from 'express';
import { createMemoryEngine, initializeDatabase } from '../memory/index.js';
import { loadConfig } from '../config/index.js';
import { getAzureOpenAIConfig, getAzureOpenAICodexConfig, callAzureOpenAI } from '../runtime/azure-openai-provider.js';
import { RuntimeRequest, ModelRef, RuntimeResponse } from '../types/index.js';

/**
 * Chat request body
 */
export interface ChatRequest {
  conversationId?: string;  // Optional, creates new if not provided
  message: string;
  stream?: boolean;         // Whether to stream the response
}

/**
 * Chat response
 */
export interface ChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  role: 'assistant';
  timestamp: number;
}

/**
 * Handle chat request
 * 
 * POST /api/chat
 * Body: { conversationId?, message, stream? }
 * 
 * @param req Express request
 * @param res Express response
 */
export async function handleChatRequest(req: Request, res: Response): Promise<void> {
  try {
    const { conversationId, message, stream = false } = req.body as ChatRequest;
    
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
      
      // Get conversation history for context
      const history = await memoryEngine.getConversationHistory(convId, 10);
      
      // Build context from conversation history
      const context = buildContextFromHistory(history);
      
      // Get API keys and configs from environment
      const azureConfig = getAzureOpenAIConfig();
      const azureCodexConfig = getAzureOpenAICodexConfig();
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      
      // Determine which provider to use (prioritize Azure OpenAI)
      let llmResponse: RuntimeResponse;
      let model: ModelRef;
      
      // Prepare runtime request
      const runtimeRequest: RuntimeRequest = {
        taskType: 'consultation',
        prompt: message,
        context,
      };
      
      if (azureConfig) {
        // Use Azure OpenAI (GPT-OSS-120B with high reasoning) as primary provider
        model = { provider: 'azure-openai', model: azureConfig.deploymentName };
        
        console.log('Using Azure OpenAI:', {
          endpoint: azureConfig.endpoint,
          deployment: azureConfig.deploymentName,
          reasoningEffort: azureConfig.reasoningEffort,
        });
        
        try {
          llmResponse = await callAzureOpenAI(runtimeRequest, model, azureConfig);
        } catch (error) {
          console.error('Azure OpenAI primary failed:', error);
          
          // Try fallback to Codex if available
          if (azureCodexConfig) {
            console.log('Falling back to Azure OpenAI Codex...');
            model = { provider: 'azure-openai', model: azureCodexConfig.deploymentName };
            llmResponse = await callAzureOpenAI(runtimeRequest, model, azureCodexConfig);
          } else {
            throw error;
          }
        }
      } else if (azureCodexConfig) {
        // Use Azure OpenAI Codex (GPT-5.1-Codex-Mini) if primary not available
        model = { provider: 'azure-openai', model: azureCodexConfig.deploymentName };
        llmResponse = await callAzureOpenAI(runtimeRequest, model, azureCodexConfig);
      } else if (anthropicKey) {
        // Use Anthropic as fallback
        model = { provider: 'anthropic', model: 'claude-sonnet-4' };
        const { callAnthropic } = await import('./anthropic-provider.js');
        llmResponse = await callAnthropic(runtimeRequest, model, anthropicKey);
      } else if (openaiKey) {
        // Use OpenAI as fallback
        model = { provider: 'openai', model: 'gpt-4o' };
        const { callOpenAI } = await import('./openai-provider.js');
        llmResponse = await callOpenAI(runtimeRequest, model, openaiKey);
      } else {
        // Use mock provider for testing
        model = { provider: 'mock', model: 'mock-model' };
        const mockResponse = 'I am Prometheus, a meta-agent system designed to help you analyze and improve your codebase. How can I assist you today?';
        llmResponse = {
          content: mockResponse,
          model,
          tokensUsed: 50,
          latency: 100,
          usage: {
            promptTokens: 20,
            completionTokens: 30,
            totalTokens: 50,
          },
          finishReason: 'stop',
        };
      }
      
      // Store assistant message
      const messageId = await memoryEngine.storeMessage(
        convId,
        'assistant',
        llmResponse.content,
        {
          model: llmResponse.model.model,
          provider: llmResponse.model.provider,
          usage: llmResponse.usage,
        }
      );
      
      // Return response
      const response: ChatResponse = {
        conversationId: convId,
        messageId,
        content: llmResponse.content,
        role: 'assistant',
        timestamp: Date.now(),
      };
      
      res.json(response);
      
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
 * Build context string from conversation history
 * 
 * @param history Array of conversation messages
 * @returns Context string for LLM
 */
function buildContextFromHistory(history: any[]): string {
  if (history.length === 0) {
    return 'You are Prometheus, a meta-agent system that helps developers analyze and improve their codebase.';
  }
  
  // Build context from previous messages
  const contextParts = [
    'You are Prometheus, a meta-agent system that helps developers analyze and improve their codebase.',
    '',
    'Previous conversation:',
  ];
  
  for (const msg of history) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    contextParts.push(`${role}: ${msg.content}`);
  }
  
  return contextParts.join('\n');
}

/**
 * Get conversation history
 * 
 * GET /api/chat/:conversationId
 * 
 * @param req Express request
 * @param res Express response
 */
export async function getConversationHistory(req: Request, res: Response): Promise<void> {
  try {
    const { conversationId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    // Load config and initialize memory engine
    const config = loadConfig();
    const db = await initializeDatabase({ path: config.database.path });
    const memoryEngine = createMemoryEngine(db, config.database.path);
    
    try {
      const messages = await memoryEngine.getConversationHistory(conversationId, limit);
      
      res.json({
        conversationId,
        messages,
      });
      
    } finally {
      memoryEngine.close();
    }
    
  } catch (error) {
    console.error('Get conversation history error:', error);
    res.status(500).json({
      error: 'Failed to get conversation history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get all conversations
 * 
 * GET /api/chat/conversations
 * 
 * @param req Express request
 * @param res Express response
 */
export async function getAllConversations(req: Request, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    // Load config and initialize memory engine
    const config = loadConfig();
    const db = await initializeDatabase({ path: config.database.path });
    const memoryEngine = createMemoryEngine(db, config.database.path);
    
    try {
      const conversations = await memoryEngine.getAllConversations(limit);
      
      res.json({
        conversations,
      });
      
    } finally {
      memoryEngine.close();
    }
    
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      error: 'Failed to get conversations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete a conversation
 * 
 * DELETE /api/chat/:conversationId
 * 
 * @param req Express request
 * @param res Express response
 */
export async function deleteConversation(req: Request, res: Response): Promise<void> {
  try {
    const { conversationId } = req.params;
    
    // Load config and initialize memory engine
    const config = loadConfig();
    const db = await initializeDatabase({ path: config.database.path });
    const memoryEngine = createMemoryEngine(db, config.database.path);
    
    try {
      await memoryEngine.deleteConversation(conversationId);
      
      res.json({
        success: true,
        conversationId,
      });
      
    } finally {
      memoryEngine.close();
    }
    
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      error: 'Failed to delete conversation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
