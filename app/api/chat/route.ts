// =============================
// app/api/chat/route.ts
// =============================
import { NextRequest } from "next/server";
import { chatService } from "@/services/chatService";
import { chatHistoryStore } from "@/services/chatHistoryService";
import { ragProcessingService } from "@/services/ragProcessingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/chat
 * Intelligent routing: RAG or General Chat
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId = "default" } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 1: Route the query
    const routing = await chatService.routeQuery(message);

    // Step 2: Handle based on routing decision
    if (routing.action === "rag") {
      // RAG path: Query ChromaDB and use Agent Chat
      return handleRAGQuery(message, routing, sessionId);
    } else {
      // General chat path: Use streaming general chat with history
      return handleGeneralChat(message, sessionId);
    }
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle RAG query (streaming)
 * Uses advanced chunk expansion, agent evaluation, and overlap merging
 * Agent evaluates relevance, then general chat LLM streams the answer with context
 */
async function handleRAGQuery(
  message: string,
  routing: { expanded_query?: string; rag_optimized_query?: string },
  sessionId: string
) {
  try {
    // Use expanded query for agent if available
    const agentQuery = routing.expanded_query || message;
    const ragOptimizedQuery = routing.rag_optimized_query || message;

    // Process RAG query with full pipeline (chunk expansion, agent evaluation, merging)
    const { contextPrompt, rationale, sources } =
      await ragProcessingService.processRAGQuery(ragOptimizedQuery, agentQuery);

    // Get history
    const history = chatHistoryStore.getHistory(sessionId, 2);

    // Create streaming response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = "";

          // Stream general chat response with RAG context
          await chatService.generalChat(
            contextPrompt,
            (chunk: string) => {
              fullResponse += chunk;
              const data = `data: ${JSON.stringify({ content: chunk, done: false, mode: "rag" })}\n\n`;
              controller.enqueue(encoder.encode(data));
            },
            history.getMessages()
          );

          // After streaming completes, append source references as hyperlinks
          if (sources.length > 0) {
            const sourceText = "\n\n**Referensi:**\n\n";
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: sourceText, done: false, mode: "rag" })}\n\n`
              )
            );
            fullResponse += sourceText;

            sources.forEach((source, idx) => {
              const sourceLink = `[${idx + 1}] ${source.jenis}, ${source.nomor}, ${source.tahun}`;
              const viewLink = source.view_link || "#";
              const linkText = `[${sourceLink}](${viewLink})\n\n`;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ content: linkText, done: false, mode: "rag" })}\n\n`
                )
              );
              fullResponse += linkText;
            });
          }

          // Add to history
          history.addHumanMessage(message);
          history.addAIMessage(fullResponse);

          // Send done signal with metadata
          const doneData = `data: ${JSON.stringify({
            content: "",
            done: true,
            mode: "rag",
            sources: sources.map((source) => ({
              jenis: source.jenis,
              nomor: source.nomor,
              tahun: source.tahun,
              view_link: source.view_link,
            })),
            totalResults: sources.length,
          })}\n\n`;
          controller.enqueue(encoder.encode(doneData));
          controller.close();
        } catch (error) {
          console.error("RAG streaming error:", error);
          const errorData = `data: ${JSON.stringify({
            error: "RAG processing failed",
            details: error instanceof Error ? error.message : "Unknown error",
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("RAG error:", error);
    throw error;
  }
}

/**
 * Handle general chat (streaming)
 */
async function handleGeneralChat(message: string, sessionId: string) {
  const history = chatHistoryStore.getHistory(sessionId, 2);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse = "";

        // Use general chat with history (streaming)
        await chatService.generalChat(
          message,
          (chunk: string) => {
            fullResponse += chunk;
            const data = `data: ${JSON.stringify({ content: chunk, done: false, mode: "general" })}\n\n`;
            controller.enqueue(encoder.encode(data));
          },
          history.getMessages()
        );

        // Add to history
        history.addHumanMessage(message);
        history.addAIMessage(fullResponse);

        const doneData = `data: ${JSON.stringify({ content: "", done: true })}\n\n`;
        controller.enqueue(encoder.encode(doneData));
        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
        const errorData = `data: ${JSON.stringify({
          error: "Streaming failed",
          details: error instanceof Error ? error.message : "Unknown error",
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
