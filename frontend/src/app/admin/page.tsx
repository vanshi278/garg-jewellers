"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (token) {
      api<DashboardStats>("/api/admin/dashboard", { token })
        .then(setStats)
        .catch(() => setStats(null));
    }
  }, [token]);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl">Dashboard</h1>
      <p className="mt-1 text-sm text-[#a98d68]">
        A quick pulse of the store.
      </p>

      {!stats ? (
        <p className="mt-8 text-[#c7b7a2]">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Revenue (paid)" value={formatPrice(stats.revenue_paid)} highlight />
            <Stat label="Paid orders" value={String(stats.orders_paid)} />
            <Stat label="Pending payment" value={String(stats.orders_pending)} />
            <Stat label="Active products" value={`${stats.active_products}/${stats.total_products}`} />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Alert
              show={stats.low_stock_variants > 0}
              text={`${stats.low_stock_variants} variant(s) low on stock (≤2 left)`}
              href="/admin/products"
              cta="Review stock"
            />
            <Alert
              show={stats.unread_messages > 0}
              text={`${stats.unread_messages} unread customer message(s)`}
              href="/admin/messages"
              cta="Open inbox"
            />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-[#8a5a34] bg-[#2c2015]"
          : "border-[#3a2b1e] bg-[#211710]"
      }`}
    >
      <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[#a98d68]">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-fraunces)] text-2xl">
        {value}
      </p>
    </div>
  );
}

function Alert({
  show,
  text,
  href,
  cta,
}: {
  show: boolean;
  text: string;
  href: string;
  cta: string;
}) {
  if (!show) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#5a4326] bg-[#2c2015] px-4 py-3 text-sm">
      <span className="text-[#e9d8bf]">{text}</span>
      <Link href={href} className="whitespace-nowrap text-[#d9a968] underline">
        {cta}
      </Link>
    </div>
  );
}
