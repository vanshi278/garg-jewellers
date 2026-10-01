"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";
import type { Cart } from "./types";

const CART_TOKEN_KEY = "gj_cart_token";

interface CartContextValue {
  cart: Cart | null;
  count: number;
  loading: boolean;
  addItem: (variantId: number, qty?: number) => Promise<void>;
  updateItem: (itemId: number, qty: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

function readCartToken(): string | null {
  try {
    return localStorage.getItem(CART_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeCartToken(t: string) {
  try {
    localStorage.setItem(CART_TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const mergedFor = useRef<number | null>(null);

  // Common request options: attach auth token and/or guest cart token.
  const opts = useCallback(
    (extra: Record<string, unknown> = {}) => ({
      token,
      cartToken: readCartToken(),
      ...extra,
    }),
    [token],
  );

  const applyCart = useCallback((c: Cart) => {
    setCart(c);
    if (c.token) writeCartToken(c.token);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const c = await api<Cart>("/api/cart", opts());
      applyCart(c);
    } catch {
      /* ignore — empty cart is fine */
    } finally {
      setLoading(false);
    }
  }, [opts, applyCart]);

  // On login, merge the guest cart into the user's cart exactly once.
  useEffect(() => {
    if (!user || !token) {
      refresh();
      return;
    }
    if (mergedFor.current === user.id) {
      refresh();
      return;
    }
    const guestToken = readCartToken();
    (async () => {
      setLoading(true);
      try {
        if (guestToken) {
          const c = await api<Cart>("/api/cart/merge", {
            method: "POST",
            token,
            body: JSON.stringify({ token: guestToken }),
          });
          applyCart(c);
        } else {
          const c = await api<Cart>("/api/cart", { token });
          applyCart(c);
        }
        mergedFor.current = user.id;
      } finally {
        setLoading(false);
      }
    })();
  }, [user, token, refresh, applyCart]);

  const addItem = useCallback(
    async (variantId: number, qty = 1) => {
      const c = await api<Cart>("/api/cart/items", {
        method: "POST",
        ...opts({ body: JSON.stringify({ variant_id: variantId, qty }) }),
      });
      applyCart(c);
    },
    [opts, applyCart],
  );

  const updateItem = useCallback(
    async (itemId: number, qty: number) => {
      const c = await api<Cart>(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        ...opts({ body: JSON.stringify({ qty }) }),
      });
      applyCart(c);
    },
    [opts, applyCart],
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      const c = await api<Cart>(`/api/cart/items/${itemId}`, {
        method: "DELETE",
        ...opts(),
      });
      applyCart(c);
    },
    [opts, applyCart],
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        count: cart?.item_count ?? 0,
        loading,
        addItem,
        updateItem,
        removeItem,
        refresh,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
