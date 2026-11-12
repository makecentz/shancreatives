/**
 * DEMO DATA — clearly labelled sample catalogue used only when Supabase is not
 * configured (or DEMO_MODE=true). Every record carries isDemo: true and the UI
 * shows a "Demo product" badge. Never loaded in a configured production store.
 */
import type { Category, CustomizationField, Product, ProductVariant } from "../types";

export const demoCategories: Category[] = [
  { id: "cat-shirts", slug: "custom-shirts", name: "Custom Shirts", description: "Tees printed with your words, names, and designs.", imageUrl: "/demo/tee-black-custom.jpg", sortOrder: 1 },
  { id: "cat-dolls", slug: "crochet-dolls", name: "Crochet Dolls", description: "Hand-crocheted friends, stitch by stitch.", imageUrl: "/demo/doll-honey-bear.svg", sortOrder: 2 },
  { id: "cat-ready", slug: "ready-to-ship", name: "Ready to Ship", description: "Finished pieces that leave the studio in days.", imageUrl: "/demo/tee-black-crown.jpg", sortOrder: 3 },
  { id: "cat-gifts", slug: "personalized-gifts", name: "Personalized Gifts", description: "Thoughtful keepsakes with a personal touch.", imageUrl: "/demo/gift-ornament.svg", sortOrder: 4 },
  { id: "cat-new", slug: "new-arrivals", name: "New Arrivals", description: "Fresh from the worktable.", imageUrl: "/demo/doll-blossom-bunny.svg", sortOrder: 5 },
  { id: "cat-seasonal", slug: "seasonal-favorites", name: "Seasonal Favorites", description: "Holiday and seasonal makes, while they last.", imageUrl: "/demo/doll-holiday-gnome.svg", sortOrder: 6 },
];

const SIZES = ["XS", "S", "M", "L", "XL", "2XL"];

function shirtVariants(prefix: string, colors: string[], stockEach: number | null): ProductVariant[] {
  return colors.flatMap((color) =>
    SIZES.map((size, i) => ({
      id: `${prefix}-${color.toLowerCase()}-${size.toLowerCase()}`,
      sku: `${prefix.toUpperCase()}-${color.slice(0, 3).toUpperCase()}-${size}`,
      size,
      color,
      priceCents: size === "2XL" ? 2800 + 300 : null,
      salePriceCents: null,
      stockQuantity: stockEach === null ? null : i === 0 ? 2 : stockEach,
      reservedQuantity: 0,
      lowStockThreshold: 3,
      isActive: true,
    })),
  );
}

const shirtFields: CustomizationField[] = [
  {
    id: "f-shirt-type", key: "shirt_type", label: "Shirt type", type: "select", required: true, sortOrder: 1, priceDeltaCents: 0,
    options: [
      { value: "classic", label: "Classic crew tee", priceDeltaCents: 0 },
      { value: "premium", label: "Premium heavyweight tee", priceDeltaCents: 600 },
      { value: "long_sleeve", label: "Long sleeve tee", priceDeltaCents: 800 },
    ],
  },
  { id: "f-shirt-text", key: "custom_text", label: "Custom text", type: "text", required: false, maxLength: 40, sortOrder: 2, priceDeltaCents: 0, options: [], helpText: "Up to 40 characters." },
  {
    id: "f-shirt-placement", key: "text_placement", label: "Placement", type: "select", required: false, sortOrder: 3, priceDeltaCents: 0,
    options: [
      { value: "front_center", label: "Front center", priceDeltaCents: 0 },
      { value: "left_chest", label: "Left chest", priceDeltaCents: 0 },
      { value: "back", label: "Full back", priceDeltaCents: 500 },
      { value: "front_and_back", label: "Front and back", priceDeltaCents: 900 },
    ],
  },
  {
    id: "f-shirt-font", key: "font_style", label: "Font style", type: "select", required: false, sortOrder: 4, priceDeltaCents: 0,
    options: [
      { value: "classic_serif", label: "Classic serif", priceDeltaCents: 0 },
      { value: "modern_sans", label: "Modern sans", priceDeltaCents: 0 },
      { value: "handwritten", label: "Handwritten script", priceDeltaCents: 0 },
      { value: "varsity", label: "Varsity block", priceDeltaCents: 0 },
    ],
  },
  { id: "f-shirt-upload", key: "design_upload", label: "Upload your design", type: "file", required: false, sortOrder: 5, priceDeltaCents: 400, options: [], helpText: "PNG, JPG, or WebP up to 10 MB. A $4 artwork setup fee applies." },
  { id: "f-shirt-notes", key: "special_instructions", label: "Special instructions", type: "textarea", required: false, maxLength: 600, sortOrder: 6, priceDeltaCents: 0, options: [] },
];

const YARN = [
  { value: "oat", label: "Oat", swatch: "#e9dccb" },
  { value: "honey", label: "Honey", swatch: "#b88a62" },
  { value: "blush", label: "Blush", swatch: "#e7b8c2" },
  { value: "sage", label: "Sage", swatch: "#9cbf8a" },
  { value: "sky", label: "Sky", swatch: "#8fb3c9" },
  { value: "cocoa", label: "Cocoa", swatch: "#5a3b2a" },
  { value: "berry", label: "Berry", swatch: "#b23a3a" },
];

const dollFields: CustomizationField[] = [
  {
    id: "f-doll-style", key: "doll_style", label: "Doll style", type: "select", required: true, sortOrder: 1, priceDeltaCents: 0,
    options: [
      { value: "bear", label: "Bear", priceDeltaCents: 0 },
      { value: "bunny", label: "Bunny", priceDeltaCents: 0 },
      { value: "person", label: "Mini-me person doll", priceDeltaCents: 1500 },
      { value: "pet", label: "Pet portrait", priceDeltaCents: 2000 },
    ],
  },
  {
    id: "f-doll-size", key: "doll_size", label: "Size", type: "select", required: true, sortOrder: 2, priceDeltaCents: 0,
    options: [
      { value: "mini", label: "Mini (6 in)", priceDeltaCents: 0 },
      { value: "classic", label: "Classic (10 in)", priceDeltaCents: 1200 },
      { value: "cuddle", label: "Cuddle (16 in)", priceDeltaCents: 2800 },
    ],
  },
  { id: "f-doll-body", key: "body_color", label: "Body yarn", type: "color", required: true, sortOrder: 3, priceDeltaCents: 0, options: YARN.map((y) => ({ ...y, priceDeltaCents: 0 })) },
  { id: "f-doll-accent", key: "accent_color", label: "Accent yarn", type: "color", required: false, sortOrder: 4, priceDeltaCents: 0, options: YARN.map((y) => ({ ...y, priceDeltaCents: 0 })) },
  {
    id: "f-doll-outfit", key: "outfit", label: "Clothing or outfit", type: "select", required: false, sortOrder: 5, priceDeltaCents: 0,
    options: [
      { value: "none", label: "No outfit", priceDeltaCents: 0 },
      { value: "overalls", label: "Overalls", priceDeltaCents: 600 },
      { value: "dress", label: "Dress", priceDeltaCents: 600 },
      { value: "sweater", label: "Cozy sweater", priceDeltaCents: 800 },
    ],
  },
  {
    id: "f-doll-acc", key: "accessories", label: "Accessories", type: "multi_select", required: false, sortOrder: 6, priceDeltaCents: 0,
    options: [
      { value: "bow", label: "Bow", priceDeltaCents: 300 },
      { value: "scarf", label: "Scarf", priceDeltaCents: 400 },
      { value: "flower", label: "Flower crown", priceDeltaCents: 500 },
      { value: "hat", label: "Bobble hat", priceDeltaCents: 500 },
    ],
  },
  { id: "f-doll-name", key: "personalized_name", label: "Personalized name", type: "text", required: false, maxLength: 16, sortOrder: 7, priceDeltaCents: 500, options: [], helpText: "Embroidered name tag, +$5." },
  { id: "f-doll-photo", key: "reference_photo", label: "Reference photo", type: "file", required: false, sortOrder: 8, priceDeltaCents: 0, options: [], helpText: "Optional. Kept private and only seen by our makers." },
  { id: "f-doll-notes", key: "special_instructions", label: "Special design instructions", type: "textarea", required: false, maxLength: 800, sortOrder: 9, priceDeltaCents: 0, options: [] },
];

const base = {
  status: "active" as const,
  salePriceCents: null,
  quoteOnly: false,
  rushAvailable: false,
  rushFeeCents: 0,
  isFeatured: false,
  isSeasonal: false,
  seoTitle: null,
  seoDescription: null,
  customizationFields: [] as CustomizationField[],
  isDemo: true,
};

function media(id: string, urls: string[], alt: string) {
  return urls.map((url, i) => ({ id: `${id}-m${i}`, url, alt: i === 0 ? alt : `${alt}, view ${i + 1}`, sortOrder: i }));
}

function single(id: string, sku: string, stock: number | null, low = 2): ProductVariant[] {
  return [{ id: `${id}-default`, sku, size: null, color: null, priceCents: null, salePriceCents: null, stockQuantity: stock, reservedQuantity: 0, lowStockThreshold: low, isActive: true }];
}

export const demoProducts: Product[] = [
  {
    ...base,
    id: "p-custom-tee", slug: "design-your-own-tee", name: "Design Your Own Tee",
    shortDescription: "Your words, your art, printed on a soft everyday tee.",
    description: "Start with a soft, pre-shrunk cotton tee and make it entirely yours. Add a name, a saying, or upload your own artwork. Every custom shirt gets a quick design check from our team before it goes to print.",
    fulfillmentType: "custom", customizerKind: "shirt", categoryIds: ["cat-shirts", "cat-gifts"],
    basePriceCents: 2800, productionDaysMin: 5, productionDaysMax: 8, rushAvailable: true, rushFeeCents: 1200, isFeatured: true,
    media: media("p-custom-tee", ["/demo/tee-black-custom.jpg", "/demo/tee-black-folded.jpg"], "Folded black tee with a placeholder for your custom design"),
    variants: shirtVariants("cust", ["Black", "White", "Sand"], null),
    customizationFields: shirtFields, createdAt: "2026-10-02T15:00:00Z", unitsSold: 142,
  },
  {
    ...base,
    id: "p-crown-tee", slug: "crown-squirrel-signature-tee", name: "Crown Signature Tee",
    shortDescription: "Our crowned-S signature mark on a heavyweight black tee.",
    description: "The Shagannan Shenanigans signature mark, printed in crisp white on a heavyweight black tee. Ready to ship in standard sizes.",
    fulfillmentType: "ready_made", customizerKind: null, categoryIds: ["cat-shirts", "cat-ready"],
    basePriceCents: 3200, salePriceCents: 2600, productionDaysMin: null, productionDaysMax: null, isFeatured: true,
    media: media("p-crown-tee", ["/demo/tee-black-crown.jpg", "/demo/tee-black-folded.jpg"], "Folded black tee with white crowned S logo"),
    variants: shirtVariants("crown", ["Black"], 8).map((v) => ({ ...v, priceCents: v.size === "2XL" ? 3500 : null, salePriceCents: v.size === "2XL" ? 2900 : null })),
    createdAt: "2026-09-12T15:00:00Z", unitsSold: 210,
  },
  {
    ...base,
    id: "p-mama-tee", slug: "mama-est-tee", name: "Mama Est. Tee",
    shortDescription: "Ready to wear, or personalize the year.",
    description: "A tan script “Mama” print with an established year. Buy it ready-made with the current year, or personalize the year and add a name to the sleeve.",
    fulfillmentType: "both", customizerKind: "shirt", categoryIds: ["cat-shirts", "cat-gifts", "cat-new"],
    basePriceCents: 3000, productionDaysMin: 4, productionDaysMax: 6, isFeatured: true,
    media: media("p-mama-tee", ["/demo/tee-black-mama.jpg", "/demo/tee-black-folded.jpg"], "Folded black tee with tan Mama script print"),
    variants: shirtVariants("mama", ["Black"], 5),
    customizationFields: shirtFields.filter((f) => ["custom_text", "font_style", "special_instructions"].includes(f.key)).map((f) => (f.key === "custom_text" ? { ...f, label: "Year or sleeve name", priceDeltaCents: 400, helpText: "+$4 to personalize." } : f)),
    createdAt: "2026-11-01T15:00:00Z", unitsSold: 64,
  },
  {
    ...base,
    id: "p-honey-bear", slug: "honey-bear-crochet-doll", name: "Honey Bear Crochet Doll",
    shortDescription: "A classic 10-inch bear with a tan scarf.",
    description: "Crocheted by hand in soft cotton-blend yarn with safety eyes and a cozy tan scarf. Ready to ship, or order a custom version in your colors.",
    fulfillmentType: "both", customizerKind: "crochet_doll", categoryIds: ["cat-dolls", "cat-ready", "cat-gifts"],
    basePriceCents: 4800, productionDaysMin: 10, productionDaysMax: 14, rushAvailable: true, rushFeeCents: 1800, isFeatured: true,
    media: media("p-honey-bear", ["/demo/doll-honey-bear.svg"], "Illustration of a honey-brown crochet bear with a tan scarf"),
    variants: single("p-honey-bear", "DOLL-BEAR-10", 3),
    customizationFields: dollFields.filter((f) => f.key !== "doll_style"),
    createdAt: "2026-08-20T15:00:00Z", unitsSold: 88,
  },
  {
    ...base,
    id: "p-blossom-bunny", slug: "blossom-bunny-crochet-doll", name: "Blossom Bunny",
    shortDescription: "Long-eared bunny in oat and blush with a flower.",
    description: "A gentle long-eared bunny in oat and blush yarn, finished with a tiny daisy. Each one is made after you order.",
    fulfillmentType: "custom", customizerKind: "crochet_doll", categoryIds: ["cat-dolls", "cat-new"],
    basePriceCents: 5200, productionDaysMin: 12, productionDaysMax: 16, rushAvailable: true, rushFeeCents: 1800, isFeatured: true,
    media: media("p-blossom-bunny", ["/demo/doll-blossom-bunny.svg"], "Illustration of a cream and pink crochet bunny with a daisy"),
    variants: single("p-blossom-bunny", "DOLL-BUNNY", null),
    customizationFields: dollFields.filter((f) => f.key !== "doll_style"),
    createdAt: "2026-10-28T15:00:00Z", unitsSold: 41,
  },
  {
    ...base,
    id: "p-keepsake-doll", slug: "custom-keepsake-doll", name: "Custom Keepsake Doll",
    shortDescription: "A one-of-a-kind doll made from your photos.",
    description: "Send us a photo and we will crochet a keepsake doll inspired by your person or pet. Because every keepsake is different, we review your request and send a quote before you pay.",
    fulfillmentType: "custom", customizerKind: "crochet_doll", categoryIds: ["cat-dolls", "cat-gifts"],
    basePriceCents: 8500, productionDaysMin: 21, productionDaysMax: 28, quoteOnly: true,
    media: media("p-keepsake-doll", ["/demo/doll-custom-keepsake.svg"], "Illustration of a crochet person doll with a name tag"),
    variants: single("p-keepsake-doll", "DOLL-KEEPSAKE", null),
    customizationFields: dollFields,
    createdAt: "2026-07-15T15:00:00Z", unitsSold: 23,
  },
  {
    ...base,
    id: "p-mini-sprout", slug: "mini-sprout-crochet-doll", name: "Mini Sprout",
    shortDescription: "A palm-sized sprout friend. Ready to ship.",
    description: "A tiny, squishy sprout buddy that fits in a pocket. Ready to ship.",
    fulfillmentType: "ready_made", customizerKind: null, categoryIds: ["cat-dolls", "cat-ready"],
    basePriceCents: 2200, productionDaysMin: null, productionDaysMax: null,
    media: media("p-mini-sprout", ["/demo/doll-mini-sprout.svg"], "Illustration of a small green crochet sprout doll"),
    variants: single("p-mini-sprout", "DOLL-SPROUT", 0),
    status: "out_of_stock",
    createdAt: "2026-06-30T15:00:00Z", unitsSold: 57,
  },
  {
    ...base,
    id: "p-gnome", slug: "holiday-gnome-crochet-doll", name: "Holiday Gnome",
    shortDescription: "A cheery seasonal gnome with a berry hat.",
    description: "Our seasonal gnome with a berry-red hat and fluffy beard. Limited holiday run.",
    fulfillmentType: "ready_made", customizerKind: null, categoryIds: ["cat-dolls", "cat-seasonal", "cat-ready"],
    basePriceCents: 3600, salePriceCents: null, isSeasonal: true,
    productionDaysMin: null, productionDaysMax: null,
    media: media("p-gnome", ["/demo/doll-holiday-gnome.svg"], "Illustration of a crochet gnome with a red hat"),
    variants: single("p-gnome", "DOLL-GNOME", 6),
    createdAt: "2026-11-05T15:00:00Z", unitsSold: 19,
  },
  {
    ...base,
    id: "p-ornament", slug: "personalized-family-ornament", name: "Personalized Family Ornament",
    shortDescription: "A keepsake ornament with your family name.",
    description: "A satin-finish ornament personalized with your family name and year. Made to order.",
    fulfillmentType: "custom", customizerKind: "generic", categoryIds: ["cat-gifts", "cat-seasonal"],
    basePriceCents: 1800, productionDaysMin: 3, productionDaysMax: 5, isSeasonal: true,
    media: media("p-ornament", ["/demo/gift-ornament.svg"], "Illustration of a gold ornament reading The Millers"),
    variants: single("p-ornament", "GIFT-ORN", null),
    customizationFields: [
      { id: "f-orn-name", key: "family_name", label: "Family name", type: "text", required: true, maxLength: 20, sortOrder: 1, priceDeltaCents: 0, options: [] },
      { id: "f-orn-year", key: "year", label: "Year", type: "text", required: false, maxLength: 4, sortOrder: 2, priceDeltaCents: 0, options: [] },
    ],
    createdAt: "2026-11-08T15:00:00Z", unitsSold: 36,
  },
  {
    ...base,
    id: "p-tote", slug: "made-with-love-tote", name: "Made With Love Tote",
    shortDescription: "Sturdy canvas tote. Ready to ship.",
    description: "A heavy canvas tote printed with our “made with love” motif. Ready to ship.",
    fulfillmentType: "ready_made", customizerKind: null, categoryIds: ["cat-gifts", "cat-ready"],
    basePriceCents: 2400,
    productionDaysMin: null, productionDaysMax: null,
    media: media("p-tote", ["/demo/gift-tote.svg"], "Illustration of a cream canvas tote reading made with love"),
    variants: single("p-tote", "GIFT-TOTE", 14),
    createdAt: "2026-09-25T15:00:00Z", unitsSold: 73,
  },
];
