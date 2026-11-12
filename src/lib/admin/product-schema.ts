import { z } from "zod";

const cents = z.number().int().min(0).max(10_000_000);

export const productFormSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Name is required").max(140),
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    shortDescription: z.string().trim().max(240),
    description: z.string().trim().max(8000),
    status: z.enum(["draft", "active", "archived", "out_of_stock"]),
    fulfillmentType: z.enum(["ready_made", "custom", "both"]),
    customizerKind: z.enum(["shirt", "crochet_doll", "generic", ""]),
    categoryIds: z.array(z.string()),
    basePriceCents: cents,
    salePriceCents: cents.nullable(),
    productionDaysMin: z.number().int().min(0).max(365).nullable(),
    productionDaysMax: z.number().int().min(0).max(365).nullable(),
    quoteOnly: z.boolean(),
    rushAvailable: z.boolean(),
    rushFeeCents: cents,
    isFeatured: z.boolean(),
    isSeasonal: z.boolean(),
    seoTitle: z.string().trim().max(70),
    seoDescription: z.string().trim().max(170),
    media: z.array(z.object({ path: z.string().min(1), alt: z.string().max(200) })).max(20),
    variants: z
      .array(
        z.object({
          id: z.string().optional(),
          sku: z.string().trim().min(1, "SKU required").max(64),
          size: z.string().trim().max(40),
          color: z.string().trim().max(40),
          priceCents: cents.nullable(),
          salePriceCents: cents.nullable(),
          stockQuantity: z.number().int().min(0).nullable(),
          lowStockThreshold: z.number().int().min(0).max(10000),
          isActive: z.boolean(),
        }),
      )
      .max(200),
    fields: z
      .array(
        z.object({
          key: z.string().trim().regex(/^[a-z0-9_]+$/, "Use lowercase and underscores"),
          label: z.string().trim().min(1).max(80),
          type: z.enum(["text", "textarea", "select", "multi_select", "color", "file", "number", "checkbox"]),
          required: z.boolean(),
          helpText: z.string().max(200),
          priceDeltaCents: cents,
          maxLength: z.number().int().min(1).max(5000).nullable(),
          options: z.array(z.object({ value: z.string().trim().min(1).max(64), label: z.string().trim().min(1).max(80), priceDeltaCents: cents, swatch: z.string().max(20).optional() })).max(50),
        }),
      )
      .max(30),
  })
  .refine((p) => p.salePriceCents == null || p.salePriceCents < p.basePriceCents, { message: "Sale price must be lower than the regular price", path: ["salePriceCents"] })
  .refine((p) => p.productionDaysMin == null || p.productionDaysMax == null || p.productionDaysMax >= p.productionDaysMin, { message: "Max must be at least min", path: ["productionDaysMax"] })
  .refine((p) => new Set(p.variants.map((v) => v.sku)).size === p.variants.length, { message: "SKUs must be unique", path: ["variants"] })
  .refine((p) => new Set(p.fields.map((f) => f.key)).size === p.fields.length, { message: "Field keys must be unique", path: ["fields"] });

export type ProductFormValues = z.infer<typeof productFormSchema>;
