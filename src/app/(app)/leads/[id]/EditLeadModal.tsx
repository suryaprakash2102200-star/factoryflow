"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/Modal";
import { DynamicLeadForm } from "@/components/leads/DynamicLeadForm";
import { updateLeadAction, deleteLeadAction } from "./actions";
import type { FieldDefinition } from "@/types/dynamic-lead";

export function EditLeadModal({
  open,
  onClose,
  lead,
  definitions,
  users,
  canDelete,
}: {
  open: boolean;
  onClose: () => void;
  lead: {
    id: string;
    title: string;
    source: string | null;
    estimatedValue: number | null;
    currency: string;
    ownerId: string | null;
    customValues: Record<string, unknown>;
  };
  definitions: FieldDefinition[];
  users: { id: string; fullName: string }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState(lead.title);
  const [source, setSource] = useState(lead.source ?? "");
  const [estimatedValue, setEstimatedValue] = useState<string>(
    lead.estimatedValue != null ? String(lead.estimatedValue) : "",
  );
  const [currency, setCurrency] = useState(lead.currency || "USD");
  const [ownerId, setOwnerId] = useState<string>(lead.ownerId ?? "");
  const [values, setValues] = useState<Record<string, unknown>>(
    lead.customValues ?? {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setErrors({});
    start(async () => {
      try {
        const ev =
          estimatedValue.trim() === "" ? null : Number(estimatedValue);
        if (ev != null && Number.isNaN(ev)) {
          setServerError("Estimated value must be a number.");
          return;
        }
        const result = await updateLeadAction({
          leadId: lead.id,
          title: title.trim(),
          source: source.trim() || null,
          estimatedValue: ev,
          currency: currency.toUpperCase(),
          ownerId: ownerId || null,
          customValues: values,
        });
        if (!result.ok) {
          setErrors(result.errors);
          toast.error("Please fix the highlighted fields.");
          return;
        }
        toast.success("Enquiry updated");
        onClose();
        router.refresh();
      } catch (err) {
        setServerError((err as Error).message);
      }
    });
  }

  function doDelete() {
    startDelete(async () => {
      try {
        await deleteLeadAction({ leadId: lead.id });
        toast.success("Enquiry deleted");
        router.push("/leads");
      } catch (err) {
        setServerError((err as Error).message);
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit enquiry" size="lg">
      <form onSubmit={submit} className="flex flex-col gap-5 p-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Owner</label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          >
            <option value="">— Unassigned —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Source
            </label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Referral"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Estimated Value
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Currency
            </label>
            <input
              maxLength={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
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

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            {canDelete &&
              (confirmDelete ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-rose-700">Delete this lead?</span>
                  <button
                    type="button"
                    onClick={doDelete}
                    disabled={isDeleting}
                    className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  Delete
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
