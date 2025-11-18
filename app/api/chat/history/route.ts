// =============================
// app/api/chat/history/route.ts
// =============================
import { NextRequest, NextResponse } from "next/server";
import { chatHistoryStore } from "@/services/chatHistoryService";
import { getClientIP } from "@/utils/requestUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/chat/history
 * Get chat history summary with multiple query options
 * 
 * Query parameters (choose one):
 * - sessionId: Get specific session (default: "default")
 * - userId: Get all sessions for a specific user
 * - clientConnection: Get all sessions for current client connection (based on IP and user agent)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId");
    const clientConnection = searchParams.get("clientConnection"); // If this parameter is present, get by client connection

    // If clientConnection is requested, return all sessions for this client connection (IP + user agent)
    if (clientConnection !== null) { // Use !== null instead of truthy to distinguish between param not present vs empty string
      const userAgent = request.headers.get("user-agent") || null;
      const clientIP = getClientIP(request);
      
      const connectionSessions = chatHistoryStore.getClientConnectionSessions(clientIP, userAgent);
      
      const connectionSessionData = connectionSessions.map(session => {
        const summary = {
          totalMessages: session.messages.length,
          pairs: Math.floor(session.messages.length / 2),
        };
        
        return {
          sessionId: session.id,
          metadata: session.metadata,
          summary,
          messages: session.messages.map((msg) => ({
            role: msg._getType(),
            content: msg.content.toString().slice(0, 100), // First 100 chars
          })).slice(-4), // Get last 4 messages (2 pairs)
        };
      });

      return NextResponse.json({
        success: true,
        clientConnection: true,
        ipAddress: clientIP,
        userAgent,
        sessions: connectionSessionData,
        totalSessions: connectionSessionData.length,
      });
    }
    
    // If userId is provided, return all sessions for that user
    if (userId) {
      const userSessions = chatHistoryStore.getUserSessions(userId);
      
      const userSessionData = userSessions.map(session => {
        const summary = {
          totalMessages: session.messages.length,
          pairs: Math.floor(session.messages.length / 2),
        };
        
        return {
          sessionId: session.id,
          metadata: session.metadata,
          summary,
          messages: session.messages.map((msg) => ({
            role: msg._getType(),
            content: msg.content.toString().slice(0, 100), // First 100 chars
          })).slice(-4), // Get last 4 messages (2 pairs)
        };
      });

      return NextResponse.json({
        success: true,
        userId,
        sessions: userSessionData,
        totalSessions: userSessionData.length,
      });
    }
    
    // If sessionId is provided (or default), return that specific session
    const actualSessionId = sessionId || "default";
    const history = chatHistoryStore.getHistory(actualSessionId, 4);
    const summary = history.getSummary();
    const messages = history.getMessages();
    const metadata = chatHistoryStore.getMetadata(actualSessionId);

    return NextResponse.json({
      success: true,
      sessionId: actualSessionId,
      metadata,
      summary,
      messages: messages.map((msg) => ({
        role: msg._getType(),
        content: msg.content.toString().slice(0, 100), // First 100 chars
      })),
    });
  } catch (error) {
    console.error("Get history error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
