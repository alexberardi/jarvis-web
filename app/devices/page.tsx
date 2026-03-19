"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { controlDevice, DeviceListItem, listDevices, listRooms, Room } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Lightbulb, Lock, Thermometer, Fan, Blinds, Power, Loader2, RefreshCw } from "lucide-react";

const DOMAIN_ICONS: Record<string, typeof Power> = {
  light: Lightbulb,
  lock: Lock,
  climate: Thermometer,
  fan: Fan,
  cover: Blinds,
};

function DeviceCard({ device, householdId }: { device: DeviceListItem; householdId: string }) {
  const [state, setState] = useState(device.state);
  const [toggling, setToggling] = useState(false);
  const Icon = DOMAIN_ICONS[device.domain] ?? Power;
  const isOn = state === "on" || state === "unlocked" || state === "open";

  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const action = isOn ? "turn_off" : "turn_on";
      await controlDevice(householdId, device.id, { action });
      setState(isOn ? "off" : "on");
    } catch {
      // Revert on failure
    } finally {
      setToggling(false);
    }
  };

  const isToggleable = ["light", "switch", "fan"].includes(device.domain);

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors",
        isToggleable && "cursor-pointer hover:border-zinc-700",
      )}
      onClick={isToggleable ? handleToggle : undefined}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            isOn ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500",
          )}
        >
          {toggling ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-100">{device.name}</p>
          <p className="text-xs text-zinc-500">{device.entity_id}</p>
        </div>
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
          isOn ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500",
        )}
      >
        {state ?? "unknown"}
      </span>
    </div>
  );
}

export default function DevicesPage() {
  const { user, householdId, loading: authLoading } = useAuth();
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceListItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!householdId) return;
    try {
      setError(null);
      setLoading(true);
      const [devs, rms] = await Promise.all([listDevices(householdId), listRooms(householdId)]);
      setDevices(devs);
      setRooms(rms);
    } catch {
      setError("Could not load devices");
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && householdId) loadData();
  }, [user, householdId, loadData]);

  if (authLoading || !user) return null;

  // Group devices by room
  const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
  const grouped = new Map<string, DeviceListItem[]>();
  for (const device of devices) {
    const roomName = device.room_name ?? roomMap.get(device.room_id ?? "") ?? "Unassigned";
    if (!grouped.has(roomName)) grouped.set(roomName, []);
    grouped.get(roomName)!.push(device);
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
          <h1 className="text-lg font-semibold">Devices</h1>
          <button onClick={loadData} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
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
              <button onClick={loadData} className="text-sm text-primary hover:underline">Retry</button>
            </div>
          ) : devices.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Power className="h-10 w-10 text-zinc-600" />
              <p className="text-zinc-400">No devices registered</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-6 p-4">
              {[...grouped.entries()].map(([roomName, roomDevices]) => (
                <div key={roomName}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {roomName}
                  </h2>
                  <div className="space-y-2">
                    {roomDevices.map((device) => (
                      <DeviceCard key={device.id} device={device} householdId={householdId!} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
