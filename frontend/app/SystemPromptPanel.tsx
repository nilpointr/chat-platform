type Preset = {
  label: string;
  prompt: string;
};

const PRESETS: Preset[] = [
  {
    label: "Pirate",
    prompt:
      "You are a pirate captain. Respond only in pirate speak, using seafaring metaphors and exclamations like 'Arrr!' and 'Shiver me timbers!'",
  },
];

type SystemPromptPanelProps = {
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  open: boolean;
  onToggleOpen: () => void;
};

export function SystemPromptPanel({
  systemPrompt,
  onSystemPromptChange,
  open,
  onToggleOpen,
}: SystemPromptPanelProps) {
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
      <button
        onClick={onToggleOpen}
        className="w-full px-4 py-2 flex items-center gap-2 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
      >
        <span className="font-medium text-zinc-600 dark:text-zinc-400 shrink-0">System prompt</span>
        <span className="flex-1 truncate text-zinc-400 dark:text-zinc-500">
          {systemPrompt || "None"}
        </span>
        <span
          className={`text-zinc-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 self-center">Examples:</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => onSystemPromptChange(p.prompt)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  systemPrompt === p.prompt
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-zinc-500 dark:hover:border-zinc-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="Define the assistant's persona or instructions..."
            rows={3}
            className="w-full text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-none"
          />
        </div>
      )}
    </div>
  );
}
