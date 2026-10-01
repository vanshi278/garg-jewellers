"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const { customerSignup, user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
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

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await customerSignup({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-14">
      <h1 className="font-display text-3xl text-ink">Create your account</h1>
      <p className="mt-1 text-ink-soft">
        Save your details for faster checkout and order history.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Full name" value={form.name} onChange={(v) => set("name", v)} required />
        <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} required />
        <Field label="Phone (optional)" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={(v) => set("password", v)}
          required
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-surface transition hover:bg-brand-deep disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-deep underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
