import type { Policy, SiteContent } from "../types";

/**
 * Default site content. In a configured store this is loaded from the
 * `site_content` table and edited in /admin/content. These defaults are the
 * brief's suggested copy and contain no invented contact details.
 */
export const defaultSiteContent: SiteContent = {
  logoUrl: "/brand/logo.svg",
  faviconUrl: "/brand/logo.svg",
  heroEyebrow: "Crochet dolls, custom shirts & handmade gifts",
  heroHeadline: "Handmade with Love. Made Just for You.",
  heroDescription:
    "Discover unique crochet creations, custom shirts, and thoughtful handmade gifts designed to bring a little joy to every occasion.",
  heroImageUrl: "/demo/tee-black-crown.jpg",
  heroPrimaryCta: { label: "Shop Now", href: "/shop" },
  heroSecondaryCta: { label: "Explore Custom Creations", href: "/custom-orders" },
  promoBanner: "Holiday custom orders are open. Order early for December delivery.",
  aboutHeadline: "A little studio with a lot of heart",
  aboutBody:
    "Shagannan Shenanigans is a small handmade studio creating crochet friends, custom apparel, and personal gifts. Every piece is made in small batches, and every custom order is reviewed by a real person before we begin.",
  contactEmail: null,
  contactPhone: null,
  socialLinks: {},
  footerTagline: "Handmade gifts, custom shirts, and crochet friends made with care.",
};

export const defaultPolicies: Policy[] = [
  {
    slug: "shipping",
    title: "Shipping Policy",
    body:
      "Ready-to-ship items usually leave the studio within 2 to 4 business days. Made-to-order and custom items ship once production is complete; the estimated production time is listed on each product. Shipping rates are shown at checkout before you pay. Local pickup is available where offered, and pickup instructions are sent once your order is ready.\n\nThe store owner should review and replace this placeholder policy in Admin > Website Content before launch.",
  },
  {
    slug: "returns",
    title: "Return Policy",
    body:
      "Unused ready-made items may be returned within 30 days of delivery. Because custom and personalized items are made just for you, they cannot be returned unless they arrive damaged or differ from your approved design. Contact us within 7 days of delivery if there is a problem.\n\nThe store owner should review and replace this placeholder policy in Admin > Website Content before launch.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    body:
      "We collect only the information needed to fulfill your order: your name, contact details, delivery address, and any reference images you upload. Payment details are handled by our payment processors (Stripe or Square) and never stored on our servers. Uploaded reference photos are stored privately and used only to make your order.\n\nThe store owner should review this placeholder with a qualified advisor before launch.",
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    body:
      "By placing an order you agree to provide accurate information and to review your custom design details. Previews shown on this website are approximate; the approved production proof is the final reference for custom work.\n\nThe store owner should review this placeholder with a qualified advisor before launch.",
  },
];
