"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { GenJob } from "@/lib/types";

/**
 * One-click AI photoshoot: upload 2-3 reference photos, generate a full
 * professional set (white packshot, styled, on-model, macro, dimension), then
 * review each — approve (adds to the gallery) or redo-with-a-note (regenerates
 * just that shot). The AI can also ask for more angles.
 */
export default function AiPhotoshoot({
  productId,
  token,
  onApproved,
}: {
  productId: number;
  token: string | null;
  onApproved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<GenJob | null>(null);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLInputElement>(null);

  const loadLatest = useCallback(async () => {
    try {
      const jobs = await api<GenJob[]>(`/api/admin/products/${productId}/photoshoots`, { token });
      if (jobs.length) setJob(jobs[0]);
    } catch {
      /* none yet */
    }
  }, [productId, token]);

  useEffect(() => {
    if (open) loadLatest();
  }, [open, loadLatest]);

  async function generate() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) {
      setError("Add 2–3 reference photos first.");
      return;
    }
    setError(null);
    setBusy("generate");
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));
      if (extra.trim()) form.append("extra_prompt", extra.trim());
      const j = await api<GenJob>(`/api/admin/products/${productId}/photoshoot`, {
        method: "POST",
        token,
        body: form,
      });
      setJob(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function addMore() {
    const files = moreRef.current?.files;
    if (!job || !files || files.length === 0) return;
    setBusy("more");
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));
      const j = await api<GenJob>(`/api/admin/photoshoot/${job.id}/add-references`, {
        method: "POST",
        token,
        body: form,
      });
      setJob(j);
    } finally {
      setBusy(null);
    }
  }

  async function approve(cid: number) {
    const j = await api<GenJob>(`/api/admin/photoshoot/candidates/${cid}/approve`, {
      method: "POST",
      token,
    });
    setJob(j);
    onApproved();
  }

  async function redo(cid: number) {
    const feedback = window.prompt(
      "What should the AI fix? (e.g. 'keep the stone round and clear', 'pure white background')",
    );
    if (feedback === null) return;
    setBusy(`redo-${cid}`);
    try {
      const j = await api<GenJob>(`/api/admin/photoshoot/candidates/${cid}/regenerate`, {
        method: "POST",
        token,
        body: JSON.stringify({ feedback: feedback.trim() || null }),
      });
      setJob(j);
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-[#5a4326] bg-[#2c2015] px-4 py-2 text-sm text-[#e9d8bf] hover:border-[#8a5a34]"
      >
        ✨ AI Photoshoot — generate a full professional set
      </button>
    );
  }

  const input =
    "rounded-lg border border-[#3a2b1e] bg-[#2c2015] px-3 py-2 text-sm text-[#f2e8da] outline-none focus:border-[#8a5a34]";

  return (
    <div className="mt-4 rounded-xl border border-[#5a4326] bg-[#241a12] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.65rem] uppercase tracking-wide text-[#d9a968]">✨ AI Photoshoot</p>
        <button onClick={() => setOpen(false)} className="text-xs text-[#a98d68] hover:text-white">
          Close
        </button>
      </div>

      <p className="mb-3 text-xs text-[#a98d68]">
        Upload 2–3 clear photos (different angles help). One click generates a full
        set — white packshot, styled background, on-model, macro detail and a
        dimension shot — all keeping the exact design. Review each; nothing goes
        live until you approve it. (Takes up to a minute.)
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className={`${input} file:mr-3 file:rounded file:border-0 file:bg-[#8a5a34] file:px-3 file:py-1 file:text-white`}
        />
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="optional note (e.g. 'warm tones')"
          className={`${input} min-w-44 flex-1`}
        />
        <button
          onClick={generate}
          disabled={busy !== null}
          className="rounded-full bg-[#8a5a34] px-5 py-2 text-sm font-medium text-white hover:bg-[#a06a3e] disabled:opacity-50"
        >
          {busy === "generate" ? "Generating set…" : "Generate full photoshoot"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[#e29b84]">{error}</p>}

      {job?.readiness_hint && (
        <div className="mt-4 rounded-lg border border-[#5a4326] bg-[#2c2015] p-3 text-sm text-[#e9d8bf]">
          <p className="mb-2">📸 {job.readiness_hint}</p>
          <label className="cursor-pointer text-xs text-[#d9a968] underline">
            {busy === "more" ? "Uploading…" : "Add more photos & regenerate"}
            <input ref={moreRef} type="file" accept="image/*" multiple onChange={addMore} className="hidden" />
          </label>
        </div>
      )}

      {job && job.candidates.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-[#a98d68]">Your photoshoot — approve the shots you like:</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {job.candidates.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-lg border border-[#3a2b1e] bg-[#2c2015]">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt={c.label} className="aspect-square w-full object-cover" />
                  {c.label && (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[0.6rem] text-white">
                      {c.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 p-1.5">
                  {c.approved ? (
                    <span className="flex-1 text-center text-xs text-[#8fbe9c]">✓ Approved</span>
                  ) : (
                    <>
                      <button
                        onClick={() => approve(c.id)}
                        className="flex-1 rounded bg-[#4b7157] py-1 text-xs text-white hover:brightness-110"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => redo(c.id)}
                        disabled={busy === `redo-${c.id}`}
                        className="flex-1 rounded border border-[#3a2b1e] py-1 text-xs text-[#c7b7a2] hover:border-[#d9a968] hover:text-[#d9a968] disabled:opacity-50"
                      >
                        {busy === `redo-${c.id}` ? "…" : "Redo"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
