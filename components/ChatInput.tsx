// =============================
// components/ChatInput.tsx
// Minimal, sleek chat input
// =============================
"use client";
import { useEffect, useRef, useState } from "react";
interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}
export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    const msg = value.trim();
    if (!msg || isLoading) return;
    onSend(msg);
    setValue("");
  };

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px"; // ~10 lines
  };

  useEffect(() => {
    autoGrow();
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const disabled = !value.trim() || isLoading;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center
                    bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/55"
    >
      <div className="w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="rounded-2xl ring-1 ring-border/60 bg-muted/20 transition
                     focus-within:ring-foreground/30 p-1.5"
          aria-label="Chat input"
        >
          <div className="flex items-end gap-2">
            <label htmlFor="chat-input" className="sr-only">
              Tulis pesan
            </label>

            <textarea
              id="chat-input"
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Tanyakan tentang peraturan…"
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none bg-transparent outline-none
                         px-4 py-2 sm:px-5 sm:py-3
                         text-base sm:text-[15px] leading-6
                         placeholder:text-muted-foreground/70
                         disabled:cursor-not-allowed disabled:opacity-50
                         scrollbar-none"
            />

            <button
              type="submit"
              aria-label="Kirim"
              aria-disabled={disabled}
              disabled={disabled}
              className="relative inline-flex items-center justify-center
           size-10 sm:size-11 rounded-full
           bg-background/30 backdrop-blur text-foreground
           shadow-sm
           transition will-change-transform
           hover:bg-background/45 active:scale-95
           disabled:opacity-40
           focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
              title="Kirim (Enter)"
            >
              {isLoading ? (
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              ) : (
                // Minimal send glyph
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M3.4 2.6a.75.75 0 0 0-.96.94l2.42 7.9H13.5a.75.75 0 0 1 0 1.5H4.86l-2.42 7.9a.75.75 0 0 0 .96.94 60.5 60.5 0 0 0 18.45-8.99.75.75 0 0 0 0-1.22A60.5 60.5 0 0 0 3.4 2.6z" />
                </svg>
              )}
            </button>
          </div>
        </form>

        {/* Optional hint (kept tiny). Remove if you want ultra-minimal. */}
        <div className="mt-2 text-center text-xs text-muted-foreground/70">
          Enter untuk kirim • Shift+Enter baris baru
        </div>
      </div>
    </div>
  );
}
