"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { TryOnIcon } from "@/components/icons";
import LiveTryOn from "@/components/LiveTryOn";
import type { ProductCard, ProductDetail } from "@/lib/types";

type Mode = "photo" | "live";
type Placement = "ears" | "neck";

interface Overlay {
  xPct: number; // center X as fraction of stage width
  yPct: number;
  scale: number;
  rotation: number; // degrees
}

const DEFAULT_OVERLAY: Overlay = { xPct: 0.5, yPct: 0.5, scale: 1, rotation: 0 };

export default function TryOnPage() {
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [jewelUrl, setJewelUrl] = useState<string | null>(null);
  const [jewelName, setJewelName] = useState<string>("");
  // Real-world size (mm) set by the owner; drives the try-on scale.
  const [jewelSize, setJewelSize] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(DEFAULT_OVERLAY);
  const [mode, setMode] = useState<Mode>("photo");
  const [placement, setPlacement] = useState<Placement>("ears");

  // Pick a piece: remember its image, name and owner-set size.
  const choosePiece = (p: { images: string[]; name: string; tryon_size_mm?: string | null }) => {
    setJewelUrl(p.images[0] ?? null);
    setJewelName(p.name);
    setJewelSize(p.tryon_size_mm ? Number(p.tryon_size_mm) : null);
    setOverlay(DEFAULT_OVERLAY);
  };

  // Photo mode has no scale reference, so derive a sensible on-stage width
  // from the owner-set size (mm) instead of a manual slider.
  const photoWidthFrac = Math.min(0.9, Math.max(0.08, (jewelSize ?? 30) / 120));

  const stageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Load the catalogue for the piece picker, and any ?product= preselection.
  useEffect(() => {
    api<{ items: ProductCard[] }>("/api/products?page_size=48")
      .then((d) => setProducts(d.items))
      .catch(() => setProducts([]));

    const slug = new URLSearchParams(window.location.search).get("product");
    if (slug) {
      api<ProductDetail>(`/api/products/${slug}`)
        .then((p) => {
          if (p.images[0]) choosePiece(p);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      setOverlay(DEFAULT_OVERLAY);
    };
    reader.readAsDataURL(file);
  };

  // Dragging the jewellery around the stage.
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!jewelUrl) return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setOverlay((o) => ({
      ...o,
      xPct: Math.min(1, Math.max(0, x)),
      yPct: Math.min(1, Math.max(0, y)),
    }));
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const download = useCallback(async () => {
    if (!photo || !jewelUrl || !stageRef.current) return;
    const stage = stageRef.current;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const load = (src: string, cors = false) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        if (cors) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    try {
      const bg = await load(photo);
      // cover fit
      const s = Math.max(cw / bg.width, ch / bg.height);
      const dw = bg.width * s;
      const dh = bg.height * s;
      ctx.drawImage(bg, (cw - dw) / 2, (ch - dh) / 2, dw, dh);

      const jewel = await load(jewelUrl, true);
      const w = cw * photoWidthFrac;
      const h = w * (jewel.height / jewel.width);
      ctx.save();
      ctx.translate(overlay.xPct * cw, overlay.yPct * ch);
      ctx.rotate((overlay.rotation * Math.PI) / 180);
      ctx.drawImage(jewel, -w / 2, -h / 2, w, h);
      ctx.restore();

      const link = document.createElement("a");
      link.download = "garg-tryon.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      alert(
        "Couldn't export the image (the jewellery photo may block cross-origin export). The on-screen preview still works.",
      );
    }
  }, [photo, jewelUrl, overlay, photoWidthFrac]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-5">
        <p className="eyebrow text-silver">Virtual try-on</p>
        <h1 className="mt-1 font-display text-3xl text-ink">See it on you</h1>
        <p className="mt-1 max-w-lg text-ink-soft">
          {mode === "photo"
            ? "Upload a photo and pick a piece — it's shown at its real size, so just drag it into place. Everything happens on your device; your photo never leaves it."
            : "Turn on your camera and the jewellery tracks your face at its real size, in real time. Nothing is recorded or uploaded."}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-6 inline-flex rounded-full border border-line bg-surface p-1">
        <button
          onClick={() => setMode("photo")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            mode === "photo" ? "bg-brand text-surface" : "text-ink-soft"
          }`}
        >
          Photo
        </button>
        <button
          onClick={() => setMode("live")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            mode === "live" ? "bg-brand text-surface" : "text-ink-soft"
          }`}
        >
          Live camera
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        {/* Stage */}
        <div>
          {mode === "live" ? (
            <LiveTryOn
              jewelUrl={jewelUrl}
              sizeMm={jewelSize}
              placement={placement}
            />
          ) : (
          <>
          <div
            ref={stageRef}
            className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line bg-surface-alt"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt="Your photo"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 text-center text-ink-soft">
                <TryOnIcon className="h-10 w-10 text-silver" />
                <span className="font-medium">Upload from gallery or take a photo</span>
                <span className="text-sm text-silver">
                  A clear photo of your hand, ear or neck works best
                </span>
                {/* No `capture` attribute → on mobile the picker offers BOTH the
                    photo library (gallery) and the camera. */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPhoto}
                  className="hidden"
                />
              </label>
            )}

            {photo && jewelUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={jewelUrl}
                alt={jewelName}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                draggable={false}
                className="absolute cursor-grab touch-none select-none active:cursor-grabbing"
                style={{
                  left: `${overlay.xPct * 100}%`,
                  top: `${overlay.yPct * 100}%`,
                  width: `${photoWidthFrac * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
                  mixBlendMode: "multiply",
                }}
              />
            )}
          </div>

          {photo && (
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-soft hover:border-brand">
                Change photo
                <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
              </label>
              <button
                onClick={() => setOverlay(DEFAULT_OVERLAY)}
                className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-soft hover:border-brand"
              >
                Reset position
              </button>
              <button
                onClick={download}
                disabled={!jewelUrl}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-brand-deep disabled:opacity-50"
              >
                Save image
              </button>
            </div>
          )}
          </>
          )}
        </div>

        {/* Controls */}
        <aside className="flex flex-col gap-5">
          {mode === "live" && jewelUrl && (
            <div className="rounded-[--radius-card] border border-line bg-surface p-4">
              <p className="eyebrow mb-3 text-silver">Placement</p>
              <div className="flex gap-2">
                {(["ears", "neck"] as Placement[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlacement(p)}
                    className={`flex-1 rounded-full border px-3 py-2 text-sm capitalize transition ${
                      placement === p
                        ? "border-brand bg-brand text-surface"
                        : "border-line text-ink-soft hover:border-brand"
                    }`}
                  >
                    {p === "ears" ? "Earrings" : "Necklace"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {jewelUrl && (
            <div className="rounded-[--radius-card] border border-line bg-surface p-4">
              <p className="eyebrow mb-2 text-silver">Shown at actual size</p>
              {jewelSize ? (
                <p className="text-sm text-ink-soft">
                  This piece is{" "}
                  <span className="font-medium text-ink">{jewelSize} mm</span> — the
                  try-on scales it to life-size on you, no guessing.
                </p>
              ) : (
                <p className="text-sm text-ink-soft">
                  Shown at a default size. Ask the store for exact dimensions.
                </p>
              )}
              {mode === "photo" && (
                <label className="mt-3 block text-sm text-ink-soft">
                  Rotation
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={overlay.rotation}
                    onChange={(e) =>
                      setOverlay((o) => ({ ...o, rotation: parseFloat(e.target.value) }))
                    }
                    className="mt-1 w-full accent-[#8a5a34]"
                  />
                </label>
              )}
            </div>
          )}

          <div className="rounded-[--radius-card] border border-line bg-surface p-4">
            <p className="eyebrow mb-3 text-silver">
              {jewelName ? "Trying on" : "Pick a piece"}
            </p>
            {jewelName && (
              <p className="mb-3 text-sm font-medium text-ink">{jewelName}</p>
            )}
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => choosePiece(p)}
                  className={`overflow-hidden rounded-lg border bg-surface-alt transition ${
                    jewelName === p.name ? "border-brand" : "border-line hover:border-brand/60"
                  }`}
                  title={p.name}
                >
                  {p.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} className="aspect-square w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <p className="rounded-[--radius-card] bg-surface-alt px-4 py-3 text-xs text-ink-soft">
            {mode === "live"
              ? "Live tracking works best for earrings and necklaces in good light. For rings and bangles, the Photo mode gives you full control."
              : "Prefer a hands-free preview? Switch to Live camera for real-time tracking."}{" "}
            <Link href="/contact" className="text-brand-deep underline">
              Ask us
            </Link>{" "}
            for more photos of any piece.
          </p>
        </aside>
      </div>
    </div>
  );
}
