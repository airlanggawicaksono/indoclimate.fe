import { NextRequest, NextResponse } from "next/server";
import { chatService } from "@/services/chatService";
import { ragProcessingService } from "@/services/ragProcessingService";
import { chatHistoryStore } from "@/services/chatHistoryService";

// Wablas credentials from environment
const WABLASS_API_KEY = process.env.WABLASS_API_KEY;
const WABLASS_WEBHOOK_SECRET = process.env.WABLASS_WEBHOOK_SECRET;
const WABLAS_API_URL = "https://jogja.wablas.com/api/send-message";

/**
 * Send message via Wablas API
 */
async function sendWablasMessage(phone: string, message: string): Promise<boolean> {
  if (!WABLASS_API_KEY || !WABLASS_WEBHOOK_SECRET) {
    console.error("WABLASS_API_KEY or WABLASS_WEBHOOK_SECRET not configured");
    return false;
  }

  console.log(`Sending message to: ${phone}`);
  console.log(`Message preview: ${message.substring(0, 100)}...`);
  console.log(`API Key present: ${!!WABLASS_API_KEY}`);
  console.log(`Secret present: ${!!WABLASS_WEBHOOK_SECRET}`);

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

    let data: any = {};
    try {
      data = await response.json();
      console.log("Response JSON:", data);
    } catch (e) {
      console.error("JSON parse error:", e);
      const text = await response.text();
      console.error(`Non-JSON response from Wablas: ${text.substring(0, 300)}`);
    }

    if (response.ok && data.status) {
      console.log("Message sent successfully!");
      return true;
    } else {
      console.error(`Failed to send message: ${response.status} ${response.statusText}`);
      console.error("Response data:", data);
      return false;
    }
  } catch (error) {
    console.error("Error sending Wablas message:", error);
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
 * Webhook endpoint for Wablas
 * POST /api/webhook
 */
export async function POST(req: NextRequest) {
  try {
    console.log("Webhook called!");

    // Parse incoming webhook data
    const data = await req.json();
    console.log("Received data:", data);

    // Skip self-sent messages
    if (data.isFromMe) {
      console.log("Skipped self-sent message");
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
      console.warn("Missing fields: message or phone");
      return NextResponse.json(
        { error: "Missing required fields: message and phone" },
        { status: 400 }
      );
    }

    console.log(`Processing message from ${targetPhone}: ${userMessage.substring(0, 50)}...`);
    console.log(`Device ID: ${deviceId}`);

    // Create session ID based on phone number
    const sessionId = `wablass_${targetPhone}`;

    try {
      // Step 1: Get last 2 messages (1 pair) for routing context
      const routingHistory = chatHistoryStore.getHistory(sessionId, 2);
      const routing = await chatService.routeQuery(userMessage, routingHistory.getMessages());
      console.log("Routing result:", routing);

      let responseText: string;

      // Step 2: Process based on routing decision
      if (routing.action === "rag") {
        console.log("Using RAG mode");
        const { response } = await processRAGQueryNonStreaming(userMessage, routing, sessionId, true); // isWablas=true for plain text references
        responseText = response;
      } else {
        console.log("Using general chat mode");
        responseText = await processGeneralChatNonStreaming(userMessage, sessionId);
      }

      // Step 3: Send response via Wablas
      const sent = await sendWablasMessage(targetPhone, responseText);

      if (!sent) {
        console.error("Failed to send response to user");
        // Try to send error message
        await sendWablasMessage(
          targetPhone,
          "Maaf, terjadi kesalahan dalam mengirim respons. Silakan coba lagi."
        );
      }

      return NextResponse.json({
        status: "success",
        message: "Response sent",
      });
    } catch (error) {
      console.error("Error processing webhook:", error);

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
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
