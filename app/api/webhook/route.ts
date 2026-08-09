import { NextRequest, NextResponse } from "next/server";
import { chatService } from "@/services/chatService";
import { ragProcessingService } from "@/services/ragProcessingService";
import { chatHistoryStore } from "@/services/chatHistoryService";
import { wablasLog } from "@/utils/wablasLogger";

// Wablas credentials from environment
const WABLASS_API_KEY = process.env.WABLASS_API_KEY;
const WABLASS_WEBHOOK_SECRET = process.env.WABLASS_WEBHOOK_SECRET;
const WABLAS_API_URL = "https://jogja.wablas.com/api/send-message";

/**
 * Send message via Wablas API
 */
async function sendWablasMessage(phone: string, message: string): Promise<boolean> {
  if (!WABLASS_API_KEY || !WABLASS_WEBHOOK_SECRET) {
    wablasLog.error("WABLASS_API_KEY or WABLASS_WEBHOOK_SECRET not configured");
    return false;
  }

  wablasLog.info("SEND -> outbound", {
    url: WABLAS_API_URL,
    phone,
    length: message.length,
    preview: message.substring(0, 100),
  });

  const startedAt = Date.now();
  try {
    const response = await fetch(WABLAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${WABLASS_API_KEY}.${WABLASS_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });

    const raw = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      wablasLog.error("SEND <- non-JSON response", raw.substring(0, 300));
    }

    if (response.ok && data.status) {
      wablasLog.info("SEND <- ok", { ms: Date.now() - startedAt, body: raw.substring(0, 300) });
      return true;
    }

    wablasLog.error("SEND <- failed", {
      ms: Date.now() - startedAt,
      status: response.status,
      statusText: response.statusText,
      body: raw.substring(0, 300),
    });
    return false;
  } catch (error) {
    wablasLog.error("SEND <- network error", {
      ms: Date.now() - startedAt,
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * Process RAG query without streaming - returns full response
 */
async function processRAGQueryNonStreaming(
  message: string,
  routing: { expanded_query?: string; rag_optimized_query?: string; fixed_grammar?: string },
  sessionId: string,
  isWablas: boolean = false
): Promise<{ response: string; sources: any[] }> {
  // Extract queries from routing
  const expandedQuery = routing.expanded_query || message; // Indonesian - for evaluation agent
  const ragOptimizedQuery = routing.rag_optimized_query || message; // Indonesian - for ChromaDB
  const fixedGrammar = routing.fixed_grammar || message; // User's language - for LLM

  // Process RAG query with full pipeline
  const { contextPrompt, rationale, sources } = await ragProcessingService.processRAGQuery(
    ragOptimizedQuery,
    expandedQuery,
    fixedGrammar
  );

  const history = chatHistoryStore.getHistory(sessionId, 4);

  // Get full response from general chat (non-streaming agent)
  const fullResponse = await chatService.generalChatNonStreaming(
    contextPrompt,
    history.getMessages()
  );

  // Append source references with language detection
  let responseWithSources = fullResponse;
  if (sources.length > 0) {
    // Detect language from response
    const isEnglish = /^[a-zA-Z\s\?\!\.,;:'"0-9\-]+$/.test(
      fullResponse.trim().slice(0, 100)
    );
    const refHeader = isEnglish ? "\n\nReferences:\n\n" : "\n\nReferensi:\n\n";
    responseWithSources += refHeader;

    sources.forEach((source, idx) => {
      const sourceName = `[${idx + 1}] ${source.jenis}, ${source.nomor}, ${source.tahun}`;
      const viewLink = source.view_link || "#";

      if (isWablas) {
        // Wablas format: plain text with name on one line, link on next line
        responseWithSources += `${sourceName}\n${viewLink}\n\n`;
      } else {
        // Web format: markdown link
        responseWithSources += `[${sourceName}](${viewLink})\n\n`;
      }
    });
  }

  // Save to history
  history.addHumanMessage(message);
  history.addAIMessage(responseWithSources);

  return { response: responseWithSources, sources };
}

/**
 * Process general chat query without streaming
 */
async function processGeneralChatNonStreaming(message: string, sessionId: string): Promise<string> {
  const history = chatHistoryStore.getHistory(sessionId, 4);

  // Prepend language instruction to force LLM to match query language
  const messageWithInstruction = `!ANSWER BASED OFF THE LANGUAGE OF THE QUERY
query: ${message}`;

  // Use non-streaming agent directly
  const fullResponse = await chatService.generalChatNonStreaming(
    messageWithInstruction,
    history.getMessages()
  );

  // Save original message to history (without instruction)
  history.addHumanMessage(message);
  history.addAIMessage(fullResponse);

  return fullResponse;
}

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Request timeout")), ms);
  });
}

/**
 * Webhook endpoint for Wablas
 * POST /api/webhook
 * Includes 20-second timeout to prevent hanging
 */
export async function POST(req: NextRequest) {
  try {
    wablasLog.info("RECV -> webhook hit", {
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      ua: req.headers.get("user-agent"),
      contentType: req.headers.get("content-type"),
    });

    // Parse incoming webhook data
    const data = await req.json();
    wablasLog.info("RECV -> payload", data);

    // Skip self-sent messages
    if (data.isFromMe) {
      wablasLog.info("RECV -> skipped self-sent message");
      return NextResponse.json({
        status: "success",
        message: "Skipped self-sent message",
      });
    }

    // Extract message and phone
    const userMessage = (data.message || "").trim();
    const targetPhone = data.phone; // sender/customer phone number
    const deviceId = data.deviceId; // device ID that received the message

    if (!userMessage || !targetPhone) {
      wablasLog.warn("RECV -> missing fields: message or phone", data);
      return NextResponse.json(
        { error: "Missing required fields: message and phone" },
        { status: 400 }
      );
    }

    wablasLog.info("RECV -> processing", {
      from: targetPhone,
      deviceId,
      message: userMessage.substring(0, 200),
    });

    // Create session ID based on phone number
    const sessionId = `wablass_${targetPhone}`;

    try {
      // Wrap processing in a timeout (20 seconds)
      const processingPromise = (async () => {
        // Step 1: Get last 2 messages (1 pair) for routing context
        const routingHistory = chatHistoryStore.getHistory(sessionId, 2);
        const routing = await chatService.routeQuery(userMessage, routingHistory.getMessages());
        wablasLog.info("PROC -> routing result", routing);

        let responseText: string;

        // Step 2: Process based on routing decision
        if (routing.action === "rag") {
          const { response } = await processRAGQueryNonStreaming(userMessage, routing, sessionId, true); // isWablas=true for plain text references
          responseText = response;
        } else {
          responseText = await processGeneralChatNonStreaming(userMessage, sessionId);
        }
        wablasLog.info("PROC -> answer ready", {
          mode: routing.action,
          length: responseText.length,
        });

        // Step 3: Send response via Wablas
        const sent = await sendWablasMessage(targetPhone, responseText);

        if (!sent) {
          wablasLog.error("PROC -> failed to send response to user", { phone: targetPhone });
          // Try to send error message
          await sendWablasMessage(
            targetPhone,
            "Maaf, terjadi kesalahan dalam mengirim respons. Silakan coba lagi."
          );
        }

        return { status: "success", message: "Response sent" };
      })();

      // Race between processing and timeout (20 seconds)
      const result = await Promise.race([
        processingPromise,
        createTimeout(20000),
      ]);

      return NextResponse.json(result);
    } catch (error) {
      wablasLog.error("PROC -> error processing webhook", (error as Error).stack);

      // Check if it's a timeout error
      if (error instanceof Error && error.message === "Request timeout") {
        wablasLog.error("PROC -> timed out after 20s", { phone: targetPhone });
        // Send timeout message to user
        await sendWablasMessage(
          targetPhone,
          "Maaf, permintaan memakan waktu terlalu lama. Silakan coba lagi dengan pertanyaan yang lebih spesifik."
        );

        return NextResponse.json(
          { error: "Request timeout" },
          { status: 504 }
        );
      }

      // Send error message to user
      await sendWablasMessage(
        targetPhone,
        "Maaf, terjadi kesalahan dalam memproses permintaan Anda. Silakan coba lagi nanti."
      );

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  } catch (error) {
    wablasLog.error("RECV -> invalid request / body parse failed", (error as Error).message);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

// ============================================
// Automatic Wablas Session History Cleanup
// ============================================

/**
 * Clear Wablas session histories every 20 seconds
 * This prevents history pollution and keeps conversations fresh
 */
if (typeof global !== 'undefined') {
  // Only run in server environment
  const cleanupInterval = setInterval(() => {
    const { sessionStorage } = require('@/services/SessionStorage');
    const clearedCount = sessionStorage.clearSessionMessagesByPattern('wablass_');
    if (clearedCount > 0) {
      wablasLog.info(`CLEANUP -> cleared ${clearedCount} session histories`);
    }
  }, 20000); // Run every 20 seconds

  // Ensure cleanup doesn't prevent server shutdown
  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  wablasLog.info(`CLEANUP -> interval started (20s). Log file: ${wablasLog.file}`);
}
