"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStream } from "./useChatStream";
import { SystemPromptPanel } from "./SystemPromptPanel";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export default function Home() {
  const { messages, loading, sendMessage } = useChatStream(BACKEND_URL);
  const [input, setInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    await sendMessage(text, systemPrompt);
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Chat Platform
        </h1>
      </header>

      <SystemPromptPanel
        systemPrompt={systemPrompt}
        onSystemPromptChange={setSystemPrompt}
        open={panelOpen}
        onToggleOpen={() => setPanelOpen((o) => !o)}
      />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-zinc-400 mt-16">
            Send a message to start the conversation.
          </p>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            showTypingIndicator={msg.role === "assistant" && loading && i === messages.length - 1 && msg.content === ""}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      <ChatInput value={input} onChange={setInput} onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
