// =============================
// services/chatService.ts
// =============================
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ChatConfig } from "@/types/chat";

/**
 * Chat Service - Handles LLM interactions with configurable settings
 */
class ChatService {
  // General purpose chat config (temperature 0.3 for consistency)
  private generalConfig: ChatConfig = {
    model: "gpt-4.1-mini-2025-04-14",
    temperature: 0.3,
    maxTokens: 2000,
    streaming: true,
  };

  // Agent config (temperature 0 for deterministic responses)
  private agentConfig: ChatConfig = {
    model: "gpt-4.1-mini-2025-04-14",
    temperature: 0,
    maxTokens: 4000,
    streaming: false,
  };

  // Routing agent config (temperature 0 for deterministic routing)
  private routingConfig: ChatConfig = {
    model: "gpt-4.1-nano-2025-04-14",
    temperature: 0,
    maxTokens: 500,
    streaming: false,
  };

  /**
   * Create a configured LLM instance
   */
  private createLLM(config: ChatConfig) {
    return new ChatOpenAI({
      modelName: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      streaming: config.streaming,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Get system prompt for routing agent
   */
  private getRoutingSystemPrompt(): string {
    return `Tugas: Klasifikasikan apakah pertanyaan pengguna butuh RAG (Retrieval-Augmented Generation) untuk mencari dokumen.

DATABASE: Indoclimate - berisi peraturan perundangan, hukum iklim, lingkungan, bencana, dan dokumen terkait Indonesia.

Keluaran SELALU berupa JSON yang valid.

ATURAN PENTING - GUNAKAN RAG ("action":"rag") untuk SEMUA pertanyaan tentang:
✅ PERATURAN/HUKUM: Perda, Pergub, Perbup, Perwali, UU, PP, Perpres, Permen, pasal, ayat, G20 atau Peratruan iklim internasional lain nya 
✅ IKLIM: Perubahan iklim, climate change, pemanasan global, emisi, karbon, GRK
✅ LINGKUNGAN: Pengelolaan lingkungan, pencemaran, konservasi, ekosistem, biodiversitas
✅ BENCANA: Bencana alam, mitigasi bencana, penanggulangan bencana, tanggap darurat
✅ ENERGI: Energi terbarukan, energi hijau, listrik, solar, angin, biomassa
✅ SAMPAH/LIMBAH: Pengelolaan sampah, daur ulang, limbah, sanitasi
✅ AIR: Pengelolaan air, banjir, drainase, DAS, irigasi
✅ KEHUTANAN: Hutan, deforestasi, reboisasi, lahan
✅ PERTANIAN: Pertanian berkelanjutan, lahan pertanian
✅ INDUSTRI: Industri hijau, izin industri, standar emisi industri
✅ TRANSPORTASI: Transportasi berkelanjutan, emisi kendaraan
✅ SANKSI/DENDA: Hukuman, pidana, perdata terkait lingkungan/iklim
✅ IZIN/PROSEDUR: Perizinan, persyaratan, tata cara
✅ KEBIJAKAN: Kebijakan pemerintah tentang iklim/lingkungan
✅ FAKTA/DATA: Pertanyaan yang butuh data faktual dari dokumen

JANGAN GUNAKAN RAG ("action":"no_rag") HANYA untuk:
❌ Sapaan: "halo", "hi", "selamat pagi"
❌ Ucapan terima kasih: "terima kasih", "makasih"
❌ Pertanyaan tentang sistem: "kamu siapa?", "bagaimana cara kamu bekerja?"

DEFAULT: Jika ragu, GUNAKAN RAG!

Format output:
- "action"="rag": WAJIB sertakan "expanded_query" (pertanyaan formal lengkap) dan "rag_optimized_query" (kata kunci untuk pencarian)
- "action"="no_rag": tidak perlu field tambahan

Contoh:
Input: "apa itu perubahan iklim?"
Output: {"action":"rag","expanded_query":"Apa yang dimaksud dengan perubahan iklim dan bagaimana dampaknya di Indonesia menurut peraturan yang berlaku?","rag_optimized_query":"perubahan iklim dampak Indonesia"}

Input: "bagaimana cara menangani bencana banjir?"
Output: {"action":"rag","expanded_query":"Bagaimana prosedur dan kebijakan penanggulangan bencana banjir di Indonesia?","rag_optimized_query":"penanggulangan bencana banjir prosedur"}

Input: "berapa denda buang sampah?"
Output: {"action":"rag","expanded_query":"Berapa besar denda untuk pembuangan sampah sembarangan berdasarkan peraturan daerah?","rag_optimized_query":"denda sampah sembarangan perda"}

Input: "aturan energi terbarukan?"
Output: {"action":"rag","expanded_query":"Apa saja peraturan mengenai energi terbarukan di Indonesia?","rag_optimized_query":"energi terbarukan peraturan Indonesia"}

Input: "halo"
Output: {"action":"no_rag"}

Input: "terima kasih"
Output: {"action":"no_rag"}

PENTING: Output harus JSON valid tanpa markdown/backticks.`;
  }

  /**
   * Get system prompt for general chat
   */
  private getGeneralSystemPrompt(): string {
    return `You are an AI assistant for Indoclimate, a platform for legal information and climate-related documents in Indonesia.

Your tasks:
- Provide accurate and helpful information about climate regulations
- Communicate professionally in BOTH Indonesian (Bahasa Indonesia) and English
- Respond in the SAME LANGUAGE the user uses (if they ask in English, respond in English; if they ask in Indonesian, respond in Indonesian)
- Provide clear and concise answers
- If a question is too vague or non-specific (e.g., "what is article 7?"), ask for more details (e.g., "Could you specify which Perda/Pergub/UU you're referring to?")
- If you don't know the answer, say so honestly

Communication style:
- Friendly and professional
- Use proper Indonesian or English language
- Provide explanations that are easy to understand
- Proactively ask for clarification if the question is unclear
- ALWAYS match the user's language (English ↔ English, Indonesian ↔ Indonesian)`;
  }

  /**
   * Get system prompt for agent
   */
  private getAgentSystemPrompt(): string {
    return `You are an AI agent for Indoclimate, specialized in processing and analyzing climate-related legal documents in Indonesia.

Your role:
- Process and extract information from documents with high accuracy
- Provide structured, deterministic responses based on the provided context
- Follow instructions precisely
- Return consistent results for the same input
- Always cite sources using the document numbers [1], [2], etc. provided in the context

When answering:
- Reference specific document numbers when citing information (e.g., "Based on document [1]..." or "Berdasarkan dokumen [1]...")
- Provide comprehensive answers by synthesizing information across multiple documents
- Be factual and precise with legal information
- Include relevant details like pasal/ayat numbers, penalties, procedures, etc.
- Respond in the SAME LANGUAGE as the user's query (English ↔ English, Indonesian ↔ Indonesian)
- Detect the language from the query context and match it

Response format:
- Be concise and factual
- Use structured data when possible
- Maintain consistency across multiple calls
- Always cite document sources
- Match the user's language (English or Indonesian)`;
  }

  /**
   * Routing agent - determines if query needs RAG or not
   * Uses gpt-4.1-nano-2025-04-14 with temperature 0
   */
  async routeQuery(message: string): Promise<{
    action: "rag" | "no_rag";
    expanded_query?: string;
    rag_optimized_query?: string;
  }> {
    const llm = this.createLLM(this.routingConfig);

    const messages = [
      new SystemMessage(this.getRoutingSystemPrompt()),
      new HumanMessage(message),
    ];

    try {
      const response = await llm.invoke(messages);
      const content = response.content.toString().trim();

      // Remove markdown code blocks if present
      const jsonString = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(jsonString);

      return {
        action: parsed.action,
        expanded_query: parsed.expanded_query,
        rag_optimized_query: parsed.rag_optimized_query,
      };
    } catch (error) {
      console.error("Routing error:", error);
      // Default to no_rag on error
      return { action: "no_rag" };
    }
  }

  /**
   * General purpose chat with streaming support
   * Uses gpt-4o-mini with temperature 0.3
   */
  async generalChat(
    message: string,
    onStream?: (chunk: string) => void,
    history?: BaseMessage[]
  ): Promise<string> {
    const llm = this.createLLM(this.generalConfig);

    const messages = [
      new SystemMessage(this.getGeneralSystemPrompt()),
      ...(history || []),
      new HumanMessage(message),
    ];

    if (this.generalConfig.streaming && onStream) {
      let fullResponse = "";
      const stream = await llm.stream(messages);

      for await (const chunk of stream) {
        const content = chunk.content.toString();
        fullResponse += content;
        onStream(content);
      }

      return fullResponse;
    } else {
      const response = await llm.invoke(messages);
      return response.content.toString();
    }
  }

  /**
   * Agent chat for RAG and document processing
   * Uses gpt-4.1-mini-2025-04-14 with temperature 0
   */
  async agentChat(
    message: string,
    context?: string,
    onStream?: (chunk: string) => void
  ): Promise<string> {
    const llm = this.createLLM(this.agentConfig);

    const systemPrompt = context
      ? `${this.getAgentSystemPrompt()}\n\nContext:\n${context}`
      : this.getAgentSystemPrompt();

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(message),
    ];

    if (this.agentConfig.streaming && onStream) {
      let fullResponse = "";
      const stream = await llm.stream(messages);

      for await (const chunk of stream) {
        const content = chunk.content.toString();
        fullResponse += content;
        onStream(content);
      }

      return fullResponse;
    } else {
      const response = await llm.invoke(messages);
      return response.content.toString();
    }
  }

  /**
   * Get general chat configuration
   */
  getGeneralConfig(): ChatConfig {
    return { ...this.generalConfig };
  }

  /**
   * Get agent configuration
   */
  getAgentConfig(): ChatConfig {
    return { ...this.agentConfig };
  }
}

// Export singleton instance
export const chatService = new ChatService();
