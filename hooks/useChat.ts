"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatMessage,
  ChatStreamEvent,
  fetchNodeTools,
  NodeToolsResponse,
  sendChatMessage,
  warmupChat,
} from "@/lib/api";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function extractToolNames(tools: Record<string, unknown>[]): string[] {
  return tools
    .map((t) => {
      const fn = t.function as Record<string, unknown> | undefined;
      return (fn?.name as string) ?? "";
    })
    .filter(Boolean);
}

const TOOLS_CACHE_KEY = "jarvis_node_tools_";

function loadCachedTools(nodeId: string): NodeToolsResponse | null {
  try {
    const raw = localStorage.getItem(TOOLS_CACHE_KEY + nodeId);
    return raw ? (JSON.parse(raw) as NodeToolsResponse) : null;
  } catch {
    return null;
  }
}

function saveCachedTools(nodeId: string, tools: NodeToolsResponse): void {
  try {
    localStorage.setItem(TOOLS_CACHE_KEY + nodeId, JSON.stringify(tools));
  } catch {
    // Non-critical
  }
}

export type WarmupState = "idle" | "loading_tools" | "warming_up" | "ready";

interface UseChatOptions {
  nodeId: string | null;
  householdId: string | null;
  accessToken: string | null;
}

interface UseChatReturn {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  warmupState: WarmupState;
  toolNames: string[];
  sendMessage: (text: string) => void;
  clearConversation: () => void;
}

export function useChat({ nodeId, householdId, accessToken }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [warmupState, setWarmupState] = useState<WarmupState>("idle");
  const [toolNames, setToolNames] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string | null>(null);
  const toolsRef = useRef<NodeToolsResponse | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Startup: fetch tools → warmup conversation
  useEffect(() => {
    if (!nodeId || !householdId || !accessToken) {
      toolsRef.current = null;
      setWarmupState("idle");
      return;
    }

    let cancelled = false;

    const startup = async () => {
      setWarmupState("loading_tools");

      const cached = loadCachedTools(nodeId);
      if (cached && cached.client_tools.length > 0 && !cancelled) {
        toolsRef.current = cached;
        setToolNames(extractToolNames(cached.client_tools));
      }

      try {
        const fresh = await fetchNodeTools(nodeId);
        if (!cancelled && fresh.client_tools.length > 0) {
          toolsRef.current = fresh;
          setToolNames(extractToolNames(fresh.client_tools));
          saveCachedTools(nodeId, fresh);
        }
      } catch {
        // Cache is fine
      }

      if (cancelled) return;

      setWarmupState("warming_up");
      try {
        const tools = toolsRef.current;
        const result = await warmupChat(
          nodeId,
          householdId,
          accessToken,
          tools?.client_tools,
          tools?.available_commands,
          timezone,
        );
        if (!cancelled) {
          setConversationId(result.conversation_id);
          setWarmupState("ready");
        }
      } catch {
        if (!cancelled) setWarmupState("ready");
      }
    };

    startup();
    return () => { cancelled = true; };
  }, [nodeId, householdId, accessToken, timezone]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!nodeId || !householdId || !accessToken || isLoading) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      const assistantId = generateId();
      assistantIdRef.current = assistantId;

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
      ]);
      setIsLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const handleEvent = (event: ChatStreamEvent) => {
        switch (event.type) {
          case "status":
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.id === assistantIdRef.current && last.content === "") {
                return [...prev.slice(0, -1), { ...last, role: "status" as const, content: event.message ?? "" }];
              }
              return prev;
            });
            break;
          case "delta":
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantIdRef.current
                  ? { ...msg, role: "assistant" as const, content: (msg.role === "status" ? "" : msg.content) + (event.text ?? "") }
                  : msg,
              ),
            );
            break;
          case "done":
            if (event.conversation_id) setConversationId(event.conversation_id);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantIdRef.current
                  ? { ...msg, role: "assistant" as const, content: event.full_text ?? msg.content, actions: event.actions, actionContext: event.action_context, actionPreview: event.action_preview }
                  : msg,
              ),
            );
            setIsLoading(false);
            break;
          case "error":
            if (event.conversation_id) setConversationId(event.conversation_id);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantIdRef.current
                  ? { ...msg, role: "assistant" as const, content: event.message ?? "Something went wrong." }
                  : msg,
              ),
            );
            setIsLoading(false);
            break;
        }
      };

      const tools = toolsRef.current;
      const includeTools = !conversationId && tools && tools.client_tools.length > 0;

      sendChatMessage(
        {
          message: text.trim(),
          node_id: nodeId,
          household_id: householdId,
          conversation_id: conversationId ?? undefined,
          timezone,
          ...(includeTools ? { client_tools: tools.client_tools, available_commands: tools.available_commands } : {}),
        },
        accessToken,
        handleEvent,
        controller.signal,
      ).catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantIdRef.current
              ? { ...msg, role: "assistant" as const, content: err instanceof Error ? err.message : "Connection failed." }
              : msg,
          ),
        );
        setIsLoading(false);
      });
    },
    [nodeId, householdId, accessToken, conversationId, isLoading, timezone],
  );

  const clearConversation = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setIsLoading(false);
    setWarmupState("idle");

    if (nodeId && householdId && accessToken) {
      setWarmupState("warming_up");
      const tools = toolsRef.current;
      warmupChat(nodeId, householdId, accessToken, tools?.client_tools, tools?.available_commands)
        .then((result) => { setConversationId(result.conversation_id); setWarmupState("ready"); })
        .catch(() => setWarmupState("ready"));
    }
  }, [nodeId, householdId, accessToken]);

  return { messages, conversationId, isLoading, warmupState, toolNames, sendMessage, clearConversation };
}
