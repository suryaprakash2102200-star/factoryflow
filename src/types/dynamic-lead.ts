export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "dropdown"
  | "multi_select"
  | "boolean"
  | "formula"
  | "lookup"
  | "file";

export interface FieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface FieldDefinition {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  isRequired: boolean;
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
    maxLength?: number;
  };
  options?: FieldOption[];
  orderIndex: number;
}

export interface DynamicLead {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
  ownerId: string | null;
  title: string;
  source: string | null;
  estimatedValue: number | null;
  currency: string;
  customValues: Record<string, unknown>;
  isStale: boolean;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}
