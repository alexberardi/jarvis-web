"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { browsePackages, getCategories, PantryCommand, PantryCategory } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Download,
  Loader2,
  Package,
  Search,
  Shield,
  X,
} from "lucide-react";

const SORT_OPTIONS = [
  { label: "Popular", value: "popular" },
  { label: "Newest", value: "newest" },
  { label: "A–Z", value: "name" },
];

const DANGER_COLORS: Record<number, string> = {
  1: "bg-green-500/20 text-green-400",
  2: "bg-lime-500/20 text-lime-400",
  3: "bg-amber-500/20 text-amber-400",
  4: "bg-orange-500/20 text-orange-400",
  5: "bg-red-500/20 text-red-400",
};

function PackageCard({ pkg }: { pkg: PantryCommand }) {
  const router = useRouter();
  const dangerCls = DANGER_COLORS[pkg.danger_rating] ?? "bg-zinc-800 text-zinc-400";

  return (
    <div
      onClick={() => router.push(`/pantry/${pkg.command_name}`)}
      className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-zinc-100">
              {pkg.display_name || pkg.command_name}
            </p>
            {pkg.verified && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-primary" />}
            {pkg.package_type === "bundle" && (
              <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Bundle
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{pkg.author}</p>
        </div>
        <div className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", dangerCls)}>
          <Shield className="mr-0.5 inline h-2.5 w-2.5" />
          {pkg.danger_rating}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{pkg.description}</p>
      <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {pkg.install_count}
        </span>
        <span>v{pkg.latest_version}</span>
      </div>
    </div>
  );
}

export default function PantryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [packages, setPackages] = useState<PantryCommand[]>([]);
  const [categories, setCategories] = useState<PantryCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sort, setSort] = useState("popular");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const PER_PAGE = 20;

  const loadPackages = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        const res = await browsePackages({
          q: query || undefined,
          category: activeCategory ?? undefined,
          sort,
          page: pageNum,
          per_page: PER_PAGE,
        });

        setPackages((prev) => (append ? [...prev, ...res.commands] : res.commands));
        setTotal(res.total);
        setPage(pageNum);
      } catch {
        setError("Could not load packages");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, activeCategory, sort],
  );

  // Load categories once
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  // Reload packages when filters change (debounce search)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadPackages(1, false), query ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [loadPackages, query]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  const hasMore = packages.length < total;

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-zinc-800 px-4">
          <h1 className="text-lg font-semibold">Pantry</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl p-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search packages..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-8 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-primary"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    !activeCategory ? "bg-primary text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      activeCategory === cat.name
                        ? "bg-primary text-white"
                        : "bg-zinc-800 text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    {cat.name}
                    <span className="ml-1 opacity-60">{cat.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Sort */}
            <div className="mt-3 flex gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    sort === opt.value
                      ? "bg-zinc-700 text-zinc-100"
                      : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="mt-4">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-2 py-16">
                  <p className="text-zinc-400">{error}</p>
                  <button onClick={() => loadPackages(1, false)} className="text-sm text-primary hover:underline">
                    Retry
                  </button>
                </div>
              ) : packages.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16">
                  <Package className="h-10 w-10 text-zinc-600" />
                  <p className="text-zinc-400">No packages found</p>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs text-zinc-500">{total} package{total !== 1 && "s"}</p>
                  <div className="space-y-2">
                    {packages.map((pkg) => (
                      <PackageCard key={pkg.command_name} pkg={pkg} />
                    ))}
                  </div>
                  {hasMore && (
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={() => loadPackages(page + 1, true)}
                        disabled={loadingMore}
                        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                      >
                        {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
