"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { getSmartHomeConfig, SmartHomeConfig, updateSmartHomeConfig } from "@/lib/api";
import Link from "next/link";
import { ChevronRight, Home, Loader2, LogOut, Power, User } from "lucide-react";

export default function SettingsPage() {
  const { user, householdId, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [smartHomeConfig, setSmartHomeConfig] = useState<SmartHomeConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!householdId) return;
    setConfigLoading(true);
    getSmartHomeConfig(householdId)
      .then(setSmartHomeConfig)
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, [householdId]);

  const handleExternalDevicesToggle = useCallback(async () => {
    if (!householdId || !smartHomeConfig || toggling) return;
    const prev = smartHomeConfig.use_external_devices;
    const next = !prev;
    setSmartHomeConfig((c) => c ? { ...c, use_external_devices: next } : c);
    setToggling(true);
    try {
      const updated = await updateSmartHomeConfig(householdId, { use_external_devices: next });
      setSmartHomeConfig((c) => c ? { ...c, ...updated } : c);
    } catch {
      setSmartHomeConfig((c) => c ? { ...c, use_external_devices: prev } : c);
    } finally {
      setToggling(false);
    }
  }, [householdId, smartHomeConfig, toggling]);

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

                <Link
                  href="/settings/household"
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:bg-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">Household</p>
                      <p className="text-xs text-zinc-500">Members, invites, settings</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </Link>

                <button
                  onClick={() => { logout(); router.replace("/login"); }}
                  className="flex w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-left text-sm text-red-400 transition-colors hover:bg-zinc-800"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </section>

            {/* Smart Home */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Smart Home
              </h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Power className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">Use External Devices</p>
                      <p className="text-xs text-zinc-500">
                        Show devices from your device manager (read-only)
                      </p>
                    </div>
                  </div>
                  {configLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  ) : (
                    <button
                      onClick={handleExternalDevicesToggle}
                      disabled={toggling || !smartHomeConfig}
                      className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50"
                      style={{ backgroundColor: smartHomeConfig?.use_external_devices ? "var(--color-primary)" : "#3f3f46" }}
                    >
                      <span
                        className="absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform"
                        style={{ transform: smartHomeConfig?.use_external_devices ? "translateX(22px)" : "translateX(2px)" }}
                      />
                    </button>
                  )}
                </div>
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
