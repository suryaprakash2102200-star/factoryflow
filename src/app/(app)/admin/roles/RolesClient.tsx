"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { PermissionButton } from "@/components/PermissionButton";
import {
  RESOURCES,
  ACTIONS,
  type Permission,
} from "@/lib/permissions";
import {
  createRoleAction,
  deleteRoleAction,
  updateRolePermissionsAction,
} from "../actions";

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

export function RolesClient({
  permissions,
  roles,
  permissionsByRole,
}: {
  permissions: Permission[];
  roles: RoleRow[];
  permissionsByRole: Record<string, string[]>;
}) {
  const [activeId, setActiveId] = useState<string | null>(roles[0]?.id ?? null);
  const [showAdd, setShowAdd] = useState(false);
  const [draftPerms, setDraftPerms] = useState<Record<string, Set<string>>>(
    () => {
      const m: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(permissionsByRole))
        m[k] = new Set(v);
      return m;
    },
  );
  const [isPending, startTransition] = useTransition();

  const active = useMemo(
    () => roles.find((r) => r.id === activeId) ?? null,
    [roles, activeId],
  );
  const currentSet = activeId ? draftPerms[activeId] ?? new Set() : new Set();

  function toggle(perm: string) {
    if (!activeId || !active || active.isSystem) return;
    setDraftPerms((prev) => {
      const copy = { ...prev };
      const s = new Set(copy[activeId] ?? []);
      if (s.has(perm)) s.delete(perm);
      else s.add(perm);
      copy[activeId] = s;
      return copy;
    });
  }

  function toggleRow(resource: string, checked: boolean) {
    if (!activeId || !active || active.isSystem) return;
    setDraftPerms((prev) => {
      const copy = { ...prev };
      const s = new Set(copy[activeId] ?? []);
      for (const a of ACTIONS) {
        const p = `${resource}:${a}`;
        if (checked) s.add(p);
        else s.delete(p);
      }
      copy[activeId] = s;
      return copy;
    });
  }

  function save() {
    if (!activeId) return;
    startTransition(async () => {
      try {
        await updateRolePermissionsAction({
          roleId: activeId,
          permissions: Array.from(draftPerms[activeId] ?? []),
        });
        toast.success("Permissions saved");
      } catch {
        toast.error("Failed to save permissions");
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Roles
          </div>
          <PermissionButton
            permissions={permissions}
            required="role:create"
            variant="primary"
            onClick={() => setShowAdd(true)}
            className="!px-2.5 !py-1 !text-xs"
          >
            + New
          </PermissionButton>
        </div>
        <div className="flex flex-col gap-1">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                activeId === r.id
                  ? "border-blue-500 bg-blue-500 text-white shadow-sm shadow-blue-500/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div>
                <div className="font-medium capitalize">{r.name}</div>
                {r.description && (
                  <div
                    className={`mt-0.5 text-xs ${activeId === r.id ? "text-slate-300" : "text-slate-500"}`}
                  >
                    {r.description}
                  </div>
                )}
              </div>
              {r.isSystem && (
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    activeId === r.id
                      ? "bg-white/10 text-slate-200"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  system
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        {active ? (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold capitalize text-slate-900">
                  {active.name}
                </div>
                <div className="text-xs text-slate-500">
                  {active.isSystem
                    ? "System role — permissions fixed."
                    : `${currentSet.size} permission${currentSet.size === 1 ? "" : "s"} granted`}
                </div>
              </div>
              {!active.isSystem && (
                <div className="flex gap-2">
                  <PermissionButton
                    permissions={permissions}
                    required="role:edit"
                    variant="primary"
                    onClick={save}
                    title="Save permissions"
                  >
                    {isPending ? "Saving…" : "Save"}
                  </PermissionButton>
                  <PermissionButton
                    permissions={permissions}
                    required="role:delete"
                    variant="danger"
                    onClick={() => {
                      if (!confirm(`Delete role ${active.name}?`)) return;
                      startTransition(async () => {
                        await deleteRoleAction({ id: active.id });
                        setActiveId(null);
                      });
                    }}
                  >
                    Delete
                  </PermissionButton>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Resource</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="px-3 py-2.5 text-center capitalize">
                        {a}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center">All</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {RESOURCES.map((resource) => {
                    const rowChecked = ACTIONS.every((a) =>
                      currentSet.has(`${resource}:${a}`),
                    );
                    return (
                      <tr key={resource}>
                        <td className="px-4 py-2.5 font-medium capitalize text-slate-900">
                          {resource.replace("_", " ")}
                        </td>
                        {ACTIONS.map((a) => {
                          const perm = `${resource}:${a}`;
                          const checked = currentSet.has(perm);
                          return (
                            <td key={a} className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                disabled={active.isSystem}
                                checked={checked}
                                onChange={() => toggle(perm)}
                              />
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            disabled={active.isSystem}
                            checked={rowChecked}
                            onChange={(e) =>
                              toggleRow(resource, e.target.checked)
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500">
            Select a role to edit its permissions.
          </div>
        )}
      </div>

      {showAdd && (
        <AddRoleModal
          onClose={() => setShowAdd(false)}
          onSave={(data) =>
            startTransition(async () => {
              await createRoleAction(data);
              setShowAdd(false);
            })
          }
          isPending={isPending}
        />
      )}
    </div>
  );
}

function AddRoleModal({
  onClose,
  onSave,
  isPending,
}: {
  onClose: () => void;
  onSave: (d: { name: string; description?: string }) => void;
  isPending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900">New role</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            onSave({
              name: String(f.get("name") ?? ""),
              description: String(f.get("description") ?? "") || undefined,
            });
          }}
          className="space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Name
            </label>
            <input
              name="name"
              required
              minLength={2}
              maxLength={40}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Description
            </label>
            <input
              name="description"
              maxLength={200}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
