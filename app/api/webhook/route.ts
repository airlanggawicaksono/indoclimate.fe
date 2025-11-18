import { NextRequest, NextResponse } from "next/server";
import { chatService } from "@/services/chatService";
import { ragProcessingService } from "@/services/ragProcessingService";
import { chatHistoryStore } from "@/services/chatHistoryService";

// Wablas credentials from environment
const WABLASS_API_KEY = process.env.WABLASS_API_KEY;
const WABLASS_WEBHOOK_SECRET = process.env.WABLASS_WEBHOOK_SECRET;
const WABLAS_API_URL = "https://sby.wablas.com/api/send-message";

/**
 * Send message via Wablas API
 */
async function sendWablasMessage(phone: string, message: string): Promise<boolean> {
  if (!WABLASS_API_KEY || !WABLASS_WEBHOOK_SECRET) {
    console.error("WABLASS_API_KEY or WABLASS_WEBHOOK_SECRET not configured");
    return false;
  }

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

    if (!response.ok) {
      console.error(`Failed to send message: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`Message sent successfully to ${phone}`);
    return true;
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
  routing: { expanded_query?: string; rag_optimized_query?: string },
  sessionId: string
): Promise<{ response: string; sources: any[] }> {
  const agentQuery = routing.expanded_query || message;
  const ragOptimizedQuery = routing.rag_optimized_query || message;

  // Process RAG query with full pipeline
  const { contextPrompt, rationale, sources } = await ragProcessingService.processRAGQuery(
    ragOptimizedQuery,
    agentQuery
  );

  const history = chatHistoryStore.getHistory(sessionId, 2);

  // Get full response from general chat (non-streaming)
  let fullResponse = "";
  await chatService.generalChat(
    contextPrompt,
    (chunk: string) => {
      fullResponse += chunk;
    },
    history.getMessages()
  );

  // Append source references
  if (sources.length > 0) {
    fullResponse += "\n\n**Referensi:**\n\n";
    sources.forEach((source, idx) => {
      const sourceLink = `[${idx + 1}] ${source.jenis}, ${source.nomor}, ${source.tahun}`;
      const viewLink = source.view_link || "#";
      fullResponse += `[${sourceLink}](${viewLink})\n\n`;
    });
  }

  // Save to history
  history.addHumanMessage(message);
  history.addAIMessage(fullResponse);

  return { response: fullResponse, sources };
}

/**
 * Process general chat query without streaming
 */
async function processGeneralChatNonStreaming(message: string, sessionId: string): Promise<string> {
  const history = chatHistoryStore.getHistory(sessionId, 2);

  let fullResponse = "";
  await chatService.generalChat(
    message,
    (chunk: string) => {
      fullResponse += chunk;
    },
    history.getMessages()
  );

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

    if (!userMessage || !targetPhone) {
      console.warn("Missing fields: message or phone");
      return NextResponse.json(
        { error: "Missing required fields: message and phone" },
        { status: 400 }
      );
    }

    console.log(`Processing message from ${targetPhone}: ${userMessage.substring(0, 50)}...`);

    // Create session ID based on phone number
    const sessionId = `wablass_${targetPhone}`;

    try {
      // Step 1: Route the query
      const routing = await chatService.routeQuery(userMessage);
      console.log("Routing result:", routing);

      let responseText: string;

      // Step 2: Process based on routing decision
      if (routing.action === "rag") {
        console.log("Using RAG mode");
        const { response } = await processRAGQueryNonStreaming(userMessage, routing, sessionId);
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
