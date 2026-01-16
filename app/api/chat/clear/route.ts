// =============================
// app/api/chat/clear/route.ts
// =============================
import { NextRequest, NextResponse } from "next/server";
import { chatHistoryStore } from "@/services/chatHistoryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/chat/clear
 * Clear chat history for a session with enhanced response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId = "default", userId } = body;

    chatHistoryStore.clearSession(sessionId);

    // If userId is provided, create a new session for the user
    if (userId) {
      chatHistoryStore.createSession(sessionId, userId);
    }

    return NextResponse.json({
      success: true,
      message: "Chat history cleared successfully",
      sessionId,
      userId,
    });
  } catch (error) {
    console.error("Clear history error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
