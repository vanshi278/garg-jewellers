"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUSES, type AdminOrderRow } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "text-[#d9a968]",
  paid: "text-[#8fbe9c]",
  shipped: "text-[#9db4d9]",
  delivered: "text-[#8fbe9c]",
  cancelled: "text-[#e29b84]",
};

export default function AdminOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [filter, setFilter] = useState<string>("");

  const refresh = useCallback(() => {
    const q = filter ? `?status=${filter}` : "";
    api<AdminOrderRow[]>(`/api/admin/orders${q}`, { token })
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [token, filter]);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  async function updateStatus(number: string, status: string) {
    await api(`/api/admin/orders/${number}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    });
    refresh();
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl">Orders</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip label="All" active={filter === ""} onClick={() => setFilter("")} />
        {ORDER_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={s.replace("_", " ")}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-[#3a2b1e]">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-[#211710] text-left text-[0.65rem] uppercase tracking-wide text-[#a98d68]">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Update</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#a98d68]">
                  No orders.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.number} className="border-t border-[#2c2015] bg-[#1a120c]">
                <td className="px-4 py-3 font-medium text-[#f2e8da]">{o.number}</td>
                <td className="px-4 py-3 text-[#c7b7a2]">
                  {o.ship_name}
                  <span className="block text-xs text-[#a98d68]">{o.ship_city}</span>
                </td>
                <td className="px-4 py-3 tabular-nums text-[#f2e8da]">
                  {formatPrice(o.total)}
                </td>
                <td className={`px-4 py-3 capitalize ${STATUS_COLOR[o.status] ?? ""}`}>
                  {o.status.replace("_", " ")}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o.number, e.target.value)}
                    className="rounded border border-[#3a2b1e] bg-[#2c2015] px-2 py-1 text-xs text-[#f2e8da]"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${
        active
          ? "bg-[#8a5a34] text-white"
          : "border border-[#3a2b1e] text-[#c7b7a2] hover:border-[#8a5a34]"
      }`}
    >
      {label}
    </button>
  );
}
