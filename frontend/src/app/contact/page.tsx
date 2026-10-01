"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useConfig, whatsappLink } from "@/lib/config-context";
import { WhatsAppIcon } from "@/components/icons";

export default function ContactPage() {
  const config = useConfig();
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wa = config
    ? whatsappLink(
        config.whatsapp_number,
        "Hi Garg Jewellers, I have a question about your silver jewellery.",
      )
    : "#";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/contact", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 md:py-16">
      <p className="eyebrow text-silver">We&apos;re here to help</p>
      <h1 className="mt-2 font-display text-3xl text-ink">Contact the showroom</h1>
      <p className="mt-2 text-ink-soft">
        Questions about sizing, weight, or a custom piece? Message us on WhatsApp
        — that&apos;s the fastest way to reach the Jhansi store.
      </p>

      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-medium text-white shadow-sm transition hover:brightness-95"
      >
        <WhatsAppIcon className="h-5 w-5" />
        Chat on WhatsApp
      </a>

      <div className="my-8 flex items-center gap-4 text-xs text-silver">
        <span className="h-px flex-1 bg-line" />
        or leave a message
        <span className="h-px flex-1 bg-line" />
      </div>

      {sent ? (
        <div className="rounded-[--radius-card] border border-good/30 bg-good/10 p-6 text-center">
          <p className="font-display text-lg text-ink">Thank you!</p>
          <p className="mt-1 text-sm text-ink-soft">
            We&apos;ll get back to you on WhatsApp or by phone shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              placeholder="Your name"
              value={form.name}
              required
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <input
              placeholder="Phone"
              value={form.phone}
              required
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <textarea
            placeholder="How can we help?"
            value={form.message}
            required
            rows={4}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-surface transition hover:bg-brand-deep disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}
