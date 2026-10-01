"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { customerLogin, user } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("/account");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("next");
    if (p) setNext(p);
  }, []);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await customerLogin(identifier, password);
      router.replace(next);
    } catch {
      setError("Those details didn't match. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-1 text-ink-soft">Log in to your Garg Jewellers account.</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft">Email or phone</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className="rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-surface transition hover:bg-brand-deep disabled:opacity-50"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        New here?{" "}
        <Link href="/signup" className="text-brand-deep underline">
          Create an account
        </Link>
      </p>
      <p className="mt-10 border-t border-line pt-4 text-xs text-silver">
        Store owner?{" "}
        <Link href="/admin/login" className="underline hover:text-ink-soft">
          Owner sign-in
        </Link>
      </p>
    </div>
  );
}
