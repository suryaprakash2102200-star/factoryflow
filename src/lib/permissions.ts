export const RESOURCES = [
  "lead",
  "contact",
  "account",
  "quote",
  "invoice",
  "task",
  "activity",
  "note",
  "user",
  "role",
  "tenant",
  "field_definition",
  "stage",
  "order",
  "production",
  "audit",
  "master",
] as const;

export const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "import",
] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];
export type Permission = `${Resource}:${Action}`;

export const ALL_PERMISSIONS: Permission[] = RESOURCES.flatMap((r) =>
  ACTIONS.map((a) => `${r}:${a}` as Permission),
);

export const SYSTEM_ROLES = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((p) => !p.startsWith("tenant:delete")),
  manager: ALL_PERMISSIONS.filter(
    (p) =>
      !p.startsWith("user:") &&
      !p.startsWith("role:") &&
      !p.startsWith("tenant:"),
  ),
  agent: [
    "lead:view",
    "lead:create",
    "lead:edit",
    "contact:view",
    "contact:create",
    "contact:edit",
    "account:view",
    "account:create",
    "account:edit",
    "quote:view",
    "quote:create",
    "quote:edit",
    "invoice:view",
    "invoice:create",
    "invoice:edit",
    "task:view",
    "task:create",
    "task:edit",
    "activity:view",
    "activity:create",
    "note:view",
    "note:create",
    "stage:view",
    "lead:export",
    "contact:export",
    "account:export",
    "quote:export",
    "invoice:export",
    "order:view",
    "order:create",
    "order:edit",
    "order:export",
    "production:view",
    "master:view",
    "production:create",
    "production:edit",
  ] as Permission[],
  viewer: RESOURCES.map((r) => `${r}:view` as Permission),
};

export function hasPermission(
  userPerms: Permission[] | Set<string> | undefined,
  required: Permission,
): boolean {
  if (!userPerms) return false;
  if (userPerms instanceof Set) return userPerms.has(required);
  return userPerms.includes(required);
}

export function can(perms: Permission[] | undefined, p: Permission): boolean {
  return hasPermission(perms, p);
}
