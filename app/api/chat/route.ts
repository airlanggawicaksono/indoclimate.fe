// =============================
// app/api/chat/route.ts
// =============================
import { NextRequest } from "next/server";
import { chatService } from "@/services/chatService";
import { chatHistoryStore } from "@/services/chatHistoryService";
import { ragProcessingService } from "@/services/ragProcessingService";
import { getClientIP, createSimpleHash } from "@/utils/requestUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/chat
 * Intelligent routing: RAG or General Chat with metadata support
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, userId, metadata } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // If no explicit sessionId is provided, generate one based on userId or client info
    const actualSessionId = sessionId || generateSessionId(request, userId);
    
    // Gather all metadata to update in one call
    const connectionMetadata = {
      userAgent: request.headers.get("user-agent") || undefined,
      ipAddress: getClientIP(request),
      lastActive: new Date(),
    };

    // Initialize or update session with metadata
    if (!chatHistoryStore.hasSession(actualSessionId)) {
      chatHistoryStore.createSession(actualSessionId, userId, {
        ...metadata,
        ...connectionMetadata,
      });
    } else {
      // Update all relevant metadata in a single call
      chatHistoryStore.updateMetadata(actualSessionId, {
        userId,
        ...metadata,
        ...connectionMetadata,
      });
    }

    // Step 1: Get last 2 messages (1 pair) for routing context
    const routingHistory = chatHistoryStore.getHistory(actualSessionId, 2);
    const routing = await chatService.routeQuery(message, routingHistory.getMessages());

    // Log the routing response for debugging (can be removed in production)
    // console.log("Routing response:", JSON.stringify(routing, null, 2));

    // Step 2: Update session type based on routing
    chatHistoryStore.updateMetadata(actualSessionId, {
      sessionType: routing.action === "rag" ? "rag" : "general",
    });

    // Step 3: Handle based on routing decision
    if (routing.action === "rag") {
      // RAG path: Query ChromaDB and use Agent Chat
      return handleRAGQuery(message, routing, actualSessionId);
    } else {
      // General chat path: Use streaming general chat with history
      return handleGeneralChat(message, actualSessionId);
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
 * Generate a unique session ID based on available information
 */
function generateSessionId(request: NextRequest, userId?: string): string {
  // If userId is provided, use it as a base for session ID
  if (userId) {
    return `user_${userId}_${Date.now()}`;
  }
  
  // If no userId, try to generate based on client IP and user agent
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  // Create a simple hash-like ID from client info
  const timestamp = Date.now().toString();
  const ipHash = createSimpleHash(clientIP);
  const uaHash = createSimpleHash(userAgent);
  
  return `session_${ipHash}_${uaHash}_${timestamp}`;
}


/**
 * Handle RAG query (streaming)
 * Uses advanced chunk expansion, agent evaluation, and overlap merging
 * Agent evaluates relevance, then general chat LLM streams the answer with context
 */
async function handleRAGQuery(
  message: string,
  routing: { expanded_query?: string; rag_optimized_query?: string; fixed_grammar?: string },
  sessionId: string
) {
  try {
    // Extract queries from routing
    const expandedQuery = routing.expanded_query || message; // Indonesian - for evaluation agent
    const ragOptimizedQuery = routing.rag_optimized_query || message; // Indonesian - for ChromaDB
    let fixedGrammar = routing.fixed_grammar || message; // User's language - for LLM
    
    // Append language instruction to fixedGrammar to ensure language consistency
    fixedGrammar = `!ANSWER BASED OFF THE LANGUAGE OF THE QUERY EVEN THOUGH THE CONTEXT ARE ALWAYS IN INDONESIAN
    ${fixedGrammar}`;

    // Process RAG query with full pipeline (chunk expansion, agent evaluation, merging)
    const { contextPrompt, rationale, sources } =
      await ragProcessingService.processRAGQuery(ragOptimizedQuery, expandedQuery, fixedGrammar);

    // Get history (4 individual messages)
    const history = chatHistoryStore.getHistory(sessionId, 4);

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
              const data = `data: ${JSON.stringify({ 
                content: chunk, 
                done: false, 
                mode: "rag",
                sessionId 
              })}\n\n`;
              controller.enqueue(encoder.encode(data));
            },
            history.getMessages()
          );

          // Append source references directly to the AI message content before saving to history
          if (sources.length > 0) {
            // Detect language from response
            const isEnglish = /^[a-zA-Z\s\?\!\.,;:'"0-9\-]+$/.test(
              fullResponse.trim().slice(0, 100)
            );
            const refHeader = isEnglish ? "\n\n**References:**\n\n" : "\n\n**Referensi:**\n\n";
            
            // Add the header to the full response
            fullResponse += refHeader;
            
            // Format sources in the format [metadata] \n links \n ... and append to fullResponse
            sources.forEach((source, idx) => {
              const sourceName = `[${idx + 1}] ${source.jenis}, ${source.nomor}, ${source.tahun}`;
              const viewLink = source.view_link || "#";
              const linkText = `[${sourceName}](${viewLink})\n\n`;
              fullResponse += linkText;
            });
            
            // Send the complete references section as a single chunk
            const referencesContent = refHeader + sources.map((source, idx) => {
              const sourceName = `[${idx + 1}] ${source.jenis}, ${source.nomor}, ${source.tahun}`;
              const viewLink = source.view_link || "#";
              return `[${sourceName}](${viewLink})\n\n`;
            }).join('');
            
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  content: referencesContent,
                  done: false,
                  mode: "rag",
                  sessionId
                })}\n\n`
              )
            );
          }

          // Add to history
          history.addHumanMessage(message);
          history.addAIMessage(fullResponse);

          // Send done signal with metadata
          const doneData = `data: ${JSON.stringify({
            content: "",
            done: true,
            mode: "rag",
            sessionId,
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
            sessionId,
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
  const history = chatHistoryStore.getHistory(sessionId, 4);
  const encoder = new TextEncoder();

  // Prepend language instruction to force LLM to match query language
  const messageWithInstruction = `!ANSWER BASED OFF THE LANGUAGE OF THE QUERY
query: ${message}`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse = "";

        // Use general chat with history (streaming)
        await chatService.generalChat(
          messageWithInstruction,
          (chunk: string) => {
            fullResponse += chunk;
            const data = `data: ${JSON.stringify({ 
              content: chunk, 
              done: false, 
              mode: "general",
              sessionId 
            })}\n\n`;
            controller.enqueue(encoder.encode(data));
          },
          history.getMessages()
        );

        // Add to history
        history.addHumanMessage(message);
        history.addAIMessage(fullResponse);

        const doneData = `data: ${JSON.stringify({ 
          content: "", 
          done: true, 
          sessionId 
        })}\n\n`;
        controller.enqueue(encoder.encode(doneData));
        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
        const errorData = `data: ${JSON.stringify({
          error: "Streaming failed",
          details: error instanceof Error ? error.message : "Unknown error",
          sessionId,
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

// ============================================
// Automatic Web Chat Session History Cleanup
// ============================================

/**
 * Clear inactive web chat session histories every 20 seconds
 * Only clears sessions that have been inactive for more than 20 seconds
 */
if (typeof global !== 'undefined') {
  // Only run in server environment
  const webCleanupInterval = setInterval(() => {
    const { sessionStorage } = require('@/services/SessionStorage');
    const clearedCount = sessionStorage.clearInactiveSessions(20000); // 20 seconds
    if (clearedCount > 0) {
      console.log(`[Web Chat Cleanup] Cleared ${clearedCount} inactive web session histories (>20s inactive)`);
    }
  }, 20000); // Run every 20 seconds

  // Ensure cleanup doesn't prevent server shutdown
  if (typeof webCleanupInterval.unref === 'function') {
    webCleanupInterval.unref();
  }

  console.log('[Web Chat Cleanup] Automatic cleanup interval started (every 20 seconds for sessions inactive >20s)');
}
