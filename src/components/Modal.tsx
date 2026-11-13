"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Thin wrapper over shadcn Dialog to preserve the previous Modal API
 * used across the app (open/onClose/title/size).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const widths = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-4xl",
  }[size];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        className={`${widths} max-h-[92vh] gap-0 overflow-hidden p-0`}
      >
        {title && (
          <DialogHeader className="border-b border-slate-200 px-5 py-3.5">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {title}
            </DialogTitle>
          </DialogHeader>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
