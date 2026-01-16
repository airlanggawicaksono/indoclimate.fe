// =============================
// services/SessionStorage.ts
// =============================
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

/**
 * Interface for session metadata
 */
export interface SessionMetadata {
  userId?: string;
  createdAt: Date;
  lastActive: Date;
  userAgent?: string | null;
  ipAddress?: string;
  sessionType: 'general' | 'rag';
  metadata?: Record<string, any>; // Additional custom metadata
}

/**
 * Interface for a complete session
 */
export interface Session {
  id: string;
  messages: BaseMessage[];
  metadata: SessionMetadata;
}

/**
 * Interface for client connection fingerprint
 */
export interface ClientConnectionFingerprint {
  ipHash: string;
  userAgentHash: string;
  fingerprint: string; // Combined hash of IP and user agent
  firstSeen: Date;
  lastSeen: Date;
  sessionIds: string[];
}

/**
 * Interface for user session tracking
 */
export interface UserSessionData {
  userId: string;
  sessionIds: string[];
  createdAt: Date;
  lastActive: Date;
}

/**
 * Persistent Session Storage
 * Manages chat sessions with metadata support and user session tracking
 */
class SessionStorage {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, UserSessionData> = new Map();
  private clientConnections: Map<string, ClientConnectionFingerprint> = new Map(); // Map fingerprint to connection data
  private readonly maxMessages: number;

  constructor(maxMessages: number = 4) {
    this.maxMessages = maxMessages;
  }

  /**
   * Create a new session with optional user association
   */
  createSession(
    sessionId: string,
    userId?: string,
    additionalMetadata?: Record<string, any>
  ): Session {
    const session: Session = {
      id: sessionId,
      messages: [],
      metadata: {
        userId,
        createdAt: new Date(),
        lastActive: new Date(),
        sessionType: 'general',
        metadata: additionalMetadata || {},
      },
    };

    this.sessions.set(sessionId, session);
    
    // Associate session with user if userId is provided
    if (userId) {
      this.associateSessionWithUser(sessionId, userId);
    }
    
    return session;
  }

  /**
   * Create or get client connection fingerprint
   */
  getOrCreateClientConnection(ipAddress: string, userAgent: string | null | undefined): ClientConnectionFingerprint {
    const ipHash = this.createSimpleHash(ipAddress || 'unknown');
    const uaHash = this.createSimpleHash(userAgent || 'unknown');
    const fingerprint = `${ipHash}_${uaHash}`;
    
    if (!this.clientConnections.has(fingerprint)) {
      this.clientConnections.set(fingerprint, {
        ipHash,
        userAgentHash: uaHash,
        fingerprint,
        firstSeen: new Date(),
        lastSeen: new Date(),
        sessionIds: [],
      });
    }
    
    const connection = this.clientConnections.get(fingerprint)!;
    connection.lastSeen = new Date();
    return connection;
  }

  /**
   * Associate a session with a client connection
   */
  associateSessionWithClientConnection(sessionId: string, ipAddress: string, userAgent: string | null | undefined): void {
    const connection = this.getOrCreateClientConnection(ipAddress, userAgent);
    
    if (!connection.sessionIds.includes(sessionId)) {
      connection.sessionIds.push(sessionId);
    }
  }

  /**
   * Get all sessions for a client connection
   */
  getClientConnectionSessions(ipAddress: string, userAgent: string | null | undefined): Session[] {
    const ipHash = this.createSimpleHash(ipAddress || 'unknown');
    const uaHash = this.createSimpleHash(userAgent || 'unknown');
    const fingerprint = `${ipHash}_${uaHash}`;
    
    const connection = this.clientConnections.get(fingerprint);
    if (!connection) return [];
    
    return connection.sessionIds
      .map(sessionId => this.getSession(sessionId))
      .filter((session): session is Session => session !== null);
  }

  /**
   * Create simple hash from string
   */
  private createSimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36); // Convert to base36 string
  }

  /**
   * Associate a session with a user
   */
  private associateSessionWithUser(sessionId: string, userId: string): void {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        userId,
        sessionIds: [],
        createdAt: new Date(),
        lastActive: new Date(),
      });
    }
    
    const userData = this.userSessions.get(userId)!;
    if (!userData.sessionIds.includes(sessionId)) {
      userData.sessionIds.push(sessionId);
    }
    userData.lastActive = new Date();
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): Session[] {
    const userData = this.userSessions.get(userId);
    if (!userData) return [];
    
    return userData.sessionIds
      .map(sessionId => this.getSession(sessionId))
      .filter((session): session is Session => session !== null);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Save or update a session
   */
  saveSession(session: Session): void {
    session.metadata.lastActive = new Date();
    this.sessions.set(session.id, session);
    
    // Update user session data if this session has a userId
    if (session.metadata.userId) {
      this.associateSessionWithUser(session.id, session.metadata.userId);
    }
  }

  /**
   * Extract query from RAG context markers ${...}$
   * This keeps history clean by removing Indonesian RAG context
   */
  private extractQueryFromMessage(content: string): string {
    // Look for the pattern ${...}$ (query wrapped with $)
    // Example: "___begin_context___\n...\n___end_context___\n...\nquestion:\n${What is climate change?}$"
    const pattern = /\$([^$]+)\$/;
    const match = content.match(pattern);

    if (match) {
      // Return just the query part extracted from ${...}$
      return match[1].trim();
    }

    // If the pattern isn't found, return the original content
    return content;
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: BaseMessage): void {
    let session = this.getSession(sessionId);

    if (!session) {
      session = this.createSession(sessionId);
    }

    // Clean HumanMessages to extract only the query (removes RAG context)
    let cleanedMessage = message;
    if (message instanceof HumanMessage) {
      const cleanedContent = this.extractQueryFromMessage(message.content.toString());
      cleanedMessage = new HumanMessage(cleanedContent);
    }

    // Add the cleaned message
    session.messages.push(cleanedMessage);

    // Trim history to maintain maxPairs (2 pairs = 4 messages max)
    this.trimHistory(session);

    this.saveSession(session);
  }

  /**
   * Get messages for a session
   */
  getMessages(sessionId: string): BaseMessage[] {
    const session = this.getSession(sessionId);
    return session ? [...session.messages] : [];
  }

  /**
   * Get session metadata
   */
  getMetadata(sessionId: string): SessionMetadata | null {
    const session = this.getSession(sessionId);
    return session ? { ...session.metadata } : null;
  }

  /**
   * Update session metadata
   */
  updateMetadata(sessionId: string, metadata: Partial<SessionMetadata>): void {
    const session = this.getSession(sessionId);
    
    if (session) {
      session.metadata = {
        ...session.metadata,
        ...metadata,
        lastActive: new Date(), // Always update lastActive when metadata is updated
      };
      this.saveSession(session);
      
      // If IP address and user agent are provided, associate with client connection
      if (metadata.ipAddress || metadata.userAgent) {
        this.associateSessionWithClientConnection(
          sessionId, 
          metadata.ipAddress || session.metadata.ipAddress || 'unknown', 
          metadata.userAgent || session.metadata.userAgent
        );
      }
    }
  }

  /**
   * Trim history to maintain sliding window of maxMessages
   * Each message (user or AI) counts individually, not as pairs
   */
  private trimHistory(session: Session): void {
    if (session.messages.length > this.maxMessages) {
      // Keep only the last maxMessages (sliding window)
      session.messages = session.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Clear only the messages from a session (keep the session metadata)
   */
  clearSessionMessages(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.messages = [];
      this.saveSession(session);
    }
  }

  /**
   * Clear messages from all sessions matching a pattern (e.g., "wablass_")
   */
  clearSessionMessagesByPattern(pattern: string): number {
    let clearedCount = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (sessionId.startsWith(pattern)) {
        session.messages = [];
        this.saveSession(session);
        clearedCount++;
      }
    }
    return clearedCount;
  }

  /**
   * Clear sessions that have been inactive for longer than the specified milliseconds
   * @param inactiveThresholdMs - Time in milliseconds (default: 20000 = 20 seconds)
   * @returns Number of sessions cleared
   */
  clearInactiveSessions(inactiveThresholdMs: number = 20000): number {
    const now = new Date();
    let clearedCount = 0;

    for (const [_, session] of this.sessions.entries()) {
      const lastActiveTime = session.metadata.lastActive.getTime();
      const inactiveTime = now.getTime() - lastActiveTime;

      // If session has been inactive longer than threshold, clear its messages
      if (inactiveTime > inactiveThresholdMs) {
        session.messages = [];
        this.saveSession(session);
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Clear a session
   */
  clearSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session?.metadata.userId) {
      // Remove session from user's session list
      const userData = this.userSessions.get(session.metadata.userId);
      if (userData) {
        userData.sessionIds = userData.sessionIds.filter(id => id !== sessionId);
        if (userData.sessionIds.length === 0) {
          this.userSessions.delete(session.metadata.userId);
        }
      }
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    this.sessions.clear();
    this.userSessions.clear();
  }

  /**
   * Get all session IDs
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

// Export singleton instance with sliding window of 4 individual messages
export const sessionStorage = new SessionStorage(4);