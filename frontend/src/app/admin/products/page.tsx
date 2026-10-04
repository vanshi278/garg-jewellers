"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/format";
import CameraCapture from "@/components/CameraCapture";
import AiPhotoshoot from "@/components/admin/AiPhotoshoot";
import type {
  Category,
  ProductCard,
  ProductDetail,
  ProductList,
  Variant,
} from "@/lib/types";

export default function AdminProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const refresh = useCallback(() => {
    api<ProductList>("/api/products?page_size=100")
      .then((d) => setProducts(d.items))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    refresh();
    api<Category[]>("/api/categories").then(setCategories).catch(() => {});
  }, [refresh]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl">Products</h1>
          <p className="mt-1 text-sm text-[#a98d68]">{products.length} in catalogue</p>
        </div>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="rounded-full bg-[#8a5a34] px-4 py-2 text-sm font-medium text-white hover:bg-[#a06a3e]"
        >
          {showNew ? "Close" : "+ New product"}
        </button>
      </div>

      {showNew && (
        <NewProductForm
          categories={categories}
          token={token}
          onCreated={() => {
            setShowNew(false);
            refresh();
          }}
        />
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {products.map((p) => (
          <li key={p.id} className="rounded-xl border border-[#3a2b1e] bg-[#211710]">
            <button
              onClick={() => setExpanded(expanded === p.slug ? null : p.slug)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="h-9 w-9 overflow-hidden rounded bg-[#2c2015]">
                  {p.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span>
                  <span className="block text-sm text-[#f2e8da]">{p.name}</span>
                  <span className="block text-xs text-[#a98d68]">
                    from {formatPrice(p.base_price)} ·{" "}
                    {p.in_stock ? "in stock" : "sold out"}
                  </span>
                </span>
              </span>
              <span className="text-[#a98d68]">{expanded === p.slug ? "−" : "›"}</span>
            </button>
            {expanded === p.slug && <VariantEditor slug={p.slug} token={token} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VariantEditor({ slug, token }: { slug: string; token: string | null }) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);

  const reload = useCallback(() => {
    api<ProductDetail>(`/api/products/${slug}`).then(setDetail).catch(() => {});
  }, [slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!detail) return <p className="px-4 pb-4 text-sm text-[#a98d68]">Loading…</p>;

  return (
    <div className="border-t border-[#3a2b1e] px-4 py-3">
      <ImageManager detail={detail} token={token} onChange={setDetail} />
      <DescriptionEditor detail={detail} token={token} onChange={setDetail} />
      <AiPhotoshoot productId={detail.id} token={token} onApproved={reload} />
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-[0.65rem] uppercase tracking-wide text-[#a98d68]">
            <th className="pb-2">Variant</th>
            <th className="pb-2">SKU</th>
            <th className="pb-2">Price</th>
            <th className="pb-2">Stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {detail.variants.map((v) => (
            <VariantRow key={v.id} variant={v} token={token} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImageManager({
  detail,
  token,
  onChange,
}: {
  detail: ProductDetail;
  token: string | null;
  onChange: (d: ProductDetail) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [showCamera, setShowCamera] = useState(false);

  // Upload one file, returning the updated product (with the new image appended).
  const uploadOne = useCallback(
    async (file: File): Promise<ProductDetail> => {
      const form = new FormData();
      form.append("file", file);
      // No Content-Type header — the browser sets the multipart boundary.
      return api<ProductDetail>(`/api/admin/products/${detail.id}/images`, {
        method: "POST",
        token,
        body: form,
      });
    },
    [detail.id, token],
  );

  // Upload many, sequentially, so the images JSON list never races itself.
  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError(null);
      setProgress({ done: 0, total: files.length });
      let latest = detail;
      try {
        for (let i = 0; i < files.length; i++) {
          latest = await uploadOne(files[i]);
          onChange(latest);
          setProgress({ done: i + 1, total: files.length });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setProgress(null);
      }
    },
    [detail, onChange, uploadOne],
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    void uploadFiles(files);
    e.target.value = "";
  }

  async function remove(url: string) {
    const updated = await api<ProductDetail>(
      `/api/admin/products/${detail.id}/images`,
      { method: "DELETE", token, body: JSON.stringify({ url }) },
    );
    onChange(updated);
  }

  const uploading = progress !== null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <p className="text-[0.65rem] uppercase tracking-wide text-[#a98d68]">
          Photos ({detail.images.length})
        </p>
        {uploading && (
          <span className="text-[0.65rem] text-[#d9a968]">
            Uploading {progress!.done}/{progress!.total}…
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {detail.images.map((url, i) => (
          <div
            key={url}
            className="group relative h-16 w-16 overflow-hidden rounded-lg border border-[#3a2b1e] bg-[#2c2015]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[0.55rem] text-white">
                cover
              </span>
            )}
            <button
              onClick={() => remove(url)}
              className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white group-hover:flex"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        ))}

        {/* Gallery: multiple files at once. */}
        <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-[#5a4326] text-center text-[0.6rem] leading-tight text-[#a98d68] hover:border-[#8a5a34]">
          {uploading ? "…" : "+ Gallery"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={onPick}
            className="hidden"
          />
        </label>

        {/* Camera capture. */}
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          disabled={uploading}
          className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-[#5a4326] text-center text-[0.6rem] leading-tight text-[#a98d68] hover:border-[#8a5a34] disabled:opacity-50"
        >
          📷 Camera
        </button>
      </div>

      <p className="mt-2 text-[0.65rem] text-[#a98d68]">
        First photo is the cover. Add several from your gallery, or snap one with
        the camera.
      </p>
      {error && <p className="mt-2 text-xs text-[#e29b84]">{error}</p>}

      {showCamera && (
        <CameraCapture
          onCapture={(file) => {
            setShowCamera(false);
            void uploadFiles([file]);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

function DescriptionEditor({
  detail,
  token,
  onChange,
}: {
  detail: ProductDetail;
  token: string | null;
  onChange: (d: ProductDetail) => void;
}) {
  const [text, setText] = useState(detail.description ?? "");
  const [size, setSize] = useState(detail.tryon_size_mm ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty =
    text !== (detail.description ?? "") || size !== (detail.tryon_size_mm ?? "");

  async function save() {
    setBusy(true);
    try {
      const updated = await api<ProductDetail>(
        `/api/admin/products/${detail.id}`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({
            description: text,
            tryon_size_mm: size === "" ? null : parseFloat(size),
          }),
        },
      );
      onChange(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="mb-3">
        <p className="mb-2 text-[0.65rem] uppercase tracking-wide text-[#a98d68]">
          Try-on size (mm)
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="e.g. 35"
            min={1}
            max={500}
            className="w-28 rounded-lg border border-[#3a2b1e] bg-[#2c2015] px-3 py-2 text-sm text-[#f2e8da] outline-none focus:border-[#8a5a34]"
          />
          <span className="text-[0.7rem] text-[#a98d68]">
            Real size of the piece — used to show it life-size in virtual try-on.
          </span>
        </div>
      </div>
      <p className="mb-2 text-[0.65rem] uppercase tracking-wide text-[#a98d68]">
        Description
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Describe this piece — metal, finish, sizing, occasion…"
        className="w-full rounded-lg border border-[#3a2b1e] bg-[#2c2015] px-3 py-2 text-sm text-[#f2e8da] outline-none focus:border-[#8a5a34]"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || busy}
          className="rounded-full bg-[#8a5a34] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#a06a3e] disabled:opacity-40"
        >
          {saved ? "Saved ✓" : busy ? "Saving…" : "Save details"}
        </button>
        {dirty && !busy && (
          <span className="text-[0.65rem] text-[#a98d68]">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}

function VariantRow({ variant, token }: { variant: Variant; token: string | null }) {
  const [price, setPrice] = useState(variant.price);
  const [stock, setStock] = useState(String(variant.stock_qty));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api(`/api/admin/variants/${variant.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          price: parseFloat(price),
          stock_qty: parseInt(stock, 10),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-[#2c2015]">
      <td className="py-2 text-[#f2e8da]">{variant.label}</td>
      <td className="py-2 text-[#a98d68]">{variant.sku}</td>
      <td className="py-2">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-20 rounded border border-[#3a2b1e] bg-[#2c2015] px-2 py-1 text-[#f2e8da]"
        />
      </td>
      <td className="py-2">
        <input
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="w-16 rounded border border-[#3a2b1e] bg-[#2c2015] px-2 py-1 text-[#f2e8da]"
        />
      </td>
      <td className="py-2 text-right">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-full bg-[#8a5a34] px-3 py-1 text-xs text-white hover:bg-[#a06a3e] disabled:opacity-50"
        >
          {saved ? "Saved ✓" : busy ? "…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

function NewProductForm({
  categories,
  token,
  onCreated,
}: {
  categories: Category[];
  token: string | null;
  onCreated: () => void;
}) {
  const [f, setF] = useState({
    category_id: "",
    name: "",
    slug: "",
    description: "",
    base_price: "",
    tryon_size_mm: "",
    v_label: "One size",
    v_sku: "",
    v_price: "",
    v_stock: "1",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof f, v: string) {
    setF((prev) => {
      const next = { ...prev, [k]: v };
      // Auto-slug from name.
      if (k === "name" && !prev.slug) {
        next.slug = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/admin/products", {
        method: "POST",
        token,
        body: JSON.stringify({
          category_id: parseInt(f.category_id, 10),
          name: f.name,
          slug: f.slug,
          description: f.description || null,
          images: [],
          base_price: parseFloat(f.base_price || f.v_price),
          tryon_size_mm: f.tryon_size_mm ? parseFloat(f.tryon_size_mm) : null,
          variants: [
            {
              label: f.v_label,
              sku: f.v_sku,
              price: parseFloat(f.v_price),
              stock_qty: parseInt(f.v_stock, 10),
            },
          ],
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
      setBusy(false);
    }
  }

  const input =
    "rounded-lg border border-[#3a2b1e] bg-[#2c2015] px-3 py-2 text-sm text-[#f2e8da] outline-none focus:border-[#8a5a34]";

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-xl border border-[#3a2b1e] bg-[#211710] p-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <select
          value={f.category_id}
          onChange={(e) => set("category_id", e.target.value)}
          required
          className={input}
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input className={input} placeholder="Product name" value={f.name} onChange={(e) => set("name", e.target.value)} required />
        <input className={input} placeholder="slug" value={f.slug} onChange={(e) => set("slug", e.target.value)} required />
        <input className={input} placeholder="Base price ₹" value={f.base_price} onChange={(e) => set("base_price", e.target.value)} />
        <input className={input} type="number" placeholder="Try-on size (mm)" value={f.tryon_size_mm} onChange={(e) => set("tryon_size_mm", e.target.value)} />
      </div>
      <textarea className={`${input} mt-3 w-full`} placeholder="Description" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
      <p className="mt-4 mb-2 text-[0.65rem] uppercase tracking-wide text-[#a98d68]">First variant</p>
      <div className="grid gap-3 md:grid-cols-4">
        <input className={input} placeholder="Label (e.g. Size 12)" value={f.v_label} onChange={(e) => set("v_label", e.target.value)} required />
        <input className={input} placeholder="SKU" value={f.v_sku} onChange={(e) => set("v_sku", e.target.value)} required />
        <input className={input} placeholder="Price ₹" value={f.v_price} onChange={(e) => set("v_price", e.target.value)} required />
        <input className={input} placeholder="Stock" value={f.v_stock} onChange={(e) => set("v_stock", e.target.value)} required />
      </div>
      {error && <p className="mt-3 text-sm text-[#e29b84]">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-full bg-[#8a5a34] px-5 py-2 text-sm font-medium text-white hover:bg-[#a06a3e] disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}
