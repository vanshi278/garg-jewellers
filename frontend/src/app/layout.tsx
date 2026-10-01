import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { ConfigProvider } from "@/lib/config-context";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Garg Jewellers · 925 Sterling Silver, Jhansi",
  description:
    "Handpicked 925 sterling silver jewellery from Garg Jewellers, Jhansi. Rings, earrings, necklaces and more — try on before you buy.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${workSans.variable}`}>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <ConfigProvider>
          <AuthProvider>
            <CartProvider>
              <Header />
              {/* Bottom padding keeps content clear of the mobile bottom nav. */}
              <main className="pb-24 md:pb-0">{children}</main>
              <BottomNav />
            </CartProvider>
          </AuthProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
