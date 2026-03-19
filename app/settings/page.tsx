"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { LogOut, User } from "lucide-react";

export default function SettingsPage() {
  const { user, householdId, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-zinc-800 px-4">
          <h1 className="text-lg font-semibold">Settings</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-6 p-6">
            {/* Account */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Account
              </h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{user.email}</p>
                      {user.username && <p className="text-xs text-zinc-500">{user.username}</p>}
                    </div>
                  </div>
                </div>

                {householdId && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <p className="text-xs text-zinc-500">Household ID</p>
                    <p className="mt-1 font-mono text-xs text-zinc-400">{householdId}</p>
                  </div>
                )}

                <button
                  onClick={() => { logout(); router.replace("/login"); }}
                  className="flex w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left text-sm text-red-400 transition-colors hover:bg-zinc-800"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </section>

            {/* About */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                About
              </h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-sm text-zinc-300">Jarvis Web</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Open-source voice assistant — fully private, self-hosted.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
