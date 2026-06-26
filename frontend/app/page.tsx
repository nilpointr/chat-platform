"use client";

import { useEffect, useRef, useState } from "react";

type MessageMeta = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  ttft: number;
  elapsed: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  meta?: MessageMeta;
};

const BACKEND_URL = "http://localhost:8000";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const historyForBackend = [...messages, userMessage];
    setMessages([...historyForBackend, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    const startTime = Date.now();
    let ttft: number | null = null;

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForBackend }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          const event = JSON.parse(data);

          if (event.type === "delta") {
            if (ttft === null) ttft = Date.now() - startTime;
            setMessages((prev) => {
              const msgs = [...prev];
              const last = msgs[msgs.length - 1];
              msgs[msgs.length - 1] = { ...last, content: last.content + event.text };
              return msgs;
            });
          } else if (event.type === "metadata") {
            setMessages((prev) => {
              const msgs = [...prev];
              const last = msgs[msgs.length - 1];
              msgs[msgs.length - 1] = {
                ...last,
                meta: {
                  model: event.model,
                  inputTokens: event.input_tokens,
                  outputTokens: event.output_tokens,
                  stopReason: event.stop_reason,
                  ttft: ttft ?? 0,
                  elapsed: Date.now() - startTime,
                },
              };
              return msgs;
            });
          } else if (event.type === "error") {
            setMessages((prev) => {
              const msgs = [...prev];
              msgs[msgs.length - 1] = { role: "assistant", content: "Something went wrong. Please try again." };
              return msgs;
            });
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const msgs = [...prev];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
          msgs[msgs.length - 1] = { role: "assistant", content: "Something went wrong. Please try again." };
        } else {
          msgs.push({ role: "assistant", content: "Something went wrong. Please try again." });
        }
        return msgs;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Chat Platform
        </h1>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-zinc-400 mt-16">
            Send a message to start the conversation.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-white text-zinc-800 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
              }`}
            >
              {msg.role === "assistant" && loading && i === messages.length - 1 && msg.content === "" ? (
                <span className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
                </span>
              ) : (
                msg.content
              )}
            </div>

            {msg.meta && (
              <div className="mt-1 px-1 text-xs text-zinc-400 dark:text-zinc-500 font-mono flex gap-3 flex-wrap max-w-[75%]">
                <span>{msg.meta.model}</span>
                <span>↑{msg.meta.inputTokens} ↓{msg.meta.outputTokens} tok</span>
                <span>{msg.meta.stopReason}</span>
                <span>ttft {msg.meta.ttft}ms · {msg.meta.elapsed}ms</span>
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message..."
            disabled={loading}
            className="flex-1 rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-full bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
