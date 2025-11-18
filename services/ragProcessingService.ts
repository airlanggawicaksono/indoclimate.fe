// =============================
// services/ragProcessingService.ts
// =============================
import { chromaService } from "./chromaService";
import { chatService } from "./chatService";
import { ChromaMetadata } from "@/types/chroma";

/**
 * Merged chunk result
 */
interface MergedChunk {
  content: string;
  metadata: ChromaMetadata;
  docNum: number;
  similarity: number;
}

/**
 * Agent evaluation result
 */
interface AgentEvaluation {
  rationale: string;
  ids: number[];
}

/**
 * RAG Processing Service
 * Handles advanced chunk expansion, overlap detection, and document merging
 */
class RAGProcessingService {
  private readonly defaultTopK: number;

  constructor() {
    // Read configuration from environment variables
    this.defaultTopK = parseInt(process.env.RAG_TOP_K || "5", 10);
  }

  /**
   * Find longest overlapping text between end of text1 and start of text2
   * Always finds ANY overlap, no minimum threshold
   */
  private findOverlap(text1: string, text2: string): number {
    // Normalize: trim whitespace
    const text1Trimmed = text1.trim();
    const text2Trimmed = text2.trim();

    const maxPossibleOverlap = Math.min(text1Trimmed.length, text2Trimmed.length);

    // Search from longest to shortest overlap
    for (let len = maxPossibleOverlap; len >= 1; len--) {
      const suffix = text1Trimmed.slice(-len);
      const prefix = text2Trimmed.slice(0, len);

      // Case-insensitive comparison
      if (suffix.toLowerCase() === prefix.toLowerCase()) {
        return len; // Return overlap length
      }
    }

    return 0; // No overlap found
  }

  /**
   * Merge two text chunks by removing overlap
   * ALWAYS merges with whatever overlap is found
   */
  private mergeChunks(chunk1: string, chunk2: string): string {
    const overlapLength = this.findOverlap(chunk1, chunk2);

    if (overlapLength > 0) {
      // Remove overlap from chunk1, then append chunk2
      const chunk1Trimmed = chunk1.trim();
      const chunk1WithoutOverlap = chunk1Trimmed.slice(0, -overlapLength);
      return chunk1WithoutOverlap + chunk2;
    }

    // No overlap found, just concatenate with space
    return `${chunk1.trim()} ${chunk2}`;
  }

  /**
   * Get adjacent chunk by document_code and chunk number
   */
  private async getAdjacentChunk(
    documentCode: string,
    chunkNumber: number
  ): Promise<{ content: string; metadata: ChromaMetadata } | null> {
    try {
      // Query by ID format: {document_code}_{chunk_number}
      const targetId = `${documentCode}_${chunkNumber}`;
      return await chromaService.getById(targetId);
    } catch (error) {
      console.error(`Failed to get chunk ${documentCode}_${chunkNumber}:`, error);
      return null;
    }
  }

  /**
   * Expand chunk with n+1 adjacent chunk and merge with overlap detection
   */
  private async expandChunk(
    content: string,
    metadata: ChromaMetadata
  ): Promise<string> {
    const { document_code, current_chunk, total_chunks } = metadata;

    // If this is the last chunk, no expansion needed
    if (current_chunk >= total_chunks - 1) {
      return content;
    }

    // Get next chunk (n+1)
    const nextChunk = await this.getAdjacentChunk(
      document_code,
      current_chunk + 1
    );

    if (!nextChunk) {
      return content;
    }

    // Merge with overlap detection
    return this.mergeChunks(content, nextChunk.content);
  }

  /**
   * Format document for LLM with [docnum] structure
   */
  private formatDocument(
    chunk: MergedChunk,
    docNum: number
  ): string {
    const meta = chunk.metadata;
    return `[${docNum}]
Jenis: ${meta.jenis}
Nomor: ${meta.nomor}
Tahun: ${meta.tahun}
Tentang: ${meta.tentang}

${chunk.content}

---`;
  }

  /**
   * Agent evaluation: Check relevance of each chunk
   * Returns IDs of relevant documents
   */
  private async evaluateChunks(
    formattedChunks: string,
    expandedQuery: string
  ): Promise<AgentEvaluation> {
    const prompt = `Tugas: Evaluasi relevansi setiap dokumen terhadap pertanyaan pengguna.

Pertanyaan: ${expandedQuery}

Dokumen yang tersedia:
${formattedChunks}

Instruksi:
1. Analisis setiap dokumen [1], [2], [3], dst.
2. Tentukan dokumen mana yang relevan untuk menjawab pertanyaan
3. Pertanyaan boleh dijawab sebagian (partial answer) jika tidak ada dokumen yang sepenuhnya menjawab
4. Berikan penjelasan detail mengapa dokumen dipilih atau tidak
5. Output HARUS JSON valid dengan format:

{
  "rationale": "penjelasan detail dokumen mana yang relevan dan mengapa",
  "ids": [1, 3, 5]
}

PENTING: Output harus JSON valid tanpa markdown/backticks.`;

    try {
      const response = await chatService.agentChat(prompt);

      // Remove markdown code blocks if present
      const jsonString = response
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(jsonString);

      return {
        rationale: parsed.rationale || "",
        ids: Array.isArray(parsed.ids) ? parsed.ids : [],
      };
    } catch (error) {
      console.error("Agent evaluation error:", error);
      // Default: return all document IDs on error
      const totalDocs = (formattedChunks.match(/\[(\d+)\]/g) || []).length;
      return {
        rationale: "Error in evaluation, returning all documents.",
        ids: Array.from({ length: totalDocs }, (_, i) => i + 1),
      };
    }
  }

  /**
   * Main RAG processing pipeline
   * 1. Query ChromaDB with rag_optimized_query
   * 2. Expand each chunk with n+1 and merge overlaps
   * 3. Format with [docnum] structure
   * 4. Agent evaluates relevance and selects IDs (using expandedQuery in Indonesian)
   * 5. Filter chunks by selected IDs
   * 6. Create final context with ___begin_context__ wrapper (using fixedGrammar in user's language)
   * 7. Return context + metadata with view_links for pills
   */
  async processRAGQuery(
    ragOptimizedQuery: string,
    expandedQuery: string,
    fixedGrammar: string,
    k?: number
  ): Promise<{
    contextPrompt: string;
    rationale: string;
    sources: Array<{
      jenis: string;
      nomor: number;
      tahun: number;
      view_link?: string;
    }>;
  }> {
    // Use provided k or default from environment
    const topK = k ?? this.defaultTopK;

    // Step 1: Query ChromaDB
    const results = await chromaService.query(ragOptimizedQuery, topK);

    const documents = results.documents[0]?.filter((doc) => doc !== null) || [];
    const metadatas =
      results.metadatas[0]?.filter((meta) => meta !== null) || [];
    const distances = results.distances[0]?.filter((d) => d !== null) || [];

    if (documents.length === 0) {
      // Detect language from fixedGrammar to show appropriate message
      const isEnglish = /^[a-zA-Z\s\?\!\.,;:'"0-9\-]+$/.test(fixedGrammar.trim().slice(0, 100));
      const noDocsMessage = isEnglish
        ? "No documents found."
        : "Tidak ada dokumen yang ditemukan.";

      return {
        contextPrompt: `___begin_context___
${noDocsMessage}
___end_context___

IMPORTANT INSTRUCTION / INSTRUKSI PENTING:
Answer in the SAME LANGUAGE as the question below. If the question is in English, respond in English. If the question is in Indonesian, respond in Indonesian.
Jawab dalam BAHASA YANG SAMA dengan pertanyaan di bawah. Jika pertanyaan dalam Bahasa Inggris, jawab dalam Bahasa Inggris. Jika pertanyaan dalam Bahasa Indonesia, jawab dalam Bahasa Indonesia.
question/pertanyaan:
$${fixedGrammar}$`,
        rationale: "No documents found",
        sources: [],
      };
    }

    // Step 2: Expand chunks and merge overlaps
    const mergedChunks: MergedChunk[] = [];

    for (let i = 0; i < documents.length; i++) {
      const content = documents[i];
      const metadata = metadatas[i];
      const similarity = distances[i] ? 1 - distances[i] : 0;

      if (!content || !metadata) continue;

      // Expand chunk with n+1 and merge overlaps
      const expandedContent = await this.expandChunk(content, metadata);

      // Use original metadata since merged chunks are from same document
      mergedChunks.push({
        content: expandedContent,
        metadata, // First chunk's metadata (n and n+1 are same document)
        docNum: i + 1,
        similarity,
      });
    }

    // Step 3: Sort by similarity (highest first)
    mergedChunks.sort((a, b) => b.similarity - a.similarity);

    // Step 4: Format documents with [docnum] structure
    const allFormattedDocs = mergedChunks
      .map((chunk, idx) => this.formatDocument(chunk, idx + 1))
      .join("\n");

    // Step 5: Agent evaluation - select relevant document IDs
    const evaluation = await this.evaluateChunks(
      allFormattedDocs,
      expandedQuery
    );

    // Step 6: Filter chunks by selected IDs
    const selectedChunks = mergedChunks.filter((chunk) =>
      evaluation.ids.includes(chunk.docNum)
    );

    if (selectedChunks.length === 0) {
      // Fallback: use all chunks if agent returned no IDs
      selectedChunks.push(...mergedChunks);
    }

    // Step 7: Create final formatted context
    const finalContext = selectedChunks
      .map((chunk) => {
        const docNum = evaluation.ids.indexOf(chunk.docNum) + 1;
        return this.formatDocument(chunk, docNum);
      })
      .join("\n");

    // Step 8: Wrap in context markers with fixed_grammar (user's language)
    // Note: Wrapping query in ${...}$ markers allows history cleaning to extract only the query
    const contextPrompt = `___begin_context___
${finalContext}
___end_context___

IMPORTANT INSTRUCTION / INSTRUKSI PENTING:
Answer in the SAME LANGUAGE as the question below. If the question is in English, respond in English. If the question is in Indonesian, respond in Indonesian.
Jawab dalam BAHASA YANG SAMA dengan pertanyaan di bawah. Jika pertanyaan dalam Bahasa Inggris, jawab dalam Bahasa Inggris. Jika pertanyaan dalam Bahasa Indonesia, jawab dalam Bahasa Indonesia.
question/pertanyaan:
$${fixedGrammar}$`;

    // Step 9: Extract metadata for pills [jenis, nomor, tahun]{view_link}
    const sources = selectedChunks.map((chunk) => ({
      jenis: chunk.metadata.jenis,
      nomor: chunk.metadata.nomor,
      tahun: chunk.metadata.tahun,
      view_link: chunk.metadata.view_link,
    }));

    return {
      contextPrompt,
      rationale: evaluation.rationale,
      sources,
    };
  }
}

// Export singleton instance
export const ragProcessingService = new RAGProcessingService();
