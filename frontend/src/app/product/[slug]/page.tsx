import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import ProductPurchase from "@/components/ProductPurchase";
import ProductGallery from "@/components/ProductGallery";
import type { ProductDetail } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const p = await api<ProductDetail>(`/api/products/${slug}`);
    return { title: `${p.name} · Garg Jewellers`, description: p.description ?? undefined };
  } catch {
    return { title: "Product · Garg Jewellers" };
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let product: ProductDetail;
  try {
    product = await api<ProductDetail>(`/api/products/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <nav className="mb-5 flex items-center gap-2 text-sm text-ink-soft">
        <Link href="/categories" className="hover:text-brand-deep">
          Shop
        </Link>
        <span className="text-silver">/</span>
        <Link
          href={`/category/${product.category.slug}`}
          className="hover:text-brand-deep"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        {/* Gallery */}
        <ProductGallery images={product.images} name={product.name} />

        {/* Details */}
        <div>
          <p className="eyebrow text-silver">{product.metal}</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
            {product.name}
          </h1>
          <div className="mt-6">
            <ProductPurchase product={product} />
          </div>

          {product.description && (
            <div className="mt-8 border-t border-line pt-6">
              <h2 className="mb-2 font-display text-lg text-ink">Details</h2>
              <p className="leading-relaxed text-ink-soft">
                {product.description}
              </p>
            </div>
          )}

          <ul className="mt-6 grid grid-cols-2 gap-3 text-sm text-ink-soft">
            <li className="rounded-lg border border-line bg-surface px-4 py-3">
              Hallmarked 925 silver
            </li>
            <li className="rounded-lg border border-line bg-surface px-4 py-3">
              Free shipping over ₹2,000
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
