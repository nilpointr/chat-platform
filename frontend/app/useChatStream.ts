import { useReducer, useState } from "react";

export type MessageMeta = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  ttft: number;
  elapsed: number;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  meta?: MessageMeta;
};

// A discriminated union: each Action has a `type` string that TypeScript uses to narrow
// which extra fields (text/meta/etc.) are available in each reducer case below.
type Action =
  | { type: "user_sent"; text: string }
  | { type: "delta"; text: string }
  | { type: "metadata"; meta: MessageMeta }
  | { type: "error" };

const ERROR_MESSAGE = "Something went wrong. Please try again.";

// A reducer is just (state, action) => newState — no side effects, no reading outside
// variables. We use one here instead of several setMessages(prev => ...) calls because
// every state change in this file follows the same shape ("update the last message"),
// so centralizing that logic avoids repeating the array-copy-and-replace dance per case.
function messagesReducer(state: Message[], action: Action): Message[] {
  switch (action.type) {
    case "user_sent":
      // Append the user's message plus an empty assistant placeholder that
      // "delta" actions below will fill in as tokens stream back.
      return [...state, { role: "user", content: action.text }, { role: "assistant", content: "" }];
    case "delta": {
      // React state must be treated as immutable — never mutate `state` in place.
      // Copy everything except the last item, then append an updated copy of it.
      const last = state[state.length - 1];
      return [...state.slice(0, -1), { ...last, content: last.content + action.text }];
    }
    case "metadata": {
      const last = state[state.length - 1];
      return [...state.slice(0, -1), { ...last, meta: action.meta }];
    }
    case "error": {
      // Overwrite the in-progress assistant placeholder if there is one, otherwise
      // (e.g. the request failed before any placeholder was ever added) append fresh.
      const errored: Message = { role: "assistant", content: ERROR_MESSAGE };
      if (state.length > 0 && state[state.length - 1].role === "assistant") {
        return [...state.slice(0, -1), errored];
      }
      return [...state, errored];
    }
  }
}

export function useChatStream(backendUrl: string) {
  // useReducer(reducer, initialState) is an alternative to useState for state whose
  // updates depend on multiple related actions rather than one simple setter.
  const [messages, dispatch] = useReducer(messagesReducer, []);
  const [loading, setLoading] = useState(false);

  async function sendMessage(text: string, systemPrompt: string) {
    // `messages` here is a snapshot from the render that created this closure — dispatch()
    // doesn't update it synchronously, so we build the request body from this snapshot
    // before dispatching, rather than trying to read the "new" state right after.
    const historyForBackend = [...messages, { role: "user" as const, content: text }];
    dispatch({ type: "user_sent", text });
    setLoading(true);

    const startTime = Date.now();
    let ttft: number | null = null; // time-to-first-token, for the metadata footer

    try {
      const res = await fetch(`${backendUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForBackend, system_prompt: systemPrompt }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Network chunks don't align with SSE message boundaries — a chunk can end
        // mid-line. Buffer everything and only process lines once we see a newline;
        // whatever's left after the last newline is an incomplete line, held for next time.
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
            dispatch({ type: "delta", text: event.text });
          } else if (event.type === "metadata") {
            dispatch({
              type: "metadata",
              meta: {
                model: event.model,
                inputTokens: event.input_tokens,
                outputTokens: event.output_tokens,
                stopReason: event.stop_reason,
                ttft: ttft ?? 0,
                elapsed: Date.now() - startTime,
              },
            });
          } else if (event.type === "error") {
            dispatch({ type: "error" });
          }
        }
      }
    } catch {
      // Covers network failures and non-OK responses (thrown above) alike.
      dispatch({ type: "error" });
    } finally {
      // Always runs, whether the try block returned normally, threw, or broke out of
      // the loop early — guarantees the "loading" spinner never gets stuck on.
      setLoading(false);
    }
  }

  return { messages, loading, sendMessage };
}
