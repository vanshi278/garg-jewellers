"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import {
  CartIcon,
  ChatIcon,
  GridIcon,
  HomeIcon,
  TryOnIcon,
} from "./icons";

const items = [
  { href: "/", label: "Home", Icon: HomeIcon, match: (p: string) => p === "/" },
  {
    href: "/categories",
    label: "Shop",
    Icon: GridIcon,
    match: (p: string) => p.startsWith("/categories") || p.startsWith("/category"),
  },
  null, // centre slot for Try-On
  {
    href: "/cart",
    label: "Cart",
    Icon: CartIcon,
    match: (p: string) => p.startsWith("/cart") || p.startsWith("/checkout"),
  },
  {
    href: "/contact",
    label: "Contact",
    Icon: ChatIcon,
    match: (p: string) => p.startsWith("/contact"),
  },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { count } = useCart();

  // Hidden on the owner console.
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      aria-label="Primary"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-2 pb-2">
        {items.map((item, i) => {
          // Centre raised Try-On button.
          if (item === null) {
            const active = pathname.startsWith("/tryon");
            return (
              <li key="tryon" className="flex justify-center">
                <Link
                  href="/tryon"
                  className="flex flex-col items-center gap-1"
                  aria-label="Try on jewellery"
                >
                  <span
                    className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-bg shadow-lg transition ${
                      active ? "bg-brand-deep" : "bg-brand"
                    }`}
                  >
                    <TryOnIcon className="h-6 w-6 text-surface" />
                  </span>
                  <span className="eyebrow text-[0.6rem] text-brand-deep">
                    Try-On
                  </span>
                </Link>
              </li>
            );
          }
          const active = item.match(pathname);
          const isCart = item.href === "/cart";
          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                className={`relative flex flex-col items-center gap-1 py-1 ${
                  active ? "text-brand-deep" : "text-ink-soft"
                }`}
              >
                <item.Icon className="h-5 w-5" />
                {isCart && count > 0 && (
                  <span className="absolute -top-1 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] font-semibold text-surface">
                    {count}
                  </span>
                )}
                <span className="text-[0.62rem] font-medium tracking-wide">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
