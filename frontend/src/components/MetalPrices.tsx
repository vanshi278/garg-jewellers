"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  METAL_RANGES,
  type MetalInfo,
  type MetalsResponse,
} from "@/lib/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// Build line + area SVG paths from a series, normalised to the viewBox.
function paths(series: { v: number }[], w: number, h: number, pad = 4) {
  if (series.length < 2) return { line: "", area: "" };
  const vals = series.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (series.length - 1);
  const pts = series.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (p.v - min) / span);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  return { line, area };
}

function MetalCard({
  name,
  info,
  accent,
  gradId,
}: {
  name: string;
  info: MetalInfo;
  accent: string;
  gradId: string;
}) {
  const W = 320;
  const H = 96;
  const { line, area } = paths(info.series, W, H);
  const up = info.change_pct >= 0;
  return (
    <div className="flex flex-col rounded-[--radius-card] border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="font-display text-lg text-ink">{name}</h3>
          <p className="eyebrow text-[0.6rem] text-silver">{info.unit}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-xl text-ink tabular-nums">
            {inr.format(info.price)}
          </div>
          <div
            className={`text-sm font-medium tabular-nums ${up ? "text-good" : "text-danger"}`}
          >
            {up ? "▲" : "▼"} {Math.abs(info.change_pct)}%
          </div>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-24 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${name} price trend`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${gradId})`} />}
        {line && <path d={line} fill="none" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}

export default function MetalPrices() {
  const [range, setRange] = useState<string>("1M");
  const [data, setData] = useState<MetalsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<MetalsResponse>(`/api/metals?range=${range}`)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ range, available: false }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Today&apos;s rates</p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-2xl text-ink">
            Live gold &amp; silver prices
            {data?.market && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                  data.market.open
                    ? "bg-good/15 text-good"
                    : "bg-surface-alt text-ink-soft"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${data.market.open ? "bg-good" : "bg-silver"}`} />
                {data.market.open ? "LIVE" : "CLOSED"}
              </span>
            )}
          </h2>
        </div>
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {METAL_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                range === r ? "bg-brand text-surface" : "text-ink-soft hover:text-brand-deep"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {data?.available && data.gold && data.silver ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <MetalCard name="Gold" info={data.gold} accent="#b8860b" gradId="goldgrad" />
            <MetalCard name="Silver" info={data.silver} accent="#8a8f98" gradId="silvergrad" />
          </div>
          <p className="mt-3 text-xs text-silver">
            {data.market?.label ?? "Market rates"}
            {data.market?.as_of ? ` · as of ${data.market.as_of}` : ""}.{" "}
            Indicative rates derived from international (COMEX) spot in INR — not
            official IBJA/MCX retail. Final price varies with making charges &amp; GST.
          </p>
        </>
      ) : (
        <div className="rounded-[--radius-card] border border-line bg-surface p-8 text-center text-ink-soft">
          {loading ? "Fetching live rates…" : "Live rates are temporarily unavailable — please check back shortly."}
        </div>
      )}
    </section>
  );
}
