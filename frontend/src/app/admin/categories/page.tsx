"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Category } from "@/lib/types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminCategories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api<Category[]>("/api/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await api<Category>("/api/admin/categories", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: trimmed,
          slug: slugify(trimmed),
          sort_order: categories.length + 1,
        }),
      });
      setName("");
      refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't add the category. Try a different name.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(cat: Category) {
    setError(null);
    try {
      await api(`/api/admin/categories/${cat.id}`, { method: "DELETE", token });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete category.");
    }
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl">Categories</h1>
      <p className="mt-1 text-sm text-[#a98d68]">
        Add your own categories, then create products inside them from the Products
        tab. New categories appear on the storefront automatically.
      </p>

      {/* Add form */}
      <form onSubmit={add} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[#c7b7a2]">New category name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Toe Rings, Mangalsutra, Kids"
            className="w-72 rounded-lg border border-[#3a2b1e] bg-[#2c2015] px-3 py-2 text-[#f2e8da] outline-none focus:border-[#8a5a34]"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-full bg-[#8a5a34] px-5 py-2 text-sm font-medium text-white hover:bg-[#a06a3e] disabled:opacity-40"
        >
          {busy ? "Adding…" : "+ Add category"}
        </button>
        {name.trim() && (
          <span className="text-[0.7rem] text-[#a98d68]">
            URL: /category/{slugify(name)}
          </span>
        )}
      </form>
      {error && <p className="mt-3 text-sm text-[#e29b84]">{error}</p>}

      {/* List */}
      <ul className="mt-6 flex flex-col gap-2">
        {categories.length === 0 && (
          <li className="rounded-xl border border-[#3a2b1e] bg-[#211710] p-6 text-center text-[#a98d68]">
            No categories yet — add your first one above.
          </li>
        )}
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-[#3a2b1e] bg-[#211710] px-4 py-3"
          >
            <div>
              <span className="text-sm text-[#f2e8da]">{c.name}</span>
              <span className="ml-2 text-xs text-[#a98d68]">/{c.slug}</span>
            </div>
            <button
              onClick={() => remove(c)}
              className="rounded-full border border-[#3a2b1e] px-3 py-1 text-xs text-[#c7b7a2] hover:border-[#e29b84] hover:text-[#e29b84]"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
