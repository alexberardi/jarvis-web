"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { deleteInboxItem, InboxItem, listInboxItems } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Inbox, Loader2, RefreshCw, Trash2 } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  deep_research: "bg-indigo-500",
  alert: "bg-red-500",
  reminder: "bg-amber-500",
  confirmation: "bg-blue-500",
};

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*/g, "").trim();
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 1) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
  if (diffHrs < 48) return "Yesterday";
  return date.toLocaleDateString();
}

export default function InboxPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await listInboxItems();
      setItems(data);
    } catch {
      setError("Could not load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadItems();
  }, [user, loadItems]);

  const handleDelete = async (e: React.MouseEvent, item: InboxItem) => {
    e.stopPropagation();
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await deleteInboxItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      alert("Failed to delete");
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
          <h1 className="text-lg font-semibold">Inbox</h1>
          <button onClick={loadItems} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
            <RefreshCw className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-zinc-400">{error}</p>
              <button onClick={loadItems} className="text-sm text-primary hover:underline">Retry</button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Inbox className="h-10 w-10 text-zinc-600" />
              <p className="text-zinc-400">No messages yet</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-2 p-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/inbox/${item.id}`)}
                  className={cn(
                    "group flex w-full flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-zinc-700",
                    !item.is_read && "border-l-2 border-l-primary",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase text-white",
                        CATEGORY_COLORS[item.category] ?? "bg-zinc-600",
                      )}
                    >
                      {item.category.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{formatDate(item.created_at)}</span>
                      <button
                        onClick={(e) => handleDelete(e, item)}
                        className="rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className={cn("text-sm", !item.is_read ? "font-semibold text-zinc-100" : "text-zinc-200")}>
                    {item.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-zinc-400">
                    {stripThinkTags(item.summary)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
