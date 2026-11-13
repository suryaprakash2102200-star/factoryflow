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

export interface FieldDefinitionDTO {
  key: string;
  label: string;
  type: FieldType;
  isRequired: boolean;
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
    maxLength?: number;
  } | null;
  options?: Array<{ value: string; label: string }> | null;
}

export class ValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super("Validation failed");
  }
}

export class DynamicFieldValidator {
  static validate(
    payload: Record<string, unknown>,
    definitions: FieldDefinitionDTO[],
  ): Record<string, unknown> {
    const errors: Record<string, string> = {};
    const cleaned: Record<string, unknown> = {};

    for (const def of definitions) {
      const raw = payload[def.key];
      const present = raw !== undefined && raw !== null && raw !== "";

      if (def.isRequired && !present) {
        errors[def.key] = `${def.label} is required`;
        continue;
      }
      if (!present) continue;

      try {
        cleaned[def.key] = this.coerce(raw, def);
      } catch (e) {
        errors[def.key] = `${def.label}: ${(e as Error).message}`;
      }
    }

    if (Object.keys(errors).length) throw new ValidationError(errors);
    return cleaned;
  }

  private static coerce(raw: unknown, def: FieldDefinitionDTO): unknown {
    const v = def.validation ?? {};
    switch (def.type) {
      case "text":
      case "long_text": {
        const s = String(raw);
        if (v.maxLength && s.length > v.maxLength)
          throw new Error(`max length ${v.maxLength}`);
        if (v.regex && !new RegExp(v.regex).test(s))
          throw new Error("invalid format");
        return s;
      }
      case "number":
      case "currency": {
        const n = Number(raw);
        if (Number.isNaN(n)) throw new Error("must be a number");
        if (v.min !== undefined && n < v.min) throw new Error(`min ${v.min}`);
        if (v.max !== undefined && n > v.max) throw new Error(`max ${v.max}`);
        return n;
      }
      case "date":
      case "datetime": {
        const d = new Date(String(raw));
        if (Number.isNaN(d.getTime())) throw new Error("invalid date");
        return d.toISOString();
      }
      case "boolean":
        return Boolean(raw);
      case "dropdown": {
        const allowed = (def.options ?? []).map((o) => o.value);
        if (!allowed.includes(String(raw)))
          throw new Error("value not in options");
        return raw;
      }
      case "multi_select": {
        if (!Array.isArray(raw)) throw new Error("must be array");
        const allowed = new Set((def.options ?? []).map((o) => o.value));
        for (const i of raw)
          if (!allowed.has(String(i))) throw new Error(`invalid option: ${i}`);
        return raw;
      }
      case "lookup":
      case "file":
        return String(raw);
      case "formula":
        throw new Error("formula fields are computed, not input");
      default:
        return raw;
    }
  }
}
