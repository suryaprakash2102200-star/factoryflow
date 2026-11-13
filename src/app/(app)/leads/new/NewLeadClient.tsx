"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLeadAction } from "../actions";
import { DynamicLeadForm } from "@/components/leads/DynamicLeadForm";
import type { FieldDefinition } from "@/types/dynamic-lead";

interface Props {
  definitions: FieldDefinition[];
  stages: { id: string; name: string }[];
  users: { id: string; fullName: string }[];
  currentUserId: string;
}

export function NewLeadClient({ definitions, stages, users, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    start(async () => {
      try {
        const result = await createLeadAction({
          title,
          stageId,
          ownerId: ownerId || undefined,
          customValues: values,
        });
        if (!result.ok) {
          setErrors(result.errors);
          return;
        }
        router.push(`/leads/${result.lead.id}`);
      } catch (err) {
        setServerError((err as Error).message);
      }
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <form onSubmit={submit} className="mx-auto max-w-4xl space-y-8">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            New enquiry
          </div>
          <input
            className="w-full border-0 border-b border-slate-200 bg-transparent pb-3 text-3xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-300 focus:border-blue-500"
            placeholder="Enquiry title, e.g. 500 MS brackets for Shakti Steel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-lg">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Stage</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
            >
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Owner</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Enquiry details
          </h2>
          <DynamicLeadForm
            definitions={definitions}
            values={values}
            onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))}
            errors={errors}
          />
        </div>

        {serverError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {serverError}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create enquiry"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
