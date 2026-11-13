import type { Permission } from "@/lib/permissions";

/** Records that can carry files, and the permission resource that guards each. */
export const ATTACHABLE = {
  order: "order",
  production_job: "production",
  lead: "lead",
  quote: "quote",
  account: "account",
} as const;

export type AttachableType = keyof typeof ATTACHABLE;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function isAttachable(t: string): t is AttachableType {
  return t in ATTACHABLE;
}
export function attachPerm(t: AttachableType, action: "view" | "edit"): Permission {
  return `${ATTACHABLE[t]}:${action}` as Permission;
}
