import type { Cents } from "./money";

/** Domain types. These mirror the Supabase schema in supabase/migrations. */

export type ProductStatus = "draft" | "active" | "archived" | "out_of_stock";
/** ready_made: ships from stock. custom: made after ordering. both: either path. */
export type FulfillmentType = "ready_made" | "custom" | "both";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface ProductMedia {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  /** null means use the product base price */
  priceCents: Cents | null;
  salePriceCents: Cents | null;
  /** null for made-to-order variants that have no finished stock */
  stockQuantity: number | null;
  reservedQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export type CustomizationFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multi_select"
  | "color"
  | "file"
  | "number"
  | "checkbox";

export interface CustomizationOption {
  value: string;
  label: string;
  priceDeltaCents: Cents;
  swatch?: string;
}

export interface CustomizationField {
  id: string;
  key: string;
  label: string;
  type: CustomizationFieldType;
  required: boolean;
  helpText?: string;
  options: CustomizationOption[];
  /** flat surcharge applied when the field has any value (e.g. custom text +$5) */
  priceDeltaCents: Cents;
  maxLength?: number;
  sortOrder: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  status: ProductStatus;
  fulfillmentType: FulfillmentType;
  /** e.g. "shirt" or "crochet_doll" — selects the dedicated customizer UI */
  customizerKind: "shirt" | "crochet_doll" | "generic" | null;
  categoryIds: string[];
  basePriceCents: Cents;
  salePriceCents: Cents | null;
  productionDaysMin: number | null;
  productionDaysMax: number | null;
  /** Allow customer to submit a quote request instead of paying now */
  quoteOnly: boolean;
  rushAvailable: boolean;
  rushFeeCents: Cents;
  isFeatured: boolean;
  isSeasonal: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  media: ProductMedia[];
  variants: ProductVariant[];
  customizationFields: CustomizationField[];
  createdAt: string;
  /** total units sold, used for "popularity" sort */
  unitsSold: number;
  isDemo?: boolean;
}

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "requires_reconciliation";

export type FulfillmentStatus =
  | "request_received"
  | "quote_pending"
  | "awaiting_payment"
  | "paid"
  | "design_review"
  | "approved"
  | "in_production"
  | "ready_for_shipping"
  | "ready_for_pickup"
  | "shipped"
  | "completed"
  | "cancelled";

export type PaymentProvider = "stripe" | "square";
export type DeliveryMethod = "shipping" | "pickup";

export interface OrderItemSnapshot {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  variantId: string | null;
  sku: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPriceCents: Cents;
  customizationCents: Cents;
  lineTotalCents: Cents;
  isCustom: boolean;
  customization: Record<string, string | string[]>;
  categoryIds: string[];
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  items: OrderItemSnapshot[];
  subtotalCents: Cents;
  discountCents: Cents;
  shippingCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  refundedCents: Cents;
  paymentStatus: PaymentStatus;
  paymentProvider: PaymentProvider | null;
  fulfillmentStatus: FulfillmentStatus;
  deliveryMethod: DeliveryMethod;
  isCustomOrder: boolean;
  createdAt: string;
  isDemo?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  isDemo?: boolean;
}

export interface SiteContent {
  logoUrl: string | null;
  faviconUrl: string | null;
  heroEyebrow: string;
  heroHeadline: string;
  heroDescription: string;
  heroImageUrl: string;
  /** Background video for the homepage hero (MP4/WebM in the site-videos bucket). */
  heroVideoUrl?: string | null;
  /** Still image shown while the hero video loads, and to visitors who prefer reduced motion. */
  heroVideoPosterUrl?: string | null;
  heroPrimaryCta: { label: string; href: string };
  heroSecondaryCta: { label: string; href: string };
  promoBanner: string | null;
  aboutHeadline: string;
  aboutBody: string;
  contactEmail: string | null;
  contactPhone: string | null;
  socialLinks: { instagram?: string; facebook?: string; tiktok?: string; pinterest?: string };
  footerTagline: string;
}

export interface Policy {
  slug: string;
  title: string;
  body: string;
}
