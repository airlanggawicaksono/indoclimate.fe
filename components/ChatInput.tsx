// =============================
// components/ChatInput.tsx
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
    el.style.height = "0px"; // reset first
    const next = Math.min(el.scrollHeight, 200); // ~10 lines cap
    el.style.height = next + "px";
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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center bg-gradient-to-t from-background via-background/95 to-background/40">
      <div className="w-full max-w-4xl px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-2 rounded-3xl border bg-card/70 p-3 shadow-lg ring-1 ring-border backdrop-blur transition focus-within:ring-2 focus-within:ring-primary supports-[backdrop-filter]:bg-card/60"
        >
          <div className="flex items-center gap-4 rounded-2xl bg-muted/40 px-5 py-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Tanyakan tentang peraturan..."
              disabled={isLoading}
              rows={1}
              className="min-h-10 max-h-40 flex-1 resize-none bg-transparent px-2 py-0 text-base leading-6 text-foreground placeholder:text-muted-foreground/80 outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-lg"
            />
            <button
              type="submit"
              aria-label="Kirim"
              disabled={!value.trim() || isLoading}
              className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition will-change-transform hover:scale-105 hover:bg-primary/90 disabled:opacity-50 disabled:hover:scale-100 sm:size-12 flex-shrink-0"
            >
              {isLoading ? (
                <span className="inline-block size-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-5"
                  aria-hidden
                >
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              )}
            </button>
          </div>
          <div className="px-2 pb-1 pt-2 text-center text-xs text-muted-foreground/80">
            Tekan{" "}
            <kbd className="rounded border bg-muted px-1 text-foreground">
              Enter
            </kbd>{" "}
            untuk kirim •{" "}
            <kbd className="rounded border bg-muted px-1 text-foreground">
              Shift
            </kbd>
            +
            <kbd className="rounded border bg-muted px-1 text-foreground">
              Enter
            </kbd>{" "}
            untuk baris baru
          </div>
        </form>
      </div>
    </div>
  );
}
