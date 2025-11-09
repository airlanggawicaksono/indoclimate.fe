# Intelligent Routing System

## Architecture Overview

The Indoclimate chatbot uses a **3-tier AI architecture** with intelligent routing:

```
┌─────────────────────────────────────────────────┐
│              User Query                         │
└─────────────────┬───────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────┐
│         🤖 Routing Agent                        │
│         gpt-4.1-nano-2025-04-14                 │
│         Temperature: 0                          │
│         Returns: {"action": "rag"|"no_rag"}     │
└─────────────────┬───────────────────────────────┘
                  ↓
        ┌─────────┴─────────┐
        ↓                   ↓
┌───────────────┐   ┌───────────────────────┐
│  "no_rag"     │   │  "rag"                │
└───────┬───────┘   └───────┬───────────────┘
        ↓                   ↓
┌───────────────┐   ┌───────────────────────┐
│ General Chat  │   │ ChromaDB Query        │
│ gpt-4o-mini   │   │        ↓              │
│ temp: 0.3     │   │ Agent Chat            │
│ STREAMING ✅  │   │ gpt-4.1-mini          │
│               │   │ temp: 0               │
│ - Greetings   │   │ NON-STREAMING         │
│ - Clarify     │   │ + Sources             │
└───────────────┘   └───────────────────────┘
```

## Key Features

### 1. **Persistent System Prompts**
System prompts are **never** stored in chat history:

```typescript
// Always structured this way:
[SystemMessage, ...history, HumanMessage]
```

Benefits:
- System instructions always present
- History only stores conversation (saves tokens)
- Clarification behavior persists

### 2. **Chat History (N=2)**
Only last 2 message pairs kept:

```
User: "Hello"
AI: "Hi!"          } Pair 1 ✅
User: "How are you?"
AI: "Good!"        } Pair 2 ✅
User: "What's up?"
AI: "Nothing"      } Pair 3 ✅ → Pair 1 DELETED
```

### 3. **Automatic Routing**
No manual endpoint selection needed:
- User sends to `/api/chat`
- Routing agent decides path
- Transparent to user

## Response Modes

### General Chat (Streaming)
```json
// SSE stream
data: {"content": "Halo", "done": false, "mode": "general"}
data: {"content": "!", "done": false, "mode": "general"}
data: {"content": "", "done": true}
```

### RAG Mode (Complete JSON)
```json
{
  "message": "Berdasarkan Perda...",
  "mode": "rag",
  "sources": [{
    "jenis": "Perda",
    "nomor": "123",
    "tahun": "2024",
    "tentang": "Sampah"
  }],
  "totalResults": 5
}
```

## Example Queries

| Query | Routing | Handler | Reason |
|-------|---------|---------|--------|
| "berapa denda sampah?" | rag | Agent + ChromaDB | Asks about regulation/penalty |
| "aturan emisi karbon di jakarta?" | rag | Agent + ChromaDB | Provincial regulation (Pergub/Perda) |
| "bagaimana prosedur izin lingkungan?" | rag | Agent + ChromaDB | Procedure/requirement question |
| "kebijakan energi terbarukan?" | rag | Agent + ChromaDB | National/regional policy |
| "halo apa kabar?" | no_rag | General Chat | Greeting |
| "pasal 7 itu apa?" | no_rag | General Chat | Too vague, needs clarification |
| "terima kasih" | no_rag | General Chat | Social response |

## Cost Optimization

| Component | Model | Cost Impact |
|-----------|-------|-------------|
| Routing | gpt-4.1-nano | ~$0.0001/query |
| General Chat | gpt-4o-mini | ~$0.001/query |
| RAG Agent | gpt-4.1-mini | ~$0.002/query |
| History (N=2) | All | -60% tokens saved |

**Total**: ~$0.003/query average (with routing overhead)

## Testing

Test the routing system:

```bash
# General chat test
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "halo", "sessionId": "test-1"}'

# RAG test
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "berapa denda sampah sembarangan?", "sessionId": "test-2"}'

# Clarification test
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "pasal 7 itu apa?", "sessionId": "test-3"}'
```

## Files Modified

- `services/chatService.ts` - Added routing agent + system prompts
- `app/api/chat/route.ts` - Intelligent routing logic
- `app/page.tsx` - Handle both streaming and non-streaming
- `types/routing.ts` - Routing response types

## Environment Variables

```env
OPENAI_API_KEY=sk-...
CHROMA_URL=http://localhost:2913
CHROMA_COLLECTION_NAME=indoclimate_legal
```
