import {
  LayoutDashboard,
  Users,
  ClipboardList,
  UserCog,
  ShieldCheck,
  Building2,
  Braces,
  UserRound,
  Trophy,
  FileText,
  Receipt,
  Settings2,
  Package,
  Factory,
  ToggleRight,
  History,
  BarChart3,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import { moduleEnabled, type ModuleKey } from "@/lib/modules";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: Permission;
  module?: ModuleKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/leads", label: "Enquiries", icon: Users, perm: "lead:view", module: "crm" },
      { href: "/contacts", label: "Contacts", icon: UserRound, perm: "contact:view", module: "crm" },
      { href: "/accounts", label: "Customers", icon: Building2, perm: "account:view", module: "crm" },
      { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/billing/quotes", label: "Quotations", icon: FileText, perm: "quote:view", module: "quotations" },
      { href: "/orders", label: "Orders", icon: Package, perm: "order:view", module: "orders" },
      { href: "/production", label: "Production", icon: Factory, perm: "production:view", module: "production" },
      { href: "/action-tracker", label: "Tasks", icon: ClipboardList, perm: "task:view", module: "tasks" },
      { href: "/billing/invoices", label: "Invoices", icon: Receipt, perm: "invoice:view", module: "invoices" },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/admin/users", label: "Users", icon: UserCog, perm: "user:view" },
      { href: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, perm: "role:view" },
      { href: "/admin/stages", label: "Pipeline Stages", icon: Trophy, perm: "stage:view" },
      { href: "/admin/fields", label: "Schema Builder", icon: Braces, perm: "field_definition:view" },
      { href: "/admin/masters", label: "Masters", icon: Boxes, perm: "master:view" },
      { href: "/admin/modules", label: "Modules", icon: ToggleRight, perm: "tenant:view" },
      { href: "/admin/tenant", label: "Workspace", icon: Settings2, perm: "tenant:view" },
      { href: "/admin/audit", label: "Audit log", icon: History, perm: "audit:view" },
    ],
  },
];

export function visibleGroups(permissions: Permission[], modules?: readonly string[]): NavGroup[] {
  const has = (p?: Permission) => !p || permissions.includes(p);
  const on = (m?: ModuleKey) => !m || moduleEnabled(modules, m);
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => has(i.perm) && on(i.module)) })).filter(
    (g) => g.items.length > 0,
  );
}

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** Best label for the current page, used by the header breadcrumb. */
export function pageLabel(pathname: string): string {
  let best: NavItem | undefined;
  for (const g of NAV_GROUPS)
    for (const i of g.items)
      if (isActivePath(pathname, i.href) && (!best || i.href.length > best.href.length)) best = i;
  if (best) {
    if (pathname.endsWith("/new")) return `New ${best.label.replace(/s$/, "").toLowerCase()}`;
    return best.label;
  }
  return "Dashboard";
}
