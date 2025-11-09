/**
 * Metadata structure for documents stored in Chroma
 * Based on the indexer structure from 4.indexer.py
 */
export interface ChromaMetadata {
  id: string; // Format: "{document_code}_{index}"
  document_code: string;
  current_chunk: number;
  total_chunks: number;
  jenis: string; // Type of regulation
  nomor: number; // Regulation number
  tahun: number; // Year
  tentang: string; // About/subject
  tanggal_ditetapkan: string; // Date established
  tanggal_berlaku: string; // Effective date
  status: string; // Status of regulation
  dasar_hukum: string[]; // Legal basis (array of strings)
  view_link?: string; // Link to view the document
}

/**
 * Content type for Chroma vector database
 */
export interface ChromaContent {
  content: string;
  metadata: ChromaMetadata;
}

/**
 * Document structure for adding to Chroma
 */
export interface ChromaDocument {
  ids: string[];
  embeddings?: number[][];
  metadatas?: ChromaMetadata[];
  documents: string[];
}

/**
 * Chroma HTTP client configuration
 */
export interface ChromaClientConfig {
  path?: string;
  auth?: {
    provider?: string;
    credentials?: string;
  };
  tenant?: string;
  database?: string;
}
