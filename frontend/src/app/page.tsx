import Link from "next/link";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import MetalPrices from "@/components/MetalPrices";
import { TryOnIcon } from "@/components/icons";
import type { Category, ProductList } from "@/lib/types";

export default async function HomePage() {
  const [categories, products] = await Promise.all([
    api<Category[]>("/api/categories").catch(() => [] as Category[]),
    api<ProductList>("/api/products?page_size=8").catch(
      () => ({ items: [], total: 0, page: 1, page_size: 8 }) as ProductList,
    ),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(900px 380px at 12% -10%, var(--color-surface-alt), transparent 60%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:items-center md:px-6 md:py-20">
          <div>
            <p className="eyebrow">Garg Jewellers · Jhansi</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-ink md:text-5xl">
              Everyday silver,{" "}
              <em className="text-brand-deep">quietly precious.</em>
            </h1>
            <p className="mt-4 max-w-md text-ink-soft">
              Hallmarked 925 sterling silver jewellery, handpicked at our Jhansi
              showroom. See how a piece looks on you before you buy.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/categories"
                className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-surface shadow-sm transition hover:bg-brand-deep"
              >
                Shop the collection
              </Link>
              <Link
                href="/tryon"
                className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-medium text-brand-deep transition hover:border-brand"
              >
                <TryOnIcon className="h-4 w-4" />
                Try it on
              </Link>
            </div>
          </div>

          {/* Simple ornamental panel (no external image dependency). */}
          <div className="relative hidden aspect-[4/3] rounded-2xl border border-line bg-surface md:block">
            <div className="absolute inset-0 grid grid-cols-2 gap-2 p-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl bg-surface-alt"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.9), transparent 60%)",
                  }}
                />
              ))}
            </div>
            <span className="eyebrow absolute bottom-3 right-4 text-silver">
              925 · hallmarked
            </span>
          </div>
        </div>
      </section>

      {/* Live gold & silver prices */}
      <MetalPrices />

      {/* Category rail */}
      <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl text-ink">Shop by category</h2>
          <Link
            href="/categories"
            className="text-sm text-brand-deep hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="flex min-w-36 flex-shrink-0 flex-col items-start justify-end rounded-[--radius-card] border border-line bg-surface p-4 transition hover:border-brand md:min-w-40"
            >
              <span className="mb-6 inline-block h-8 w-8 rounded-full bg-surface-alt" />
              <span className="font-display text-[0.98rem] text-ink">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
        <h2 className="mb-4 font-display text-2xl text-ink">New in</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {products.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
