"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { PublicConfig } from "./types";

const ConfigContext = createContext<PublicConfig | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    api<PublicConfig>("/api/config")
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}

export function useConfig(): PublicConfig | null {
  return useContext(ConfigContext);
}

/** Build a wa.me deep link with an optional pre-filled message. */
export function whatsappLink(number: string, message?: string): string {
  const base = `https://wa.me/${number.replace(/[^\d]/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
