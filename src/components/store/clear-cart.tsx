"use client";

import * as React from "react";
import { useCart } from "./cart-context";

/** Clears the local cart once the server has confirmed the order is paid. */
export function ClearCartOnPaid() {
  const { clear, ready } = useCart();
  React.useEffect(() => {
    if (!ready) return;
    clear();
    try {
      sessionStorage.removeItem("ss_discount");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return null;
}
