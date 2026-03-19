"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { AxiosError } from "axios";
import { Check, X } from "lucide-react";

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs">
      {met ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <X className="h-3 w-3 text-zinc-600" />
      )}
      <span className={met ? "text-zinc-400" : "text-zinc-600"}>{label}</span>
    </li>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  const rules = useMemo(() => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  }), [password]);

  const passwordValid = rules.length && rules.uppercase && rules.lowercase && rules.number;
  const passwordsMatch = password === confirmPassword;
  const canSubmit = isValidEmail && passwordValid && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isValidEmail) { setError("Enter a valid email address."); return; }
    if (!passwordValid) { setError("Password doesn't meet requirements."); return; }
    if (!passwordsMatch) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      await register(email.trim(), password, username.trim() || undefined);
      router.replace("/chat");
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.detail ?? err.message);
      } else {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">Jarvis</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <div>
            <label htmlFor="reg-email" className="mb-1 block text-xs font-medium text-zinc-400">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className={cn(
                "w-full rounded-lg border bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-primary",
                email && !isValidEmail ? "border-red-500" : "border-zinc-700",
              )}
            />
          </div>

          <div>
            <label htmlFor="reg-username" className="mb-1 block text-xs font-medium text-zinc-400">
              Display name <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              id="reg-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="How Jarvis should address you"
              autoComplete="username"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="mb-1 block text-xs font-medium text-zinc-400">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              autoComplete="new-password"
              className={cn(
                "w-full rounded-lg border bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-primary",
                password && !passwordValid ? "border-amber-500" : "border-zinc-700",
              )}
            />
            {password && (
              <ul className="mt-2 space-y-1">
                <PasswordRule met={rules.length} label="At least 8 characters" />
                <PasswordRule met={rules.uppercase} label="One uppercase letter" />
                <PasswordRule met={rules.lowercase} label="One lowercase letter" />
                <PasswordRule met={rules.number} label="One number" />
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="reg-confirm" className="mb-1 block text-xs font-medium text-zinc-400">
              Confirm password
            </label>
            <input
              id="reg-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
              className={cn(
                "w-full rounded-lg border bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-primary",
                confirmPassword && !passwordsMatch ? "border-red-500" : "border-zinc-700",
              )}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-red-400">Passwords don&apos;t match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-primary-deep py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
