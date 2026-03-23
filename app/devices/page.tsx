"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  controlDevice,
  DeviceListItem,
  ExternalDeviceItem,
  getSmartHomeConfig,
  listDevices,
  listRooms,
  pollDeviceList,
  requestDeviceList,
  Room,
  SmartHomeConfig,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Lightbulb, Lock, Thermometer, Fan, Blinds, Power, Loader2, RefreshCw } from "lucide-react";

const DOMAIN_ICONS: Record<string, typeof Power> = {
  light: Lightbulb,
  lock: Lock,
  climate: Thermometer,
  fan: Fan,
  cover: Blinds,
};

// ─── DB-backed device card (toggleable) ──────────────────────────────────

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

// ─── External device card (read-only) ────────────────────────────────────

function ExternalDeviceCard({ device }: { device: ExternalDeviceItem }) {
  const Icon = DOMAIN_ICONS[device.domain] ?? Power;
  const isOn = device.state === "on" || device.state === "unlocked" || device.state === "open";

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            isOn ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500",
          )}
        >
          <Icon className="h-5 w-5" />
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
        {device.state ?? "unknown"}
      </span>
    </div>
  );
}

// ─── Hook: fetch external devices via request/poll ───────────────────────

const MAX_POLLS = 30;
const POLL_INTERVAL_MS = 1000;

function useExternalDevices(primaryNodeId: string | null) {
  const [devices, setDevices] = useState<ExternalDeviceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    if (!primaryNodeId) {
      setError("No primary node configured");
      return;
    }
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const { id: requestId } = await requestDeviceList(primaryNodeId);
      for (let i = 0; i < MAX_POLLS; i++) {
        if (cancelledRef.current) return;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const result = await pollDeviceList(primaryNodeId, requestId);
        if (result.status === "completed") {
          setDevices(result.devices ?? []);
          setLoading(false);
          return;
        }
        if (result.status === "failed") {
          setError(result.error_message ?? "Device list request failed");
          setLoading(false);
          return;
        }
      }
      setError("Timed out waiting for device list");
    } catch {
      setError("Could not fetch external devices");
    } finally {
      setLoading(false);
    }
  }, [primaryNodeId]);

  useEffect(() => {
    return () => { cancelledRef.current = true; };
  }, []);

  return { devices, loading, error, load };
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function DevicesPage() {
  const { user, householdId, loading: authLoading } = useAuth();
  const router = useRouter();

  // Smart home config (determines which mode we're in)
  const [config, setConfig] = useState<SmartHomeConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // DB-backed device state
  const [devices, setDevices] = useState<DeviceListItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const useExternal = config?.use_external_devices ?? false;
  const ext = useExternalDevices(useExternal ? (config?.primary_node_id ?? null) : null);

  // Load smart home config
  useEffect(() => {
    if (!householdId) return;
    setConfigLoading(true);
    getSmartHomeConfig(householdId)
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setConfigLoading(false));
  }, [householdId]);

  // Load DB devices (only when NOT external)
  const loadDbDevices = useCallback(async () => {
    if (!householdId) return;
    setDbError(null);
    setDbLoading(true);
    try {
      const [devs, rms] = await Promise.all([listDevices(householdId), listRooms(householdId)]);
      setDevices(devs);
      setRooms(rms);
    } catch {
      setDbError("Could not load devices");
    } finally {
      setDbLoading(false);
    }
  }, [householdId]);

  // Auto-load when config resolves
  useEffect(() => {
    if (configLoading || !user || !householdId) return;
    if (useExternal) {
      ext.load();
    } else {
      loadDbDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoading, useExternal, user, householdId]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  const loading = configLoading || (useExternal ? ext.loading : dbLoading);
  const error = useExternal ? ext.error : dbError;
  const handleRefresh = useExternal ? ext.load : loadDbDevices;

  // Group DB devices by room
  const roomMap = new Map(rooms.map((r) => [r.id, r.name]));
  const dbGrouped = new Map<string, DeviceListItem[]>();
  for (const device of devices) {
    const roomName = device.room_name ?? roomMap.get(device.room_id ?? "") ?? "Unassigned";
    if (!dbGrouped.has(roomName)) dbGrouped.set(roomName, []);
    dbGrouped.get(roomName)!.push(device);
  }

  // Group external devices by area
  const extGrouped = new Map<string, ExternalDeviceItem[]>();
  for (const device of ext.devices) {
    const area = device.area ?? "Unassigned";
    if (!extGrouped.has(area)) extGrouped.set(area, []);
    extGrouped.get(area)!.push(device);
  }

  const isEmpty = useExternal ? ext.devices.length === 0 : devices.length === 0;

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Devices</h1>
            {useExternal && (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-400">
                External
              </span>
            )}
          </div>
          <button onClick={handleRefresh} disabled={loading} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
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
              <button onClick={handleRefresh} className="text-sm text-primary hover:underline">Retry</button>
            </div>
          ) : isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Power className="h-10 w-10 text-zinc-600" />
              <p className="text-zinc-400">No devices found</p>
            </div>
          ) : useExternal ? (
            <div className="mx-auto max-w-2xl space-y-6 p-4">
              {[...extGrouped.entries()].map(([area, areaDevices]) => (
                <div key={area}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {area}
                  </h2>
                  <div className="space-y-2">
                    {areaDevices.map((device) => (
                      <ExternalDeviceCard key={device.entity_id} device={device} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-6 p-4">
              {[...dbGrouped.entries()].map(([roomName, roomDevices]) => (
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
