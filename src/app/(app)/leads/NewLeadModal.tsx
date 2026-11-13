"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/Modal";
import { DynamicLeadForm } from "@/components/leads/DynamicLeadForm";
import { createLeadAction } from "./actions";
import type { FieldDefinition } from "@/types/dynamic-lead";

export function NewLeadModal({
  open,
  onClose,
  definitions,
  stages,
}: {
  open: boolean;
  onClose: () => void;
  definitions: FieldDefinition[];
  stages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setStageId(stages[0]?.id ?? "");
    setValues({});
    setErrors({});
    setServerError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setErrors({});
    start(async () => {
      try {
        const result = await createLeadAction({
          title,
          stageId,
          customValues: values,
        });
        if (!result.ok) {
          setErrors(result.errors);
          toast.error("Please fix the highlighted fields.");
          return;
        }
        toast.success("Enquiry created");
        reset();
        onClose();
        router.refresh();
      } catch (err) {
        setServerError((err as Error).message);
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="New enquiry" size="lg">
      <form onSubmit={submit} className="flex flex-col gap-5 p-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="Enquiry title, e.g. 500 MS brackets for Shakti Steel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Stage
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {definitions.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Enquiry details
            </h3>
            <DynamicLeadForm
              definitions={definitions}
              values={values}
              onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))}
              errors={errors}
            />
          </div>
        )}

        {serverError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create enquiry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
