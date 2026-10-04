"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { PHOTOSHOOT_PRESETS, type GenJob } from "@/lib/types";

/**
 * AI photoshoot panel for the owner: upload 2-3 reference photos, pick a scene,
 * generate candidate shots, then review — approve (adds to the product gallery),
 * reject with a comment, add more angles, or regenerate with feedback.
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
  const [preset, setPreset] = useState("white_studio");
  const [extra, setExtra] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLInputElement>(null);

  const loadLatest = useCallback(async () => {
    try {
      const jobs = await api<GenJob[]>(
        `/api/admin/products/${productId}/photoshoots`,
        { token },
      );
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
      form.append("preset", preset);
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

  async function regenerate() {
    if (!job) return;
    setBusy("regen");
    try {
      const j = await api<GenJob>(`/api/admin/photoshoot/${job.id}/regenerate`, {
        method: "POST",
        token,
        body: JSON.stringify({ feedback: feedback.trim() || null }),
      });
      setJob(j);
      setFeedback("");
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
    onApproved(); // refresh the product's photo grid
  }

  async function reject(cid: number) {
    const comment = window.prompt("What's wrong with this image? (used to regenerate)");
    if (comment === null) return;
    const j = await api<GenJob>(`/api/admin/photoshoot/candidates/${cid}/reject`, {
      method: "POST",
      token,
      body: JSON.stringify({ comment }),
    });
    setJob(j);
    setFeedback(comment);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-[#5a4326] bg-[#2c2015] px-4 py-2 text-sm text-[#e9d8bf] hover:border-[#8a5a34]"
      >
        ✨ AI Photoshoot — generate professional photos
      </button>
    );
  }

  const input =
    "rounded-lg border border-[#3a2b1e] bg-[#2c2015] px-3 py-2 text-sm text-[#f2e8da] outline-none focus:border-[#8a5a34]";

  return (
    <div className="mt-4 rounded-xl border border-[#5a4326] bg-[#241a12] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[0.65rem] uppercase tracking-wide text-[#d9a968]">
          ✨ AI Photoshoot
        </p>
        <button onClick={() => setOpen(false)} className="text-xs text-[#a98d68] hover:text-white">
          Close
        </button>
      </div>

      <p className="mb-3 text-xs text-[#a98d68]">
        Upload 2–3 clear photos of the piece (different angles help). The AI
        creates professional shots keeping the design — you review and approve
        each one. Nothing goes live until you approve it.
      </p>

      {/* New generation */}
      <div className="flex flex-col gap-3">
        <input ref={fileRef} type="file" accept="image/*" multiple className={`${input} file:mr-3 file:rounded file:border-0 file:bg-[#8a5a34] file:px-3 file:py-1 file:text-white`} />
        <div className="flex flex-wrap gap-2">
          <select value={preset} onChange={(e) => setPreset(e.target.value)} className={input}>
            {PHOTOSHOOT_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="optional: extra instruction (e.g. 'top-down view')"
            className={`${input} flex-1 min-w-48`}
          />
          <button
            onClick={generate}
            disabled={busy !== null}
            className="rounded-full bg-[#8a5a34] px-5 py-2 text-sm font-medium text-white hover:bg-[#a06a3e] disabled:opacity-50"
          >
            {busy === "generate" ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-[#e29b84]">{error}</p>}

      {/* Readiness hint — AI asking for more angles */}
      {job?.readiness_hint && (
        <div className="mt-4 rounded-lg border border-[#5a4326] bg-[#2c2015] p-3 text-sm text-[#e9d8bf]">
          <p className="mb-2">📸 {job.readiness_hint}</p>
          <label className="cursor-pointer text-xs text-[#d9a968] underline">
            {busy === "more" ? "Uploading…" : "Add more photos"}
            <input ref={moreRef} type="file" accept="image/*" multiple onChange={addMore} className="hidden" />
          </label>
        </div>
      )}

      {/* Candidates */}
      {job && job.candidates.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-[#a98d68]">
            Review the generated shots — approve the good ones:
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {job.candidates.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-lg border border-[#3a2b1e] bg-[#2c2015]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt="AI candidate" className="aspect-square w-full object-cover" />
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
                        onClick={() => reject(c.id)}
                        className="flex-1 rounded border border-[#3a2b1e] py-1 text-xs text-[#c7b7a2] hover:border-[#e29b84] hover:text-[#e29b84]"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Regenerate with feedback */}
          <div className="mt-4">
            <p className="mb-1 text-xs text-[#a98d68]">
              Not quite right? Tell the AI what to fix and regenerate:
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. 'the stone looks wrong, keep it round and clear'"
                className={`${input} flex-1 min-w-48`}
              />
              <button
                onClick={regenerate}
                disabled={busy !== null}
                className="rounded-full border border-[#5a4326] px-4 py-2 text-sm text-[#e9d8bf] hover:border-[#8a5a34] disabled:opacity-50"
              >
                {busy === "regen" ? "Regenerating…" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
