# Advanced RAG Processing System

## Overview

The RAG processing system implements **chunk expansion with overlap detection and merging** to provide better context when retrieving documents from ChromaDB.

## Architecture

```
User Query
    ↓
Routing Agent (gpt-4.1-nano)
    ↓
"rag" action
    ↓
RAG Processing Pipeline
    ↓
┌─────────────────────────────────────────┐
│ 1. Query ChromaDB                       │
│    - Use rag_optimized_query            │
│    - Retrieve k=5 chunks                │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 2. Chunk Expansion (n+1)                │
│    - For each chunk, fetch next chunk   │
│    - ID format: {document_code}_{n+1}   │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 3. Overlap Detection & Merging          │
│    - Find longest common substring      │
│    - Merge chunks removing overlap      │
│    - Min overlap: 10 characters         │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ 4. Format with [docnum]                 │
│    - Sort by similarity                 │
│    - Format: [1], [2], [3]...           │
│    - Include metadata                   │
└────────────┬────────────────────────────┘
             ↓
Agent Chat (gpt-4.1-mini)
    ↓
Response with source citations
```

## Chunk Expansion Example

### Original Chunks in ChromaDB:

**Chunk 1 (ID: PERDA123_0)**:
```
Kota tata boga merupakan kota yang dibuat un
```

**Chunk 2 (ID: PERDA123_1)**:
```
buat untuk menjadikan kota dengan industri gandum
```

### Processing:

1. **Query ChromaDB**: Returns Chunk 1
2. **Expansion**: System fetches Chunk 2 (n+1)
3. **Overlap Detection**: Finds overlap `"dibuat un"` ≈ `"buat untuk"`
4. **Merging**: Produces:
   ```
   Kota tata boga merupakan kota yang dibuat untuk menjadikan kota dengan industri gandum
   ```

## Document Format

Documents are formatted with `[docnum]` structure for the agent:

```
[1]
Jenis: Perda
Nomor: 123
Tahun: 2024
Tentang: Pengelolaan Sampah

Kota tata boga merupakan kota yang dibuat untuk menjadikan kota dengan industri gandum...

---

[2]
Jenis: Pergub
Nomor: 456
Tahun: 2023
Tentang: Emisi Karbon

Berdasarkan peraturan yang berlaku, setiap industri wajib melaporkan...

---
```

## Metadata Structure

Each chunk has metadata from ChromaDB:

```typescript
{
  id: "PERDA123_0",           // {document_code}_{current_chunk}
  document_code: "PERDA123",
  current_chunk: 0,
  total_chunks: 5,
  jenis: "Perda",
  nomor: 123,
  tahun: 2024,
  tentang: "Pengelolaan Sampah",
  tanggal_ditetapkan: "2024-01-15",
  tanggal_berlaku: "2024-02-01",
  status: "Berlaku",
  dasar_hukum: ["UU 18/2008"]
}
```

## Overlap Detection Algorithm

The system uses **longest common substring** matching:

1. **Minimum overlap**: 10 characters
2. **Comparison**: Case-insensitive, trimmed
3. **Location**: End of chunk 1 vs. beginning of chunk 2
4. **Merge strategy**: Remove overlap from chunk 1, append chunk 2

### Example:

```typescript
chunk1: "...kota yang dibuat un"
chunk2: "buat untuk menjadikan..."

// Finds overlap: "dibuat un" ≈ "buat untuk"
// Result: "...kota yang dibuat untuk menjadikan..."
```

## Key Features

### 1. **Automatic Chunk Expansion**
- Fetches n+1 chunk for every retrieved chunk
- Handles edge cases (last chunk, missing chunks)
- Preserves metadata from original chunk

### 2. **Smart Overlap Merging**
- Detects overlapping text between chunks
- Removes duplicates during merge
- Maintains text coherence

### 3. **Document Ranking**
- Sorts by similarity score (1 - distance)
- Highest relevance first
- Consistent ordering for agent

### 4. **Source Citation**
- Documents numbered [1], [2], [3]...
- Agent trained to cite sources
- Metadata preserved for frontend display

## API Flow

### Request:
```json
{
  "message": "berapa denda buang sampah sembarangan?",
  "sessionId": "session-123"
}
```

### Internal Processing:

1. **Routing Agent** classifies as "rag"
2. **RAG Processing**:
   - Query: `"denda sampah sembarangan Indonesia pasal"`
   - Retrieve: 5 chunks
   - Expand: Each chunk → n+1
   - Merge: Detect overlaps
   - Format: [1], [2], [3], [4], [5]

3. **Agent Chat**:
   - Receives formatted context
   - Generates answer with citations
   - Example: "Berdasarkan dokumen [1] dan [2]..."

### Response:
```json
{
  "message": "Berdasarkan dokumen [1], denda untuk pembuangan sampah sembarangan adalah...",
  "mode": "rag",
  "sources": [
    {
      "documentCode": "PERDA123",
      "jenis": "Perda",
      "nomor": 123,
      "tahun": 2024,
      "tentang": "Pengelolaan Sampah"
    }
  ],
  "totalResults": 5
}
```

## Configuration

### Chunk Retrieval:
- **k**: 5 documents (configurable in `ragProcessingService.processRAGQuery`)
- **Min overlap**: 10 characters

### Error Handling:
- Missing n+1 chunk: Uses original chunk only
- No overlap found: Concatenates with space
- Empty results: Returns "Tidak ada dokumen yang ditemukan"

## Files

- `services/ragProcessingService.ts` - Core RAG processing logic
- `app/api/chat/route.ts` - RAG query handler
- `services/chatService.ts` - Agent system prompt with citation instructions
- `types/chroma.ts` - ChromaDB metadata types

## Testing

### Test RAG Query:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "berapa denda buang sampah sembarangan?",
    "sessionId": "test-rag"
  }'
```

### Expected Behavior:
1. Routing agent classifies as "rag"
2. Chunks expanded and merged
3. Agent responds with citations: "[1]", "[2]", etc.
4. Sources included in response

## Future Enhancements

### Planned:
- **LLM-based relevance ranking**: Use agent to re-rank documents by relevance
- **Configurable overlap threshold**: Allow users to set minimum overlap
- **Bidirectional expansion**: Fetch n-1 and n+1 chunks
- **Semantic overlap detection**: Use embeddings instead of string matching

### Possible:
- **Multi-hop retrieval**: Follow references between documents
- **Document summarization**: Compress long contexts
- **Query refinement**: Iterative query improvement based on results
