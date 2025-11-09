import { Message } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full px-4 sm:px-6 ${
        isUser ? "justify-end" : "justify-start"
      } mb-4`}
    >
      <div
        className={`group relative max-w-[75%] rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md ${
          isUser
            ? "bg-base-200 text-base-content rounded-bl-sm"
            : "bg-base-200 text-base-content rounded-bl-sm"
        }`}
      >
        <div className="prose prose-sm max-w-none text-[15px] leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200"
                />
              ),
              p: ({ node, ...props }) => <p {...props} className="mb-2" />,
              strong: ({ node, ...props }) => (
                <strong {...props} className="font-semibold" />
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

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
