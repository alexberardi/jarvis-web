"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { ChatAction, ChatMessage } from "@/lib/api";
import { Bot, ChevronDown, ChevronRight, Loader2, User } from "lucide-react";

interface ParsedContent {
  thinking: string | null;
  body: string;
}

function parseThinkTags(content: string): ParsedContent {
  const match = content.match(/<think>([\s\S]*?)<\/think>\s*/);
  if (match) {
    return {
      thinking: match[1].trim() || null,
      body: content.slice(match.index! + match[0].length).trim(),
    };
  }
  // Unclosed <think> — still streaming thinking content
  if (content.startsWith("<think>") && !content.includes("</think>")) {
    return {
      thinking: content.slice(7).trim() || null,
      body: "",
    };
  }
  return { thinking: null, body: content };
}

interface ChatBubbleProps {
  message: ChatMessage;
  onAction?: (action: string, context: Record<string, unknown>) => void;
}

export function ChatBubble({ message, onAction }: ChatBubbleProps) {
  const isUser = message.role === "user";
  const isStatus = message.role === "status";
  const isEmpty = message.content === "";

  if (isStatus) {
    return (
      <div className="flex justify-center py-2">
        <span className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          {message.content}
        </span>
      </div>
    );
  }

  const { thinking, body } = isUser ? { thinking: null, body: message.content } : parseThinkTags(message.content);

  return (
    <div className={cn("flex gap-3 py-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={cn("max-w-[75%] space-y-2")}>
        {thinking && <ThinkingBlock content={thinking} isStreaming={!body} />}

        {(body || (!thinking && isEmpty)) && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              isUser
                ? "bg-primary-deep text-white"
                : "bg-zinc-800 text-zinc-100",
            )}
          >
            {!body && isEmpty ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            ) : isUser ? (
              <p className="whitespace-pre-wrap">{body}</p>
            ) : (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
                  li: ({ children }) => <li className="mb-0.5">{children}</li>,
                  code: ({ children }) => (
                    <code className="rounded bg-zinc-700 px-1 py-0.5 text-xs">{children}</code>
                  ),
                }}
              >
                {body}
              </ReactMarkdown>
            )}
          </div>
        )}

        {message.actionPreview && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            <p className="whitespace-pre-wrap">{message.actionPreview}</p>
          </div>
        )}

        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <ActionButton
                key={action.button_action}
                action={action}
                onClick={() =>
                  onAction?.(
                    action.button_action,
                    message.actionContext?.context ?? {},
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-zinc-200">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-400"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {isStreaming ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </span>
        ) : (
          "Thought process"
        )}
      </button>
      {open && (
        <div className="border-t border-zinc-700/50 px-3 py-2 text-xs italic leading-relaxed text-zinc-500">
          {content}
        </div>
      )}
    </div>
  );
}

function ActionButton({ action, onClick }: { action: ChatAction; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        action.button_type === "primary" && "bg-primary-deep text-white hover:bg-primary-hover",
        action.button_type === "secondary" && "bg-zinc-700 text-zinc-200 hover:bg-zinc-600",
        action.button_type === "destructive" && "bg-red-600 text-white hover:bg-red-700",
      )}
    >
      {action.button_text}
    </button>
  );
}
