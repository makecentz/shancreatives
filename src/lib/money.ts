/** All money is integer cents. Never use floats for currency math. */
export type Cents = number;

export function assertCents(value: number): Cents {
  if (!Number.isInteger(value)) throw new Error(`Money must be integer cents, got ${value}`);
  return value;
}

export function formatMoney(cents: Cents, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function formatCompactMoney(cents: Cents): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) return `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(dollars)}`;
}

/** Percentage of an amount in basis points (1% = 100 bps), rounded half-up to the cent. */
export function percentOf(cents: Cents, basisPoints: number): Cents {
  return Math.round((cents * basisPoints) / 10000);
}
