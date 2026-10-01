"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ContactMessage } from "@/lib/types";

export default function AdminMessages() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const refresh = useCallback(() => {
    const q = unreadOnly ? "?unread_only=true" : "";
    api<ContactMessage[]>(`/api/admin/messages${q}`, { token })
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [token, unreadOnly]);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  async function markRead(id: number) {
    await api(`/api/admin/messages/${id}/read`, { method: "PATCH", token });
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl">Messages</h1>
        <label className="flex items-center gap-2 text-sm text-[#c7b7a2]">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="accent-[#8a5a34]"
          />
          Unread only
        </label>
      </div>

      <ul className="mt-5 flex flex-col gap-3">
        {messages.length === 0 && (
          <li className="rounded-xl border border-[#3a2b1e] bg-[#211710] p-8 text-center text-[#a98d68]">
            No messages.
          </li>
        )}
        {messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border p-4 ${
              m.is_read
                ? "border-[#3a2b1e] bg-[#1a120c]"
                : "border-[#5a4326] bg-[#211710]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#f2e8da]">
                  {m.name}{" "}
                  {!m.is_read && (
                    <span className="ml-1 rounded-full bg-[#8a5a34] px-2 py-0.5 text-[0.6rem] text-white">
                      new
                    </span>
                  )}
                </p>
                <a
                  href={`tel:${m.phone}`}
                  className="text-xs text-[#d9a968] underline"
                >
                  {m.phone}
                </a>
              </div>
              <span className="text-xs text-[#a98d68]">
                {new Date(m.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#c7b7a2]">{m.message}</p>
            {m.product_slug && (
              <p className="mt-1 text-xs text-[#a98d68]">
                Re: {m.product_slug}
              </p>
            )}
            {!m.is_read && (
              <button
                onClick={() => markRead(m.id)}
                className="mt-3 rounded-full border border-[#3a2b1e] px-3 py-1 text-xs text-[#c7b7a2] hover:border-[#8a5a34]"
              >
                Mark read
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
