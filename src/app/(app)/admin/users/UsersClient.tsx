"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Permission } from "@/lib/permissions";
import { ActionBar, PermissionButton } from "@/components/PermissionButton";
import {
  createUserAction,
  updateUserAction,
  deleteUserAction,
} from "../actions";

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roleId: string | null;
  roleName: string | null;
  isActive: boolean;
  createdAt: string;
}
interface RoleOption {
  id: string;
  name: string;
}

export function UsersClient({
  permissions,
  users,
  roles,
  currentUserId,
}: {
  permissions: Permission[];
  users: UserRow[];
  roles: RoleOption[];
  currentUserId: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function exportCsv() {
    const rows = [
      ["Email", "Full Name", "Role", "Active", "Created"],
      ...users.map((u) => [
        u.email,
        u.fullName,
        u.roleName ?? u.role,
        String(u.isActive),
        u.createdAt,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {users.length} user{users.length === 1 ? "" : "s"}
        </div>
        <ActionBar
          permissions={permissions}
          resource="user"
          extra={
            <>
              <PermissionButton
                permissions={permissions}
                required="user:create"
                variant="primary"
                onClick={() => setShowAdd(true)}
              >
                + Add user
              </PermissionButton>
              <PermissionButton
                permissions={permissions}
                required="user:export"
                onClick={exportCsv}
              >
                Export
              </PermissionButton>
            </>
          }
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.fullName}
                    {u.id === currentUserId && (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        you
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">
                    {u.roleName ?? u.role}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <PermissionButton
                        permissions={permissions}
                        required="user:edit"
                        onClick={() => setEditing(u)}
                      >
                        Edit
                      </PermissionButton>
                      <PermissionButton
                        permissions={permissions}
                        required="user:delete"
                        variant="danger"
                        onClick={() => {
                          if (u.id === currentUserId) {
                            alert("You can't delete yourself.");
                            return;
                          }
                          if (!confirm(`Delete ${u.fullName}?`)) return;
                          startTransition(async () => {
                            try {
                              await deleteUserAction({ id: u.id });
                              toast.success(`${u.fullName} deleted`);
                            } catch {
                              toast.error("Failed to delete user");
                            }
                          });
                        }}
                      >
                        Delete
                      </PermissionButton>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <UserModal
          roles={roles}
          onClose={() => setShowAdd(false)}
          onSave={(data) =>
            startTransition(async () => {
              await createUserAction(data);
              setShowAdd(false);
            })
          }
          isPending={isPending}
        />
      )}

      {editing && (
        <UserModal
          user={editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSave={(data) =>
            startTransition(async () => {
              await updateUserAction({
                id: editing.id,
                fullName: data.fullName,
                roleId: data.roleId || null,
                role: data.role,
                isActive: data.isActive,
              });
              setEditing(null);
            })
          }
          isPending={isPending}
        />
      )}
    </div>
  );
}

function UserModal({
  user,
  roles,
  onClose,
  onSave,
  isPending,
}: {
  user?: UserRow;
  roles: RoleOption[];
  onClose: () => void;
  onSave: (data: {
    email: string;
    fullName: string;
    password: string;
    role: "owner" | "admin" | "manager" | "agent" | "viewer";
    roleId?: string;
    isActive: boolean;
  }) => void;
  isPending: boolean;
}) {
  const isEdit = !!user;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {isEdit ? "Edit user" : "Add user"}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            onSave({
              email: String(f.get("email") ?? user?.email ?? ""),
              fullName: String(f.get("fullName") ?? ""),
              password: String(f.get("password") ?? ""),
              role: String(f.get("role") ?? "agent") as
                | "owner"
                | "admin"
                | "manager"
                | "agent"
                | "viewer",
              roleId: String(f.get("roleId") ?? "") || undefined,
              isActive: f.get("isActive") === "on",
            });
          }}
          className="space-y-3"
        >
          <Input
            label="Full name"
            name="fullName"
            defaultValue={user?.fullName}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            defaultValue={user?.email}
            disabled={isEdit}
            required
          />
          {!isEdit && (
            <Input label="Password" name="password" type="password" required />
          )}
          <Select
            label="Role (tier)"
            name="role"
            defaultValue={user?.role ?? "agent"}
          >
            {["owner", "admin", "manager", "agent", "viewer"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select
            label="Custom role (overrides tier permissions)"
            name="roleId"
            defaultValue={user?.roleId ?? ""}
          >
            <option value="">— Use tier defaults —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={user?.isActive}
              />
              Active
            </label>
          )}
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
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <input
        {...rest}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );
}

function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string },
) {
  const { label, children, ...rest } = props;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <select
        {...rest}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
      >
        {children}
      </select>
    </div>
  );
}
