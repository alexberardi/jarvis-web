"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getUnreadCount } from "@/lib/api";
import { Inbox, LogOut, MessageSquare, Power, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Inbox", href: "/inbox", icon: Inbox, badge: true },
  { label: "Devices", href: "/devices", icon: Power },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, accessToken, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    getUnreadCount().then(setUnread).catch(() => {});
    const interval = setInterval(() => {
      getUnreadCount().then(setUnread).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [accessToken]);

  return (
    <aside className="flex w-56 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex h-14 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="text-lg font-semibold text-primary">Jarvis</span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.badge && unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-zinc-400">{user?.email}</span>
          <button onClick={logout} className="p-1 text-zinc-500 hover:text-zinc-300">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
