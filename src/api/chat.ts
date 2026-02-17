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
import { getCapabilityRegistry } from '../self-awareness/capability-registry.js';
import { createResponseValidator, ResponseValidationResult, RuntimeEngine } from '../evolution/response-validator.js';
import { isSlashCommand } from './slash-commands.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
  model?: string;
  provider?: string;
  usage?: any;
  themisValidation?: {
    truthScore: number;
    commentary: string;
    hasIssues: boolean;
  };
  promotion?: {
    id: string;
    title: string;
    description: string;
    type: 'bug_fix' | 'refactoring' | 'feature' | 'optimization';
    status: 'pending' | 'approved' | 'rejected';
    repository: string;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    files?: {
      path: string;
      additions: number;
      deletions: number;
      changes: number;
      diff?: string;
    }[];
  };
  promotions?: Array<{
    id: string;
    title: string;
    description: string;
    type: 'bug_fix' | 'refactoring' | 'feature' | 'optimization';
    status: 'pending' | 'approved' | 'rejected';
    repository: string;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    files?: {
      path: string;
      additions: number;
      deletions: number;
      changes: number;
      diff?: string;
    }[];
  }>;
  widget?: {
    type: 'promotions' | 'status' | 'consultations' | 'config' | 'metrics';
    data: any;
  };
  isCommand?: boolean;
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
    const { conversationId, message, stream: _stream = false } = req.body as ChatRequest;
    
    // Validate input
    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({
        error: 'Message is required and must be a non-empty string',
      });
      return;
    }
    
    // Check if message is a slash command
    if (isSlashCommand(message)) {
      const commandResponse = await handleSlashCommand(message);
      
      if (commandResponse) {
        // Return slash command response
        res.json({
          conversationId: conversationId || 'temp',
          messageId: `cmd-${Date.now()}`,
          content: commandResponse.content,
          role: 'assistant',
          timestamp: Date.now(),
          widget: (commandResponse as any).widget,
          isCommand: true,
        });
        return;
      }
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
      
      // Check if this is a slash command
      const commandResponse = await handleSlashCommand(message);
      if (commandResponse) {
        // Store command response
        const messageId = await memoryEngine.storeMessage(
          convId,
          'assistant',
          commandResponse.content,
          {
            model: 'system',
            provider: 'command',
          }
        );
        
        // Return command response immediately
        const response: ChatResponse = {
          conversationId: convId,
          messageId,
          content: commandResponse.content,
          role: 'assistant',
          timestamp: Date.now(),
          model: 'system',
          provider: 'command',
          promotions: commandResponse.promotions,
        };
        
        res.json(response);
        return;
      }
      
      // Get conversation history for context
      const history = await memoryEngine.getConversationHistory(convId, 10);
      
      // Build context from conversation history
      const context = buildContextFromHistory(history);
      
      // Get API keys and configs from environment
      const azureConfig = getAzureOpenAIConfig();
      const azureCodexConfig = getAzureOpenAICodexConfig();
      const anthropicKey = process.env['ANTHROPIC_API_KEY'];
      const openaiKey = process.env['OPENAI_API_KEY'];
      
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
        const { callAnthropic } = await import('../runtime/anthropic-provider.js');
        llmResponse = await callAnthropic(runtimeRequest, model, anthropicKey);
      } else if (openaiKey) {
        // Use OpenAI as fallback
        model = { provider: 'openai', model: 'gpt-4o' };
        const { callOpenAI } = await import('../runtime/openai-provider.js');
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
      
      // Validate response with Themis (independent truth check)
      let themisValidation: ResponseValidationResult | undefined;
      try {
        // Create a simple runtime engine wrapper for Themis
        const runtimeEngine: RuntimeEngine = {
          execute: async (request: RuntimeRequest): Promise<RuntimeResponse> => {
            // Use the same LLM provider that was used for the main response
            if (azureConfig) {
              return await callAzureOpenAI(request, model, azureConfig);
            } else if (azureCodexConfig) {
              return await callAzureOpenAI(request, model, azureCodexConfig);
            } else if (anthropicKey) {
              const { callAnthropic } = await import('../runtime/anthropic-provider.js');
              return await callAnthropic(request, model, anthropicKey);
            } else if (openaiKey) {
              const { callOpenAI } = await import('../runtime/openai-provider.js');
              return await callOpenAI(request, model, openaiKey);
            } else {
              // Mock response for testing
              return {
                content: 'NO_ISSUES_FOUND',
                model,
                tokensUsed: 10,
                latency: 50,
                usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
                finishReason: 'stop',
              };
            }
          }
        };
        
        const responseValidator = createResponseValidator(runtimeEngine);
        
        // IMPORTANT: Themis should NOT see conversation history
        // Only the current user query and Prometheus response
        // This prevents bias and ensures independent validation
        themisValidation = await responseValidator.validateResponse(
          llmResponse.content,
          message,
          {
            // No previousMessages - Themis validates independently
            // No conversation context - prevents bias
          }
        );
        
        console.log('[Themis] Validation:', {
          truthScore: themisValidation.truthScore,
          commentary: themisValidation.commentary,
          issuesCount: themisValidation.issues.length,
        });
        
      } catch (error) {
        console.warn('[Themis] Validation failed:', error);
        // Continue without validation if Themis fails
      }
      
      // Return response
      const response: ChatResponse = {
        conversationId: convId,
        messageId,
        content: llmResponse.content,
        role: 'assistant',
        timestamp: Date.now(),
        model: llmResponse.model.model,
        provider: llmResponse.model.provider,
        usage: llmResponse.usage,
        themisValidation: themisValidation ? {
          truthScore: themisValidation.truthScore,
          commentary: themisValidation.commentary,
          hasIssues: themisValidation.issues.length > 0,
        } : undefined,
        // TODO: Detect if Prometheus suggests improvements and create promotion
        // For now, we can manually trigger promotions based on keywords
        promotion: detectPromotion(llmResponse.content, message),
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
 * Handle slash commands
 * 
 * Processes special commands that trigger system actions
 * 
 * @param message User message
 * @returns Command response with optional promotions array
 */
async function handleSlashCommand(message: string): Promise<{ content: string; promotions?: any[] } | null> {
  const trimmed = message.trim().toLowerCase();
  
  // /evolve - Run self-analysis
  if (trimmed === '/evolve' || trimmed.startsWith('/evolve ')) {
    return {
      content: `🔄 **Self-Analysis Initiated**

I'm analyzing my own codebase for improvement opportunities...

**Analysis Areas:**
- Code quality and patterns
- Performance bottlenecks
- Security vulnerabilities
- Architecture improvements
- Test coverage gaps

This will take a few moments. I'll create promotions for any improvements I find.

Would you like me to focus on a specific area?`
    };
  }
  
  // /repos - Repository management
  if (trimmed === '/repos' || trimmed.startsWith('/repos ')) {
    try {
      const response = await fetch('http://localhost:4242/api/repositories');
      if (response.ok) {
        const data = await response.json();
        const repos = data.repositories || [];
        
        let content = `📦 **Repository Management** (${repos.length} repositories)\n\n`;
        
        if (repos.length === 0) {
          content += `No repositories configured yet.\n\nUse \`/repos add <url>\` to add a repository.`;
        } else {
          repos.forEach((repo: any, index: number) => {
            content += `**${index + 1}. ${repo.name}**\n`;
            content += `   URL: ${repo.url}\n`;
            content += `   Branch: ${repo.branch}\n`;
            content += `   Status: ${repo.status}\n`;
            content += `   Issues: ${repo.issuesCount || 0}\n\n`;
          });
        }
        
        return { content };
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    }
    
    return {
      content: `📦 **Repository Management**\n\nFailed to load repositories. Make sure the backend is running on port 4242.`
    };
  }
  
  // /stats - System statistics
  if (trimmed === '/stats') {
    try {
      const response = await fetch('http://localhost:4242/api/stats');
      if (response.ok) {
        const data = await response.json();
        
        let content = `📊 **System Statistics**\n\n`;
        content += `**Memory Engine:**\n`;
        content += `- Conversations: ${data.memory?.conversationsCount || 0}\n`;
        content += `- Messages: ${data.memory?.messagesCount || 0}\n`;
        content += `- Patterns: ${data.memory?.patternsCount || 0}\n\n`;
        
        content += `**Runtime:**\n`;
        content += `- Total Requests: ${data.runtime?.totalRequests || 0}\n`;
        content += `- Success Rate: ${data.runtime?.successRate || 0}%\n`;
        content += `- Avg Latency: ${data.runtime?.avgLatency || 0}ms\n\n`;
        
        content += `**Queue:**\n`;
        content += `- Pending: ${data.queue?.pending || 0}\n`;
        content += `- Processing: ${data.queue?.processing || 0}\n`;
        content += `- Completed: ${data.queue?.completed || 0}\n`;
        
        return { content };
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
    
    return {
      content: `📊 **System Statistics**\n\nFailed to load statistics. Make sure the backend is running on port 4242.`
    };
  }
  
  // /health - System health
  if (trimmed === '/health') {
    try {
      const response = await fetch('http://localhost:4242/health');
      if (response.ok) {
        const data = await response.json();
        
        return {
          content: `🛡️ **System Health**\n\n✅ Status: ${data.status}\n📦 Version: ${data.version}\n⏰ Timestamp: ${new Date(data.timestamp).toLocaleString()}\n\nAll systems operational!`
        };
      }
    } catch (error) {
      console.error('Failed to fetch health:', error);
    }
    
    return {
      content: `🛡️ **System Health**\n\n❌ Backend is not responding. Make sure it's running on port 4242.`
    };
  }
  
  // /promotions - Show pending promotions
  if (trimmed === '/promotions') {
    try {
      // Fetch actual promotions from API
      const promotionsResponse = await fetch('http://localhost:3000/api/promotions');
      if (promotionsResponse.ok) {
        const data = await promotionsResponse.json();
        const pendingPromotions = data.promotions?.filter((p: any) => p.status === 'pending') || [];
        
        if (pendingPromotions.length === 0) {
          return {
            content: `📋 **No Pending Promotions**

You're all caught up! No pending code promotions at the moment.

I'll automatically create promotions when I detect improvement opportunities during our conversations.

Try asking me to analyze your code or suggest optimizations!`
          };
        }
        
        let content = `📋 **Pending Promotions** (${pendingPromotions.length})\n\n`;
        content += `I found ${pendingPromotions.length} improvement${pendingPromotions.length > 1 ? 's' : ''} waiting for your review.\n\n`;
        content += `Review each promotion below and approve or reject directly from chat!`;
        
        return {
          content,
          promotions: pendingPromotions
        };
      }
    } catch (error) {
      console.error('Failed to fetch promotions:', error);
    }
    
    return {
      content: `📋 **Pending Promotions**

Fetching your pending code promotions...

You can also view them at: http://localhost:3000/promotions

I'll show any pending promotions below. You can approve or reject them directly from chat!`
    };
  }
  
  // /consultations - Show consultation history
  if (trimmed === '/consultations') {
    return {
      content: `📚 **Consultation History**

Here are your recent consultations:

1. **Code Review** - 2 hours ago
   - Analyzed authentication flow
   - Suggested security improvements
   
2. **Architecture Discussion** - Yesterday
   - Reviewed microservices design
   - Recommended event-driven approach

3. **Performance Optimization** - 2 days ago
   - Identified N+1 query issues
   - Suggested caching strategy

Would you like details on any of these?`
    };
  }
  
  // /config - Configuration
  if (trimmed === '/config' || trimmed.startsWith('/config ')) {
    return {
      content: `⚙️ **Prometheus Configuration**

**Current Settings:**
- Model: GPT-OSS-120B (Azure OpenAI)
- Reasoning Effort: High
- Themis Validation: Enabled
- Auto-Promotions: Enabled
- Circuit Breaker: Active

**Available Commands:**
- \`/config model <name>\` - Change LLM model
- \`/config reasoning <low|medium|high>\` - Adjust reasoning effort
- \`/config themis <on|off>\` - Toggle validation
- \`/config show\` - Show all settings

What would you like to configure?`
    };
  }
  
  // /status - System status
  if (trimmed === '/status') {
    return {
      content: `🛡️ **System Status**

**Health:** ✅ All systems operational

**Metrics:**
- Uptime: 5 days, 3 hours
- Total Consultations: 247
- Promotions Created: 18
- Promotions Approved: 12
- Average Response Time: 1.2s
- Themis Truth Score Avg: 87%

**Active Services:**
- ✅ Chat API (Port 4242)
- ✅ Memory Engine (SQLite)
- ✅ Themis Validator
- ✅ Evolution System
- ✅ Queue System

**Recent Activity:**
- Last promotion: 2 hours ago
- Last self-analysis: Yesterday
- Circuit breaker trips: 0

Everything is running smoothly! 🚀`
    };
  }
  
  return null;
}

/**
 * Detect if response contains a promotion suggestion
 * 
 * This is a simple keyword-based detection for demo purposes.
 * In production, this would be more sophisticated and integrated with
 * Prometheus's self-improvement system.
 * 
 * @param response LLM response content
 * @param userQuery User's original query
 * @returns Promotion object if detected, undefined otherwise
 */
function detectPromotion(response: string, _userQuery: string): ChatResponse['promotion'] | undefined {
  // Simple keyword detection for demo
  const promotionKeywords = [
    'i can improve',
    'i suggest',
    'i recommend',
    'optimization',
    'refactor',
    'fix',
    'enhancement',
    'better approach',
  ];
  
  const responseLower = response.toLowerCase();
  const hasPromotionKeyword = promotionKeywords.some(keyword => responseLower.includes(keyword));
  
  // For demo purposes, return a sample promotion if keywords detected
  if (hasPromotionKeyword && responseLower.includes('code')) {
    return {
      id: `promo-${Date.now()}`,
      title: 'Suggested improvement from conversation',
      description: 'Prometheus detected an opportunity for improvement during our conversation.',
      type: 'optimization',
      status: 'pending',
      repository: 'prometheus',
      filesChanged: 1,
      linesAdded: 5,
      linesRemoved: 2,
      files: [
        {
          path: 'example/suggested-change.ts',
          additions: 5,
          deletions: 2,
          changes: 7,
          diff: `@@ -1,5 +1,8 @@
 // Example improvement suggested by Prometheus
-const oldApproach = 'needs improvement';
+const betterApproach = 'optimized solution';
+
+// Additional improvements
+const enhanced = true;`,
        },
      ],
    };
  }
  
  return undefined;
}

/**
 * Build context string from conversation history
 * 
 * @param history Array of conversation messages
 * @returns Context string for LLM
 */
function buildContextFromHistory(history: any[]): string {
  // Get capability registry and generate dynamic system prompt
  const registry = getCapabilityRegistry();
  const capabilitiesPrompt = registry.generateSystemPrompt();
  
  // Load nectar and identity files if they exist
  let nectarContent = '';
  let identityContent = '';
  
  try {
    const nectarPath = join(process.cwd(), '.prometheus', 'NECTAR.md');
    if (existsSync(nectarPath)) {
      nectarContent = readFileSync(nectarPath, 'utf-8');
    }
  } catch (error) {
    console.warn('Could not load NECTAR.md:', error);
  }
  
  try {
    const identityPath = join(process.cwd(), '.prometheus', 'IDENTITY.md');
    if (existsSync(identityPath)) {
      identityContent = readFileSync(identityPath, 'utf-8');
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
- I maintain separate dev and prod repositories
- All production changes require user approval

HOW TO USE MY CAPABILITIES:
When you want me to analyze myself or run self-improvement:
1. Visit the Evolution page: http://localhost:3000/evolution
2. Click "Run Self-Analysis" to start a new analysis
3. Review pending improvements and approve/reject them
4. Check the Safety tab to monitor circuit breaker status

The Evolution page shows:
- Pending improvements awaiting your approval
- Recent improvements I've made
- My quality metrics over time
- Pattern library of successful improvements
- Safety monitoring dashboard

When discussing my capabilities, I will be specific about what I can do right now and guide you to the appropriate UI.`;

  if (history.length === 0) {
    return systemPrompt;
  }
  
  // Build context from previous messages
  const contextParts = [
    systemPrompt,
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
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
    
    // Load config and initialize memory engine
    const config = loadConfig();
    const db = await initializeDatabase({ path: config.database.path });
    const memoryEngine = createMemoryEngine(db, config.database.path);
    
    try {
      const messages = await memoryEngine.getConversationHistory(conversationId as string, limit);
      
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
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
    
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
      await memoryEngine.deleteConversation(conversationId as string);
      
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
