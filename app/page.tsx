"use client";

import { useState, useRef, useEffect } from "react";
import { Message } from "@/types";
import EmptyState from "@/components/EmptyState";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";
import CurvedNavbar from "@/components/CurvedNavbar";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Create placeholder for assistant message
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      // Call the chat API with session ID
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: content, sessionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from API");
      }

      const contentType = response.headers.get("content-type");

      // Check if it's streaming (SSE) or JSON
      if (contentType?.includes("text/event-stream")) {
        // Streaming response (general chat)
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.error) {
                  throw new Error(data.error);
                }

                if (!data.done) {
                  accumulatedContent += data.content;

                  // Update the message in real-time
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } else {
        // Non-streaming JSON response (RAG mode)
        const data = await response.json();

        // Update with complete message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: data.message || "Tidak ada respons." }
              : msg
          )
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // Update with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content:
                  "Maaf, terjadi kesalahan saat menghubungi server. Pastikan OpenAI API key sudah dikonfigurasi.",
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    // Clear UI
    setMessages([]);
    setIsLoading(false);

    // Clear server-side history
    try {
      await fetch("/api/chat/clear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.error("Failed to clear chat history:", error);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Curved Navbar */}
      <CurvedNavbar onReset={handleReset} hasMessages={messages.length > 0} />

      {/* Main chat area */}
      <div className="flex-1 overflow-y-auto px-4 pb-36 pt-6 sm:px-6">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto w-full max-w-4xl">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}
