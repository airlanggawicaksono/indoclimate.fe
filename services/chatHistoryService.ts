// =============================
// services/chatHistoryService.ts
// =============================
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { sessionStorage, SessionMetadata, Session } from "./SessionStorage";

/**
 * Chat History Service with sliding window
 * Maintains only the last N individual messages (not pairs)
 * Example: maxMessages=4 keeps [msg1, msg2, msg3, msg4], when msg5 arrives: [msg2, msg3, msg4, msg5]
 */
export class ChatHistoryService {
  private readonly sessionId: string;
  private readonly maxMessages: number;

  constructor(sessionId: string, maxMessages: number = 4) {
    this.sessionId = sessionId;
    this.maxMessages = maxMessages;
  }

  /**
   * Add a human message to history
   */
  addHumanMessage(content: string): void {
    sessionStorage.addMessage(this.sessionId, new HumanMessage(content));
  }

  /**
   * Add an AI message to history
   */
  addAIMessage(content: string): void {
    sessionStorage.addMessage(this.sessionId, new AIMessage(content));
  }

  /**
   * Get all messages in history
   */
  getMessages(): BaseMessage[] {
    return sessionStorage.getMessages(this.sessionId);
  }

  /**
   * Clear all history
   */
  clear(): void {
    sessionStorage.clearSession(this.sessionId);
  }

  /**
   * Get history summary
   */
  getSummary(): { totalMessages: number; pairs: number } {
    const messages = this.getMessages();
    return {
      totalMessages: messages.length,
      pairs: Math.floor(messages.length / 2),
    };
  }

  /**
   * Check if history is empty
   */
  isEmpty(): boolean {
    return this.getMessages().length === 0;
  }
}

/**
 * Session store for chat histories with metadata support
 */
class ChatHistoryStore {
  /**
   * Get or create a chat history for a session
   * @param sessionId - Unique identifier for the session
   * @param maxMessages - Maximum number of individual messages to keep (default: 4)
   */
  getHistory(sessionId: string, maxMessages: number = 4): ChatHistoryService {
    return new ChatHistoryService(sessionId, maxMessages);
  }

  /**
   * Clear a session's history
   */
  clearSession(sessionId: string): void {
    sessionStorage.clearSession(sessionId);
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    sessionStorage.clearAll();
  }

  /**
   * Get active session count
   */
  getSessionCount(): number {
    return sessionStorage.getSessionCount();
  }

  /**
   * Get session metadata
   */
  getMetadata(sessionId: string): SessionMetadata | null {
    return sessionStorage.getMetadata(sessionId);
  }

  /**
   * Update session metadata
   */
  updateMetadata(sessionId: string, metadata: Partial<SessionMetadata>): void {
    sessionStorage.updateMetadata(sessionId, metadata);
  }

  /**
   * Create a new session with metadata
   */
  createSession(
    sessionId: string,
    userId?: string,
    additionalMetadata?: Record<string, any>
  ): void {
    sessionStorage.createSession(sessionId, userId, additionalMetadata);
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return sessionStorage.hasSession(sessionId);
  }

  /**
   * Get all sessions for a specific user
   */
  getUserSessions(userId: string): Session[] {
    return sessionStorage.getUserSessions(userId);
  }

  /**
   * Get all sessions for a client connection (based on IP and user agent)
   */
  getClientConnectionSessions(ipAddress: string, userAgent: string | null | undefined): Session[] {
    return sessionStorage.getClientConnectionSessions(ipAddress, userAgent);
  }
}

// Export singleton store
export const chatHistoryStore = new ChatHistoryStore();
