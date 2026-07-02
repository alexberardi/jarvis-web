"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AxiosError } from "axios";

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-primary";

export default function ChangePasswordPage() {
  const { user, loading, mustChangePassword, changePassword, hasTempPassword, logout } = useAuth();
  const router = useRouter();
  // The temp password from this session's login is held in memory; after a
  // reload it's gone and the user has to retype it.
  const needsCurrentPassword = !hasTempPassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(password, needsCurrentPassword ? currentPassword : undefined);
      router.replace("/chat");
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.detail ?? err.message);
      } else {
        setError(err instanceof Error ? err.message : "Unable to change password");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">
            {mustChangePassword ? "Set a New Password" : "Change Password"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {mustChangePassword
              ? "You signed in with a temporary password. Choose a new one to continue — your other devices will be signed out."
              : "Your other devices will be signed out."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          {needsCurrentPassword && (
            <div>
              <label htmlFor="current" className="mb-1 block text-xs font-medium text-zinc-400">
                {mustChangePassword ? "Temporary password" : "Current password"}
              </label>
              <input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="new" className="mb-1 block text-xs font-medium text-zinc-400">
              New password
            </label>
            <input
              id="new"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1 block text-xs font-medium text-zinc-400">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary-deep py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Set password"}
          </button>
        </form>

        {mustChangePassword && (
          <p className="mt-6 text-center text-sm text-zinc-500">
            <button
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="text-primary hover:underline"
            >
              Log out
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
