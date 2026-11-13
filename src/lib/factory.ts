/** Shared (client + server) rules for FactoryFlow orders and production jobs. */

export const ORDER_STATUSES = ["draft", "confirmed", "in_production", "ready", "dispatched", "closed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-600" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700" },
  in_production: { label: "In production", color: "bg-violet-100 text-violet-700" },
  ready: { label: "Ready for dispatch", color: "bg-amber-100 text-amber-700" },
  dispatched: { label: "Dispatched", color: "bg-cyan-100 text-cyan-700" },
  closed: { label: "Closed", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelled", color: "bg-rose-100 text-rose-700" },
};

/** Explicit transitions; Cancelled is a controlled exception before dispatch. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["in_production", "ready", "cancelled"],
  in_production: ["ready", "cancelled"],
  ready: ["dispatched", "in_production"],
  dispatched: ["closed"],
  closed: [],
  cancelled: [],
};

export const JOB_STAGES = ["planned", "in_progress", "paused", "quality_check", "completed", "cancelled"] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export const JOB_STAGE: Record<JobStage, { label: string; color: string; dot: string }> = {
  planned: { label: "Planned", color: "bg-slate-100 text-slate-600", dot: "#94a3b8" },
  in_progress: { label: "In progress", color: "bg-blue-100 text-blue-700", dot: "#3b82f6" },
  paused: { label: "Paused", color: "bg-amber-100 text-amber-700", dot: "#f59e0b" },
  quality_check: { label: "Quality check", color: "bg-violet-100 text-violet-700", dot: "#8b5cf6" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700", dot: "#10b981" },
  cancelled: { label: "Cancelled", color: "bg-rose-100 text-rose-700", dot: "#f43f5e" },
};

/** Board columns (cancelled jobs are filtered out of the board). */
export const BOARD_STAGES: JobStage[] = ["planned", "in_progress", "paused", "quality_check", "completed"];

export const UNITS = ["pcs", "kg", "m", "m²", "L", "set", "box"];
