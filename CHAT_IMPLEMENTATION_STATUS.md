# Prometheus Chat System Implementation Status

## Overview

This document tracks the implementation of the chat interface for Prometheus, following the OpenClaw conversation pattern with JSONL file storage and automatic indexing.

## Completed Work

### 1. Backend Conversation Storage ✅

**Files Modified:**
- `prometheus/src/memory/types.ts` - Added conversation types
- `prometheus/src/memory/database.ts` - Added conversations and conversation_messages tables
- `prometheus/src/memory/engine.ts` - Implemented conversation methods with JSONL support

**Implemented Methods:**
- `createConversation(title?)` - Create new conversation
- `storeMessage(conversationId, role, content, metadata?)` - Store message to JSONL + SQLite
- `getConversationHistory(conversationId, limit?)` - Get message history
- `searchConversations(query, options?)` - Search conversations
- `getAllConversations(limit?)` - List all conversations
- `updateConversationTitle(conversationId, title)` - Update title
- `deleteConversation(conversationId)` - Delete conversation + JSONL file

**Database Schema:**
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT
);

CREATE TABLE conversation_files (
  path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  mtime_ms REAL NOT NULL,
  size INTEGER NOT NULL,
  indexed_at INTEGER NOT NULL
);
```

### 2. JSONL File Storage (OpenClaw Pattern) ✅

**File Created:**
- `prometheus/src/memory/conversation-files.ts`

**Implemented Functions:**
- `appendMessageToFile()` - Write message to JSONL file
- `listConversationFiles()` - List all conversation JSONL files
- `buildConversationEntry()` - Parse JSONL file for indexing
- `readConversationFile()` - Read all messages from JSONL
- `deleteConversationFile()` - Delete JSONL file
- `extractMessageText()` - Extract text for indexing
- `getConversationsDir()` - Get conversations directory path

**JSONL Format:**
```jsonl
{"role":"user","content":"How can I improve auth?","timestamp":1234567890000}
{"role":"assistant","content":"I can help...","timestamp":1234567891000,"metadata":{"model":"claude-sonnet-4"}}
```

**Storage Location:**
```
data/
  prometheus.db          # SQLite database
  conversations/         # JSONL files
    conv_123_abc.jsonl
    conv_456_def.jsonl
```

### 3. Conversation Indexer (OpenClaw Pattern) ✅

**File Created:**
- `prometheus/src/memory/conversation-indexer.ts`

**Implemented Functions:**
- `indexConversationFiles()` - Index all JSONL files into SQLite
- `reindexConversation()` - Re-index specific conversation
- `getConversationIndexStatus()` - Get indexing status

**Features:**
- Hash-based change detection (only re-index modified files)
- Batch processing with transaction support
- Error handling and statistics tracking
- File metadata tracking (path, hash, mtime, size)

### 4. Chat API Endpoints ✅

**File Modified:**
- `prometheus/src/api/chat.ts`

**Implemented Endpoints:**
- `POST /api/chat` - Send message and get response
- `GET /api/chat/:conversationId` - Get conversation history
- `GET /api/chat/conversations` - List all conversations
- `DELETE /api/chat/:conversationId` - Delete conversation

**Integration:**
- ✅ RuntimeExecutor integrated for LLM calls
- ✅ Context building from conversation history
- ✅ Message storage with metadata (model, provider, usage)
- ✅ JSONL file writing on every message
- ✅ Currently using MockLLMProvider (ready for real provider)

### 5. Express Server Integration ✅

**File Modified:**
- `prometheus/src/index.ts`

**Routes Added:**
```typescript
app.post('/api/chat', handleChatRequest);
app.get('/api/chat/conversations', getAllConversations);
app.get('/api/chat/:conversationId', getConversationHistory);
app.delete('/api/chat/:conversationId', deleteConversation);
```

## Architecture Pattern (OpenClaw-Inspired)

Following OpenClaw's proven patterns:

### Storage Flow:
```
User Message
  ↓
1. Write to JSONL file (primary storage)
  ↓
2. Write to SQLite (indexed storage)
  ↓
3. File watcher detects change (future)
  ↓
4. Memory system re-indexes (future)
  ↓
5. Vector + FTS5 search available (future)
```

### Current Implementation:
```
✅ JSONL file storage
✅ SQLite indexed storage
✅ Hash-based change detection
✅ Manual indexing (indexConversationFiles)
❌ File watcher (not yet implemented)
❌ Automatic re-indexing (not yet implemented)
❌ Vector search (not yet implemented)
❌ FTS5 full-text search (not yet implemented)
```

## Next Steps

### Phase 1: Complete Backend Integration

1. **Replace MockLLMProvider with Real Provider**
   - Port ANOTS provider code or create adapter
   - Configure auth profiles for Anthropic/OpenAI
   - Set up fallback chains
   - Test with real API keys

2. **Add Streaming Support**
   - Implement SSE (Server-Sent Events) endpoint
   - Use RuntimeExecutor.executeStreaming()
   - Stream chunks to client in real-time
   - Handle abort/cancellation

3. **Implement JSONL Storage (OpenClaw Pattern)**
   - Create `data/conversations/` directory
   - Write messages to JSONL files as they're created
   - Add file watcher for automatic indexing
   - Integrate with memory system for vector search

4. **Add Context Enhancement**
   - Search codebase for relevant context
   - Include recent decisions in context
   - Add metrics and patterns to context
   - Implement context window management

### Phase 2: Frontend Chat UI

Two options for frontend:

#### Option A: Standalone Chat UI (Recommended for MVP)

Create a simple chat interface in Prometheus:

```
prometheus/
  app/
    chat/
      page.tsx          # Chat page
      components/
        ChatInterface.tsx
        MessageList.tsx
        MessageInput.tsx
        ConversationList.tsx
```

**Features:**
- Message list with user/assistant messages
- Input field with send button
- Conversation history sidebar
- New conversation button
- Markdown rendering for code blocks

#### Option B: Integrate with Admin Portal

Add chat to the Prometheus Admin Portal spec:

**New Components:**
- RightSidebar with chat interface (collapsible like Kiro/Cursor)
- ChatWidget for canvas
- Keyboard shortcut (⌘⇧B) to toggle chat

**Integration Points:**
- WebSocket for real-time updates
- Context from current workspace/repository
- Prometheus content attribution

### Phase 3: Advanced Features

1. **Vector Search for Conversations**
   - Index conversation messages with embeddings
   - Semantic search across conversation history
   - Find similar past conversations

2. **Multi-Modal Support**
   - Code snippet attachments
   - Diagram generation
   - File uploads

3. **Collaboration Features**
   - Shared conversations
   - @mentions for team members
   - Conversation branching

4. **Context Management**
   - Automatic context selection from codebase
   - Manual context pinning
   - Context window visualization

## Testing Strategy

### Unit Tests
- Test conversation CRUD operations
- Test message storage and retrieval
- Test API endpoints with mock data
- Test error handling

### Property-Based Tests
- **Property: Conversation Persistence** - Any conversation created and retrieved should have the same content
- **Property: Message Ordering** - Messages in a conversation should always be returned in chronological order
- **Property: Tenant Isolation** - Conversations from different tenants should never be accessible to each other

### Integration Tests
- Test full chat flow: create conversation → send message → get response → retrieve history
- Test streaming responses
- Test context building from history
- Test error recovery and retries

## Configuration

### Environment Variables

```bash
# LLM Provider Configuration
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Model Configuration
DEFAULT_MODEL_PROVIDER=anthropic
DEFAULT_MODEL=claude-sonnet-4

# Database Configuration
DATABASE_PATH=./data/prometheus.db

# Chat Configuration
MAX_CONVERSATION_HISTORY=10
CONTEXT_WINDOW_TOKENS=128000
ENABLE_STREAMING=true
```

### Config File

```typescript
// prometheus/src/config/chat.ts
export const chatConfig = {
  maxHistoryMessages: 10,
  contextWindowTokens: 128000,
  enableStreaming: true,
  systemPrompt: 'You are Prometheus, a meta-agent system...',
  fallbackChain: [
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'openai', model: 'gpt-4' },
  ],
};
```

## API Documentation

### POST /api/chat

Send a message and get a response.

**Request:**
```json
{
  "conversationId": "conv_1234567890_abc123",  // optional
  "message": "How can I improve the authentication module?",
  "stream": false  // optional, default false
}
```

**Response:**
```json
{
  "conversationId": "conv_1234567890_abc123",
  "messageId": "msg_1234567890_def456",
  "content": "I can help you improve the authentication module...",
  "role": "assistant",
  "timestamp": 1234567890000
}
```

### GET /api/chat/:conversationId

Get conversation history.

**Query Parameters:**
- `limit` (optional) - Maximum number of messages to return

**Response:**
```json
{
  "conversationId": "conv_1234567890_abc123",
  "messages": [
    {
      "id": "msg_1234567890_abc123",
      "conversation_id": "conv_1234567890_abc123",
      "role": "user",
      "content": "How can I improve the authentication module?",
      "timestamp": 1234567890000,
      "metadata": null
    },
    {
      "id": "msg_1234567890_def456",
      "conversation_id": "conv_1234567890_abc123",
      "role": "assistant",
      "content": "I can help you improve the authentication module...",
      "timestamp": 1234567891000,
      "metadata": "{\"model\":\"claude-sonnet-4\",\"provider\":\"anthropic\"}"
    }
  ]
}
```

### GET /api/chat/conversations

List all conversations.

**Query Parameters:**
- `limit` (optional) - Maximum number of conversations to return

**Response:**
```json
{
  "conversations": [
    {
      "id": "conv_1234567890_abc123",
      "title": "Authentication Module Improvements",
      "created_at": 1234567890000,
      "updated_at": 1234567891000
    }
  ]
}
```

### DELETE /api/chat/:conversationId

Delete a conversation and all its messages.

**Response:**
```json
{
  "success": true,
  "conversationId": "conv_1234567890_abc123"
}
```

## Current Limitations

1. **No Real LLM Provider** - Currently using MockLLMProvider
2. **No Streaming** - Only supports non-streaming responses
3. **No JSONL Storage** - Only SQLite storage (no file-based backup)
4. **No Vector Search** - Simple text search only
5. **No Frontend UI** - Backend only
6. **No Context Enhancement** - Basic context from history only
7. **No Multi-Tenancy** - No tenant isolation yet

## References

- OpenClaw Memory System: `openclaw-learning/analysis/memory-system.md`
- OpenClaw Agent Runtime: `openclaw-learning/analysis/agent-runtime.md`
- Prometheus Memory Engine: `prometheus/src/memory/engine.ts`
- Prometheus Runtime Executor: `prometheus/src/runtime/runtime-executor.ts`
- Chat API Implementation: `prometheus/src/api/chat.ts`

## Decision Log

### Why OpenClaw Pattern?

The user explicitly requested to follow OpenClaw's proven architecture rather than creating a simpler custom solution:

> "Bence hazır inşa edilmiş mimari var, option 2 den gidelim derim. Amerikayı basit yaklaşım da olsa baştan keşfetmeye gerek yok."

Translation: "I think there's already a built architecture, let's go with option 2. No need to reinvent America even with a simple approach."

### Why SQLite First?

Following OpenClaw's pattern:
1. SQLite for primary storage (fast, reliable, single file)
2. JSONL for backup and portability (future)
3. Memory system for indexing and search (future)

This allows incremental implementation while maintaining compatibility with OpenClaw's architecture.

### Why MockLLMProvider?

To enable testing and development without requiring API keys. The RuntimeExecutor is fully integrated and ready to use real providers once configured.

## Conclusion

The chat backend is functionally complete and follows OpenClaw's proven patterns. The next critical step is to either:

1. **Add a simple frontend** to test the chat functionality end-to-end
2. **Integrate real LLM providers** to replace the mock
3. **Add streaming support** for better UX

The user should decide which direction to take based on their priorities.
