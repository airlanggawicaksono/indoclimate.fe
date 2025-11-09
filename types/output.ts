import { ChromaMetadata } from "./chroma";

/**
 * Predefined output JSON structure for chatbot responses
 */
export interface OutputMessage {
  response: string;
  sources?: string[];
  metadata?: {
    confidence?: number;
    model?: string;
    processingTime?: number;
  };
  timestamp: Date;
}

/**
 * Response from Chroma vector database query
 */
export interface ChromaQueryOutput {
  ids: string[][];
  distances?: number[][];
  metadatas?: ChromaMetadata[][];
  documents?: string[][];
  embeddings?: number[][][];
}
