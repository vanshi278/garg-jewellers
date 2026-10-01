import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { ProductCard as ProductCardType } from "@/lib/types";

export default function ProductCard({ product }: { product: ProductCardType }) {
  const image = product.images[0];
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-[--radius-card] border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-surface-alt">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-silver">
            925 Silver
          </div>
        )}
        {!product.in_stock && (
          <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-surface">
            Sold out
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="font-display text-[0.95rem] font-medium leading-snug text-ink">
          {product.name}
        </h3>
        <p className="eyebrow text-[0.6rem] text-silver">{product.metal}</p>
        <div className="mt-auto flex items-baseline gap-1.5 pt-2">
          <span className="text-[0.7rem] text-ink-soft">from</span>
          <span className="font-medium text-brand-deep">
            {formatPrice(product.base_price)}
          </span>
        </div>
      </div>
    </Link>
  );
}
