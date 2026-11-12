import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared button primitive (shadcn pattern). Variants are split by surface:
 * `store-*` variants use only storefront tokens and `admin-*` variants use only
 * dashboard tokens, so the two identities stay separate.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        "store-primary": "bg-store-ink text-white hover:bg-black rounded-full",
        "store-outline": "border border-store-ink text-store-ink hover:bg-store-ink hover:text-white rounded-full",
        "store-tan": "bg-store-tan text-store-ink hover:bg-store-tan-deep hover:text-white rounded-full",
        "store-ghost": "text-store-ink hover:bg-store-cream rounded-full",
        "admin-primary": "bg-gradient-to-b from-admin-purple to-admin-purple-deep text-white hover:brightness-110 rounded-lg shadow-sm",
        "admin-pink": "bg-admin-pink text-white hover:brightness-110 rounded-lg",
        "admin-outline": "border border-admin-border bg-white text-admin-ink hover:bg-admin-lavender rounded-lg",
        "admin-ghost": "text-admin-ink hover:bg-admin-lavender rounded-lg",
        "admin-danger": "bg-admin-danger text-white hover:brightness-110 rounded-lg",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-13 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "store-primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";

export { buttonVariants };
