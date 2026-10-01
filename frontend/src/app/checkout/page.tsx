"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";
import type { Order, PaymentInit } from "@/lib/types";

interface AddressForm {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

const empty: AddressForm = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

export default function CheckoutPage() {
  const { user, token, ready } = useAuth();
  const { cart, refresh } = useCart();
  const router = useRouter();
  const [addr, setAddr] = useState<AddressForm>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) setAddr((a) => ({ ...a, name: user.name, phone: user.phone ?? "" }));
  }, [user]);

  // Login gate — login is only required at checkout (architecture §8).
  if (ready && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl text-ink">Almost there</h1>
        <p className="mt-2 text-ink-soft">
          Please log in or create an account to complete your order.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/login?next=/checkout"
            className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-surface hover:bg-brand-deep"
          >
            Log in
          </Link>
          <Link
            href="/signup?next=/checkout"
            className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium text-brand-deep hover:border-brand"
          >
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  function set<K extends keyof AddressForm>(k: K, v: string) {
    setAddr((a) => ({ ...a, [k]: v }));
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const init = await api<PaymentInit>("/api/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({
          address: {
            name: addr.name,
            phone: addr.phone,
            line1: addr.line1,
            line2: addr.line2 || null,
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
          },
        }),
      });

      if (init.mock) {
        // Mock payment path — confirm immediately with the sentinel signature.
        await confirmPayment(init, `pay_mock_${Date.now()}`, "mock_signature");
      } else {
        await openRazorpay(init);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function confirmPayment(
    init: PaymentInit,
    paymentId: string,
    signature: string,
  ) {
    const order = await api<Order>("/api/checkout/confirm", {
      method: "POST",
      token,
      body: JSON.stringify({
        order_number: init.order_number,
        razorpay_order_id: init.provider_order_id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }),
    });
    await refresh();
    router.push(`/order/${order.number}`);
  }

  // Real Razorpay Checkout widget (used when live keys are configured).
  async function openRazorpay(init: PaymentInit) {
    await loadRazorpayScript();
    // @ts-expect-error injected by the external script
    const rzp = new window.Razorpay({
      key: init.key_id,
      amount: init.amount,
      currency: init.currency,
      name: "Garg Jewellers",
      order_id: init.provider_order_id,
      prefill: { name: addr.name, contact: addr.phone },
      theme: { color: "#8a5a34" },
      handler: (resp: {
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) =>
        confirmPayment(
          init,
          resp.razorpay_payment_id,
          resp.razorpay_signature,
        ),
      modal: { ondismiss: () => setBusy(false) },
    });
    rzp.open();
  }

  const lines = cart?.lines ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="mb-6 font-display text-3xl text-ink">Checkout</h1>
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <form onSubmit={placeOrder} className="flex flex-col gap-4">
          <h2 className="font-display text-lg text-ink">Shipping address</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" value={addr.name} onChange={(v) => set("name", v)} required />
            <Field label="Phone" value={addr.phone} onChange={(v) => set("phone", v)} required />
          </div>
          <Field label="Address line 1" value={addr.line1} onChange={(v) => set("line1", v)} required />
          <Field label="Address line 2 (optional)" value={addr.line2} onChange={(v) => set("line2", v)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City" value={addr.city} onChange={(v) => set("city", v)} required />
            <Field label="State" value={addr.state} onChange={(v) => set("state", v)} required />
            <Field label="Pincode" value={addr.pincode} onChange={(v) => set("pincode", v)} required />
          </div>

          {error && (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || lines.length === 0}
            className="mt-2 rounded-full bg-brand px-6 py-3.5 text-sm font-medium text-surface transition hover:bg-brand-deep disabled:opacity-50"
          >
            {busy ? "Processing…" : `Pay ${formatPrice(cart?.subtotal ?? "0")}`}
          </button>
          <p className="text-center text-xs text-silver">
            Secured by Razorpay · UPI, cards, netbanking
          </p>
        </form>

        <aside className="h-fit rounded-[--radius-card] border border-line bg-surface p-5">
          <h2 className="font-display text-lg text-ink">Order</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {lines.map((l) => (
              <li key={l.item_id} className="flex justify-between gap-2 text-ink-soft">
                <span>
                  {l.product_name}{" "}
                  <span className="text-silver">×{l.qty}</span>
                </span>
                <span className="tabular-nums">{formatPrice(l.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-line pt-3 font-medium text-ink">
            <span>Subtotal</span>
            <span>{formatPrice(cart?.subtotal ?? "0")}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-soft">{label}</span>
      <input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("razorpay-sdk")) return resolve();
    const s = document.createElement("script");
    s.id = "razorpay-sdk";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load payment SDK"));
    document.body.appendChild(s);
  });
}
