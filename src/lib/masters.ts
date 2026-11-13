/** Pick-list kinds managed under Setup → Masters. */
export const MASTER_KINDS = {
  unit: { label: "Units", hint: "pcs, kg, m, set…" },
  material: { label: "Materials / grades", hint: "MS IS2062, SS304, EN8…" },
  gst_rate: { label: "GST rates", hint: "Value is the % (e.g. 18)" },
  payment_term: { label: "Payment terms", hint: "Printed on quotations and invoices" },
  delivery_term: { label: "Delivery terms", hint: "Ex-works, FOR destination…" },
  product_category: { label: "Product categories", hint: "Used to group the item master" },
  machine_type: { label: "Machine types", hint: "CNC, lathe, welding…" },
} as const;

export type MasterKind = keyof typeof MASTER_KINDS;
export const MASTER_KIND_KEYS = Object.keys(MASTER_KINDS) as MasterKind[];
