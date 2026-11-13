import type { Prisma } from "@prisma/client";

/** Enquiry pipeline for a manufacturer (replaces the old real-estate demo). */
export const FACTORY_STAGES = [
  { name: "New enquiry", color: "#64748b", probability: 10 },
  { name: "Qualified", color: "#3b82f6", probability: 25 },
  { name: "Quoted", color: "#8b5cf6", probability: 50 },
  { name: "Negotiation", color: "#f59e0b", probability: 75 },
  { name: "Won", color: "#10b981", probability: 100, isTerminal: true },
  { name: "Lost", color: "#ef4444", probability: 0, isTerminal: true },
];

/** Old real-estate stage name → factory stage name (used when converting a workspace). */
const RENAME: Record<string, string> = {
  New: "New enquiry",
  Contacted: "Qualified",
  "Site Visit": "Quoted",
  Negotiation: "Negotiation",
  "Closed Won": "Won",
  "Closed Lost": "Lost",
};

const REALTY_FIELD_KEYS = ["property_type", "budget_inr", "area_sqft", "preferred_visit_date"];

export const FACTORY_FIELDS = [
  { key: "product_required", label: "Product / part required", type: "text" as const, isRequired: true },
  { key: "quantity", label: "Quantity", type: "number" as const, isRequired: false, validation: { min: 0 } },
  { key: "material", label: "Material / grade", type: "text" as const, isRequired: false },
  { key: "required_by", label: "Required by", type: "date" as const, isRequired: false },
  { key: "drawing_ref", label: "Drawing / spec reference", type: "text" as const, isRequired: false },
  {
    key: "enquiry_source",
    label: "Enquiry source",
    type: "dropdown" as const,
    isRequired: false,
    options: [
      { value: "phone", label: "Phone" },
      { value: "email", label: "Email" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "visit", label: "Walk-in / visit" },
      { value: "referral", label: "Referral" },
      { value: "tradeshow", label: "Trade show" },
    ],
  },
  { key: "requirements", label: "Requirements", type: "long_text" as const, isRequired: false },
];

/**
 * Applies the factory template to one tenant. Must run inside a transaction
 * where app.tenant_id is already set. Safe to run more than once.
 */
export async function applyFactoryTemplate(tx: Prisma.TransactionClient, tenantId: string, pipelineId: string) {
  const stages = await tx.leadStage.findMany({ where: { tenantId }, orderBy: { orderIndex: "asc" } });
  if (stages.length === 0) {
    for (const [i, s] of FACTORY_STAGES.entries()) {
      await tx.leadStage.create({ data: { ...s, orderIndex: i, tenantId, pipelineId } });
    }
  } else {
    for (const s of stages) {
      const to = RENAME[s.name];
      if (to && to !== s.name) await tx.leadStage.update({ where: { id: s.id }, data: { name: to } });
    }
  }

  await tx.fieldDefinition.deleteMany({ where: { tenantId, entity: "lead", key: { in: REALTY_FIELD_KEYS } } });
  for (const [i, f] of FACTORY_FIELDS.entries()) {
    const data = {
      label: f.label,
      type: f.type,
      isRequired: f.isRequired,
      orderIndex: i,
      isActive: true,
      validation: "validation" in f ? f.validation : undefined,
      options: "options" in f ? f.options : undefined,
    };
    await tx.fieldDefinition.upsert({
      where: { tenantId_entity_key: { tenantId, entity: "lead", key: f.key } },
      update: data,
      create: { tenantId, entity: "lead", key: f.key, ...data },
    });
  }
}
