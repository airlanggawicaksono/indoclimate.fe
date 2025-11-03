/**
 * Input type for chatbot messages
 */
export interface InputMessage {
  content: string;
  timestamp?: Date;
}

/**
 * Query input for Chroma vector database
 */
export interface ChromaQueryInput {
  query: string;
  n_results?: number;
  where?: Record<string, any>;
  where_document?: Record<string, any>;
}
