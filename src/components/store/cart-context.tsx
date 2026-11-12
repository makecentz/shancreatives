"use client";

import * as React from "react";

/**
 * Guest cart, persisted in localStorage. Prices stored here are DISPLAY HINTS
 * only — /api/cart/validate and /api/checkout/create recompute every price,
 * discount and stock check on the server from catalogue records. Signed-in
 * customers' carts are additionally synced to the `carts` table.
 */
export interface CartLine {
  key: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  customize: boolean;
  rush: boolean;
  selections: Record<string, string | string[]>;
  display: {
    name: string;
    slug: string;
    imageUrl: string | null;
    variantLabel: string | null;
    unitPriceCents: number;
    selectionSummary: [string, string][];
  };
}

interface CartState {
  lines: CartLine[];
  count: number;
  ready: boolean;
  add: (line: Omit<CartLine, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = React.createContext<CartState | null>(null);
const STORAGE_KEY = "ss_cart_v1";

function lineKey(l: Omit<CartLine, "key">) {
  return [l.productId, l.variantId ?? "", l.customize ? "c" : "r", l.rush ? "rush" : "", JSON.stringify(l.selections)].join("|");
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once on mount
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
    setReady(true);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, ready]);

  const value = React.useMemo<CartState>(
    () => ({
      lines,
      ready,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      add: (line) =>
        setLines((cur) => {
          const key = lineKey(line);
          const existing = cur.find((l) => l.key === key);
          if (existing) return cur.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l));
          return [...cur, { ...line, key }];
        }),
      setQuantity: (key, quantity) =>
        setLines((cur) => cur.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(50, quantity)) } : l))),
      remove: (key) => setLines((cur) => cur.filter((l) => l.key !== key)),
      clear: () => setLines([]),
    }),
    [lines, ready],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
