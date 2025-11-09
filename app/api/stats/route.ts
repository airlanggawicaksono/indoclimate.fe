// =============================
// app/api/stats/route.ts
// =============================
import { NextResponse } from "next/server";
import { chromaService } from "@/services/chromaService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats
 * Returns statistics about the document collection
 */
export async function GET() {
  try {
    const stats = await chromaService.getStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
