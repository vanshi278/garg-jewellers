"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AdminLoginPage() {
  const { ownerLogin, user, ready } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user?.role === "owner") router.replace("/admin");
  }, [ready, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await ownerLogin(identifier, password);
      router.replace("/admin");
    } catch {
      setError("Invalid credentials.");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-[0.65rem] uppercase tracking-[0.14em] text-[#a98d68]">
          Garg Jewellers
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl">
          Owner sign-in
        </h1>
        <p className="mt-1 text-sm text-[#c7b7a2]">
          Restricted area. This is not the customer login.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[#c7b7a2]">Email</span>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              className="rounded-lg border border-[#3a2b1e] bg-[#2c2015] px-3 py-2.5 text-[#f2e8da] outline-none focus:border-[#8a5a34]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[#c7b7a2]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-lg border border-[#3a2b1e] bg-[#2c2015] px-3 py-2.5 text-[#f2e8da] outline-none focus:border-[#8a5a34]"
            />
          </label>
          {error && <p className="text-sm text-[#e29b84]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#8a5a34] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#a06a3e] disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
