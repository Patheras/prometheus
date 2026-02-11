# LLM Provider Setup Guide

## Overview

Prometheus supports multiple LLM providers with automatic fallback and provider selection. The system can use Azure OpenAI (GPT-OSS-120B), Anthropic Claude, OpenAI GPT, or a mock provider for testing.

## Supported Providers

### 1. Azure OpenAI (Primary)
- **Models**: GPT-OSS-120B (high reasoning), GPT-5.1-Codex-Mini (code generation), GPT-5
- **Context Window**: 128K tokens
- **Reasoning Effort**: Low, Medium, High (GPT-OSS-120B uses high by default)
- **Best For**: Production workloads, reasoning tasks, code generation

### 2. Anthropic (Fallback)
- **Models**: Claude Opus 4, Claude Sonnet 4, Claude Haiku 4
- **Context Window**: 200K tokens
- **Best For**: Code analysis, decision making, complex reasoning

### 3. OpenAI (Fallback)
- **Models**: GPT-4o, GPT-4o-mini, GPT-4 Turbo, O1
- **Context Window**: 128K tokens
- **Best For**: General tasks, fast responses

### 4. Mock (Testing)
- **Models**: Mock model
- **Context Window**: 128K tokens (simulated)
- **Best For**: Testing without API costs

## Configuration

### Environment Variables

Create a `.env` file in the `prometheus` directory:

```bash
# Azure OpenAI (Primary Provider - GPT-OSS-120B with high reasoning)
AZURE_OPENAI_ENDPOINT=https://anots-qubik-creative-agent.cognitiveservices.azure.com
AZURE_OPENAI_API_KEY=your-azure-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-oss-120b
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_REASONING_EFFORT=high  # low, medium, or high

# Azure OpenAI (Fallback Provider - GPT-5.1-Codex-Mini for code generation)
AZURE_OPENAI_CODEX_ENDPOINT=https://anots-qubik-creative-agent.cognitiveservices.azure.com
AZURE_OPENAI_CODEX_API_KEY=your-azure-api-key
AZURE_OPENAI_CODEX_DEPLOYMENT=gpt-5.1-codex-mini
AZURE_OPENAI_CODEX_API_VERSION=2024-12-01-preview

# Anthropic (Fallback Provider)
ANTHROPIC_API_KEY=sk-ant-api03-...

# OpenAI (Fallback Provider)
OPENAI_API_KEY=sk-...

# Database
DATABASE_PATH=./data/prometheus.db

# Server
PORT=3000
NODE_ENV=development
```

### Provider Priority

The system automatically selects providers in this order:

1. **Azure OpenAI GPT-OSS-120B** (if `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` are set) - High reasoning
2. **Azure OpenAI GPT-5.1-Codex-Mini** (if `AZURE_OPENAI_CODEX_ENDPOINT` and `AZURE_OPENAI_CODEX_API_KEY` are set) - Code generation fallback
3. **Anthropic** (if `ANTHROPIC_API_KEY` is set)
4. **OpenAI** (if `OPENAI_API_KEY` is set)
5. **Mock** (if no API keys are set)

## Getting API Keys

### Azure OpenAI API Key

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Azure OpenAI resource
3. Go to "Keys and Endpoint"
4. Copy the endpoint URL and one of the keys
5. Note your deployment name (e.g., `gpt-oss-120b`)

### Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to "API Keys"
4. Create a new API key
5. Copy the key (starts with `sk-ant-api03-`)

### OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to "API Keys"
4. Create a new API key
5. Copy the key (starts with `sk-`)

## Usage Examples

### Basic Chat Request

```bash
# Using Azure OpenAI GPT-OSS-120B (if configured)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How can I improve my authentication module?"
  }'
```

### With Specific Conversation

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv_123_abc",
    "message": "Can you explain the previous suggestion?"
  }'
```

### Get Conversation History

```bash
curl http://localhost:3000/api/chat/conv_123_abc
```

### List All Conversations

```bash
curl http://localhost:3000/api/chat/conversations
```

## Provider Selection Logic

### Automatic Selection

```typescript
// In chat API
const azureConfig = getAzureOpenAIConfig();
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (azureConfig) {
  // Use Azure OpenAI GPT-OSS-120B
  model = { provider: 'azure-openai', model: 'gpt-oss-120b' };
} else if (anthropicKey) {
  // Use Anthropic Claude Sonnet 4
  model = { provider: 'anthropic', model: 'claude-sonnet-4' };
} else if (openaiKey) {
  // Use OpenAI GPT-4o
  model = { provider: 'openai', model: 'gpt-4o' };
} else {
  // Use mock provider
  model = { provider: 'mock', model: 'mock-model' };
}
```

### Manual Provider Selection

```typescript
import { createLLMCaller } from './runtime/llm-provider-factory';
import { getAzureOpenAIConfig } from './runtime/azure-openai-provider';

// Create Azure OpenAI caller
const azureConfig = getAzureOpenAIConfig();
const azureCaller = createLLMCaller({
  provider: 'azure-openai',
  azureConfig,
});

// Create Anthropic caller
const anthropicCaller = createLLMCaller({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Create OpenAI caller
const openaiCaller = createLLMCaller({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// Create mock caller (for testing)
const mockCaller = createLLMCaller({
  provider: 'mock',
  mockConfig: {
    defaultResponse: 'Test response',
    responseDelay: 100,
  },
});
```

### Multi-Provider Fallback

```typescript
import { createMultiProviderCaller } from './runtime/llm-provider-factory';
import { getAzureOpenAIConfig } from './runtime/azure-openai-provider';

// Create caller with fallback chain
const azureConfig = getAzureOpenAIConfig();
const caller = createMultiProviderCaller([
  {
    provider: 'azure-openai',
    azureConfig,
  },
  {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  },
  {
    provider: 'mock',
    mockConfig: { defaultResponse: 'Fallback response' },
  },
]);

// Automatically tries providers in order until one succeeds
const response = await caller(request, model, azureConfig || '', signal);
```

## Model Selection

### Available Models

**Azure OpenAI:**
- `gpt-oss-120b` - GPT-OSS-120B with high reasoning mode (default primary)
- `gpt-5.1-codex-mini` - GPT-5.1-Codex-Mini for code generation (fallback)
- `gpt-5` - GPT-5 model

**Anthropic:**
- `claude-opus-4` - Most capable, highest cost
- `claude-sonnet-4` - Balanced performance (default)
- `claude-haiku-4` - Fast, lower cost
- `claude-3-5-sonnet-20241022` - Previous generation
- `claude-3-5-haiku-20241022` - Previous generation

**OpenAI:**
- `gpt-4o` - Latest GPT-4 (default)
- `gpt-4o-mini` - Smaller, faster
- `gpt-4-turbo` - Previous generation
- `gpt-4` - Original GPT-4
- `o1` - Reasoning model
- `o1-mini` - Smaller reasoning model

### Context Windows

| Provider | Model | Context Window |
|----------|-------|----------------|
| Azure OpenAI | GPT-OSS-120B | 128K tokens |
| Azure OpenAI | GPT-5.1-Codex-Mini | 128K tokens |
| Azure OpenAI | GPT-5 | 128K tokens |
| Anthropic | Claude 4 | 200K tokens |
| Anthropic | Claude 3.5 | 200K tokens |
| OpenAI | GPT-4o | 128K tokens |
| OpenAI | GPT-4 Turbo | 128K tokens |
| OpenAI | O1 | 128K tokens |

### Reasoning Effort (Azure OpenAI)

Azure OpenAI's GPT-OSS-120B supports reasoning effort control:

- **low**: Fast responses, minimal reasoning
- **medium**: Balanced reasoning and speed (used by Codex)
- **high**: Deep reasoning, slower responses (default for GPT-OSS-120B)

Configure via environment variable:
```bash
AZURE_OPENAI_REASONING_EFFORT=high  # For GPT-OSS-120B
```

GPT-5.1-Codex-Mini automatically uses medium reasoning effort for optimal code generation performance.

## Streaming Support

All providers (Azure OpenAI, Anthropic, and OpenAI) support streaming responses:

```typescript
import { createLLMStreamingCaller } from './runtime/llm-provider-factory';
import { getAzureOpenAIConfig } from './runtime/azure-openai-provider';

const azureConfig = getAzureOpenAIConfig();
const streamingCaller = createLLMStreamingCaller({
  provider: 'azure-openai',
  azureConfig,
});

// Stream response chunks (includes reasoning for Azure OpenAI)
for await (const chunk of streamingCaller(request, model, azureConfig, signal)) {
  console.log('Text:', chunk.text);
  if (chunk.reasoning) {
    console.log('Reasoning:', chunk.reasoning);
  }
}
```

## Error Handling

### Common Errors

**Authentication Error:**
```
Error: Anthropic API error (401): Invalid API key
```
**Solution:** Check that your API key is correct and active.

**Rate Limit Error:**
```
Error: Anthropic API error (429): Rate limit exceeded
```
**Solution:** Wait and retry, or upgrade your API plan.

**Context Window Error:**
```
Error: Context window exceeded: 250000 tokens > 200000 limit
```
**Solution:** Reduce conversation history or use a model with larger context window.

### Automatic Fallback

The RuntimeExecutor automatically handles errors and falls back to alternative providers:

```typescript
const executor = new RuntimeExecutor({
  authManager,
  llmCaller,
  llmStreamingCaller,
  trackAttempts: true,
});

try {
  // Automatically tries fallback providers on error
  const response = await executor.execute(request);
} catch (error) {
  if (error instanceof FallbackExhaustedError) {
    console.error('All providers failed:', error.attempts);
  }
}
```

## Testing Without API Keys

For development and testing without API costs:

```bash
# Don't set any API keys in .env
# System will automatically use mock provider

# Start server
npm run dev:api

# Test chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Response will use mock provider
{
  "conversationId": "conv_123_abc",
  "messageId": "msg_123_def",
  "content": "I am Prometheus, a meta-agent system...",
  "role": "assistant",
  "timestamp": 1234567890000
}
```

## Cost Optimization

### Tips for Reducing Costs

1. **Use Haiku for Simple Tasks**
   ```typescript
   model = { provider: 'anthropic', model: 'claude-haiku-4' };
   ```

2. **Limit Context Window**
   ```typescript
   const history = await memoryEngine.getConversationHistory(convId, 5); // Only last 5 messages
   ```

3. **Use Mock Provider for Testing**
   ```typescript
   if (process.env.NODE_ENV === 'test') {
     provider = 'mock';
   }
   ```

4. **Cache Responses**
   - Conversation history is automatically cached in SQLite
   - JSONL files serve as backup

## Monitoring

### Track API Usage

```typescript
// Response includes token usage
const response = await executor.execute(request);
console.log('Tokens used:', response.tokensUsed);
console.log('Latency:', response.latency, 'ms');
```

### Log Provider Attempts

```typescript
const executor = new RuntimeExecutor({
  authManager,
  llmCaller,
  trackAttempts: true, // Enable attempt tracking
});

// Access attempts after execution
if (error instanceof FallbackExhaustedError) {
  console.log('Attempts:', error.attempts);
}
```

## Security Best Practices

1. **Never Commit API Keys**
   - Add `.env` to `.gitignore`
   - Use `.env.example` for documentation

2. **Rotate Keys Regularly**
   - Generate new keys periodically
   - Revoke old keys

3. **Use Environment Variables**
   - Never hardcode API keys
   - Use process.env for all secrets

4. **Limit Key Permissions**
   - Use read-only keys when possible
   - Set spending limits

## Troubleshooting

### Provider Not Working

1. Check API key is set:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```

2. Verify key format:
   - Anthropic: `sk-ant-api03-...`
   - OpenAI: `sk-...`

3. Test API key directly:
   ```bash
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-sonnet-4","messages":[{"role":"user","content":"Hello"}],"max_tokens":100}'
   ```

### Slow Responses

1. Check network latency
2. Use faster models (Haiku, GPT-4o-mini)
3. Reduce context size
4. Enable streaming for better UX

### High Costs

1. Monitor token usage
2. Use cheaper models for simple tasks
3. Implement caching
4. Set max_tokens limits

## Next Steps

- [Chat API Documentation](./CHAT_IMPLEMENTATION_COMPLETE.md)
- [Runtime Executor Guide](./src/runtime/README.md)
- [Memory System Guide](./src/memory/README.md)
