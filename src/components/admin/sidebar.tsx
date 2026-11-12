"use client";

import {
  Boxes, ChartColumn, CreditCard, FileText, Layers, LayoutDashboard, LifeBuoy, LogOut, Menu, Package, Percent,
  Scissors, Settings, ShoppingBag, Truck, UserCog, Users, X, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import type { AdminNavItem } from "./nav";

const ICONS: Record<string, LucideIcon> = { LayoutDashboard, Package, Scissors, ShoppingBag, Layers, Boxes, Users, ChartColumn, CreditCard, Percent, Truck, FileText, UserCog, Settings, LifeBuoy };

function NavLink({ item, collapsed, active }: { item: AdminNavItem; collapsed: boolean; active: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 py-3 text-[15px] font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white",
        collapsed ? "justify-center px-0" : "px-6",
        active && "admin-nav-active text-white",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className={cn(collapsed && "sr-only")}>{item.label}</span>
    </Link>
  );
}

export function AdminSidebar({ items, footer, demo }: { items: AdminNavItem[]; footer: AdminNavItem[]; demo: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close drawer on navigation
  React.useEffect(() => setMobileOpen(false), [pathname]);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  async function logout() {
    if (!demo) {
      const { supabaseBrowser } = await import("@/lib/supabase/client");
      await supabaseBrowser().auth.signOut();
    }
    router.push(demo ? "/" : "/admin/login");
    router.refresh();
  }

  const body = (collapsed: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-[82px] shrink-0 items-center border-b border-white/15", collapsed ? "justify-center" : "px-6")}>
        {collapsed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/logo-white.svg" alt="Shagannan Shenanigans" className="h-9 w-auto" />
        ) : (
          <span className="text-[32px] font-normal tracking-tight text-white">Menu</span>
        )}
      </div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto py-1">
        {items.map((i) => <NavLink key={i.href} item={i} collapsed={collapsed} active={isActive(i.href)} />)}
      </nav>
      <div className="shrink-0 pb-6 pt-2">
        {footer.map((i) => <NavLink key={i.href} item={i} collapsed={collapsed} active={isActive(i.href)} />)}
        <button onClick={logout} className={cn("flex w-full items-center gap-3 py-3 text-[15px] font-medium text-white/90 hover:bg-white/10", collapsed ? "justify-center" : "px-6")} title={collapsed ? "Log out" : undefined}>
          <LogOut className="size-[18px]" />
          <span className={cn(collapsed && "sr-only")}>Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top trigger */}
      <button onClick={() => setMobileOpen(true)} className="fixed left-3 top-4 z-40 flex size-10 items-center justify-center rounded-lg bg-admin-purple text-white shadow md:hidden" aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      {/* Tablet: icon rail. Desktop: full sidebar. */}
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-30 hidden w-[76px] md:block xl:hidden">{body(true)}</aside>
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-30 hidden w-[243px] xl:block">{body(false)}</aside>
      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-50 md:hidden", mobileOpen ? "" : "pointer-events-none")} aria-hidden={!mobileOpen}>
        <div className={cn("absolute inset-0 bg-black/40 transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")} onClick={() => setMobileOpen(false)} />
        <aside className={cn("admin-sidebar absolute inset-y-0 left-0 w-[260px] shadow-xl transition-transform", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
          <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-6 rounded-lg p-1.5 text-white" aria-label="Close menu"><X className="size-5" /></button>
          {body(false)}
        </aside>
      </div>
    </>
  );
}
