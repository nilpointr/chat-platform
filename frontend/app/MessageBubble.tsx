import type { Message } from "./useChatStream";

type MessageBubbleProps = {
  message: Message;
  showTypingIndicator: boolean;
};

export function MessageBubble({ message, showTypingIndicator }: MessageBubbleProps) {
  return (
    <div className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          message.role === "user"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "bg-white text-zinc-800 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
        }`}
      >
        {showTypingIndicator ? (
          <span className="flex gap-1 items-center h-4">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
          </span>
        ) : (
          message.content
        )}
      </div>

      {message.meta && (
        <div className="mt-1 px-1 text-xs text-zinc-400 dark:text-zinc-500 font-mono flex gap-3 flex-wrap max-w-[75%]">
          <span>{message.meta.model}</span>
          <span>↑{message.meta.inputTokens} ↓{message.meta.outputTokens} tok</span>
          <span>{message.meta.stopReason}</span>
          <span>ttft {message.meta.ttft}ms · {message.meta.elapsed}ms</span>
        </div>
      )}
    </div>
  );
}
