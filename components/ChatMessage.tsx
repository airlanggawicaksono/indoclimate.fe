import { Message } from "@/types";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`group relative max-w-[75%] rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md ${
          isUser
            ? "bg-primary text-primary-content rounded-br-sm"
            : "bg-base-200 text-base-content rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
          {message.content}
        </p>

        {message.metadata?.sources && message.metadata.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-current/10">
            <p className="text-xs opacity-70">
              Sources: {message.metadata.sources.join(", ")}
            </p>
          </div>
        )}

        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10px] opacity-60">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
