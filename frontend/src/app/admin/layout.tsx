"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

const nav = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/messages", label: "Messages" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin || !ready) return;
    if (!user || user.role !== "owner") {
      router.replace("/admin/login");
    }
  }, [isLogin, ready, user, router]);

  // The login page is a bare surface — no sidebar, no guard.
  if (isLogin) {
    return <div className="min-h-dvh bg-[#211710] text-[#f2e8da]">{children}</div>;
  }

  if (!ready || !user || user.role !== "owner") {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#211710] text-[#c7b7a2]">
        Checking access…
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#1a120c] text-[#f2e8da] md:flex">
      {/* Sidebar */}
      <aside className="flex flex-col gap-1 border-b border-[#3a2b1e] bg-[#211710] px-4 py-4 md:w-60 md:border-b-0 md:border-r md:px-5 md:py-6">
        <div className="mb-4 md:mb-8">
          <p className="font-[family-name:var(--font-fraunces)] text-lg font-semibold">
            Garg Jewellers
          </p>
          <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-[#a98d68]">
            Owner Console
          </p>
        </div>
        <nav className="flex gap-1 md:flex-col">
          {nav.map((n) => {
            const active = n.exact
              ? pathname === n.href
              : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-[#8a5a34] text-white"
                    : "text-[#c7b7a2] hover:bg-[#2c2015]"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden pt-6 md:block">
          <p className="text-xs text-[#a98d68]">{user.email}</p>
          <button
            onClick={() => {
              logout();
              router.replace("/admin/login");
            }}
            className="mt-2 text-sm text-[#c7b7a2] underline hover:text-white"
          >
            Sign out
          </button>
          <Link
            href="/"
            className="mt-3 block text-xs text-[#a98d68] hover:text-[#c7b7a2]"
          >
            ← Back to store
          </Link>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
