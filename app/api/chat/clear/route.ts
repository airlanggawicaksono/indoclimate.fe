// =============================
// app/api/chat/clear/route.ts
// =============================
import { NextRequest, NextResponse } from "next/server";
import { chatHistoryStore } from "@/services/chatHistoryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/chat/clear
 * Clear chat history for a session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId = "default" } = body;

    chatHistoryStore.clearSession(sessionId);

    return NextResponse.json({
      success: true,
      message: "Chat history cleared",
      sessionId,
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
