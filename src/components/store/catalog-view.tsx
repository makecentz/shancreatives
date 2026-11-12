import Link from "next/link";
import { parseCatalogQuery, queryCatalog } from "@/lib/catalog";
import type { Category, Product } from "@/lib/types";
import { AutoSubmitForm } from "./auto-submit-form";
import { ProductCard } from "./product-card";

type SP = Record<string, string | string[] | undefined>;

export function CatalogView({
  products,
  categories,
  sp,
  basePath,
  fixedCategoryId,
}: {
  products: Product[];
  categories: Category[];
  sp: SP;
  basePath: string;
  fixedCategoryId?: string;
}) {
  const query = parseCatalogQuery(sp, fixedCategoryId);
  const result = queryCatalog(products, query);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") params.set(k, v);
  const nextParams = new URLSearchParams(params);
  nextParams.set("page", String(result.page + 1));

  const field = "h-11 w-full rounded-full border border-store-border bg-white px-4 text-sm outline-none focus:border-store-tan";

  return (
    <div className="grid gap-10 lg:grid-cols-[250px_1fr]">
      <aside aria-label="Filters">
        <AutoSubmitForm action={basePath} className="space-y-6 lg:sticky lg:top-28">
          <div>
            <label htmlFor="q" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">Search</label>
            <input id="q" name="q" defaultValue={query.q} placeholder="Search products" className={field} />
          </div>
          {!fixedCategoryId ? (
            <div>
              <label htmlFor="category" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">Category</label>
              <select id="category" name="category" defaultValue={query.category ?? ""} className={field} data-autosubmit>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : null}
          <fieldset>
            <legend className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">Type</legend>
            <div className="flex flex-wrap gap-2">
              {[["", "All"], ["ready_made", "Ready made"], ["custom", "Customizable"]].map(([v, l]) => (
                <label key={v} className="cursor-pointer">
                  <input type="radio" name="type" value={v} defaultChecked={(query.type ?? "") === v} className="peer sr-only" data-autosubmit />
                  <span className="inline-flex h-9 items-center rounded-full border border-store-border px-4 text-xs font-medium peer-checked:border-store-ink peer-checked:bg-store-ink peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-store-tan">{l}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]">Price</legend>
            <div className="flex items-center gap-2">
              <input name="min" inputMode="decimal" aria-label="Minimum price in dollars" placeholder="$ Min" defaultValue={query.minCents != null ? query.minCents / 100 : ""} className={field} />
              <span className="text-store-muted">&ndash;</span>
              <input name="max" inputMode="decimal" aria-label="Maximum price in dollars" placeholder="$ Max" defaultValue={query.maxCents != null ? query.maxCents / 100 : ""} className={field} />
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" name="in_stock" value="1" defaultChecked={query.inStock} className="size-4 accent-store-ink" data-autosubmit />
            In stock or made to order
          </label>
          <input type="hidden" name="sort" value={query.sort} />
          <div className="flex gap-2">
            <button className="h-10 flex-1 rounded-full bg-store-ink text-sm font-medium text-white">Apply</button>
            <Link href={basePath} className="inline-flex h-10 items-center rounded-full px-4 text-sm text-store-muted hover:text-store-ink">Reset</Link>
          </div>
        </AutoSubmitForm>
      </aside>

      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-store-border pb-4">
          <p className="text-sm text-store-muted" aria-live="polite">{result.total} {result.total === 1 ? "product" : "products"}</p>
          <AutoSubmitForm action={basePath} className="flex items-center gap-2">
            {Object.entries(sp).map(([k, v]) => (typeof v === "string" && k !== "sort" && k !== "page" ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <label htmlFor="sort" className="text-sm text-store-muted">Sort by</label>
            <select id="sort" name="sort" defaultValue={query.sort} className="h-10 rounded-full border border-store-border bg-white px-4 text-sm outline-none" data-autosubmit>
              <option value="newest">Newest</option>
              <option value="popular">Popularity</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name">Name</option>
            </select>
            <noscript><button className="text-sm underline">Go</button></noscript>
          </AutoSubmitForm>
        </div>
        {result.items.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3">
            {result.items.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 3} />)}
          </div>
        ) : (
          <div className="rounded-3xl bg-store-cream px-6 py-16 text-center">
            <p className="font-heading text-lg font-semibold">No products match those filters</p>
            <p className="mt-2 text-sm text-store-muted">Try removing a filter or searching for something else.</p>
            <Link href={basePath} className="mt-6 inline-flex h-10 items-center rounded-full border border-store-ink px-5 text-sm">Clear filters</Link>
          </div>
        )}
        {result.hasMore ? (
          <div className="mt-12 text-center">
            <Link scroll={false} href={`${basePath}?${nextParams.toString()}`} className="inline-flex h-12 items-center rounded-full border border-store-ink px-8 text-sm font-medium hover:bg-store-ink hover:text-white">
              Load more
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
