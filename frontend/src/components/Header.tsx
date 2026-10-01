"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { CartIcon, UserIcon } from "./icons";

export default function Header() {
  const pathname = usePathname();
  const { count } = useCart();
  const { user } = useAuth();

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-display text-lg font-semibold tracking-tight text-ink md:text-xl">
            Garg Jewellers
          </span>
          <span className="eyebrow mt-0.5 text-[0.6rem] text-silver">
            Jhansi · 925 Silver
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
          <Link href="/categories" className="transition hover:text-brand-deep">
            Shop
          </Link>
          <Link href="/tryon" className="transition hover:text-brand-deep">
            Try-On
          </Link>
          <Link href="/contact" className="transition hover:text-brand-deep">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href={user ? "/account" : "/login"}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink-soft transition hover:bg-surface-alt"
            aria-label={user ? "Your account" : "Log in"}
          >
            <UserIcon className="h-5 w-5" />
            <span className="hidden md:inline">
              {user ? user.name.split(" ")[0] : "Log in"}
            </span>
          </Link>
          <Link
            href="/cart"
            className="relative flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink-soft transition hover:bg-surface-alt"
            aria-label="Cart"
          >
            <CartIcon className="h-5 w-5" />
            <span className="hidden md:inline">Cart</span>
            {count > 0 && (
              <span className="absolute -top-0.5 left-5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] font-semibold text-surface md:left-auto md:right-1">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
