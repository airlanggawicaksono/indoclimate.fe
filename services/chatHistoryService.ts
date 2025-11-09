// =============================
// services/chatHistoryService.ts
// =============================
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

/**
 * Chat History Service with sliding window (N=2)
 * Maintains only the last N message pairs (human + AI)
 */
export class ChatHistoryService {
  private history: BaseMessage[] = [];
  private readonly maxPairs: number;

  constructor(maxPairs: number = 2) {
    this.maxPairs = maxPairs;
  }

  /**
   * Add a human message to history
   */
  addHumanMessage(content: string): void {
    this.history.push(new HumanMessage(content));
    this.trimHistory();
  }

  /**
   * Add an AI message to history
   */
  addAIMessage(content: string): void {
    this.history.push(new AIMessage(content));
    this.trimHistory();
  }

  /**
   * Get all messages in history
   */
  getMessages(): BaseMessage[] {
    return [...this.history];
  }

  /**
   * Get the last N message pairs
   * Each pair = 1 HumanMessage + 1 AIMessage
   */
  private trimHistory(): void {
    // Keep only last (maxPairs * 2) messages
    const maxMessages = this.maxPairs * 2;

    if (this.history.length > maxMessages) {
      // Remove oldest messages
      this.history = this.history.slice(-maxMessages);
    }
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Get history summary
   */
  getSummary(): { totalMessages: number; pairs: number } {
    return {
      totalMessages: this.history.length,
      pairs: Math.floor(this.history.length / 2),
    };
  }

  /**
   * Check if history is empty
   */
  isEmpty(): boolean {
    return this.history.length === 0;
  }
}

/**
 * In-memory session store for chat histories
 * Maps sessionId -> ChatHistoryService
 */
class ChatHistoryStore {
  private sessions: Map<string, ChatHistoryService> = new Map();

  /**
   * Get or create a chat history for a session
   */
  getHistory(sessionId: string, maxPairs: number = 2): ChatHistoryService {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new ChatHistoryService(maxPairs));
    }
    return this.sessions.get(sessionId)!;
  }

  /**
   * Clear a session's history
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    this.sessions.clear();
  }

  /**
   * Get active session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}

// Export singleton store
export const chatHistoryStore = new ChatHistoryStore();
