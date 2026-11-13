"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setModulesAction } from "./actions";

type Mod = { key: string; label: string; description: string; core: boolean; available: boolean; on: boolean };

export function ModulesClient({ modules, canEdit }: { modules: Mod[]; canEdit: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(() => Object.fromEntries(modules.map((m) => [m.key, m.on])));
  const [pending, start] = useTransition();
  const dirty = modules.some((m) => state[m.key] !== m.on);

  function save() {
    start(async () => {
      try {
        await setModulesAction({ modules: Object.keys(state).filter((k) => state[k]) });
        toast.success("Modules updated");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  const live = modules.filter((m) => m.available);
  const soon = modules.filter((m) => !m.available);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Modules</h2>
        <p className="mt-1 text-sm text-slate-500">
          Switch on only what your factory uses. Turning a module off hides it and blocks its actions. Your data stays saved.
        </p>
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {live.map((m) => {
          const on = !!state[m.key];
          return (
            <li key={m.key} className="flex items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {m.label}
                  {m.core && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Always on</span>}
                </p>
                <p className="text-xs text-slate-500">{m.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${m.label} module`}
                disabled={!canEdit || m.core || pending}
                onClick={() => setState((s) => ({ ...s, [m.key]: !s[m.key] }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${on ? "bg-blue-600" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </li>
          );
        })}
      </ul>

      {canEdit && (
        <div className="flex justify-end">
          <button onClick={save} disabled={!dirty || pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Coming later</h3>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {soon.map((m) => (
            <li key={m.key} className="rounded-xl border border-dashed border-slate-200 px-4 py-3">
              <p className="text-sm font-medium text-slate-700">{m.label}</p>
              <p className="text-xs text-slate-500">{m.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
