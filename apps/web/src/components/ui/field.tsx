import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export const CONTROL_CLASS = "field-control";

export function controlStyles(className?: string) {
  return cn(CONTROL_CLASS, className);
}

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-caption font-semibold text-ink">
      {children}
    </label>
  );
}

export function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-caption text-ink-subtle">
      {children}
    </p>
  );
}

export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return <p id={id} role="alert" className="field-error mt-1.5 text-caption">{children}</p>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={controlStyles(className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={controlStyles(className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={controlStyles(className)} {...props} />;
}

export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="checkbox" className={cn("size-5 shrink-0 accent-accent", className)} {...props} />;
}

export function Radio({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="radio" className={cn("size-5 shrink-0 accent-accent", className)} {...props} />;
}

export function Switch({ className, checked, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role">) {
  return <input type="checkbox" role="switch" checked={checked} className={cn("size-5 shrink-0 accent-accent", className)} {...props} />;
}
