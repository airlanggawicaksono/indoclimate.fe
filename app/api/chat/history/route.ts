// =============================
// app/api/chat/history/route.ts
// =============================
import { NextRequest, NextResponse } from "next/server";
import { chatHistoryStore } from "@/services/chatHistoryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/chat/history?sessionId=xxx
 * Get chat history summary for a session
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId") || "default";

    const history = chatHistoryStore.getHistory(sessionId, 2);
    const summary = history.getSummary();
    const messages = history.getMessages();

    return NextResponse.json({
      success: true,
      sessionId,
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
