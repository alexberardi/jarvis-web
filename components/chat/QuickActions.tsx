"use client";

import { cn } from "@/lib/utils";

interface QuickAction {
  label: string;
  prompt: string;
}

const ALL_QUICK_ACTIONS: QuickAction[] = [
  { label: "Weather", prompt: "What's the weather?" },
  { label: "Set a timer", prompt: "Set a timer for 5 minutes" },
  { label: "Email", prompt: "Check my email" },
  { label: "Sports scores", prompt: "What are today's sports scores?" },
  { label: "Calendar", prompt: "What's on my calendar today?" },
  { label: "Calculate", prompt: "What is 15% of 85?" },
  { label: "Jokes", prompt: "Tell me a joke" },
  { label: "News", prompt: "What's in the news today?" },
  { label: "Bluetooth", prompt: "Bluetooth status" },
  { label: "Research", prompt: "Research the best coffee beans" },
];

interface QuickActionsProps {
  onSelect: (prompt: string) => void;
}

export function QuickActions({ onSelect }: QuickActionsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <p className="mb-6 text-lg text-zinc-400">Ask <span className="text-primary">Jarvis</span> anything</p>
      <div className="flex max-w-md flex-wrap justify-center gap-2">
        {ALL_QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onSelect(action.prompt)}
            className={cn(
              "rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300",
              "transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
