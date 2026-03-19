"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { deleteInboxItem, getInboxItem, InboxItem, markItemRead, sendNodeAction } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Loader2, Trash2 } from "lucide-react";

function parseThinkBlock(body: string): { thinking: string | null; content: string } {
  const match = body.match(/<think>([\s\S]*?)<\/think>/);
  if (!match) return { thinking: null, content: body.trim() };
  const thinking = match[1].trim();
  const content = body.replace(/<think>[\s\S]*?<\/think>/, "").trim();
  return { thinking: thinking || null, content };
}

export default function InboxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [item, setItem] = useState<InboxItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionComplete, setActionComplete] = useState(false);

  const loadItem = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setLoading(true);
      const data = await getInboxItem(id);
      setItem(data);
      if (!data.is_read) markItemRead(id).catch(() => {});
    } catch {
      setError("Could not load item");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadItem();
  }, [user, loadItem]);

  const handleAction = async (actionName: string) => {
    if (!item?.metadata) return;
    const { command_name, node_id, draft } = item.metadata as Record<string, string>;
    if (!command_name || !node_id) return;

    setActionLoading(actionName);
    try {
      await sendNodeAction(node_id, {
        command_name,
        action_name: actionName,
        context: { draft },
      });
      setActionComplete(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!item || !confirm(`Delete "${item.title}"?`)) return;
    try {
      await deleteInboxItem(item.id);
      router.push("/inbox");
    } catch {
      alert("Failed to delete");
    }
  };

  if (authLoading || !user) return null;

  const sources = (item?.metadata?.sources ?? []) as Array<{ title: string; url: string }>;
  const actions = (item?.metadata?.actions ?? []) as Array<{
    button_text: string;
    button_action: string;
    button_type: string;
  }>;
  const isConfirmation = item?.category === "confirmation" && actions.length > 0;
  const { thinking, content } = item ? parseThinkBlock(item.body) : { thinking: null, content: "" };

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
          <button
            onClick={() => router.push("/inbox")}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Inbox
          </button>
          <button onClick={handleDelete} className="rounded-lg p-2 text-zinc-500 hover:text-red-400">
            <Trash2 className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : error || !item ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-zinc-400">{error || "Item not found"}</p>
              <button onClick={loadItem} className="text-sm text-primary hover:underline">Retry</button>
            </div>
          ) : (
            <article className="mx-auto max-w-2xl p-6">
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-300">
                {item.category.replace(/_/g, " ")}
              </span>

              <h1 className="mt-3 text-2xl font-bold">{item.title}</h1>

              <p className="mt-1 text-xs text-zinc-500">
                {new Date(item.created_at).toLocaleString()} | {item.source_service}
              </p>

              <hr className="my-4 border-zinc-800" />

              <div className="prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-3 leading-relaxed text-zinc-200">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
                    h1: ({ children }) => <h1 className="mb-3 mt-6 text-xl font-bold">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-2 mt-5 text-lg font-bold">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-bold">{children}</h3>,
                    ul: ({ children }) => <ul className="mb-3 list-disc pl-5">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-3 list-decimal pl-5">{children}</ol>,
                    li: ({ children }) => <li className="mb-1 text-zinc-200">{children}</li>,
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {children}
                      </a>
                    ),
                    hr: () => <hr className="my-4 border-zinc-800" />,
                    code: ({ children }) => (
                      <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">{children}</code>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>

              {/* Action buttons for confirmations */}
              {isConfirmation && !actionComplete && (
                <div className="mt-6 flex gap-2">
                  {actions.map((action) => (
                    <button
                      key={action.button_action}
                      onClick={() => handleAction(action.button_action)}
                      disabled={actionLoading !== null}
                      className={cn(
                        "rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                        action.button_type === "primary"
                          ? "bg-primary-deep text-white hover:bg-primary-hover"
                          : action.button_type === "destructive"
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600",
                      )}
                    >
                      {actionLoading === action.button_action ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        action.button_text
                      )}
                    </button>
                  ))}
                </div>
              )}

              {actionComplete && (
                <div className="mt-6 rounded-lg bg-green-900/30 px-4 py-2 text-sm text-green-400">
                  Action completed
                </div>
              )}

              {/* Thinking block */}
              {thinking && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowThinking(!showThinking)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400"
                  >
                    {showThinking ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {showThinking ? "Hide reasoning" : "Show reasoning"}
                  </button>
                  {showThinking && (
                    <div className="mt-2 rounded-lg bg-zinc-900 p-3 text-xs italic leading-relaxed text-zinc-500">
                      {thinking}
                    </div>
                  )}
                </div>
              )}

              {/* Sources */}
              {sources.length > 0 && (
                <>
                  <hr className="my-4 border-zinc-800" />
                  <h3 className="mb-2 text-sm font-semibold">Sources</h3>
                  <ul className="space-y-1">
                    {sources.map((src, i) => (
                      <li key={i}>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {src.title || src.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Research stats */}
              {item.metadata?.elapsed_seconds != null && (
                <p className="mt-4 text-right text-xs text-zinc-500">
                  Researched in {String(item.metadata.elapsed_seconds)}s |{" "}
                  {String(item.metadata.pages_scraped)}/{String(item.metadata.pages_attempted)} pages
                </p>
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
