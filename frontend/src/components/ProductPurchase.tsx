"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import { TryOnIcon } from "@/components/icons";
import type { ProductDetail, Variant } from "@/lib/types";

export default function ProductPurchase({ product }: { product: ProductDetail }) {
  const { addItem } = useCart();
  const router = useRouter();
  const firstAvailable =
    product.variants.find((v) => v.stock_qty > 0) ?? product.variants[0];
  const [variant, setVariant] = useState<Variant | undefined>(firstAvailable);
  const [busy, setBusy] = useState<null | "cart" | "buy">(null);
  const [added, setAdded] = useState(false);

  const canBuy = variant && variant.stock_qty > 0;

  async function handleAdd(then: "stay" | "cart") {
    if (!variant) return;
    setBusy(then === "cart" ? "buy" : "cart");
    try {
      await addItem(variant.id, 1);
      if (then === "cart") {
        router.push("/cart");
      } else {
        setAdded(true);
        setTimeout(() => setAdded(false), 1800);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-3xl text-brand-deep">
          {variant ? formatPrice(variant.price) : formatPrice(product.base_price)}
        </span>
        {variant?.weight_grams && (
          <span className="text-sm text-ink-soft">
            {variant.weight_grams} g
          </span>
        )}
      </div>

      {/* Variant picker */}
      {product.variants.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow mb-2 text-silver">Select option</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => {
              const active = v.id === variant?.id;
              const out = v.stock_qty <= 0;
              return (
                <button
                  key={v.id}
                  onClick={() => !out && setVariant(v)}
                  disabled={out}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    active
                      ? "border-brand bg-brand text-surface"
                      : out
                        ? "cursor-not-allowed border-line text-silver line-through"
                        : "border-line bg-surface text-ink hover:border-brand"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock hint */}
      {variant && variant.stock_qty > 0 && variant.stock_qty <= 2 && (
        <p className="mt-3 text-sm text-danger">
          Only {variant.stock_qty} left — often one of a kind.
        </p>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            onClick={() => handleAdd("stay")}
            disabled={!canBuy || busy !== null}
            className="flex-1 rounded-full border border-brand bg-surface px-6 py-3.5 text-sm font-medium text-brand-deep transition hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50"
          >
            {added ? "Added ✓" : busy === "cart" ? "Adding…" : "Add to cart"}
          </button>
          <button
            onClick={() => handleAdd("cart")}
            disabled={!canBuy || busy !== null}
            className="flex-1 rounded-full bg-brand px-6 py-3.5 text-sm font-medium text-surface shadow-sm transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "buy" ? "…" : "Buy now"}
          </button>
        </div>
        <Link
          href={`/tryon?product=${product.slug}`}
          className="flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium text-ink transition hover:border-brand"
        >
          <TryOnIcon className="h-4 w-4 text-brand" />
          Try this on
        </Link>
      </div>

      {!canBuy && (
        <p className="mt-4 rounded-lg bg-surface-alt px-4 py-3 text-sm text-ink-soft">
          This piece is currently sold out.{" "}
          <Link href="/contact" className="text-brand-deep underline">
            Ask us about it
          </Link>
          .
        </p>
      )}
    </div>
  );
}
