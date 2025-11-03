export default function TypingIndicator() {
  return (
    <div className="flex w-full justify-start mb-4">
      <div className="relative max-w-[75%] rounded-2xl rounded-bl-sm bg-base-200 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 animate-bounce rounded-full bg-base-content/40 [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-base-content/40 [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-base-content/40"></div>
        </div>
      </div>
    </div>
  );
}
