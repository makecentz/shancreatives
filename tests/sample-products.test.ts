import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T>(fn: T) => fn }));
vi.mock("@/lib/env", () => ({ isDemoMode: () => false }));

let samplesRow: unknown = null;
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (table: string) => {
      const q = {
        select: () => q, eq: () => q, in: () => q, order: () => q,
        maybeSingle: async () => ({ data: table === "site_content" ? samplesRow : null, error: null }),
        then: (res: (v: unknown) => void) => res({ data: [], error: null }),
      };
      return q;
    },
  }),
}));

const catalog = await import("@/lib/data/catalog");
const { demoProducts } = await import("@/lib/demo/catalog");

describe("sample products on the live store", () => {
  beforeEach(() => { samplesRow = null; });

  it("shows labelled samples by default until the owner turns them off", async () => {
    const products = await catalog.getStoreProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.isDemo)).toBe(true);
    expect((await catalog.getStoreCategories()).length).toBeGreaterThan(0);
  });

  it("hides them when the toggle is off", async () => {
    samplesRow = { published: { enabled: false } };
    expect(await catalog.getStoreProducts()).toEqual([]);
    expect(await catalog.getProductBySlug(demoProducts[0].slug)).toBeNull();
  });

  it("never lets checkout or cart validation see a sample", async () => {
    const ids = demoProducts.map((p) => p.id);
    expect(await catalog.getProductsByIds(ids)).toEqual([]);
  });

  it("keeps samples out of the admin category list", async () => {
    expect(await catalog.getCategories()).toEqual([]);
  });
});
