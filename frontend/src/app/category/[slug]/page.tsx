import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import type { Category, ProductList } from "@/lib/types";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const categories = await api<Category[]>("/api/categories").catch(
    () => [] as Category[],
  );
  const category = categories.find((c) => c.slug === slug);

  let products: ProductList;
  try {
    products = await api<ProductList>(
      `/api/products?category=${encodeURIComponent(slug)}&page_size=48`,
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    products = { items: [], total: 0, page: 1, page_size: 48 };
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <nav className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <Link href="/categories" className="hover:text-brand-deep">
          Shop
        </Link>
        <span className="text-silver">/</span>
        <span className="text-ink">{category?.name ?? slug}</span>
      </nav>

      <div className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-3xl text-ink">
          {category?.name ?? slug}
        </h1>
        <span className="text-sm text-ink-soft">
          {products.total} {products.total === 1 ? "piece" : "pieces"}
        </span>
      </div>

      {products.items.length === 0 ? (
        <p className="rounded-[--radius-card] border border-line bg-surface p-8 text-center text-ink-soft">
          Nothing here yet — check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {products.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
