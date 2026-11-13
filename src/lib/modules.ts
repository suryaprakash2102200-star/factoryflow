/**
 * FactoryFlow module registry.
 *
 * Access rule (from the product architecture): a user can use a module only if
 *   the workspace has activated it  AND  the user's role grants the permission.
 * Plan/subscription entitlement is the third gate; it is not modelled yet, so
 * every module marked `available` can be activated by the owner.
 */
export const MODULES = [
  { key: "crm", label: "CRM & Customers", description: "Customers, contacts and enquiry pipeline.", core: true, available: true },
  { key: "quotations", label: "Quotations & Sales", description: "Priced quotes, revisions and PDF.", core: false, available: true },
  { key: "orders", label: "Order Management", description: "Confirmed orders from acceptance to dispatch.", core: false, available: true },
  { key: "production", label: "Production", description: "Job cards, stages, operators and output.", core: false, available: true },
  { key: "tasks", label: "Workforce & Tasks", description: "Assign and track tasks across the team.", core: false, available: true },
  { key: "invoices", label: "Invoices", description: "Invoices and payments against orders and quotes.", core: false, available: true },
  { key: "reports", label: "Reports & Analytics", description: "Dashboard KPIs across enabled modules.", core: false, available: true },
  { key: "products", label: "Product & BOM", description: "Product specs, bill of materials, routings.", core: false, available: false },
  { key: "inventory", label: "Inventory", description: "Stock, locations and movements.", core: false, available: false },
  { key: "purchasing", label: "Purchasing & Suppliers", description: "Suppliers, purchase orders and receipts.", core: false, available: false },
  { key: "quality", label: "Quality Management", description: "Inspections, rejects and rework.", core: false, available: false },
  { key: "maintenance", label: "Machine Maintenance", description: "Machines, service and downtime.", core: false, available: false },
  { key: "ai", label: "AI Factory Assistant", description: "Ask questions, daily summary, RFQ → draft quote, and update records by chat.", core: false, available: true },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const DEFAULT_MODULES: ModuleKey[] = ["crm", "quotations", "orders", "production", "reports", "tasks", "invoices"];

export function isModuleKey(k: string): k is ModuleKey {
  return MODULES.some((m) => m.key === k);
}

export function moduleEnabled(enabled: readonly string[] | undefined, key: ModuleKey): boolean {
  const m = MODULES.find((x) => x.key === key);
  if (m?.core) return true;
  return (enabled ?? DEFAULT_MODULES).includes(key);
}
