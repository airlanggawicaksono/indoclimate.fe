/**
 * Central export file for all types
 */

// Input types
export type { InputMessage, ChromaQueryInput } from './input';

// Output types
export type { OutputMessage, ChromaQueryOutput } from './output';

// Chroma types
export type {
  ChromaMetadata,
  ChromaContent,
  ChromaDocument,
  ChromaClientConfig,
} from './chroma';

// Message type for chat interface
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    sources?: string[];
    confidence?: number;
  };
}
