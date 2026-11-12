/**
 * In-memory mirror of the inventory rules implemented atomically in SQL
 * (public.reserve_inventory / release_inventory / commit_inventory in
 * supabase/migrations/0003_functions.sql). Used by unit tests to pin the rules
 * and by demo mode. Production always calls the SQL functions, which lock
 * variant rows with SELECT ... FOR UPDATE so concurrent checkouts can't oversell.
 */
export interface StockRow {
  variantId: string;
  stock: number | null; // null = made to order, no finished stock
  reserved: number;
  capacity?: number | null; // optional limited production capacity for made-to-order
}

export interface ReservationRequest {
  variantId: string;
  quantity: number;
}

export class InsufficientStockError extends Error {
  constructor(public readonly variantId: string, public readonly available: number) {
    super(`Only ${available} left for ${variantId}`);
    this.name = "InsufficientStockError";
  }
}

/** All-or-nothing reservation. Returns new rows; throws without mutating on failure. */
export function reserve(rows: Map<string, StockRow>, requests: ReservationRequest[]): Map<string, StockRow> {
  const next = new Map([...rows].map(([k, v]) => [k, { ...v }]));
  for (const r of requests) {
    const row = next.get(r.variantId);
    if (!row) throw new Error(`Unknown variant ${r.variantId}`);
    if (r.quantity < 1) throw new Error("Quantity must be positive");
    const limit = row.stock ?? row.capacity ?? null;
    if (limit !== null) {
      const available = limit - row.reserved;
      if (available < r.quantity) throw new InsufficientStockError(r.variantId, Math.max(0, available));
    }
    row.reserved += r.quantity;
  }
  return next;
}

/** Release a reservation (payment expired or definitively failed). */
export function release(rows: Map<string, StockRow>, requests: ReservationRequest[]): Map<string, StockRow> {
  const next = new Map([...rows].map(([k, v]) => [k, { ...v }]));
  for (const r of requests) {
    const row = next.get(r.variantId);
    if (row) row.reserved = Math.max(0, row.reserved - r.quantity);
  }
  return next;
}

/** Commit a reservation on verified payment: decrement stock and the reservation. */
export function commit(rows: Map<string, StockRow>, requests: ReservationRequest[]): Map<string, StockRow> {
  const next = new Map([...rows].map(([k, v]) => [k, { ...v }]));
  for (const r of requests) {
    const row = next.get(r.variantId);
    if (!row) continue;
    row.reserved = Math.max(0, row.reserved - r.quantity);
    if (row.stock !== null) row.stock = Math.max(0, row.stock - r.quantity);
    else if (row.capacity != null) row.capacity = Math.max(0, row.capacity - r.quantity);
  }
  return next;
}
