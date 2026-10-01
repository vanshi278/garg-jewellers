"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrderPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = use(params);
  const { token, ready } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setError(true);
      return;
    }
    api<Order>(`/api/me/orders/${number}`, { token })
      .then(setOrder)
      .catch(() => setError(true));
  }, [ready, token, number]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl text-ink">Order not found</h1>
        <Link href="/account" className="mt-4 inline-block text-brand-deep underline">
          View your orders
        </Link>
      </div>
    );
  }

  if (!order) {
    return <div className="px-4 py-20 text-center text-ink-soft">Loading…</div>;
  }

  const paid = order.status === "paid";

  return (
    <div className="mx-auto max-w-xl px-4 py-12 md:py-16">
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good/15 text-2xl text-good">
          {paid ? "✓" : "•"}
        </div>
        <h1 className="mt-4 font-display text-2xl text-ink">
          {paid ? "Order confirmed" : "Order placed"}
        </h1>
        <p className="mt-1 text-ink-soft">
          Order <span className="font-medium text-ink">{order.number}</span> ·{" "}
          {order.status}
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          We&apos;ll message you on WhatsApp with dispatch updates.
        </p>

        <ul className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-left text-sm">
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between text-ink-soft">
              <span>
                {it.product_name}{" "}
                <span className="text-silver">
                  {it.variant_label} ×{it.qty}
                </span>
              </span>
              <span className="tabular-nums">{formatPrice(it.unit_price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-medium text-ink">
          <span>Total paid</span>
          <span>{formatPrice(order.total)}</span>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/categories"
            className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-surface hover:bg-brand-deep"
          >
            Keep shopping
          </Link>
          <Link
            href="/account"
            className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium text-brand-deep hover:border-brand"
          >
            My orders
          </Link>
        </div>
      </div>
    </div>
  );
}
