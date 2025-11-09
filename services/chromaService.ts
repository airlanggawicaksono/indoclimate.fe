// =============================
// services/chromaService.ts
// =============================
import { ChromaClient } from "chromadb";
import { ChromaMetadata } from "@/types/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * ChromaDB Service Layer
 * Handles all interactions with ChromaDB vector database
 */
class ChromaService {
  private client: ChromaClient;
  private collectionName: string;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.collectionName =
      process.env.CHROMA_COLLECTION_NAME || "indoclimate_legal";

    // Initialize ChromaDB HTTP client with proper configuration
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || "http://localhost:2913",
    });

    // Initialize OpenAI embeddings (same model used during indexing)
    this.embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small",
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Query ChromaDB collection for similar documents
   */
  async query(
    queryText: string,
    nResults: number = 5
  ): Promise<{
    ids: string[][];
    distances: (number | null)[][];
    documents: (string | null)[][];
    metadatas: (ChromaMetadata | null)[][];
  }> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
      });

      // Generate embedding for query text using OpenAI
      const queryEmbedding = await this.embeddings.embedQuery(queryText);

      // Query with embeddings instead of raw text
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults,
      });

      return {
        ids: results.ids,
        distances: results.distances || [],
        documents: results.documents,
        metadatas: results.metadatas as (ChromaMetadata | null)[][],
      };
    } catch (error) {
      console.error("ChromaDB query error:", error);
      throw new Error("Failed to query ChromaDB");
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    documentCount: number;
    fragmentCount: number;
    newsCount: number;
    pageCount: number;
  }> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
      });
      const count = await collection.count();
      // TODO: Implement proper stats aggregation based on your metadata
      // For now, returning placeholder values
      return {
        documentCount: 1199,
        fragmentCount: count,
        newsCount: 10388,
        pageCount: 40834,
      };
    } catch (error) {
      console.error("ChromaDB stats error:", error);
      throw new Error("Failed to get ChromaDB stats");
    }
  }
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      console.error("ChromaDB health check failed:", error);
      return false;
    }
  }

  /**
   * Get document by ID
   */
  async getById(id: string): Promise<{
    content: string;
    metadata: ChromaMetadata;
  } | null> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
      });

      const result = await collection.get({
        ids: [id],
      });

      if (
        result.documents.length > 0 &&
        result.documents[0] &&
        result.metadatas[0]
      ) {
        return {
          content: result.documents[0],
          metadata: result.metadatas[0] as unknown as ChromaMetadata,
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to get document ${id}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const chromaService = new ChromaService();
