# Context Window Management Strategies

LLM APIs accept a finite amount of text per request. Every token in that
window costs money and contributes to latency, so a chat application must
decide what history to include and what to discard. This document surveys
common strategies, from simplest to most sophisticated, with trade-offs for
each.

---

## The problem

A conversation grows unboundedly. A context window does not. Left unmanaged,
a long chat will eventually exceed the model's token limit and the API will
return an error. Even well short of that limit, sending a large context on
every request drives up cost and slows responses.

The goal of context management is to keep the history sent to the model
useful and bounded. "Useful" is the hard part — the simplest strategies
optimize for bounded; the more sophisticated ones try to preserve utility
as they trim.

---

## Strategy 1 — Fixed rolling window (message count)

**How it works.** Keep only the most recent N messages. Every request trims
the history array to `messages[-N:]` before sending.

**Example.** With N = 10, a 25-message conversation sends messages 16–25.
Messages 1–15 are silently dropped.

**Pros.**
- Trivial to implement; one slice operation.
- Predictable: you always send at most N messages.
- No dependency on token counting.

**Cons.**
- Message count is a poor proxy for token count. Ten short messages might be
  200 tokens; ten long code blocks might be 8,000. Cost and window usage are
  unpredictable.
- Drops context abruptly with no signal to the model that earlier history
  existed.
- Can orphan a message (e.g., drop a user message but keep the assistant
  reply that answered it) if N cuts mid-pair.

**When to use.** Prototypes and MVPs where simplicity matters more than
precision. Replace it once conversation length becomes variable or costs
become a concern.

---

## Strategy 2 — Token-budget trimming (approximate)

**How it works.** Assign a token budget for the messages array. Estimate the
token count of the history using a cheap heuristic, then drop the oldest
messages one at a time until the estimate is under budget.

The standard heuristic: **1 token ≈ 4 characters** of English prose. This
is a rough average — code, non-English text, and special characters skew it
— but it is accurate enough to enforce a loose budget without an API call.

```python
def estimate_tokens(messages):
    return sum(len(m["content"]) for m in messages) // 4

def trim_to_budget(messages, budget=4096):
    while estimate_tokens(messages) > budget and messages:
        messages = messages[1:]
    return messages
```

**Pros.**
- Bounds cost in token terms, not message terms.
- No extra API call; the estimate is O(n) over character counts.
- Simple to reason about and audit.

**Cons.**
- The 4-char heuristic is an approximation. Actual token counts can diverge
  by 20–30% on atypical input (dense code, Unicode, markup).
- Still drops context abruptly.
- May drop the first message of a user/assistant pair (see Strategy 3).

**When to use.** The practical first upgrade from a fixed rolling window.
Handles variable-length messages gracefully without adding latency.

---

## Strategy 3 — Pair-aware token-budget trimming

**How it works.** Same as Strategy 2, but always drop messages in
user+assistant pairs. This ensures the history stays semantically coherent —
every assistant response the model sees has the user turn that prompted it.

```python
def trim_to_budget(messages, budget=4096):
    while estimate_tokens(messages) > budget and len(messages) >= 2:
        # Drop oldest pair
        messages = messages[2:]
    # Ensure we always send at least the final user message
    if not messages:
        messages = messages[-1:]
    return messages
```

**Pros.**
- All the benefits of Strategy 2.
- History is always a valid sequence of alternating user/assistant turns.
- Avoids confusing the model with a dangling assistant message at the start
  of the array.

**Cons.**
- Drops pairs rather than individual messages, so the actual token usage
  after trimming may be further below budget than necessary.
- Still no graceful degradation — older context vanishes without a trace.

**When to use.** The recommended default for most production chat
applications that use approximate token counting. Low complexity, high
correctness.

---

## Strategy 4 — Token-budget trimming (exact)

**How it works.** Same as Strategy 2 or 3, but use the model provider's
token-counting API instead of a character heuristic.

Anthropic exposes a `count_tokens` endpoint:

```python
response = client.messages.count_tokens(
    model="claude-haiku-4-5-20251001",
    messages=[m.model_dump() for m in messages],
)
token_count = response.input_tokens
```

**Pros.**
- Exact token counts, accounting for the model's actual tokenizer.
- No risk of the heuristic drifting on code, non-English text, or structured
  data.

**Cons.**
- Adds a synchronous API call before every chat request — extra latency and
  a small additional cost.
- Counting and chat requests can get out of sync if history mutates between
  them.
- The improvement over a well-chosen approximate budget is marginal for most
  applications.

**When to use.** When the input is highly variable (multilingual chat, code
assistants, document Q&A) and the cost of over-estimating is significant.
Rarely worth it over Strategy 3 for typical chat UIs.

---

## Strategy 5 — Summarization

**How it works.** When the history exceeds the budget, instead of dropping
the oldest messages outright, send them to the model with a prompt asking
for a concise summary. Replace the dropped messages with a single synthetic
message containing that summary, then continue.

```
[Conversation so far]
User: What is FastAPI?
Assistant: FastAPI is a modern Python web framework...
User: How does it compare to Flask?
Assistant: Flask is more minimal...
...

[Injected summary message]
System (summary): The user asked about FastAPI vs Flask. The assistant
explained that FastAPI is faster and has built-in async support and
automatic OpenAPI docs, while Flask is simpler but lacks these features.
```

**Pros.**
- Preserves semantic context that would otherwise be lost.
- The model can refer back to earlier topics without the full token cost.

**Cons.**
- Requires a second model call per trim event — added latency and cost.
- Summary quality varies; the model may omit details that turn out to matter.
- Implementation complexity is significantly higher: you must manage summary
  state, decide when to summarize vs. trim, and handle failures in the
  summary call.
- Introduces a dependency on the quality of the summarizing model.

**When to use.** Long-running assistants where continuity across many turns
is essential — customer support bots, document editors, extended coding
sessions. Not warranted for most chat MVPs.

---

## Comparison

| Strategy | Token accuracy | Complexity | Latency impact | Context loss |
|---|---|---|---|---|
| Fixed rolling window | None (count-based) | Minimal | None | Abrupt |
| Token-budget (approximate) | ±20–30% | Low | None | Abrupt |
| Pair-aware token-budget | ±20–30% | Low | None | Abrupt, coherent |
| Token-budget (exact) | Exact | Low–medium | +1 API call | Abrupt |
| Summarization | N/A | High | +1 model call | Graceful |

---

## Choosing a budget

The budget is separate from the strategy. A few anchors:

- **Model context window.** Check the provider's documentation. Claude Haiku
  has a 200K-token context window, so the hard limit is rarely the
  constraint.
- **Cost targets.** Input tokens are cheaper than output tokens but not free.
  A 4K-token history budget is a reasonable conservative ceiling for a
  general-purpose chat UI.
- **System prompt overhead.** System prompt tokens count against the same
  budget. If your system prompt is 500 tokens, a 4K history budget leaves
  ~3.5K for conversation.
- **Max output tokens.** Your `max_tokens` setting (e.g., 1024) is reserved
  separately and does not compete with history.

A starting budget of **4,096 tokens for the messages array** is a sensible
default. Adjust up if users need longer working memory; adjust down if cost
is a primary concern.

---

## Further directions

The strategies above are all *what to send*. More advanced systems also
think about *how to store* history:

- **Vector retrieval (RAG):** Store every message in a vector database.
  Before each request, retrieve the K most semantically similar past messages
  rather than the K most recent ones.
- **Memory layers:** Maintain a structured long-term memory (facts about the
  user, past decisions, open tasks) updated by the model itself, separate
  from raw message history.
- **Agentic context:** In multi-step agent loops, context includes tool
  calls, observations, and scratchpad state — each with its own trimming
  concerns.

These are meaningful jumps in architectural complexity and are outside the
scope of this document.
