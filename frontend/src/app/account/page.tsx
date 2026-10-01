"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function AccountPage() {
  const { user, token, ready, logout } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/account");
  }, [ready, user, router]);

  useEffect(() => {
    if (token) {
      api<Order[]>("/api/me/orders", { token })
        .then(setOrders)
        .catch(() => setOrders([]));
    }
  }, [token]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow text-silver">Account</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Hello, {user.name.split(" ")[0]}</h1>
          <p className="text-ink-soft">{user.email ?? user.phone}</p>
        </div>
        <button
          onClick={() => {
            logout();
            router.replace("/");
          }}
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-soft hover:border-brand hover:text-brand-deep"
        >
          Log out
        </button>
      </div>

      <h2 className="mb-3 mt-10 font-display text-xl text-ink">Your orders</h2>
      {orders === null ? (
        <p className="text-ink-soft">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-[--radius-card] border border-line bg-surface p-8 text-center text-ink-soft">
          No orders yet.{" "}
          <Link href="/categories" className="text-brand-deep underline">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => (
            <li key={o.number}>
              <Link
                href={`/order/${o.number}`}
                className="flex items-center justify-between rounded-[--radius-card] border border-line bg-surface px-5 py-4 transition hover:border-brand"
              >
                <div>
                  <p className="font-medium text-ink">{o.number}</p>
                  <p className="text-sm text-ink-soft">
                    {new Date(o.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {o.items.length} item{o.items.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-ink">{formatPrice(o.total)}</p>
                  <span className="text-xs capitalize text-brand-deep">
                    {o.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
