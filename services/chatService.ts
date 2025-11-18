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
  // General purpose chat config (temperature 0 for strict instruction following)
  private generalConfig: ChatConfig = {
    model: "gpt-4.1-mini-2025-04-14",
    temperature: 0,
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

CONTEXT AWARENESS:
- You may receive conversation history (last message pair) for context
- Use history to understand if the current question can be answered from existing context or needs new documents
- If the question is a follow-up that references previous context, consider if RAG is still needed
- Example: If previous answer explained "climate change" and user asks "can you explain more?", you can use "no_rag" if context is sufficient

Keluaran SELALU berupa JSON yang valid.

ATURAN PENTING - GUNAKAN RAG ("action":"rag") untuk SEMUA pertanyaan tentang:
 PERATURAN/HUKUM: Perda, Pergub, Perbup, Perwali, UU, PP, Perpres, Permen, pasal, ayat, G20 atau Peratruan iklim internasional lain nya
 IKLIM: Perubahan iklim, climate change, pemanasan global, emisi, karbon, GRK
 LINGKUNGAN: Pengelolaan lingkungan, pencemaran, konservasi, ekosistem, biodiversitas
 BENCANA: Bencana alam, mitigasi bencana, penanggulangan bencana, tanggap darurat
 ENERGI: Energi terbarukan, energi hijau, listrik, solar, angin, biomassa
 SAMPAH/LIMBAH: Pengelolaan sampah, daur ulang, limbah, sanitasi
 AIR: Pengelolaan air, banjir, drainase, DAS, irigasi
 KEHUTANAN: Hutan, deforestasi, reboisasi, lahan
 PERTANIAN: Pertanian berkelanjutan, lahan pertanian
 INDUSTRI: Industri hijau, izin industri, standar emisi industri
 TRANSPORTASI: Transportasi berkelanjutan, emisi kendaraan
 SANKSI/DENDA: Hukuman, pidana, perdata terkait lingkungan/iklim
 IZIN/PROSEDUR: Perizinan, persyaratan, tata cara
 KEBIJAKAN: Kebijakan pemerintah tentang iklim/lingkungan
 FAKTA/DATA: Pertanyaan yang butuh data faktual dari dokumen

JANGAN GUNAKAN RAG ("action":"no_rag") HANYA untuk:
 Sapaan: "halo", "hi", "selamat pagi", "hello", "good morning"
 Ucapan terima kasih: "terima kasih", "makasih", "thank you", "thanks"
 Pertanyaan tentang sistem: "kamu siapa?", "bagaimana cara kamu bekerja?", "who are you?", "how do you work?"

DEFAULT: Jika ragu, GUNAKAN RAG!

Format output (3 field untuk RAG):
- "action"="rag": WAJIB sertakan 3 field:
  1. "expanded_query": Pertanyaan formal lengkap dalam BAHASA INDONESIA (untuk filtering/evaluasi dokumen)
  2. "rag_optimized_query": Kata kunci dalam BAHASA INDONESIA (untuk pencarian ChromaDB)
  3. "fixed_grammar": Pertanyaan formal lengkap dalam BAHASA DARI PERTANYAAN TERAKHIR/CURRENT MESSAGE (CRITICAL: Match the CURRENT user message language ONLY, NOT history. If current message is English, output English. If current message is Indonesian, output Indonesian. Ignore language from history!)
- "action"="no_rag": tidak perlu field tambahan

CRITICAL FOR fixed_grammar:
- ALWAYS match the CURRENT/LATEST user message language
- Do NOT be influenced by previous conversation language
- User can switch languages mid-conversation - always follow the LATEST message language

Contoh (input Indonesian):
Input: "apa itu perubahan iklim?"
Output: {"action":"rag","expanded_query":"Apa yang dimaksud dengan perubahan iklim dan bagaimana dampaknya di Indonesia menurut peraturan yang berlaku?","rag_optimized_query":"perubahan iklim dampak Indonesia","fixed_grammar":"Apa yang dimaksud dengan perubahan iklim dan bagaimana dampaknya di Indonesia menurut peraturan yang berlaku?"}

Input: "berapa denda buang sampah?"
Output: {"action":"rag","expanded_query":"Berapa besar denda untuk pembuangan sampah sembarangan berdasarkan peraturan daerah?","rag_optimized_query":"denda sampah sembarangan perda","fixed_grammar":"Berapa besar denda untuk pembuangan sampah sembarangan berdasarkan peraturan daerah?"}

Contoh (input English - expanded_query tetap Indonesian, fixed_grammar preserve English):
Input: "what are the penalties for littering?"
Output: {"action":"rag","expanded_query":"Berapa besar denda untuk pembuangan sampah sembarangan berdasarkan peraturan daerah?","rag_optimized_query":"denda sanksi sampah sembarangan perda","fixed_grammar":"What are the penalties for littering according to regional regulations in Indonesia?"}

Input: "what is climate change?"
Output: {"action":"rag","expanded_query":"Apa yang dimaksud dengan perubahan iklim dan bagaimana dampaknya di Indonesia menurut peraturan yang berlaku?","rag_optimized_query":"perubahan iklim dampak Indonesia peraturan","fixed_grammar":"What is climate change and how does it impact Indonesia according to applicable regulations?"}

Input: "renewable energy regulations?"
Output: {"action":"rag","expanded_query":"Apa saja peraturan mengenai energi terbarukan di Indonesia?","rag_optimized_query":"energi terbarukan peraturan Indonesia","fixed_grammar":"What are the regulations regarding renewable energy in Indonesia?"}

Contoh (language switching - previous was English, current is Indonesian):
Previous: "What is climate change?" (English)
Current: "Wah kalo keputusan gubernur no17 berarti kalo misal ada banyak sektor yang kena ada tim sendiri?"
Output: {"action":"rag","expanded_query":"Apa maksud dari Keputusan Gubernur Nomor 17 dan bagaimana pengaruhnya terhadap pembentukan tim di berbagai sektor terkait?","rag_optimized_query":"keputusan gubernur 17 pembentukan tim sektor","fixed_grammar":"Apa maksud dari Keputusan Gubernur Nomor 17 dan bagaimana pengaruhnya terhadap pembentukan tim di berbagai sektor terkait?"}
(Note: fixed_grammar in Indonesian because CURRENT message is Indonesian, even though previous was English)

Contoh (language switching - previous was Indonesian, current is English):
Previous: "Apa itu perubahan iklim?" (Indonesian)
Current: "What about carbon emissions?"
Output: {"action":"rag","expanded_query":"Apa saja peraturan mengenai emisi karbon di Indonesia?","rag_optimized_query":"emisi karbon peraturan Indonesia","fixed_grammar":"What are the regulations regarding carbon emissions in Indonesia?"}
(Note: fixed_grammar in English because CURRENT message is English, even though previous was Indonesian)

Contoh (no RAG):
Input: "halo"
Output: {"action":"no_rag"}

Input: "hello"
Output: {"action":"no_rag"}

Input: "thank you"
Output: {"action":"no_rag"}

PENTING:
- Output harus JSON valid tanpa markdown/backticks
- expanded_query SELALU dalam Bahasa Indonesia (untuk evaluasi agent)
- rag_optimized_query SELALU dalam Bahasa Indonesia (untuk ChromaDB)
- fixed_grammar PRESERVE bahasa user (English → English, Indonesian → Indonesian)`;
  }

  /**
   * Get system prompt for general chat
   */
  private getGeneralSystemPrompt(): string {
    return `You are an AI assistant for Indoclimate, a platform for legal information and climate-related documents in Indonesia.

Your tasks:
- Provide accurate and helpful information about climate regulations
- Communicate professionally in BOTH Indonesian (Bahasa Indonesia) and English
- Provide clear and concise answers
- If a question is too vague or non-specific (e.g., "what is article 7?"), ask for more details (e.g., "Could you specify which Perda/Pergub/UU you're referring to?")
- If you don't know the answer, say so honestly

CRITICAL LANGUAGE INSTRUCTION:
- You may receive conversation history in your context
- ALWAYS respond in the language of the CURRENT/LATEST user message ONLY
- DO NOT be influenced by the language of previous messages in history
- Users can switch languages mid-conversation - always follow the LATEST message language
- If current message is in English, respond in English
- If current message is in Indonesian, respond in Indonesian

Examples of language switching:
- History in Indonesian, current message in English → Respond in English
- History in English, current message in Indonesian → Respond in Indonesian
- Mixed history languages, current message in English → Respond in English

Communication style:
- Friendly and professional
- Use proper Indonesian or English language
- Provide explanations that are easy to understand
- Proactively ask for clarification if the question is unclear`;
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
   * Accepts optional history (N=1 last pair) to understand context
   */
  async routeQuery(message: string, history?: BaseMessage[]): Promise<{
    action: "rag" | "no_rag";
    expanded_query?: string;
    rag_optimized_query?: string;
    fixed_grammar?: string;
  }> {
    const llm = this.createLLM(this.routingConfig);

    const messages = [
      new SystemMessage(this.getRoutingSystemPrompt()),
      ...(history || []), // Include history if provided (for context awareness)
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
        fixed_grammar: parsed.fixed_grammar,
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
    // Prepend language instruction to force LLM to match query language
    const messageWithInstruction = `!ANSWER BASED OFF THE LANGUAGE OF THE QUERY
query: ${message}`;

    const llm = this.createLLM(this.generalConfig);

    const messages = [
      new SystemMessage(this.getGeneralSystemPrompt()),
      ...(history || []),
      new HumanMessage(messageWithInstruction),
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
   * General purpose chat WITHOUT streaming (for webhooks)
   * Uses same model and temperature as generalChat but returns full response at once
   */
  async generalChatNonStreaming(
    message: string,
    history?: BaseMessage[]
  ): Promise<string> {
    // Create non-streaming version of general config
    const nonStreamingConfig: ChatConfig = {
      ...this.generalConfig,
      streaming: false,
    };

    const llm = this.createLLM(nonStreamingConfig);

    const messages = [
      new SystemMessage(this.getGeneralSystemPrompt()),
      ...(history || []),
      new HumanMessage(message),
    ];

    const response = await llm.invoke(messages);
    return response.content.toString();
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
    // Prepend language instruction to force LLM to match query language
    const messageWithInstruction = `!ANSWER BASED OFF THE LANGUAGE OF THE QUERY
query: ${message}`;

    const llm = this.createLLM(this.agentConfig);

    const systemPrompt = context
      ? `${this.getAgentSystemPrompt()}\n\nContext:\n${context}`
      : this.getAgentSystemPrompt();

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(messageWithInstruction),
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
