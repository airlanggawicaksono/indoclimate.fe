"use client";

import { useState, useRef, useEffect } from "react";
import { Message } from "@/types";
import EmptyState from "@/components/EmptyState";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import TypingIndicator from "@/components/TypingIndicator";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

    // TODO: Implement actual API call to your backend with Chroma
    // Simulating response for now
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "This is a placeholder response. Connect your Chroma backend here to get real answers from your document collection.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Main chat area */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-6 sm:px-6">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto w-full max-w-3xl">
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
