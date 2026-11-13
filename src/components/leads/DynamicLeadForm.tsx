"use client";

import React from "react";
import { FieldDefinition } from "@/types/dynamic-lead";

interface Props {
  definitions: FieldDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
}

export const DynamicLeadForm: React.FC<Props> = ({
  definitions,
  values,
  onChange,
  errors,
}) => {
  const ordered = [...definitions].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {ordered.map((def) => (
        <FieldRenderer
          key={def.id}
          def={def}
          value={values[def.key]}
          error={errors?.[def.key]}
          onChange={(v) => onChange(def.key, v)}
        />
      ))}
    </div>
  );
};

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";

const FieldRenderer: React.FC<{
  def: FieldDefinition;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}> = ({ def, value, error, onChange }) => {
  const control = (() => {
    switch (def.type) {
      case "text":
      case "lookup":
        return (
          <input
            className={inputCls}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "long_text":
        return (
          <textarea
            rows={4}
            className={inputCls}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "number":
      case "currency":
        return (
          <input
            type="number"
            className={inputCls}
            value={(value as number) ?? ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? null : Number(e.target.value))
            }
          />
        );
      case "date":
        return (
          <input
            type="date"
            className={inputCls}
            value={
              value ? new Date(value as string).toISOString().slice(0, 10) : ""
            }
            onChange={(e) =>
              onChange(
                e.target.value ? new Date(e.target.value).toISOString() : null,
              )
            }
          />
        );
      case "datetime":
        return (
          <input
            type="datetime-local"
            className={inputCls}
            value={
              value
                ? new Date(value as string).toISOString().slice(0, 16)
                : ""
            }
            onChange={(e) =>
              onChange(
                e.target.value ? new Date(e.target.value).toISOString() : null,
              )
            }
          />
        );
      case "boolean":
        return (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
        );
      case "dropdown":
        return (
          <select
            className={inputCls}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">—</option>
            {def.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case "multi_select": {
        const selected = (value as string[]) ?? [];
        return (
          <div className="flex flex-wrap gap-2">
            {def.options?.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  type="button"
                  key={o.value}
                  onClick={() =>
                    onChange(
                      on
                        ? selected.filter((v) => v !== o.value)
                        : [...selected, o.value],
                    )
                  }
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    on
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        );
      }
      case "formula":
        return (
          <input
            readOnly
            className={`${inputCls} bg-slate-50`}
            value={(value as string) ?? "—"}
          />
        );
      case "file":
        return (
          <input
            type="file"
            className={inputCls}
            onChange={(e) => onChange(e.target.files?.[0])}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {def.label}
        {def.isRequired && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {control}
      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  );
};
