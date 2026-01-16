// =============================
// types/chat.ts
// =============================

/**
 * Chat configuration options
 */
export interface ChatConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

/**
 * Chat request payload
 */
export interface ChatRequest {
  message: string;
  config?: ChatConfig;
}

/**
 * Chat response (non-streaming)
 */
export interface ChatResponse {
  message: string;
  model?: string;
  tokensUsed?: number;
}

/**
 * Streaming chunk response
 */
export interface ChatStreamChunk {
  content: string;
  done: boolean;
}
