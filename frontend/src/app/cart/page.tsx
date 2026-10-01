"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import { CartIcon } from "@/components/icons";

export default function CartPage() {
  const { cart, loading, refresh, updateItem, removeItem } = useCart();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = cart?.lines ?? [];

  if (!loading && lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CartIcon className="mx-auto h-10 w-10 text-silver" />
        <h1 className="mt-4 font-display text-2xl text-ink">Your cart is empty</h1>
        <p className="mt-2 text-ink-soft">
          Find something you love — try it on first if you like.
        </p>
        <Link
          href="/categories"
          className="mt-6 inline-block rounded-full bg-brand px-6 py-3 text-sm font-medium text-surface transition hover:bg-brand-deep"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="mb-6 font-display text-3xl text-ink">Your cart</h1>
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <ul className="flex flex-col divide-y divide-line rounded-[--radius-card] border border-line bg-surface">
          {lines.map((line) => (
            <li key={line.item_id} className="flex gap-4 p-4">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-surface-alt">
                {line.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.image}
                    alt={line.product_name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <Link
                    href={`/product/${line.product_slug}`}
                    className="font-display text-[0.98rem] text-ink hover:text-brand-deep"
                  >
                    {line.product_name}
                  </Link>
                  <span className="font-medium text-ink">
                    {formatPrice(line.line_total)}
                  </span>
                </div>
                <p className="text-sm text-ink-soft">{line.variant_label}</p>
                {!line.in_stock && (
                  <p className="text-sm text-danger">
                    Only {line.stock_qty} in stock
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1 rounded-full border border-line">
                    <button
                      onClick={() =>
                        line.qty > 1 && updateItem(line.item_id, line.qty - 1)
                      }
                      className="grid h-8 w-8 place-items-center text-ink-soft hover:text-brand-deep"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums">
                      {line.qty}
                    </span>
                    <button
                      onClick={() => updateItem(line.item_id, line.qty + 1)}
                      disabled={line.qty >= line.stock_qty}
                      className="grid h-8 w-8 place-items-center text-ink-soft hover:text-brand-deep disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(line.item_id)}
                    className="text-sm text-ink-soft underline hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-[--radius-card] border border-line bg-surface p-5">
          <h2 className="font-display text-lg text-ink">Summary</h2>
          <div className="mt-4 flex justify-between text-sm text-ink-soft">
            <span>Subtotal</span>
            <span className="font-medium text-ink">
              {formatPrice(cart?.subtotal ?? "0")}
            </span>
          </div>
          <p className="mt-1 text-xs text-silver">
            Shipping calculated at checkout · free over ₹2,000
          </p>
          <Link
            href="/checkout"
            className="mt-5 block rounded-full bg-brand px-6 py-3.5 text-center text-sm font-medium text-surface transition hover:bg-brand-deep"
          >
            Checkout
          </Link>
          <Link
            href="/categories"
            className="mt-2 block text-center text-sm text-ink-soft hover:text-brand-deep"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
