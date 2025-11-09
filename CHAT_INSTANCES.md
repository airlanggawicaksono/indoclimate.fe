# Chat Instances Documentation

## Overview

The chat service provides **three specialized AI instances** working together:

1. **Routing Agent** - Classifies queries (RAG vs general chat)
2. **General Chat** - Handles conversations, greetings, clarifications
3. **Agent Chat** - Processes RAG queries with document context

Additionally, the system implements **chat history with N=2 sliding window**, maintaining only the last 2 message pairs (4 messages total) to optimize token usage while preserving recent context.

---

## 0. Routing Agent (NEW!)

**Purpose**: Intelligent query classification to route to the correct handler

**Configuration:**
- **Model**: `gpt-4.1-nano-2025-04-14`
- **Temperature**: `0` (deterministic classification)
- **Max Tokens**: `500`
- **Streaming**: Disabled
- **Output**: JSON with routing decision

**How it works:**
```
User: "berapa denda buang sampah?"
↓
Routing Agent analyzes
↓
Returns: {
  "action": "rag",
  "expanded_query": "Berapa denda untuk pembuangan sampah sembarangan di Indonesia serta dasar hukumnya?",
  "rag_optimized_query": "denda sampah sembarangan Indonesia pasal"
}
↓
Routes to RAG pipeline
```

**Classification Rules:**
- `"rag"` → Questions about regulations, laws, penalties, procedures, specific articles
- `"no_rag"` → Greetings, general questions, vague questions needing clarification

---

## 1. General Chat Instance

**Purpose**: Normal conversational chat with users

**Configuration:**
- **Model**: `gpt-4o-mini`
- **Temperature**: `0.3` (consistent but still conversational)
- **Max Tokens**: `2000`
- **Streaming**: Enabled
- **Language**: Bahasa Indonesia

**Usage:**
```typescript
import { chatService } from "@/services/chatService";

// Streaming
await chatService.generalChat(
  "Apa itu perubahan iklim?",
  (chunk) => console.log(chunk) // Stream callback
);

// Non-streaming
const response = await chatService.generalChat("Apa itu perubahan iklim?");
```

**API Endpoint:** `POST /api/chat`
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Apa itu perubahan iklim?"}'
```

---

## 2. Agent Chat Instance

**Purpose**: Document processing, RAG (Retrieval-Augmented Generation), and deterministic responses

**Configuration:**
- **Model**: `gpt-4.1-mini-2025-04-14`
- **Temperature**: `0` (fully deterministic)
- **Max Tokens**: `4000`
- **Streaming**: Enabled
- **Language**: English system prompt, flexible responses

**Usage:**
```typescript
import { chatService } from "@/services/chatService";

// With context (for RAG)
await chatService.agentChat(
  "What are the key points about climate laws?",
  contextFromChromaDB, // Optional context
  (chunk) => console.log(chunk)
);

// Without context
await chatService.agentChat("Summarize this document");
```

**API Endpoint:** `POST /api/rag`
```bash
curl -X POST http://localhost:3000/api/rag \
  -H "Content-Type: application/json" \
  -d '{"message": "peraturan tentang emisi karbon"}'
```

---

## Comparison Table

| Feature | Routing Agent | General Chat | Agent Chat |
|---------|--------------|-------------|-----------|
| Model | gpt-4.1-nano-2025-04-14 | gpt-4o-mini | gpt-4.1-mini-2025-04-14 |
| Temperature | 0 | 0.3 | 0 |
| Max Tokens | 500 | 2000 | 4000 |
| Use Case | Query classification | Conversations, clarifications | RAG, document analysis |
| Response Style | JSON only | Conversational | Deterministic, factual |
| Streaming | No | Yes | No |
| Endpoint | Internal (chatService.routeQuery) | `/api/chat` (auto-routed) | `/api/chat` (auto-routed) |

---

## Intelligent Routing Flow

The system **automatically routes** queries through the routing agent:

```
User sends message
        ↓
    Routing Agent
    (gpt-4.1-nano)
        ↓
   ┌────────────┐
   │  Decision  │
   └────────────┘
        ↓
   ┌─────┴─────┐
   ↓           ↓
"no_rag"     "rag"
   ↓           ↓
General     ChromaDB Query
Chat            ↓
(streaming)  Agent Chat
             (non-streaming)
             + sources
```

### Routing Examples:

**Example 1: RAG Query**
```
User: "berapa denda buang sampah sembarangan?"
↓ Routing Agent classifies as "rag"
↓ ChromaDB searches: "denda sampah sembarangan Indonesia pasal"
↓ Agent Chat processes with context
→ Returns factual answer with sources
```

**Example 2: General Chat**
```
User: "halo, apa kabar?"
↓ Routing Agent classifies as "no_rag"
↓ General Chat handles
→ Streams conversational response
```

**Example 3: Clarification Needed**
```
User: "pasal 7 itu apa?"
↓ Routing Agent classifies as "no_rag" (too vague)
↓ General Chat handles
→ Asks: "Maaf, bisa Anda sebutkan Perda/Pergub/UU yang dimaksud?"
```

---

## System Prompt Persistence

**Critical Design Feature**: System prompts are **always prepended** to messages and **never stored in chat history**.

```typescript
// Message structure
const messages = [
  new SystemMessage(systemPrompt),  // ← ALWAYS present, never in history
  ...history.getMessages(),          // ← Only last 2 pairs (4 messages)
  new HumanMessage(currentMessage)   // ← Current query
];
```

This ensures:
- ✅ System instructions persist across all conversations
- ✅ History only stores user/AI messages (saves tokens)
- ✅ Clarification behavior always available
- ✅ Consistent AI personality

---

## Chat History (N=2 Sliding Window)

### How it works:

The system maintains **only the last 2 message pairs** (1 pair = 1 human message + 1 AI response):

```
Message 1 (Human)  ──┐
Message 2 (AI)     ──┤ Pair 1 ✅ Kept
Message 3 (Human)  ──┤
Message 4 (AI)     ──┘ Pair 2 ✅ Kept
Message 5 (Human)  ──┐
Message 6 (AI)     ──┘ Pair 3 ✅ Kept → Message 1-2 deleted!
```

### Benefits:
- **Reduced tokens**: Only sends last 4 messages to LLM
- **Cost effective**: Lower API costs
- **Recent context**: Keeps conversation flow
- **Memory efficient**: Prevents history bloat

### API Endpoints:

**Get History:**
```bash
GET /api/chat/history?sessionId=session-123
```

**Clear History:**
```bash
POST /api/chat/clear
Body: { "sessionId": "session-123" }
```

### Session Management:

Each chat session has a unique ID:
- Frontend generates: `session-${Date.now()}`
- History is stored per session
- Reset button clears both UI and server history

### Implementation:

```typescript
import { chatHistoryStore } from "@/services/chatHistoryService";

// Get/create history for a session (N=2 pairs max)
const history = chatHistoryStore.getHistory(sessionId, 2);

// Add messages
history.addHumanMessage("Hello");
history.addAIMessage("Hi there!");

// Get all messages
const messages = history.getMessages(); // Max 4 messages

// Clear history
history.clear();
```
