"use client";

import { useState } from "react";
import { NewLeadModal } from "./NewLeadModal";
import type { FieldDefinition } from "@/types/dynamic-lead";

export function NewLeadButton({
  definitions,
  stages,
}: {
  definitions: FieldDefinition[];
  stages: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700"
      >
        + New enquiry
      </button>
      <NewLeadModal
        open={open}
        onClose={() => setOpen(false)}
        definitions={definitions}
        stages={stages}
      />
    </>
  );
}
