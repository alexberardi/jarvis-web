"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  createHousehold,
  createInvite,
  joinHousehold,
  leaveHousehold,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  updateHouseholdName,
  updateMemberRole,
  validateInviteCode,
} from "@/lib/api";
import { Check, ClipboardCopy, Home, LogOut, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = ["member", "power_user", "admin"] as const;

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    admin: "bg-purple-900/40 text-purple-300",
    power_user: "bg-blue-900/40 text-blue-300",
    member: "bg-zinc-800 text-zinc-400",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", colors[role] ?? colors.member)}>
      {role.replace("_", " ")}
    </span>
  );
}

export default function HouseholdSettingsPage() {
  const { user, householdId, households, loading: authLoading, refreshHouseholds } = useAuth();
  const router = useRouter();

  const [editingName, setEditingName] = useState(false);
  const [nameOverride, setNameOverride] = useState<string | null>(null);

  // Invite creation
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [newInviteRole, setNewInviteRole] = useState<string>("member");
  const [newInviteExpiry, setNewInviteExpiry] = useState(7);
  const [newInviteMaxUses, setNewInviteMaxUses] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Join flow
  const [joinCode, setJoinCode] = useState("");
  const [joinStatus, setJoinStatus] = useState<{ valid: boolean; household_name: string | null } | null>(null);
  const [joinError, setJoinError] = useState("");

  // Create household flow
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [createError, setCreateError] = useState("");

  // Leave flow
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const { data: members = [], error: membersError, refetch: refetchMembers } = useQuery({
    queryKey: ["household-members", householdId],
    queryFn: () => listMembers(householdId!),
    enabled: !!householdId,
  });

  const { data: invites = [], refetch: refetchInvites } = useQuery({
    queryKey: ["household-invites", householdId],
    queryFn: () => listInvites(householdId!),
    enabled: !!householdId,
  });

  const activeHousehold = households.find((h) => h.id === householdId);
  const myMembership = members.find((m) => m.user_id === user?.id);
  const isAdmin = myMembership?.role === "admin";
  const canLeave = households.length > 1;

  const loadError = membersError ? "Failed to load members" : "";
  const householdName = activeHousehold?.name ?? "";
  const nameInput = nameOverride ?? householdName;

  const loadData = useCallback(() => {
    refetchMembers();
    refetchInvites();
  }, [refetchMembers, refetchInvites]);

  const handleSaveName = async () => {
    if (!householdId || !nameInput.trim()) return;
    await updateHouseholdName(householdId, nameInput.trim());
    setEditingName(false);
    setNameOverride(null);
    refreshHouseholds();
  };

  const handleCreateInvite = async () => {
    if (!householdId) return;
    const maxUses = newInviteMaxUses ? parseInt(newInviteMaxUses, 10) : null;
    await createInvite(householdId, {
      default_role: newInviteRole,
      expires_in_days: newInviteExpiry,
      max_uses: maxUses,
    });
    setShowCreateInvite(false);
    setNewInviteRole("member");
    setNewInviteExpiry(7);
    setNewInviteMaxUses("");
    loadData();
  };

  const handleRevokeInvite = async (inviteId: number) => {
    if (!householdId) return;
    await revokeInvite(householdId, inviteId);
    loadData();
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRoleChange = async (userId: number, role: string) => {
    if (!householdId) return;
    await updateMemberRole(householdId, userId, role);
    loadData();
  };

  const handleRemoveMember = async (userId: number) => {
    if (!householdId) return;
    await removeMember(householdId, userId);
    loadData();
  };

  const handleLeave = async () => {
    if (!householdId) return;
    setLeaveError("");
    try {
      await leaveHousehold(householdId);
      setShowLeaveConfirm(false);
      refreshHouseholds();
      router.replace("/chat");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to leave household";
      setLeaveError(msg);
    }
  };

  const handleCreateHousehold = async () => {
    const name = newHouseholdName.trim();
    if (!name) return;
    setCreateError("");
    try {
      await createHousehold(name);
      setNewHouseholdName("");
      setShowCreateHousehold(false);
      refreshHouseholds();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create household";
      setCreateError(msg);
    }
  };

  const handleValidateJoin = async () => {
    const code = joinCode.trim();
    if (!code) { setJoinStatus(null); return; }
    try {
      const res = await validateInviteCode(code);
      setJoinStatus(res);
    } catch {
      setJoinStatus({ valid: false, household_name: null });
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoinError("");
    try {
      await joinHousehold(code);
      setJoinCode("");
      setJoinStatus(null);
      refreshHouseholds();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to join";
      setJoinError(msg);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-zinc-800 px-4">
          <h1 className="text-lg font-semibold">Household Settings</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-6 p-6">
            {loadError && (
              <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{loadError}</p>
            )}

            {/* Household Info */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Household
              </h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameInput}
                      onChange={(e) => setNameOverride(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-primary"
                      autoFocus
                    />
                    <button onClick={handleSaveName} className="rounded-lg bg-primary-deep px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover">
                      Save
                    </button>
                    <button onClick={() => { setEditingName(false); setNameOverride(null); }} className="p-1 text-zinc-500 hover:text-zinc-300">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{householdName}</p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-600">{householdId}</p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setEditingName(true)}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Members */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Members
              </h2>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{m.username || m.email}</p>
                        {m.username && <p className="text-xs text-zinc-500">{m.email}</p>}
                      </div>
                      {roleBadge(m.role)}
                    </div>
                    {isAdmin && m.user_id !== user.id && (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{r.replace("_", " ")}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="p-1 text-zinc-600 hover:text-red-400"
                          title="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Invite Codes */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Invite Codes
                </h2>
                {(isAdmin || myMembership?.role === "power_user") && (
                  <button
                    onClick={() => setShowCreateInvite(!showCreateInvite)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover"
                  >
                    <Plus className="h-3 w-3" /> Generate
                  </button>
                )}
              </div>

              {showCreateInvite && (
                <div className="mb-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] font-medium uppercase text-zinc-500">Role</label>
                      <select
                        value={newInviteRole}
                        onChange={(e) => setNewInviteRole(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none"
                      >
                        <option value="member">Member</option>
                        <option value="power_user">Power User</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] font-medium uppercase text-zinc-500">Expires in (days)</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={newInviteExpiry}
                        onChange={(e) => setNewInviteExpiry(parseInt(e.target.value, 10) || 7)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] font-medium uppercase text-zinc-500">Max uses</label>
                      <input
                        type="number"
                        min={1}
                        value={newInviteMaxUses}
                        onChange={(e) => setNewInviteMaxUses(e.target.value)}
                        placeholder="Unlimited"
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none placeholder-zinc-600"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleCreateInvite}
                    className="rounded-lg bg-primary-deep px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                  >
                    Create Invite
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {invites.length === 0 && (
                  <p className="text-xs text-zinc-600">No active invite codes</p>
                )}
                {invites.map((inv) => {
                  const expired = new Date(inv.expires_at) < new Date();
                  return (
                    <div key={inv.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                      <div className="flex items-center gap-3">
                        <code className="rounded bg-zinc-800 px-2 py-1 font-mono text-sm tracking-widest text-zinc-200">
                          {inv.code}
                        </code>
                        <button
                          onClick={() => handleCopyCode(inv.code)}
                          className="p-1 text-zinc-500 hover:text-zinc-300"
                          title="Copy code"
                        >
                          {copiedCode === inv.code ? <Check className="h-3.5 w-3.5 text-green-400" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                        </button>
                        {roleBadge(inv.default_role)}
                        <span className="text-[10px] text-zinc-600">
                          {inv.use_count} use{inv.use_count !== 1 ? "s" : ""}
                          {inv.max_uses != null && ` / ${inv.max_uses}`}
                        </span>
                        {expired && <span className="text-[10px] text-red-400">expired</span>}
                      </div>
                      {(isAdmin || myMembership?.role === "power_user") && (
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="p-1 text-zinc-600 hover:text-red-400"
                          title="Revoke"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Join Another Household */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Join Another Household
              </h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinStatus(null); setJoinError(""); }}
                    onBlur={handleValidateJoin}
                    placeholder="Enter invite code"
                    maxLength={8}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm tracking-widest text-zinc-100 outline-none placeholder-zinc-600 focus:border-primary"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={!joinStatus?.valid}
                    className="rounded-lg bg-primary-deep px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
                {joinStatus?.valid && (
                  <p className="flex items-center gap-1 text-xs text-green-400">
                    <Check className="h-3 w-3" />
                    You&apos;ll join: {joinStatus.household_name}
                  </p>
                )}
                {joinStatus && !joinStatus.valid && (
                  <p className="text-xs text-red-400">Invalid or expired invite code</p>
                )}
                {joinError && (
                  <p className="text-xs text-red-400">{joinError}</p>
                )}
              </div>
            </section>

            {/* Create New Household */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Create New Household
              </h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                {showCreateHousehold ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newHouseholdName}
                      onChange={(e) => setNewHouseholdName(e.target.value)}
                      placeholder="Household name"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none placeholder-zinc-600 focus:border-primary"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleCreateHousehold()}
                    />
                    {createError && <p className="text-xs text-red-400">{createError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateHousehold}
                        disabled={!newHouseholdName.trim()}
                        className="rounded-lg bg-primary-deep px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => { setShowCreateHousehold(false); setNewHouseholdName(""); setCreateError(""); }}
                        className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateHousehold(true)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover"
                  >
                    <Home className="h-3.5 w-3.5" />
                    Create a new household
                  </button>
                )}
              </div>
            </section>

            {/* Leave Household */}
            {canLeave && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Danger Zone
                </h2>
                <div className="rounded-xl border border-red-900/50 bg-zinc-900 p-4">
                  {showLeaveConfirm ? (
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-300">
                        Are you sure you want to leave <strong>{householdName}</strong>?
                        {members.length === 1 && " This household will be deleted since you're the only member."}
                      </p>
                      {leaveError && (
                        <p className="text-xs text-red-400">{leaveError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleLeave}
                          className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                        >
                          Leave Household
                        </button>
                        <button
                          onClick={() => { setShowLeaveConfirm(false); setLeaveError(""); }}
                          className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">Leave this household</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          You&apos;ll lose access to this household&apos;s nodes and settings.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowLeaveConfirm(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-900/50 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/20"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Leave
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
