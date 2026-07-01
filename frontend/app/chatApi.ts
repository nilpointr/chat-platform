export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "metadata"; model: string; input_tokens: number; output_tokens: number; stop_reason: string }
  | { type: "error" };

// Sends the chat request and invokes onEvent for each SSE event as it arrives.
// Throws on network failure or a non-OK response; callers handle that themselves.
export async function streamChat(
  backendUrl: string,
  requestBody: unknown,
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  const res = await fetch(`${backendUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
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

      onEvent(JSON.parse(data));
    }
  }
}
