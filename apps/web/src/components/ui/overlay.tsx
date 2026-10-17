"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onClose,
  title,
  children,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className={cn("dialog-surface", drawer && "drawer-surface")}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <h2 id={titleId} className="text-heading text-ink">{title}</h2>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="grid size-11 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink">×</button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}

export function Drawer(props: Omit<Parameters<typeof Dialog>[0], "drawer">) {
  return <Dialog {...props} drawer />;
}

export function Dropdown({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <details className="group relative inline-block">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-caption font-semibold text-ink hover:bg-surface-sunken [&::-webkit-details-marker]:hidden">{label}<span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span></summary>
      <div className="z-overlay absolute right-0 mt-2 min-w-48 rounded-lg border border-line bg-surface-raised p-2 shadow-[var(--shadow-lg)]">{children}</div>
    </details>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-overlay mb-2 hidden -translate-x-1/2 rounded-md bg-navy px-2 py-1 text-caption text-on-navy shadow-[var(--shadow-md)] group-hover:block group-focus-within:block">{label}</span>
    </span>
  );
}
