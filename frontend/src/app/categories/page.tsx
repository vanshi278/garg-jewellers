import Link from "next/link";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";

export const metadata = { title: "Shop · Garg Jewellers" };

export default async function CategoriesPage() {
  const categories = await api<Category[]>("/api/categories").catch(
    () => [] as Category[],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <p className="eyebrow">Collection</p>
      <h1 className="mt-2 font-display text-3xl text-ink">Shop by category</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/category/${c.slug}`}
            className="group flex aspect-[5/4] flex-col justify-end overflow-hidden rounded-[--radius-card] border border-line bg-surface p-5 transition hover:border-brand hover:shadow-sm"
          >
            <span
              className="mb-auto inline-block h-10 w-10 rounded-full bg-surface-alt transition group-hover:scale-110"
              aria-hidden
            />
            <h2 className="font-display text-lg text-ink">{c.name}</h2>
            <span className="mt-1 text-sm text-brand-deep">Explore →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
