import Link from "next/link";
import type { Permission } from "@/lib/permissions";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-blue-600 text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
  danger:
    "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
};

interface BaseProps {
  permissions: Permission[];
  required: Permission;
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

type AnchorProps = BaseProps & { href: string } & Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof BaseProps | "href"
  >;

type ButtonProps = BaseProps & { href?: undefined } & Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    keyof BaseProps
  >;

export function PermissionButton(props: AnchorProps | ButtonProps) {
  const {
    permissions,
    required,
    variant = "secondary",
    children,
    className = "",
    title,
    ...rest
  } = props;
  if (!permissions.includes(required)) return null;
  const cls = `inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${VARIANTS[variant]} ${className}`;
  if ("href" in rest && rest.href) {
    // File downloads (/api/...) must be plain links: Next's <Link> would
    // prefetch/render them as pages, which 500s and shows "page not found".
    if (rest.href.startsWith("/api/")) {
      return (
        <a title={title} className={cls} {...(rest as Omit<AnchorProps, keyof BaseProps>)}>
          {children}
        </a>
      );
    }
    return (
      <Link
        title={title}
        className={cls}
        {...(rest as Omit<AnchorProps, keyof BaseProps>)}
        href={rest.href}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      title={title}
      className={cls}
      {...(rest as Omit<ButtonProps, keyof BaseProps | "href">)}
    >
      {children}
    </button>
  );
}

export function ActionBar({
  permissions,
  resource,
  onAddHref,
  onExport,
  onImport,
  extra,
}: {
  permissions: Permission[];
  resource: string;
  onAddHref?: string;
  onExport?: string;
  onImport?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onAddHref && (
        <PermissionButton
          permissions={permissions}
          required={`${resource}:create` as Permission}
          variant="primary"
          href={onAddHref}
        >
          + Add
        </PermissionButton>
      )}
      {onImport && (
        <PermissionButton
          permissions={permissions}
          required={`${resource}:import` as Permission}
          href={onImport}
        >
          Import
        </PermissionButton>
      )}
      {onExport && (
        <PermissionButton
          permissions={permissions}
          required={`${resource}:export` as Permission}
          href={onExport}
        >
          Export
        </PermissionButton>
      )}
      {extra}
    </div>
  );
}
